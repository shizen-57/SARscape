import {useEffect,useRef,useState} from 'react'
import * as maplibregl from 'maplibre-gl'
import type {StyleSpecification} from 'maplibre-gl'
import {LoaderCircle,MapPin,RotateCcw} from 'lucide-react'
import {Button} from './ui'
import type {Scenario} from '../data/scenarios'
import type {ImageryFrame} from '../data/imagery'
import {requestFrames} from './frame-controller.mjs'
import {prefetchCaptures} from './imagery-prefetch.mjs'
import type {FeatureCollection,Point} from 'geojson'
import type {ScienceJob} from './SciencePanel'
import type {RadarDisplayMode,RadarDisplaySummary} from './RadarControls'
import {RADAR_COLORS,radarDisplaySummary,radarDisplayValue} from '../data/radar-display.mjs'
import {radarPopup} from './radar-popup'
export type MapControls={zoomIn:()=>void;zoomOut:()=>void;reset:()=>void;globe:()=>void;north:()=>void;camera:()=>{center:[number,number];zoom:number;pitch:number;bearing:number};restore:(camera:{center:[number,number];zoom:number;pitch:number;bearing:number})=>void}
export type GcovContext={id:string;scenario:string;acquisitionDate:string;displayPreview:{coordinates:[[number,number],[number,number],[number,number],[number,number]];rangeDb:[number,number]}}
function radarPaint(scale:number,progress:number):NonNullable<maplibregl.CircleLayerSpecification['paint']>{return {
 'circle-radius':['interpolate',['linear'],['zoom'],9,['interpolate',['linear'],['*',['get','displayMagnitude'],progress],0,1.5,scale,4],14,['interpolate',['linear'],['*',['get','displayMagnitude'],progress],0,3,scale,9]],
 'circle-opacity':['interpolate',['linear'],['get','correlation'],0,0.35,1,0.95],
 'circle-color':['interpolate',['linear'],['*',['get','displayValue'],progress],-scale,RADAR_COLORS.negative,0,RADAR_COLORS.zero,scale,RADAR_COLORS.positive],
 'circle-stroke-width':0.8,'circle-stroke-color':'#101922','circle-stroke-opacity':0.8
}}
type Props={onGlobeChange:(active:boolean)=>void;adjustments:{brightness:number;contrast:number;saturation:number};scenario:Scenario;frames:ImageryFrame[];step:number;baseline:number;compare:boolean;compareMode:'lens'|'swipe';lens:{x:number;y:number};split:number;boundary:boolean;terrain:boolean;satellite:boolean;retryFrame:number;gcovContext?:GcovContext;radarObservation?:ScienceJob;component:'alongTrack'|'slantRange';radarMode:RadarDisplayMode;radarProgress:number;onRadarSummary:(summary:RadarDisplaySummary|null)=>void;camera?:ReturnType<MapControls['camera']>|null;onReady:(c:MapControls)=>void;onStatus:(s:string)=>void;onFrameState:(state:'loading'|'ready'|'error')=>void;onDisplayed:(scenarioId:string,a:string,b:string)=>void}
function style(satellite:boolean):StyleSpecification{return {version:8,sources:{context:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Context imagery © Esri and contributors'},streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'},elevation:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json',tileSize:512,encoding:'terrarium',attribution:'Terrain © <a href="https://mapterhorn.com/">Mapterhorn</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#05080d'}},{id:'context',type:'raster',source:'context',layout:{visibility:satellite?'visible':'none'}},{id:'streets',type:'raster',source:'streets',layout:{visibility:satellite?'none':'visible'}}],terrain:{source:'elevation',exaggeration:1.15}}}
export default function TerrainMap(p:Props){
 const firstEl=useRef<HTMLDivElement>(null),secondEl=useRef<HTMLDivElement>(null),primary=useRef<maplibregl.Map|null>(null),secondary=useRef<maplibregl.Map|null>(null),latest=useRef(p)
 latest.current=p
 const visibleTiles=useRef(new Set<string>()),stopWarm=useRef<(()=>void)|null>(null),frameReady=useRef(false),globeRef=useRef(false)
 useEffect(()=>{stopWarm.current?.();visibleTiles.current.clear()},[p.scenario.id,p.frames])
 const trackTile=(url:string)=>{
  const match=url.match(/\/api\/imagery\/tiles\/([^/]+)\/([^/]+)\/(\d+)\/\d+\/\d+\.png/)
  if(match&&match[1]===latest.current.scenario.id&&Number(match[3])<=12){
   visibleTiles.current.add(url.replace(`/${match[2]}/`,`/{frame}/`))
   if(visibleTiles.current.size>48)visibleTiles.current.delete(visibleTiles.current.values().next().value!)
  }
  const aerial=url.match(/\/api\/imagery\/aerial\/(\d{4})\/(\d+)\/\d+\/\d+\.jpeg/)
  if(aerial&&Number(aerial[2])<=15){
   visibleTiles.current.add(url.replace(`/${aerial[1]}/`,`/{frame}/`))
   if(visibleTiles.current.size>48)visibleTiles.current.delete(visibleTiles.current.values().next().value!)
  }
  return {url}
 }
 const warm=()=>{
  stopWarm.current?.()
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection
  if(globeRef.current||!frameReady.current||document.hidden||connection?.saveData||connection?.effectiveType?.includes('2g'))return
  stopWarm.current=prefetchCaptures({frames:latest.current.frames,step:latest.current.step,tiles:[...visibleTiles.current]})
 }
 const applyAdjustments=()=>{for(const map of [primary.current,secondary.current])if(map)for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-')){
  map.setLayoutProperty(layer.id,'visibility',globeRef.current||latest.current.gcovContext?'none':'visible')
  map.setPaintProperty(layer.id,'raster-brightness-max',latest.current.adjustments.brightness)
  map.setPaintProperty(layer.id,'raster-contrast',latest.current.adjustments.contrast)
  map.setPaintProperty(layer.id,'raster-saturation',latest.current.adjustments.saturation)
 }}
 const [ready,setReady]=useState(false),[secondReady,setSecondReady]=useState(false),[failure,setFailure]=useState(''),[retry,setRetry]=useState(0)
 const [globe,setGlobe]=useState(false)
 const [radarData,setRadarData]=useState<{job:string;scenario:string;data:FeatureCollection<Point>}|null>(null)
 const radarScale=useRef<number|null>(null)
 useEffect(()=>{applyAdjustments();latest.current.onGlobeChange(globe)},[p.adjustments,globe])
 const reset=(map:maplibregl.Map)=>{globeRef.current=false;setGlobe(false);map.setProjection({type:'mercator'});map.flyTo({center:latest.current.scenario.center,zoom:Math.max(14.5,latest.current.scenario.zoom),pitch:latest.current.terrain?latest.current.scenario.pitch:0,bearing:latest.current.scenario.bearing,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000})}
 useEffect(()=>{
  if(!firstEl.current)return
  setReady(false);setFailure('')
  let map:maplibregl.Map
  try{map=new maplibregl.Map({container:firstEl.current,style:style(latest.current.satellite),center:latest.current.scenario.center,zoom:Math.max(14.5,latest.current.scenario.zoom),pitch:latest.current.terrain?latest.current.scenario.pitch:0,bearing:latest.current.scenario.bearing,maxPitch:75,attributionControl:{compact:true},transformRequest:trackTile})}catch{setFailure('The 3D map could not start. Enable hardware acceleration and retry.');return}
  primary.current=map
  map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left')
  const timeout=setTimeout(()=>setFailure('The landscape is taking too long to load. Check your connection and retry.'),30000)
  map.on('load',()=>{clearTimeout(timeout);setReady(true);latest.current.onStatus('3D map ready');latest.current.onReady({zoomIn:()=>map.zoomIn(),zoomOut:()=>map.zoomOut(),north:()=>map.easeTo({bearing:0}),reset:()=>reset(map),globe:()=>{stopWarm.current?.();globeRef.current=true;setGlobe(true);map.setTerrain(null);map.setProjection({type:'globe'});map.flyTo({center:latest.current.scenario.center,zoom:1.5,pitch:0,bearing:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500})},camera:()=>({center:map.getCenter().toArray() as [number,number],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()}),restore:c=>map.jumpTo(c)})})
  map.on('move',()=>secondary.current?.jumpTo({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}))
  map.on('movestart',()=>{stopWarm.current?.();visibleTiles.current.clear();if(frameReady.current)latest.current.onFrameState('loading')})
  map.on('moveend',()=>warm())
  map.on('idle',()=>{if(frameReady.current){latest.current.onFrameState('ready');warm()}})
  const visibility=()=>{if(document.hidden)stopWarm.current?.();else warm()}
  document.addEventListener('visibilitychange',visibility)
  const observer=new ResizeObserver(()=>{map.resize();secondary.current?.resize()});observer.observe(firstEl.current)
  return()=>{stopWarm.current?.();document.removeEventListener('visibilitychange',visibility);clearTimeout(timeout);observer.disconnect();map.remove();primary.current=null}
 },[retry])
 useEffect(()=>{
  if(!p.compare||!ready||!secondEl.current){setSecondReady(false);return}
  const base=primary.current!,map=new maplibregl.Map({container:secondEl.current,style:style(p.satellite),center:base.getCenter(),zoom:base.getZoom(),pitch:base.getPitch(),bearing:base.getBearing(),interactive:false,attributionControl:false,maxPitch:75})
  secondary.current=map;map.on('load',()=>{map.jumpTo({center:base.getCenter(),zoom:base.getZoom(),pitch:base.getPitch(),bearing:base.getBearing()});setSecondReady(true)})
  return()=>{map.remove();secondary.current=null;setSecondReady(false)}
 },[p.compare,ready])
 useEffect(()=>{if(ready&&primary.current){if(p.camera)primary.current.jumpTo(p.camera);else reset(primary.current)}},[p.scenario,ready,p.camera])
 useEffect(()=>{
  if(!ready||(p.compare&&!secondReady)){latest.current.onFrameState('loading');return}
  if(p.gcovContext){stopWarm.current?.();frameReady.current=false;latest.current.onFrameState('ready');return}
  const active=[primary.current,...(p.compare?[secondary.current]:[])].filter(Boolean) as maplibregl.Map[]
  if(!active.length||!p.frames[p.step]||!p.frames[p.baseline])return
  const entries=active.map(map=>{
   const frame=p.frames[map===primary.current&&p.compare?p.baseline:p.step]
   const [w,s,e,n]=p.scenario.imageryExtent??p.scenario.extent,bbox=frame.bbox
   const maxzoom=frame.tileTemplate?20:14
   return {map,id:`observation-${p.scenario.id}-${frame.id}-z${maxzoom}-v7`,scenarioId:p.scenario.id,source:{type:'raster' as const,tiles:[frame.tileTemplate??`${window.location.origin}/api/imagery/tiles/${p.scenario.id}/${frame.id}/{z}/{x}/{y}.png?v=7`],tileSize:256,minzoom:8,maxzoom,bounds:[Math.max(w,bbox[0]),Math.max(s,bbox[1]),Math.min(e,bbox[2]),Math.min(n,bbox[3])] as [number,number,number,number],attribution:frame.attribution??'Contains modified Copernicus Sentinel data · Sentinel-2 L2A · Element 84'}}
  })
  stopWarm.current?.();frameReady.current=false
  const cancel=requestFrames(entries,{onState:s=>{frameReady.current=s==='ready';latest.current.onFrameState(s);if(s==='ready')warm()},onCommit:()=>{applyAdjustments();latest.current.onDisplayed(p.scenario.id,p.frames[p.compare?p.baseline:p.step].id,p.frames[p.step].id)}})
  return()=>{stopWarm.current?.();frameReady.current=false;cancel()}
 },[p.frames,p.step,p.baseline,p.compare,p.scenario.id,p.gcovContext,ready,secondReady,retry,p.retryFrame])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map){
  map.setTerrain(p.terrain&&!globe?{source:'elevation',exaggeration:1.15}:null)
  map.setLayoutProperty('context','visibility',p.satellite?'visible':'none');map.setLayoutProperty('streets','visibility',p.satellite?'none':'visible')
  const [w,s,e,n]=p.scenario.extent
  if(!map.getSource('region')){map.addSource('region',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'boundary',type:'line',source:'region',paint:{'line-color':'#fff','line-width':1.5,'line-dasharray':[4,4]}})}
  ;(map.getSource('region') as maplibregl.GeoJSONSource).setData({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}})
  map.setLayoutProperty('boundary','visibility',p.boundary?'visible':'none')
  const [iw,is,ie,inn]=p.scenario.imageryExtent??p.scenario.extent
  if(!map.getSource('capture-coverage')){
   map.addSource('capture-coverage',{type:'geojson',data:{type:'FeatureCollection',features:[]}})
   map.addLayer({id:'capture-edge',type:'line',source:'capture-coverage',paint:{'line-color':'#fff','line-width':2,'line-dasharray':[3,3]}})
  }
  const bbox=p.frames[p.step]?.bbox??[iw,is,ie,inn],cw=Math.max(iw,bbox[0]),cs=Math.max(is,bbox[1]),ce=Math.min(ie,bbox[2]),cn=Math.min(inn,bbox[3])
  ;(map.getSource('capture-coverage') as maplibregl.GeoJSONSource).setData({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[cw,cs],[ce,cs],[ce,cn],[cw,cn],[cw,cs]]]}})
  map.setLayoutProperty('capture-edge','visibility',p.satellite&&!globe&&!p.gcovContext?'visible':'none')
 }},[p.terrain,p.satellite,p.boundary,p.scenario,p.frames,p.step,p.gcovContext,ready,secondReady,globe])
 useEffect(()=>{primary.current?.easeTo({pitch:p.terrain?(p.camera?.pitch??p.scenario.pitch):0,duration:600})},[p.terrain])
 useEffect(()=>{
  if(!ready)return
  for(const map of [primary.current,secondReady?secondary.current:null])if(map){
   if(map.getLayer('gcov-context'))map.removeLayer('gcov-context')
   if(map.getSource('gcov-context'))map.removeSource('gcov-context')
   if(p.gcovContext&&p.gcovContext.scenario===p.scenario.id){
    map.addSource('gcov-context',{type:'image',url:`/api/science/${encodeURIComponent(p.scenario.id)}/gcov/${encodeURIComponent(p.gcovContext.id)}/backscatter.png`,coordinates:p.gcovContext.displayPreview.coordinates})
    map.addLayer({id:'gcov-context',type:'raster',source:'gcov-context',layout:{visibility:globe?'none':'visible'},paint:{'raster-opacity':0.9,'raster-resampling':'nearest','raster-fade-duration':0}},map.getLayer('radar-samples')?'radar-samples':undefined)
   }
  }
  applyAdjustments()
  return()=>{for(const map of [primary.current,secondary.current])if(map){if(map.getLayer('gcov-context'))map.removeLayer('gcov-context');if(map.getSource('gcov-context'))map.removeSource('gcov-context')}}
 },[p.gcovContext,p.scenario.id,ready,secondReady,globe])
 useEffect(()=>{
  const controller=new AbortController(),job=p.radarObservation?.id
  setRadarData(null);latest.current.onRadarSummary(null)
  if(job){
   latest.current.onStatus('Loading radar displacement…')
   fetch(`/api/science/${p.scenario.id}/products/${job}/samples.geojson`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Processed radar samples could not be loaded.');return response.json()}).then(data=>{
    if(controller.signal.aborted)return
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('The radar samples have an unsupported format.')
    setRadarData({job,scenario:p.scenario.id,data})
   }).catch(error=>{if(!controller.signal.aborted){latest.current.onStatus(error.message);latest.current.onRadarSummary({scale:null,count:0,error:error.message})}})
  }
  return()=>controller.abort()
 },[p.radarObservation?.id,p.scenario.id])
 useEffect(()=>{
  if(!ready)return
  const maps=[primary.current,...(secondReady?[secondary.current]:[])].filter(Boolean) as maplibregl.Map[]
  const cleanups:(()=>void)[]=[]
  radarScale.current=null
  for(const map of maps){if(map.getLayer('radar-samples'))map.removeLayer('radar-samples');if(map.getSource('radar-samples'))map.removeSource('radar-samples')}
  const observation=p.radarObservation
  if(observation&&radarData?.job===observation.id&&radarData.scenario===p.scenario.id){
    const days=observation.provenance?.pairDays??0,summary=radarDisplaySummary(radarData.data.features,p.component,p.radarMode,days)
    if(summary.scale===null){latest.current.onRadarSummary({...summary,error:'No finite measurements are available for this view.'});return}
    latest.current.onRadarSummary(summary)
    const scale=summary.scale
    radarScale.current=scale
    const data:FeatureCollection<Point>={...radarData.data,features:radarData.data.features.flatMap(feature=>{const value=radarDisplayValue(feature.properties?.[p.component],p.radarMode,days);return value===null?[]:[{...feature,properties:{...feature.properties,displayValue:value,displayMagnitude:Math.abs(value)}}]})}
    for(const map of maps){
     map.addSource('radar-samples',{type:'geojson',data})
     map.addLayer({id:'radar-samples',type:'circle',source:'radar-samples',layout:{visibility:globe?'none':'visible'},paint:radarPaint(scale,p.radarMode==='pair'?latest.current.radarProgress:1)})
     const popup=new maplibregl.Popup({closeButton:true,maxWidth:'300px',className:'radar-map-popup'})
     const click=(event:maplibregl.MapLayerMouseEvent)=>{
      const feature=event.features?.[0],values=feature?.properties
      if(!values||feature?.geometry.type!=='Point')return
      popup.setLngLat(feature.geometry.coordinates as [number,number]).setDOMContent(radarPopup(values,observation,p.component,p.radarMode,scale)).addTo(map)
     }
     const enter=()=>{map.getCanvas().style.cursor='pointer'},leave=()=>{map.getCanvas().style.cursor=''}
     map.on('click','radar-samples',click);map.on('mouseenter','radar-samples',enter);map.on('mouseleave','radar-samples',leave)
     cleanups.push(()=>{map.off('click','radar-samples',click);map.off('mouseenter','radar-samples',enter);map.off('mouseleave','radar-samples',leave);map.getCanvas().style.cursor='';popup.remove()})
    }
    latest.current.onStatus('Radar displacement visible')
  }else if(!observation)latest.current.onStatus('3D map ready')
  return()=>cleanups.forEach(cleanup=>cleanup())
 },[p.radarObservation?.id,p.radarObservation?.provenance?.pairDays,p.scenario.id,p.component,p.radarMode,radarData,ready,secondReady,globe])
 useEffect(()=>{
  if(radarScale.current===null)return
  const paint=radarPaint(radarScale.current,p.radarMode==='pair'?p.radarProgress:1)
  for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map?.getLayer('radar-samples')){
   map.setPaintProperty('radar-samples','circle-radius',paint['circle-radius'])
   map.setPaintProperty('radar-samples','circle-color',paint['circle-color'])
  }
 },[p.radarProgress,p.radarMode,p.component,radarData,ready,secondReady,globe])
 return <>{globe&&<Button variant="outline" className="globe-return" onClick={()=>primary.current&&reset(primary.current)}>Return to {p.scenario.name}</Button>}<div ref={firstEl} className="map-canvas" role="region" aria-label="Interactive glacier terrain map"/>{p.compare&&<div className="comparison-canvas" style={{clipPath:p.compareMode==='lens'?`circle(min(150px,27vw) at ${p.lens.x}% ${p.lens.y}%)`:`inset(0 0 0 ${p.split}%)`}}><div ref={secondEl} className="map-canvas"/></div>}{!ready&&!failure&&<div className="map-loading"><LoaderCircle className="spin" size={26}/><span>Loading the glacier landscape…</span></div>}{failure&&<div className="map-error" role="alert"><MapPin size={30}/><h3>Let’s get your map back</h3><p>{failure}</p><Button onClick={()=>setRetry(v=>v+1)}><RotateCcw size={15}/>Retry map</Button></div>}</>
}
