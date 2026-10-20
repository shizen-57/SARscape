// Prepares the Sentinel-2 study windows behind the map once, so the first visit is not a 10-50 s wait per capture.
// Needs the dev stack running (npm run dev). Usage: npm run warm:imagery [-- columbia aletsch ...] [--latest] [--detail]
import scenarios from '../database/scenarios.json' with {type: 'json'}
import manifest from '../database/imagery/sentinel2.json' with {type: 'json'}

const args = process.argv.slice(2), latestOnly = args.includes('--latest'), detail = args.includes('--detail')
const wanted = args.filter(a => !a.startsWith('--')), base = process.env.SARSCAPE_API ?? 'http://127.0.0.1:8787'
const tile = ([lng, lat], z) => {
  const n = 2 ** z, r = lat * Math.PI / 180
  return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)]
}
// The tile server builds one downsampled study window per zoom band (z9 -> 16x, z10 -> 8x, z11 -> 4x, z12 -> 2x);
// one centre tile per band is enough to build and cache it. --detail also builds the full-resolution (10 m) study window
// that z13 and closer read from; it is a much larger read per capture, so it is opt-in.
const bands = detail ? [9, 10, 11, 12, 13] : [9, 10, 11, 12]
for (const scenario of scenarios.scenarios.filter(s => !wanted.length || wanted.includes(s.id))) {
  const all = manifest.scenarios[scenario.id] ?? [], frames = latestOnly ? all.slice(-1) : all
  for (const frame of frames) {
    for (const z of bands) {
      const [x, y] = tile(scenario.center, z), started = performance.now()
      const response = await fetch(`${base}/api/imagery/tiles/${scenario.id}/${frame.id}/${z}/${x}/${y}.png`, {signal: AbortSignal.timeout(300000)}).catch(error => ({ok: false, status: error.name}))
      console.log(`${scenario.id} ${frame.id} z${z} ${response.ok ? 'ok' : `FAILED ${response.status}`} ${((performance.now() - started) / 1000).toFixed(1)}s`)
    }
  }
}
