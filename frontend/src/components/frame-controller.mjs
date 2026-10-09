// A frame pair becomes visible atomically. Cancellation invalidates every old listener.
export function requestFrames(entries,{onState,onCommit,timeoutMs=180000}){
 let cancelled=false,done=false
 const cleanups=[],loaded=new Set()
 const detach=()=>{for(const cleanup of cleanups)cleanup()}
 const discardPending=()=>{for(const {map,id} of entries){const layer=map.getStyle()?.layers?.find(layer=>layer.id===id);if(layer&&layer.paint?.['raster-opacity']!==1){map.removeLayer(id);map.removeSource(id)}}}
 const fail=()=>{if(cancelled||done)return;done=true;detach();discardPending();onState('error')}
 onState('loading')
 const timer=setTimeout(fail,timeoutMs);cleanups.push(()=>clearTimeout(timer))
 const commit=()=>{
  if(cancelled||done||loaded.size!==entries.length)return
  done=true
  for(const {map,id} of entries){
   for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-'))map.setPaintProperty(layer.id,'raster-opacity',layer.id===id?1:0)
   // Rebuild the draped layer after its pixels are available. Terrain's cached
   // surface can otherwise retain the faint loading texture after an opacity change.
   const current=map.getStyle().layers.find(layer=>layer.id===id)
   map.removeLayer(id)
   map.addLayer({...current,paint:{...current.paint,'raster-opacity':1}},map.getLayer('boundary')?'boundary':undefined)
   const old=(map.getStyle().layers??[]).filter(l=>l.id.startsWith('observation-')&&l.id!==id)
   while(old.length>2){const layer=old.shift();map.removeLayer(layer.id);map.removeSource(layer.id)}
  }
  detach()
  // Loaded image bytes are not yet a rendered terrain texture. Announce the date
  // only after both maps have drawn the newly visible layers.
  let drawn=0
  for(const {map} of entries){
   const rendered=()=>{map.off('render',rendered);if(cancelled)return;if(++drawn===entries.length){onCommit();onState('ready')}}
   map.on('render',rendered);cleanups.push(()=>map.off('render',rendered));map.triggerRepaint()
  }
 }
 for(const {map,id,source,scenarioId} of entries){
  // Never show the previous glacier under the newly selected glacier's heading.
  for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-')&&!layer.id.startsWith(`observation-${scenarioId}-`)){map.removeLayer(layer.id);map.removeSource(layer.id)}
  if(map.getSource(id)&&map.getSource(id).__failed){map.removeLayer(id);map.removeSource(id)}
  if(!map.getSource(id)){
   map.addSource(id,source)
   map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':0.001,'raster-fade-duration':0}},map.getLayer('boundary')?'boundary':undefined)
  }
  const check=()=>{if(cancelled||done||!map.isSourceLoaded(id))return;loaded.add(map);commit()}
  const error=e=>{if(cancelled||done)return;if(e.sourceId===id||e.error?.message?.includes(source.tiles[0].split('/{z}')[0])){const source=map.getSource(id);if(source)source.__failed=true;fail()}}
  map.on('sourcedata',check);map.on('idle',check);map.on('error',error)
  cleanups.push(()=>{map.off('sourcedata',check);map.off('idle',check);map.off('error',error)})
  check()
 }
 return()=>{cancelled=true;detach();if(!done)discardPending()}
}
