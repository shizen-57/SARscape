# SARscape

A local 3D Earth-observation workspace for **Dancing with the SARs**. Explore glaciers, Sundarbans wetlands and a Rondônia forest landscape with genuine annual imagery, measured optical indices, and NISAR radar processing. Elevation remains fixed; the application does not invent missing acquisitions or predict future landscape change.

## Continuous scientific glacier surfaces

Aletsch now opens with measured, continuous velocity rasters on 3D terrain. Velocity playback, speed differences, published historical boundaries and elevation-change rates have separate scientific dates and sources. Prepare the small regional products with `npm run data:surfaces`. [Scientific interpretation, sources and implementation](docs/GLACIER_SURFACES.md) explain the supported variables and current limits. Terrain height stays fixed until valid absolute DEM epochs are connected; historical ITS_LIVE velocities are distinguished from the existing 2026 NISAR observations.

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
| `/api/science/:id/products/:job/:file` | Radar exports, including `motion-preview.json` |
| `/api/science/study/supplied/:file` | Supplied study and QA pages |

Local mutation endpoints validate origin. Files, bands, locations and tile coordinates are allowlisted. Satellite signatures stay only in backend memory and renew automatically; manifests and provenance retain unsigned URLs. Synthetic layer/export endpoints are absent; obsolete demo generators remain isolated test fixtures.

## Verification and hosting limits

See [FEATURE_AUDIT.md](FEATURE_AUDIT.md) and [TODO.md](TODO.md). Automated checks cover API failures, caches, cancellation, atomic frame commits, animation time, saved views, GOFF masks/units, GCOV inspection/comparison and aligned optical changes. Actual environmental rasters were checked against their statistics and paired differences; prepared previews were inspected locally.

This session has no connected browser surface. Latest desktop/mobile interaction and measured playback frame rate are unverified. Scientific interpretation needs independent evidence; software checks do not establish glacier velocity, flood extent or forest loss.

The build also creates a lightweight Worker package. Hosting requires a deployed raster service and a dedicated scientific backend with persistent storage; the Worker alone cannot perform HDF5 or environmental-band processing. Hosted routes report unavailable services instead of substituting data. No deployment is claimed.

## Quantized science preview

Every new GOFF job writes both the original five-band float32 `radar-components.tif` and a compressed five-band int16 `radar-preview.tif`. The preview averages accepted finite samples into blocks with a maximum dimension of 512 cells, then quantizes each band separately. GeoTIFF scales and offsets decode each value as `code * scale + offset`; -32768 is missing data. Provenance records aggregation, observed quantization error, and the rounding bound. Aggregation can hide local detail; mean formal sigma is not the uncertainty of an aggregated mean. Use the unchanged original GeoTIFF for scientific analysis. The map’s bounded sample points retain original values.

Interrupted or failed jobs can be retried from Data & sources using their stored HDF5 file. No second upload is needed.

## Completion status

Real optical rendering and the GOFF processing workflow are implemented and tested. **A user-supplied production NISAR GOFF granule has been processed locally for Aletsch, but its glacier-motion interpretation has not been independently validated.** The September 23–October 5, 2026 pair (frequency A, HH, layer1, correlation threshold 0.3) produced 1,112 accepted cells from a 13,272-cell study rectangle. Ten source-to-output checks passed, including rates, formal uncertainty, projection, masks, sample coordinates, preview precision, and SHA-256. The production API code was exercised in-process; both real GOFF pairs and dated GCOV overlays were displayed in the browser on October 10, 2026. Correlation is generally low, and large component rates require outlier review and stable-ground bias assessment. The raw products cover the study rectangle, including surrounding terrain; the approximate motion preview (below) is clipped to the SGI2016 glacier outline, references stable ground, and currently reports that flow direction is not resolved. Schema fixtures remain software checks rather than scientific observations. Isolated-browser checks cover earlier real optical capture changes, comparison, lens dragging and keyboard controls, swipe, blink playback, and mobile layout. Native-detail network performance still requires production monitoring; first reads depend on upstream COG access. The final submission remains gated on scientific validation and a working hosted scientific backend if online delivery is required. Track the remaining work in `TODO.md`.

Upcoming captures warm in the background after the current view loads. One low-priority tile request runs at a time, nearest years first, using the actual visible preview tile URLs. Navigation, capture changes, and hidden tabs cancel warming; data-saver and 2G connections skip it. PNG tiles persist on disk and in SQLite and are HTTP-cacheable. A first uncached view still depends on upstream processing. The dashed capture edge separates dated Sentinel-2 imagery from the undated Esri context; their resolutions and colors differ.

## High-resolution Aletsch imagery and globe

Aletsch opens on dated Sentinel-2 captures so optical playback begins with real acquisition changes. Choose SWISSIMAGE in Image source for high-resolution aerial context (typically 25 cm at source); its 2018–2025 labels are official mosaic versions, not annual flights or exact acquisition dates, and adjacent versions can repeat imagery. Look closer requests a useful inspection scale; further zoom loads higher-resolution tiles on demand. Official JPEG tiles are proxied, validated, coalesced and persisted in SQLite for one day because swisstopo can revise a mosaic without changing its year.

The globe control switches MapLibre to globe projection with undated context imagery; Return to the glacier restores terrain exploration. Image adjustments provides highlights, contrast and color plus reset. These GPU display settings apply equally to both comparison maps, are included in provenance export, and never rewrite source pixels or scientific products.

Official sources: https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10 and https://docs.geo.admin.ch/visualize-data/xyz.html.

### Sharp imagery policy

The visible map no longer exposes a reduced-resolution Explore mode or an Inspect-detail gate. Swiss aerial sources can request through zoom 20 at any camera position. Maps begin at an inspection scale; zoom-dependent tile selection still avoids downloading invisible pixels. Aletsch retains dated aerial mosaic versions. Langtang and Columbia now show World Imagery reference coverage, with variable unverified acquisition dates and resolution; their year playback and comparison are unavailable until dated high-resolution sources are connected. Sentinel-2 imagery remains accessible through the backend as archived data and is not a selectable low-resolution visual overlay.

## Small real NISAR data for Aletsch

Run `npm run data:aletsch` once, then start the project normally. The Aletsch study box is 7.915–8.11°E, 46.385–46.575°N: the whole SGI2016 Great Aletsch outline plus about 1.2 km of margin (it was 8.02–8.10°E, 46.39–46.51°N). Products cropped to the earlier box stay on disk but are no longer listed. The per-source transfer limit defaults to 256 MiB for the larger box. The last step of `npm run data:aletsch` (or `python backend/geo/gcov_shaded.py`) fetches the 2025 SWISSIMAGE tiles over the study box (about 140 tiles, 3 MB, zoom 14, cached in ignored `data/aerial/`), mosaics them onto the radar grid, and writes `gcov-shaded.png` per date: **aerial colours, with brightness changed by each date's HH versus the mean of all prepared dates** (7×7 box mean, 0.5 × the dB change, capped at ±6 dB, so ×0.5…×2). It is the default colour style. The colours belong to the 2025 photo, not the radar date; only the light and dark come from NISAR, and a brighter or darker patch is a radar change, not necessarily melt. Adding a date changes the mean, so rerun it. GCOV dates also get `gcov-color.png` (R HH, G HV, B HH−HV) and `gcov-natural.png`. The second is a natural-like palette from HH/HV radar classes after a 3×3 speckle filter: approximate classes, not photo colour. Both use one fixed stretch for every date, so playback colour changes come from the data. It prepares frequency-A HH GOFF pairs for September 11–23 and September 23–October 5, 2026, and HH/HV GCOV acquisitions on those three dates. An existing complete local science file is reused. Earthdata credentials are prompted for remote access; the password is hidden and neither credentials nor signed download URLs are saved.

The reader requests only HDF5 byte ranges needed for the study area. It requires HTTP 206 with a matching Content-Range, checks source identity and size, keeps a bounded memory cache, and refuses servers that respond with a whole file. Default limits are 128 MiB per source and 512 MiB per run. Source chunk layout determines actual transfer size. Completed subsets are checked by SHA-256 and reused on the next run.

SQLite `database/sarscape.sqlite` stores the source catalogue and processed-subset records in `nisar_sources` and `nisar_subsets`. Compact HDF5 arrays are saved under ignored `data/subsets/`; native measurement rasters, map PNGs, and provenance are under ignored `database/processed/`. Raster arrays are kept as files instead of database blobs. These are derived regional products; their checksums describe the subset, not the full official granule.

Use `npm run data:aletsch -- --refresh --catalog-only` to catalogue available Aletsch NISAR products from January 2026 through the time of the query. The official `asf_search` client follows CMR pagination without a result cap. This downloads metadata only. `npm run data:aletsch -- --refresh --all-dates` processes every matching Production/Provisional track-072 ascending frame-025 GOFF/GCOV date; run again if the transfer budget is reached to continue using completed caches. Other NISAR product types are catalogued and require their own reviewed processor before analysis.

On the map, open **Imagery → Radar appearance** to choose a real GCOV date. Its transparent PNG is draped over fixed terrain using a common HH gamma0 −25 to 0 dB scale. The native Float32 COG retains HH/HV gamma0 and the HV/HH power ratio expressed in dB. GOFF pairs appear in the existing radar observation controls and can be shown above that context.

GCOV change is radar-backscatter change; it does not establish displacement, melt, thickness, or volume. GOFF remains radar-coordinate displacement with formal uncertainty, not uniquely resolved 3D ice motion. Quality filters preserve missing data. A glacier outline, layover/shadow masking, stable-ground bias correction, and independent glacier validation are still needed for stronger physical interpretations. Missing receive-only attributes in official 1.5.0 writer outputs are recorded as undeclared; explicit receive-only channels are rejected.

The local demonstration was prepared from five products using 83,623,936 bytes (79.75 MiB) of science transfer; the existing September 23–October 5 GOFF file was reused. Compact HDF5 subsets occupy 20.78 MiB, with additional space for processed rasters. The October 10 catalogue refresh returned 215 records across GCOV, GOFF, GSLC, GUNW, RIFG, ROFF, RRSD, RSLC, RUNW, and SME2. These counts describe that query and will change as products become available.

## Ask SARscape (AI assistant)

The **Ask SARscape** button in the tool rail opens a chat popup. It works with any OpenAI-compatible provider that supports tool calling (OpenAI, Groq, OpenRouter, DeepSeek, Together, Gemini's compatible endpoint, Ollama). Copy `.env.example` to `.env`, set `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL`, and restart. The key stays in the backend (`backend/src/assistant.mjs`); the browser never sees it. Without a key the panel shows setup instructions.

- **Facts come from tools**, not model memory: `get_radar_inventory` (GCOV dates, GOFF pairs, status, quality grade) and `get_motion_details` (quality, filter counts, stable-ground offset, viewing geometry, outline source and limits). The system prompt repeats the project's science rules: radar colours are not photo colours, the motion preview is an unvalidated estimate, and only the two GOFF acquisition dates are observations.
- **Map control** goes through one allowlisted tool, `control_map` (play/pause radar, set radar date, colour style, source tab, open a motion pair, overview, reset view). The server validates each action and value, and the app applies them with its normal controls.
- Limits: 12 recent messages, 2,000 characters each, 30 questions per minute, up to 5 tool rounds, replies are not streamed. Conversation history lives in the browser tab only.

## Approximate glacier-motion preview

Selecting a NISAR GOFF pair now opens a visual preview over the 3D terrain. It has a soft heatmap, animated particles with their pair-long tracks, and a quality panel. It is an **approximate preview, not validated glacier velocity and not tracked ice**. The raw sample layer, its popup with formal 1σ uncertainty, and every download are unchanged; turn on **Raw samples** to inspect them.

**What GOFF measures.** Along-track and slant-range pixel offsets between two acquisitions, in metres, with variances and a correlation-surface peak. ASF notes that the offsets are distributed without outlier removal or low-pass filtering ([ASF GOFF guide](https://nisar-docs.asf.alaska.edu/goff/)). The processor divides offsets by the pair duration to get m/day.

**What the preview estimates** (`backend/geo/goff_motion.py`, written as `motion-preview.json` next to each product):

1. **Glacier mask.** Cells whose centres lie inside the Great Aletsch outline shrunk by half a cell (40 m), so mixed rock/ice margins are excluded. Stable ground means cells more than two cells (160 m) outside the outline.
2. **Source screening.** The existing GOFF mask, finite values, and correlation ≥ 0.3.
3. **Stable-ground reference.** The common offset of stable rock (2-D histogram peak refined by iterative medians) is subtracted from both components.
4. **Plausibility gate.** Cells beyond ±1.5 m/day per component are rejected. Published Great Aletsch surface speeds peak near 200 m/a (≈ 0.55 m/day), so this is a deliberately generous bound, not a validated cutoff.
5. **Spatial consistency.** Normalized median test over a 5×5 neighbourhood (threshold 2, ε = 0.1 m/day, at least 4 neighbours; Westerweel & Scarano 2005).
6. **Display smoothing.** 5×5-cell (400 m) median of surviving cells, shown where at least 6 cells support it. Cells without their own measurement are flagged “estimated from neighbouring cells”.
7. **Confidence** (opacity and size): the share of the 5×5 window that passed every filter, multiplied by the correlation, scaled from 0.3 (0) to 0.6 (1).
8. **Noise floor and decision.** The same filters and smoothing are applied to stable rock, which should not move. A horizontal surface-flow direction is shown only when the file contains its own viewing geometry, **and** the glacier median reaches 2× the stable-rock floor, **and** at least 20% of the outline has an estimate. Otherwise the view shows the measured radar components, relative to stable ground, and says that flow direction is not resolved.

**Geometry conversion (used only when resolved).** GOFF granules contain `/science/LSAR/GOFF/metadata/radarGrid` cubes: `alongTrackUnitVectorX/Y` (horizontal along-track direction) and `losUnitVectorX/Y` (target→sensor, ENU) on 500 m nodes and 20 heights. With zero vertical motion assumed, `along = a·d` and `slant = −l·d`, which solves for east/north motion. Assumptions, all shown in the interface:

- Flow is horizontal, so steep or thinning ice biases the estimate.
- Positive along-track means motion in the flight direction, and positive slant-range means moving away from the radar. This is the ISCE3 secondary-minus-reference convention, which [JPL D-105010](https://nisar.asf.earthdatacloud.nasa.gov/NISAR-SAMPLE-DATA/DOCS/NISAR_D-105010_L2_GOFF_Product_Spec_R3.4_231109_clean_w-sigs.pdf) does not state explicitly.
- Cubes are sampled at the nearest node and the 2,500 m height. Unit vectors change by less than 0.001 between 1,500 and 3,500 m here.
- UTM grid convergence (< 1°) is ignored.

For track 072 ascending (left-looking), the heading is 340.4° and incidence is about 36.5°. Without resolved flow, particles move along the satellite-track axis or the ground-projected line-of-sight axis, by the signed measured component. That is labelled as a component, not a flow direction. Particle travel is exaggerated (×50 for the current pair); the factor is shown in the panel.

**Playback.** Only the two acquisitions are observations. The replay labels the start and end frames “NISAR acquisition · reference/secondary” and every frame between “Interpolated · not observed”, assuming a steady rate. There are no daily measurements.

**Aletsch results for the earlier 8.02–8.10°E box (verdict: components only, quality Low; rerun `npm run data:aletsch` for the expanded box).**

| Pair | Layer | Geometry | Glacier cells: in outline → source → plausible → consistent → shown | Stable-ground offset (along, slant m/day) | Glacier ÷ stable-rock floor |
| --- | --- | --- | --- | --- | --- |
| Sep 23 → Oct 5, 2026 | layer3 (128 px window) | Yes | 3,235 → 526 → 335 → 284 → 483 (15%) | −12.82, +2.15 | 0.9× (horizontal) |
| Sep 11 → Sep 23, 2026 | layer1 (subset only) | No | 3,235 → 157 → 7 → 1 → 3 (<1%) | +12.69, −2.17 | 1.3× (along-track) |

- **Search-limit outliers.** Before the stable-ground correction, accepted along-track rates fill the whole ±64-pixel search window (≈ ±286 m, about ±24 m/day over 12 days). That is typical of false correlation peaks.
- **Acquisition-specific offset.** The two pairs share the September 23 acquisition and have equal and opposite stable-ground offsets. That points to a ≈150 m along-track misregistration of that acquisition, not ice motion.
- **Below the noise floor.** After every filter, glacier values on the September 23–October 5 pair match the apparent motion of stable rock (median 0.35 vs 0.38 m/day). The data therefore do not resolve flow direction, even though the geometry would support the conversion.
- **Layer choice.** layer3 had the most stable-ground support (750 of 1,096 screened stable cells near the common offset, against 131 of 760 for layer1 and 418 of 737 for layer2) and the lowest stable-rock scatter. `npm run data:aletsch` processes layer3 whenever the source contains it; new regional subsets now keep all three layers and the geometry cubes.

**Glacier outline.** `database/outlines/aletsch-sgi2016.geojson` is the Grosser Aletschgletscher polygon (SGI ID B36-26, 78.49 km², 2017 aerial imagery). It comes from the [Swiss Glacier Inventory 2016](https://doi.glamos.ch/data/inventory/inventory_sgi2016_r2020.html) (GLAMOS, **CC BY 4.0**), simplified by 5 m. Cite as Linsbauer, A., Huss, M., Hodel, E., Bauder, A., Fischer, M., Weidmann, Y., Bärtschi, H. & Schmassmann, E. (2021), *The new Swiss Glacier Inventory SGI2016: From a topographical to a glaciological dataset*, Frontiers in Earth Science 9, 704189, doi:10.3389/feart.2021.704189. Regenerate it with `python backend/geo/aletsch_outline.py` from `data/sgi2016/inventory_sgi2016_r2020.zip` (SHA-256 recorded in the file). The 2017 outline overstates the 2026 ice extent near the retreating terminus and thinning margins.

**Remaining limitations.**

- Only one pair has viewing geometry, and its correlation is weak (median 0.36 on accepted glacier cells).
- The stable-ground offset assumes most rock in the 6 × 13 km box is still. Slope instabilities near the tongue (for example Moosfluh) are not masked.
- There is no layover/shadow mask.
- The sign convention is assumed, not confirmed by the specification.
- Nothing has been compared with independent velocity data such as GNSS stakes or ITS_LIVE.

Primary references: [Earthaccess range session](https://github.com/nsidc/earthaccess/blob/main/earthaccess/api.py), [ASF GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/), [GCOV 1.5.0 writer](https://github.com/isce-framework/isce3/blob/fbc49b0cba725766b02c8cf499dd017925e7da44/python/packages/nisar/products/writers/GcovWriter.py), and [official ASF paged search](https://github.com/asfadmin/Discovery-asf_search/blob/master/asf_search/search/search_generator.py).
