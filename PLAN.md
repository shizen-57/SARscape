# SARscape plan: put the NISAR finding at the centre

_Written 12 October 2026. This file sets the direction. `SOLUTION_PLAN.md`, `docs/GLACIER_CHANGE_PLAN.md`, `docs/GLACIER_SURFACES.md` and `TODO.md` remain as records of what was built; where they disagree with this plan, this plan wins._

No deadline and no hosting are required for now. The work is ordered by value, not by date.

---

## 1. Goal

> **SARscape shows, on a 3D glacier, what NISAR radar reveals about change that photos cannot, and how sure we are.**

The challenge is *Dancing with the SARs*. The differentiator is the NISAR finding, not the 3D map. Terrain, imagery and the globe are the stage; NISAR is the story.

A visitor (judge, student, curious non-specialist) should leave able to say:
1. what NISAR saw on the glacier,
2. why a photo could not have shown it,
3. how confident the result is, and what it does not prove.

---

## Status (updated 12 October 2026)

| Phase | State |
| --- | --- |
| 0 · Consolidate | Done: `npm test` (90 tests) and `npm run build` are green; the chatbot is configured with a real key. |
| 1 · Feasibility | Done. **The 15-date check found no clean seasonal wet-snow line.** What it did find: the glacier gets radar-darker after wet storms on every track. The finding was reframed around that storm response. |
| 2 · Radar record | Done: 24 Aletsch GCOV dates (8 per track, 19 June to 5 October 2026), about 1 GiB of partial reads. |
| 3 · Finding in the app | Done: **Radar change** tab with the finding card and four checks, difference maps, glacier-vs-rock chart with storms and rain, elevation chart, weather, supporting pattern. |
| 4 · Main experience | Done: Radar change is the default Aletsch tab, the landing copy states the finding, the Demo tour has a "What NISAR saw" chapter, *Through the clouds* compares a 100%-cloud Sentinel-2 scene (21 August 2026) with NISAR two days later, and radar terrain colour is the default style. |
| 5 · Columbia motion | Done for one pair: track 87 descending (14–26 July 2026) resolves a horizontal flow at Moderate quality (22% of glacier cells above twice the noise floor against 8.6% on stable rock, z = 16). Checked against ITS_LIVE (Landsat 9): over 5,207 cells moving faster than 0.5 m/day the median NISAR/ITS_LIVE ratio is 1.00, rank correlation 0.86, 94.5% of directions within 45°. NISAR cannot resolve ice below about 0.5 m/day. Track 92 ascending fails the coverage rule. |
| 6 · Presentation | Not started: demo video, one-page credits. |

**The finding.** After the 21 August 2026 storm the glacier was radar-darker than usual on all three tracks (median −0.8 dB relative to high rock), High confidence by the four checks, with a thin margin over the 0.7 dB dry-date threshold and a second storm on 25 August that blends into some responses. The other three storms are Low. See the README section *What NISAR saw*.

**Next:** (1) validate the Aletsch storm response independently (for example with Sentinel-1 or station weather), (2) more Columbia pairs (the BETA winter pairs need a labelled, separate treatment), (3) the demo video, (4) combine ascending and descending tracks for a vertical-motion check.

---

## 2. Honest starting point

### What is strong and stays
- **Real data, honestly labelled.** Every layer has a date, a source and its limits. Nothing is fabricated.
- **NISAR pipeline.** Catalogue search, authenticated partial HTTPS reads, regional crops, checksums, provenance, queued processing, and SQLite records (`backend/geo/prepare_aletsch.py`, `gcov.py`, `goff.py`).
- **3D stage.** MapLibre terrain, aerial mosaics 2018–2025, playback, comparison tools, the landing globe.
- **Aletsch radar data.** 15 GCOV dates prepared on the wide box (7.875–8.15°E, 46.355–46.605°N): 5 each on tracks 072 ascending, 144 ascending and 037 descending, from 1 July to 11 September 2026. The catalogue holds about 22 GCOV and 16 GOFF dates for July 1–October 5.
- **Glacier surfaces tab.** ITS_LIVE speed intervals, SGI outlines through time and elevation change, with explainable A/B summaries on common cells, uncertainty limits and point inspection (`GlacierSurfaces.tsx`, `GlacierChangeSummary.tsx`).
- **Demo tour.** An in-app presenter tour (top-bar **Demo tour**) and a recording guide (`docs/VIDEO_DEMO_GUIDE.md`).
- **Multi-area data command.** `npm run data:nisar -- --scenario …` with date, product and granule filters; Earthdata credentials can come from `.env` (`database/NISAR_DATA_PREPARATION.md`).
- **Ask SARscape assistant.** Configured with a real provider key; reads the app's data through tools and can drive the map.
- **Motion pipeline.** GOFF processing, SGI2016 glacier outline, stable-ground offset removal, filtering, noise floor, viewing-geometry conversion, and an honest "flow direction resolved?" test (`backend/geo/goff_motion.py`).

### What is weak
1. **No NISAR finding yet.** The app shows NISAR data but never states what it revealed.
2. **NISAR is a minor part of the most striking views.** The most impressive views are optical: aerial mosaics, and the "aerial + radar shading" style, which is mostly the photo.
3. **Motion on Aletsch is at the noise level.** It is slow ice (at most about 0.5 m/day). With GOFF's 80 m posting over 12 days, every pair so far is graded "components only, quality Low". More filtering will not fix that.
4. **Scope has spread.** Landing, aerial tab, radar tab, surfaces tab, motion preview, chatbot, Manchar floods, four radar colour styles, a planned NISAR globe. Much of it is good, but none of it yet carries a NISAR finding.
5. **Process risk.** Two agents edit the same branch, the full test suite has not had a recent green run, and the status docs lag behind the code.

---

## 3. What NISAR can honestly show for glaciers

| NISAR strength | Product we have | Realistic at Aletsch? |
| --- | --- | --- |
| Sees through cloud, day and night, every 12 days per track | GCOV | **Yes.** Three tracks give a radar view every few days. |
| Surface-state change (wet snow, melt onset, snowline) | GCOV backscatter time series | **Probably.** This is the main bet; the feasibility check must confirm it. |
| Ice motion | GOFF offsets | **No, at the noise level.** Realistic on a fast glacier (Columbia), later. |
| Millimetre deformation | GUNW/RUNW (InSAR) | Unlikely on melting summer ice; possible on dry winter snow. Not planned now. |

Therefore the Aletsch story is **seasonal radar change**, and the motion story moves to a fast glacier later.

---

## 4. What counts as a "finding"

A statement is shown as a finding only if all four checks pass. The app shows which checks pass, and says so when one fails.

1. **Tracks agree.** Two or more viewing directions show the same pattern, so it is not a geometry artifact.
2. **Beats the noise.** The glacier change is larger than the change on stable rock processed the same way. This uses the same stable-ground idea as the motion preview.
3. **Fits physics and weather.** For example, darkening during warm periods and recovery after snowfall, or a change that spreads uphill through the summer.
4. **Spatially coherent.** It follows the glacier and elevation, not random speckle.

Every finding carries a confidence label (Low / Moderate / High) built from these checks, plus a "what this does not prove" line. For example: radar darkening is not by itself melt, mass loss or thinning.

---

## 5. How the finding is shown

1. **Finding card.** One plain sentence, the confidence label and the four checks. Example wording, *not a result*: "In late July the lower glacier turned radar-dark on all three tracks while the upper basin stayed bright, consistent with wet snow spreading uphill."
2. **Difference map in 3D.** dB change between two dates, clipped to the glacier outline, diverging palette, labelled "radar change, not melt". Clicking a point opens its history.
3. **Time series chart.** The glacier's median backscatter on every real date, one line per track, with stable rock as a reference line. Only observed dates are plotted, with no interpolation between them.
4. **Elevation chart (wet-snow line).** Backscatter by elevation band over time. The height where the glacier turns dark is the wet-snow line, and its rise through the summer is the classic SAR glacier result. In 3D, a contour line at that height moves up the mountain.
5. **Weather strip.** Daily temperature and snowfall under the time series.
6. **Through the clouds.** A cloudy optical capture next to the radar view from the nearest date.
7. **Story mode.** About six guided steps: the glacier, radar on date A, radar on date B, what changed, why we believe it, what it does not prove.

Optical imagery stays as **context**: the photo that shows where things are, not the evidence.

---

## 6. Phases

### Phase 0 — Agree and consolidate (no new features)
- [ ] Confirm the goal sentence in §1.
- [ ] **One agent edits at a time.** Before starting, pull, then run the tests; when finishing, commit with a short note in `PROJECT_STATUS.md`.
- [ ] Get `npm test` and `npm run build` green, and record the result.
- [x] Ask SARscape has a real key. Next: give it a tool that reads the change summary so it can explain the finding.
- [ ] Freeze Manchar, the NISAR globe and new places. Leave the code, hide unfinished entry points.
- [ ] Radar colour styles: keep **radar colours** (false colour or natural-like) as the evidence view, and "aerial + radar shading" as an optional **context** view. Revert "shaded base everywhere"; radar should look like radar where it is evidence.
- [ ] Update `PROJECT_STATUS.md` to point at this plan.

**Done when:** tests and build are green, unused entry points are hidden, and the app still runs.

### Phase 1 — Feasibility check (offline, on the 15 dates we have)
Write a small analysis script (`backend/geo/gcov_change.py`, analysis only, no UI) that, per track:
- [ ] Extracts glacier-median and stable-rock-median HH (and HV) per date inside the SGI2016 outline and outside it.
- [ ] Computes date-to-date and date-to-first changes, and compares the glacier with rock (signal versus noise).
- [ ] Splits the glacier into elevation bands (needs a DEM; see §7) and looks for a dark band moving uphill.
- [ ] Checks whether the three tracks agree in timing and sign.
- [ ] Writes a short report (`docs/FEASIBILITY_GCOV.md`) with the numbers and one or two plots, with the verdict stated plainly: finding, possible finding, or no clear signal.

**Done when:** the report gives a clear yes or no, with numbers.
- **If yes:** go to Phase 2.
- **If no:** record why, then choose between (a) more dates (winter to summer, January–October), (b) HV or the ratio instead of HH, (c) moving the main story to Columbia motion earlier.

### Phase 2 — Complete the Aletsch radar record
- [ ] Prepare the remaining July 1–October 5 dates on all three tracks (`npm run data:nisar -- --all-dates --since 2026-07-01 --until 2026-10-05 --run-mib 6000`; needs an Earthdata login, entered by you or via `.env`).
- [ ] Optional, if Phase 1 needs contrast: January–June 2026. Early products are less calibrated (BETA), so label them.
- [ ] Re-run the colour previews and shading for all dates (`python backend/geo/gcov_shaded.py`).

**Done when:** every catalogue date in the window is prepared or explicitly skipped with a reason.

### Phase 3 — Build the finding into the app
- [ ] Backend: turn the Phase 1 script into a product per study area (`change-summary.json`): per-track time series, stable-rock reference, elevation bands, difference grids, the four checks and the confidence label.
- [ ] Map: difference-map layer (two chosen dates, same track) clipped to the outline.
- [ ] Charts: time series per track with rock reference; elevation-band chart. Use plain SVG unless a chart library is already installed.
- [ ] Weather strip (see §7).
- [ ] Finding card plus confidence panel, using the same check-list style as the motion preview's quality panel.
- [ ] Tests: change computation, the check logic, and "no interpolated dates in charts".

**Done when:** a visitor can open Aletsch, see the finding card, and trace every word to a map, a chart or a check.

### Phase 4 — Make it the main experience
- [ ] Radar change becomes the default Aletsch view; aerial photos are context.
- [ ] Add the finding chapters to the existing **Demo tour** (it already exists; extend it, do not rebuild it).
- [ ] "Through the clouds" comparison.
- [ ] Landing page copy says what NISAR found, not only what it is.
- [ ] Desktop, mobile and keyboard check; screenshots in `docs/review/`.

**Done when:** a first-time visitor reaches the finding in under about 90 seconds without help.

### Phase 5 — NISAR motion on a fast glacier (Columbia)
- [ ] Catalogue Columbia GOFF pairs (metadata already refreshed: 1,035 records), pick 2–3 pairs, and prepare them.
- [ ] Run the existing motion pipeline. It needs a Columbia outline from a published inventory (RGI 7.0 or GLIMS) with source and licence recorded; do not draw one.
- [ ] If flow direction is resolved, show NISAR-driven flow particles; compare with ITS_LIVE as a **check**, never as the animation source.
- [ ] If it is not resolved, report that honestly, as for Aletsch.

### Phase 6 — Presentation and polish (later)
- [ ] Demo video following story mode (update `docs/VIDEO_DEMO_GUIDE.md`).
- [ ] One-page "How SARscape uses NISAR" and a credits and limits page.
- [ ] Reconsider: chatbot (with a key), Langtang, the NISAR overview globe, hosting. Each must support the goal in §1 or stay frozen.

---

## 7. Data still needed

| Need | Candidate source | Notes |
| --- | --- | --- |
| Remaining Aletsch GCOV dates | ASF / Earthdata (existing pipeline) | Earthdata login required. |
| Elevation model for elevation bands | Copernicus DEM GLO-30 (open, AWS) or swisstopo swissALTI3D (open data) | Download only the study box; record source and licence. Verify access before use. |
| Daily temperature and snowfall | MeteoSwiss open data (for example the Jungfraujoch station) or the ERA5 reanalysis through the Open-Meteo archive API | Verify licence and coverage before use. ERA5 is coarse (about 25 km). |
| Cloudy optical example | Sentinel-2 (already in `database/imagery/sentinel2.json`) | Must be a real, dated, cloudy capture close to a radar date. |
| Columbia outline (Phase 5) | RGI 7.0 or GLIMS | Published outline only. |

---

## 8. Cut, freeze, keep

| Item | Decision | Why |
| --- | --- | --- |
| Ask SARscape chatbot | Keep (live key) | Give it the change-summary tool so it explains the finding with numbers and sources. |
| Manchar flood scenario | Freeze | NISAR launched after the 2022 flood; off-story. |
| NISAR thumbnail globe | Freeze | A rough picture (2–3 km pixels) with no finding behind it. |
| Aerial + radar shading | Keep as context only | Looks natural because it is mostly the photo. |
| Four radar colour styles | Reduce to evidence + context | Too many choices for a non-specialist. |
| Motion preview on Aletsch | Keep, with its honest "Low" verdict | Shows rigour; the real motion story moves to Columbia. |
| Glacier surfaces tab | Keep as context | Long-term change (outlines, elevation, ITS_LIVE) frames the short NISAR record. |
| Landing page and 3D stage | Keep | The stage for the story. |

---

## 9. Risks

| Risk | What we do |
| --- | --- |
| No clear seasonal signal in the 15 dates | Phase 1 decides early; fall back to more dates, HV or ratio, or Columbia motion. |
| Tracks disagree because of geometry (layover, shadow, incidence) | Compare within each track; mask steep slopes; only claim what agrees. |
| Radar change read as melt | Every view says "radar change, not melt"; the finding card states what it does not prove. |
| Early-2026 products less calibrated | Label them; never mix calibrated and BETA within one comparison without saying so. |
| Two agents editing at once | One editor at a time; tests before and after; short status note. |
| Credentials | Never in chat or code; `.env` only, which is git-ignored. |

---

## 10. Decisions needed from you

1. Accept or change the goal sentence in §1.
2. Accept the cuts and freezes in §8, especially reverting "shaded everywhere" in favour of radar-driven colour.
3. Earthdata access for Phase 2: run the command yourself, or add credentials to `.env` yourself so the agent can run it. Never paste a password in chat; if one was pasted, change it first.
4. Whether to fetch winter dates (January–June 2026) if Phase 1 needs more contrast.

**Next step:** Phase 0, then the Phase 1 feasibility check on the 15 prepared dates.
