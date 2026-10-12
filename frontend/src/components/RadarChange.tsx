import {useEffect,useMemo,useState} from 'react'
import {createPortal} from 'react-dom'
import {useQuery} from '@tanstack/react-query'
import {Check,ChevronLeft,ChevronRight,LoaderCircle,Pause,Play,X} from 'lucide-react'
import {Button} from './ui'

type Step={track:string;from:string;to:string;days:number;glacierChangeDb:number;rockChangeDb:number;relativeChangeDb:number;darkerFraction:number|null;bands:(number|null)[];file:string}
type Record_={date:string;observationId:string;glacierHH:number;rockHH:number;contrastDb:number;anomalyDb:number;recent:{temperature3dC:number;precipitation3dMm:number;snowfall7dCm:number};bands:(number|null)[]}
type Check={pass:boolean;detail:string}
type Storm={from:string;to:string;precipitationMm:number;snowfallCm:number}
type Clouds={optical:{id:string;date:string;cloudPercent:number;file:string;source:string;sourceUrl:string|null};radar:{track:string;date:string;observationId:string};daysApart:number}
type Finding={id:string;kind:'storm';storm:Storm;clouds?:Clouds;tracks:string[];magnitudeDb:number;strongestBand:[number,number];statement:string;interpretation:string;confidence:'High'|'Moderate'|'Low';checks:Record<'beatsNoise'|'tracksAgree'|'fitsWeather'|'spatiallyCoherent',Check>;steps:{track:string;from:string;to:string;file:string}[]}
type Corners=[[number,number],[number,number],[number,number],[number,number]]
export type ChangeSummary={scenario:string;measured:string;derived:string;grid:{corners:Corners};masks:{glacier:string;rock:string};pattern:{statement:string;correlations:Record<string,number|null>;meaning:string};elevation:{source:string;bands:number[]};
 weather:{source:string;points:Record<string,{time:string[];precipitation_sum:(number|null)[];snowfall_sum:(number|null)[];temperature_2m_mean:(number|null)[]}>;storms:Storm[];stormRule:string};noise:{dryAnomalyDb:number;thresholdDb:number;dryDates:number};
 rules:Record<string,string>;differenceScale:{stops:[number,number[]][];meaning:string};tracks:{id:string;label:string;dates:Record_[]}[];steps:Step[];findings:Finding[];limits:string[]}
export type ChangeScene={url:string;coordinates:Corners;baseObservationId:string}

const CHECKS:[keyof Finding['checks'],string][]=[['tracksAgree','Tracks agree'],['beatsNoise','Beats the noise'],['fitsWeather','Matches the weather'],['spatiallyCoherent','Covers the glacier']]
const short=(d:string)=>new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})
// Same stops the processor used for the difference maps.
const colour=(v:number|null,stops:[number,number[]][])=>{
 if(v===null)return 'transparent'
 const x=Math.min(stops.at(-1)![0],Math.max(stops[0][0],v)),i=Math.max(0,stops.findIndex(([at])=>at>=x)-1),[a,ca]=stops[i],[b,cb]=stops[Math.min(stops.length-1,i+1)],f=b===a?0:(x-a)/(b-a)
 return `rgb(${ca.map((c,k)=>Math.round(c+(cb[k]-c)*f)).join(',')})`
}

export default function RadarChange({scenario,speed,onScene}:{scenario:string;speed:number;onScene:(scene:ChangeScene|null)=>void}){
 const query=useQuery<ChangeSummary|null>({queryKey:['radar-change',scenario],queryFn:async({signal})=>{const r=await fetch(`/api/science/${scenario}/change`,{signal});if(r.status===404)return null;if(!r.ok)throw new Error('The radar change summary could not be loaded.');return r.json()},staleTime:300000,refetchOnWindowFocus:false})
 const data=query.data
 const [trackChoice,setTrack]=useState(''),[chosen,setChosen]=useState<{track:string;from:string}|null>(null),[playing,setPlaying]=useState(false),[panel,setPanel]=useState(true)
 const top=data?.findings[0]
 const track=data?.tracks.find(t=>t.id===trackChoice)??data?.tracks.find(t=>t.id===top?.steps[0]?.track)??data?.tracks[0]
 const steps=useMemo(()=>data?.steps.filter(s=>s.track===track?.id)??[],[data,track?.id])
 const fallback=top&&top.steps[0]?.track===track?.id?steps.findIndex(s=>s.from===top.steps[0].from):steps.length-1
 const index=chosen&&chosen.track===track?.id?Math.max(0,steps.findIndex(s=>s.from===chosen.from)):Math.max(0,fallback)
 const step=steps[index]
 const select=(t:string,from:string)=>{setPlaying(false);setTrack(t);setChosen({track:t,from})}
 useEffect(()=>{
  if(!data||!step||!track){onScene(null);return}
  const after=track.dates.find(d=>d.date===step.to)
  onScene({url:`/api/science/${scenario}/change/${step.file}`,coordinates:data.grid.corners,baseObservationId:after?.observationId??''})
 },[data,step?.file,track?.id])
 useEffect(()=>()=>onScene(null),[])
 useEffect(()=>{
  if(!playing||!track||steps.length<2)return
  const timer=setTimeout(()=>{const next=steps[(index+1)%steps.length];setChosen({track:track.id,from:next.from});if(index+1>=steps.length-1)setPlaying(false)},2400/speed)
  return()=>clearTimeout(timer)
 },[playing,index,steps,speed,track?.id])
 if(query.isPending)return <p className="radar-timeline-message" role="status"><LoaderCircle size={16} className="spin"/>Loading radar change…</p>
 if(query.isError)return <p className="radar-timeline-message" role="alert">Radar change could not be loaded. <button className="text-link" onClick={()=>query.refetch()}>Retry</button></p>
 if(!data||!track||!step)return <p className="radar-timeline-message">No radar change summary has been prepared for this area. Run <code>python backend/geo/gcov_change.py</code> after preparing GCOV dates.</p>
 const workspace=document.querySelector('.map-workspace'),responseFiles=new Set(data.findings.flatMap(f=>f.steps.map(x=>x.file)))
 return <div className="change-timeline">
  <div className="change-controls">
   <label className="gcov-color-toggle">Track<select aria-label="Radar track" value={track.id} onChange={e=>{setPlaying(false);setTrack(e.target.value);setChosen(null)}}>{data.tracks.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
   <Button className="play-button" size="icon" disabled={steps.length<2} aria-label={playing?'Pause radar change playback':'Play radar change'} onClick={()=>{if(!playing&&index>=steps.length-1)setChosen({track:track.id,from:steps[0].from});setPlaying(!playing)}}>{playing?<Pause size={16}/>:<Play size={16}/>}</Button>
   <div className="change-step-track" role="listbox" aria-label="Date pairs on this track">
    {steps.map(s=><button key={s.file} role="option" aria-selected={s===step} className={`change-step${Math.abs(s.relativeChangeDb)>=data.noise.thresholdDb?' is-significant':''}${responseFiles.has(s.file)?' is-storm':''}`} onClick={()=>select(track.id,s.from)} title={`${s.relativeChangeDb>0?'+':''}${s.relativeChangeDb.toFixed(1)} dB relative to high rock${responseFiles.has(s.file)?' · first image after a storm':''}`}>
     <span>{short(s.from)} → {short(s.to)}</span><i style={{background:colour(s.relativeChangeDb,data.differenceScale.stops)}}/></button>)}
   </div>
   <Button variant="ghost" size="icon" aria-label="Previous date pair" disabled={index===0} onClick={()=>select(track.id,steps[index-1].from)}><ChevronLeft size={17}/></Button>
   <Button variant="ghost" size="icon" aria-label="Next date pair" disabled={index>=steps.length-1} onClick={()=>select(track.id,steps[index+1].from)}><ChevronRight size={17}/></Button>
  </div>
  <div className="change-legend"><span className="change-ramp" style={{background:`linear-gradient(90deg,${data.differenceScale.stops.map(([v,c])=>`rgb(${c.join(',')}) ${((v-data.differenceScale.stops[0][0])/(data.differenceScale.stops.at(-1)![0]-data.differenceScale.stops[0][0])*100).toFixed(0)}%`).join(',')})`}}/>
   <span>{data.differenceScale.stops[0][0]} dB radar-darker</span><span>radar-brighter +{data.differenceScale.stops.at(-1)![0]} dB</span>
   <span className="change-note">{short(step.from)} → {short(step.to)} · {step.relativeChangeDb>0?'+':''}{step.relativeChangeDb.toFixed(1)} dB relative to high rock{Math.abs(step.relativeChangeDb)>=data.noise.thresholdDb?' · above the noise threshold':' · within the noise'} · real acquisition dates, same track</span>
   {!panel&&<Button variant="outline" size="small" onClick={()=>setPanel(true)}>Show findings</Button>}</div>
  {panel&&workspace&&createPortal(<FindingsPanel data={data} track={track} step={step} onClose={()=>setPanel(false)} onShow={f=>select(f.steps[0].track,f.steps[0].from)}/>,workspace)}
 </div>
}

function FindingsPanel({data,track,step,onClose,onShow}:{data:ChangeSummary;track:ChangeSummary['tracks'][number];step:Step;onClose:()=>void;onShow:(f:Finding)=>void}){
 return <aside className="radar-component-controls radar-visual-controls change-panel" aria-label="NISAR radar change findings">
  <div className="radar-control-heading"><strong>What NISAR saw</strong><Button variant="ghost" size="icon" aria-label="Hide findings" onClick={onClose}><X size={16}/></Button></div>
  {data.findings.length?data.findings.filter((f,i)=>i===0||f.confidence!=='Low').slice(0,3).map(f=><article key={f.id} className={`finding-card confidence-${f.confidence.toLowerCase()}`}>
   <div className="finding-head"><span>Confidence · {f.confidence}</span><button className="text-link" onClick={()=>onShow(f)}>Show on map</button></div>
   <p className="finding-statement">{f.statement}</p><p className="finding-interpretation">{f.interpretation} Not by itself evidence of melt or mass loss.</p>{f.clouds?<ThroughClouds scenario={data.scenario} clouds={f.clouds}/>:<p className="finding-through-clouds">Radar sees through cloud: these images came within days of the storm, when optical satellites usually see cloud.</p>}
   <ul className="finding-checks">{CHECKS.map(([key,label])=><li key={key} className={f.checks[key].pass?'pass':'fail'}>{f.checks[key].pass?<Check size={13}/>:<X size={13}/>}<span><strong>{label}.</strong> {f.checks[key].detail}</span></li>)}</ul>
  </article>):<p className="motion-mode">No storm produced a glacier change above the dry-date threshold of {data.noise.thresholdDb.toFixed(1)} dB. That is a result too: the radar shows no clear storm response beyond normal date-to-date variation.</p>}
  <article className="finding-card finding-pattern"><div className="finding-head"><span>Supporting pattern</span></div><p className="finding-statement">{data.pattern.statement}</p><p className="finding-interpretation">Rank correlation with rain or snow in the 3 days before each image: {Object.entries(data.pattern.correlations).map(([k,v])=>`${data.tracks.find(t=>t.id===k)?.label??k} ${v===null?'n/a':v.toFixed(2)}`).join(' · ')}. {data.pattern.meaning}</p></article>
  <h4 className="change-chart-title">{track.label}: glacier and high rock, with Konkordia precipitation</h4>
  <SeriesChart data={data} track={track} step={step}/>
  <h4 className="change-chart-title">Glacier by elevation (relative to this track’s season)</h4>
  <BandChart data={data} track={track} step={step}/>
  <details className="radar-key-details motion-details"><summary>How this is measured</summary>
   <p><strong>Measured:</strong> {data.measured}. <strong>Derived:</strong> {data.derived}.</p>
   <p>Glacier: {data.masks.glacier}. Reference: {data.masks.rock}. Elevation: {data.elevation.source}. Weather: {data.weather.source}. Storm: {data.weather.stormRule}</p>
   <p>On {data.noise.dryDates} dry dates the glacier anomaly is typically {data.noise.dryAnomalyDb.toFixed(2)} dB, so a storm response must reach {data.noise.thresholdDb.toFixed(1)} dB to count.</p>
   <ul>{Object.entries(data.rules).map(([k,v])=><li key={k}>{v}</li>)}</ul>
   <h4>Limits</h4><ul>{data.limits.map(l=><li key={l}>{l}</li>)}</ul>
  </details>
 </aside>
}

const W=280,H=96,PAD=26
function SeriesChart({data,track,step}:{data:ChangeSummary;track:ChangeSummary['tracks'][number];step:Step}){
 const k=data.weather.points.konkordia,days=k.time,t0=Date.parse(days[0]),t1=Date.parse(days.at(-1)!)
 const x=(d:string)=>PAD+(Date.parse(d)-t0)/(t1-t0)*(W-PAD-4)
 const values=track.dates.flatMap(d=>[d.glacierHH,d.rockHH]),lo=Math.floor(Math.min(...values)),hi=Math.ceil(Math.max(...values))
 const y=(v:number)=>8+(hi-v)/(hi-lo||1)*(H-24)
 const line=(key:'glacierHH'|'rockHH')=>track.dates.map((d,i)=>`${i?'L':'M'}${x(d.date).toFixed(1)},${y(d[key]).toFixed(1)}`).join('')
 const rainMax=Math.max(10,...k.precipitation_sum.map(v=>v??0))
 return <svg className="change-chart" viewBox={`0 0 ${W} ${H+30}`} role="img" aria-label={`Radar backscatter of the glacier and of high rock on ${track.dates.length} dates, with daily precipitation and storms at Konkordia`}>
  <rect x={x(step.from)} y={4} width={Math.max(2,x(step.to)-x(step.from))} height={H+22} className="chart-window"/>
  <text x={2} y={y(hi)+3} className="chart-axis">{hi} dB</text><text x={2} y={y(lo)+3} className="chart-axis">{lo} dB</text>
  {data.weather.storms.filter(s=>s.to>=days[0]).map(s=><line key={s.from} x1={x(s.from)} x2={x(s.from)} y1={4} y2={H+26} className="chart-storm"><title>{`Storm ${s.from}: ${s.precipitationMm} mm, ${s.snowfallCm} cm snow`}</title></line>)}
  <path d={line('rockHH')} className="chart-terrain"/><path d={line('glacierHH')} className="chart-glacier"/>
  {track.dates.map(d=><g key={d.date}><circle cx={x(d.date)} cy={y(d.rockHH)} r={2.5} className="chart-terrain-dot"/><circle cx={x(d.date)} cy={y(d.glacierHH)} r={3} className="chart-glacier-dot"><title>{`${d.date}: glacier ${d.glacierHH.toFixed(1)} dB, high rock ${d.rockHH.toFixed(1)} dB, anomaly ${d.anomalyDb>0?'+':''}${d.anomalyDb.toFixed(1)} dB`}</title></circle></g>)}
  {days.map((d,i)=>{const r=k.precipitation_sum[i]??0,s=k.snowfall_sum[i]??0,h=r/rainMax*18;return r>0?<rect key={d} x={x(d)-1} y={H+26-h} width={2} height={h} className={s>0?'chart-snow':'chart-rain'}><title>{`${d}: ${r} mm${s>0?`, ${s} cm snow`:''}`}</title></rect>:null})}
  <text x={PAD} y={H+29} className="chart-axis">{short(days[0])}</text><text x={W-4} y={H+29} textAnchor="end" className="chart-axis">{short(days.at(-1)!)}</text>
  <g className="chart-key"><circle cx={W-118} cy={10} r={3} className="chart-glacier-dot"/><text x={W-112} y={13}>glacier</text><circle cx={W-70} cy={10} r={2.5} className="chart-terrain-dot"/><text x={W-64} y={13}>high rock</text></g>
 </svg>
}

function BandChart({data,track,step}:{data:ChangeSummary;track:ChangeSummary['tracks'][number];step:Step}){
 const bands=data.elevation.bands,cw=(W-PAD-4)/track.dates.length,ch=Math.min(10,80/bands.length)
 return <svg className="change-chart" viewBox={`0 0 ${W} ${bands.length*ch+16}`} role="img" aria-label="Glacier radar brightness by elevation band and date, relative to this track's seasonal median">
  {bands.map((b,row)=>{const top=(bands.length-1-row)*ch;return <g key={b}>{track.dates.map((d,col)=><rect key={d.date} x={PAD+col*cw} y={top} width={cw-1} height={ch-1} fill={colour(d.bands[row],data.differenceScale.stops)} className={d.date===step.to?'chart-selected':''}><title>{`${b}–${b+200} m, ${d.date}: ${d.bands[row]===null?'no data':`${d.bands[row]!>0?'+':''}${d.bands[row]!.toFixed(1)} dB`}`}</title></rect>)}</g>})}
  <text x={2} y={ch} className="chart-axis">{(bands.at(-1)!+200).toLocaleString()} m</text><text x={2} y={bands.length*ch} className="chart-axis">{bands[0].toLocaleString()} m</text>
  <text x={PAD} y={bands.length*ch+12} className="chart-axis">{short(track.dates[0].date)}</text><text x={W-4} y={bands.length*ch+12} textAnchor="end" className="chart-axis">{short(track.dates.at(-1)!.date)}</text>
 </svg>
}

// A real cloudy Sentinel-2 view next to the NISAR view from nearly the same time, aligned to the same ground.
function ThroughClouds({scenario,clouds}:{scenario:string;clouds:Clouds}){
 const [split,setSplit]=useState(50)
 const optical=`/api/science/${scenario}/change/${clouds.optical.file}`,radar=`/api/science/${scenario}/gcov/${clouds.radar.observationId}/terrain.webp`
 const when=clouds.daysApart===0?'on the same day':`${clouds.daysApart} day${clouds.daysApart===1?'':'s'} apart`
 return <figure className="through-clouds">
  <div className="through-clouds-frame">
   <img src={radar} alt={`NISAR radar view of the glacier on ${clouds.radar.date}`} loading="lazy"/>
   <img className="through-clouds-optical" src={optical} alt={`Sentinel-2 optical view of the same area on ${clouds.optical.date}, ${clouds.optical.cloudPercent}% cloud`} loading="lazy" style={{clipPath:`inset(0 ${100-split}% 0 0)`}}/>
   <span className="through-clouds-divider" style={{left:`${split}%`}} aria-hidden="true"/>
  </div>
  <input type="range" min="0" max="100" value={split} onChange={e=>setSplit(+e.target.value)} aria-label="Compare optical and radar views"/>
  <figcaption><strong>Through the clouds.</strong> Left: Sentinel-2 optical, {clouds.optical.date}, {clouds.optical.cloudPercent.toFixed(0)}% cloud. Right: NISAR radar, {clouds.radar.date} ({when}). Radar sees through cloud and works at night.{clouds.optical.sourceUrl&&<> <a className="text-link" href={clouds.optical.sourceUrl} target="_blank" rel="noreferrer">Sentinel-2 scene record</a></>}</figcaption>
 </figure>
}
