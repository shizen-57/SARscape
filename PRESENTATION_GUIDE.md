# Presenting the NISAR glacier story

Open **http://127.0.0.1:5173/#simulation**. The map also has a **Present NISAR** button, and the main navigation has **Story**. Existing exploration, annual imagery, radar imports and environmental features remain available through **Explore**.

The centerpiece is an authentic NISAR GOFF acquisition pair from your supplied HDF5, with its matching 22-page QA report. The presentation is a radar signal story over Aletsch. It does not claim a validated glacier-velocity model or a future retreat forecast.

## What changed

- A dedicated screen with four chapters: acquisitions, signal playback, confidence, and evidence. **Play 80-second story** advances through all four; pausing preserves the position.
- A fixed, georeferenced satellite context and a separate radar-space view. Geographic cell positions do not move. Radar-space points interpolate their two signed components from zero to the measured endpoint, with visible unit axes.
- A real-cell inspector with current interpolated offsets, original endpoint offsets, formal uncertainties, correlation, coordinates and a source-cell selector. The initial representative at correlation ≥0.30 is chosen near the joint component/correlation medians, not an extreme.
- Correlation screening from 0 to 1, three processing windows, and two color components. Axis ranges and color scales stay fixed within a layer/component when the cutoff changes, so filtering does not manufacture apparent changes in values.
- Cached source QA pages, layer comparison, provenance, a PNG figure export and a JSON export containing the current settings and original selected-cell measurements.
- Fullscreen, presenter notes, keyboard controls, a return to the existing 3D terrain view, and responsive presentation controls. Evidence drawers stay inside the fullscreen presentation.
- The static background is rendered separately from animated glyphs. Playback uses elapsed animation time and pauses hidden-tab time. All 15 local assets load before the guided story becomes available; no remote map tiles are needed during the centerpiece.

## An 80-second demo

Press **F** or the fullscreen button. Press **Play 80-second story**. Narrate these four beats, leaving a little silence for the animation.

| Time | What happens | What to say |
| --- | --- | --- |
| 0–14 s | Aletsch context, the two acquisition dates, schematic scan | “An image shows us what a glacier looks like. Radar provides a different signal. This is an actual NISAR file over Aletsch: two observations, twelve days apart.” |
| 14–38 s | Points spread in signed radar component space; the selected cell and trace update | “Every point comes from a source cell. We separate along-track and slant-range offsets and replay them toward their measured endpoint. The intermediate frames are interpolation, not extra satellite passes.” |
| 38–60 s | Correlation cutoff steps through 0, 0.10, 0.20, 0.30 and 0.40 | “Now question the signal. This rectangular grid has 13,272 cells. At a 0.30 cutoff, Layer 3 retains 1,816; at 0.40, just 331. Better matching reduces coverage. It does not make systematic bias disappear.” |
| 60–80 s | Default screening returns; source report preview appears | “We can inspect a cell, compare the matching windows and open the original QA page. Every visual leads back to source measurements. This is an inspectable radar signal, with its limitations visible.” |

Then take **20–40 seconds** for a live interaction: click a cell or move the sample selector, switch the color component, and open **Follow the evidence**. Show the **uncertainty** QA tab and **Current state + source values** export. Finish there; browsing unrelated features dilutes this demo.

If automatic timing does not suit your talk, use the chapter buttons or arrow keys. Choose **Replay the signal**, then press the circular play button. The speed selector controls manual pair playback; the guided story keeps its fixed 80-second duration.

## Facts to have ready

- Acquisitions start **23 September 2026, 04:27:22 UTC** and **5 October 2026, 04:27:22 UTC**. The interval is exactly **12 days**.
- NISAR L-SAR GOFF, frequency A, HH; ascending track 72 / frame 25.
- Aletsch rectangle: **168 × 79 = 13,272 cells**, EPSG:32632, **80 m posting**. Posting is not independent spatial resolution.
- Source screening leaves **12,464 eligible cells**: 7 fail the source mask; 801 have nonfinite required values.
- Matching windows are **32×32, 64×64 and 128×128 radar-input pixels**, from the same acquisition pair. At correlation ≥0.30, they retain **1,112 / 1,144 / 1,816** cells respectively.
- The representative Layer-3 sample at cutoff 0.30 is crop **R40 / C26**, **46.481230406° N, 8.045833725° E**. Original measured components are **−153.217804 m along-track** and **+25.736338 m slant range**, with formal 1σ **1.197172 m / 0.323074 m** and correlation **0.348600119**. These large raw offsets must not be called proven glacier speed.
- The fixed optical context is **Sentinel-2, 27 September 2026**. It is separately dated context, not either NISAR radar acquisition, and its pixels stay fixed throughout playback.
- QA pages **8–9** show Layer-3 offsets, **15–16** uncertainty, and **21–22** covariance/correlation. The report covers the full granule; the interactive view is the Aletsch rectangle.

## Questions judges may ask

**“Is this glacier speed?”**

These are raw signed radar components. We have not corrected stable-ground bias, restricted the rectangle to mapped glacier ice, or independently validated ground velocity. Some large offsets may reflect systematic bias or matching errors. That is why screening, source values and uncertainty are exposed.

**“Did NISAR observe all of those animated dates?”**

No. There are two acquisitions. The visualization distributes the measured offset linearly within their 12-day interval. It does not invent intermediate observations or extrapolate beyond the pair.

**“Does a high correlation or small sigma prove accuracy?”**

No. Correlation measures matching strength. Formal sigma comes from the HDF5 variance and describes the product's formal random-error estimate; it does not include every systematic error. The QA report is diagnostic, not an overall pass/fail certificate.

**“What is the contribution?”**

Turning a large radar science product into a fast, interactive, source-linked explanation: a viewer can see the signal, challenge its screening, inspect individual measurements and carry the evidence away. Scientific validation remains a separate, explicit next step.

## Rehearsal and recovery

Keep the local frontend and backend running. Open the presentation once before the talk and wait for preparation; its bundle is about **12.9 MiB**. Data persist under `database/processed/supplied-nisar`; browser CacheStorage also reuses validated assets where permitted. The loaded centerpiece does not depend on an external imagery server. Opening the 3D terrain view or remote links can require internet access.

If preparing on another computer, place the same HDF5/report pair in the project root, install the project's Python dependencies, and run:

```powershell
npm run science:study
npm run imagery:cache -- --location=aletsch
npm run science:presentation
npm run dev
```

The last preparation command assembles the fixed context from genuine cached imagery. If a presentation asset is missing or damaged, **Retry preparation** clears only the presentation's browser cache and reloads the local prepared artifacts. Original files and processing products are retained.

Keyboard controls: **← / →** chapters; **Space** pair playback; **R** reset pair; **F** fullscreen. Form controls retain normal keyboard behavior. Use the on-screen chapter buttons while an input has focus.

## Verification record

All 15 presentation artifacts returned HTTP 200 through Vite. Renderer checks use the actual study data, confirm accepted counts and component medians against the prepared summary, and reproduce the representative source cell. Separate acquisition, geographic, radar-midpoint and confidence images are generated by `node scripts/render-presentation.mjs` under `database/processed/presentation-checks`.

The automated tests cover chapter timing, endpoints, screening, consistent display scales, source identity, units, selection and cache recovery. Native CPU rendering timings are recorded alongside the images; they do not measure browser/GPU frame rate. No connected browser surface is available in this session, so final pointer/keyboard interaction, layout and projected-screen legibility need your rehearsal.
