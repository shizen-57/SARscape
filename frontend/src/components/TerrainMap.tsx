import {useEffect,useRef,useState} from 'react'
import * as maplibregl from 'maplibre-gl'
import type {StyleSpecification} from 'maplibre-gl'
import {LoaderCircle,MapPin,RotateCcw} from 'lucide-react'
import {Button} from './ui'
import type {Scenario} from '../data/scenarios'
import type {ImageryFrame} from '../data/imagery'
import type {StudyOverlay} from './RadarStudy'
import {requestFrames} from './frame-controller.mjs'
import {prefetchCaptures} from './imagery-prefetch.mjs'
import {tileStore,prepareCaptures} from '../data/tile-cache.mjs'
import {viewportTemplates} from '../data/viewport-tiles.mjs'
maplibregl.addProtocol('sarscape',async(request,controller)=>({data:await tileStore.read(request.url.slice('sarscape://'.length),controller.signal)}))
export type MapControls={zoomIn:()=>void;zoomOut:()=>void;reset:()=>void;globe:()=>void;north:()=>void;camera:()=>{center:[number,number];zoom:number;pitch:number;bearing:number};restore:(camera:{center:[number,number];zoom:number;pitch:number;bearing:number})=>void;prepare:(ids:string[]|null,onProgress:(value:{completed:number;total:number})=>void,signal:AbortSignal)=>Promise<void>}
type Props={radarThreshold:number|null;indexOverlay:{id:string;baselineId?:string;mode:'index'|'change'}|null;onNavigation:()=>void;onGlobeChange:(active:boolean)=>void;adjustments:{brightness:number;contrast:number;saturation:number};scenario:Scenario;frames:ImageryFrame[];step:number;baseline:number;compare:boolean;compareMode:'lens'|'swipe';lens:{x:number;y:number};split:number;boundary:boolean;terrain:boolean;satellite:boolean;retryFrame:number;scienceJob?:string;studyOverlay:StudyOverlay|null;blink:boolean;component:'alongTrack'|'slantRange'|'backscatterDb'|'backscatterChange';camera?:ReturnType<MapControls['camera']>|null;onReady:(c:MapControls)=>void;onStatus:(s:string)=>void;onFrameState:(state:'loading'|'ready'|'error')=>void;onDisplayed:(scenarioId:string,a:string,b:string)=>void}
function style(satellite:boolean):StyleSpecification{return {version:8,sources:{context:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Context imagery © Esri and contributors'},streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'},elevation:{type:'raster-dem',url:'https://tiles.mapterhorn.com/tilejson.json',tileSize:512,encoding:'terrarium',attribution:'Terrain © <a href="https://mapterhorn.com/">Mapterhorn</a>'}},layers:[{id:'background',type:'background',paint:{'background-color':'#05080d'}},{id:'context',type:'raster',source:'context',layout:{visibility:satellite?'visible':'none'}},{id:'streets',type:'raster',source:'streets',layout:{visibility:satellite?'none':'visible'}}],terrain:{source:'elevation',exaggeration:1.15}}}
export default function TerrainMap(p:Props){
 const firstEl=useRef<HTMLDivElement>(null),secondEl=useRef<HTMLDivElement>(null),primary=useRef<maplibregl.Map|null>(null),secondary=useRef<maplibregl.Map|null>(null),latest=useRef(p)
 latest.current=p
 const visibleTiles=useRef(new Set<string>()),stopWarm=useRef<(()=>void)|null>(null),frameReady=useRef(false),globeRef=useRef(false),warmKey=useRef(''),tileError=useRef(false)
 useEffect(()=>{stopWarm.current?.();visibleTiles.current.clear()},[p.scenario.id,p.frames])
 const trackTile=(url:string)=>{
  const match=url.match(/\/api\/imagery\/tiles\/([^/]+)\/([^/]+)\/(\d+)\/\d+\/\d+\.png/)
  if(match&&match[1]===latest.current.scenario.id&&latest.current.frames.some(frame=>!frame.tileTemplate&&frame.id===match[2])&&Number(match[3])<=14){
   visibleTiles.current.add(url.replace(`/${match[2]}/`,`/{frame}/`))
   if(visibleTiles.current.size>256)visibleTiles.current.delete(visibleTiles.current.values().next().value!)
  }
  const aerial=url.match(/\/api\/imagery\/aerial\/(\d{4})\/(\d+)\/\d+\/\d+\.jpeg/)
  if(aerial&&latest.current.frames.some(frame=>frame.tileTemplate?.includes('/aerial/')&&frame.id===aerial[1])&&Number(aerial[2])<=20){
   visibleTiles.current.add(url.replace(`/${aerial[1]}/`,`/{frame}/`))
   if(visibleTiles.current.size>256)visibleTiles.current.delete(visibleTiles.current.values().next().value!)
  }
  return {url:match||aerial?'sarscape://'+new URL(url,location.origin).href:url}
 }
 const warm=()=>{
  const key=latest.current.frames.map(f=>f.id).join(',')+':'+latest.current.step+':'+[...visibleTiles.current].sort().join(',')
  if(key===warmKey.current)return
  warmKey.current=key;stopWarm.current?.()
  const connection=(navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string}}).connection
  if(globeRef.current||!frameReady.current||document.hidden||connection?.saveData||connection?.effectiveType?.includes('2g'))return
  stopWarm.current=prefetchCaptures({frames:latest.current.frames,step:latest.current.step,tiles:[...visibleTiles.current],fetchTile:async(url,options)=>new Response(await tileStore.read(String(url),options?.signal??undefined))})
 }
 const observationError=(event:maplibregl.ErrorEvent)=>{
  const props=latest.current,id=(event as maplibregl.ErrorEvent&{sourceId?:string}).sourceId
  const current=id?.startsWith(`observation-${props.scenario.id}-`)&&[props.frames[props.step]?.id,props.compare?props.frames[props.baseline]?.id:null].some(frame=>frame&&id.includes(frame))
  if(current){for(const map of [primary.current,secondary.current]){const source=map?.getSource(id!);if(source)(source as typeof source&{__failed?:boolean}).__failed=true}tileError.current=true;props.onFrameState('error')}
  else if(id==='index-study')props.onStatus('Index tiles unavailable. Prepare the annual analysis and retry the overlay.')
 }
 const navigationReady=()=>{
  const props=latest.current,maps=[primary.current,...(props.compare?[secondary.current]:[])]
  if(!frameReady.current||tileError.current||maps.some(map=>!map||map.isMoving()))return
  const loaded=maps.every(map=>{const frame=props.frames[map===primary.current&&props.compare?props.baseline:props.step];return frame&&map!.isSourceLoaded(`observation-${props.scenario.id}-${frame.id}-z${frame.tileTemplate?20:14}-v8`)})
  if(loaded){props.onFrameState('ready');warm()}
 }
 const applyAdjustments=()=>{for(const map of [primary.current,secondary.current])if(map)for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-')){
  map.setLayoutProperty(layer.id,'visibility',globeRef.current?'none':'visible')
  map.setPaintProperty(layer.id,'raster-brightness-max',latest.current.adjustments.brightness)
  map.setPaintProperty(layer.id,'raster-contrast',latest.current.adjustments.contrast)
  map.setPaintProperty(layer.id,'raster-saturation',latest.current.adjustments.saturation)
 }}
 const applyRadarPaint=(map:maplibregl.Map)=>{
  const props=latest.current,study=props.studyOverlay,scale=study?.scale??1
  const value:maplibregl.ExpressionSpecification=study?['*',['get',props.component],study.progress*12]:['get',props.component]
  map.setPaintProperty('radar-samples','circle-color',props.component==='backscatterChange'?['interpolate',['linear'],value,-6,'#e2627b',0,'#eef0de',6,'#48b6cd']:props.component==='backscatterDb'?['interpolate',['linear'],['coalesce',value,-40],-35,'#123660',-15,'#4a99bf',0,'#e8ecda']:['interpolate',['linear'],value,-scale,'#e46893',0,'#ebf0f5',scale,'#49b0dc'])
  map.setFilter('radar-samples',study?['>=',['get','correlation'],study.threshold]:props.component==='backscatterDb'?props.radarThreshold===null?['!=',['get','backscatterDb'],null]:['all',['!=',['get','backscatterDb'],null],['<=',['get','backscatterDb'],props.radarThreshold]]:null)
  // Size and color encode offset magnitude, at fixed geographic sample sites.
  // Radar-axis offsets cannot be used to move the optical glacier on this map.
  map.setPaintProperty('radar-samples','circle-radius',study?['interpolate',['linear'],['zoom'],9,['+',1,['*',2,['min',1,['/', ['abs',value],scale]]]],14,['+',1.5,['*',4,['min',1,['/', ['abs',value],scale]]]]]:['interpolate',['linear'],['zoom'],9,1,14,4])
  map.setLayoutProperty('radar-samples','visibility',globeRef.current?'none':'visible')
 }
 const [ready,setReady]=useState(false),[secondReady,setSecondReady]=useState(false),[failure,setFailure]=useState(''),[retry,setRetry]=useState(0)
 const [globe,setGlobe]=useState(false)
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
  map.on('load',()=>{clearTimeout(timeout);setReady(true);latest.current.onStatus('3D map ready');latest.current.onReady({zoomIn:()=>map.zoomIn(),zoomOut:()=>map.zoomOut(),north:()=>map.easeTo({bearing:0}),reset:()=>reset(map),globe:()=>{stopWarm.current?.();globeRef.current=true;setGlobe(true);map.setTerrain(null);map.setProjection({type:'globe'});map.flyTo({center:latest.current.scenario.center,zoom:1.5,pitch:0,bearing:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:1500})},camera:()=>({center:map.getCenter().toArray() as [number,number],zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()}),restore:c=>map.jumpTo(c),prepare:async(ids,onProgress,signal)=>{stopWarm.current?.();const props=latest.current,frame=props.frames[props.step];if(!frame||globeRef.current)throw new Error('Return to the study area before preparing playback.');const calculated=viewportTemplates(map.coveringTiles({tileSize:256,minzoom:8,maxzoom:frame.tileTemplate?20:14,roundZoom:true}),frame,props.scenario,location.origin);await prepareCaptures({frames:ids?props.frames.filter(f=>ids.includes(f.id)):props.frames,tiles:[...new Set([...calculated,...visibleTiles.current].map(url=>new URL(url,location.origin).href))],onProgress,signal})}})})
  map.on('move',()=>secondary.current?.jumpTo({center:map.getCenter(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()}))
  map.on('movestart',()=>{latest.current.onNavigation();stopWarm.current?.();warmKey.current='';visibleTiles.current.clear();tileError.current=false;if(frameReady.current)latest.current.onFrameState('loading')})
  map.on('moveend',()=>warm())
  map.on('error',observationError)
  map.on('idle',navigationReady)
  const visibility=()=>{warmKey.current='';if(document.hidden)stopWarm.current?.();else warm()}
  document.addEventListener('visibilitychange',visibility)
  const observer=new ResizeObserver(()=>{map.resize();secondary.current?.resize()});observer.observe(firstEl.current)
  return()=>{stopWarm.current?.();document.removeEventListener('visibilitychange',visibility);clearTimeout(timeout);observer.disconnect();map.remove();primary.current=null}
 },[retry])
 useEffect(()=>{
  if(!p.compare||!ready||!secondEl.current){setSecondReady(false);return}
  const base=primary.current!,map=new maplibregl.Map({container:secondEl.current,style:style(p.satellite),center:base.getCenter(),zoom:base.getZoom(),pitch:base.getPitch(),bearing:base.getBearing(),interactive:false,attributionControl:false,maxPitch:75,transformRequest:trackTile})
  secondary.current=map;map.on('load',()=>{map.jumpTo({center:base.getCenter(),zoom:base.getZoom(),pitch:base.getPitch(),bearing:base.getBearing()});setSecondReady(true)})
  map.on('error',observationError);map.on('idle',navigationReady)
  return()=>{map.remove();secondary.current=null;setSecondReady(false)}
 },[p.compare,ready])
 useEffect(()=>{if(ready&&primary.current){if(p.camera)primary.current.jumpTo(p.camera);else reset(primary.current)}},[p.scenario,ready,p.camera])
 useEffect(()=>{
  if(!ready||(p.compare&&!secondReady)){latest.current.onFrameState('loading');return}
  const active=[primary.current,...(p.compare?[secondary.current]:[])].filter(Boolean) as maplibregl.Map[]
  if(!active.length||!p.frames[p.step]||!p.frames[p.baseline])return
  const entries=active.map(map=>{
   const frame=p.frames[map===primary.current&&p.compare?p.baseline:p.step]
   const [w,s,e,n]=p.scenario.imageryExtent??p.scenario.extent,bbox=frame.bbox
   const maxzoom=frame.tileTemplate?20:14
   return {map,id:`observation-${p.scenario.id}-${frame.id}-z${maxzoom}-v8`,scenarioId:p.scenario.id,source:{type:'raster' as const,tiles:[frame.tileTemplate??`${window.location.origin}/api/imagery/tiles/${p.scenario.id}/${frame.id}/{z}/{x}/{y}.png?v=8`],tileSize:256,minzoom:8,maxzoom,bounds:[Math.max(w,bbox[0]),Math.max(s,bbox[1]),Math.min(e,bbox[2]),Math.min(n,bbox[3])] as [number,number,number,number],attribution:frame.attribution??'Contains modified Copernicus Sentinel data · Sentinel-2 L2A · Microsoft Planetary Computer'}}
  })
  stopWarm.current?.();frameReady.current=false;tileError.current=false
  const cancel=requestFrames(entries,{fadeMs:p.blink||matchMedia('(prefers-reduced-motion: reduce)').matches?0:400,onState:s=>{frameReady.current=s==='ready';latest.current.onFrameState(s);if(s==='ready')warm()},onCommit:()=>{applyAdjustments();latest.current.onDisplayed(p.scenario.id,p.frames[p.compare?p.baseline:p.step].id,p.frames[p.step].id)}})
  return()=>{stopWarm.current?.();frameReady.current=false;cancel()}
 },[p.frames,p.step,p.baseline,p.compare,p.scenario.id,ready,secondReady,retry,p.retryFrame])
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
  map.setLayoutProperty('capture-edge','visibility',p.satellite&&!globe?'visible':'none')
 }},[p.terrain,p.satellite,p.boundary,p.scenario,p.frames,p.step,ready,secondReady,globe])
 useEffect(()=>{primary.current?.easeTo({pitch:p.terrain?(p.camera?.pitch??p.scenario.pitch):0,duration:600})},[p.terrain])
 useEffect(()=>{
  if(!ready)return
  const maps=[primary.current,...(secondReady?[secondary.current]:[])].filter(Boolean) as maplibregl.Map[]
  const controller=new AbortController()
  const cleanups:(()=>void)[]=[]
  for(const map of maps){if(map.getLayer('radar-samples'))map.removeLayer('radar-samples');if(map.getSource('radar-samples'))map.removeSource('radar-samples')}
  if(p.scienceJob||p.studyOverlay){
   latest.current.onStatus('Loading radar components…')
   fetch(p.studyOverlay?`/api/science/study/supplied/${p.studyOverlay.layer}.geojson`:`/api/science/${p.scenario.id}/products/${p.scienceJob}/samples.geojson`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error('Processed radar samples could not be loaded');return response.json()}).then(data=>{
    if(controller.signal.aborted)return
    for(const map of maps){
     map.addSource('radar-samples',{type:'geojson',data})
     map.addLayer({id:'radar-samples',type:'circle',source:'radar-samples',paint:{'circle-radius':['interpolate',['linear'],['zoom'],9,1,14,4],'circle-opacity':0.8,'circle-color':['interpolate',['linear'],['get',p.component],-1,'#ae4764',0,'#f6f3ef',1,'#236b8c'],'circle-stroke-width':0.5,'circle-stroke-color':'#163b47'}})
     applyRadarPaint(map)
     const popup=new maplibregl.Popup({closeButton:true,maxWidth:'270px'})
     const click=(event:maplibregl.MapLayerMouseEvent)=>{
      const feature=event.features?.[0],values=feature?.properties
      if(!values||feature?.geometry.type!=='Point')return
      const content=document.createElement('div');content.className='radar-popup'
      const study=latest.current.studyOverlay
      if(latest.current.component==='backscatterChange')content.textContent=`GCOV backscatter change\nNewer − older: ${Number(values.backscatterChange).toFixed(3)} dB\nBaseline: ${Number(values.olderDb).toFixed(2)} dB\nNewer: ${Number(values.newerDb).toFixed(2)} dB\nPaired valid cells; no confirmed water/forest classification.`;
      else if(latest.current.component==='backscatterDb')content.textContent=`GCOV · calibrated backscatter\nPower: ${Number(values.power).toPrecision(5)}\nBackscatter: ${Number(values.backscatterDb).toFixed(2)} dB\nValid subswath: ${values.sourceMask}\nInput flags: ${values.inputExceptionMask??'Not supplied'}\nLooks: ${values.looks??'Not supplied'}\nLow return is not a confirmed water/forest class.`;
      else if(study){content.textContent=`NISAR pair / ${study.layer}\nMeasured endpoint: 23 Sep to 05 Oct 2026\nAlong-track: ${(Number(values.alongTrack)*12).toFixed(3)} m\nSlant range: ${(Number(values.slantRange)*12).toFixed(3)} m\nEndpoint 1 sigma: ${(Number(values.alongTrackSigma)*12).toFixed(3)} / ${(Number(values.slantRangeSigma)*12).toFixed(3)} m\nCorrelation: ${Number(values.correlation).toFixed(3)}\nSource measurements. Replay interpolates color and size at fixed locations; bias not corrected.`}
      else content.textContent=`Radar components (m/day)\nAlong-track: ${Number(values.alongTrack).toFixed(3)} ± ${Number(values.alongTrackSigma).toFixed(3)}\nSlant range: ${Number(values.slantRange).toFixed(3)} ± ${Number(values.slantRangeSigma).toFixed(3)}\nCorrelation: ${Number(values.correlation).toFixed(2)}\n1σ formal uncertainty. Bias not corrected.`
      popup.setLngLat(feature.geometry.coordinates as [number,number]).setDOMContent(content).addTo(map)
     }
     map.on('click','radar-samples',click);cleanups.push(()=>{map.off('click','radar-samples',click);popup.remove()})
    }
    latest.current.onStatus('Radar components visible')
   }).catch(error=>{if(!controller.signal.aborted)latest.current.onStatus(error.message)})
  }else latest.current.onStatus('3D map ready')
  return()=>{controller.abort();cleanups.forEach(cleanup=>cleanup())}
 },[p.scienceJob,p.studyOverlay?.layer,p.scenario.id,ready,secondReady])
 useEffect(()=>{for(const map of [primary.current,secondary.current])if(map?.getLayer('radar-samples'))applyRadarPaint(map)},[p.studyOverlay?.progress,p.studyOverlay?.threshold,p.studyOverlay?.scale,p.component,p.radarThreshold,globe])
 useEffect(()=>{
  if(!ready)return
  for(const map of [primary.current,secondReady?secondary.current:null])if(map){
   if(map.getLayer('index-study'))map.removeLayer('index-study')
   if(map.getSource('index-study'))map.removeSource('index-study')
   if(p.indexOverlay&&!globe){
    const frameId=map===primary.current&&p.compare?(p.indexOverlay.baselineId??p.indexOverlay.id):p.indexOverlay.id
    map.addSource('index-study',{type:'raster',tiles:[`${location.origin}/api/analysis/tiles/${p.scenario.id}/${frameId}/${p.indexOverlay.mode}/{z}/{x}/{y}.png`],tileSize:256,minzoom:8,maxzoom:14,bounds:p.scenario.extent})
    map.addLayer({id:'index-study',type:'raster',source:'index-study',paint:{'raster-opacity':0.85,'raster-resampling':'nearest'}},map.getLayer('boundary')?'boundary':undefined)
   }
  }
 },[p.indexOverlay?.id,p.indexOverlay?.baselineId,p.indexOverlay?.mode,p.scenario.id,ready,secondReady,globe])
 return <>{globe&&<Button variant="outline" className="globe-return" onClick={()=>primary.current&&reset(primary.current)}>Return to {p.scenario.name}</Button>}<div ref={firstEl} className="map-canvas" role="region" aria-label="Interactive Earth observation terrain map"/>{p.compare&&<div className="comparison-canvas" style={{clipPath:p.compareMode==='lens'?`circle(min(150px,27vw) at ${p.lens.x}% ${p.lens.y}%)`:`inset(0 0 0 ${p.split}%)`}}><div ref={secondEl} className="map-canvas"/></div>}{!ready&&!failure&&<div className="map-loading"><LoaderCircle className="spin" size={26}/><span>Loading the observation landscape…</span></div>}{failure&&<div className="map-error" role="alert"><MapPin size={30}/><h3>Let’s get your map back</h3><p>{failure}</p><Button onClick={()=>setRetry(v=>v+1)}><RotateCcw size={15}/>Retry map</Button></div>}</>
}
