# SARscape — implemented project overview

Updated: 11 October 2026. This document describes the implemented application and its limitations; it does not certify deployment readiness or independently validate scientific results.

## Purpose

SARscape helps users explore glacier observations on a 3D terrain map, compare dates, and understand optical imagery alongside radar and published glacier measurements. Glacier movement remains the main focus. The project uses established geospatial libraries rather than building its own globe or raster engine.

## Implemented experience

- Interactive MapLibre terrain exploration, globe overview, and return to the study area.
- Observation timeline with acquisition selection and playback. The current application defaults to optical imagery for Aletsch.
- Synchronized comparison maps with a fixed baseline, swipe/change comparison, and first/latest blinking.
- Sentinel-2 dated imagery, Swiss aerial imagery where available, and an explicitly undated reference imagery option.
- Display adjustments for brightness, contrast, saturation, and highlights, with reset controls.
- Radar observation and offset/rate controls, quality filtering, raw sample inspection, and an approximate motion preview.
- Prepared glacier surface layers: published velocity, velocity differences, historical outlines, and long-term elevation change.
- Explainable measurement summaries: paired-interval speed differences on common measured cells, published inventory area differences, signed height-change rates, and explicit coverage/error limitations.
- Saved optical views and observation metadata export.
- Loading, retry, provenance, and data explanation interfaces.
- An eight-chapter, presenter-led demo tour that stages the globe, optical imagery, flood comparison, glacier measurements, NISAR workflows, exploration tools and source limitations; it guides a human recording without generating video.
- Optional assistant with server-side credentials and bounded tool access. Its availability depends on configuration.

Playback changes observed imagery or derived layers. Terrain is currently fixed; the application does not reconstruct historical glacier geometry or animate measured absolute glacier height.

## Study areas

| Area | Role and important distinction |
| --- | --- |
| Aletsch Glacier, Switzerland | Main glacier study area; optical, radar, and prepared scientific surface workflows. |
| Langtang Glacier, Nepal | Additional glacier exploration; high-resolution dated coverage remains a limitation. |
| Columbia Glacier, Alaska | Additional glacier exploration; high-resolution dated coverage remains a limitation. |
| Manchar Lake, Pakistan | Optical flood case using 2022 Sentinel-2 observations; these are not 2022 NISAR observations or water-depth measurements. |

## Data and interpretation

| Source/product | What it supports | Limits that must remain visible |
| --- | --- | --- |
| Sentinel-2 | Dated optical comparison | Native resolution limits sharpness; enlarging pixels cannot create real detail. |
| Swiss aerial imagery | Detailed reference/mosaic imagery for Swiss coverage | Mosaic year is not an exact capture date for every pixel. |
| Undated reference imagery | Detailed geographic context | Must not be presented as an observation from the selected timeline date. |
| NISAR GCOV | Radar backscatter visualization | Radar appearance is not natural-color photography or a direct melt measurement. |
| NISAR GOFF | Offset components and interval-normalized rates, with formal uncertainty | Component offsets are not automatically a complete 3D glacier velocity vector. |
| ITS_LIVE | Published interval-mean glacier velocity and differences | Not NISAR; differing speeds alone do not establish statistically significant acceleration. |
| GLAMOS glacier inventories | Historical mapped glacier footprints | Mapping periods and methods differ; outlines do not provide historical surface textures. |
| Hugonnet/ASTER elevation-change product | Mean elevation-change rate over 2000–2020 | Not a sequence of absolute elevation models; uncertainty is not yet connected to the display. |

The shaded radar presentation combines radar brightness with reference aerial colors. It must not be interpreted as a natural-color photograph captured on the radar acquisition date. Brightness changes can have multiple causes.

## Architecture

The project maintains separate `frontend`, `backend`, and `database` folders.

- **Frontend:** React, TypeScript, MapLibre GL, TanStack Query, Radix-based interface components, and Lucide icons. It handles navigation, display, comparison, and user controls.
- **Backend:** Hono/Node APIs and Python geospatial processing with GDAL/rasterio/h5py. It handles imagery access, raster preparation, product validation, jobs, and cache reuse.
- **Database/storage:** SQLite holds cache records and metadata/indexes. Large imagery, uploaded products, and processed artifacts live in files alongside the database rather than large SQLite image blobs.
- **Regional data:** Local subsets and source catalog metadata support bounded scientific processing. Derived-subset checksums must not be confused with checksums of the complete official product.

The general path is: select observation → request a matching artifact or tile → reuse cached results where possible → validate/process missing data → persist the result and provenance → render it over terrain.

## Scientific processing implemented

- Uploaded HDF5 products are associated with persisted processing jobs and can be retried using the stored input.
- Product processing validates relevant dates, units, grids, projection, no-data values, correlation, and variance.
- GOFF offsets are retained in native floating-point artifacts; component rates use the acquisition interval. Formal uncertainty derives from the supplied variance and interval.
- Compact integer previews include scale, offset, no-data, aggregation, and rounding-error metadata. They supplement the native scientific artifacts rather than replace them.
- GCOV preparation retains floating-point backscatter products and supports multiple display styles.
- Regional partial downloads check byte-range responses and transfer limits before caching subsets.
- Unsupported product types remain metadata-only until a suitable processor is reviewed.

Scientific processing still needs independent glacier-domain validation. Motion previews and screening choices must remain clearly distinguished from validated hazard predictions.

## Completed offline performance work

The optimization preserves existing imagery selection and scientific data. It adds:

- Bounded recently used response caching, with SQLite persistence for larger results.
- Less frequent database expiry housekeeping while preserving immediate expiry checks on reads.
- Shared simultaneous tile work and overlapping COG byte-range requests.
- Bounded, serial background warming near the selected observation, with obsolete work canceled.
- Streaming preload response consumption to avoid another full-image buffer.
- Fewer repeated terrain, boundary, and overlay updates; reuse of existing map resources through globe transitions.

These changes should reduce duplicate processing, transfers, allocations, and rendering work. No measured application loading-time or frame-rate improvement is claimed. See [PERFORMANCE.md](PERFORMANCE.md) for budgets, evidence, and remaining runtime checks.

## Verification recorded

The completed optimization report records 66 passing offline regression tests, successful TypeScript/frontend/backend builds, and a clean whitespace check. Coverage includes cache behavior, cancellation, scientific fixtures, provenance, timeline, and comparison behavior.

The application, backend services, development servers, and browser previews were not started during that optimization. This document-only follow-up also does not start them. Runtime behavior of the combined changes still needs testing when authorized.

## Remaining work

- Check actual loading speed, smoothness, memory use, cancellation, comparison, and globe transitions in a running application.
- Validate scientific interpretations and uncertainty with glacier-domain evidence.
- Improve access to genuinely higher-resolution dated imagery where licensing and availability permit. Sharpening cannot substitute for source detail.
- Obtain compatible dated absolute elevation models before implementing measured glacier geometry change.
- Provide a dedicated hosted raster/scientific backend; the lightweight Worker alone cannot run the full local HDF5 processing stack.
- Keep wetlands/flooding in the Sundarbans and forest/land-cover change in the future backlog.
- Treat numerical hazard probabilities as future research requiring event labels, independent validation, calibration, and uncertainty—not as values inferred from backscatter alone.

## Related documents

- [README.md](README.md): project setup and general documentation. Some older defaults should be checked against current code.
- [PERFORMANCE.md](PERFORMANCE.md): completed offline optimization and verification.
- [docs/GLACIER_SURFACES.md](docs/GLACIER_SURFACES.md): prepared scientific glacier surfaces and interpretation limits.
- [TODO.md](TODO.md): remaining features and backlog.
