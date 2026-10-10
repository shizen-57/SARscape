import type {Cell,PresentationContext,SignalModel} from './nisar-presentation.mjs'
type Base={width:number;height:number;context:PresentationContext;model:SignalModel;view:'radar'|'geographic'}
export type Marker={cell:Cell;x:number;y:number}
export function geographicTransform(width:number,height:number,bounds:number[]):{a:number;b:number;c:number;d:number;project:(world:number[])=>number[]}
export function radarPosition(cell:Cell,progress:number,width:number,height:number,model:SignalModel):number[]
export function drawBase(ctx:CanvasRenderingContext2D,options:Base&{image:CanvasImageSource;extent:number[]}):void
export function drawSignal(ctx:CanvasRenderingContext2D,options:Base&{progress:number;selected:Cell|null;chapter:number;reveal:number}):Marker[]
export function pickCell(markers:Marker[],x:number,y:number,radius?:number):Cell|null
