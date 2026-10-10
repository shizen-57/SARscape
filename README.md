# SARscape

A local 3D Earth-observation workspace for **Dancing with the SARs**. Explore glaciers, Sundarbans wetlands and a Rondônia forest landscape with genuine annual imagery, measured optical indices, and NISAR radar processing. Elevation remains fixed; the application does not invent missing acquisitions or predict future landscape change.

## Presentation centerpiece

Open **http://127.0.0.1:5173/#simulation** for two clearly separated modes. **Glacier changes** opens with a real 2018/2026 ice-front comparison, then smoothly replays nine cached, registered annual captures. **Radar displacement** shows the supplied Aletsch NISAR pair with growing signed offsets, an 80-second guided story, real-cell inspection, screening, source QA pages and evidence exports. Each mode has one timeline. Existing features remain available through **Explore**.

See [PRESENTATION_GUIDE.md](PRESENTATION_GUIDE.md) for the two-minute demo, source facts, judge questions and rehearsal notes. `npm run science:presentation` prepares both the registered annual images and fixed radar context after the supplied study and Aletsch imagery cache exist. Annual transitions blend observed images; radar replay interpolates one measured 12-day pair. Source evidence remains explicit in both modes.

## Run locally

Requires Node.js 20.19+ (24+ recommended) and Python 3.12+. Node versions without `node:sqlite` use `better-sqlite3` automatically.

```sh
npm install
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm run dev
```

On macOS/Linux use `backend/.venv/bin/python`. The backend prefers this project environment; `SARSCAPE_PYTHON` can select another interpreter. Verified dependencies are recorded in `backend/requirements.lock.txt`.

Open http://127.0.0.1:5173/#explore. The API listens on 8787 and automatically starts its owned raster worker on 8788 when needed. The development runner reloads backend/Python source and manifest edits, gracefully drains existing tile requests, and restarts the API after an unexpected exit. Stop an existing stack before launching another.

```sh
npm test
npm run build
npm start
```

The production launcher serves the built application at http://127.0.0.1:8787 without Vite. Frontend, backend, database and processing scripts remain separate.

## Annual observations and playback

All five registered locations default to nine actual Sentinel-2 L2A acquisitions, one per year from 2018 through 2026. Aletsch also offers official SWISSIMAGE aerial mosaic versions for 2018–2025 through **Imagery**. Swiss mosaic years are version labels: local flight dates vary, and adjacent versions can repeat imagery. **Reference imagery** remains an explicitly undated optional source.

The timeline supports scrubbing, playback, blink, a draggable and keyboard-accessible change lens, and synchronized swipe comparison. Comparison dates are committed only after both maps load and render. Playback prepares only the first two captures in the current viewport, with progress and cancellation, then caches later captures in the background. Blink prepares the oldest/latest pair. Each transition waits for the actual capture to load and render before fading. Moving the camera pauses playback. Reduced-motion preferences suppress fades; hidden tabs pause animation and background warming.

Image bytes persist in browser CacheStorage and a bounded memory cache. The backend retains prepared study crops, overview crops and PNG tiles on disk; SQLite coalesces repeated requests. Browser image downloads use six shared slots, with at most two background downloads; visible captures take priority over queued warming. Requests with no remaining consumers are cancelled, including queued work and retry backoff. Shared requests continue while another map still needs them. Connection resets, interrupted image bodies, HTTP 408/429 and server errors retry up to five attempts. Retries bypass the HTTP cache; only successful images enter the observation cache. The backend rechecks the raster worker and restarts its owned worker when it stops. Swiss aerial downloads also use six shared slots, retry transient failures, and cache validated JPEGs for one day. Satellite tiles are cacheable for 30 days. Keeping one previous map source bounds GPU retention while the byte caches retain the annual sequence.

Native 10 m study crops remain the source over the glacier. Surrounding dated context uses an existing local overview instead of downloading a missing finer overview during navigation. The renderer downloads an overview only when none is cached. For a 40-tile Aletsch viewport, startup now prepares 80 tiles instead of 360. A local API check took 4.4 seconds for first-pass startup, 21.4 seconds to warm all nine captures, and 20 ms to repeat startup from memory. All 360 requests succeeded; these are API measurements, not browser load-time measurements. The check also prepared those viewport tiles on disk.

To prepare every native study crop and central imagery tile ahead of exploration:

```sh
npm run imagery:cache
# Optionally cache one location:
npm run imagery:cache -- --location=columbia
```

This also caches 72 central Swiss aerial tiles when Aletsch is selected. Exact camera viewports are prepared in the browser when playback starts. A new camera view, terrain, basemap context, and uncached distant tiles can still require network access. Source imagery is 10 m for Sentinel-2 and typically 25 cm over the Alps for SWISSIMAGE; zoom does not manufacture finer source detail.

`npm run imagery:refresh` refreshes the glacier manifest. The additional environmental manifest separately preserves verified green, red, NIR and SCL band metadata, seasonal selections and product-XML radiometry.

## Water and vegetation change

Choose **Sundarbans wetlands** or **Rondônia forest**, then open **Water change** or **Vegetation change**. The local analysis panel provides all nine annual captures, distributions, mean/median indices, valid coverage, threshold candidate area, change from the first year, map overlays and original-resolution GeoTIFF/provenance downloads.

- NDWI = `(green - NIR) / (green + NIR)` for water signals.
- NDVI = `(NIR - red) / (NIR + red)` for vegetation signals.

Each capture uses its original product's scale and additive offset, including the offset change in newer processing baselines. All years share a 10 m projected grid. Screening accepts SCL classes 4/5/6 and excludes nodata, saturation, shadows, unclassified samples, clouds, cirrus and snow. The 20 m classification band is sampled using nearest neighbours. Changes include only cells valid in both dates.

The supplied local workspace has all 18 annual index and change products prepared under `database/processed/environment-v1`. In a fresh checkout, **Download & analyze all years** prepares them in the background and reuses completed crops after interruption. Threshold area is estimated from 0.02-wide histogram bins. NDWI does not establish flood extent, water depth or tidal stage; NDVI does not establish forest loss, biomass or a land-cover class. The panel records these interpretation limits.

## Supplied NISAR study

At Aletsch, open **NISAR study** or **Data & sources → Open detailed radar study**. The root GOFF HDF5 and matching 22-page QA report are preserved. Prepared artifacts expose all three frequency-A / HH layers, original signed offsets, pair-average rates, formal sigma, covariance, SNR, mask diagnostics, correlation screening, distributions, cell inspection, QA pages and downloads.

The measured interval is September 23–October 5, 2026: 12 days. Layers use 32/64/128-input-pixel correlation windows on an 80 m output grid. The study rectangle contains ice and surrounding terrain. At correlation >= 0.30, layers retain 1,112 / 1,144 / 1,816 of 13,272 grid cells. These raw offsets have not been corrected for stable-ground bias or independently validated as glacier velocity.

Continuous pair playback distributes signed endpoint offsets linearly across the measured interval. Intermediate states are visualization assumptions. Formal endpoint uncertainty is preserved; no intermediate uncertainty model, annual extrapolation, horizontal-velocity conversion or moving elevation is inferred.

```sh
npm run science:study
```

Regeneration expects exactly one matching root `NISAR_*.h5` / `*_QA_REPORT.pdf` pair and the project Python dependencies. Optional Poppler `pdftoppm` prepares report thumbnails. Hashes and matched granule identifiers are recorded under ignored `database/processed/supplied-nisar`. GOFF specification 1.5.0's encoded source mask is explicitly supported when its later `validDataMask` is absent; unknown missing-mask schemas are rejected.

GeoTIFFs use a fixed 0.30 cutoff. Cell JSON and point GeoJSON retain all source-eligible samples so interactive screening does not rewrite measurements. The QA report supplies diagnostics, not an independent velocity-validation certificate.

## Import and compare radar files

1. Open **Data & sources**. ASF searches GOFF for glacier presets and GCOV for wetland/forest presets.
2. Download a matching HDF5 through [ASF Vertex](https://search.asf.alaska.edu/) with an Earthdata account. Keep credentials outside SARscape.
3. Import the file. The backend inspects its actual channels and spatial coverage before presenting supported frequency, polarization and layer choices.
4. Process a channel. Durable jobs expose queued, processing, complete, failed and interrupted states; retry reuses the stored upload. Processing another channel preserves prior products.
5. Download original GeoTIFFs, bounded original-value sample GeoJSON and provenance. Show the analysis on the terrain map and click samples.

GOFF validates projected grids, metre/variance units, acquisition pairs, finite values and masks, then divides offsets and formal sigma by pair duration. Outputs are signed along-track and slant-range components in m/day, not horizontal speed. Separate int16 previews record scale, offset, block aggregation and observed quantization error; original float32 rasters are preserved.

GCOV accepts supported real diagonal covariance channels, preserves power and normalization metadata, applies valid-data/input-exception masks and receive-only exclusions, and computes `10 log10(power)` for positive power. Zero power remains valid linear power with missing dB. Optional low-return screening displays candidates without classifying them as water or forest loss.

Two completed GCOV captures can produce a signed newer-minus-older dB comparison. Channel, normalization, acquisition order and available track/look/orbit geometry must match. The older raster is aligned to the newer grid; only paired finite cells contribute. Original values, paired area and processing differences remain in exports. No authentic GCOV file is included: this path has been checked with isolated schema fixtures, while the supplied GOFF study uses the actual user file. See the [ASF GOFF guide](https://nisar-docs.asf.alaska.edu/goff/) and [GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/).

## Controls and saved views

Location search, source selection, adjustments/reset, terrain, study boundary, satellite/street context, zoom, north, reset, globe/return, capture details and provenance downloads are connected. Saved views preserve real capture IDs, camera, source, comparison mode/date/divider/lens, adjustments, map layers and analysis settings. Stored views are validated and older saves migrate. Saved radar overlays require their processed product to remain locally available.

## API

| Route | Purpose |
| --- | --- |
| `/api/health`, `/api/scenarios` | Health and registered locations |
| `/api/imagery/:id` | Actual captures and metadata |
| `/api/imagery/tiles/:id/:frame/{z}/{x}/{y}.png` | Cached satellite imagery |
| `/api/imagery/aerial/:year/{z}/{x}/{y}.jpeg` | Cached Swiss aerial tiles |
| `/api/imagery/cog/:id/:frame/:asset.tif` | Registered-scene byte ranges |
| `/api/catalog/:id` | ASF GOFF or GCOV metadata |
| `/api/analysis/:id` | Environmental status and annual statistics |
| `POST /api/analysis/:id/prepare` | Prepare/resume annual analysis |
| `/api/analysis/:id/:frame/:file` | Index/change GeoTIFF, PNG and JSON |
| `/api/analysis/tiles/:id/:frame/:mode/{z}/{x}/{y}.png` | Index/change overlays |
| `/api/science/:id` | Durable radar jobs |
| `POST /api/science/:id/import` | Stream and inspect HDF5 |
| `POST /api/science/:id/jobs/:job/process` | Process an inspected channel |
| `POST /api/science/:id/jobs/:job/retry` | Retry a job |
| `POST /api/science/:id/compare` | Compare completed GCOV captures |
| `/api/science/:id/products/:job/:file` | Radar exports |
| `/api/science/study/supplied/:file` | Supplied study and QA pages |

Local mutation endpoints validate origin. Files, bands, locations and tile coordinates are allowlisted. Satellite signatures stay only in backend memory and renew automatically; manifests and provenance retain unsigned URLs. Synthetic layer/export endpoints are absent; obsolete demo generators remain isolated test fixtures.

## Verification and hosting limits

See [FEATURE_AUDIT.md](FEATURE_AUDIT.md) and [TODO.md](TODO.md). Automated checks cover API failures, caches, cancellation, atomic frame commits, animation time, saved views, GOFF masks/units, GCOV inspection/comparison and aligned optical changes. Actual environmental rasters were checked against their statistics and paired differences; prepared previews were inspected locally.

This session has no connected browser surface. Latest desktop/mobile interaction and measured playback frame rate are unverified. Scientific interpretation needs independent evidence; software checks do not establish glacier velocity, flood extent or forest loss.

The build also creates a lightweight Worker package. Hosting requires a deployed raster service and a dedicated scientific backend with persistent storage; the Worker alone cannot perform HDF5 or environmental-band processing. Hosted routes report unavailable services instead of substituting data. No deployment is claimed.
