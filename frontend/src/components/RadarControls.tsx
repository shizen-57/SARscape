import {useState} from 'react'
import {ArrowDownToLine,ChevronDown,ChevronUp,Focus,Radar,X} from 'lucide-react'
import {Button} from './ui'
import type {ScienceJob} from './SciencePanel'
import type {MotionPreview,MotionScene} from '../data/motion-preview.mjs'
import {MOTION_STOPS} from '../data/motion-preview.mjs'
import type {MotionLayers} from './motion-layers'

export type RadarComponent='alongTrack'|'slantRange'
export type RadarDisplayMode='pair'|'rate'
export type RadarDisplaySummary={scale:number|null;count:number;error?:string}
const ramp=(mode:'flow'|'components')=>`linear-gradient(90deg,${MOTION_STOPS[mode].map(([at,c])=>`rgb(${c.join(',')}) ${mode==='flow'?at*100:(at+1)*50}%`).join(',')})`
const fixed=(v:number|null|undefined,digits=2)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(digits):'—'
const dateOnly=(v:string)=>v.slice(0,10)
export default function RadarControls({job,component,mode,summary,onComponent,onMode,onHide,preview,scene,layers,onLayers,scenario,progress,enhanced,onEnhanced,onFocus,onBroader}:{job:ScienceJob;component:RadarComponent;mode:RadarDisplayMode;summary:RadarDisplaySummary|null;onComponent:(v:RadarComponent)=>void;onMode:(v:RadarDisplayMode)=>void;onHide:()=>void;preview:MotionPreview|null;scene:MotionScene|null;layers:MotionLayers;onLayers:(v:MotionLayers)=>void;scenario:string;progress:number;enhanced:boolean;onEnhanced:(v:boolean)=>void;onFocus:()=>void;onBroader?:()=>void}){
 const [collapsed,setCollapsed]=useState(false)
 const days=job.provenance?.pairDays??0,unit=mode==='pair'?'m':'m/day',factor=mode==='pair'?days:1
 const scale=summary?.scale,format=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:1})
 const motion=preview&&preview.status!=='unavailable'&&scene?scene:null,q=preview?.quality,axis=component==='alongTrack'?'satellite-track':'ground-projected line-of-sight'
 const link=(file:string)=>`/api/science/${scenario}/products/${job.id}/${file}`
 const exportEvidence=()=>{const evidence={schema:'sarscape-replay-evidence-v1',jobId:job.id,provenance:job.provenance,component,mode,progress,intermediateFrames:'Linear interpolation only; no extra acquisitions',displayScale:scene?.scale,travelExaggeration:scene?.exaggeration,visibleLayers:layers,enhancedContrast:enhanced,motionPreview:preview};const url=URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`sarscape-${job.id}-replay-evidence.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className={`radar-component-controls radar-visual-controls${collapsed?' is-collapsed':''}`} aria-label="Radar displacement visualization">
  <div className="radar-control-heading"><strong><Radar size={16}/>{motion?'See the radar change':'Radar displacement'}</strong><div className="radar-control-actions"><Button variant="ghost" size="icon" aria-label={collapsed?'Expand radar controls':'Collapse radar controls'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</Button><Button variant="ghost" size="icon" aria-label="Hide radar visualization" onClick={onHide}><X size={16}/></Button></div></div>
  {!collapsed&&<div className="radar-controls-body">
  {motion&&q&&<><div className={`motion-quality grade-${q.grade}`} role="status"><span>Quality · {q.grade[0].toUpperCase()+q.grade.slice(1)}</span><span>Approximate · not validated</span></div>
   <p className="motion-mode">{motion.cells.length<50?`Only ${motion.cells.length} display cells: too little coverage to reveal a glacier-wide pattern.`:'Radar components · not glacier-flow direction.'}</p>
   {motion.cells.length<50&&onBroader&&<Button variant="outline" size="small" onClick={onBroader}>Use broader coverage · layer3</Button>}</>}
  {preview?.status==='unavailable'&&<p className="motion-mode">Motion preview unavailable: {preview.reason} Choose Glacier surfaces for the measured glacier-wide raster.</p>}
  {motion&&<div className="replay-reading"><strong>{mode==='rate'?'Daily rate · no time animation':progress<.01?'Reference · displacement starts at zero':progress>.99?'Endpoint · full filtered displacement':'Replay · displacement building'}</strong><p>Orange/cyan areas build up. The ice image stays fixed.</p><div className="replay-build"><span style={{width:`${Math.round(progress*100)}%`}}/></div><span>{Math.round(progress*100)}% of the pair · {motion.cells.length.toLocaleString()} display cells</span><Button variant="outline" size="small" onClick={onFocus}><Focus size={14}/>Focus on measurements</Button><label className="replay-contrast"><input type="checkbox" checked={enhanced} onChange={e=>onEnhanced(e.target.checked)}/>Emphasize subtle change</label><small>{enhanced?'Narrower colour range (3× contrast); measured numbers stay unchanged.':'Standard fixed colour range.'} End colours include values beyond the legend.</small></div>}
  <div className="radar-display-modes" aria-label="Measurement view">
   <button aria-pressed={mode==='pair'} onClick={()=>onMode('pair')}>Over {days.toFixed(0)} days</button>
   <button aria-pressed={mode==='rate'} onClick={()=>onMode('rate')}>Daily rate</button>
  </div>
  {summary?.error&&<p className="radar-layer-error" role="alert">{summary.error} Hide this layer and select NISAR to retry.</p>}
  {(!motion||motion.mode==='components')&&<label className="radar-component-label">Radar direction<select value={component} onChange={e=>onComponent(e.target.value as RadarComponent)}><option value="alongTrack">Along the satellite track</option><option value="slantRange">Along the radar line of sight</option></select></label>}
  {motion?<>
   <div className="radar-visual-key"><div className="radar-color-ramp" style={{background:ramp(motion.mode)}} aria-hidden="true"/>
    <div className="radar-scale-values">{motion.scale===null?<span>No values</span>:motion.mode==='flow'?<><span>0</span><span>{fixed(motion.scale*factor)} {unit}</span></>:<><span>−{fixed(motion.scale*factor)} {unit}</span><span>0</span><span>+{fixed(motion.scale*factor)} {unit}</span></>}</div>
    <div className="radar-sign-labels">{motion.mode==='flow'?<><span>Slower</span><span>Faster (estimated)</span></>:<><span>{component==='alongTrack'?'Against flight direction':'Towards radar'}</span><span>{component==='alongTrack'?'With flight direction':'Away from radar'}</span></>}</div></div>
   <p className="radar-read-hint">Orange = negative; cyan = positive. During replay, colour builds from zero to the filtered endpoint. Fainter areas can mean smaller displacement or lower confidence. Gaps have no supported data. Intermediate states are interpolated.</p>
   {layers.particles&&<p className="motion-travel">{motion.paths.length?<>Particle travel exaggerated <strong>×{motion.exaggeration}</strong>, {motion.mode==='flow'?'along the estimated flow':`along the ${axis} axis: a measured component, not flow direction. Signs follow the assumed ISCE3 convention`}.</>:preview!.geometry?.reason??'No particle paths for this view.'}</p>}
   <fieldset className="motion-layer-toggles"><legend>Show</legend>
    <label><input type="checkbox" checked={layers.particles} disabled={!motion.paths.length} onChange={e=>onLayers({...layers,particles:e.target.checked})}/>Particles</label>
    <label><input type="checkbox" checked={layers.heat} onChange={e=>onLayers({...layers,heat:e.target.checked})}/>Heatmap</label>
    <label><input type="checkbox" checked={layers.raw} onChange={e=>onLayers({...layers,raw:e.target.checked})}/>Raw samples</label>
   </fieldset>
   <p className="radar-read-hint">Select the glacier for cell values. Raw rings open the original GOFF samples.</p>
   <details className="radar-key-details motion-details"><summary>Assumptions, filters &amp; sources</summary><p>{preview!.reason}</p>
    <p><strong>Measured:</strong> {preview!.measured}. <strong>Estimated here:</strong> {preview!.estimated}.</p>
    <p>Playback: only {dateOnly(preview!.referenceDate)} and {dateOnly(preview!.secondaryDate)} are NISAR acquisitions. Dates between them are interpolated assuming a steady rate; no daily measurements exist.</p>
    <h4>Filtering (glacier cells)</h4>
    <dl className="motion-filter-list">{preview!.filters?.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.cells.toLocaleString()}</dd></div>)}</dl>
    <ul>{q?.reasons.map(r=><li key={r}>{r}</li>)}</ul>
    <p>Stable-rock noise floor after the same filters: {fixed(preview!.stableGround?.noiseFloor.alongTrack)} along-track, {fixed(preview!.stableGround?.noiseFloor.slantRange)} slant-range{preview!.stableGround?.noiseFloor.speed!=null?`, ${fixed(preview!.stableGround?.noiseFloor.speed)} horizontal`:''} m/day. Flow direction is shown only if glacier values reach {preview!.method?.signalRatio}× this floor over at least {Math.round(100*(preview!.method?.minimumCoverage??0))}% of the outline.</p>
    <h4>Viewing geometry</h4>
    {preview!.geometry?.available?<><p>From the product’s radarGrid cubes: heading {fixed(preview!.geometry.headingDeg,1)}°, incidence {fixed(preview!.geometry.incidenceDeg,1)}°, range increases towards {fixed(preview!.geometry.rangeIncreaseAzimuthDeg,0)}°.</p><ul>{preview!.geometry.assumptions?.map(a=><li key={a}>{a}</li>)}</ul></>:<p>{preview!.geometry?.reason}</p>}
    <h4>Glacier outline</h4>
    <p>{preview!.outline?.name} ({preview!.outline?.sgiId}), {preview!.outline?.outlineYear} outline, <a className="text-link" href={preview!.outline?.sourceUrl} target="_blank" rel="noreferrer">Swiss Glacier Inventory 2016</a>, {preview!.outline?.license}. {preview!.outline?.limitation} {preview!.outline?.mask}</p>
    <p className="motion-citation">{preview!.outline?.citation}</p>
    <p>Offset layer {preview!.layer} · {preview!.polarization}. <a className="text-link" href={link('motion-preview.json')}>Preview data</a> · <a className="text-link" href={link('provenance.json')}>Provenance</a></p>
   </details>
  </>:<>
   <p className="radar-read-hint">A continuous motion preview is not available for this observation. Original radar samples remain available as optional diagnostics.</p>
   <label><input type="checkbox" checked={layers.raw} onChange={e=>onLayers({...layers,raw:e.target.checked})}/> Inspect raw sample diagnostics</label>
   {layers.raw&&<>
   <div className="radar-visual-key"><div className="radar-color-ramp" aria-hidden="true"/><div className="radar-scale-values"><span>{scale!==null&&scale!==undefined?`−${format(scale)} ${unit}`:'Loading…'}</span><span>0</span><span>{scale!==null&&scale!==undefined?`+${format(scale)} ${unit}`:'Loading…'}</span></div><div className="radar-sign-labels"><span>Negative</span><span>Positive</span></div></div>
   <div className="radar-size-key"><span className="radar-key-mark small"/><span className="radar-key-mark large"/><span>Larger marks = greater {mode==='pair'?'displacement':'rate'}</span></div>
   <p className="radar-read-hint">Select a mark for the measurements.</p>
   <details className="radar-key-details"><summary>How to read this layer</summary><p>Color shows the component’s sign. Fainter marks have lower correlation. The display range uses the 95th percentile; values beyond it share the end color and largest size.</p><p>These are radar-coordinate measurements across the study area. Glacier flow direction and terrain deformation need further analysis. Gaps have no accepted samples.</p></details>
   </>}
  </>}
  <Button variant="outline" size="small" onClick={exportEvidence}><ArrowDownToLine size={14}/>Export replay evidence</Button></div>}
 </section>
}
