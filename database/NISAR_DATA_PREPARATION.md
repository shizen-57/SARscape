# Dated radar data preparation

SARscape keeps optical satellite imagery as the terrain context and overlays acquisition-dated study observations separately. Road-map tiles are removed. The contextual imagery is a visual backdrop; timeline dates and capture details refer to the dated study observations.

## Prepare NISAR observations

The local processor can prepare provisional NISAR GCOV backscatter and GOFF offset products for any configured study area (`aletsch`, `langtang`, `columbia`, or `manchar`). It records source granule identity, acquisition times, orbit/product metadata, subset checksums, and processing provenance. The catalog and processed rasters stay local and are not committed.

1. Copy `.env.example` to `.env` and enter valid Earthdata credentials locally. If credentials were exposed elsewhere, rotate them first. `.env` is ignored by Git.
2. Run a small date range first, then continue from the local cache as needed:

   ```powershell
   npm run data:nisar -- --scenario langtang --all-dates --since 2025-07-30 --until 2026-10-12 --run-mib 512
   npm run data:nisar -- --scenario columbia --all-dates --since 2025-07-30 --until 2026-10-12 --run-mib 512
   ```

   Repeat for `aletsch` or `manchar` only when later NISAR conditions are useful. Use `--catalog-only` to refresh and store metadata without downloading or processing science rasters. Use `--date YYYY-MM-DD` (repeatable), `--product GCOV`, or exact `--granule ID` options to narrow work. Run limits bound each invocation; prepared products are reused after checksum validation.

## Flood date limits

The Manchar flood example is the 2022 event. NISAR launched on July 30, 2025, so it cannot supply radar observations from that flood. Use dated Sentinel-1 acquisitions for 2022 and dated Sentinel-2 imagery as optical context; NISAR observations at Manchar can only document later conditions. ASF catalog hits describe available metadata and coverage, not locally prepared flood rasters. The app must not label catalog records as processed map observations.

## Current local coverage

See [OBSERVATION_COVERAGE.md](OBSERVATION_COVERAGE.md) for the current prepared files, dated optical coverage, catalog search findings, and scientific limitations. A catalog match alone does not mean the full study region is covered or that a product passed scientific quality validation.
