import type {Study,LayerData} from '../components/RadarStudy'
export type Cell=(number|null)[]
export type PresentationContext={version:number;sourceSha256:string;radarReferenceDate:string;radarSecondaryDate:string;image:string;imageSha256:string;crs:string;bounds:number[];width:number;height:number;frameId:string;date:string;metadataUrl:string;attribution:string;method:string}
export type SignalPoint={cell:Cell;world:number[];value:number;t:number}
export type SignalModel={cells:Cell[];stats:{count:number;min:number;max:number;median:number;p05:number;p95:number}|null;scale:number;index:number;representative:Cell|null;along:SignalModel['stats'];slant:SignalModel['stats'];aScale:number;sScale:number;points:SignalPoint[];groups:{negative:boolean;t:number;points:SignalPoint[]}[]}
export type StoryState={chapter:number;progress:number;threshold:number;view:'geographic'|'radar';reveal:number}
export const CHAPTERS:{id:string;label:string;title:string;text:string;duration:number}[]
export const GUIDE_DURATION:number
export function chapterPreset(chapter:number):StoryState
export function guideState(fraction:number):StoryState
export function mercator(lon:number,lat:number):number[]
export function representativeCell(cells:Cell[]):Cell|null
export function cellKey(cell:Cell|null):string|null
export function createSignalModel(data:LayerData,threshold:number,component?:string):SignalModel
export function validatePresentation(study:Study,context:PresentationContext,layers:Record<string,LayerData>):void
