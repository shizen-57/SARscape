import {useEffect,useRef,useState} from 'react'
import * as maplibregl from 'maplibre-gl'
import type {StyleSpecification} from 'maplibre-gl'
import {LoaderCircle,MapPin,RotateCcw} from 'lucide-react'
import {Button} from './ui'
import type {Scenario} from '../data/scenarios'
import type {ImageryFrame} from '../data/imagery'
import {requestFrames} from './frame-controller.mjs'
import {createCaptureWarmer} from './imagery-prefetch.mjs'
import {setExtent,setVisibility} from './map-updates.mjs'
import type {FeatureCollection,Point} from 'geojson'
import type {ScienceJob} from './SciencePanel'
import type {RadarDisplayMode,RadarDisplaySummary} from './RadarControls'
import {RADAR_COLORS,radarDisplaySummary,radarDisplayValue} from '../data/radar-display.mjs'
import {radarPopup} from './radar-popup'
import {gcovImage,type GcovStyle} from '../data/gcov-style'
import type {MotionPreview,MotionScene} from '../data/motion-preview.mjs'
import {addMotion,motionCellAt,motionPopup,moveParticles,removeMotion,showMotion,type MotionLayers} from './motion-layers'
import type {SurfaceScene} from '../data/glacier-surfaces.mjs'
import {addSurface,removeSurface,surfacePopup} from './surface-layers'
export type MapControls={focus:(bounds:[[number,number],[number,number]])=>void;zoomIn:()=>void;zoomOut:()=>void;reset:()=>void;globe:()=>void;north:()=>void;camera:()=>{center:[number,number];zoom:number;pitch:number;bearing:number};restore:(camera:{center:[number,number];zoom:number;pitch:number;bearing:number})=>void}
export type GcovContext={id:string;scenario:string;acquisitionDate:string;identification?:{trackNumber?:string;orbitPassDirection?:string};displayPreview:{coordinates:[[number,number],[number,number],[number,number],[number,number]];rangeDb:[number,number]};colorPreview?:{shaded?:{note:string;imagery:string};natural:string;composite:string;channels:{channel:string;measurement:string;rangeDb:[number,number]}[];interpretation:string}}
function radarPaint(scale:number,progress:number):NonNullable<maplibregl.CircleLayerSpecification['paint']>{return {
 'circle-radius':['interpolate',['linear'],['zoom'],9,['interpolate',['linear'],['*',['get','displayMagnitude'],progress],0,1.5,scale,4],14,['interpolate',['linear'],['*',['get','displayMagnitude'],progress],0,3,scale,9]],
 'circle-opacity':['interpolate',['linear'],['get','correlation'],0,0.35,1,0.95],
 'circle-color':['interpolate',['linear'],['*',['get','displayValue'],progress],-scale,RADAR_COLORS.negative,0,RADAR_COLORS.zero,scale,RADAR_COLORS.positive],
 'circle-stroke-width':0.8,'circle-stroke-color':'#101922','circle-stroke-opacity':0.8
}}
// With a motion preview, raw samples become neutral rings so they never compete with its colour scale.
const RAW_RINGS:NonNullable<maplibregl.CircleLayerSpecification['paint']>={'circle-radius':['interpolate',['linear'],['zoom'],9,1.5,14,3.5],'circle-color':'rgba(0,0,0,0)','circle-stroke-width':1,'circle-stroke-color':'#e8edf2','circle-stroke-opacity':0.75}
type Props={onGlobeChange:(active:boolean)=>void;adjustments:{brightness:number;contrast:number;saturation:number};scenario:Scenario;frames:ImageryFrame[];step:number;baseline:number;compare:boolean;compareMode:'lens'|'swipe';lens:{x:number;y:number};split:number;boundary:boolean;terrain:boolean;satellite:boolean;retryFrame:number;gcovContext?:GcovContext;gcovStyle:GcovStyle;radarObservation?:ScienceJob;component:'alongTrack'|'slantRange';radarMode:RadarDisplayMode;radarProgress:number;motion?:MotionPreview|null;motionScene?:MotionScene|null;motionLayers:MotionLayers;surface?:SurfaceScene|null;onRadarSummary:(summary:RadarDisplaySummary|null)=>void;camera?:ReturnType<MapControls['camera']>|null;onReady:(c:MapControls)=>void;onStatus:(s:string)=>void;onFrameState:(state:'loading'|'ready'|'error')=>void;onDisplayed:(scenarioId:string,a:string,b:string)=>void}
function style(satellite:boolean):StyleSpecification{return {version:8,sources:{context:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Context imagery © Esri and contributors'},streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'},elevation:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json',tileSize:512,encoding:'terrarium',attribution:'Terrain © <a href="https://mapterhorn.com/">Mapterhorn</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#05080d'}},{id:'context',type:'raster',source:'context',layout:{visibility:satellite?'visible':'none'}},{id:'streets',type:'raster',source:'streets',layout:{visibility:satellite?'none':'visible'}}],terrain:{source:'elevation',exaggeration:1.15}}}
export default function TerrainMap(p:Props){
 const firstEl=useRef<HTMLDivElement>(null),secondEl=useRef<HTMLDivElement>(null),primary=useRef<maplibregl.Map|null>(null),secondary=useRef<maplibregl.Map|null>(null),latest=useRef(p)
 latest.current=p
 const visibleTiles=useRef(new Set<string>()),frameReady=useRef(false),globeRef=useRef(false)
 const [warmer]=useState(()=>createCaptureWarmer())
 const popups=useRef(new Set<maplibregl.Popup>())
 useEffect(()=>{warmer.cancel();visibleTiles.current.clear()},[p.scenario.id,p.frames])
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
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection
  if(globeRef.current||!frameReady.current||document.hidden||connection?.saveData||connection?.effectiveType?.includes('2g')){warmer.cancel();return}
  warmer.warm({frames:latest.current.frames,step:latest.current.step,tiles:[...visibleTiles.current]})
 }
 const applyAdjustments=()=>{for(const map of [primary.current,secondary.current])if(map)for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-')){
  map.setLayoutProperty(layer.id,'visibility',globeRef.current||latest.current.gcovContext?'none':'visible')
  map.setPaintProperty(layer.id,'raster-brightness-max',latest.current.adjustments.brightness)
  map.setPaintProperty(layer.id,'raster-contrast',latest.current.adjustments.contrast)
  map.setPaintProperty(layer.id,'raster-saturation',latest.current.adjustments.saturation)
 }}
 const [ready,setReady]=useState(false),[secondReady,setSecondReady]=useState(false),[failure,setFailure]=useState(''),[retry,setRetry]=useState(0)
 const [globe,setGlobe]=useState(false)
 useEffect(()=>{for(const popup of popups.current)popup.remove()},[globe])
 const [radarData,setRadarData]=useState<{job:string;scenario:string;data:FeatureCollection<Point>}|null>(null)
 const radarScale=useRef<number|null>(null)
 useEffect(()=>{applyAdjustments();latest.current.onGlobeChange(globe)},[p.adjustments,globe])
 const reset=(map:maplibregl.Map)=>{globeRef.current=false;setGlobe(false);map.setProjection({type:'mercator'});map.flyTo({padding:0,center:latest.current.scenario.center,zoom:latest.current.scenario.zoom,pitch:latest.current.terrain?latest.current.scenario.pitch:0,bearing:latest.current.scenario.bearing,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1000})}
 useEffect(()=>{
  if(!firstEl.current)return
  setReady(false);setFailure('')
  let map:maplibregl.Map
  try{map=new maplibregl.Map({container:firstEl.current,style:style(latest.current.satellite),center:latest.current.scenario.center,zoom:latest.current.scenario.zoom,pitch:latest.current.terrain?latest.current.scenario.pitch:0,bearing:latest.current.scenario.bearing,maxPitch:75,attributionControl:{compact:true},transformRequest:trackTile})}catch{setFailure('The 3D map could not start. Enable hardware acceleration and retry.');return}
  primary.current=map
  map.addControl(new maplibregl.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left')
  const timeout=setTimeout(()=>setFailure('The landscape is taking too long to load. Check your connection and retry.'),30000)
  map.on('load',()=>{clearTimeout(timeout);setReady(true);latest.current.onStatus('3D map ready');latest.current.onReady({focus:bounds=>{globeRef.current=false;setGlobe(false);map.setProjection({type:'mercator'});map.easeTo({padding:0,center:[(bounds[0][0]+bounds[1][0])/2,(bounds[0][1]+bounds[1][1])/2],zoom:12.6,pitch:48,bearing:-26,offset:[innerWidth>1000?-90:0,-50],duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:900})},zoomIn:()=>map.zoomIn(),zoomOut:()=>map.zoomOut(),north:()=>map.easeTo({bearing:0}),reset:()=>reset(map),globe:()=>{warmer.cancel();globeRef.current=true;setGlobe(true);map.setTerrain(null);map.setProjection({type:'globe'});map.flyTo({center:latest.current.scenario.center,zoom:1.5,pitch:0,bearing:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500})},camera:()=>({center:map.getCenter().toArray() as [number,number],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()}),restore:c=>map.jumpTo(c)})})
  map.on('move',()=>secondary.current?.jumpTo({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}))
  map.on('movestart',()=>{warmer.cancel();visibleTiles.current.clear();if(frameReady.current)latest.current.onFrameState('loading')})
  map.on('moveend',()=>warm())
  map.on('idle',()=>{if(frameReady.current){latest.current.onFrameState('ready');warm()}})
  const visibility=()=>{if(document.hidden)warmer.cancel();else warm()}
  document.addEventListener('visibilitychange',visibility)
  const observer=new ResizeObserver(()=>{map.resize();secondary.current?.resize()});observer.observe(firstEl.current)
  return()=>{warmer.cancel();document.removeEventListener('visibilitychange',visibility);clearTimeout(timeout);observer.disconnect();map.remove();primary.current=null}
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
  if(p.gcovContext){warmer.cancel();frameReady.current=false;latest.current.onFrameState('ready');return}
  const active=[primary.current,...(p.compare?[secondary.current]:[])].filter(Boolean) as maplibregl.Map[]
  if(!active.length||!p.frames[p.step]||!p.frames[p.baseline])return
  const entries=active.map(map=>{
   const frame=p.frames[map===primary.current&&p.compare?p.baseline:p.step]
   const [w,s,e,n]=p.scenario.imageryExtent??p.scenario.extent,bbox=frame.bbox
   const maxzoom=frame.tileTemplate?20:14
   return {map,id:`observation-${p.scenario.id}-${frame.id}-z${maxzoom}-v7`,scenarioId:p.scenario.id,source:{type:'raster' as const,tiles:[frame.tileTemplate??`${window.location.origin}/api/imagery/tiles/${p.scenario.id}/${frame.id}/{z}/{x}/{y}.png?v=7`],tileSize:256,minzoom:8,maxzoom,bounds:[Math.max(w,bbox[0]),Math.max(s,bbox[1]),Math.min(e,bbox[2]),Math.min(n,bbox[3])] as [number,number,number,number],attribution:frame.attribution??'Contains modified Copernicus Sentinel data · Sentinel-2 L2A · Element 84'}}
  })
  warmer.cancel();frameReady.current=false
  const cancel=requestFrames(entries,{fadeMs:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:650,retain:2,onState:s=>{frameReady.current=s==='ready';latest.current.onFrameState(s);if(s==='ready')warm()},onCommit:()=>{applyAdjustments();latest.current.onDisplayed(p.scenario.id,p.frames[p.compare?p.baseline:p.step].id,p.frames[p.step].id)}})
  return()=>{warmer.cancel();frameReady.current=false;cancel()}
 },[p.frames,p.step,p.baseline,p.compare,p.scenario.id,p.gcovContext,ready,secondReady,retry,p.retryFrame])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map){
  map.setTerrain(p.terrain&&!globe?{source:'elevation',exaggeration:1.15}:null)
 }},[p.terrain,ready,secondReady,globe])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map){
  setVisibility(map,'context',p.satellite);setVisibility(map,'streets',!p.satellite)
 }},[p.satellite,ready,secondReady])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map){
  if(!map.getSource('region')){map.addSource('region',{type:'geojson',data:{type:'FeatureCollection',features:[]}});map.addLayer({id:'boundary',type:'line',source:'region',paint:{'line-color':'#fff','line-width':1.5,'line-dasharray':[4,4]}})}
  setExtent(map.getSource('region') as maplibregl.GeoJSONSource,p.scenario.extent)
 }},[p.scenario.extent,ready,secondReady])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map)setVisibility(map,'boundary',p.boundary)},[p.boundary,ready,secondReady])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map){
  const [iw,is,ie,inn]=p.scenario.imageryExtent??p.scenario.extent
  if(!map.getSource('capture-coverage')){
   map.addSource('capture-coverage',{type:'geojson',data:{type:'FeatureCollection',features:[]}})
   map.addLayer({id:'capture-edge',type:'line',source:'capture-coverage',paint:{'line-color':'#fff','line-width':2,'line-dasharray':[3,3]}})
  }
  const bbox=p.frames[p.step]?.bbox??[iw,is,ie,inn],cw=Math.max(iw,bbox[0]),cs=Math.max(is,bbox[1]),ce=Math.min(ie,bbox[2]),cn=Math.min(inn,bbox[3])
  setExtent(map.getSource('capture-coverage') as maplibregl.GeoJSONSource,[cw,cs,ce,cn])
 }},[p.scenario,p.frames,p.step,ready,secondReady])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map)setVisibility(map,'capture-edge',p.satellite&&!globe&&!p.gcovContext)},[p.satellite,p.gcovContext,ready,secondReady,globe])
 useEffect(()=>{primary.current?.easeTo({pitch:p.terrain?(p.camera?.pitch??p.scenario.pitch):0,duration:600})},[p.terrain])
 useEffect(()=>{
  if(!ready)return
  for(const map of [primary.current,secondReady?secondary.current:null])if(map){
   const url=p.gcovContext?`/api/science/${encodeURIComponent(p.scenario.id)}/gcov/${encodeURIComponent(p.gcovContext.id)}/${gcovImage(p.gcovStyle,p.gcovContext)}.png`:''
   const existing=map.getSource('gcov-context') as maplibregl.ImageSource|undefined
   // Playback swaps the texture in place; the previous date stays visible until the next one loads.
   if(existing&&p.gcovContext&&p.gcovContext.scenario===p.scenario.id){existing.updateImage({url,coordinates:p.gcovContext.displayPreview.coordinates});map.setLayoutProperty('gcov-context','visibility',globe?'none':'visible');continue}
   if(map.getLayer('gcov-context'))map.removeLayer('gcov-context')
   if(map.getSource('gcov-context'))map.removeSource('gcov-context')
   if(p.gcovContext&&p.gcovContext.scenario===p.scenario.id){
    map.addSource('gcov-context',{type:'image',url,coordinates:p.gcovContext.displayPreview.coordinates})
    map.addLayer({id:'gcov-context',type:'raster',source:'gcov-context',layout:{visibility:globe?'none':'visible'},paint:{'raster-opacity':0.9,'raster-resampling':'nearest','raster-fade-duration':0}},['motion-heat','radar-samples','glacier-surface','glacier-outline-history','glacier-outline-current'].find(id=>map.getLayer(id)))
   }
  }
  applyAdjustments()
 },[p.gcovContext,p.gcovStyle,p.scenario.id,ready,secondReady])
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
     map.addLayer({id:'radar-samples',type:'circle',source:'radar-samples',layout:{visibility:globe||!latest.current.motionLayers.raw?'none':'visible'},paint:p.motion?RAW_RINGS:radarPaint(scale,p.radarMode==='pair'?latest.current.radarProgress:1)})
     const popup=new maplibregl.Popup({closeButton:true,maxWidth:'300px',className:'radar-map-popup'})
     popups.current.add(popup)
     const click=(event:maplibregl.MapLayerMouseEvent)=>{
      const feature=event.features?.[0],values=feature?.properties
      if(!values||feature?.geometry.type!=='Point')return
      popup.setLngLat(feature.geometry.coordinates as [number,number]).setDOMContent(radarPopup(values,observation,p.component,p.radarMode,scale)).addTo(map)
     }
     const enter=()=>{map.getCanvas().style.cursor='pointer'},leave=()=>{map.getCanvas().style.cursor=''}
     map.on('click','radar-samples',click);map.on('mouseenter','radar-samples',enter);map.on('mouseleave','radar-samples',leave)
     cleanups.push(()=>{map.off('click','radar-samples',click);map.off('mouseenter','radar-samples',enter);map.off('mouseleave','radar-samples',leave);map.getCanvas().style.cursor='';popup.remove();popups.current.delete(popup)})
    }
    latest.current.onStatus('Radar displacement visible')
  }else if(!observation)latest.current.onStatus('3D map ready')
  return()=>cleanups.forEach(cleanup=>cleanup())
 },[p.radarObservation?.id,p.radarObservation?.provenance?.pairDays,p.scenario.id,p.component,p.radarMode,p.motion,radarData,ready,secondReady])
 useEffect(()=>{
  if(radarScale.current===null||p.motion||!p.motionLayers.raw)return
  const paint=radarPaint(radarScale.current,p.radarMode==='pair'?p.radarProgress:1)
  for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map?.getLayer('radar-samples')){
   map.setPaintProperty('radar-samples','circle-radius',paint['circle-radius'])
   map.setPaintProperty('radar-samples','circle-color',paint['circle-color'])
  }
 },[p.radarProgress,p.radarMode,p.component,radarData,ready,secondReady,globe])
 useEffect(()=>{
  const map=primary.current,preview=p.motion,scene=p.motionScene
  if(!ready||!map||!preview?.grid||!preview.outline||!scene||preview.status==='unavailable')return
  addMotion(map,preview,scene,latest.current.radarProgress);showMotion(map,latest.current.motionLayers,globe)
  const popup=new maplibregl.Popup({closeButton:true,maxWidth:'300px',className:'radar-map-popup'})
  popups.current.add(popup)
  const click=(event:maplibregl.MapMouseEvent)=>{
   // A raw-sample ring under the pointer keeps its own original-measurement popup.
   if(map.getLayer('radar-samples')&&map.queryRenderedFeatures(event.point,{layers:['radar-samples']}).length)return
   const cell=motionCellAt(preview,scene,event.lngLat)
   if(cell)popup.setLngLat(event.lngLat).setDOMContent(motionPopup(cell,preview,scene,latest.current.component,latest.current.radarMode,latest.current.radarProgress)).addTo(map)
  }
  map.on('click',click)
  return()=>{map.off('click',click);popup.remove();popups.current.delete(popup);removeMotion(map)}
 },[p.motion,p.motionScene,ready])
 useEffect(()=>{if(ready&&primary.current&&p.motion)showMotion(primary.current,p.motionLayers,globe);if(ready&&p.motion&&primary.current?.getLayer('radar-samples'))primary.current.setLayoutProperty('radar-samples','visibility',globe||!p.motionLayers.raw?'none':'visible')},[p.motionLayers,p.motion,p.motionScene,radarData,ready,globe])
 useEffect(()=>{if(ready&&primary.current&&p.motion&&p.motionScene)moveParticles(primary.current,p.motion,p.motionScene,p.radarProgress,p.motionLayers.particles)},[p.radarProgress,p.motion,p.motionScene,p.motionLayers.particles,ready])
 useEffect(()=>{
  const map=primary.current,scene=p.surface
  if(!ready||!map)return
  if(!scene){removeSurface(map);return}
  addSurface(map,scene,globe)
  const popup=new maplibregl.Popup({closeButton:true,maxWidth:'310px',className:'radar-map-popup'})
  popups.current.add(popup)
  const click=(event:maplibregl.MapMouseEvent)=>popup.setLngLat(event.lngLat).setDOMContent(surfacePopup(scene,event.lngLat)).addTo(map)
  map.on('click',click)
  return()=>{map.off('click',click);popup.remove();popups.current.delete(popup);removeSurface(map)}
 },[p.surface,ready])
 useEffect(()=>{for(const map of [ready?primary.current:null,secondReady?secondary.current:null])if(map){
  setVisibility(map,'gcov-context',!globe)
  setVisibility(map,'radar-samples',!globe&&p.motionLayers.raw)
  for(const id of ['glacier-surface','glacier-outline-history','glacier-outline-current'])setVisibility(map,id,!globe)
 }},[globe,ready,secondReady,p.gcovContext,p.surface,p.motionLayers.raw,radarData,p.motion])
 return <>{globe&&<Button variant="outline" className="globe-return" onClick={()=>primary.current&&reset(primary.current)}>Return to {p.scenario.name}</Button>}<div ref={firstEl} className="map-canvas" role="region" aria-label="Interactive glacier terrain map"/>{p.compare&&<div className="comparison-canvas" style={{clipPath:p.compareMode==='lens'?`circle(min(150px,27vw) at ${p.lens.x}% ${p.lens.y}%)`:`inset(0 0 0 ${p.split}%)`}}><div ref={secondEl} className="map-canvas"/></div>}{!ready&&!failure&&<div className="map-loading"><LoaderCircle className="spin" size={26}/><span>Loading the glacier landscape…</span></div>}{failure&&<div className="map-error" role="alert"><MapPin size={30}/><h3>Let’s get your map back</h3><p>{failure}</p><Button onClick={()=>setRetry(v=>v+1)}><RotateCcw size={15}/>Retry map</Button></div>}</>
}
