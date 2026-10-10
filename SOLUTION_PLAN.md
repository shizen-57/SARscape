# SARscape — implementation and completion plan

The target is a finished glacier-change application with real observations, a fast 3D interface, and a backend that performs geospatial processing. Wetlands in the Sundarbans and forest/land-cover change remain deferred at the user's request.

## Implemented foundation

- Reuse MapLibre for terrain and GPU map rendering; React/TypeScript, TanStack Query, and Radix/shadcn-style controls for the interface; Hono, SQLite, rasterio/GDAL, h5py, and pyproj for the backend.
- Keep `frontend`, `backend`, and `database` separate. Serve the production frontend through the backend with a separate Python renderer.
- Render actual Sentinel-2 captures per acquisition date. Preserve metadata links, real source resolution, scene-cloud limitations, and fixed-elevation attribution.
- Support date scrubbing, playback that waits for imagery, atomic comparison loading, displayed-date tracking, saved cameras, capture details, and provenance downloads.
- Deliver satellite tiles through bounded parallel byte reads, verified complete ranges, request deduplication, persistent caching, and bounded GPU frame retention.
- Offer explicit Explore previews and source-detail inspection on demand. Compare oldest/latest images through a draggable change lens, swipe, or blink; invalidate stale draped terrain textures before announcing the new date.
- Discover genuine NISAR GOFF catalog records. Accept downloaded GOFF HDF5 files, persist processing jobs, validate schema and spatial coverage, screen source masks, and publish radar-component rates with uncertainty and provenance.
- Keep radar analysis optional over the real glacier imagery. Samples report along-track and slant-range rates, formal uncertainty, correlation, and acquisition dates. No horizontal speed or time-varying elevation is implied.
- Preserve original float32 science products and generate separate bounded int16 previews with per-band scale/offset, missing-data masks, aggregation metadata, and measured quantization error. Retry interrupted processing from the stored HDF5 upload.

## Finish the scientific application

1. Completed locally: the user supplied a matching production Aletsch GOFF file for September 23–October 5, 2026. The production import API code, queue, processor, and artifact APIs were exercised in-process using frequency A, HH, layer1, and correlation 0.3. Verify the saved job in the UI after starting or restarting the local backend.
2. Completed software checks against the actual file: specification 1.5.0 combined source mask without polarization validDataMask, dates, 80 m posting, metre/variance units, raster orientation, five output bands, sample coordinates, preview precision, and original-source SHA-256. Ten checks passed. Only 1,112 of 13,272 study-area cells passed screening; low correlation and large component rates still need spatial outlier review and scientific validation. No glacier outline has been applied.
3. Estimate and correct bias using independently identified stable ground. Compare glacier results to independent observations and document interpretation limits. Screening thresholds need evidence before being presented as validated criteria.
4. Validate real capture sequences visually across all three glaciers. Exclude cloud-obscured scenes where appropriate, account for seasonal snow, and retain exact acquisition dates rather than implying evenly spaced measurements.
5. Verify the interface on desktop, mobile, keyboard input, rapid timeline seeking, comparison, restoration, import, processing failure, and export. Complete the independent design finish review and record the resulting design system.
6. If the submission must be hosted, deploy the raster renderer and scientific backend with persistent object storage and durable jobs, connect the frontend to them, then exercise the entire workflow at the deployed URL. A lightweight Worker cannot replace the HDF5 processor.

## UX references

[kepler.gl](https://kepler.gl/demo) informs the map-first workspace and adjacent controls. [shadcn](https://ui.shadcn.com/docs/components) informs predictable components; Radix provides accessible switches, sheets, and tooltips. [MapLibre terrain examples](https://maplibre.org/maplibre-gl-js/docs/examples/3d-terrain/) support terrain interaction. [ASF's GOFF guide](https://nisar-docs.asf.alaska.edu/goff/) and the [ISCE3 GOFF writer](https://github.com/isce-framework/isce3/blob/develop/python/packages/nisar/products/insar/GOFF_writer.py) define product behavior and schema.

## Acceptance criteria

Every visible dated image must be traceable to its actual scene. Displayed labels must match loaded pixels. Real GOFF outputs must preserve acquisition pair, units, source masks, uncertainty, selected parameters, and source hash. The UI must remain responsive while the backend processes files. Measurements must be independently validated before being described as glacier speed. Desktop/mobile verification and the deployed workflow must pass before declaring the project ready for judging.
