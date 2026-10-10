import {Radar,X} from 'lucide-react'
import {Button} from './ui'
import type {ScienceJob} from './SciencePanel'

export type RadarComponent='alongTrack'|'slantRange'
export type RadarDisplayMode='pair'|'rate'
export type RadarDisplaySummary={scale:number|null;count:number;error?:string}
export default function RadarControls({job,component,mode,summary,onComponent,onMode,onHide}:{job:ScienceJob;component:RadarComponent;mode:RadarDisplayMode;summary:RadarDisplaySummary|null;onComponent:(v:RadarComponent)=>void;onMode:(v:RadarDisplayMode)=>void;onHide:()=>void}){
 const days=job.provenance?.pairDays??0,unit=mode==='pair'?'m':'m/day'
 const scale=summary?.scale,format=(v:number)=>v.toLocaleString(undefined,{maximumFractionDigits:1})
 return <section className="radar-component-controls radar-visual-controls" aria-label="Radar displacement visualization">
  <div className="radar-control-heading"><strong><Radar size={16}/>Radar displacement</strong><Button variant="ghost" size="icon" aria-label="Hide radar visualization" onClick={onHide}><X size={16}/></Button></div>
  <div className="radar-display-modes" aria-label="Measurement view">
   <button aria-pressed={mode==='pair'} onClick={()=>onMode('pair')}>Over {days.toFixed(0)} days</button>
   <button aria-pressed={mode==='rate'} onClick={()=>onMode('rate')}>Daily rate</button>
  </div>
  {summary?.error&&<p className="radar-layer-error" role="alert">{summary.error} Hide this layer and select NISAR to retry.</p>}
  <label className="radar-component-label">Radar direction<select value={component} onChange={e=>onComponent(e.target.value as RadarComponent)}><option value="alongTrack">Along the satellite track</option><option value="slantRange">Along the radar line of sight</option></select></label>
  <div className="radar-visual-key"><div className="radar-color-ramp" aria-hidden="true"/><div className="radar-scale-values"><span>{scale!==null&&scale!==undefined?`−${format(scale)} ${unit}`:'Loading…'}</span><span>0</span><span>{scale!==null&&scale!==undefined?`+${format(scale)} ${unit}`:'Loading…'}</span></div><div className="radar-sign-labels"><span>Negative</span><span>Positive</span></div></div>
  <div className="radar-size-key"><span className="radar-key-mark small"/><span className="radar-key-mark large"/><span>Larger marks = greater {mode==='pair'?'displacement':'rate'}</span></div>
  <p className="radar-read-hint">Select a mark for the measurements.</p>
  <details className="radar-key-details"><summary>How to read this layer</summary><p>Color shows the component’s sign. Fainter marks have lower correlation. The display range uses the 95th percentile; values beyond it share the end color and largest size.</p><p>These are radar-coordinate measurements across the study area. Glacier flow direction and terrain deformation need further analysis. Gaps have no accepted samples.</p></details>
 </section>
}
