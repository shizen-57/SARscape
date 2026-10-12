import type {GoffJob} from './SciencePanel'
import type {RadarComponent,RadarDisplayMode} from './RadarControls'
import {RADAR_COLORS,radarDisplayValue} from '../data/radar-display.mjs'

export function radarPopup(values:Record<string,unknown>,observation:GoffJob,component:RadarComponent,mode:RadarDisplayMode,scale:number){
 const days=observation.provenance?.pairDays??0,value=radarDisplayValue(values[component],mode,days)??0
 const root=document.createElement('div');root.className='radar-popup radar-visual-popup'
 const add=(parent:HTMLElement,tag:string,text:string,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;parent.append(el);return el}
 const componentName=component==='alongTrack'?'Along the satellite track':'Along the radar line of sight'
 add(root,'strong',componentName)
 add(root,'div',`${value>0?'+':''}${value.toLocaleString(undefined,{maximumFractionDigits:1})} ${mode==='pair'?'m':'m/day'}`,'radar-popup-value')
 add(root,'p',mode==='pair'?`Full pair displacement over ${days.toFixed(0)} days`:'Average component rate between acquisitions','radar-popup-caption')
 const track=add(root,'div','','radar-popup-track');track.setAttribute('aria-hidden','true')
 const bar=add(track,'span','','radar-popup-bar');bar.style.width=`${Math.min(1,Math.abs(value)/scale)*50}%`;bar.style.left=value<0?`${50-Math.min(1,Math.abs(value)/scale)*50}%`:'50%';bar.style.background=value<0?RADAR_COLORS.negative:RADAR_COLORS.positive
 const p=observation.provenance
 if(p)add(root,'p',`${p.referenceDate.slice(0,10)} → ${p.secondaryDate.slice(0,10)}`,'radar-popup-caption')
 const details=document.createElement('details');details.className='radar-measurement-details';root.append(details);add(details,'summary','Measurement details')
 const measurements=add(details,'dl','')
 const number=(v:unknown,digits=3)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(digits):'Unavailable'
 const row=(label:string,measurement:string)=>{const row=add(measurements,'div','');add(row,'dt',label);add(row,'dd',measurement)}
 row('Along-track rate',`${number(values.alongTrack)} ± ${number(values.alongTrackSigma)} m/day`)
 row('Slant-range rate',`${number(values.slantRange)} ± ${number(values.slantRangeSigma)} m/day`)
 row('Correlation',number(values.correlation,2))
 add(details,'p','± values are 1σ formal uncertainty. Bias is uncorrected. Pair displacement = component rate × pair duration. Glacier flow interpretation requires independent validation.')
 return root
}
