# SARscape — project status and future to-dos

_Written 2026-10-10 from the repository, a fresh test run, and in-browser checks. Items I did not verify are marked **unverified**._

## 1. Where we stand

SARscape is a 3D glacier observation workspace for the NASA Space Apps challenge *Dancing with the SARs*. It has a polished front end, a working optical-imagery pipeline, and a NISAR radar-processing path now exercised against one real production file. Scientific interpretation remains unvalidated.

### What exists and works

| Area | State |
| --- | --- |
| **Landing page** (`/`) | Scrolling page over a real, continuously spinning Esri imagery globe. Sections: instruments, three glacier cards (the globe turns to each), how it works, closing call to action. Entering dives into the chosen glacier and fades into the explorer. |
| **Explorer** (`/#explore`) | Full-width 3D terrain map. A floating tool rail (Glaciers, Imagery, Map layers, About the data) opens one collapsible glass panel at a time. Dark theme: black and gray surfaces with a cyan accent. |
| **Imagery** | Aletsch: eight year-labelled SWISSIMAGE aerial mosaics (2018–2025, about 25 cm). Langtang and Columbia: undated Esri reference imagery. Playback, Change lens, Swipe, Blink, Look closer, image adjustments, globe view, saved views, and provenance export. |
| **Backend** | Hono API, Python/GDAL tile renderer, SQLite cache, queued GOFF processing. |
| **NISAR catalog** | Real ASF GOFF granule metadata is discovered live. |
| **GOFF processing** | Import, validation (units, grid, pair interval), quality screening, along-track and slant-range rates, 1σ uncertainty, GeoJSON samples, and a 16-bit display preview. One real production Aletsch file passed the production API code path and ten source-to-output checks; glacier-motion interpretation is unvalidated. |

### Honest boundary (keep visible everywhere)

- **One user-supplied real production NISAR GOFF file has been processed.** The September 23–October 5, 2026 Aletsch study crop produced 1,112 of 13,272 cells passing the declared correlation 0.3 screening. The source-to-output checks passed, but low correlation and large component rates require spatial outlier review, stable-ground bias assessment, and independent scientific validation. The crop includes terrain beyond the glacier. Browser display of this observation is still unverified.
- Optical imagery shows appearance. It does not measure velocity or elevation change, and terrain is fixed.
- Only **Aletsch** has a dated image sequence. The other two glaciers cannot show change over time.

### Repository and quality

- Branch `space-voyage-ui-kit-implementation` is pushed (commit `08137c0`). **No pull request has been opened**, and `main` is still at `0a1e3bf`.
- Type check passes and the production build succeeds.
- Tests: **22 of 23 pass**. The failure is `tests/prefetch.test.mjs` ("warming caches identical tile URLs serially"). It passes alone but fails in the full parallel run; it predates the landing work. A separate session was started to fix it, and that fix is **not on this branch**.
- Untracked and not committed: `graphify-out/` (generated knowledge graph) and `.claude/` (local tool settings and a worktree).

## 2. Must-do next (before judging or submission)

Ordered by impact on a judge's experience.

1. **Verify and interpret the real-data result.** The production processing code and artifact APIs have now completed one real GOFF observation, with ten source-to-output checks. Start or restart the local backend, open Aletsch's Data & sources, and inspect the saved September 23–October 5 observation in the 3D map. Capture the display and perform spatial outlier review, stable-ground bias assessment, and independent validation before claiming glacier movement.
2. **Open the pull request and merge the branch** after the checks below, so `main` has the landing page.
3. **Fix or merge the flaky prefetch test** so `npm test` is green. Merge the other session's fix, or stabilise the timing in the test.
4. **Re-run the Playwright checks** (`scripts/check-aerial-view.mjs`, `check-change-view.mjs`, `check-observations.mjs`). They were updated for the new `/#explore` entry and tool panels but **have not been run**. Expect them to need the full dev stack and several minutes.
5. **Dark-theme visual QA.** I reviewed the explorer, the Glaciers and Imagery panels, the globe view, and the phone layout. **Unverified:** the Data & sources sheet, Saved views, comparison lens and Swipe, the capture inspector, the radar panel, and error and loading banners. Check contrast and any leftover light surfaces.
6. **Responsive check of the new landing page.** Verified at 1353 px wide and 375 px phone. **Unverified:** tablet (about 768 px), short landscape phones, very wide screens, and a reduced-motion pass.
7. **Tighten landing copy.** The hero line says "Watch glaciers change through genuine aerial and satellite imagery", which fits Aletsch only. Say so, or soften it.
8. **Reliability on first load.** Imagery depends on third-party services (Esri, swisstopo, Mapterhorn) and on the backend running. Before any demo, start with `npm run dev` and wait for the first capture. Consider one automatic retry for a failed tile before the red banner appears.

## 3. Science and data to-dos

- [x] Process a real production GOFF granule through the import API code, queue, and artifact APIs; verify ten source-to-output checks.
- [ ] Verify the imported real radar observation in the browser and independently validate its interpretation (see §2.1).
- [ ] Independently validate radar components, quality screening, uncertainty, and stable-ground bias correction.
- [ ] Validate the 16-bit preview's aggregation and precision against a real glacier granule and a task-specific error budget.
- [ ] Acquire dated, high-resolution imagery for **Langtang** and **Columbia** (Swiss aerial covers Aletsch only).
- [ ] Decide whether to restore Sentinel-2 as a displayed source. The code and manifest still exist, but the explorer shows aerial and reference imagery only.
- [ ] Deploy a dedicated raster and science backend if online delivery is required. The hosted Worker build cannot run Python, GDAL, or durable jobs.

## 4. Polish ideas worth doing if time allows

- Pause the landing globe spin when the page is scrolled away or the tab is hidden (the browser pauses hidden tabs already; offscreen use is not paused).
- Add a short sequence or screenshot of a real radar result to the landing page once item §2.1 is done. That would be the strongest single thing for judges.
- Add keyboard and screen-reader checks for the new rail and panels (focus order, Escape behaviour).
- Show a brief loading state for the globe while its first tiles arrive.
- Add a simple automated test for the landing flow (Start exploring → `#explore`, brand → landing).

## 5. Housekeeping

- [ ] Add `graphify-out/` and `.claude/` to `.gitignore`, or commit them deliberately.
- [ ] Refresh the docs, which have drifted:
  - `README.md` does not mention the landing page or the tool rail, and still names Sentinel-2 as the main timeline.
  - `TODO.md` still lists "Explore previews" and Sentinel-2 items that were later removed.
  - `PRODUCT.md` still says synthetic layers were requested.
- [ ] Decide what to do with the extra branch and worktree `claude/awesome-panini-52052d` (it points at the same commit as `main`).
- [ ] Consider adding the Karpathy guidelines you shared to the project `CLAUDE.md` so they apply in every session.

## 6. Deferred by you (not for now)

- Wetlands and flooding in Bangladesh, starting with the Sundarbans (GCOV with tidal context).
- Forest and land-cover change (GCOV with independent disturbance evidence).
- **Reminder:** you asked to revisit these on **October 10, 2026 at 10:00 AM Dhaka time**. That is today, and a chat automation was set up for it.

## 7. Quick reference

```bash
npm install
npm run dev     # UI 5173, API 8787, raster worker 8788
npm test        # 22/23 pass today
npm run build
```

Design system: `DESIGN.md`. Real-science plan: `SOLUTION_PLAN.md`. Open-source reuse: `OPEN_SOURCE.md`.
