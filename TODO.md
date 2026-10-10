# SARscape status

## Implemented local features

- [x] Node 20-compatible SQLite and automatic project-Python renderer startup.
- [x] Separate frontend, backend and database; production build/start.
- [x] Actual annual Sentinel-2 sequences for all five locations, 2018–2026.
- [x] Aletsch's 2018–2025 aerial mosaic versions and optional undated reference.
- [x] Seeking/playback, persistent viewport preparation, crossfades, blink, synchronized lens/swipe.
- [x] Bounded downloads, retries, complete ranges, renewable access, native/overview crops and disk/browser caches.
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
