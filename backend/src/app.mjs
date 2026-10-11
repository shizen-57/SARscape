import {Hono} from 'hono'
import {compress} from 'hono/compress'
import config from '../../database/scenarios.json' with {type:'json'}
import {imageryManifest,imageryFrame,imagerySelection} from './imagery.mjs'
import {createCogReader} from './cog.mjs'
import {createAerialReader} from './aerial.mjs'
export function createApi({cache,fetchUpstream=fetch,renderTile=()=>{throw new Error('Configure a raster renderer')},science,analysis,renderIndex,study,surfaces,assistant}={}) {
 const app=new Hono(),memory=new Map(),pending=new Map()
 const store=cache??{get:async key=>{const entry=memory.get(key);return entry&&entry.expires>Date.now()?entry.value:null},set:async(key,value,ttl)=>{if(memory.size>=32)memory.delete(memory.keys().next().value);memory.set(key,{value,expires:Date.now()+ttl})}}
 const memo=async(key,ttl,create)=>{const cached=await store.get(key);if(cached)return {value:cached,hit:true};if(pending.has(key))return {value:await pending.get(key),hit:true};const job=create().then(async value=>{await store.set(key,value,ttl);return value}).finally(()=>pending.delete(key));pending.set(key,job);return {value:await job,hit:false}}
 app.use('/api/catalog/*',compress())
 app.use('/api/science/study/*',compress())
 app.use('/api/analysis/*',compress())
 app.use('/api/*',async(c,next)=>{const start=performance.now();await next();c.header('Server-Timing',`api;dur=${(performance.now()-start).toFixed(1)}`);c.header('X-Content-Type-Options','nosniff')})
 app.get('/api/health',c=>c.json({status:'ok',service:'sarscape-backend',realOpticalImagery:true,scienceProcessing:Boolean(science)}))
 const environmental=id=>config.scenarios.some(s=>s.id===id&&s.kind!=='glacier')
 const trusted=c=>!c.req.header('origin')||['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:8787','http://localhost:8787'].includes(c.req.header('origin'))
 app.get('/api/analysis/:id',async c=>{
  const id=c.req.param('id');if(!environmental(id))return c.json({error:'Unknown index study'},404)
  return c.json(analysis?await analysis.list(id):{available:false,frames:[],reason:'Index processing requires the local backend.'})
 })
 app.post('/api/analysis/:id/prepare',async c=>{
  const id=c.req.param('id');if(!environmental(id))return c.json({error:'Unknown index study'},404)
  if(!trusted(c))return c.json({error:'Untrusted processing origin'},403)
  if(!analysis)return c.json({error:'Index processing requires the local backend.'},503)
  return c.json(await analysis.prepare(id),202)
 })
 app.get('/api/analysis/:id/:frame/:file',async c=>{
  const bytes=await analysis?.artifact(c.req.param('id'),c.req.param('frame'),c.req.param('file'))
  if(!bytes)return c.json({error:'Prepare this index study first.'},404)
  const name=c.req.param('file');return c.body(bytes,200,{'Content-Type':name.endsWith('.png')?'image/png':name.endsWith('.tif')?'image/tiff':'application/json','Cache-Control':'private,max-age=3600'})
 })
 app.get('/api/analysis/tiles/:id/:frame/:mode/:z/:x/:y',async c=>{
  const id=c.req.param('id'),frame=imageryFrame(id,c.req.param('frame')),mode=c.req.param('mode'),z=Number(c.req.param('z')),x=Number(c.req.param('x')),y=Number(c.req.param('y').replace('.png',''))
  if(!environmental(id)||!frame||!['index','change'].includes(mode)||!Number.isInteger(z)||z<0||z>14||![x,y].every(v=>Number.isInteger(v)&&v>=0&&v<2**z))return c.json({error:'Invalid index tile'},400)
  if(!renderIndex)return c.json({error:'Index map rendering requires the local backend.'},503)
  return c.body(await renderIndex(id,frame.id,mode,z,x,y),200,{'Content-Type':'image/png','Cache-Control':'private,max-age=86400'})
 })
 const readCog=createCogReader(fetchUpstream)
 const readAerial=createAerialReader(fetchUpstream)
 app.on(['GET','HEAD'],'/api/imagery/cog/:id/:frame/:asset',async c=>{
  const frame=imageryFrame(c.req.param('id'),c.req.param('frame'))
  if(!frame)return c.json({error:'Unknown observation frame'},404)
  const asset=c.req.param('asset').replace(/\.tif$/,'')
  const url=asset==='TCI'?frame.url:frame.assets?.[asset]
  if(!url)return c.json({error:'Unknown observation band'},404)
  return readCog({...frame,url,sourceSceneId:(frame.sourceSceneId??frame.id)+':'+asset},c.req.method,c.req.header('range'))
 })
 app.get('/api/scenarios',c=>c.json({scenarios:config.scenarios.map(({id,name,country,center,zoom,pitch,bearing,extent,kind})=>({id,name,country,center,zoom,pitch,bearing,extent,kind}))}))
 app.get('/api/science/study/supplied/:file',async c=>{
  if(!study)return c.json({error:'The supplied NISAR study requires the local backend.'},503)
  const name=c.req.param('file'),bytes=await study.artifact(name)
  if(!bytes)return c.json({error:'Study artifact unavailable. Run npm run science:study with the supplied files in the project root.'},404)
  return c.body(bytes,200,{'Content-Type':name.endsWith('.pdf')?'application/pdf':name.endsWith('.png')?'image/png':name.endsWith('.tif')?'image/tiff':name.endsWith('.geojson')?'application/geo+json':'application/json','Cache-Control':'no-cache'})
 })
 app.get('/api/surfaces/:id',async c=>{
  if(!config.scenarios.some(s=>s.id===c.req.param('id')))return c.json({error:'Unknown glacier'},404)
  return c.json(surfaces?await surfaces.list(c.req.param('id')):{available:false,frames:[]})
 })
 app.get('/api/surfaces/:id/:file',async c=>{
  const bytes=await surfaces?.artifact(c.req.param('id'),c.req.param('file'))
  if(!bytes)return c.json({error:'Surface artifact not found'},404)
  const file=c.req.param('file')
  return c.body(bytes,200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.tif')?'image/tiff':file.endsWith('.geojson')?'application/geo+json':'application/json','Cache-Control':'private,max-age=3600'})
 })
 app.get('/api/science/:id',async c=>{
  if(!config.scenarios.some(s=>s.id===c.req.param('id')))return c.json({error:'Unknown location'},404)
  return c.json(science?await science.list(c.req.param('id')):{available:false,jobs:[],reason:'Science processing requires the local backend or a dedicated processing service.'})
 })
 app.get('/api/science/:id/gcov',async c=>{
  if(!config.scenarios.some(s=>s.id===c.req.param('id')))return c.json({error:'Unknown study area'},404)
  return c.json(science?.gcovList?await science.gcovList(c.req.param('id')):{available:false,observations:[]})
 })
 app.get('/api/science/:id/gcov/:observation/:file',async c=>{
  if(!config.scenarios.some(s=>s.id===c.req.param('id')))return c.json({error:'Unknown study area'},404)
  const file=c.req.param('file'),types={'backscatter.png':'image/png','color.png':'image/png','natural.png':'image/png','shaded.png':'image/png','backscatter.tif':'image/tiff','provenance.json':'application/json'}
  if(!Object.hasOwn(types,file))return c.json({error:'Unknown GCOV artifact'},404)
  const bytes=await science?.gcovArtifact?.(c.req.param('id'),c.req.param('observation'),file)
  if(!bytes)return c.json({error:'GCOV artifact not found'},404)
  return c.body(bytes,200,{'Content-Type':types[file],'Cache-Control':'private,max-age=3600'})
 })
 app.post('/api/science/:id/import',async c=>{
  if(!science)return c.json({error:'A dedicated science backend is required'},503)
  if(!config.scenarios.some(s=>s.id===c.req.param('id')))return c.json({error:'Unknown location'},404)
  if(!trusted(c))return c.json({error:'Untrusted upload origin'},403)
  const frequency=c.req.query('frequency')??'A',polarization=c.req.query('polarization')??'HH',layer=c.req.query('layer')??'layer1',correlation=Number(c.req.query('correlation')??0.3)
  if(!['A','B'].includes(frequency)||!['HH','HV','VV','VH','RH','RV'].includes(polarization)||!['layer1','layer2','layer3'].includes(layer)||!Number.isFinite(correlation)||correlation<0||correlation>1)return c.json({error:'Invalid processing settings'},400)
  try{return c.json(await science.importFile(c.req.param('id'),c.req.raw,{frequency,polarization,layer,correlation,inspectOnly:c.req.query('inspect')==='true'}),202)}catch(error){return c.json({error:error.status?error.message:'Could not import the science file'},error.status??500)}
 })
 app.post('/api/science/:id/jobs/:job/process',async c=>{
  if(!trusted(c))return c.json({error:'Untrusted processing origin'},403)
  if(!science?.process)return c.json({error:'A dedicated science backend is required'},503)
  let settings;try{settings=await c.req.json()}catch{return c.json({error:'Processing settings must be JSON'},400)}
  const {frequency,polarization,layer,correlation}=settings??{}
  if(!['A','B'].includes(frequency)||!['HH','HV','VV','VH','RH','RV'].includes(polarization)||!['layer1','layer2','layer3'].includes(layer)||!Number.isFinite(correlation)||correlation<0||correlation>1)return c.json({error:'Invalid processing settings'},400)
  try{return c.json(await science.process(c.req.param('id'),c.req.param('job'),{frequency,polarization,layer,correlation}),202)}catch(error){return c.json({error:error.status?error.message:'Could not process the observation'},error.status??500)}
 })
 app.post('/api/science/:id/compare',async c=>{
  if(!trusted(c))return c.json({error:'Untrusted processing origin'},403)
  if(!science?.compare)return c.json({error:'A dedicated science backend is required'},503)
  let body;try{body=await c.req.json()}catch{return c.json({error:'Comparison settings must be JSON'},400)}
  if(typeof body?.older!=='string'||typeof body?.newer!=='string')return c.json({error:'Choose two observation jobs'},400)
  try{return c.json(await science.compare(c.req.param('id'),body.older,body.newer),202)}catch(error){return c.json({error:error.status?error.message:'Could not compare the observations'},error.status??500)}
 })
 app.get('/api/science/:id/products/:job/:file',async c=>{
  const filename=c.req.param('file'),bytes=await science?.artifact(c.req.param('id'),c.req.param('job'),filename)
  if(!bytes)return c.json({error:'Processed product not found'},404)
  c.header('Content-Disposition',`attachment; filename="sarscape-${c.req.param('job')}-${filename}"`)
  return c.body(bytes,200,{'Content-Type':filename.endsWith('.tif')?'image/tiff':filename.endsWith('.geojson')?'application/geo+json':'application/json','Cache-Control':'private,max-age=3600'})
 })
 app.post('/api/science/:id/jobs/:job/retry',async c=>{
  if(!science?.retry)return c.json({error:'A dedicated science backend is required'},503)
  if(!trusted(c))return c.json({error:'Untrusted processing origin'},403)
  try{return c.json(await science.retry(c.req.param('id'),c.req.param('job')),202)}catch(error){return c.json({error:error.status?error.message:'Could not retry processing'},error.status??500)}
 })
 app.get('/api/imagery/:id',c=>{
  if(c.req.query('source')==='reference'){
   if(!config.scenarios.some(s=>s.id===c.req.param('id')))return c.json({error:'Unknown location'},404)
   return c.json({source:'Esri World Imagery reference mosaic',selection:'Highest available reference imagery for this location. Acquisition dates and ground resolution vary and are not verified here. This layer cannot establish yearly change.',frames:[{id:'reference',date:'Undated',datePrecision:'undated',cloudCover:null,resolutionMeters:null,platform:'Esri World Imagery',bbox:[-180,-85,180,85],url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',tileTemplate:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',metadataUrl:'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer',attribution:'Reference imagery © Esri and contributors · acquisition dates vary'}]})
  }
  if(c.req.query('source')==='swissimage'){
   if(c.req.param('id')!=='aletsch')return c.json({error:'Swiss aerial imagery is available for Aletsch only'},400)
   c.header('Cache-Control','public,max-age=3600')
   const metadataUrl='https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10'
   return c.json({source:'swisstopo SWISSIMAGE Journey through time (WMTS)',selection:'Annual mosaic versions, not annual acquisitions. Each version contains the latest available aerial images for that year; local acquisition dates vary and adjacent versions may repeat the same image. Alps source resolution is typically 25 cm. Terrain remains fixed.',frames:Array.from({length:8},(_,i)=>{
    const year=String(2018+i),tileTemplate=`https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/${year}/3857/{z}/{x}/{y}.jpeg`
    return {id:year,date:year,datePrecision:'mosaic-year',cloudCover:null,url:tileTemplate,tileTemplate:`/api/imagery/aerial/${year}/{z}/{x}/{y}.jpeg`,metadataUrl,platform:'SWISSIMAGE aerial mosaic',resolutionMeters:0.25,bbox:[5.140242,45.398181,11.47757,48.230651],attribution:'SWISSIMAGE © <a href="https://www.swisstopo.admin.ch/">swisstopo</a> · mosaic year; acquisition dates vary'}
   })})
  }
  const frames=imageryManifest.scenarios[c.req.param('id')];if(!frames)return c.json({error:'Unknown location'},404)
  c.header('Cache-Control','public,max-age=3600')
  return c.json({source:imageryManifest.source,selection:imagerySelection(c.req.param('id')),retrievedAt:imageryManifest.retrievedAt,...imageryManifest.studyMetadata?.[c.req.param('id')],frames:frames.map(frame=>({...frame,id:frame.sourceSceneId??frame.id,registrationId:frame.id,datePrecision:'acquisition'}))})
 })
 app.get('/api/imagery/aerial/:year/:z/:x/:y',async c=>{
  const year=Number(c.req.param('year')),z=Number(c.req.param('z')),x=Number(c.req.param('x')),y=Number(c.req.param('y').replace('.jpeg',''))
  if(!Number.isInteger(year)||year<2018||year>2025||!Number.isInteger(z)||z<0||z>20||![x,y].every(v=>Number.isInteger(v)&&v>=0&&v<2**z))return c.json({error:'Invalid aerial tile'},400)
  // Official mosaic tiles may be revised: expire after one day, never immutable.
  const result=await memo(`swissimage-v1-${year}-${z}-${x}-${y}`,86400000,async()=>{
   const bytes=await readAerial(year,z,x,y)
   let binary=''
   for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768))
   return btoa(binary)
  })
  return c.body(Uint8Array.from(atob(result.value),c=>c.charCodeAt(0)),200,{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400','X-Cache':result.hit?'HIT':'MISS'})
 })
 app.get('/api/imagery/tiles/:id/:frame/:z/:x/:y',async c=>{
  const frame=imageryFrame(c.req.param('id'),c.req.param('frame'))
  if(!frame)return c.json({error:'Unknown observation frame'},404)
  const z=Number(c.req.param('z')),x=Number(c.req.param('x')),y=Number(c.req.param('y').replace('.png',''))
  if(!Number.isInteger(z)||z<0||z>17||![x,y].every(v=>Number.isInteger(v)&&v>=0&&v<2**z))return c.json({error:'Invalid tile coordinate'},400)
  const bytes=await renderTile(frame,z,x,y,c.req.param('id'))
  return c.body(bytes,200,{'Content-Type':'image/png','Cache-Control':'public,max-age=31536000,immutable'})
 })
 app.get('/api/catalog/:id',async c=>{
  const scenario=config.scenarios.find(s=>s.id===c.req.param('id'));if(!scenario)return c.json({error:'Unknown location'},404)
  const result=await memo(`catalog-v2-${scenario.id}-${scenario.product}`,3600000,async()=>{
   const params=new URLSearchParams({dataset:'NISAR',bbox:scenario.extent.join(','),processingLevel:scenario.product,end:new Date().toISOString(),maxResults:'12',output:'geojson'})
   const response=await fetchUpstream('https://api.daac.asf.alaska.edu/services/search/param?'+params,{signal:AbortSignal.timeout(18000)})
   if(!response.ok)throw new Error(`ASF returned ${response.status}`)
   const data=await response.json();if(!Array.isArray(data.features))throw new Error('Unexpected ASF response')
   return {source:'ASF NISAR Search API',retrievedAt:new Date().toISOString(),records:data.features.map((f,i)=>{const p=f.properties??{},url=String(p.url??''),fileId=String(p.fileID??p.sceneName??`Record ${i+1}`),pol=p.mainBandPolarization??p.polarization,pola=Array.isArray(pol)?pol.join(', '):String(pol??'See granule metadata');return {id:fileId,date:String(p.startTime??''),stopDate:String(p.stopTime??''),product:String(p.processingLevel??scenario.product),polarization:pola,maturity:String(p.dataMaturity??p.maturity??(url.includes('PROVISIONAL')?'PROVISIONAL':'Check granule metadata')),url:/^https:\/\//.test(url)?url:'https://search.asf.alaska.edu/',bytes:typeof p.bytes==='number'?p.bytes:typeof p.bytes?.h5==='number'?p.bytes.h5:null}})}
  })
  c.header('Cache-Control','public, max-age=600');c.header('X-Cache',result.hit?'HIT':'MISS');return c.json(result.value)
 })
 app.get('/api/assistant/status',c=>c.json({available:Boolean(assistant?.configured())}))
 app.post('/api/assistant/chat',async c=>{
  if(!assistant)return c.json({error:'The assistant is not available on this deployment.'},503)
  const origin=c.req.header('origin')
  if(origin&&!['http://127.0.0.1:5173','http://localhost:5173','http://127.0.0.1:8787'].includes(origin))return c.json({error:'Untrusted origin'},403)
  if(Number(c.req.header('content-length')??0)>64*1024)return c.json({error:'Message too large'},413)
  let body;try{body=await c.req.json()}catch{return c.json({error:'Invalid request'},400)}
  if(!config.scenarios.some(s=>s.id===body?.scenario))return c.json({error:'Unknown glacier'},404)
  try{return c.json(await assistant.chat(body))}catch(error){console.error('Assistant failed:',error.message);return c.json({error:error.status?error.message:'The assistant failed. Please retry.'},error.status??502)}
 })
 app.notFound(c=>c.json({error:'Not found'},404))
 app.onError((error,c)=>{console.error('Backend request failed:',c.req.method,c.req.path,error.message,error.cause?.code??error.cause?.cause?.code??'');return c.json({error:c.req.path.startsWith('/api/catalog')?'Could not retrieve the ASF catalog. Try again or open Vertex.':'Could not prepare this map layer. Please retry.'},502)})
 return app
}
