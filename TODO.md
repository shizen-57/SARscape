# SARscape status

## Implemented local features

- [x] Node 20-compatible SQLite and automatic project-Python renderer startup.
- [x] Separate frontend, backend and database; production build/start.
- [x] Actual annual Sentinel-2 sequences for all five locations, 2018–2026.
- [x] Aletsch's 2018–2025 aerial mosaic versions and optional undated reference.
- [x] Seeking/playback, persistent viewport preparation, crossfades, blink, synchronized lens/swipe.
- [x] Bounded downloads, retries, complete ranges, renewable access, native/overview crops and disk/browser caches.
- [x] Start Explore playback after two captures; prioritize visible tiles, cancel abandoned downloads and reuse cached overview context.
- [x] Recover unexpected backend exits automatically and drain tile requests on development source reloads.
- [x] Search, map tools, details, sources, adjustments, provenance and complete saved views.
- [x] Supplied GOFF study: three layers, source cells, uncertainty, masks, measured-pair interpolation and 22 report pages.
- [x] Presentation centerpiece: four chapters, cached 80-second guide, component-space playback, real-cell inspection, confidence controls, fullscreen, source QA and figure/evidence exports.
- [x] Inspect actual HDF5 channels before selecting settings; durable processing, retry and upload reuse.
- [x] GOFF rate/sigma products, original float32 exports and quantified int16 previews.
- [x] GCOV power/dB processing, masks, receive-only exclusions, candidate screening and map samples.
- [x] Matching GCOV capture comparisons with aligned paired-pixel dB changes and exports.
- [x] Sundarbans annual NDWI and Rondônia annual NDVI: distributions, coverage, thresholds, change overlays and exports.
- [x] Prepare all 18 actual environmental products; verify exported pixels/statistics.
- [x] Automated API/cache/timeline/playback/saved-view/science checks and TypeScript/Vite build.
- [x] Add explainable scientific surface summaries: matched-cell speed differences, mapped inventory area differences, signed elevation-change rates, full periods, coverage and uncertainty limitations. Verified offline; runtime acceptance remains pending.
- [x] Link selected map locations to persistent paired measurements, reported errors, transparent gaps, and inventory outlines; offline regression tests pass. Runtime acceptance still needs a dedicated interaction review.
- [x] Add a presenter-led Demo tour that stages imagery, change comparison, glacier measurements, NISAR workflows, display tools and source limits; add a matching recording guide (tour only, no video capture).

- [x] Separate frontend, backend, and database.
- [x] Reuse MapLibre terrain and established UI/geospatial modules.
- [x] Show genuine dated Sentinel-2 captures, comparison, playback, source details, saved views, and provenance.
- [x] Remove synthetic motion endpoints from the application.
- [x] Repair local COG delivery, verify complete byte ranges, deduplicate tile work, and persist cached images.
- [x] Prepare each study capture once and use resolution-matched COG overviews to speed distant map views.
- [x] Discover actual ASF NISAR GOFF granules.
- [x] Implement GOFF file import, durable job status, coordinate/unit/pair validation, quality screening, component-rate products, uncertainty, and map inspection.
- [x] Test timeline race conditions, cache behavior, API validation, GOFF schema/masks/uncertainty, and production build.
- [x] Import and process the user-supplied Aletsch production GOFF granule for September 23–October 5, 2026 through the production API code and queue; verify all four products and ten source-to-output checks. Recorded 1,112 accepted study-area cells at correlation 0.3.
- [x] Verify both real GOFF pairs (September 11–23 and September 23–October 5, 2026) above dated GCOV in the browser's 3D map. Low correlation and large component rates still need spatial outlier review. Study-area cells are not a glacier-only selection.
- [x] Add an approximate glacier-motion preview: SGI2016 outline mask, stable-ground offset removal, plausibility and normalized-median filtering, 400 m smoothing, stable-rock noise floor, radarGrid geometry conversion gated on a flow-direction test, heatmap, particles, interpolated-frame labels, and a quality panel. Both current Aletsch pairs resolve to “components only, quality Low”.
- [x] Add the Ask SARscape chat assistant (any OpenAI-compatible provider, data tools, allowlisted map actions). Still to try with a real provider key.
- [x] Radar change view: GCOV change on 24 Aletsch dates, storm findings with four checks, difference maps, charts, weather, through-the-clouds comparison, radar terrain colour and a Demo tour chapter. Remaining: independent validation of the storm response, and Columbia motion.
- [ ] Find a higher-coherence Aletsch GOFF pair (or winter pair) whose glacier signal clears 2× the stable-rock floor, and confirm the ISCE3 offset sign convention against a known displacement.
- [ ] Mask layover/shadow and known slope instabilities (for example Moosfluh) from the stable-ground reference.
- [ ] Independently validate radar components, quality screening, uncertainty, and stable-ground bias correction (GNSS stakes, ITS_LIVE or another velocity product).
- [x] Verify actual dated-image changes, draggable/keyboard change lens, first/latest comparison, blink playback, swipe, and mobile layout in an isolated browser.
- [x] Add explicit Explore previews and original-source detail requested on demand.
- [x] Restart the final native-crop cache revision; frontend, backend, and imagery worker reported ready in the sandbox.
- [x] Recheck final remote imagery, source-detail mode, lens, swipe, blink, and mobile layout with the isolated browser; detail loaded in about 6.3 seconds in the final run without failed image tiles.
- [x] Implement 16-bit NISAR display previews with a maximum 512-cell dimension, recorded scale/offset and observed rounding error, missing-data preservation, and unchanged original science products.
- [x] Add retry processing for interrupted/failed jobs using their existing uploaded file.
- [ ] Validate preview aggregation and precision against an actual glacier GOFF granule and a task-specific scientific error budget.
- [x] Complete independent visual finish review; disposition ship for the existing desktop/mobile interface, with no material fixes. This does not certify scientific validation.
- [x] Record the final design system in DESIGN.md and .impeccable/design.json after the scoped independent review.
- [ ] Deploy and verify a dedicated raster/science backend if online delivery is required.

Wetlands and forest change are included following the user's latest scope expansion. Panels display measured signals and interpretation limits.

## Remaining validation and external dependencies

- [ ] Exercise the latest desktop/mobile interface, keyboard/pointer controls, cache cancellation, saved views, radar imports and overlays. No browser surface is available; prior visual checks predate these changes.
- [ ] Measure playback frame rate/texture uploads on the user's GPU/browser. Caching and continuous animation are implemented; measured smoothness is unverified.
- [ ] Independently identify glacier outlines/stable ground, assess bias/outliers and validate the supplied GOFF motion interpretation.
- [ ] Evaluate aggregated/quantized radar previews against a scientific error budget; original products remain available.
- [ ] Import authentic matching GCOV captures and validate signals. Current GCOV checks use isolated fixtures.
- [ ] Establish tidal stage/inundation evidence before describing Sundarbans candidates as flooding.
- [ ] Establish land-cover/field evidence before describing Rondônia changes as forest loss or biomass.
- [ ] Acquire finer dated aerial imagery for Nepal/Alaska if required; Sentinel-2 provides 10 m pixels.
- [ ] Deploy and exercise a persistent raster/science backend if online delivery is required.

See [FEATURE_AUDIT.md](FEATURE_AUDIT.md) for changes and verification evidence.


- [x] Make glacier change visible immediately with real 2018/2026 endpoint comparison and a cached annual image replay.
- [x] Separate annual optical appearance from 12-day NISAR component replay; one active clock and one canonical home for each setting.
- [x] Consolidate source/details/export actions and remove duplicate floating presentation/analysis controls.
- [ ] Rehearse both presentation modes on the actual browser/projector; connected UI verification was unavailable in the coding session.
