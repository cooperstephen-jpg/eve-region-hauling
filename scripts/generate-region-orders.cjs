#!/usr/bin/env node
// Generate per-region best quotes snapshots from ESI and write to public/data/region_orders/[regionId].json
// Env:
//   REGIONS: comma-separated region IDs. If unset, every region listed in
//            public/data/regions.json is used (i.e. "all regions").
//   REGION_CONCURRENCY: how many regions to process in parallel (default 3)
//   CONCURRENCY: parallel page fetches per region (default 2)
//   PAGES_LIMIT: optional cap on pages per region (for testing)

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const ESI_BASE = 'https://esi.evetech.net/latest';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPage(regionId, page) {
    const url = `${ESI_BASE}/markets/${regionId}/orders/?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const data = await res.json();
    const pagesHeader = res.headers.get('x-pages');
    const totalPages = pagesHeader ? parseInt(pagesHeader, 10) : null;
    return { data, totalPages };
}

function updateBestQuotes(map, order) {
    const t = order.type_id;
    let entry = map.get(t);
    if (!entry) {
        entry = { best_buy: null, best_sell: null };
        map.set(t, entry);
    }
    if (order.is_buy_order) {
        if (!entry.best_buy || order.price > entry.best_buy.price) {
            entry.best_buy = {
                price: order.price,
                location_id: order.location_id,
                volume_remain: order.volume_remain
            };
        }
    } else {
        if (!entry.best_sell || order.price < entry.best_sell.price) {
            entry.best_sell = {
                price: order.price,
                location_id: order.location_id,
                volume_remain: order.volume_remain
            };
        }
    }
}

async function generateForRegion(regionId, concurrency, pagesLimit) {
    console.log(`Generating best quotes for region ${regionId}...`);
    // First page to discover total pages
    const first = await fetchPage(regionId, 1);
    const totalPages = Math.max(1, first.totalPages || 1);
    const cap = pagesLimit ? Math.min(totalPages, pagesLimit) : totalPages;

    const bestMap = new Map();
    // process first page
    for (const o of first.data) updateBestQuotes(bestMap, o);

    let nextPage = 2;
    async function worker() {
        while (nextPage <= cap) {
            const p = nextPage++;
            try {
                const { data } = await fetchPage(regionId, p);
                for (const o of data) updateBestQuotes(bestMap, o);
            } catch (e) {
                console.warn(`Region ${regionId} page ${p} failed:`, e.message);
                await sleep(250);
            }
            await sleep(50);
        }
    }
    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);

    // Build compact JSON
    const best_quotes = {};
    for (const [typeId, v] of bestMap.entries()) {
        best_quotes[typeId] = {
            best_buy: v.best_buy || null,
            best_sell: v.best_sell || null
        };
    }
    return {
        region_id: regionId,
        last_updated: new Date().toISOString(),
        best_quotes
    };
}

// PLEX has its own region (19000001) but no real order book / snapshot support.
const PLEX_REGION_ID = 19000001;

async function loadAllKnownRegionIds(repoRoot) {
    const regionsPath = path.join(repoRoot, 'public', 'data', 'regions.json');
    const raw = await fsp.readFile(regionsPath, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.regions) ? parsed.regions : []);
    return list
        .map(r => Number(r.regionID ?? r.region_id ?? r.id))
        .filter(id => Number.isFinite(id) && id !== PLEX_REGION_ID);
}

async function main() {
    const repoRoot = process.cwd();
    // OUTPUT_DIR lets CI point this at a gh-pages checkout's data/region_orders
    // instead of the local public/data/region_orders used for dev.
    const outDir = process.env.OUTPUT_DIR
        ? path.resolve(repoRoot, process.env.OUTPUT_DIR)
        : path.join(repoRoot, 'public', 'data', 'region_orders');
    await fsp.mkdir(outDir, { recursive: true });

    const regions = process.env.REGIONS
        ? process.env.REGIONS.split(',').map(s => Number(s.trim())).filter(Boolean)
        : await loadAllKnownRegionIds(repoRoot);
    const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 2));
    const regionConcurrency = Math.max(1, Number(process.env.REGION_CONCURRENCY || 3));
    const pagesLimit = process.env.PAGES_LIMIT ? Number(process.env.PAGES_LIMIT) : null;

    console.log(`Processing ${regions.length} region(s) with region-concurrency=${regionConcurrency}, page-concurrency=${concurrency}.`);

    let nextIdx = 0;
    async function regionWorker() {
        while (nextIdx < regions.length) {
            const region = regions[nextIdx++];
            try {
                const snapshot = await generateForRegion(region, concurrency, pagesLimit);
                const outPath = path.join(outDir, `${region}.json`);
                await fsp.writeFile(outPath, JSON.stringify(snapshot));
                console.log(`Wrote ${path.relative(repoRoot, outPath)} with ${Object.keys(snapshot.best_quotes).length} types.`);
            } catch (e) {
                console.error(`Failed region ${region}:`, e.message);
            }
        }
    }
    const workers = Array.from({ length: Math.min(regionConcurrency, regions.length) }, () => regionWorker());
    await Promise.all(workers);
}

main().catch(err => {
    console.error('Snapshot generation failed:', err);
    process.exit(1);
});
