import {useEffect,useMemo,useRef,useState,type CSSProperties,type MouseEvent} from 'react'
import {ArrowRight,Layers2,Plane,Radar} from 'lucide-react'
import {scenarios} from '../data/scenarios'
import LandingGlobe,{type GlobeFocus} from './LandingGlobe'

const CUTOUT='https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260827_202005_3346cc4d-ec3b-44ab-825c-b18e49f5021a.png'
const SOURCES=[
 {icon:Radar,name:'NISAR',agency:'NASA · ISRO',text:'Synthetic aperture radar that observes through clouds and darkness. Process glacier offsets (GOFF), inspect calibrated backscatter (GCOV), and compare matching radar captures.',stats:['Radar offsets','Calibrated backscatter'],note:'Interpretation needs quality screening and independent evidence.'},
 {icon:Plane,name:'SWISSIMAGE',agency:'swisstopo',text:'Year-labelled aerial mosaics of the Aletsch region from 2018 to 2025, sharp enough to follow crevasses and moraines.',stats:['~25 cm detail','8 mosaic versions']},
 {icon:Layers2,name:'Sentinel-2',agency:'Copernicus',text:'Dated satellite captures for glaciers, wetlands and forests. Play annual observations, compare two dates, and follow changing ice margins at 10 m source resolution.',stats:['Dated captures','10 m pixels']},
]
const REGION_NOTES:Record<string,{fact:string;data:string}>={
 manchar:{fact:'Follow water spreading across the Manchar Lake floodplain during the 2022 Pakistan floods.',data:'Sentinel-2 · four captures · June–November 2022'},
 aletsch:{fact:'The largest glacier in the Alps, about 20 km long, at the heart of the Jungfrau–Aletsch World Heritage site.',data:'Swiss aerial mosaics · 2018–2025'},
 langtang:{fact:'A debris-covered valley glacier in Langtang National Park, north of Kathmandu.',data:'Dated Sentinel-2 captures · yearly playback'},
 sundarbans:{fact:'Dry-season water signals through the mangroves; tide and flooding conditions need independent evidence.',data:'Annual Sentinel-2 · NDWI · 2018–2026'},
 rondonia:{fact:'Dry-season vegetation signals in a forest landscape in the Brazilian Amazon.',data:'Annual Sentinel-2 · NDVI · 2018–2026'},
 columbia:{fact:'A tidewater glacier in Prince William Sound and one of the most rapidly changing glaciers in the world.',data:'Dated Sentinel-2 captures · yearly playback'}
}
const STEPS=[
 {title:'Pick a landscape',text:'Explore glaciers, Sundarbans wetlands or an Amazon forest landscape, over fixed 3D terrain.'},
 {title:'Move through time',text:'Play annual observations, blink between two dates, or drag the change lens across the landscape.'},
 {title:'Inspect the signals',text:'Open measured water or vegetation indices, or process a NISAR file into radar offsets or calibrated backscatter.'}
]
// Four Esri tiles (2×2) centred on a point, row-major — a real image without another map instance.
const tiles=([lng,lat]:[number,number],z:number)=>{const n=2**z,r=lat*Math.PI/180,x=Math.round((lng+180)/360*n)-1,y=Math.round((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)-1;return [0,1].flatMap(dy=>[0,1].map(dx=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y+dy}/${x+dx}`))}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches
const centerOf=(id:string)=>(scenarios.find(s=>s.id===id)??scenarios[0]).center

// Landing page. Entering dives the globe into the chosen glacier, fades out, then sets #explore.
export default function Hero({onEnter}:{onEnter:(scenarioId:string)=>void}){
 const root=useRef<HTMLElement>(null),row=useRef<HTMLDivElement>(null)
 const [open,setOpen]=useState(false),[ready,setReady]=useState(false),[deep,setDeep]=useState(false),[region,setRegion]=useState<string|null>(null),[dive,setDive]=useState<string|null>(null),[fading,setFading]=useState(false)
 useEffect(()=>{let live=true;const show=()=>live&&setReady(true);document.fonts.ready.then(()=>requestAnimationFrame(show));const t=setTimeout(show,1200);return()=>{live=false;clearTimeout(t)}},[])
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false)},away=(e:PointerEvent)=>{if(!row.current?.contains(e.target as Node))setOpen(false)};addEventListener('keydown',key);addEventListener('pointerdown',away);return()=>{removeEventListener('keydown',key);removeEventListener('pointerdown',away)}},[open])
 useEffect(()=>{
  const el=root.current!,scroll=()=>setDeep(el.scrollTop>el.clientHeight*.35)
  const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.setAttribute('data-shown','');reveal.unobserve(e.target)}}),{root:el,threshold:.15})
  // Only the region card crossing the middle band of the screen steers the globe.
  const steer=new IntersectionObserver(entries=>entries.forEach(e=>{const id=(e.target as HTMLElement).dataset.region!;setRegion(r=>e.isIntersecting?id:r===id?null:r)}),{root:el,rootMargin:'-45% 0px -45% 0px'})
  el.querySelectorAll('[data-reveal]').forEach(n=>reveal.observe(n));el.querySelectorAll('[data-region]').forEach(n=>steer.observe(n))
  el.addEventListener('scroll',scroll,{passive:true})
  return()=>{reveal.disconnect();steer.disconnect();el.removeEventListener('scroll',scroll)}
 },[])
 const focus=useMemo<GlobeFocus>(()=>dive?{center:centerOf(dive),zoom:6.4,duration:1600}:region?{center:centerOf(region),duration:1800}:null,[dive,region])
 const jump=(id:string)=>(e:MouseEvent)=>{e.preventDefault();setOpen(false);const behavior=reduced()?'auto':'smooth',target=id?root.current?.querySelector('#'+id):null;if(target)target.scrollIntoView({behavior});else root.current?.scrollTo({top:0,behavior})}
 const enter=(id='aletsch')=>(e:MouseEvent)=>{
  e.preventDefault();if(dive)return
  onEnter(id);setOpen(false)
  if(reduced()){location.hash='explore';return}
  // Chained so the 0.5s fade always completes, even if the map animation delays timers.
  setDive(id);setTimeout(()=>{setFading(true);setTimeout(()=>{location.hash='explore'},520)},1450)
 }
 return <section ref={root} className={`hero space-bg ${ready?'is-ready':''} ${deep?'is-deep':''} ${region&&!dive?'is-steering':''} ${dive?'is-diving':''} ${fading?'is-fading':''}`} aria-label="Welcome to SARscape">
  <div className="land-globe" aria-hidden="true"><div className="land-glow"/><LandingGlobe focus={focus}/></div>
  <header className="hero-nav"><div className="hero-navrow" ref={row} data-open={open}>
   <a className="hero-logo" href="#" onClick={jump('')}>SAR<i>scape</i></a>
   <nav className="hero-links" id="hero-links" aria-label="Introduction">
    <a href="#" aria-current="page" onClick={jump('')}>Overview</a>
    <a href="#land-sources" onClick={jump('land-sources')}>Instruments</a>
    <a href="#land-regions" onClick={jump('land-regions')}>Locations</a>
    <a href="#land-how" onClick={jump('land-how')}>How it works</a>
    <a href="#simulation">NISAR story</a>
    <a className="hero-enroll" href="#explore" onClick={enter()}>Open map</a>
   </nav>
   <button className="hero-burger" type="button" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="hero-links" onClick={()=>setOpen(!open)}><span/><span/><span/></button>
  </div></header>
  <div className="hero-first">
   <div className="hero-copy">
    <div className="hero-col hero-eyebrow"><span className="hero-mask"><span className="hero-line">EARTH IN MOTION</span></span></div>
    <h1 className="hero-col hero-title"><span className="hero-mask"><span className="hero-line">SARscape</span></span></h1>
    <div className="hero-col hero-rule"><span/></div>
    <p className="hero-col hero-lede">Watch ice, wetlands and forests change through genuine aerial and satellite imagery, <br/>and trace how NISAR radar can help measure the motion the eye can&rsquo;t see.</p>
    <div className="hero-col hero-cta">
     <span className="hero-planet hero-planet-l" aria-hidden="true"><img alt="" src={CUTOUT}/></span>
     <span className="hero-planet hero-planet-r" aria-hidden="true"><img alt="" src={CUTOUT}/></span>
     <a href="#explore" onClick={enter()}>START EXPLORING</a>
     <span className="hero-label hero-label-l" aria-hidden="true">OPTICAL</span>
     <span className="hero-label hero-label-r" aria-hidden="true">RADAR</span>
    </div>
    <a className="nisar-present-link" href="#simulation"><Radar size={14}/>WATCH THE NISAR STORY <ArrowRight size={14}/></a>
   </div>
   <a className="hero-scroll" href="#land-sources" onClick={jump('land-sources')} aria-label="Scroll to learn more"><svg viewBox="0 0 26 33" fill="none" aria-hidden="true"><path d="M13 1.5 V31.5 M1.9 20.4 L13 31.5 L24.1 20.4" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"/></svg></a>
  </div>
  <section id="land-sources" className="land-section">
   <header className="land-head" data-reveal><p className="land-kicker">The instruments</p><h2>Three ways of seeing Earth</h2><p>Radar and optical observations reveal different surface signals. Each image and analysis keeps its provenance.</p></header>
   <div className="land-sources">{SOURCES.map((s,i)=><article className="land-card" data-reveal style={{'--d':i} as CSSProperties} key={s.name}><span className="land-icon"><s.icon size={20}/></span><small>{s.agency}</small><h3>{s.name}</h3><p>{s.text}</p><div className="land-stats">{s.stats.map(x=><span key={x}>{x}</span>)}</div>{s.note&&<p className="land-note">{s.note}</p>}</article>)}</div>
  </section>
  <section id="land-regions" className="land-section land-regions">
   <header className="land-head" data-reveal><p className="land-kicker">Where to look</p><h2>Glaciers, wetlands and forests</h2><p>Scroll through them and the globe turns to meet each one.</p></header>
   {scenarios.map(s=>{const note=REGION_NOTES[s.id];return <article className={`land-region ${region===s.id?'is-active':''}`} data-reveal data-region={s.id} key={s.id}>
    <figure className="land-shot"><div>{tiles(s.center,12).map(src=><img key={src} src={src} alt="" loading="lazy"/>)}</div><figcaption>Esri World Imagery · undated</figcaption></figure>
    <div><small>{s.country}</small><h3>{s.name}</h3><p>{note?.fact??s.subtitle}</p><span className="land-data">{note?.data}</span><a href="#explore" onClick={enter(s.id)}>Explore {s.name}<ArrowRight size={15}/></a></div>
   </article>})}
  </section>
  <section id="land-how" className="land-section">
   <header className="land-head" data-reveal><p className="land-kicker">How it works</p><h2>See it. Then measure it.</h2></header>
   <ol className="land-steps">{STEPS.map((s,i)=><li className="land-card" data-reveal style={{'--d':i} as CSSProperties} key={s.title}><span className="land-num">0{i+1}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
   <p className="land-honest" data-reveal>Optical imagery shows how the surface looks. Measured glacier motion needs validated radar analysis, and SARscape marks that boundary everywhere.</p>
  </section>
  <footer className="land-footer" data-reveal>
   <h2>Ready to explore a changing landscape?</h2>
   <a className="land-cta" href="#explore" onClick={enter()}>START EXPLORING</a>
   <p>Built for the NASA Space Apps Challenge · Dancing with the SARs</p>
   <small>Globe and glacier imagery © Esri and contributors · Aerial mosaics © swisstopo · NISAR metadata via ASF</small>
  </footer>
 </section>
}
