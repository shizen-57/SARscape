import {useEffect,useState} from 'react'
import {createPortal} from 'react-dom'
import {useQuery} from '@tanstack/react-query'
import {ExternalLink,LoaderCircle,Pause,Play,ChevronLeft,ChevronRight,ChevronDown,ChevronUp} from 'lucide-react'
import {Button} from './ui'
import GlacierChangeSummary from './GlacierChangeSummary'
import {VELOCITY_STOPS,CHANGE_STOPS,type SurfaceScene,type SurfaceManifest,type SurfaceGrid,type SurfaceMode,type GlacierOutline} from '../data/glacier-surfaces.mjs'
import type {FeatureCollection,Polygon,MultiPolygon} from 'geojson'

const load=async<T,>(url:string,signal:AbortSignal):Promise<T>=>{const r=await fetch(url,{signal});if(!r.ok)throw new Error('Could not load the measured glacier surface.');return r.json()}
const ramp=(stops:typeof VELOCITY_STOPS)=>`linear-gradient(90deg,${stops.map(([v,c])=>`rgb(${c.join(',')}) ${v*100}%`).join(',')})`
const date=(v:string)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})
export default function GlacierSurfaces({scenario,onScene,onOverview,speed=1}:{speed?:number;scenario:string;onScene:(scene:SurfaceScene|null)=>void;onOverview:()=>void}){
 const [mode,setMode]=useState<SurfaceMode>('velocity'),[step,setStep]=useState(0),[base,setBase]=useState(0),[opacity,setOpacity]=useState(.85),[playing,setPlaying]=useState(false),[collapsed,setCollapsed]=useState(false)
 const [host,setHost]=useState<Element|null>(null)
 useEffect(()=>setHost(document.querySelector('.map-workspace')),[])
 const manifest=useQuery({queryKey:['surfaces',scenario],queryFn:({signal})=>load<SurfaceManifest>(`/api/surfaces/${scenario}`,signal),staleTime:60000,refetchOnWindowFocus:false})
 const data=manifest.data,frames=data?.frames.filter(f=>f.kind===(mode==='elevation'?'elevation':'velocity'))??[],frame=frames[Math.min(step,frames.length-1)],baseline=frames[Math.min(base,frames.length-1)]
 const url=(file:string)=>`/api/surfaces/${scenario}/${encodeURIComponent(file)}`
 const outlines=useQuery({queryKey:['surface-outlines',scenario],enabled:!!data?.available,queryFn:({signal})=>load<FeatureCollection<Polygon|MultiPolygon,GlacierOutline['properties']>>(url('outlines.geojson'),signal),staleTime:Infinity})
 const grid=useQuery({queryKey:['surface-grid',scenario,frame?.id],enabled:!!frame&&mode!=='extent',queryFn:({signal})=>load<SurfaceGrid>(url(frame.grid),signal),staleTime:Infinity})
 const previous=useQuery({queryKey:['surface-grid',scenario,baseline?.id],enabled:!!baseline&&mode==='change',queryFn:({signal})=>load<SurfaceGrid>(url(baseline.grid),signal),staleTime:Infinity})
 const count=mode==='extent'?outlines.data?.features.length??0:frames.length
 const ready=!!data?.available&&!!outlines.data?.features.length&&(mode==='extent'||(!!grid.data&&(mode!=='change'||!!previous.data)))
 useEffect(()=>{if(!ready){onScene(null);return}onScene({scenario,mode,manifest:data!,frame,grid:mode==='extent'?undefined:grid.data,baseline:mode==='change'?baseline:undefined,baselineGrid:mode==='change'?previous.data:undefined,outlines:outlines.data!,outlineIndex:mode==='extent'?Math.min(step,count-1):mode==='elevation'?0:outlines.data!.features.length-1,opacity})},[scenario,mode,data,frame,baseline,grid.data,previous.data,outlines.data,ready,step,count,opacity,onScene])
 useEffect(()=>{setStep(0);setBase(0);setPlaying(false);setMode('velocity')},[scenario])
 useEffect(()=>{if(!playing||!ready)return;const timer=setTimeout(()=>{if(step>=count-1){setPlaying(false);return}setStep(step+1)},1800/speed);return()=>clearTimeout(timer)},[playing,ready,step,count,speed])
 useEffect(()=>{const pause=()=>{if(document.hidden)setPlaying(false)};document.addEventListener('visibilitychange',pause);return()=>document.removeEventListener('visibilitychange',pause)},[])
 const selectMode=(next:SurfaceMode)=>{setMode(next);setStep(next==='change'?Math.max(0,Math.min(1,(data?.frames.filter(f=>f.kind==='velocity').length??0)-1)):0);setPlaying(false)}
 const choose=(v:number)=>{setStep(v);setPlaying(false)}
 const selectedOutline=outlines.data?.features[Math.min(step,(outlines.data?.features.length??1)-1)]
 const error=manifest.isError||(!!data?.available&&(outlines.isError||(mode!=='extent'&&grid.isError)||(mode==='change'&&previous.isError)))
 const pending=!error&&(manifest.isPending||(!!data?.available&&(outlines.isPending||(!!frame&&mode!=='extent'&&grid.isPending)||(!!baseline&&mode==='change'&&previous.isPending))))
 return <>
  {host&&createPortal(<aside className={`surface-panel${collapsed?' is-collapsed':''}`} aria-label="Glacier surface controls">
   <div className="surface-panel-header"><div><div className="surface-eyebrow">GLACIER CHANGE EXPLORER</div><h3>Ice across the landscape</h3></div><Button variant="ghost" size="icon" aria-label={collapsed?'Expand glacier controls':'Collapse glacier controls'} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</Button></div>
   <div className="surface-panel-content" hidden={collapsed}>
   <div className="surface-modes" role="group" aria-label="Scientific surface mode">
    <button aria-pressed={mode==='velocity'} onClick={()=>selectMode('velocity')}>Velocity</button>
    <button aria-pressed={mode==='extent'} onClick={()=>selectMode('extent')}>Retreat</button>
    <button aria-pressed={mode==='change'} disabled={(data?.frames.filter(f=>f.kind==='velocity').length??0)<2} onClick={()=>selectMode('change')}>Speed change</button>
    <button aria-pressed={mode==='elevation'} disabled={!data?.elevation?.available} title={data?.elevation?.reason??'Measured elevation data required'} onClick={()=>selectMode('elevation')}>Elevation</button>
   </div>
   {pending&&<p role="status"><LoaderCircle className="spin" size={14}/> Loading scientific surface…</p>}
   {error&&<p role="alert">Could not load this surface. <button onClick={()=>{manifest.refetch();if(data?.available)outlines.refetch();if(frame&&mode!=='extent')grid.refetch();if(baseline&&mode==='change')previous.refetch()}}>Retry</button></p>}
   {data&&!data.available&&<p>{data.reason} Select aerial imagery or NISAR below.</p>}
   {data?.available&&<>
    {ready&&!error&&<GlacierChangeSummary mode={mode} frame={frame} baseline={baseline} grid={grid.data} baselineGrid={previous.data} outline={selectedOutline} firstOutline={outlines.data?.features[0]}/>}
    {!pending&&!error&&!ready&&<p>No prepared measurements are available for this mode.</p>}
    {mode==='extent'?<><strong>Mapped glacier footprints</strong><div className="extent-key"><i/> Selected outline <b/>{outlines.data?.features[0]?.properties.year} baseline</div><p>The colored surface follows the published boundary. Exposed areas use the current optical background; no historical ice texture or height is synthesized.</p><p>{selectedOutline?.properties.year} · {selectedOutline?.properties.areaKm2.toFixed(2)} km²{selectedOutline?.properties.limitation&&<><br/>{selectedOutline.properties.limitation}</>}</p></>:<>
     <strong>{mode==='velocity'?'Surface speed (m/year)':mode==='elevation'?'Surface elevation change (m/year)':'Speed difference (m/year)'}</strong>
     <div className="surface-ramp" style={{background:ramp(mode!=='velocity'?CHANGE_STOPS:VELOCITY_STOPS)}}/>
     <div className="surface-scale">{(mode==='change'?[-150,0,150]:mode==='elevation'?[-5,0,5]:[0,75,150,225,300]).map(v=><span key={v}>{v===300?'300+':v>0&&mode!=='velocity'?`+${v}`:v}</span>)}</div>
     <p>{mode==='change'?'Negative = slower; positive = faster than the baseline interval. Both intervals must have accepted measurements.':mode==='elevation'?'Red = surface lowering; blue = surface gain. Measured mean rate over 2000–2020. Values beyond ±5 share the end colors. Terrain geometry stays fixed.':'Purple = slower · yellow = faster. One fixed scale across every date. Transparent areas have no accepted measurement.'}</p>
     {frame&&<p className="surface-quality">{Math.round(frame.coverage*1000)/10}% of the {frame.maskYear} mask has measurements · {mode==='elevation'?'100 m source grid · uncertainty raster not connected':'120 m source grid · error ≤100 m/year · source-interpolated pixels excluded'}.</p>}
     {mode==='change'&&<label>Baseline interval<select aria-label="Velocity baseline interval" value={Math.min(base,Math.max(0,frames.length-1))} onChange={e=>{setBase(+e.target.value);setPlaying(false)}}>{frames.map((f,i)=><option key={f.id} value={i}>{f.label}</option>)}</select></label>}
    </>}
    <label className="surface-opacity">Surface opacity<input type="range" aria-label="Surface opacity" min="0.15" max="1" step="0.05" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label>
    <button className="surface-overview" onClick={onOverview}>View the whole glacier ↗</button>
    <p className="surface-inspect-hint">Click the surface to inspect measurements.</p>
    <details className="surface-provenance"><summary>Sources & scientific limits</summary>
     <p>{mode==='extent'?'GLAMOS Swiss Glacier Inventories: measured mapped outlines at inventory/acquisition years, CC BY 4.0. Changing area reflects mapping differences as well as retreat.':frame?.interpretation}</p>
     <p>Glacier mask: {mode==='elevation'?'GLAMOS 1973, including formerly glaciated terrain':'GLAMOS SGI2016, Aletsch acquisition year 2017'}. This is a historical mask. Gaps stay transparent; measurements are not extrapolated outside accepted cells.</p>
     <p>Texture: SWISSIMAGE mosaic versions (local flight dates vary). Terrain: fixed Mapterhorn elevation. The background does not acquire the velocity interval's date.</p>
     <p>{data.elevation.reason}</p>
     <a href={mode==='extent'?selectedOutline?.properties.sourceUrl:frame?.sourceUrl} target="_blank" rel="noreferrer">Original scientific dataset <ExternalLink size={12}/></a>
     <a href="https://its-live.jpl.nasa.gov/" target="_blank" rel="noreferrer">NASA ITS_LIVE documentation <ExternalLink size={12}/></a>
     {frame&&mode!=='extent'&&<a href={url(frame.raster)} download>Download regional scientific raster</a>}
    </details>
   </>}
   </div>
  </aside>,host)}
  <div className="surface-timeline-body">
   <div className="surface-timeline-header"><strong>{mode==='extent'?'Years · mapped glacier extent':mode==='elevation'?'Years · measured elevation-change period':'Months · measured velocity intervals'}</strong><span>{mode==='extent'?'Observed inventory years':mode==='elevation'?'Multi-DEM period · fixed geometry':'Actual image pairs · interval means'}</span></div>
   <div className="surface-time-row"><Button className="play-button" size="icon" disabled={count<2||error} aria-label={playing?'Pause glacier surface timeline':'Play glacier surface timeline'} onClick={()=>{if(step>=count-1)setStep(0);setPlaying(!playing)}}>{playing?<Pause size={17}/>:<Play size={17}/>}</Button>
    <div className="surface-time-date"><strong>{mode==='extent'?selectedOutline?.properties.year:mode==='elevation'?'2000–2020':frame?date(frame.date):'—'}</strong><span>{mode==='extent'?'Mapped footprint':mode==='elevation'?'Measured mean height-change rate':frame?`${frame.intervalDays} day measurement interval`:'No measurements'}</span></div>
    <div className="surface-time-track"><input type="range" aria-label="Scientific observation date" min="0" max={Math.max(0,count-1)} step="1" disabled={!count} value={Math.min(step,Math.max(0,count-1))} onChange={e=>choose(+e.target.value)}/><div className="surface-time-ticks">{Array.from({length:count},(_,i)=><button key={i} aria-pressed={step===i} onClick={()=>choose(i)}>{mode==='extent'?outlines.data?.features[i].properties.year:date(frames[i].date)}</button>)}</div></div>
    <Button variant="ghost" size="icon" aria-label="Previous surface observation" disabled={step===0} onClick={()=>choose(step-1)}><ChevronLeft size={16}/></Button><Button variant="ghost" size="icon" aria-label="Next surface observation" disabled={step>=count-1} onClick={()=>choose(step+1)}><ChevronRight size={16}/></Button>
   </div><p className="surface-interval">{mode==='extent'?'Published boundaries change only at their mapped years. No interpolated retreat is displayed.':frame?`${date(frame.start)} → ${date(frame.end)} · ${frame.source} · ${frame.sensor}. ${mode==='elevation'?'One measured period; no intermediate height observations are supplied.':'Playback steps through measured intervals; seasonal differences can also reflect measurement error.'}`:'Preparing measured observations…'}</p>
  </div>
 </>
}
