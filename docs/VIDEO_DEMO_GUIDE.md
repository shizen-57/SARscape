# SARscape demo walkthrough

The in-app **Demo tour** arranges the existing features into a presenter-led
story. It changes the map to the relevant real dataset and gives a short “show”
cue and narration line for each chapter. It does not record or generate a video;
the presenter controls the pace and makes the recording separately. Aim for a
3½–4 minute edited video; showing every interaction without cuts usually takes
4–6 minutes because imagery and measurement layers need time to load.

## Prepare the scene

1. Open SARscape and wait for the terrain and imagery to finish drawing.
2. Choose **Demo tour** in the top bar. The tour starts with the globe and
   prepares one scene at a time as you select **Next chapter**.
3. Pause on each map change until its imagery or measurement layer is fully
   visible. The first uncached requests can take longer than later steps.
4. Read or adapt the on-screen **Say** line. The **Show** line tells you which
   map action to perform; playback, camera movement, point inspection and panel
   exploration remain under your control.

## Full walkthrough

| Chapter | What to show | Suggested narration |
| --- | --- | --- |
| 1 · Orient | Rotate the 3D globe, then go to the Alps. | “SARscape connects satellite observations to the places and landforms they describe.” |
| 2 · Real imagery | Show Aletsch’s sharp Swiss aerial mosaic and move through available mosaic versions. | “These are real aerial mosaics. Their year labels describe mosaic versions; flight dates can vary by location.” |
| 3 · Change through time | Show Manchar’s swipe comparison, then press Play to advance through the dated captures. | “The four Sentinel-2 captures show the 2022 floodplain on actual acquisition dates. They are optical images—not NISAR or water-depth measurements.” |
| 4 · Scientific surface | Return to Aletsch. Scrub ITS_LIVE velocity intervals, choose speed change, and click a measured map cell. | “This continuous surface shows published interval-mean glacier speed. The terrain stays fixed, and cells without accepted measurements remain gaps.” |
| 5 · NISAR GCOV | Step through real radar acquisition dates and show the date, track and colour legend. | “NISAR radar appearance responds to surface scattering. Changes can reflect snow wetness, moisture or roughness—not necessarily melting.” |
| 6 · NISAR GOFF | Show a processed pair, components, quality notes and provenance. | “GOFF provides radar components for a date pair. This preview still needs independent glacier validation before it can be called verified glacier speed.” |
| 7 · Exploration tools | Open **Imagery**. Adjust highlights or colour, save a useful camera view, and export observation provenance. | “Display adjustments change only the view. The original scientific data and image provenance stay intact.” |
| 8 · Traceability | Open **Data & sources** and show source records, dates and interpretation notes. | “Each view has a source and a boundary on what it can prove. Dated imagery, reference imagery, ITS_LIVE and NISAR remain distinct.” |

For a shorter cut, keep chapters 1, 2, 4, 6 and 8. For a full project
demonstration, include the dated Manchar comparison, GCOV sequence, image tools,
and source records as well.

## Keep the science clear

- Do not say the glacier physically shrinks or deforms in the 3D scene. The
  terrain elevation is fixed; velocity, elevation-change-rate and radar layers
  are separate observations or derived measurements.
- ITS_LIVE supplies the prepared historical velocity intervals; it is not a
  NISAR product. NISAR GCOV appearance and GOFF processing are separate flows.
- Swiss aerial mosaic years are not exact acquisition dates at every location.
  Do not present undated reference imagery as a dated change observation.
- Do not call radar colours natural-colour photographs, direct melt measurements,
  or a validated hazard probability. The application has no validated hazard
  score.
- Keep quality warnings and gaps visible. Do not imply that a sparse or rejected
  measurement covers the whole glacier.

## Current data and recording note

The local API check on October 11, 2026 returned four study areas, eight Aletsch
optical frames, five prepared Aletsch surface frames, four stored NISAR
processing jobs, and 15 GCOV observations. This confirms local availability,
not independent scientific validation or guaranteed access to upstream imagery.
Development logs also recorded transient imagery timeouts and a tile-rendering
502; wait until each selected view is fully drawn before recording it.
