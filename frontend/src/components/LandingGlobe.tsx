import {useEffect,useRef,useState} from 'react'
import * as maplibregl from 'maplibre-gl'
import type {StyleSpecification} from 'maplibre-gl'

// Real Esri World Imagery on a MapLibre globe. Spinning is a continuous longitude change,
// so it never jumps back to a start frame the way a looping video does.
// Without a zoom the globe only turns, keeping its full disc inside the canvas.
export type GlobeFocus={center:[number,number];zoom?:number;duration:number}|null
const IMAGERY='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const DEG_PER_MS=360/120000 // one full turn every two minutes
const LAT=18
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
// Globe radius in CSS px is 512·2^z / 2π, so this zoom makes the globe fill the container width.
const fitZoom=(el:HTMLElement)=>Math.log2(el.clientWidth/2/(512/(2*Math.PI)))
const style={version:8,projection:{type:'globe'},sources:{earth:{type:'raster',tiles:[IMAGERY],tileSize:256,maxzoom:18}},layers:[{id:'earth',type:'raster',source:'earth'}],sky:{'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,5,1,7,0]}} as StyleSpecification

export default function LandingGlobe({focus}:{focus:GlobeFocus}){
 const el=useRef<HTMLDivElement>(null),map=useRef<maplibregl.Map|null>(null),spinning=useRef(true),[failed,setFailed]=useState(false)
 useEffect(()=>{
  const container=el.current!
  let m:maplibregl.Map
  try{m=new maplibregl.Map({container,style,center:[20,LAT],zoom:fitZoom(container),interactive:false,attributionControl:false,pixelRatio:Math.min(devicePixelRatio,1.5)})}catch{setFailed(true);return}
  map.current=m
  let frame=0,last=performance.now()
  const tick=(now:number)=>{
   if(spinning.current&&!reduced()){const lng=m.getCenter().lng-(now-last)*DEG_PER_MS;m.jumpTo({center:[((lng+540)%360)-180,LAT]})}
   last=now;frame=requestAnimationFrame(tick)
  }
  frame=requestAnimationFrame(tick)
  const resize=new ResizeObserver(()=>{m.resize();if(spinning.current)m.setZoom(fitZoom(container))});resize.observe(container)
  return()=>{cancelAnimationFrame(frame);resize.disconnect();m.remove();map.current=null}
 },[])
 useEffect(()=>{
  const m=map.current;if(!m)return
  if(focus){spinning.current=false;m.flyTo({center:focus.center,zoom:focus.zoom??fitZoom(el.current!),duration:reduced()?0:focus.duration,essential:true});return}
  if(spinning.current)return
  m.easeTo({center:[m.getCenter().lng,LAT],zoom:fitZoom(el.current!),duration:reduced()?0:1400})
  const resume=()=>{spinning.current=true};m.once('moveend',resume)
  return()=>{m.off('moveend',resume)}
 },[focus])
 return failed?null:<div ref={el} className="land-globe-map"/>
}
