import type {ReactNode} from 'react'
import {ArrowRight,Database,Layers2,LoaderCircle,Pause,Play,Radar} from 'lucide-react'
import {Button} from './ui'
import type {ScienceJob} from './SciencePanel'
import {completedRadarJobs,radarDateMilliseconds} from '../data/radar-display.mjs'

export type ObservationSource='optical'|'radar'
const dateLabel=(date:string,includeYear=false)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',...(includeYear?{year:'numeric' as const}:{}),timeZone:'UTC'}).format(new Date(radarDateMilliseconds(date)))
export default function ObservationTimeline({source,onSource,jobs,selected,onSelect,pending,error,aerial,onOpenData,progress,playing,onPlay,onScrub,children}:{source:ObservationSource;onSource:(s:ObservationSource)=>void;jobs:ScienceJob[];selected:ScienceJob|null;onSelect:(j:ScienceJob)=>void;pending:boolean;error:boolean;aerial:boolean;onOpenData:()=>void;progress:number;playing:boolean;onPlay:()=>void;onScrub:(v:number)=>void;children:ReactNode}){
 const completed=completedRadarJobs(jobs),years=[...new Set(completed.map(j=>j.provenance.referenceDate.slice(0,4)))]
 const selectedYear=selected?.provenance?.referenceDate.slice(0,4)??years[0]
 const yearJobs=completed.filter(j=>j.provenance.referenceDate.startsWith(selectedYear??''))
 const pair=selected?.provenance,currentDate=pair?new Date(radarDateMilliseconds(pair.referenceDate)+(radarDateMilliseconds(pair.secondaryDate)-radarDateMilliseconds(pair.referenceDate))*progress).toISOString():null
 return <section className={`timeline observation-timeline ${source==='radar'?'radar-timeline':''}`} aria-label="Observation timeline">
  <div className="observation-source-row"><div className="observation-source-switch" aria-label="Observation source">
   <button aria-pressed={source==='optical'} onClick={()=>onSource('optical')}><Layers2 size={15}/><span>{aerial?'Aerial imagery':'Reference imagery'}</span></button>
   <button aria-pressed={source==='radar'} onClick={()=>onSource('radar')}><Radar size={15}/><span>NISAR radar</span>{completed.length>0&&<span className="observation-count">{completed.length}</span>}</button>
  </div><Button variant="ghost" size="small" onClick={onOpenData}><Database size={14}/><span>Data & sources</span></Button></div>
  {source==='optical'?children:<div className="radar-date-hierarchy">
   {pending?<p className="radar-timeline-message" role="status"><LoaderCircle size={16} className="spin"/>Loading radar observations…</p>:error?<p className="radar-timeline-message" role="alert">Could not load observations. Open Data & sources to retry.</p>:!completed.length?<div className="radar-timeline-empty"><p>No processed NISAR pairs for this glacier yet.</p><Button variant="outline" size="small" onClick={onOpenData}>Import an observation<ArrowRight size={14}/></Button></div>:<>
    <div className="observation-year-row"><span>Year</span><div aria-label="Radar observation year">{years.map(year=><button key={year} aria-pressed={selectedYear===year} onClick={()=>onSelect(completed.find(j=>j.provenance.referenceDate.startsWith(year))!)}>{year}</button>)}</div><span>{yearJobs.length} acquisition {yearJobs.length===1?'pair':'pairs'}</span></div>
    <div className="radar-pair-row"><span>Acquisition dates</span><div className="radar-pair-track" aria-label={`Acquisition pairs in ${selectedYear}`}>
     {yearJobs.map(job=>{const p=job.provenance,crossYear=p.referenceDate.slice(0,4)!==p.secondaryDate.slice(0,4);return <button className="radar-pair" key={job.id} aria-pressed={selected?.id===job.id} onClick={()=>onSelect(job)} aria-label={`Show NISAR pair ${dateLabel(p.referenceDate,true)} to ${dateLabel(p.secondaryDate,true)}, ${p.polarization}, ${p.layer}`}>
      <span className="radar-pair-dates"><time dateTime={p.referenceDate}>{dateLabel(p.referenceDate,crossYear)}</time><span className="radar-pair-connector" aria-hidden="true"/><time dateTime={p.secondaryDate}>{dateLabel(p.secondaryDate,crossYear)}</time></span>
      <span className="radar-pair-meta">{p.pairDays.toFixed(0)} days · {p.polarization} · {p.layer}</span>
     </button>})}
    </div></div>
    {pair&&currentDate&&<div className="radar-replay-row"><Button className="play-button" size="icon" aria-label={playing?'Pause displacement replay':'Play displacement replay'} onClick={onPlay}>{playing?<Pause size={17}/>:<Play size={17}/>}</Button><div className="radar-replay-date"><strong>{dateLabel(currentDate)}</strong><span>Displacement replay</span></div><div className="radar-replay-track"><input aria-label="Displacement replay progress" type="range" min="0" max="1" step="0.01" value={progress} onChange={event=>onScrub(+event.target.value)} aria-valuetext={`${Math.round(progress*100)} percent, ${dateLabel(currentDate)}`}/><div><time dateTime={pair.referenceDate}>{dateLabel(pair.referenceDate)}</time><time dateTime={pair.secondaryDate}>{dateLabel(pair.secondaryDate)}</time></div></div></div>}
    <p className="observation-context-note">Replay assumes steady displacement. Intermediate dates are interpolated; background imagery provides context.</p>
   </>}
  </div>}
 </section>
}
