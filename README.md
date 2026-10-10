# SARscape

A 3D glacier observation workspace for **Dancing with the SARs**. Explore full-detail aerial mosaics and reference imagery, compare dated mosaic versions with a synchronized camera, and process NISAR GOFF science files through a separate backend. The application does not ship synthetic glacier measurements.

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

Compare captures starts with the oldest and newest available Swiss aerial mosaic versions. Change lens, Swipe and Blink support comparison at a synchronized camera. Full-detail tile selection is automatic; there is no reduced-resolution quality mode. Undated reference imagery on other glaciers has no yearly playback. The backend retains Sentinel-2 crops as archived optical data, rather than the visible low-resolution overlay.

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

Real optical rendering and the GOFF processing workflow are implemented and tested. **A user-supplied production NISAR GOFF granule has been processed locally for Aletsch, but its glacier-motion interpretation has not been independently validated.** The September 23–October 5, 2026 pair (frequency A, HH, layer1, correlation threshold 0.3) produced 1,112 accepted cells from a 13,272-cell study rectangle. Ten source-to-output checks passed, including rates, formal uncertainty, projection, masks, sample coordinates, preview precision, and SHA-256. The production API code was exercised in-process; both real GOFF pairs and dated GCOV overlays were displayed in the browser on October 10, 2026. Correlation is generally low, and large component rates require outlier review and stable-ground bias assessment. The study rectangle includes surrounding terrain and is not a glacier outline. Schema fixtures remain software checks rather than scientific observations. Isolated-browser checks cover earlier real optical capture changes, comparison, lens dragging and keyboard controls, swipe, blink playback, and mobile layout. Native-detail network performance still requires production monitoring; first reads depend on upstream COG access. The final submission remains gated on scientific validation and a working hosted scientific backend if online delivery is required. Track the remaining work in `TODO.md`.

Upcoming captures warm in the background after the current view loads. One low-priority tile request runs at a time, nearest years first, using the actual visible preview tile URLs. Navigation, capture changes, and hidden tabs cancel warming; data-saver and 2G connections skip it. PNG tiles persist on disk and in SQLite and are HTTP-cacheable. A first uncached view still depends on upstream processing. The dashed capture edge separates dated Sentinel-2 imagery from the undated Esri context; their resolutions and colors differ.

## High-resolution Aletsch imagery and globe

Aletsch defaults to swisstopo SWISSIMAGE aerial mosaics, with an undated reference alternative in Image source. Alps imagery is typically 25 cm at source. The 2018–2025 timeline selects official mosaic versions, not annual flights or exact acquisition dates; adjacent versions can repeat imagery and acquisition dates vary locally. Look closer requests a useful inspection scale; further zoom loads higher-resolution tiles on demand. Official JPEG tiles are proxied, validated, coalesced and persisted in SQLite for one day because swisstopo can revise a mosaic without changing its year.

The globe control switches MapLibre to globe projection with undated context imagery; Return to the glacier restores terrain exploration. Image adjustments provides highlights, contrast and color plus reset. These GPU display settings apply equally to both comparison maps, are included in provenance export, and never rewrite source pixels or scientific products.

Official sources: https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10 and https://docs.geo.admin.ch/visualize-data/xyz.html.

### Sharp imagery policy

The visible map no longer exposes a reduced-resolution Explore mode or an Inspect-detail gate. Swiss aerial sources can request through zoom 20 at any camera position. Maps begin at an inspection scale; zoom-dependent tile selection still avoids downloading invisible pixels. Aletsch retains dated aerial mosaic versions. Langtang and Columbia now show World Imagery reference coverage, with variable unverified acquisition dates and resolution; their year playback and comparison are unavailable until dated high-resolution sources are connected. Sentinel-2 imagery remains accessible through the backend as archived data and is not a selectable low-resolution visual overlay.

## Small real NISAR data for Aletsch

Run `npm run data:aletsch` once, then start the project normally. It prepares frequency-A HH GOFF pairs for September 11–23 and September 23–October 5, 2026, and HH/HV GCOV acquisitions on those three dates. An existing complete local science file is reused. Earthdata credentials are prompted for remote access; the password is hidden and neither credentials nor signed download URLs are saved.

The reader requests only HDF5 byte ranges needed for the study area. It requires HTTP 206 with a matching Content-Range, checks source identity and size, keeps a bounded memory cache, and refuses servers that respond with a whole file. Default limits are 128 MiB per source and 512 MiB per run. Source chunk layout determines actual transfer size. Completed subsets are checked by SHA-256 and reused on the next run.

SQLite `database/sarscape.sqlite` stores the source catalogue and processed-subset records in `nisar_sources` and `nisar_subsets`. Compact HDF5 arrays are saved under ignored `data/subsets/`; native measurement rasters, map PNGs, and provenance are under ignored `database/processed/`. Raster arrays are kept as files instead of database blobs. These are derived regional products; their checksums describe the subset, not the full official granule.

Use `npm run data:aletsch -- --refresh --catalog-only` to catalogue available Aletsch NISAR products from January 2026 through the time of the query. The official `asf_search` client follows CMR pagination without a result cap. This downloads metadata only. `npm run data:aletsch -- --refresh --all-dates` processes every matching Production/Provisional track-072 ascending frame-025 GOFF/GCOV date; run again if the transfer budget is reached to continue using completed caches. Other NISAR product types are catalogued and require their own reviewed processor before analysis.

On the map, open **Imagery → Radar appearance** to choose a real GCOV date. Its transparent PNG is draped over fixed terrain using a common HH gamma0 −25 to 0 dB scale. The native Float32 COG retains HH/HV gamma0 and the HV/HH power ratio expressed in dB. GOFF pairs appear in the existing radar observation controls and can be shown above that context.

GCOV change is radar-backscatter change; it does not establish displacement, melt, thickness, or volume. GOFF remains radar-coordinate displacement with formal uncertainty, not uniquely resolved 3D ice motion. Quality filters preserve missing data. A glacier outline, layover/shadow masking, stable-ground bias correction, and independent glacier validation are still needed for stronger physical interpretations. Missing receive-only attributes in official 1.5.0 writer outputs are recorded as undeclared; explicit receive-only channels are rejected.

The local demonstration was prepared from five products using 83,623,936 bytes (79.75 MiB) of science transfer; the existing September 23–October 5 GOFF file was reused. Compact HDF5 subsets occupy 20.78 MiB, with additional space for processed rasters. The October 10 catalogue refresh returned 215 records across GCOV, GOFF, GSLC, GUNW, RIFG, ROFF, RRSD, RSLC, RUNW, and SME2. These counts describe that query and will change as products become available.

Primary references: [Earthaccess range session](https://github.com/nsidc/earthaccess/blob/main/earthaccess/api.py), [ASF GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/), [GCOV 1.5.0 writer](https://github.com/isce-framework/isce3/blob/fbc49b0cba725766b02c8cf499dd017925e7da44/python/packages/nisar/products/writers/GcovWriter.py), and [official ASF paged search](https://github.com/asfadmin/Discovery-asf_search/blob/master/asf_search/search/search_generator.py).
