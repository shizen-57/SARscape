# SARscape implementation and validation

The current scope covers all existing glacier/radar features plus Sundarbans wetlands and Rondônia forest change. The local implementation is documented in [FEATURE_AUDIT.md](FEATURE_AUDIT.md); [README.md](README.md) explains operation and data provenance.

## Implemented

- MapLibre terrain/cameras, React/TypeScript, Radix controls, TanStack Query, Hono and SQLite reuse established modules.
- All five locations have actual annual Sentinel-2 observations for 2018–2026. Aletsch additionally offers eight official Swiss aerial mosaic versions.
- Viewport preparation, bounded browser/disk caches, native crops, signature renewal and retry protect playback from repeat remote reads.
- Timeline seeking, crossfade, synchronized lens/swipe, blink, controls, exports and complete saved views are connected.
- The authentic supplied GOFF granule and matching QA report drive a detailed three-layer Aletsch study with original cells, quality screening, uncertainty and measured-pair interpolation.
- Radar uploads are inspected before selecting intersecting supported channels. Durable jobs, retries, additional-channel processing and original-resolution downloads preserve inputs and prior products.
- GOFF produces signed radar-coordinate rates and sigma. GCOV preserves calibrated diagonal-channel power/dB and masks; matching GCOV pairs produce aligned signed dB changes.
- Seasonal NDWI/NDVI observations use verified product radiometry, common 10 m grids, classification screening and paired valid-pixel differences. All 18 environmental products are prepared and pixel-checked locally.

## Validation still required

1. Connect a browser and exercise the latest desktop/mobile controls, rapid seeking, cancellation, restoration, imports, overlays and downloads; measure frame rate on the user's GPU.
2. Identify independent glacier outlines and stable ground, correct/assess bias and validate physical interpretation of raw GOFF offsets.
3. Import authentic GCOV captures and validate their backscatter comparisons against independent thematic evidence.
4. Add tidal/inundation evidence for flooding interpretation and land-cover/field evidence for forest-loss or biomass interpretation.
5. If online delivery is required, deploy persistent raster/science services and exercise the deployed workflow. A lightweight Worker cannot replace Python/HDF5 processing.
6. Completed locally: the user supplied a matching production Aletsch GOFF file for September 23–October 5, 2026. The production import API code, queue, processor, and artifact APIs were exercised in-process using frequency A, HH, layer1, and correlation 0.3. Verify the saved job in the UI after starting or restarting the local backend.
7. Completed software checks against the actual file: specification 1.5.0 combined source mask without polarization validDataMask, dates, 80 m posting, metre/variance units, raster orientation, five output bands, sample coordinates, preview precision, and original-source SHA-256. Ten checks passed. Only 1,112 of 13,272 study-area cells passed screening; low correlation and large component rates still need spatial outlier review and scientific validation. No glacier outline has been applied.
8. Estimate and correct bias using independently identified stable ground. Compare glacier results to independent observations and document interpretation limits. Screening thresholds need evidence before being presented as validated criteria.
9. Validate real capture sequences visually across all three glaciers. Exclude cloud-obscured scenes where appropriate, account for seasonal snow, and retain exact acquisition dates rather than implying evenly spaced measurements.
10. Verify the interface on desktop, mobile, keyboard input, rapid timeline seeking, comparison, restoration, import, processing failure, and export. Complete the independent design finish review and record the resulting design system.
11. If the submission must be hosted, deploy the raster renderer and scientific backend with persistent object storage and durable jobs, connect the frontend to them, then exercise the entire workflow at the deployed URL. A lightweight Worker cannot replace the HDF5 processor.

## Acceptance boundaries

Every dated optical image remains traceable to its source. Displayed dates follow committed pixels. Derived products preserve source identity, radiometry, masks, units, parameters and acquisition dates. Intermediate radar animation states are explicitly interpolated, and fixed terrain does not imply time-varying elevation. Missing authenticated inputs or independent validation never produce fabricated scientific observations.
