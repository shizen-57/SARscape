# Main branch data sources

Read-only inspection of `origin/main` at `d10ae49`, 10 October 2026.
Files described below are main-branch versions, which may differ from this checkout.

| View | Source | Temporal interpretation |
| --- | --- | --- |
| Annual 2D comparison | Copernicus Sentinel-2 L2A RGB TCI; 10 m source pixels; Earth Search discovery and Microsoft Planetary Computer delivery | Nine observed images; transitions dissolve photographs, with fixed reference and camera |
| NISAR presentation | Supplied GOFF HDF5 and matching QA report; ascending track 72, frame 25, frequency A, HH | 23 Sep 2026 04:27:22 UTC to 5 Oct 2026 04:27:22 UTC; linear interpolation of signed radar offsets |
| Terrain | Mapterhorn raster DEM, Terrarium encoding | Fixed elevation; 1.15× relief |
| Swiss aerial background | swisstopo SWISSIMAGE WMTS, mosaic versions 2018–2025 | Mosaic year is not an exact local flight date; adjacent versions can reuse imagery |
| Outside dated coverage | Esri World Imagery | Undated context |

## Annual image dates

Sentinel-2 tile 32TMS: 2018-09-27, 2019-09-12, 2020-08-07,
2021-08-14, 2022-09-18, 2023-09-26, 2024-10-30, 2025-08-08,
2026-09-27.

Native crops are reprojected to a common EPSG:3857 display grid, 1400 pixels high,
and saved as `annual-YYYY.png`. Display resampling does not increase source detail.
All nine images are decoded before playback; intermediate frames are dissolves,
not new observations, generated ice, or elevation changes.

Example original scene metadata:
https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2C_MSIL2A_20260927T101801_R065_T32TMS_20260927T153810

Main evidence: `database/imagery/sentinel2.json`, `backend/geo/optical_tiles.py`,
`backend/geo/presentation.py`, `frontend/src/components/AnnualExperience.tsx`,
`frontend/src/data/annual-presentation.mjs`.

## NISAR limits

Main discovers the supplied HDF5/PDF filenames at runtime; a main-specific ignored
generated summary was unavailable for independent inspection. Documentation
identifies the same September 23–October 5 acquisition pair supplied by the user.
The Aletsch crop uses EPSG:32632, 80 m posting, and a 168×79 grid. Three matching
windows are available. Main's presentation uses raw offsets without stable-rock
correction or an ice-only mask. Dots move in radar-component space; geographic
locations and the September 27 Sentinel-2 background remain fixed. The canvas's
geographic mode is a rotated flat plane, not deforming DEM terrain.

Main evidence: `backend/geo/supplied_study.py`,
`frontend/src/data/nisar-renderer.mjs`, `frontend/src/data/nisar-presentation.mjs`,
`scripts/prepare-study.mjs`, `PRESENTATION_GUIDE.md`.

## Provenance defect to resolve before importing annual imagery

The 2024 Aletsch record's `id` and `discoveryUrl` identify S2B / September 15,
but its delivery URL, `sourceSceneId`, date, and platform identify S2A / October 30.
Image selection follows the latter. Exports must reconcile the stale discovery
identifier before presenting it as consistent provenance.

Main's smooth appearance comes from image caching, dedicated framing, a fixed
reference, and transition timing. It does not supply additional NISAR measurements
of glacier surface-height change.
