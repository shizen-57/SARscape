import * as maplibregl from 'maplibre-gl'
import type {Feature,FeatureCollection,LineString,Point} from 'geojson'
import type {MotionCell,MotionPreview,MotionScene} from '../data/motion-preview.mjs'
import {gridToLonLat,lonLatToGrid,motionColor,pointOnPath} from '../data/motion-preview.mjs'

export type MotionLayers={heat:boolean;particles:boolean;raw:boolean}
const LAYERS=['motion-heat','motion-outline','motion-ribbons','motion-tails','motion-particles'] as const
const SOURCES=['motion-heat','motion-outline','motion-ribbons','motion-particles'] as const
const alpha=(confidence:number|null)=>0.5+0.5*Math.min(1,Math.max(0,confidence??0))

// One pixel per prepared cell. Preserve gaps; bilinear display does not add observations.
export function heatImage(preview:MotionPreview,scene:MotionScene,progress=1){
 const [rows,cols]=preview.grid!.shape,scale=8,small=document.createElement('canvas'),big=document.createElement('canvas')
 small.width=cols;small.height=rows;big.width=cols*scale;big.height=rows*scale
 const s=small.getContext('2d')!,image=s.createImageData(cols,rows)
 scene.cells.forEach((cell,i)=>{
  const value=scene.values[i];if(value===null||!scene.scale)return
  const [r,g,b]=motionColor(value*Math.max(0,Math.min(1,progress)),scene.scale,scene.mode).match(/\d+/g)!.map(Number),o=(cell.row*cols+cell.col)*4
  image.data.set([r,g,b,Math.round(255*(0.7+0.25*Math.min(1,Math.max(0,cell.confidence??0)))*Math.min(1,Math.abs(value)/scene.scale*3)*Math.max(0,Math.min(1,progress)))],o)
 })
 s.putImageData(image,0,0)
 const g=big.getContext('2d')!
 g.imageSmoothingEnabled=true;g.drawImage(small,0,0,big.width,big.height)
 const polygons=(typeof preview.grid!.outlinePixels[0]?.[0]?.[0]==='number'?[preview.grid!.outlinePixels]:preview.grid!.outlinePixels) as number[][][][]
 g.globalCompositeOperation='destination-in';g.beginPath()
 for(const polygon of polygons)for(const ring of polygon)ring.forEach(([x,y],i)=>i?g.lineTo(x*scale,y*scale):g.moveTo(x*scale,y*scale))
 g.fill('evenodd')
 return big.toDataURL('image/png')
}

const lonLat=(preview:MotionPreview,[col,row]:[number,number])=>gridToLonLat(preview.grid!.lonLatAffine,col,row)
function particleData(preview:MotionPreview,scene:MotionScene,progress:number):FeatureCollection{
 const features:Feature[]=[]
 for(const {seed,index,path} of scene.paths){
  const value=scene.values[index]
  if(value===null||!scene.scale)continue
  const properties={color:motionColor(value,scene.scale,scene.mode),opacity:alpha(seed.confidence),radius:3+3*Math.min(1,Math.max(0,seed.confidence??0))}
  const head=pointOnPath(path,progress),tail=[0.15,0.1,0.05,0].map(d=>lonLat(preview,pointOnPath(path,Math.max(0,progress-d))))
  features.push({type:'Feature',properties,geometry:{type:'Point',coordinates:lonLat(preview,head)}} as Feature<Point>)
  if(progress>0.02)features.push({type:'Feature',properties,geometry:{type:'LineString',coordinates:tail}} as Feature<LineString>)
 }
 return {type:'FeatureCollection',features}
}

const replayFrame=new WeakMap<maplibregl.Map,number>()

export function removeMotion(map:maplibregl.Map){
 replayFrame.delete(map)
 for(const id of LAYERS)if(map.getLayer(id))map.removeLayer(id)
 for(const id of SOURCES)if(map.getSource(id))map.removeSource(id)
}

export function addMotion(map:maplibregl.Map,preview:MotionPreview,scene:MotionScene,progress:number){
 removeMotion(map)
 replayFrame.set(map,Math.round(progress*30))
 const before=map.getLayer('radar-samples')?'radar-samples':undefined
 map.addSource('motion-heat',{type:'image',url:heatImage(preview,scene,progress),coordinates:preview.grid!.corners as [[number,number],[number,number],[number,number],[number,number]]})
 map.addLayer({id:'motion-heat',type:'raster',source:'motion-heat',paint:{'raster-opacity':0.98,'raster-resampling':'linear','raster-fade-duration':0}},before)
 map.addSource('motion-outline',{type:'geojson',data:{type:'Feature',properties:{},geometry:preview.outline!.geometry}})
 map.addLayer({id:'motion-outline',type:'line',source:'motion-outline',paint:{'line-color':'#79dce8','line-width':1.5,'line-opacity':0.9,'line-dasharray':[2,2]}},before)
 // Ribbons are each particle's whole exaggerated pair-long track; they follow the displayed field only.
 map.addSource('motion-ribbons',{type:'geojson',data:{type:'FeatureCollection',features:scene.paths.flatMap(({seed,index,path})=>{const value=scene.values[index];return value===null||!scene.scale?[]:[{type:'Feature',properties:{color:motionColor(value,scene.scale,scene.mode),opacity:0.12+0.3*Math.min(1,Math.max(0,seed.confidence??0))},geometry:{type:'LineString',coordinates:path.map(p=>lonLat(preview,p))}}]})} as FeatureCollection})
 map.addLayer({id:'motion-ribbons',type:'line',source:'motion-ribbons',layout:{'line-cap':'round'},paint:{'line-color':['get','color'],'line-opacity':['get','opacity'],'line-width':['interpolate',['linear'],['zoom'],11,1,15,3]}},before)
 map.addSource('motion-particles',{type:'geojson',data:particleData(preview,scene,progress)})
 map.addLayer({id:'motion-tails',type:'line',source:'motion-particles',filter:['==',['geometry-type'],'LineString'],layout:{'line-cap':'round'},paint:{'line-color':['get','color'],'line-opacity':['*',0.7,['get','opacity']],'line-width':['interpolate',['linear'],['zoom'],11,1.5,15,4]}},before)
 map.addLayer({id:'motion-particles',type:'circle',source:'motion-particles',filter:['==',['geometry-type'],'Point'],paint:{'circle-color':['get','color'],'circle-opacity':['get','opacity'],'circle-radius':['interpolate',['linear'],['zoom'],11,['get','radius'],15,['*',2,['get','radius']]],'circle-stroke-width':1,'circle-stroke-color':'#05080d','circle-stroke-opacity':['*',0.8,['get','opacity']]}},before)
}

export function showMotion(map:maplibregl.Map,layers:MotionLayers,globe:boolean){
 const set=(id:string,on:boolean)=>{if(map.getLayer(id))map.setLayoutProperty(id,'visibility',on&&!globe?'visible':'none')}
 set('motion-heat',layers.heat);set('motion-outline',true)
 for(const id of ['motion-ribbons','motion-tails','motion-particles'])set(id,layers.particles)
}

export function moveParticles(map:maplibregl.Map,preview:MotionPreview,scene:MotionScene,progress:number,particles=true){
 // Recolour the continuous field against the fixed endpoint scale, even with particles hidden.
 // Bound texture uploads to 31 frames per pair; the playback clock itself stays smooth.
 const frame=Math.round(Math.max(0,Math.min(1,progress))*30),source=map.getSource('motion-heat') as maplibregl.ImageSource|undefined
 if(source&&replayFrame.get(map)!==frame){replayFrame.set(map,frame);source.updateImage({url:heatImage(preview,scene,frame/30)})}
 if(particles)(map.getSource('motion-particles') as maplibregl.GeoJSONSource|undefined)?.setData(particleData(preview,scene,progress))
}

export function motionCellAt(preview:MotionPreview,scene:MotionScene,lngLat:maplibregl.LngLat){
 const [col,row]=lonLatToGrid(preview.grid!.lonLatAffine,lngLat.lng,lngLat.lat)
 return scene.cells.find(cell=>cell.row===Math.floor(row)&&cell.col===Math.floor(col))
}

export function motionPopup(cell:MotionCell,preview:MotionPreview,scene:MotionScene,component:'alongTrack'|'slantRange',mode:'pair'|'rate',progress=1){
 const root=document.createElement('div');root.className='radar-popup radar-visual-popup motion-popup'
 const add=(parent:HTMLElement,tag:string,text:string,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;parent.append(el);return el}
 const days=preview.pairDays,unit=mode==='pair'?'m':'m/day',factor=mode==='pair'?days*progress:1
 const n=(v:number|null|undefined,digits=2)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(digits):'—'
 const value=scene.values[scene.cells.indexOf(cell)]
 add(root,'strong',scene.mode==='flow'?'Estimated surface speed':component==='alongTrack'?'Along-track component, relative to stable rock':'Slant-range component, relative to stable rock')
 add(root,'span',mode==='pair'&&progress>0&&progress<1?'Interpolated replay snapshot · not observed':'Approximate · not validated','motion-popup-flag')
 add(root,'div',value===null?'—':`${value>0&&scene.mode!=='flow'?'+':''}${(value*factor).toFixed(mode==='pair'?1:2)} ${unit}`,'radar-popup-value')
 add(root,'p',`${cell.measured?'This cell passed every filter.':'Estimated from neighbouring cells only.'} ${cell.support} of 25 cells in its 400 m window support it · confidence ${Math.round(100*(cell.confidence??0))}%.`,'radar-popup-caption')
 const details=document.createElement('details');details.className='radar-measurement-details';root.append(details);add(details,'summary','Measurement details')
 const list=add(details,'dl',''),row=(label:string,text:string)=>{const r=add(list,'div','');add(r,'dt',label);add(r,'dd',text)}
 row('Raw GOFF rate at this cell',cell.rawAlongTrack===null?'No accepted measurement':`along-track ${n(cell.rawAlongTrack)} · slant-range ${n(cell.rawSlantRange)} m/day · correlation ${n(cell.rawCorrelation)}`)
 row('Stable-ground offset removed',`along-track ${n(preview.stableGround?.alongTrack)} · slant-range ${n(preview.stableGround?.slantRange)} m/day`)
 row('Displayed (400 m median)',`along-track ${n(cell.alongTrack)} · slant-range ${n(cell.slantRange)} m/day`)
 if(scene.mode==='flow')row('Estimated horizontal flow',`east ${n(cell.east)} · north ${n(cell.north)} m/day`)
 row('Stable-rock noise floor',`along-track ${n(preview.stableGround?.noiseFloor.alongTrack)} · slant-range ${n(preview.stableGround?.noiseFloor.slantRange)} m/day`)
 add(details,'p','Raw rates are GOFF offsets divided by the pair duration. Turn on Raw samples to inspect each original sample with its formal 1σ uncertainty.')
 return root
}
