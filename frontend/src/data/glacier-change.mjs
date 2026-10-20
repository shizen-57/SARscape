// Descriptive summaries of supplied measurements, never hazard probabilities.
// Each cell has equal weight. These are not area-weighted glacier-wide estimates.
function validGrid(grid, field) {
  if (!grid || !Array.isArray(grid.shape) || grid.shape.length !== 2 ||
      !grid.shape.every(v => Number.isSafeInteger(v) && v > 0)) return false
  const bounds = grid.bounds3857
  return Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isFinite) &&
    bounds[0] < bounds[2] && bounds[1] < bounds[3] &&
    Array.isArray(grid[field]) && grid[field].length === grid.shape[0] * grid.shape[1]
}

export function measurementStats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return null
  const quantile = fraction => {
    const at = (sorted.length - 1) * fraction, lower = Math.floor(at), upper = Math.ceil(at)
    // Weighted endpoints avoid overflow when subtracting large opposite values.
    return sorted[lower] * (1 - (at - lower)) + sorted[upper] * (at - lower)
  }
  return {count: sorted.length, median: quantile(.5), q25: quantile(.25), q75: quantile(.75)}
}

export function summarizeSurface(grid, kind) {
  const field = kind === 'elevation' ? 'elevationChange' : 'speed'
  if (!validGrid(grid, field)) return null
  const values = grid[field].filter(v => Number.isFinite(v) && (kind === 'elevation' || v >= 0))
  const error = kind === 'velocity' ? measurementStats(grid[field].map((v, i) =>
    Number.isFinite(v) && v >= 0 && Number.isFinite(grid.error?.[i]) && grid.error[i] >= 0 ? grid.error[i] : null)) : null
  return {measurements: measurementStats(values), error}
}

export function summarizeSpeedChange(current, baseline) {
  if (!validGrid(current, 'speed') || !validGrid(baseline, 'speed') ||
      current.shape.some((v, i) => v !== baseline.shape[i]) ||
      current.bounds3857.some((v, i) => v !== baseline.bounds3857[i])) {
    return {status: 'incompatible', reason: 'The measurement grids do not match. No numerical comparison is available.'}
  }
  const a = [], b = [], delta = [], aError = [], bError = []
  let baselineCells = 0, currentCells = 0
  for (let i = 0; i < current.speed.length; i++) {
    const av = baseline.speed[i], bv = current.speed[i]
    const aValid = Number.isFinite(av) && av >= 0, bValid = Number.isFinite(bv) && bv >= 0
    if (aValid) baselineCells++
    if (bValid) currentCells++
    if (!aValid || !bValid || !Number.isFinite(bv - av)) continue
    a.push(av); b.push(bv); delta.push(bv - av)
    const ae = baseline.error?.[i], be = current.error?.[i]
    if (Number.isFinite(ae) && ae >= 0) aError.push(ae)
    if (Number.isFinite(be) && be >= 0) bError.push(be)
  }
  return {
    status: delta.length ? 'ready' : 'no-overlap',
    matchedCells: delta.length, baselineCells, currentCells,
    baseline: measurementStats(a), current: measurementStats(b), difference: measurementStats(delta),
    baselineError: measurementStats(aError), currentError: measurementStats(bError),
    reason: delta.length ? null : 'No locations have accepted measurements in both intervals. Missing cells are not filled.'
  }
}

export function summarizeMappedArea(current, baseline) {
  if (!current || !baseline || !Number.isFinite(current.areaKm2) || current.areaKm2 < 0 ||
      !Number.isFinite(baseline.areaKm2) || baseline.areaKm2 <= 0 ||
      !Number.isFinite(current.year) || !Number.isFinite(baseline.year)) return null
  const differenceKm2 = current.areaKm2 - baseline.areaKm2
  return {baselineKm2: baseline.areaKm2, currentKm2: current.areaKm2, differenceKm2,
    percent: differenceKm2 / baseline.areaKm2 * 100, sameInventory: current.year === baseline.year}
}
