# Measured glacier surfaces

The Aletsch default view is a continuous, georeferenced scientific raster draped over satellite imagery and real terrain. Raster colors never resize or pulse. Acquisition intervals, units, coverage, source links and limitations accompany the timeline. Select a surface location for the measurements.

## Available scientific variables

| Mode | Source and actual period | Representation | Limits |
| --- | --- | --- | --- |
| Velocity | NASA MEaSUREs ITS_LIVE v2: 28 Feb–19 Apr, 29 Apr–18 Jul, 24 Aug–12 Nov 2022; 27 Nov 2022–31 Jan 2023 | Continuous surface speed, fixed 0–300 m/year purple–yellow scale | Image-pair interval means, not daily observations. 120 m native posting; no individual ice chunks tracked. |
| Speed change | Two selected ITS_LIVE intervals | Common-valid-cell speed subtraction; fixed −150 to +150 m/year | Different seasonal intervals and errors can influence differences. No significant acceleration claim or error propagation. |
| Retreat | GLAMOS SGI1973, SGI2010 and SGI2016 (Aletsch acquired 2017) | Rasterized published boundaries, selected footprint cyan and former baseline area orange | 2010 inventory uses 2008–2011 imagery. Mapping methods differ; area need not decrease monotonically. Today's optical texture stays a context image. |
| Elevation | Hugonnet et al. (2021), ASTER DEM series, 1 Jan 2000–1 Jan 2020 | Continuous mean height-change rate, fixed −5 to +5 m/year red–blue scale | 100 m native posting. The uncertainty raster is not connected. This rate is not an absolute DEM at either endpoint. |

The terrain is **fixed**. No terrain deformation, melting animation, fabricated historical ice texture or interpolated retreat is produced. Valid, co-registered dated DEMs with documented vertical datum and uncertainties are required before implementing actual mesh updates. Velocity cannot establish thinning or melt. In elevation mode the 1973 mask includes formerly glaciated terrain.

These historical velocity surfaces are **ITS_LIVE, not NISAR**. The existing NISAR selector retains the 2026 GOFF pairs and GCOV dates, with their own provenance, scientific screening, uncertainty and quality warnings. GOFF's current low-quality components are not silently converted into a reliable horizontal speed field. Its primary preview is a continuous component raster; particles and original sample rings are optional diagnostics. Pair color limits are fixed at ±1.5 m/day (components) or 300 m/year (resolved flow), with saturation explicit. Its prepared neighborhood estimates remain labeled approximate.

## Preparation and storage

Run `npm run data:surfaces` from the repository root. Python dependencies are listed in `backend/requirements.txt`; `SARSCAPE_PYTHON` can select an existing Python installation. The preparation uses public sources without Earthdata credentials.

`backend/geo/prepare_glacier_surfaces.py` queries the NASA ITS_LIVE STAC API for Aletsch tile T32TMS. It reads only regional NetCDF byte ranges, with a 40 MiB limit per source and 64 MiB velocity transfer budget per run including rejected candidates. Servers must honor HTTP 206 ranges; full file downloads are refused. Cached frames reuse existing PNG/JSON/GeoTIFF artifacts. The four accepted sources initially transferred about 8.7 MiB in total; exploratory or rejected reads are additional. `prepare_elevation_surface.py` caches two small OGGM distributed scientific tiles (~2.7 MiB together); tile downloads are individually capped at 20 MiB. GLAMOS inventory archives are capped at 25 MiB each.

Artifacts live in `database/processed/surfaces/aletsch`: a manifest, historical outlines, one scientific GeoTIFF/inspection grid/display PNG per observation. This directory is ignored by Git. Scientific metadata and historical outlines are indexed in SQLite by migration `003_glacier_surfaces.sql`; full rasters stay in the filesystem. The manifest preserves acquisition dates, source URLs, units, masking year, coverage and interpretation.

Velocity preprocessing excludes missing cells, source-interpolated values, nonfinite errors, speeds outside 0–600 m/year and formal speed errors above 100 m/year. Frames need 35% glacier coverage. Actual accepted coverage is approximately 58–85%; gaps remain transparent. These are screening thresholds, not a validation against independent glacier stakes. Source raster reprojection uses nearest-neighbor sampling onto a common EPSG:3857 grid (~117 m ground posting). MapLibre bilinear texture rendering improves display continuity but does not increase scientific resolution or fill inspection values.

## Application components

### Explainable change summaries (11 October 2026)

The scientific surface panel now explains the selected measurement rather than
requiring users to interpret colors alone. Speed-change mode identifies A and B
by their full measurement intervals and reports the median of per-cell B−A
differences only at locations accepted in both grids. It also shows the two
speeds on that same common set, the middle half of cell differences, matched
cell counts, and the percentage of each interval's accepted cells retained.
These percentages describe retained measurements, not glacier-area coverage.

Summary cells are equally weighted, so results are not area-weighted whole-glacier
estimates. The middle-half range describes spatial variation, not statistical
uncertainty. Reported source errors are summarized separately with their available
cell counts. They are not propagated into a confidence interval: correlation,
systematic effects and seasonal differences remain unresolved. No significant
acceleration, melt or hazard-probability claim is produced. Incompatible grids,
sources, masks or units do not produce a numerical comparison; no common data
does not become zero change. Selecting the same interval is labeled explicitly.

Mapped-extent mode compares the selected inventory's published total area with
the first inventory used by the map. It permits gains as well as losses and does
not infer volume loss or an annual retreat rate. Elevation mode summarizes the
signed measured height-change field, explicitly retaining the unavailable
uncertainty and fixed-geometry limitations. Single-interval velocity summaries
also report descriptive speed and source-error statistics. Calculations are
memoized by their measurement inputs and do not run again for opacity changes.

This stage was implemented without starting the application or services. Offline
tests check numerical edge cases and render the actual explanation component
without a browser or server. Interactive layout, playback, source switching and
map inspection still need runtime acceptance when running is authorized.

- `backend/src/surfaces.mjs`: scenario validation and artifact allowlist.
- `GET /api/surfaces/:scenario`: capabilities, periods and provenance.
- `GET /api/surfaces/:scenario/:file`: only manifest-listed raster/inspection products and published outlines.
- `frontend/src/components/GlacierSurfaces.tsx`: mode selector, real observation playback, fixed legends and source disclosure.
- `surface-layers.ts`: terrain-draped image layers, historical masks, common-cell difference rendering and spatial inspector.
- `frontend/src/data/glacier-surfaces.mjs`: coordinate conversion, color scales, nodata-safe subtraction and polygon containment including holes.

Unprepared regions and hosted builds without the local surface service expose an unavailable capability, preserving aerial and NISAR navigation. No fabricated surfaces are used as fallbacks. A deployment must provide or adapt this scientific artifact service before these local products are available remotely.

## Reference comparison and verification

The reference velocity raster is represented by a continuous purple–orange–yellow field over glacier terrain. Real satellite texture and tilted relief supply the reference's 3D context. Historical extent and elevation-difference modes follow their respective mapped variables. Seasonal playback visibly replaces measured fields at real intervals while retaining the same camera and scale. Transparent scientific gaps are intentionally retained, even where the reference artwork looks completely filled.

The requested absolute surface-height animation remains unavailable because no dated absolute DEM sequence is connected. Historical boundaries are genuine, but the modern texture is not a reconstruction of 1973 ice. These are explicit capability limits rather than synthetic substitutes.

Tests cover common-cell differences, color saturation, coordinate lookup, polygon holes, approved artifacts, bounded range reads, scientific fill-value decoding and nodata-preserving reprojection. Existing GOFF, GCOV and imagery tests must continue passing. Visual acceptance includes desktop/mobile layout, all four modes, scientific popups, real date playback and preserved optical/NISAR selectors.

## Sources

- [NASA ITS_LIVE](https://its-live.jpl.nasa.gov/) and public STAC API `https://stac.itslive.cloud/search`.
- [GLAMOS SGI1973](https://doi.glamos.ch/data/inventory/inventory_sgi1973_r1976.html), [SGI2010](https://doi.glamos.ch/data/inventory/inventory_sgi2010_r2010.html), [SGI2016](https://doi.glamos.ch/data/inventory/inventory_sgi2016_r2020.html), CC BY 4.0. SGI2016: Linsbauer et al. (2021), DOI 10.3389/feart.2021.704189.
- [Hugonnet et al. (2021)](https://doi.org/10.1038/s41586-021-03436-z), distributed via the [OGGM Hugonnet integration](https://docs.oggm.org/en/latest/_modules/oggm/shop/hugonnet_maps.html).
- [NISAR GOFF product documentation](https://nisar-docs.asf.alaska.edu/goff/).
