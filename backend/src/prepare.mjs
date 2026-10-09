import {makeSamples,maskSamples} from './demo.mjs'
export function prepareBundle(scenario,dates,quality) {
 const raw=dates.map((_,step)=>makeSamples(scenario,step))
 const history=Object.fromEntries(raw[0].features.map(f=>[f.id,raw.map(frame=>frame.features.find(item=>item.id===f.id).properties.value)]))
 return {scenario:scenario.id,dates,frames:raw.map(c=>maskSamples(c,quality)),history,metadata:{synthetic:true,source:'Illustrative demonstration; not NISAR measurements',unit:scenario.unit,qualityThreshold:quality?0.6:null,version:1}}
}
