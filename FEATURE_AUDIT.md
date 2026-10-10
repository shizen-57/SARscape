# Functional audit — October 10, 2026

Scope includes all glacier/radar controls plus the previously deferred wetland and forest features. This records software behavior and verification limits; it is not a scientific validation certificate.

| Feature or gap | Implemented behavior | Evidence |
| --- | --- | --- |
| Node 20 startup | SQLite fallback when the built-in module is absent | Persistence tests and live Node 20.19 API |
| Repeated imagery failures | Bounded downloads/ranges, image/body retries with backoff, signature renewal and coalescing | Real socket-reset/HTTP 500 tests, timeout/range tests and actual caching |
| Stale raster worker readiness | Recheck health after startup; restart lost owned workers and share concurrent startup | Worker exit/startup/recovery tests and live automatic startup |
| Undated default | Nine-year actual Sentinel-2 sequence at every registered location; reference remains optional | Verified manifests and live API |
| Playback stalls | Prepare visible captures before play with progress/cancel; persist bytes/crops | Cache/cancellation tests and real preparation |
| Abrupt or stale transitions | Crossfade loaded frames, rebuild draped layers, wait for render, restore prior capture on cancel | Timeline race/comparison/fade tests |
| Heavy map retention | Keep one previous source, bound byte caches and mount only visible maps | Source audit; browser/GPU profiling pending |
| Radar animation jumps | Elapsed-time animation frames, hidden-tab pause and endpoint clamp | Animation-time tests |
| Partial saved views | Restore IDs, camera, source, comparisons, adjustments, layers and analyses | Migration/validation/restoration-data tests |
| Supplied GOFF/QA | Three-layer study, original cells, uncertainties, diagnostics, pair playback and report pages | Authentic HDF5/report identity and source-cell/artifact checks |
| Presentation centerpiece | Real annual glacier image comparison and cached replay; separate 12-day radar mode, 80-second guide, real-cell inspection, screening, evidence and PNG/JSON exports | 65 tests, source-image fingerprints, real renderer comparisons, ready-state React checks and live local assets |
| Unsupported upload choices | Inspect first; expose only intersecting supported channels | Queued inspection/processing workflow tests |
| Interrupted/additional jobs | Retry stored inputs; preserve products for additional channels | Restart/retry/input-reuse tests |
| GCOV processing | Power/dB, channel/mask/receive-only rules, metadata, exports and map candidates | Six Python schema/index/comparison checks and service fixtures |
| GCOV temporal comparison | Compatible channel/normalization/geometry, ordered dates and aligned paired-cell dB change | Grid/value/rejection fixtures; authentic GCOV input pending |
| Wetlands absent | Nine annual NDWI observations, coverage/distributions, candidate area, changes and exports | Nine real crops and pixel/statistic checks |
| Forest absent | Nine annual NDVI observations with the same workflow | Nine real crops and pixel/statistic checks |
| Radiometry inconsistency | Original XML scale/offset, common grid and SCL screening | 18 metadata checks, 90 band headers and aligned raster checks |
| Map/source/layer controls | Five locations/search, sources, adjustments, terrain/boundary/context, globe/return and details | Source/API audit and TypeScript build; latest visual interaction pending |
| Obsolete synthetic frontend hook | Removed unused hook targeting an intentionally absent endpoint | No shipping synthetic layer/export routes |

## Actual data checks

Both environmental studies have nine prepared index rasters and nine change rasters. Every raster's valid-cell count and mean match its JSON. All years share the exact study CRS, affine grid and shape. Change masks equal the intersection of valid baseline/current cells; finite changes equal current minus baseline within float32 tolerance.

Sundarbans uses a 1,476 × 2,091 grid in EPSG:32645; Rondônia uses 1,328 × 1,316 in EPSG:32720. Original-resolution products, radiometry and mask provenance persist under `database/processed/environment-v1`. Prepared previews were inspected locally. These are measured water/vegetation signals, not confirmed thematic classes.

The supplied GOFF study uses the authentic user file and matching QA report. The importer supports its known 1.5.0 mask convention and preserves raw signed offsets. Outputs have not been bias-corrected, limited to independently mapped ice, or validated as horizontal velocity.

The presentation bundle comprises 15 local artifacts, totaling 12.9 MiB. Its georeferenced context is a fixed September 27, 2026 Sentinel-2 image with a checked checksum. Real source-cell counts and medians were compared to the study summary for all three layers. Acquisition, geographic, radar-midpoint and confidence frames were rendered using the actual frontend drawing functions. The selected Layer-3 cell at cutoff 0.30 is R40/C26, near the joint accepted medians; its original HDF5 components and uncertainties were verified directly. Display scales stay consistent across correlation cutoffs.

All 45 registered annual RGB study crops were downloaded and opened as valid georeferenced three-band rasters with nonempty source pixels. The cache command also completed 72 central Swiss aerial tiles. Live API checks returned index/change overlay PNGs, GeoTIFF downloads and the supplied study/QA artifacts; checked study downloads matched local artifact hashes.

After the reported Vite connection resets, all nine Aletsch captures were requested through Vite at the four tile coordinates from the log. All 36 images returned HTTP 200; repeating preparation reused all 36 memory entries without new downloads. A further uncached tile started the stopped raster worker and returned a valid PNG. The original backend exit reason remains unknown without its terminal output.

## Checks and limits

The automated suite passes 65 Node tests, including invoked Python checks. TypeScript, the Vite frontend and the production Worker package build pass. Temporary GCOV fixtures remain outside public observations and products. Native CPU canvas checks cover the annual and radar renderers; these are not browser/GPU frame-rate measurements.

No connected browser is available. Latest desktop/mobile layout, direct pointer/keyboard operation, import UI and measured frame rate remain unverified. Source/cache checks support implementation but do not replace GPU/browser validation.

These workflows run locally. Earthdata-authenticated GCOV downloads, independent scientific interpretation and a deployed persistent processing service remain external requirements.


## Visible-change presentation and control organization

- Simulation opens with real 2018/2026 Aletsch lower-tongue images side by side; nine registered captures preload for smooth 28-second annual playback. Focus presets, synchronized inspection zoom, a reference selector, swipe comparison, exact-year seeking, speed, PNG export and scene-fingerprint evidence are connected.
- Radar mode opens at zero in component space with fixed pale endpoint anchors, an accumulating selected-cell arrow, signed values, formal uncertainties and the existing 80-second narrative. Annual images and the 12-day radar pair have distinct modes and clocks.
- Explore uses one bottom timeline; a supplied radar overlay replaces the annual clock. Map layers owns analysis display settings; Data & analysis owns source details, exports, detailed study, ingestion, environmental inspection and progress. Sheet openings dismiss other tool panels and pause replay. Top-map duplicates and independent floating control cards are removed.
- Verification: 65 automated tests; TypeScript and production build; authentic annual PNG/native-input hashes; all annual assets through the local API; ready-state React markup; unchanged reference pixels and changed current-image pixels from the actual renderer. Native CPU timing is not a browser FPS claim. Connected browser layout and pointer testing were unavailable; live rehearsal remains advisable.
