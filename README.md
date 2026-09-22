# EVE Region Hauling

A revival of the "Region to Region" hauling tool from the old EVE Online trading
sites (the original **evetrade.space**, and the later fan recreation
**EVE-Data-Site**) — both of which have gone dark. This is a from-scratch
rebuild of just that one tool, with a backend that can't quietly die the way
the originals did: no Azure, no AWS Lambda, no Elasticsearch cluster to pay
for or forget about. Just this repo and GitHub's own infrastructure.

Pick a starting region and an ending region, set your filters (minimum
profit, ROI, cargo capacity, budget, security, structure type, sales tax),
and get a sortable table of items to buy in one region and sell in the
other.

## How it works

- **Frontend**: a small React + Vite app (`src/`). It's a static site — no
  server-side rendering, no API of its own.
- **Data**: EVE market data for the 5 major trade hub regions is fetched
  from [ESI](https://esi.evetech.net/latest) and written to
  `data/region_orders/<regionId>.json` directly on the `gh-pages` branch —
  the same "commit JSON as a free CDN" trick the original sites used, just
  driven by GitHub Actions instead of a paid function app.
- **Route computation happens in the browser.** The two files (`from`
  region and `to` region) are fetched, and profitable trades are computed
  client-side. There's no server-side query API to keep running.

Two GitHub Actions workflows do all the work:

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/deploy.yml` | push to `main`, or manual | Builds the app and publishes `dist/` to the `gh-pages` branch |
| `.github/workflows/update-data.yml` | every 30 minutes, or manual | Pulls fresh order books from ESI for the 5 hub regions and commits the snapshots straight to `gh-pages` |

Both use the repo's own built-in `GITHUB_TOKEN` — no secrets to create, no
external accounts to sign up for.

## Setting this up under your own GitHub account

1. **Create a new repository** on GitHub (public, so GitHub Pages is free —
   e.g. `eve-region-hauling`) and push this project to it:

   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<you>/<your-repo-name>.git
   git push -u origin main
   ```

2. **If you rename the repo** away from `eve-region-hauling`, update the
   `REPO_NAME` constant at the top of `vite.config.js` to match — GitHub
   Pages serves project sites from `/<repo-name>/`, and the app needs to
   know that at build time.

3. **Allow Actions to push commits.** In your new repo: *Settings → Actions
   → General → Workflow permissions* → select **"Read and write
   permissions"** → Save. Without this, both workflows will fail to push.

4. **Run the deploy workflow once** to create the `gh-pages` branch: *Actions
   tab → "Deploy site" → Run workflow*. (It also runs automatically on your
   first push to `main`.)

5. **Turn on GitHub Pages**: *Settings → Pages* → Source: **"Deploy from a
   branch"** → Branch: **`gh-pages`** / `/(root)` → Save.

6. **Run the data workflow once** to populate real market data: *Actions tab
   → "Refresh market data" → Run workflow*. It takes a few minutes (Jita's
   order book alone is large). After that it runs automatically every 30
   minutes.

7. Visit `https://<you>.github.io/<your-repo-name>/`. The first search will
   only work for the two ends of a trade pair that both have a snapshot —
   by default that's the 5 hub regions: The Forge (Jita), Domain (Amarr),
   Sinq Laison (Dodixie), Heimatar (Rens), and Metropolis (Hek). Picking any
   other region will show a clear "no snapshot available" message rather
   than failing silently — that's expected; add its region ID to the
   `REGIONS` env var in `update-data.yml` if you want it covered too.

## Local development

```
npm install
npm run dev
```

This runs against whatever's already in `public/data/` (the reference
files — `regions.json`, `stations.json`, `market.json`, `structures.json` —
are checked in; region order snapshots are not, since they go stale). To
generate a local snapshot for testing:

```
npm run snapshots:region-orders:hubs
```

## Credits

The static reference data (`regions.json`, `stations.json`, `market.json`,
`structures.json`) and the ESI snapshot generator script started from
[sidarthus89/EVE-Data-Site](https://github.com/sidarthus89/EVE-Data-Site)
(MIT licensed), itself a recreation of the original
[awhipp/evetrade](https://github.com/awhipp/evetrade), which pioneered this
exact region-hauling tool and its filter set. Not affiliated with CCP
Games. EVE Online and the EVE logo are the registered trademarks of CCP hf.
