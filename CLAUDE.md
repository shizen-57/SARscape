# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SARscape is a 3D Earth-observation workspace for the NASA Space Apps challenge *Dancing with the SARs*: dated optical imagery plus NISAR radar (GOFF motion offsets, GCOV backscatter) on MapLibre terrain. npm workspaces (`frontend`, `backend`) plus Python processing scripts in `backend/geo`.

## Commands

```sh
npm install
pip install -r backend/requirements.txt   # or a venv at backend/.venv, or set SARSCAPE_PYTHON
npm run dev        # Vite UI :5173, API :8787, raster worker :8788 (fails if a port is taken)
npm run build      # tsc -b, vite build, then bundles the hosted Worker into dist/
npm start          # serves the built app on :8787 (needs `npm run build` first)
```

- **Tests:** `npm test` is `node --test tests`, which fails on Node 22 ("Cannot find module .../tests"). Use `node --test "tests/*.test.mjs"`. One file: `node --test tests/api.test.mjs`. One test: `node --test --test-name-pattern="<substring>" tests/science.test.mjs`.
- **Python tests** (`tests/*_test.py`) are normally run *by* Node tests (`science.test.mjs`, `gcov.test.mjs`, ...), but run directly with `python3 tests/goff_schema_test.py`. They need `h5py`, `rasterio` and `pyproj`; without them the suite fails with `ModuleNotFoundError`.
- **Type check:** `cd frontend && npx tsc --noEmit -p .` (there is no linter or formatter).
- **Data prep (optional, all outputs gitignored):** `npm run data:aletsch`, `data:surfaces`, `science:study`, `science:presentation`, `imagery:cache`, `imagery:refresh`.
- `tests/environment.test.mjs` copies an explicit list of `backend/geo/*.py` files into a temp project. When a Python module gains a new import, add the file to that list.

## Architecture

**Backend (`backend/src`, Hono on Node).**
- `app.mjs` exports `createApi({cache, renderTile, science, analysis, surfaces, assistant, study, fetchUpstream, ...})`. Every dependency is injected, and tests call `app.request('/api/...')` with fakes. Routes are registered there.
- `server.mjs` wires the real services for local use. `worker.mjs` is the *hosted* entry (bundled by `scripts/build.mjs` into `dist/server`). It has no Python, HDF5 or durable jobs, so features that need them must degrade to `available:false` there.
- `science.mjs` is the NISAR job service. An imported HDF5 goes to `database/raw`, `inspect_nisar.py` lists its channels, and `science.py` then dispatches to GOFF or GCOV processing as a spawned Python child process. Job state is JSON in `database/jobs`, products land in `database/processed`, and the queue is capped. Jobs interrupted by a restart become `interrupted` and can be retried from the stored upload. `analysis.mjs`, `study.mjs` and `surfaces.mjs` are sibling services for annual NDWI/NDVI, the supplied-study files and glacier-surface rasters.
- `raster.mjs` owns a Python tile server (`backend/geo/tile_server.py`, :8788) for optical imagery. `tiles.mjs` and `cache.mjs` put a SQLite cache (migrations in `database/migrations`) in front of it. `python.mjs` picks the interpreter in the order `SARSCAPE_PYTHON`, then `backend/.venv`, then system `python`.

**Frontend (`frontend/src`, React 19 + MapLibre).**
- `App.tsx` is one very large component holding all state. Routes are hash-based: `#explore` (the workspace) and `#simulation` (presentation modes). `components/TerrainMap.tsx` owns the MapLibre maps (a second map is mounted for compare and swipe) and is driven only through props plus the `MapControls` object it hands back via `onReady`.
- Non-React logic lives in `data/*.mjs` with hand-written `.d.mts` typings (playback clock, tile cache, saved views, radar display, motion preview, ...). Node tests import these directly, so keep them free of React and DOM imports. `components/frame-controller.mjs` crossfades dated capture layers and inserts them below overlay layers by id.
- **Two radar render paths coexist in `TerrainMap`, and both use the layer id `radar-samples`.** GOFF jobs go through `radarObservation` (replay, motion preview, `motion-layers.ts`). GCOV jobs, the supplied study (`studyOverlay`) and environment overlays go through `scienceJob` and `applyRadarPaint`. `App.tsx` keeps them mutually exclusive (`isGoff`). Keep that invariant when adding overlays.
- **Two GCOV pipelines coexist.** `gcov.py` and `gcov_compare.py` run via the job queue. `gcov_aletsch.py`, `prepare_aletsch.py` and `gcov_shaded.py` write the `database/processed/gcov` manifest, served at `/api/science/:id/gcov`. They are not interchangeable.

**Data and provenance.**
- `database/scenarios.json` (the locations) and `database/imagery/*.json` (capture manifests) are the registries. `database/raw`, `processed`, `jobs` and `*.sqlite` are gitignored, so a fresh checkout has no processed science data and tests use fixtures.
- This branch is a merge of `main` (presentation and environment work) and `codex/aletsch-small-data` (GCOV playback, motion preview, glacier surfaces, assistant). `README.md`, `TODO.md` and `PROJECT_STATUS.md` predate the merge and have drifted.

## Rules the code and docs enforce

- No synthetic data. Do not add invented motion cells, generated in-between captures or fabricated velocities. The only interpolation allowed is the labelled replay between the two measured dates of a GOFF pair (see `DESIGN.md`).
- Optical imagery shows appearance only. Do not present it, or terrain relief, as measured motion or elevation change. Radar offsets are in radar coordinates and are not glacier velocity until validated.
- Keep display previews (int16, 8-bit PNG) separate from original science products (float32 GeoTIFF), each with provenance.
- Never store Earthdata credentials or tokens in the repo or `database/`.
- The existing code is written in a dense, terse style (many statements per line, long JSX lines). Match it when editing nearby, and do not reformat whole files.
