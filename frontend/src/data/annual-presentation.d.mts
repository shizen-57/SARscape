export type AnnualFrame={id:string;date:string;image:string;imageSha256:string;inputSha256:string;cachedInput:string;metadataUrl:string;platform:string;cloudCover:number|null;sourceResolutionMeters:number}
export type AnnualManifest={version:number;scenario:string;crs:string;bounds:number[];width:number;height:number;frames:AnnualFrame[];method:string;attribution:string}
export type AnnualState={lower:number;upper:number;mix:number;observed:boolean;index:number}
export const ANNUAL_VIEWS:Record<string,{x:number;y:number;span:number}>
export function annualState(progress:number,count:number):AnnualState
export function annualCrop(width:number,height:number,manifest:AnnualManifest,view?:string,zoom?:number):{x:number;y:number;width:number;height:number}
export function validateAnnual(manifest:AnnualManifest):AnnualManifest
export function drawAnnual(ctx:CanvasRenderingContext2D,options:{width:number;height:number;manifest:AnnualManifest;images:HTMLImageElement[];state:AnnualState;baseline?:number;divider?:number;comparison?:string;view?:string;zoom?:number}):void
