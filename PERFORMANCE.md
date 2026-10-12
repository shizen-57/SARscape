# Offline performance optimization review

Reviewed and verified on 2026-10-11. The application, development servers,
backend services and browser previews were not started during this work.

## Implemented changes

| Area | Change | Expected benefit |
| --- | --- | --- |
| Persistent response cache | Retain recently used payloads within 32 entries and a 16 MiB serialized-payload budget. Oversized payloads still persist in SQLite. | Less retained payload memory, with hot entries reused. |
| Database housekeeping | Sweep expired rows at most once per minute when writing. Reads enforce expiry immediately. | Fewer synchronous database deletes during tile processing. |
| Optical tiles | Share the entire cache lookup/render/write job for simultaneous requests for the same tile; avoid a second decoded-byte copy. | Fewer duplicate reads, renders and allocations. |
| COG byte ranges | Share matching in-flight chunks across overlapping requests; refresh chunk recency on hits within the existing 32 MiB chunk budget. | Fewer repeated upstream range downloads. |
| Background warming | Skip unchanged plans; warm up to four nearest observations and 48 visible tile templates, serially at low priority after an idle delay. | Less competing background traffic and repeated work. |
| Response consumption | Drain successful preload response streams in chunks and close them on cancellation. | Avoid another whole-image buffer allocation. |
| Terrain and boundaries | Separate terrain/style changes from timeline updates; resend boundary geometry only when bounds or the actual source change. | Fewer unnecessary source updates and worker messages. |
| Globe overlays | Change visibility of existing GCOV, radar and surface layers; preserve sources and textures through globe transitions. Close popups on those transitions and release popup tracking on cleanup. | Avoid repeated image preparation, feature cloning and layer reconstruction. |

The payload budget is not a total heap limit. Parsed objects, in-flight response
buffers, browser HTTP caches and GPU textures require additional memory.

## Preserved behavior

- Foreground imagery selection, source URLs, zoom limits, tile sizes, resampling,
  image adjustments and frame transitions remain unchanged.
- No imagery downsampling, lossy re-encoding or scientific-value quantization was
  introduced. Original data, acquisition metadata and provenance were untouched.
- Cache keys continue to distinguish observation dates. Dated observations and
  undated reference imagery retain their existing labels and processing paths.
- Navigation, observation/scenario changes, hidden tabs, globe/GCOV transitions
  and unmounting retain preload cancellation. Empty plans start no warming.
- Cache errors release shared jobs for retry; incomplete ranges and invalid PNG
  output retain validation. All frontend/backend/database directories remain.

## Offline verification

- All 66 regression tests passed, including scientific processing fixtures,
  provenance, timeline, comparison, preloading and cache tests.
- TypeScript compilation, frontend production build and backend Worker build
  passed. The production build required execution outside the filesystem sandbox
  after its source-file lookup was blocked; it did not start services.
- `git diff --check` passed.
- Focused tests verify exact PNG and byte-range equality, persistent cache reopen,
  immediate expiry with throttled sweeps, LRU eviction, failure recovery,
  date isolation, serial warming, response-stream cancellation, queue bounds,
  changed coverage and initialization of recreated comparison sources.

Operation-count evidence from controlled tests: eight simultaneous tile-cache
hits share one lookup; two overlapping COG requests fetch three distinct chunks;
100 identical coverage updates produce one geometry upload. These are offline
test results, not application speed or frame-rate measurements.

## Runtime verification remaining

When running the application is authorized, verify:

1. Cold/warm date changes, playback and rapid seeking on both maps; confirm the
   displayed pixels and acquisition labels agree after loading or retrying.
2. Browser HTTP cache reuse and foreground request priority while navigating;
   confirm hidden tabs and navigation stop obsolete preload traffic.
3. Globe return, terrain toggles, comparison, overlay visibility and popups,
   including GCOV, glacier surfaces, radar samples and image adjustments.
4. Native imagery detail at every zoom and contrast at coverage boundaries.
5. Long-session heap/GPU memory and interaction frame rates across repeated
   glacier/date changes, overlay switches and comparison open/close cycles.

Record comparable cold/warm timings, transfer counts and memory/FPS readings
before making measured performance claims. No such runtime claims are made here.
