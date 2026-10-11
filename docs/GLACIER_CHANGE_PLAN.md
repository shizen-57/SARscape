# Explainable glacier-change view

Glacier movement remains the focus. This plan builds on the existing 3D terrain,
timelines and scientific artifacts without inventing glacier geometry or hazard
probabilities. Work pauses after each stage for the user's decision to proceed.

## Stage 1 — explain the available measurements

Implemented: paired-interval speed summaries on common measured cells, published
inventory area differences, and signed elevation-change-rate summaries. Show
full periods, missing-data behavior, retained measurements, reported errors and
interpretation limits. Reuse the prepared grids and existing map layers; preserve
imagery detail. Numerical and actual-component rendering tests run offline.

Verification: all 14 new calculation/rendering tests pass. The full regression
run passed 77 of 80 tests; the three affected scientific checks subsequently
passed in a five-test rerun outside Windows sandbox restrictions. The initial
failures were two denied temporary-fixture accesses and one recovery assertion.
No application, server or browser preview was started.

The final production build passes, including TypeScript checking, frontend
assets and the backend Worker bundle. Interactive layout and map behavior still
require runtime acceptance; no runtime speed or scientific-validation claim is made.

## Stage 2 — connect explanations to selected map locations

Next, pending user approval: improve the existing spatial inspector with paired
values, per-location missing-data and error explanations, explicit A/B periods,
and consistent comparison direction. Preserve selection where appropriate through
timeline changes and make the readout accessible without hiding key evidence in
a transient popup. Do not derive significance or 3D velocity from unsupported data.

## Stage 3 — clarify the visual comparison and evidence

Pending user approval: strengthen the connection between baseline, selected date,
fixed legends and the terrain view. Make the distinction between measured layers
and background texture obvious. Consider a provenance-rich comparison export.
Any additional imagery must retain real acquisition metadata and source detail.

## Stage 4 — validation and acceptance

Pending user approval: run appropriate offline regression checks and document
remaining scientific validation. Runtime map/layout/playback checks and measured
performance require separate authorization to run the application; the standing
instruction currently prohibits application, service and browser-preview startup.

Absolute glacier geometry changes require compatible dated elevation models.
Validated hazard probabilities require suitable training labels, independent
validation and calibration. Neither is claimed by these stages.
