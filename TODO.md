# SARscape backlog

## Current focus — glacier movement

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

## Next features — deferred by user

- [ ] Wetlands/flooding in Bangladesh, starting with the Sundarbans: GCOV comparisons with tidal context and validated interpretation.
- [ ] Forest and land-cover change: GCOV signal changes with independent evidence for disturbance.

## Reminder

The user requested a reminder on October 10, 2026 at 10:00 AM Asia/Dhaka to revisit the deferred features. Glacier movement remains the current focus.

## Imagery performance and clarity

- [x] Cache official Swiss aerial tiles locally and preload visible preview tiles for nearby timeline years with bounded background work.
- [x] Improve Sentinel-2 exploration previews to 20–160 m and mark the capture coverage boundary.
- [x] Add high-resolution Swiss aerial mosaic versions for Aletsch, with year-level provenance and source selection.
- [x] Add globe overview and display-only image adjustment controls.
- [ ] Acquire equivalent dated high-resolution imagery for Nepal and Alaska; the Swiss aerial source covers Aletsch only.
