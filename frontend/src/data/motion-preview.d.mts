import type {MultiPolygon,Polygon} from 'geojson'
export type MotionCell={row:number;col:number;alongTrack:number|null;slantRange:number|null;east:number|null;north:number|null;confidence:number|null;support:number;correlation:number|null;measured:boolean;rawAlongTrack:number|null;rawSlantRange:number|null;rawCorrelation:number|null}
export type MotionPreview={
 version:number;status:'flow'|'components'|'unavailable';reason:string;units:string;pairDays:number;referenceDate:string;secondaryDate:string;layer:string;polarization:string;validated:false;measured:string;estimated:string
 cellFields:string[];cells:(number|boolean|null)[][]
 grid?:{epsg:number;shape:[number,number];postingMetres:[number,number];corners:[number,number][];lonLatAffine:[[number,number,number],[number,number,number]];outlinePixels:number[][][]|number[][][][]}
 outline?:{geometry:Polygon|MultiPolygon;name:string;sgiId?:string;outlineYear?:number;source:string;sourceUrl:string;license:string;citation:string;limitation:string;mask:string}
 geometry?:{available:boolean;reason?:string;alongTrackAxis?:[number,number];groundRangeAxis?:[number,number];headingDeg?:number;rangeIncreaseAzimuthDeg?:number;incidenceDeg?:number;referenceHeightMetres?:number;unitVectorChange1500To3500m?:number;source?:string;assumptions?:string[]}
 stableGround?:{alongTrack:number;slantRange:number;support:number;candidates:number;spread:[number,number];noiseFloor:{alongTrack:number|null;slantRange:number|null;speed:number|null}}
 quality?:{grade:'low'|'moderate'|'good';reasons:string[];coverage:number;medianCorrelation:number|null;signalToNoise:{alongTrack:number|null;slantRange:number|null;speed:number|null};flowDirectionResolved:boolean}
 filters?:{id:string;label:string;cells:number}[]
 method?:{plausibleRateMetresPerDay:number;window:number;minimumSupport:number;signalRatio:number;minimumCoverage:number;confidence:string;medianTest:{threshold:number;epsilon:number;minimumNeighbours:number;reference:string}}
}
export type PairFrame={date:string;kind:'reference'|'interpolated'|'secondary';observed:boolean;label:string}
export const MOTION_STOPS:{components:[number,number[]][];flow:[number,number[]][]}
export function pairFrame(progress:number,referenceDate:string,secondaryDate:string):PairFrame|null
export function motionCells(preview:MotionPreview|null|undefined):MotionCell[]
export function motionValue(cell:MotionCell,preview:MotionPreview,component:'alongTrack'|'slantRange'):number|null
export function motionVector(cell:MotionCell,preview:MotionPreview,component:'alongTrack'|'slantRange'):[number,number]|null
export function displayScale(values:(number|null)[]):number|null
export function travelExaggeration(scale:number|null,pairDays:number,target?:number):number
export function motionColor(value:number,scale:number,mode:'flow'|'components'|'unavailable'):string
export function gridToLonLat(affine:[[number,number,number],[number,number,number]],col:number,row:number):[number,number]
export function lonLatToGrid(affine:[[number,number,number],[number,number,number]],lon:number,lat:number):[number,number]
export type ParticlePath={seed:MotionCell;index:number;path:[number,number][]}
export function particlePaths(preview:MotionPreview,component:'alongTrack'|'slantRange',exaggeration:number,steps?:number,cells?:MotionCell[]):ParticlePath[]
export type MotionScene={mode:'flow'|'components';cells:MotionCell[];values:(number|null)[];scale:number|null;exaggeration:number;paths:ParticlePath[]}
export function motionScene(preview:MotionPreview,component:'alongTrack'|'slantRange',contrast?:number):MotionScene
export function pointOnPath(path:[number,number][],progress:number):[number,number]
