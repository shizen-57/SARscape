import {useState,type ReactNode} from 'react'
import {ArrowRight,ChevronDown,ChevronUp,Database,Layers2,LoaderCircle,Pause,Play,Radar} from 'lucide-react'
import {Button} from './ui'
import type {ScienceJob} from './SciencePanel'
import {completedRadarJobs,radarDateMilliseconds} from '../data/radar-display.mjs'
import {pairFrame} from '../data/motion-preview.mjs'

export type ObservationSource='optical'|'radar'|'surface'
const dateLabel=(date:string,includeYear=false)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',...(includeYear?{year:'numeric' as const}:{}),timeZone:'UTC'}).format(new Date(radarDateMilliseconds(date)))
export default function ObservationTimeline({source,onSource,jobs,selected,onSelect,pending,error,aerial,dated=false,glacier=true,onOpenData,progress,playing,onPlay,onScrub,speed,onSpeed,children}:{source:ObservationSource;onSource:(s:ObservationSource)=>void;jobs:ScienceJob[];selected:ScienceJob|null;onSelect:(j:ScienceJob)=>void;pending:boolean;error:boolean;aerial:boolean;dated?:boolean;glacier?:boolean;onOpenData:()=>void;progress:number;playing:boolean;onPlay:()=>void;onScrub:(v:number)=>void;speed:number;onSpeed:(v:number)=>void;children:ReactNode}){
 const [compact,setCompact]=useState(false)
 const completed=completedRadarJobs(jobs),years=[...new Set(completed.map(j=>j.provenance.referenceDate.slice(0,4)))]
 const selectedYear=selected?.provenance?.referenceDate.slice(0,4)??years[0]
 const yearJobs=completed.filter(j=>j.provenance.referenceDate.startsWith(selectedYear??''))
 const pair=selected?.provenance,frame=pair?pairFrame(progress,pair.referenceDate,pair.secondaryDate):null,currentDate=frame?.date??null
 return <section className={`timeline observation-timeline ${source==='radar'?'radar-timeline':''}${compact?' is-compact':''}`} aria-label="Observation timeline">
  <div className="observation-source-row"><div className="observation-source-switch" aria-label="Observation source">
   {glacier&&<button aria-pressed={source==='surface'} onClick={()=>onSource('surface')}><Layers2 size={15}/><span>Glacier surfaces</span></button>}
   <button aria-pressed={source==='optical'} onClick={()=>onSource('optical')}><Layers2 size={15}/><span>{aerial?'Aerial imagery':dated?'Satellite imagery':'Reference imagery'}</span></button>
   <button aria-pressed={source==='radar'} onClick={()=>onSource('radar')}><Radar size={15}/><span>NISAR radar</span>{completed.length>0&&<span className="observation-count">{completed.length}</span>}</button>
  </div><label className="playback-speed">Speed <select aria-label="Playback speed" value={speed} onChange={e=>onSpeed(+e.target.value)}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><Button variant="ghost" size="small" onClick={onOpenData}><Database size={14}/><span>Data & sources</span></Button><Button variant="ghost" size="icon" aria-label={compact?'Expand timeline':'Collapse timeline'} aria-expanded={!compact} onClick={()=>setCompact(v=>!v)}>{compact?<ChevronUp size={16}/>:<ChevronDown size={16}/>}</Button></div>
  {source!=='radar'?children:<div className="radar-date-hierarchy">
   {pending?<p className="radar-timeline-message" role="status"><LoaderCircle size={16} className="spin"/>Loading radar observations…</p>:error?<p className="radar-timeline-message" role="alert">Could not load observations. Open Data & sources to retry.</p>:!completed.length?<div className="radar-timeline-empty"><p>No processed NISAR pairs for this study area yet.</p><Button variant="outline" size="small" onClick={onOpenData}>Import an observation<ArrowRight size={14}/></Button></div>:<>
    <details className="radar-pair-picker"><summary>Acquisition pair · {pair?`${dateLabel(pair.referenceDate,true)} → ${dateLabel(pair.secondaryDate)} · ${pair.layer}`:"Choose dates"}<span>Change pair</span></summary><div className="observation-year-row"><span>Year</span><div aria-label="Radar observation year">{years.map(year=><button key={year} aria-pressed={selectedYear===year} onClick={()=>onSelect(completed.find(j=>j.provenance.referenceDate.startsWith(year))!)}>{year}</button>)}</div><span>{yearJobs.length} acquisition {yearJobs.length===1?'pair':'pairs'}</span></div>
    <div className="radar-pair-row"><span>Acquisition dates</span><div className="radar-pair-track" aria-label={`Acquisition pairs in ${selectedYear}`}>
     {yearJobs.map(job=>{const p=job.provenance,crossYear=p.referenceDate.slice(0,4)!==p.secondaryDate.slice(0,4);return <button className="radar-pair" key={job.id} aria-pressed={selected?.id===job.id} onClick={()=>onSelect(job)} aria-label={`Show NISAR pair ${dateLabel(p.referenceDate,true)} to ${dateLabel(p.secondaryDate,true)}, ${p.polarization}, ${p.layer}`}>
      <span className="radar-pair-dates"><time dateTime={p.referenceDate}>{dateLabel(p.referenceDate,crossYear)}</time><span className="radar-pair-connector" aria-hidden="true"/><time dateTime={p.secondaryDate}>{dateLabel(p.secondaryDate,crossYear)}</time></span>
      <span className="radar-pair-meta">{p.pairDays.toFixed(0)} days · {p.polarization} · {p.layer}{p.trackNumber?` · T${p.trackNumber}${p.orbitPassDirection?.[0]??''}`:''}</span>
     </button>})}
    </div></div></details>
    {pair&&currentDate&&<div className="radar-replay-row"><Button className="play-button" size="icon" aria-label={playing?'Pause displacement replay':'Play displacement replay'} onClick={onPlay}>{playing?<Pause size={17}/>:<Play size={17}/>}</Button><div className="radar-replay-date"><strong>{dateLabel(currentDate)}</strong><span className={frame!.observed?'replay-observed':'replay-interpolated'}>{frame!.label}</span></div><div className="radar-replay-track"><input aria-label="Displacement replay progress" type="range" min="0" max="1" step="0.01" value={progress} onChange={event=>onScrub(+event.target.value)} aria-valuetext={`${dateLabel(currentDate)}, ${frame!.label}`}/><div><time dateTime={pair.referenceDate}>{dateLabel(pair.referenceDate)} · observed</time><time dateTime={pair.secondaryDate}>{dateLabel(pair.secondaryDate)} · observed</time></div></div></div>}
    <p className="observation-context-note">Only {pair?`${dateLabel(pair.referenceDate)} and ${dateLabel(pair.secondaryDate)}`:'the two acquisition dates'} are NISAR observations. Frames between them are interpolated at a steady rate, not daily measurements; background imagery provides context.</p>
   </>}
  </div>}
 </section>
}
