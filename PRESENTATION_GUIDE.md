# Presenting visible glacier change and NISAR measurements

Open **http://127.0.0.1:5173/#simulation**, or choose **Simulation** in the main navigation. The opening view is **Glacier changes**, with the 2018 and 2026 lower tongue already visible side by side. The second tab is **Radar displacement**, using your supplied GOFF HDF5 and its matching QA report. Explore retains the other existing features.

## What the two modes show

**Glacier changes** shows nine authentic Sentinel-2 captures from 2018 through 2026, at 10 m source detail. Every image uses the same registered grid and camera. The lower tongue is enlarged by default so the changing ice front can be seen against the valley. The left image is the reference; playback advances only the right image. Each interval holds an actual capture, then smoothly dissolves to the next. The observed dates and blended transitions have separate labels. These are visible changes in appearance, with season, snow and illumination also contributing; the view does not automatically measure a retreat distance.

Use **Lower tongue**, **Middle bend** or **Whole glacier** to choose a focus. **Inspect closer** changes both sides together. The reference date is selected once above the image. **Side by side** keeps both complete views aligned; **Swipe** lets you drag a divider over the same place. Year buttons always select exact observations. Play starts from 2018 when the opening 2026 view is at the end; a full sequence takes 28 seconds at 1x. All nine images are decoded and cached before playback becomes available.

**Radar displacement** opens in radar component space at zero. Pale dots show the measured endpoints; brighter dots and the selected cell arrow grow toward them. The two axes are signed along-track and slant-range offsets in metres. The inspector and trace update continuously. The acquisition interval is exactly 12 days; intermediate positions are linear interpolation, not additional satellite passes. Geographic context keeps its image and sample locations fixed. The original three matching windows, screening, cell selection, uncertainty, QA pages and source exports remain available.

The modes have separate clocks and only the active clock is present. In Explore, showing the supplied radar overlay replaces the optical timeline with a radar timeline. Its component and removal controls are in **Map layers**. **Data & analysis** is the single entry for capture metadata, source exports, detailed radar measurements, imports, environmental analysis and project progress. There are no separate floating radar time controls, capture-details popup or repeated presentation launch buttons.

## A two-minute demonstration

1. **0-10 seconds: open with visible change.** Keep Lower tongue selected. Say: "These are actual 2018 and 2026 images of the same place. Look at the ice front against the valley walls." Leave a few seconds for the audience to compare.
2. **10-38 seconds: press the annual play button.** Say: "The reference stays fixed. The other image moves through nine dated captures, so we can follow how the glacier looks across the years." Let the images speak. Image blends are transitions between observations, not synthetic yearly data.
3. **38-45 seconds: inspect the endpoint.** Choose Swipe and drag across the lower tongue. Say: "At the end, we can compare the same ground directly. Snow and season also affect the images, so we keep the dates and source evidence visible."
4. **45-70 seconds: switch to Radar displacement and press its circular play button.** Say: "Radar measures a different signal. Over this twelve-day pair, we make two signed components visible. The pale dots are the measured endpoints; the arrow builds toward the selected cell's values." This manual replay takes 24 seconds at 1x.
5. **70-95 seconds: challenge the signal.** Choose Question the signal, then change correlation from 0.30 to 0.40. Layer 3 goes from 1,816 to 331 cells. Say: "Better matching reduces coverage. It does not correct systematic bias. We expose that tradeoff instead of hiding it." Return to 0.30 and inspect a cell.
6. **95-120 seconds: show the proof.** Choose Trace the evidence, then **Open the evidence**. Show the uncertainty QA tab and export **Current state + source values**. Say: "Every visual can be traced to the original measurements and QA report." This is a radar signal demonstration, not a validated glacier-speed forecast.

For a longer radar segment, **Play 80-second story** guides all four radar chapters. It has one button on every screen size. Guided narration follows acquisitions (0-14s), replay (14-38s), correlation screening (38-60s), then evidence (60-80s). The final chapter provides the evidence entry; it does not open a popup automatically. The manual speed selector controls pair replay, while the guided story keeps its 80-second duration.

## Controls and evidence

- Annual mode: Space plays/pauses; left/right select actual captures; R returns to 2018; F toggles fullscreen. The information icon opens the scene list, presentation notes, comparison PNG export and evidence JSON export.
- Radar mode: Space plays/pauses the measured pair; left/right change chapters; R resets the pair; F toggles fullscreen. Window, color component and cutoff settings have one home in the cell inspector. **Open the evidence** provides original QA pages and exports. The information icon contains narration and shortcuts. **3D terrain** transfers the current screened overlay to Explore.
- Form controls keep normal keyboard behavior. Changing modes cancels the previous animation. Opening an evidence panel pauses playback. Hidden-tab time does not advance either presentation.

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

Keep the local frontend and backend running. Open both modes once before the talk and wait for preparation. The annual pack has nine PNGs (about 16 MiB); the radar pack has fifteen local assets (about 13 MiB). Prepared files persist under `database/processed/supplied-nisar`, and browser CacheStorage reuses them. Playback uses local, decoded images and cells; it does not fetch remote imagery while animating. The 3D terrain view and external metadata links can require internet access.

To prepare on another computer, place the same HDF5/report pair in the project root, install the project's Python dependencies, and run:

```powershell
npm run science:study
npm run imagery:cache -- --location=aletsch
npm run science:presentation
npm run dev
```

The last preparation command assembles the fixed radar context and the nine aligned annual images from authentic cached imagery. Retry preparation clears only the owned presentation browser cache and reloads local artifacts. Original HDF5/PDF files remain intact.

## Verification

All **65 automated tests pass**, and the production build passes. Tests cover actual-image transition timing, exact acquisition seeks, fixed reference pixels, smooth source-image blending, registration/camera geometry, source validation, cache reopening and artifact restrictions, alongside all existing backend, imagery, saved-view and radar tests. The annual render check verified every PNG and native-crop SHA-256 and confirmed that the fixed reference does not change. Local HTTP checks returned complete, fingerprint-matched annual images. Ready-state React checks verified one timeline per mode and the removal of duplicate page entries.

Native CPU canvas rendering is a scientific artifact check, not a browser FPS or interaction measurement. No browser is connected to this session, so responsive layout, drag gestures, fullscreen and projector performance still need a live rehearsal. Source render artifacts are in `database/processed/presentation-checks`; `glacier-change-comparison.png` is an annotated 2018/2026 image comparison suitable for a backup slide.
