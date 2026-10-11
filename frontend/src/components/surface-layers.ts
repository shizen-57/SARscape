import * as maplibregl from 'maplibre-gl'
import {CHANGE_STOPS,differenceGrid,insideOutline,mercator,surfaceCell,surfaceColor,type SurfaceScene,type GlacierOutline} from '../data/glacier-surfaces.mjs'

function canvas(scene:SurfaceScene){const c=document.createElement('canvas');[c.height,c.width]=scene.manifest.shape;return c}
function pixel(scene:SurfaceScene,lon:number,lat:number){const [x,y]=mercator(lon,lat),[w,s,e,n]=scene.manifest.bounds3857,[rows,cols]=scene.manifest.shape;return [(x-w)/(e-w)*cols,(n-y)/(n-s)*rows]}
function outlinePath(ctx:CanvasRenderingContext2D,scene:SurfaceScene,outline:GlacierOutline){
 const polygons=outline.geometry.type==='Polygon'?[outline.geometry.coordinates]:outline.geometry.coordinates
 ctx.beginPath();for(const polygon of polygons)for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const [x,y]=pixel(scene,lon,lat);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath()}
}
export function surfaceImage(scene:SurfaceScene):string{
 if((scene.mode==='velocity'||scene.mode==='elevation')&&scene.frame)return `/api/surfaces/${scene.scenario}/${scene.frame.image}`
 const c=canvas(scene),ctx=c.getContext('2d')!
 if(scene.mode==='extent'){
  const current=scene.outlines.features[scene.outlineIndex],first=scene.outlines.features[0]
  // Continuous polygon mask; show measured former ice area on today's imagery without synthetic ice.
  outlinePath(ctx,scene,first);ctx.fillStyle='rgba(242,154,96,.42)';ctx.fill('evenodd')
  ctx.globalCompositeOperation='destination-out';outlinePath(ctx,scene,current);ctx.fill('evenodd');ctx.globalCompositeOperation='source-over'
  outlinePath(ctx,scene,current);ctx.fillStyle='rgba(82,194,227,.65)';ctx.fill('evenodd')
 }else if(scene.mode==='change'){
  const values=differenceGrid(scene.grid,scene.baselineGrid)
  if(values){const image=ctx.createImageData(c.width,c.height);values.forEach((v,i)=>{if(v!==null)image.data.set([...surfaceColor(v,[-150,150],CHANGE_STOPS),230],i*4)});ctx.putImageData(image,0,0)}
 }
 return c.toDataURL('image/png')
}

export function removeSurface(map:maplibregl.Map){for(const id of ['glacier-surface','glacier-outline-history','glacier-outline-current'])if(map.getLayer(id))map.removeLayer(id);for(const id of ['glacier-surface','glacier-outlines'])if(map.getSource(id))map.removeSource(id)}
export function addSurface(map:maplibregl.Map,scene:SurfaceScene,hidden=false){
 removeSurface(map)
 map.addSource('glacier-surface',{type:'image',url:surfaceImage(scene),coordinates:scene.manifest.coordinates})
 map.addLayer({id:'glacier-surface',type:'raster',source:'glacier-surface',layout:{visibility:hidden?'none':'visible'},paint:{'raster-opacity':scene.opacity,'raster-resampling':'linear','raster-fade-duration':0}})
 map.addSource('glacier-outlines',{type:'geojson',data:scene.outlines})
 const year=scene.outlines.features[scene.outlineIndex].properties.year
 if(scene.mode==='extent')map.addLayer({id:'glacier-outline-history',type:'line',source:'glacier-outlines',filter:['==',['get','year'],scene.outlines.features[0].properties.year],layout:{visibility:hidden?'none':'visible'},paint:{'line-color':'#f29a60','line-width':1.5,'line-dasharray':[4,3],'line-opacity':.9}})
 map.addLayer({id:'glacier-outline-current',type:'line',source:'glacier-outlines',filter:['==',['get','year'],year],layout:{visibility:hidden?'none':'visible'},paint:{'line-color':scene.mode==='extent'?'#8adbed':'#cedeed','line-width':1.2,'line-opacity':.6}})
}
export function surfacePopup(scene:SurfaceScene,point:maplibregl.LngLat){
 const inside=insideOutline([point.lng,point.lat],scene.outlines.features[scene.outlineIndex].geometry)
 const cell=scene.grid?surfaceCell(scene.grid,point.lng,point.lat):null
 const root=document.createElement('div');root.className='surface-popup'
 const add=(tag:string,text:string)=>{const el=document.createElement(tag);el.textContent=text;root.append(el)}
 add('strong',scene.mode==='extent'?'Mapped glacier footprint':scene.mode==='change'?'Measured speed difference':scene.mode==='elevation'?'Measured surface elevation change':'Measured surface speed')
 add('p',`${point.lat.toFixed(5)}° N, ${point.lng.toFixed(5)}° E · ${inside?'Inside':'Outside'} ${scene.outlines.features[scene.outlineIndex].properties.year} glacier outline`)
 if(scene.mode==='extent'){add('h3',String(scene.outlines.features[scene.outlineIndex].properties.year));add('p',`${scene.outlines.features[scene.outlineIndex].properties.source} · ${scene.outlines.features[scene.outlineIndex].properties.areaKm2.toFixed(2)} km² mapped total area`)}
 else if(scene.mode==='elevation'){
  const value=cell?scene.grid?.elevationChange?.[cell.index]:null
  add('h3',value==null?'No elevation-change measurement':`${value>0?'+':''}${value.toFixed(2)} m/year`)
  add('p','Mean elevation-change rate, 2000-01-01 → 2020-01-01. Hugonnet et al. (2021), ASTER DEM time series. Formal uncertainty raster is not connected.')
  add('p','This rate measures surface lowering or gain over the interval. It does not provide absolute heights or individual intermediate DEM epochs.')
 }
 else if(cell&&cell.speed!==null){
  const delta=scene.mode==='change'?differenceGrid(scene.grid,scene.baselineGrid)?.[cell.index]:null
  add('h3',scene.mode==='change'?delta==null?'No common valid measurement':`${delta>0?'+':''}${delta.toFixed(1)} m/year`:`${cell.speed.toFixed(1)} m/year`)
  if(scene.mode==='change')add('p',`Current speed: ${cell.speed.toFixed(1)} m/year. Baseline: ${scene.baseline?.label}`)
  add('p',`Formal speed error: ${cell.error?.toFixed(1)??'unavailable'} m/year (does not include all systematic errors).`)
  if(cell.vx!==null&&cell.vy!==null)add('p',`Grid components: x ${cell.vx.toFixed(1)}, y ${cell.vy.toFixed(1)} m/year in ${scene.grid!.vectorCrs}. Geographic heading is not derived.`)
  add('p',`${scene.frame!.label} · ${scene.frame!.intervalDays} days · ${scene.frame!.source}`)
 }else add('h3',inside?'No accepted velocity measurement':'Outside the historical glacier mask')
 add('p',scene.mode==='elevation'?'Terrain geometry stays fixed because dated absolute DEM surfaces are not connected.':'Elevation-change rates have a separate 2000–2020 layer. Speed does not determine melting or surface lowering.')
 return root
}
