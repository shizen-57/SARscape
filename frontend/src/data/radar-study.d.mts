export const STUDY_COLUMNS:Record<string,number>
export function acceptedCells(cells:(number|null)[][],threshold:number):(number|null)[][]
export function summaryStats(values:(number|null)[]):{count:number;min:number;max:number;median:number;p05:number;p95:number}|null
export function interpolateOffset(offset:number,progress:number):number
export function histogram(values:(number|null)[],bins?:number):{bins:number[];min:number;max:number}
