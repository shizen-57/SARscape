# Selected main-branch improvements

Work branch: `codex/aletsch-small-data`.
Reference: `origin/main` at `d10ae49`. No branch merge was performed.

## Adapted from main

- Elapsed-time playback clock, with hidden-page handling, for GOFF replay.
- Atomic image loading and smooth optical-image dissolves on the existing 3D terrain. Previous imagery stays visible until replacement tiles load; interrupted transitions restore the previous frame.
- Playback speed controls and a downloadable replay evidence record, following main's presentation controls and provenance approach.

The existing theme, terrain viewer, scientific surfaces, colored radar modes, and chatbox are retained. Main's presentation pages and color styles were not imported.

## Branch-specific fixes

- GOFF replay now changes the continuous raster even when particles are disabled. It builds from zero to the filtered endpoint against a fixed color range. Intermediate states are linear interpolation, not extra acquisitions. Raster uploads are bounded to 31 states per pair; hidden particles are not regenerated each animation frame.
- Cell popups use the selected replay fraction for cumulative displacement and label intermediate snapshots.
- Radar acquisition playback waits for the next image to decode and pauses on an image error.
- Expanded viewing bounds no longer hide correctly georeferenced earlier crops. Data remains limited to each product's actual coverage.
- SleepyAI `auto:free` is configured in the ignored local environment file. The provider advertised zero input and output prices when selected. Listed DeepSeek V3.2 and Kimi K2.5 IDs returned upstream model-not-found errors; no paid fallback was selected. Credentials are server-side only.

## Checks and limits

Production build and TypeScript compilation succeeded. Local inventory returned three GCOV dates and four GOFF pair/layer choices. A real assistant request retrieved 11 September, 23 September, and 5 October 2026. Browser replay advanced through the interpolated interval to the secondary acquisition.

The test suite was not run for this change. GOFF remains an approximate radar-component preview; it does not establish validated glacier-flow direction or melting. Terrain geometry remains fixed. Image dissolves blend real observations and do not add measurements.
