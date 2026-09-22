// src/utils/market.js
// Region-hauling route computation, built from the per-region "best quotes"
// snapshots published to data/region_orders/<regionId>.json.

import { fetchRegionOrdersSnapshot } from './api.js';
import { getForbiddenSetFor } from './esi.js';

// Build cross-region trade routes from region_orders snapshots (best quotes per region)
export async function generateRegionRoutesFromSnapshots(originRegionId, destinationRegionId) {
    const from = Number(originRegionId);
    const to = Number(destinationRegionId || originRegionId);
    try {
        const [snapA, snapB] = await Promise.all([
            fetchRegionOrdersSnapshot(from),
            fetchRegionOrdersSnapshot(to)
        ]);

        if (!snapA || !snapB || !snapA.best_quotes || !snapB.best_quotes) return [];
        const routes = [];
        // Iterate over intersection of types present in both snapshots
        const typeIds = Object.keys(snapA.best_quotes);
        for (const t of typeIds) {
            const a = snapA.best_quotes[t];
            const b = snapB.best_quotes[t];
            if (!a || !b) continue;
            const sellA = a.best_sell; // we buy at origin's best sell
            const buyB = b.best_buy;   // we sell to destination's best buy
            if (!sellA || !buyB) continue;
            const profit = (buyB.price || 0) - (sellA.price || 0);
            if (profit <= 0) continue;
            const qty = Math.min(Number(sellA.volume_remain || 0), Number(buyB.volume_remain || 0));
            const roi = sellA.price > 0 ? (profit / sellA.price) * 100 : 0;
            routes.push({
                type_id: Number(t),
                origin_id: sellA.location_id,
                destination_id: buyB.location_id,
                sell_price: sellA.price,
                buy_price: buyB.price,
                profit_per_unit: profit,
                profit_margin: roi,
                max_volume: qty,
                origin_region_id: from,
                destination_region_id: to,
                _fallback: true
            });
        }
        // Exclude routes that involve forbidden structures (401/403/404 from ESI structure endpoint)
        try {
            const idsToCheck = new Set();
            for (const r of routes) {
                idsToCheck.add(Number(r.origin_id));
                idsToCheck.add(Number(r.destination_id));
            }
            const forbidden = await getForbiddenSetFor(Array.from(idsToCheck));
            const filtered = routes.filter(r => !forbidden.has(Number(r.origin_id)) && !forbidden.has(Number(r.destination_id)));
            // Sort by profit per unit desc and cap to a reasonable size
            return filtered.sort((x, y) => (y.profit_per_unit || 0) - (x.profit_per_unit || 0)).slice(0, 5000);
        } catch {
            // On any error, return unfiltered routes rather than fail the feature
            return routes.sort((x, y) => (y.profit_per_unit || 0) - (x.profit_per_unit || 0)).slice(0, 5000);
        }
    } catch {
        return [];
    }
}

// Build region-to-region routes purely from the region_orders snapshots.
export async function fetchRegionHaulingSnapshotsOnly(originRegionId, destinationRegionId = null) {
    return generateRegionRoutesFromSnapshots(originRegionId, destinationRegionId || originRegionId);
}
