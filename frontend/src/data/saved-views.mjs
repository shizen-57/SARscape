const range=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max
const identifier=value=>typeof value==='string'&&value.length<=250
export function validCamera(camera){return camera==null||(Array.isArray(camera.center)&&camera.center.length===2&&range(camera.center[0],-180,180)&&range(camera.center[1],-85,85)&&range(camera.zoom,0,22)&&range(camera.pitch,0,75)&&Number.isFinite(camera.bearing))}
export function readSavedViews(raw,scenarios){
 try{
  const parsed=JSON.parse(raw??'[]');if(!Array.isArray(parsed))return []
  return parsed.filter(v=>v&&identifier(v.name)&&scenarios.some(s=>s.id===v.scenario)&&Number.isInteger(v.step)&&v.step>=0&&typeof v.terrain==='boolean'&&typeof v.satellite==='boolean'&&validCamera(v.camera)).slice(0,10).map(v=>{
   const source=['sentinel2','reference','swissimage'].includes(v.imagerySource)&&!(v.imagerySource==='swissimage'&&v.scenario!=='aletsch')?v.imagerySource:v.scenario==='aletsch'?'swissimage':'sentinel2'
   const a=v.adjustments,l=v.lens,o=v.studyOverlay
   return {version:2,name:v.name,scenario:v.scenario,step:v.step,terrain:v.terrain,satellite:v.satellite,camera:v.camera??null,imagerySource:source,
    frameId:identifier(v.frameId)?v.frameId:undefined,baselineId:identifier(v.baselineId)?v.baselineId:undefined,baseline:Number.isInteger(v.baseline)&&v.baseline>=0?v.baseline:0,
    compare:v.compare===true,compareMode:v.compareMode==='swipe'?'swipe':'lens',split:range(v.split,10,90)?v.split:50,
    lens:l&&range(l.x,5,95)&&range(l.y,15,80)?{x:l.x,y:l.y}:{x:50,y:45},boundary:v.boundary===true,
    adjustments:a&&range(a.brightness,.5,1)&&range(a.contrast,-.5,.5)&&range(a.saturation,-1,1)?{brightness:a.brightness,contrast:a.contrast,saturation:a.saturation}:{brightness:1,contrast:0,saturation:0},
    studyOverlay:v.scenario==='aletsch'&&o&&['layer1','layer2','layer3'].includes(o.layer)&&range(o.threshold,0,1)&&range(o.progress,0,1)&&range(o.scale,.0001,1e7)?{layer:o.layer,threshold:o.threshold,progress:o.progress,scale:o.scale}:null,
    environmentMode:source==='sentinel2'&&['index','change'].includes(v.environmentMode)&&scenarios.find(s=>s.id===v.scenario)?.kind!=='glacier'?v.environmentMode:null,
    lowReturn:v.lowReturn===true,backscatterThreshold:range(v.backscatterThreshold,-40,0)?v.backscatterThreshold:-18,scienceJob:identifier(v.scienceJob)?v.scienceJob:undefined,component:v.component==='backscatterChange'?'backscatterChange':v.component==='slantRange'?'slantRange':v.component==='backscatterDb'?'backscatterDb':'alongTrack'}
  })
 }catch{return []}
}
export function savedFrameIndex(frames,id,fallback=0){const index=frames.findIndex(f=>f.id===id);return index>=0?index:Math.min(Math.max(0,fallback),Math.max(0,frames.length-1))}
