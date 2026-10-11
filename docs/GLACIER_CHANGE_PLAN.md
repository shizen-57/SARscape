# Explainable glacier-change view

Glacier movement remains the focus. This plan builds on the existing 3D terrain,
timelines and scientific artifacts without inventing glacier geometry or hazard
probabilities. The stages are implemented in sequence. No application runtime,
backend service or browser preview is started during offline validation.

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

Implemented: map clicks set a persistent, marked location; the inspector follows
that point through mode and date changes. It reports paired A/B interval values,
the B − A direction, per-cell reported errors, transparent or uncovered cells,
inventory inclusion and whole-inventory area caveats. It distinguishes self-
comparisons and does not turn reported errors into confidence or significance.
The map click listener stays mounted while timeline layers update.

## Stage 3 — clarify the visual comparison and evidence

Implemented: the map texture selector labels the selected optical mosaic/capture
or individual dated NISAR GCOV radar display. Its acquisition is called out in the
panel and map footnote as visual context, independent of scientific measurement
dates. Timeline playback now updates existing raster and outline sources in place;
repeated speed-difference images are cached by their source grids. Scientific
sources, mask year, original dataset links, and raster downloads remain visible.

## Stage 4 — validation and acceptance

Offline verification: 14 glacier surface and change-summary tests pass, including
location pairings, missing cells, boundaries, and summary interpretation. The
frontend TypeScript checking and production asset building pass. Runtime map/layout/playback behavior
and measured performance remain unverified because application and service startup
is prohibited by the standing instruction.

Absolute glacier geometry changes require compatible dated elevation models.
Validated hazard probabilities require suitable training labels, independent
validation and calibration. Neither is claimed by these stages.
