import type {Polygon,MultiPolygon,FeatureCollection,Feature} from 'geojson'
export type SurfaceMode='velocity'|'change'|'extent'|'elevation'
export type SurfaceFrame={id:string;kind:'velocity'|'elevation';date:string;start:string;end:string;label:string;source:string;sourceUrl:string;sensor:string;units:string;coverage:number;maskYear:number;image:string;grid:string;raster:string;intervalDays:number;interpretation:string}
export type SurfaceManifest={available:boolean;scenario:string;coordinates:[[number,number],[number,number],[number,number],[number,number]];bounds3857:[number,number,number,number];shape:[number,number];velocityScale:[number,number];frames:SurfaceFrame[];elevation:{available:boolean;geometryAvailable?:boolean;reason:string};reason?:string}
export type SurfaceGrid={shape:[number,number];bounds3857:[number,number,number,number];speed:(number|null)[];elevationChange?:(number|null)[];error:(number|null)[];vx:(number|null)[];vy:(number|null)[];vectorCrs:string}
export type GlacierOutline=Feature<Polygon|MultiPolygon,{year:number;outlineYear?:number;areaKm2:number;source:string;sourceUrl:string;license:string;acquisitionLabel:string;limitation?:string}>
export type SurfaceScene={scenario:string;mode:SurfaceMode;manifest:SurfaceManifest;frame?:SurfaceFrame;grid?:SurfaceGrid;baseline?:SurfaceFrame;baselineGrid?:SurfaceGrid;outlines:FeatureCollection<Polygon|MultiPolygon,GlacierOutline['properties']>;outlineIndex:number;opacity:number}
export const VELOCITY_STOPS:[number,number[]][]
export const CHANGE_STOPS:[number,number[]][]
export function surfaceColor(value:number,range:[number,number],stops?:[number,number[]][]):number[]
export function differenceGrid(current:SurfaceGrid|undefined,baseline:SurfaceGrid|undefined):(number|null)[]|null
export function mercator(lon:number,lat:number):[number,number]
export function surfaceCell(grid:SurfaceGrid,lon:number,lat:number):{index:number;speed:number|null;error:number|null;vx:number|null;vy:number|null}|null
export function insideOutline(point:[number,number],geometry:Polygon|MultiPolygon):boolean
