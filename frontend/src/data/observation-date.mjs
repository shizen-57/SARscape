export function hasDisplayDate(frame) {
 if (frame?.datePrecision === 'mosaic-year') return /^\d{4}$/.test(frame.date)
 if (!frame || frame.datePrecision === 'undated' || !/^\d{4}-\d{2}-\d{2}T/.test(frame.date ?? '')) return false
 return Number.isFinite(Date.parse(frame.date))
}
