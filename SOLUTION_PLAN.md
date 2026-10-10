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

## Acceptance boundaries

Every dated optical image remains traceable to its source. Displayed dates follow committed pixels. Derived products preserve source identity, radiometry, masks, units, parameters and acquisition dates. Intermediate radar animation states are explicitly interpolated, and fixed terrain does not imply time-varying elevation. Missing authenticated inputs or independent validation never produce fabricated scientific observations.
