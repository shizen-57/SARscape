export const RADAR_COLORS = {negative:'#f5a466',zero:'#f4f0e9',positive:'#67d5e6'}

export function radarDateMilliseconds(date) {
 if (typeof date !== 'string') return NaN
 // NISAR identification timestamps are UTC, sometimes with nanoseconds and no Z.
 const normalized = date.replace(/(\.\d{3})\d+/, '$1')
 return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalized) ? normalized : normalized+'Z')
}

// GOFF rates were derived by dividing metre offsets by this exact pair duration.
export function radarDisplayValue(rate, mode, pairDays) {
 if (typeof rate !== 'number' || !Number.isFinite(rate)) return null
 if (mode === 'rate') return rate
 if (!Number.isFinite(pairDays) || pairDays <= 0) return null
 return rate * pairDays
}

export function radarDisplaySummary(features, component, mode, pairDays) {
 const values = features.map(f => radarDisplayValue(f.properties?.[component], mode, pairDays)).filter(v => v !== null)
 const magnitudes = values.map(Math.abs).sort((a,b) => a-b)
 // Display saturation is independent of the original measurements and quality mask.
 const scale = magnitudes.length ? Math.max(0.001, magnitudes[Math.floor((magnitudes.length-1)*0.95)]) : null
 return {scale,count:values.length}
}

export function completedRadarJobs(jobs) {
 return jobs.filter(j => {
  const p = j.provenance
  return j.status === 'complete' && p && Number.isFinite(p.pairDays) && p.pairDays > 0 && Number.isFinite(radarDateMilliseconds(p.referenceDate)) && radarDateMilliseconds(p.secondaryDate) > radarDateMilliseconds(p.referenceDate)
 }).sort((a,b) => b.provenance.referenceDate.localeCompare(a.provenance.referenceDate))
}
