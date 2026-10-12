import type {ScienceJob,GoffJob} from '../components/SciencePanel'
export const RADAR_COLORS:{negative:string;zero:string;positive:string}
export function radarDateMilliseconds(date:unknown):number
export function radarDisplayValue(rate:unknown,mode:'pair'|'rate',pairDays:number):number|null
export function radarDisplaySummary(features:{properties?:Record<string,unknown>|null}[],component:'alongTrack'|'slantRange',mode:'pair'|'rate',pairDays:number):{scale:number|null;count:number}
export function completedRadarJobs(jobs:ScienceJob[]):GoffJob[]
