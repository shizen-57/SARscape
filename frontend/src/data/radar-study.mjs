export const STUDY_COLUMNS={alongTrack:4,slantRange:5,alongTrackSigma:6,slantRangeSigma:7,correlation:8,covariance:9,snr:10}
export function acceptedCells(cells,threshold){return cells.filter(cell=>cell[8]>=threshold)}
export function summaryStats(values){
 const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b)
 if(!sorted.length)return null
 const q=p=>{const index=(sorted.length-1)*p,lo=Math.floor(index),hi=Math.ceil(index);return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo)}
 return {count:sorted.length,min:sorted[0],max:sorted.at(-1),median:q(.5),p05:q(.05),p95:q(.95)}
}
export function interpolateOffset(offset,progress){return offset*Math.min(1,Math.max(0,progress))}
export function histogram(values,bins=24){
 const stats=summaryStats(values)
 if(!stats)return {bins:[],min:0,max:1}
 const min=stats.min,max=stats.max===min?min+1:stats.max,counts=Array(bins).fill(0)
 for(const value of values)if(Number.isFinite(value))counts[Math.min(bins-1,Math.floor((value-min)/(max-min)*bins))]++
 return {bins:counts,min,max}
}
