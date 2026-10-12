import type {SurfaceGrid, GlacierOutline} from './glacier-surfaces.mjs'
export type MeasurementStats = {count:number;median:number;q25:number;q75:number}
export type SpeedChangeSummary = {status:'incompatible';reason:string} | {
  status:'ready'|'no-overlap';reason:string|null;matchedCells:number;baselineCells:number;currentCells:number;
  baseline:MeasurementStats|null;current:MeasurementStats|null;difference:MeasurementStats|null;
  baselineError:MeasurementStats|null;currentError:MeasurementStats|null
}
export function measurementStats(values:(number|null|undefined)[]):MeasurementStats|null
export function summarizeSurface(grid:SurfaceGrid|undefined,kind:'velocity'|'elevation'):{measurements:MeasurementStats|null;error:MeasurementStats|null}|null
export function summarizeSpeedChange(current:SurfaceGrid|undefined,baseline:SurfaceGrid|undefined):SpeedChangeSummary
export function summarizeMappedArea(current:GlacierOutline['properties']|undefined,baseline:GlacierOutline['properties']|undefined):{
  baselineKm2:number;currentKm2:number;differenceKm2:number;percent:number;sameInventory:boolean
}|null
