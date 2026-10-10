// A frame pair becomes visible atomically. Cancellation invalidates every old listener.
export function requestFrames(entries,{onState,onCommit,timeoutMs=180000,fadeMs=0,retain=1}){
 let cancelled=false,done=false,committed=false
 const previous=new Map()
 const cleanups=[],loaded=new Set()
 const detach=()=>{for(const cleanup of cleanups)cleanup()}
 const discardPending=()=>{for(const {map,id} of entries){for(const [layer,opacity] of previous.get(map)??[])if(map.getLayer(layer))map.setPaintProperty(layer,'raster-opacity',opacity);if(map.getLayer(id)&&!(previous.get(map)??[]).some(([layer])=>layer===id)){map.removeLayer(id);map.removeSource(id)}}}
 const fail=()=>{if(cancelled||done)return;done=true;detach();discardPending();onState('error')}
 onState('loading')
 const timer=setTimeout(fail,timeoutMs);cleanups.push(()=>clearTimeout(timer))
 const commit=()=>{
  if(cancelled||done||loaded.size!==entries.length)return
  done=true
  for(const {map,id} of entries){
   // Rebuild the draped layer after its pixels are available. Terrain's cached
   // surface can otherwise retain the faint loading texture after an opacity change.
   const current=map.getStyle().layers.find(layer=>layer.id===id)
   const alreadyVisible=(previous.get(map)??[]).some(([layer])=>layer===id)
   map.removeLayer(id)
   map.addLayer({...current,paint:{...current.paint,'raster-opacity':fadeMs&&!alreadyVisible?0.001:1,'raster-opacity-transition':{duration:fadeMs,delay:0}}},map.getLayer('index-study')?'index-study':map.getLayer('boundary')?'boundary':undefined)
   if(!fadeMs)map.setPaintProperty(id,'raster-opacity',1)
  }
  detach()
  // Loaded image bytes are not yet a rendered terrain texture. Announce the date
  // only after both maps have drawn the newly visible layers.
  const finish=()=>{
  if(cancelled)return
  committed=true
  for(const {map,id} of entries){
   for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-')&&layer.id!==id)map.setPaintProperty(layer.id,'raster-opacity',0)
   const old=(map.getStyle().layers??[]).filter(l=>l.id.startsWith('observation-')&&l.id!==id)
   while(old.length>retain){const layer=old.shift();map.removeLayer(layer.id);map.removeSource(layer.id)}
  }
  let drawn=0
  for(const {map} of entries){
   const rendered=()=>{map.off('render',rendered);if(cancelled)return;if(++drawn===entries.length){onCommit();onState('ready')}}
   map.on('render',rendered);cleanups.push(()=>map.off('render',rendered));map.triggerRepaint()
  }
  }
  if(fadeMs){
   let staged=0
   for(const {map} of entries){
    const begin=()=>{map.off('render',begin);if(cancelled)return;if(++staged===entries.length){for(const {map,id} of entries)map.setPaintProperty(id,'raster-opacity',1);const fade=setTimeout(finish,fadeMs);cleanups.push(()=>clearTimeout(fade))}}
    map.on('render',begin);cleanups.push(()=>map.off('render',begin));map.triggerRepaint()
   }
  }else finish()
 }
 for(const {map,id,source,scenarioId} of entries){
  // Never show the previous glacier under the newly selected glacier's heading.
  for(const layer of map.getStyle().layers??[])if(layer.id.startsWith('observation-')&&!layer.id.startsWith(`observation-${scenarioId}-`)){map.removeLayer(layer.id);map.removeSource(layer.id)}
  previous.set(map,(map.getStyle().layers??[]).filter(layer=>layer.id.startsWith('observation-')&&layer.paint?.['raster-opacity']===1).map(layer=>[layer.id,1]))
  if(map.getSource(id)&&map.getSource(id).__failed){map.removeLayer(id);map.removeSource(id)}
  if(!map.getSource(id)){
   map.addSource(id,source)
   map.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':0.001,'raster-fade-duration':0}},map.getLayer('index-study')?'index-study':map.getLayer('boundary')?'boundary':undefined)
  }
  const check=()=>{if(cancelled||done||!map.isSourceLoaded(id))return;loaded.add(map);commit()}
  const error=e=>{if(cancelled||done)return;if(e.sourceId===id||e.error?.message?.includes(source.tiles[0].split('/{z}')[0])){const source=map.getSource(id);if(source)source.__failed=true;fail()}}
  map.on('sourcedata',check);map.on('idle',check);map.on('error',error)
  cleanups.push(()=>{map.off('sourcedata',check);map.off('idle',check);map.off('error',error)})
  check()
 }
 return()=>{cancelled=true;detach();if(!committed)discardPending()}
}
