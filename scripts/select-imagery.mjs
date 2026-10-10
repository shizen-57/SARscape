import {readFile,mkdir,writeFile} from 'node:fs/promises'
const config=JSON.parse(await readFile(new URL('../database/scenarios.json',import.meta.url),'utf8'))
const manifestUrl=new URL('../database/imagery/sentinel2.json',import.meta.url)
const previous=JSON.parse(await readFile(manifestUrl,'utf8'))
const refresh=process.argv.includes('--refresh'),now=new Date(),endYear=now.getUTCFullYear()
const output={...previous,selection:'One low scene-cloud-cover capture per available year; August–September preferred, June–October used when unavailable. Scene cloud percentage is not a local glacier cloud mask.',scenarios:{}}
async function search(scenario,year,wide=false){
 const end=new Date(`${year}-${wide?'10-31':'09-30'}T23:59:59Z`)
 const body={collections:['sentinel-2-l2a'],intersects:{type:'Point',coordinates:scenario.center},datetime:`${year}-${wide?'06-01':'08-01'}T00:00:00Z/${(end<now?end:now).toISOString()}`,limit:100}
 if(!wide)body.query={'eo:cloud_cover':{lt:20}}
 let lastError
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch('https://earth-search.aws.element84.com/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
   if(!response.ok)throw new Error(`STAC ${response.status}`)
   const data=await response.json()
   return data.features.filter(f=>f.assets?.visual?.href&&Number.isFinite(f.properties?.['eo:cloud_cover'])&&f.properties['eo:cloud_cover']<60).sort((a,b)=>a.properties['eo:cloud_cover']-b.properties['eo:cloud_cover'])[0]
  }catch(error){lastError=error}
 }
 throw lastError
}
async function registerAzureAsset(frame,scenario){
 if(new URL(frame.url).hostname.endsWith('.blob.core.windows.net'))return frame
 const day=frame.date.slice(0,10),tile=frame.id.split('_')[1].padStart(5,'0')
 const body={collections:['sentinel-2-l2a'],intersects:{type:'Point',coordinates:scenario.center},datetime:`${day}T00:00:00Z/${day}T23:59:59Z`,limit:20}
 const response=await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
 if(!response.ok)throw new Error(`Planetary Computer catalog ${response.status}`)
 const data=await response.json()
 let candidates=data.features.filter(item=>item.assets?.visual?.href&&item.id.includes(`_T${tile}_`))
 if(!candidates.length){
  // A catalog can omit an exact acquisition. Use a genuine low-cloud capture
  // from the same seasonal window and record its actual date and source ID.
  const year=frame.date.slice(0,4)
  const seasonal=await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,datetime:`${year}-08-01T00:00:00Z/${year}-10-31T23:59:59Z`,limit:100}),signal:AbortSignal.timeout(30000)})
  if(!seasonal.ok)throw new Error(`Planetary Computer catalog ${seasonal.status}`)
  const alternatives=await seasonal.json()
  candidates=alternatives.features.filter(item=>item.assets?.visual?.href&&item.id.includes(`_T${tile}_`)&&item.properties['eo:cloud_cover']<60).sort((a,b)=>a.properties['eo:cloud_cover']-b.properties['eo:cloud_cover'])
 }
 const item=candidates.find(item=>item.properties.platform===frame.platform)??candidates[0]
 if(!item)return frame
 return {...frame,sourceSceneId:item.id,discoveryUrl:frame.metadataUrl,date:item.properties.datetime,datePrecision:'acquisition',cloudCover:item.properties['eo:cloud_cover'],url:item.assets.visual.href,metadataUrl:item.links.find(link=>link.rel==='self')?.href??`https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/${item.id}`,platform:item.properties.platform,deliverySource:'Microsoft Planetary Computer',bbox:item.bbox}
}
for(const scenario of config.scenarios.filter(s=>s.kind==='glacier')){
 const byYear=new Map((previous.scenarios[scenario.id]??[]).map(frame=>[Number(frame.date.slice(0,4)),frame]))
 for(let year=2018;year<=endYear;year++){
  if(byYear.has(year)&&!refresh)continue
  try{
   const best=await search(scenario,year)??await search(scenario,year,true)
   if(!best){console.log(`${scenario.id} ${year}: no suitable capture; keeping any registered frame`);continue}
   const self=best.links.find(l=>l.rel==='self')?.href
   byYear.set(year,{id:best.id,date:best.properties.datetime,datePrecision:'acquisition',cloudCover:best.properties['eo:cloud_cover'],url:best.assets.visual.href,metadataUrl:self,collection:best.collection,platform:best.properties.platform,bbox:best.bbox,resolutionMeters:best.assets.visual.gsd??10})
   console.log(`${scenario.id}: ${best.properties.datetime} scene cloud ${best.properties['eo:cloud_cover'].toFixed(2)}%`)
  }catch(error){console.error(`${scenario.id} ${year}: ${error.message}; retaining registered imagery`)}
 }
 const frames=[]
 for(const frame of byYear.values()){
  try{frames.push(await registerAzureAsset(frame,scenario))}
  catch(error){console.error(`${scenario.id} ${frame.date.slice(0,4)}: ${error.message}; retaining original asset`);frames.push(frame)}
 }
 output.scenarios[scenario.id]=frames.sort((a,b)=>a.date.localeCompare(b.date))
}
output.source='Copernicus Sentinel-2 L2A / Earth Search discovery and Planetary Computer delivery'
output.retrievedAt=now.toISOString()
await mkdir(new URL('../database/imagery/',import.meta.url),{recursive:true})
await writeFile(manifestUrl,JSON.stringify(output,null,2)+'\n')
