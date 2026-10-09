# SARscape

A 3D glacier observation workspace for **Dancing with the SARs**. Explore genuine dated Sentinel-2 images, compare captures with a synchronized camera, and process NISAR GOFF science files through a separate backend. The application does not ship synthetic glacier measurements.

## Project layout

```text
frontend/    React, TypeScript, MapLibre terrain, Radix controls, image timeline
backend/     Hono API, Python/GDAL tile renderer, queued GOFF processing
database/    Scene manifests, SQLite cache, uploaded HDF5, processed products, jobs
scripts/     Development, production build/start, scene selection
tests/       API, timeline races, caching, GOFF schema and quality-mask checks
```

## Setup and run

Requires Node.js 24+ and Python 3.12+ with the libraries in `backend/requirements.txt`.

```sh
npm install
python -m pip install --target backend/.python -r backend/requirements.txt
npm run dev
```

Development UI: http://127.0.0.1:5173. API: http://127.0.0.1:8787. Raster worker: http://127.0.0.1:8788. Set `SARSCAPE_PYTHON` when your interpreter is not on PATH. The launcher also recognizes the bundled Codex Python runtime on this machine.

To run the built local application:

```sh
npm test
npm run build
npm start
```

Open http://127.0.0.1:8787. Stop the development stack before starting the production stack; they use the same backend ports. The production launcher serves compiled frontend files and runs the geospatial worker without Vite or backend file watching.

## Observe real images

Choose Aletsch, Langtang, or Columbia. The timeline contains actual August–September Sentinel-2 L2A captures from 2018–2025; availability varies by location. Each capture links to its original scene metadata. Source pixels are 10 metres, with lower-resolution overviews used when zoomed out. Images are reprojected in the backend, cached on disk, then rendered over fixed elevation. The dated capture includes a wider landscape buffer; the undated Esri basemap is context beyond capture coverage.

Compare captures starts with the oldest and newest acquisitions. Change lens reveals the newer image inside a draggable circle over the older image at the same camera; Swipe and Blink change provide other inspection methods. Explore uses 20–160 m image overviews; Inspect detail requests finer tiles for the visible map from the original 10 m source. Native glacier crops are prepared only on demand, reused locally, and composited over the same capture’s broader preview. Native tile rendering is limited to two concurrent tasks. The full satellite scene is never downloaded. This is spatial level of detail, not fabricated motion or extra measurement precision.

Comparison commits both images together after their tiles load and render. Draped raster layers are rebuilt to invalidate stale terrain textures. Cancelled timeline requests cannot replace the chosen frame. Playback waits for a loaded capture, and loading messages identify the previously displayed date. Scene cloud cover does not establish that the glacier itself is cloud-free. Seasonal snow, shadows, illumination, and processing differences must be considered before interpreting retreat.

## Process a NISAR file

1. Open **Data & sources** and find a matching GOFF product in the ASF catalog.
2. Download the `.h5` science file through [ASF Vertex](https://search.asf.alaska.edu/) using your NASA Earthdata account. Keep credentials outside the application and chat.
3. Import the file in **Process a radar observation**, choosing the product's frequency, polarization, offset layer, and correlation threshold.
4. The backend validates the mission/product, acquisition interval, projected coordinate grid, metre units, variance units, nodata, source masks, and spatial intersection. Processing is queued separately from the UI, and status survives backend restarts.
5. Completed products provide a five-band GeoTIFF, bounded GeoJSON samples, and source provenance with SHA-256. Show the optional radar-component layer and click a sample to inspect signed rates and formal uncertainty.

GOFF offsets are already in metres. The processor divides along-track and slant-range offsets by the acquisition interval in days, and divides the square root of their variances by the same interval for formal 1σ uncertainty. These are **radar-coordinate components, not horizontal glacier speed**. The correlation threshold is an adjustable screening choice. Stable-ground bias correction and independent glacier validation remain necessary. See the [ASF GOFF guide](https://nisar-docs.asf.alaska.edu/goff/) and [official GOFF writer schema](https://github.com/isce-framework/isce3/blob/develop/python/packages/nisar/products/insar/GOFF_writer.py).

## API

| Route | Purpose |
| --- | --- |
| `/api/health` | API and configured processing capability |
| `/api/scenarios` | Geographic presets |
| `/api/imagery/:id` | Real dated captures and metadata |
| `/api/imagery/tiles/:id/:frame/{z}/{x}/{y}.png` | Cached genuine image tiles |
| `/api/imagery/cog/:id/:frame/TCI.tif` | Registered-scene HEAD or bounded byte-range reads |
| `/api/catalog/:id` | Actual ASF NISAR GOFF catalog records |
| `/api/science/:id` | Processor availability and persisted jobs |
| `POST /api/science/:id/import` | Stream an HDF5 file into the local processing queue |
| `/api/science/:id/products/:job/:file` | Completed GeoTIFF, GeoJSON, or provenance |

Synthetic `/api/layers` and `/api/export` routes have been removed. Remaining legacy generators are test fixtures only and are not connected to the application.

## Rendering and hosting

The local renderer reads registered public Sentinel COGs through a Node byte-range proxy that verifies complete chunks, limits parallel reads, and keeps a bounded memory cache. PNG tiles persist under `database/processed/imagery-tiles-v5`; prepared overview crops persist under `database/processed/optical-studies-v2`; SQLite protects/coalesces repeated API tile requests. No hosted demo raster service is used by default. Optional `SARSCAPE_RASTER_SERVICE` selects an operator-managed TiTiler-compatible fallback; `SARSCAPE_TILE_SERVER` selects a different local worker.

The build also produces a lightweight Worker package in `dist/`. Hosted imagery needs a deployed TiTiler-compatible service via `RASTER_SERVICE_URL`. Heavy HDF5 jobs must remain in a dedicated scientific backend. The Worker alone is not a complete hosted science deployment, and no deployment is claimed here.

## Quantized science preview

Every new GOFF job writes both the original five-band float32 `radar-components.tif` and a compressed five-band int16 `radar-preview.tif`. The preview averages accepted finite samples into blocks with a maximum dimension of 512 cells, then quantizes each band separately. GeoTIFF scales and offsets decode each value as `code * scale + offset`; -32768 is missing data. Provenance records aggregation, observed quantization error, and the rounding bound. Aggregation can hide local detail; mean formal sigma is not the uncertainty of an aggregated mean. Use the unchanged original GeoTIFF for scientific analysis. The map’s bounded sample points retain original values.

Interrupted or failed jobs can be retried from Data & sources using their stored HDF5 file. No second upload is needed.

## Completion status

Real optical rendering and the GOFF processing workflow are implemented and tested. **No authenticated production NISAR granule has yet been processed or independently validated.** Schema fixtures establish software behavior; they are not scientific observations. Isolated-browser checks cover real capture changes, comparison, lens dragging and keyboard controls, swipe, blink playback, and mobile layout. Native-detail network performance still requires production monitoring; first reads depend on upstream COG access. The final submission remains gated on that check and a working hosted scientific backend if online delivery is required. Track the remaining work in `TODO.md`.

Upcoming captures warm in the background after the current view loads. One low-priority tile request runs at a time, nearest years first, using the actual visible preview tile URLs. Navigation, capture changes, and hidden tabs cancel warming; data-saver and 2G connections skip it. PNG tiles persist on disk and in SQLite and are HTTP-cacheable. A first uncached view still depends on upstream processing. The dashed capture edge separates dated Sentinel-2 imagery from the undated Esri context; their resolutions and colors differ.

## High-resolution Aletsch imagery and globe

Aletsch now defaults to swisstopo SWISSIMAGE aerial mosaics, with Sentinel-2 available in Image source. Alps imagery is typically 25 cm at source. The 2018–2025 timeline selects official mosaic versions, not annual flights or exact acquisition dates; adjacent versions can repeat imagery and acquisition dates vary locally. Look closer requests a useful inspection scale; further zoom loads higher-resolution tiles on demand. Official JPEG tiles are proxied, validated, coalesced and persisted in SQLite for one day because swisstopo can revise a mosaic without changing its year.

The globe control switches MapLibre to globe projection with undated context imagery; Return to the glacier restores terrain exploration. Image adjustments provides highlights, contrast and color plus reset. These GPU display settings apply equally to both comparison maps, are included in provenance export, and never rewrite source pixels or scientific products.

Official sources: https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10 and https://docs.geo.admin.ch/visualize-data/xyz.html.
