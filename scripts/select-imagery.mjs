import {readFile,mkdir,writeFile} from 'node:fs/promises'
const config=JSON.parse(await readFile(new URL('../database/scenarios.json',import.meta.url),'utf8'))
const output={source:'Copernicus Sentinel-2 L2A / Element 84 Earth Search',retrievedAt:new Date().toISOString(),resolutionMeters:10,selection:'One lowest scene-cloud-cover August–September capture per year; scene cloud percentage is not a local glacier cloud mask.',scenarios:{}}
for(const scenario of config.scenarios){
 const frames=[]
 for(const year of [2018,2019,2020,2021,2022,2023,2024,2025]){
  const body={collections:['sentinel-2-l2a'],intersects:{type:'Point',coordinates:scenario.center},datetime:`${year}-08-01T00:00:00Z/${year}-09-30T23:59:59Z`,query:{'eo:cloud_cover':{lt:20}},limit:100}
  const response=await fetch('https://earth-search.aws.element84.com/v1/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)})
  if(!response.ok)throw new Error(`${scenario.id} ${year}: STAC ${response.status}`)
  const data=await response.json(),best=data.features.filter(f=>f.assets?.visual?.href).sort((a,b)=>a.properties['eo:cloud_cover']-b.properties['eo:cloud_cover'])[0]
  if(!best){console.log(`${scenario.id} ${year}: no suitable frame`);continue}
  const self=best.links.find(l=>l.rel==='self')?.href
  frames.push({id:best.id,date:best.properties.datetime,cloudCover:best.properties['eo:cloud_cover'],url:best.assets.visual.href,metadataUrl:self,collection:best.collection,platform:best.properties.platform,bbox:best.bbox,resolutionMeters:best.assets.visual.gsd??10})
  console.log(`${scenario.id}: ${best.properties.datetime} cloud ${best.properties['eo:cloud_cover'].toFixed(2)}%`)
 }
 output.scenarios[scenario.id]=frames
}
await mkdir(new URL('../database/imagery/',import.meta.url),{recursive:true})
await writeFile(new URL('../database/imagery/sentinel2.json',import.meta.url),JSON.stringify(output,null,2)+'\n')
