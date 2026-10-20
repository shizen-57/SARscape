import {radarDateMilliseconds} from './radar-display.mjs'

// Slate midpoint stays legible on both white ice and dark rock; only larger values carry strong colour.
export const MOTION_STOPS = {
 components:[[-1,[240,128,40]],[0,[150,160,174]],[1,[30,170,200]]],
 flow:[[0,[150,160,174]],[0.5,[76,176,214]],[1,[14,84,140]]]
}

// Only the two acquisitions are observations; every frame between them is interpolated.
export function pairFrame(progress, referenceDate, secondaryDate) {
 const a = radarDateMilliseconds(referenceDate), b = radarDateMilliseconds(secondaryDate)
 if (!Number.isFinite(a) || !(b > a)) return null
 const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
 const kind = p <= 0.0005 ? 'reference' : p >= 0.9995 ? 'secondary' : 'interpolated'
 const date = new Date(kind === 'reference' ? a : kind === 'secondary' ? b : a + (b - a) * p).toISOString()
 return {date, kind, observed: kind !== 'interpolated', label: kind === 'reference' ? 'NISAR acquisition · reference' : kind === 'secondary' ? 'NISAR acquisition · secondary' : 'Interpolated · not observed'}
}

export const motionCells = preview => (preview?.cells ?? []).map(row => Object.fromEntries(preview.cellFields.map((key, i) => [key, row[i]])))

// m/day value that colours a cell: estimated speed when flow is resolved, otherwise the chosen component.
export function motionValue(cell, preview, component) {
 if (preview?.status === 'flow') return Number.isFinite(cell.east) && Number.isFinite(cell.north) ? Math.hypot(cell.east, cell.north) : null
 const value = cell[component]
 return Number.isFinite(value) ? value : null
}

// Ground-plane vector in m/day for particles. Components move along their own radar axis, never a flow direction.
export function motionVector(cell, preview, component) {
 if (preview?.status === 'flow') return Number.isFinite(cell.east) && Number.isFinite(cell.north) ? [cell.east, cell.north] : null
 const axis = preview?.geometry?.[component === 'alongTrack' ? 'alongTrackAxis' : 'groundRangeAxis'], value = cell[component]
 return axis && Number.isFinite(value) ? [axis[0] * value, axis[1] * value] : null
}

export function displayScale(values) {
 const sorted = values.filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b)
 return sorted.length ? Math.max(0.001, sorted[Math.floor((sorted.length - 1) * 0.95)]) : null
}

// Largest 1-2-5 factor that keeps the 95th-percentile pair travel within the target distance.
export function travelExaggeration(scale, pairDays, target = 480) {
 if (!(scale > 0) || !(pairDays > 0)) return 1
 const raw = target / (scale * pairDays)
 if (raw <= 1) return 1
 const power = 10 ** Math.floor(Math.log10(raw * (1 + 1e-9))), step = [5, 2, 1].find(s => s * power <= raw * (1 + 1e-9))
 return step * power
}

export function motionColor(value, scale, mode) {
 const stops = MOTION_STOPS[mode === 'flow' ? 'flow' : 'components']
 const t = mode === 'flow' ? Math.min(1, Math.max(0, value / scale)) : Math.min(1, Math.max(-1, value / scale))
 const i = Math.max(0, stops.findIndex(([at]) => at >= t) - 1), [a, ca] = stops[i], [b, cb] = stops[Math.min(stops.length - 1, i + 1)]
 const f = b === a ? 0 : (t - a) / (b - a)
 return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f)).join(',')})`
}

// Pixel (col,row) → lon/lat with the processor's fitted affine; cell centres sit at +0.5.
export const gridToLonLat = (affine, col, row) => [affine[0][0] + affine[0][1] * col + affine[0][2] * row, affine[1][0] + affine[1][1] * col + affine[1][2] * row]
export function lonLatToGrid(affine, lon, lat) {
 const [[a, b, c], [d, e, f]] = affine, det = b * f - c * e
 return [((lon - a) * f - c * (lat - d)) / det, (b * (lat - d) - e * (lon - a)) / det]
}

// Exaggerated pair-long paths through the displayed field; a particle stops at the edge of displayed cells.
export function particlePaths(preview, component, exaggeration, steps = 24, cells = motionCells(preview)) {
 const [rows, cols] = preview?.grid?.shape ?? [0, 0], posting = preview?.grid?.postingMetres ?? [80, 80]
 const lookup = new Map(cells.map(cell => [cell.row * cols + cell.col, cell]))
 const at = (col, row) => {const r = Math.floor(row), c = Math.floor(col);return r >= 0 && c >= 0 && r < rows && c < cols ? lookup.get(r * cols + c) : undefined}
 const days = preview?.pairDays ?? 0
 return cells.flatMap((seed, index) => {
  if (seed.row % 2 || seed.col % 2 || !motionVector(seed, preview, component)) return []
  // Deterministic jitter inside the seed cell avoids an artificial lattice.
  const jitter = k => {const v = Math.sin(seed.row * 12.9898 + seed.col * 78.233 + k) * 43758.5453;return 0.5 + 0.8 * (v - Math.floor(v) - 0.5)}
  const path = [[seed.col + jitter(0), seed.row + jitter(1)]]
  for (let k = 0; k < steps; k++) {
   const [col, row] = path.at(-1), cell = at(col, row), vector = cell && motionVector(cell, preview, component)
   const next = vector ? [col + vector[0] * days * exaggeration / posting[0] / steps, row - vector[1] * days * exaggeration / posting[1] / steps] : [col, row]
   path.push(at(...next) ? next : [col, row])
  }
  return [{seed, index, path}]
 })
}

// Everything the map and legend share for one preview and component choice.
// Smallest 1-2-5 step at or above x, so a legend reads 0.82 → 1, 3.1 → 5.
export function niceCeil(x) {
 const power = 10 ** Math.floor(Math.log10(x * (1 + 1e-9)))
 return [1, 2, 5, 10].find(step => step * power >= x * (1 - 1e-9)) * power
}

export function motionScene(preview, component, contrast = 1) {
 const cells = motionCells(preview), values = cells.map(cell => motionValue(cell, preview, component))
 // Components keep one legend across acquisition pairs. Flow starts at 300 m/year, which suits a slow Alpine
 // glacier, and widens to the data's 95th-percentile speed so a fast glacier (Columbia, metres per day) is not all one colour.
 // Saturation never changes the measurements.
 const slow = 300 / 365.25, p95 = displayScale(values) ?? 0, flowScale = p95 > slow ? niceCeil(p95) : slow
 const scale = values.some(Number.isFinite) ? (preview.status === 'flow' ? flowScale : 1.5) / Math.max(1, contrast) : null
 const vectors = cells.map(cell => motionVector(cell, preview, component)).filter(Boolean).map(([e, n]) => Math.hypot(e, n))
 const exaggeration = travelExaggeration(displayScale(vectors), preview.pairDays)
 return {mode: preview.status === 'flow' ? 'flow' : 'components', cells, values, scale, exaggeration, paths: vectors.length ? particlePaths(preview, component, exaggeration, 24, cells) : []}
}

export function pointOnPath(path, progress) {
 const x = Math.min(1, Math.max(0, progress)) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(x)), f = x - i
 return path.length < 2 ? path[0] : [path[i][0] + (path[i + 1][0] - path[i][0]) * f, path[i][1] + (path[i + 1][1] - path[i][1]) * f]
}
