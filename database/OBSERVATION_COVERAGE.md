# Observation coverage and date policy

SARscape keeps observed acquisitions separate from background context and from year-labelled mosaic versions. A scene without a verifiable acquisition time is excluded from the study timeline.

## Dated optical observations

`imagery/sentinel2.json` contains 25 Sentinel-2 L2A captures with acquisition timestamps and source metadata:

| Study area | Captures | Coverage |
| --- | ---: | --- |
| Aletsch Glacier | 8 | 2018–2025 |
| Langtang Glacier | 6 | 2018–2024 |
| Columbia Glacier | 7 | 2018–2025 |
| Manchar floodplain | 4 | 27 June–14 November 2022 |

The four Manchar captures are optical views of the 2022 event. Their dates are acquisition dates, not daily flood simulations or depth measurements. ASF discovery also searches dated Sentinel-1 GRD_HD radar scenes from June-December 2022 for this flood area; catalog metadata is not the same as locally prepared map imagery.

## NISAR archive and prepared data

The app searches ASF for dated NISAR GCOV scenes and GOFF acquisition pairs in the selected study-area bounds, and for dated Sentinel-1 GRD_HD scenes during the Manchar flood event. It drops archive records unless both start and stop acquisition times parse successfully. The archive links are metadata discovery; downloading science files requires NASA Earthdata authentication.

An ASF search on 12 October 2026 confirmed overlapping NISAR GCOV and GOFF archive records for Langtang and Columbia (the search returned its 50-result cap for each product/area). Manchar returned 53 NISAR GCOV records and no GOFF pairs; its 2022 event search returned 54 Sentinel-1 GRD_HD scenes. Footprint intersection does not prove that every product covers the full study box, and the catalog totals can change as ASF publishes more products.

The local processed archive currently contains 24 Aletsch GCOV observations (8 on each of tracks 72 ascending, 144 ascending and 37 descending) dated 19 June–5 October 2026 on the wide study box, and two Aletsch GOFF pairs (11–23 September and 23 September–5 October 2026). For Columbia it contains two PROVISIONAL GOFF pairs dated 14–26 July 2026 (track 87 descending, frame 57; track 92 ascending, frame 33). Duplicate processing artifacts are suppressed by source granule ID. No NISAR products are prepared for Langtang or Manchar; the app must show only records returned by ASF for those areas, labelled as catalogue records.

NISAR launched on 30 July 2025. It therefore cannot have observed the 2022 Manchar flood. Keep that historical timeline on its real Sentinel-2 dates; a later flood study needs a post-launch event and confirmed NISAR coverage. [NASA NISAR mission page](https://science.nasa.gov/mission/nisar/)

## High-detail Aletsch context

SWISSIMAGE provides eight 2018–2025 mosaic versions. The displayed year is the mosaic version year, not a promise that every pixel was captured during that year; local flight dates may vary and adjacent versions may reuse imagery. The app labels these as mosaic years and never presents them as exact acquisition dates.

## Display rule

The study timeline accepts exact Sentinel-2 acquisition timestamps and explicitly year-labelled SWISSIMAGE mosaic versions. Undated Esri reference imagery is rejected by the imagery API and is not offered as a study observation. Radar catalog entries without dated acquisition bounds are filtered out. The landing globe is geographic context, not an observation in the study timeline.
