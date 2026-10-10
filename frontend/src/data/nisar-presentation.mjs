import {acceptedCells,summaryStats,STUDY_COLUMNS} from './radar-study.mjs'

export const CHAPTERS=[
 {id:'observe',label:'The two passes',title:'Two passes.\nTwelve days.',text:'Aletsch, seen by NISAR. Follow one real radar pair from acquisition to the measurements behind the image.',duration:14000},
 {id:'signal',label:'Replay the signal',title:'Make the\nsignal visible.',text:'Replay the measured signed offsets in radar component space. Each point is a source cell; the in-between positions are linear interpolation.',duration:24000},
 {id:'quality',label:'Question the signal',title:'Confidence\non stage.',text:'Raise the correlation cutoff and watch the coverage change. Better matching narrows the sample; it does not remove systematic bias.',duration:22000},
 {id:'evidence',label:'Trace the evidence',title:'Every number.\nIts source.',text:'Choose a cell, compare the processing windows, and open the original QA report. A compelling visual should be a checkable one.',duration:20000},
]
export const GUIDE_DURATION=CHAPTERS.reduce((sum,c)=>sum+c.duration,0)
export function chapterPreset(chapter){return {chapter,progress:chapter===0?0:1,threshold:chapter===0?0:.3,view:chapter===1?'radar':'geographic',reveal:0}}
export function guideState(fraction){
 let elapsed=Math.max(0,Math.min(1,fraction))*GUIDE_DURATION,index=0
 while(index<CHAPTERS.length-1&&elapsed>=CHAPTERS[index].duration){elapsed-=CHAPTERS[index].duration;index++}
 const t=Math.min(1,elapsed/CHAPTERS[index].duration),preset=chapterPreset(index)
 return {...preset,progress:index===1?t:preset.progress,threshold:index===2?[0,.1,.2,.3,.4][Math.min(4,Math.floor(t*5))]:preset.threshold,reveal:t}
}
export function mercator(lon,lat){const r=Math.PI/180;return [6378137*lon*r,6378137*Math.log(Math.tan(Math.PI/4+Math.max(-85.051129,Math.min(85.051129,lat))*r/2))]}
const quantile=(sorted,p)=>{const i=(sorted.length-1)*p,lo=Math.floor(i);return sorted[lo]+(sorted[Math.ceil(i)]-sorted[lo])*(i-lo)}
export function representativeCell(cells){
 if(!cells.length)return null
 const columns=[4,5,8].map(index=>{const values=cells.map(c=>c[index]).sort((a,b)=>a-b);return {index,median:quantile(values,.5),span:Math.max(1e-8,quantile(values,.75)-quantile(values,.25))}})
 let best=cells[0],score=Infinity
 for(const cell of cells){const distance=columns.reduce((sum,c)=>sum+((cell[c.index]-c.median)/c.span)**2,0);if(distance<score){best=cell;score=distance}}
 return best
}
export const cellKey=cell=>cell?`${cell[0]}:${cell[1]}`:null
const displayBases=new WeakMap()
export function createSignalModel(data,threshold,component='alongTrack'){
 if(!displayBases.has(data))displayBases.set(data,{alongScale:Math.max(20,Math.ceil(Math.max(0,...data.cells.map(c=>Math.abs(c[4])))/20)*20),slantScale:Math.max(20,Math.ceil(Math.max(0,...data.cells.map(c=>Math.abs(c[5])))/20)*20),alongP95:Math.max(1,summaryStats(data.cells.map(c=>Math.abs(c[4])))?.p95??1),slantP95:Math.max(1,summaryStats(data.cells.map(c=>Math.abs(c[5])))?.p95??1)})
 const basis=displayBases.get(data),cells=acceptedCells(data.cells,threshold),index=STUDY_COLUMNS[component],stats=summaryStats(cells.map(c=>c[index])),scale=component==='alongTrack'?basis.alongP95:basis.slantP95
 const points=cells.map(cell=>({cell,world:mercator(cell[2],cell[3]),value:cell[index],t:Math.min(1,Math.abs(cell[index])/scale)})),palette=new Map()
 for(const point of points){const bin=Math.round(point.t*24),key=`${point.value<0?'negative':'positive'}-${bin}`;if(!palette.has(key))palette.set(key,{negative:point.value<0,t:bin/24,points:[]});palette.get(key).points.push(point)}
 return {cells,stats,scale,index,representative:representativeCell(cells),along:summaryStats(cells.map(c=>c[4])),slant:summaryStats(cells.map(c=>c[5])),
  aScale:basis.alongScale,sScale:basis.slantScale,
  points,groups:[...palette.values()]}
}
export function validatePresentation(study,context,layers){
 if(!/^[a-f0-9]{64}$/.test(study.sourceSha256)||context.sourceSha256!==study.sourceSha256||context.radarReferenceDate!==study.referenceDate||context.radarSecondaryDate!==study.secondaryDate)throw new Error('The presentation context does not match this NISAR source pair.')
 const actualDays=(Date.parse(study.secondaryDate+'Z')-Date.parse(study.referenceDate+'Z'))/86400000
 if(actualDays!==study.pairDays||actualDays<=0||context.crs!=='EPSG:3857'||!context.bounds?.every(Number.isFinite)||context.bounds.length!==4||context.bounds[2]<=context.bounds[0]||context.bounds[3]<=context.bounds[1])throw new Error('Invalid acquisition interval or context coordinates.')
 for(const meta of study.layers){const data=layers[meta.id];if(!data||data.layer!==meta.id||data.shape.join(',')!==meta.shape.join(',')||data.cells.length!==meta.eligibleSamples||data.columns[4]!=='alongTrackOffsetM'||data.columns[5]!=='slantRangeOffsetM')throw new Error('The measured-cell layer does not match its source summary.')
  for(const cell of data.cells)if(cell.length!==11||!cell.slice(0,9).every(Number.isFinite)||cell[6]<0||cell[7]<0||cell[8]<0||cell[8]>1)throw new Error('Invalid measured cell in the presentation bundle.')
 }
}
