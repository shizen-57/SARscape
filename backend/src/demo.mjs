// Deterministic, explicitly synthetic observations. No NISAR measurements are generated here.
export function makeSamples(scenario, step) {
 const features = []
 const latScale = scenario.kind === 'glacier' ? 0.00125 : 0.006
 const lonScale = latScale / Math.cos(scenario.center[1] * Math.PI / 180)
 for(let segment=0; segment<scenario.path.length-1; segment++) {
  const a=scenario.path[segment], b=scenario.path[segment+1]
  for(let along=0;along<7;along++) for(let across=-2;across<=2;across++) {
   const t=along/7, id=segment*35+along*5+across+2
   const lat=a[1]+(b[1]-a[1])*t+across*latScale*0.55
   const lon=a[0]+(b[0]-a[0])*t+across*lonScale
   const wave=(Math.sin(id*1.73+step*0.32)+1)/2
   const value=scenario.kind==='glacier' ? 0.08+0.48*wave+0.08*Math.sin(step*0.45) : -5+10*wave
   const quality=0.35+0.64*((Math.sin(id*2.31)+1)/2)
   const dx=lonScale*0.43,dy=latScale*0.23
   const normalized=scenario.kind==='glacier'? Math.min(1,value/0.7):(value+5)/10
   const color=normalized<0.33?'#56b4c5':normalized<0.66?'#b5cc72':'#f4a45d'
   features.push({type:'Feature',id,geometry:{type:'Polygon',coordinates:[[[lon-dx,lat-dy],[lon+dx,lat-dy],[lon+dx,lat+dy],[lon-dx,lat+dy],[lon-dx,lat-dy]]]},properties:{id,value:Number(value.toFixed(3)),quality:Number(quality.toFixed(2)),color,dateIndex:step,unit:scenario.unit,synthetic:true,source:'SARscape illustrative demonstration; not NISAR measurements',longitude:lon,latitude:lat}})
  }
 }
 return {type:'FeatureCollection',features}
}
export function maskSamples(collection, enabled) { return {...collection,features:collection.features.filter(f=>!enabled||f.properties.quality>=0.6)} }
export function sampleHistory(scenario,id,count=10) { return Array.from({length:count},(_,step)=>makeSamples(scenario,step).features.find(f=>f.id===id)?.properties.value??0) }
export function makeExport(scenario,step,dates,qualityMask) { return {...maskSamples(makeSamples(scenario,step),qualityMask),metadata:{scenario:scenario.name,date:dates[step],synthetic:true,source:'Illustrative demonstration only; not derived from NISAR',unit:scenario.unit,qualityMask,qualityThreshold:qualityMask?0.6:null}} }
