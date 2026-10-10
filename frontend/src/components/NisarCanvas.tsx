import {useLayoutEffect,useRef,useState} from 'react'
import {drawBase,drawSignal,pickCell,type Marker} from '../data/nisar-renderer.mjs'
import type {Cell,SignalModel,PresentationContext} from '../data/nisar-presentation.mjs'

export default function NisarCanvas({image,context,extent,model,progress,selected,view,chapter,reveal,onSelect,onCanvas}:{image:HTMLImageElement;context:PresentationContext;extent:number[];model:SignalModel;progress:number;selected:Cell|null;view:'radar'|'geographic';chapter:number;reveal:number;onSelect:(cell:Cell)=>void;onCanvas:(canvas:HTMLCanvasElement|null)=>void}){
 const root=useRef<HTMLDivElement>(null),base=useRef<HTMLCanvasElement>(null),field=useRef<HTMLCanvasElement>(null),markers=useRef<Marker[]>([])
 const [size,setSize]=useState({width:800,height:560,dpr:1})
 useLayoutEffect(()=>{const measure=(width:number,height:number)=>setSize({width:Math.max(120,width),height:Math.max(120,height),dpr:Math.min(2,devicePixelRatio||1)}),bounds=root.current!.getBoundingClientRect();measure(bounds.width,bounds.height);const observer=new ResizeObserver(([entry])=>measure(entry.contentRect.width,entry.contentRect.height));observer.observe(root.current!);return()=>observer.disconnect()},[])
 // Paint in the same commit as dates and traces, before the browser presents
 // the frame. Static texture remains separate from the moving measurement field.
 useLayoutEffect(()=>{for(const canvas of [base.current!,field.current!]){canvas.width=Math.round(size.width*size.dpr);canvas.height=Math.round(size.height*size.dpr);canvas.getContext('2d')?.setTransform(size.dpr,0,0,size.dpr,0,0)};onCanvas(field.current)},[size,onCanvas])
 useLayoutEffect(()=>{const ctx=base.current?.getContext('2d');if(ctx)drawBase(ctx,{...size,context,image,model,view,extent})},[size,context,image,model.aScale,model.sScale,view,extent])
 useLayoutEffect(()=>{const ctx=field.current?.getContext('2d');if(ctx)markers.current=drawSignal(ctx,{...size,context,model,progress,selected,view,chapter,reveal})},[size,context,model,progress,selected,view,chapter,reveal])
 return <div ref={root} className="nisar-canvas-stack"><canvas ref={base} aria-hidden="true"/><canvas ref={field} role="img" aria-label={view==='geographic'?'Fixed satellite context with georeferenced screened radar cells. Color encodes interpolated signed offset.':'Signed along-track and slant-range offsets in radar component space. Points interpolate between zero and measured endpoints.'} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect(),cell=pickCell(markers.current,(event.clientX-rect.left)/rect.width*size.width,(event.clientY-rect.top)/rect.height*size.height);if(cell)onSelect(cell)}}/><span className="nisar-canvas-note">{chapter===0?'Acquisition sequence · schematic scan':view==='geographic'?'Geographic positions stay fixed · color shows offset':'Radar component space · not a geographic motion vector'}</span></div>
}
