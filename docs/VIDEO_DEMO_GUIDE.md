# SARscape video demo guide

Use this route to show what the application can demonstrate today while keeping
the image dates, measurement sources, and scientific limits clear. Target length:
about 2½ minutes.

## Before recording

1. Start SARscape and wait for the Aletsch map and imagery to finish loading.
2. Open **How to use SARscape** and choose **Open Aletsch measurement view**. This
sets Aletsch, its Swiss aerial context, and the continuous glacier-surface layer.
3. Wait for the selected raster and terrain tiles to settle before recording. The
first uncached request can take longer than later playback steps.
4. Keep the cursor and camera movement deliberate. Use the existing source notes
and selected-point inspector as on-screen evidence.

## Suggested story and narration

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:15 | Landing page and Aletsch 3D terrain | “SARscape brings real imagery and measured glacier observations together on a 3D landscape.” |
| 0:15–0:40 | Swiss aerial context and its timeline | “These are genuine Swiss aerial mosaic versions. A mosaic year is not an exact capture date for every point.” |
| 0:40–1:15 | Choose **Velocity**, play or scrub the glacier-surface timeline | “This continuous field shows published ITS_LIVE interval-mean glacier speed. These historical intervals are separate from NISAR observations.” |
| 1:15–1:40 | Click a point; show the selected location readout | “At this point, SARscape reports the selected interval values, the comparison direction, reported source errors, and whether the cells are missing.” |
| 1:40–2:00 | Choose **Speed change**; show the selected and baseline intervals and summary | “The difference uses cells measured in both intervals. It describes the selected data; it is not a significance test or a whole-glacier forecast.” |
| 2:00–2:20 | Optionally choose **Retreat** and compare the mapped outlines | “The outlines are published inventories. Their mapped area can reflect survey dates and methods as well as physical retreat.” |
| 2:20–2:40 | Open **NISAR radar** and show one available pair with its quality panel | “NISAR is a separate radar workflow. These component previews still need independent glacier validation, so I’m not presenting them as verified glacier speed.” |
| 2:40–2:55 | Return to the full view and finish on sources/limits | “The next scientific step is validating the radar signal and connecting compatible dated elevation models before claiming actual 3D surface deformation.” |

The timing is flexible. If the NISAR quality panel marks the selected pair low
quality, keep that warning in the recording and use the pair only to demonstrate
the processing and provenance workflow.

## Claims to avoid

- Do not say that the 3D glacier surface physically shrinks or deforms during
  playback. Terrain elevation is fixed; velocity and elevation-change rates are
  separate measured overlays.
- Do not call ITS_LIVE a NISAR product. ITS_LIVE supplies the prepared historical
  velocity intervals; NISAR GCOV and GOFF are displayed separately.
- Do not call Swiss mosaic years exact acquisition dates, or describe undated
  reference imagery as a dated observation.
- Do not describe radar colors as natural-color photographs or a direct melt
  measurement.
- Do not present a hazard probability or validated glacier-motion result. The app
  does not calculate a validated hazard score.

## Current live-data check

On October 11, 2026, the running local API returned four study areas, eight Aletsch
optical frames, five prepared Aletsch scientific surface frames, four stored NISAR
processing jobs, and 15 GCOV observations. This is a local availability check,
not an independent scientific validation or a promise that external imagery
services will always be reachable. The development logs also showed transient
upstream imagery timeouts and a tile-rendering 502 during preparation; let the
map settle before recording and confirm the intended view is fully drawn.
