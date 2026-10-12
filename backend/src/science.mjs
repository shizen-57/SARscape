import {mkdir,readdir,readFile,writeFile,rename,unlink,open,stat} from 'node:fs/promises'
import config from '../../database/scenarios.json' with {type:'json'}
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
export function createScienceService({root,python}){
 const raw=join(root,'database/raw'),products=join(root,'database/processed/goff'),jobs=join(root,'database/jobs'),queue=[];let running=false
 const gcov=join(root,'database/processed/gcov')
 const gcovObservations=async scenario=>{
  let manifest
  try{manifest=JSON.parse(await readFile(join(gcov,'manifest.json'),'utf8'))}catch(error){if(error.code==='ENOENT')return [];throw error}
  if(!Array.isArray(manifest.observations))throw new Error('Invalid GCOV observation manifest')
  return manifest.observations.filter(observation=>observation?.scenario===scenario&&observation.product==='GCOV'&&typeof observation.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$/.test(observation.id)&&typeof observation.acquisitionDate==='string'&&currentExtent(scenario,observation.studyAreaExtent)&&observation.displayPreview?.file==='gcov-context.png'&&Array.isArray(observation.displayPreview.coordinates)&&observation.displayPreview.coordinates.length===4&&observation.displayPreview.coordinates.every(point=>Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90)).sort((a,b)=>a.acquisitionDate.localeCompare(b.acquisitionDate))
 }
 // A narrower prepared crop remains valid when the viewing area expands.
 // Its own georeferencing defines coverage; never imply data fills the new box.
 const extents=Object.fromEntries(config.scenarios.map(s=>[s.id,s.extent]))
 const currentExtent=(scenario,extent)=>{
  const target=extents[scenario]
  if(!target)return false
  if(!extent)return true
  return Array.isArray(extent)&&extent.length===4&&extent.every(Number.isFinite)&&extent[0]<extent[2]&&extent[1]<extent[3]&&Math.max(target[0],extent[0])<Math.min(target[2],extent[2])&&Math.max(target[1],extent[1])<Math.min(target[3],extent[3])
 }
 const children=new Set(),jobMap=new Map(),retrying=new Set()
 const initialized=(async()=>{
  await Promise.all([mkdir(raw,{recursive:true}),mkdir(products,{recursive:true}),mkdir(jobs,{recursive:true})])
  for(const filename of await readdir(jobs))if(filename.endsWith('.json')){
   try{const job=JSON.parse(await readFile(join(jobs,filename),'utf8'));if(['queued','processing','uploading'].includes(job.status)){job.status='interrupted';job.error='Processing was interrupted by a backend restart. Retry processing to reuse the uploaded file.';await writeFile(join(jobs,filename),JSON.stringify(job))}jobMap.set(job.id,job)}catch{}
  }
 })()
 const persist=async job=>{job.updatedAt=new Date().toISOString();jobMap.set(job.id,job);const temporary=join(jobs,job.id+'.tmp');await writeFile(temporary,JSON.stringify(job,null,2));await rename(temporary,join(jobs,job.id+'.json'))}
 const pump=async()=>{
  if(running||!queue.length)return
  running=true;const job=queue.shift()
  try{
   job.status='processing';await persist(job)
   const output=join(products,job.id)
   await new Promise((resolve,reject)=>{
    const child=spawn(python,['backend/geo/goff.py','--input',join(raw,job.id+'.h5'),'--output',output,'--scenario',job.scenario,'--frequency',job.frequency,'--polarization',job.polarization,'--layer',job.layer,'--correlation',String(job.correlation)],{cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe']});children.add(child)
    let errors='';child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-3000)})
    const timer=setTimeout(()=>{child.kill();reject(new Error('Processing exceeded 20 minutes'))},20*60*1000)
    child.once('error',error=>{clearTimeout(timer);children.delete(child);reject(error)})
    child.once('exit',code=>{clearTimeout(timer);children.delete(child);code===0?resolve():reject(new Error(errors.trim()||'Science processor failed'))})
   })
   job.provenance=JSON.parse(await readFile(join(output,'provenance.json'),'utf8'));job.status='complete'
  }catch(error){job.status='failed';job.error=error.message.replaceAll(root,'[project]')}
  await persist(job);running=false;void pump()
 }
 return {
  // Seasonal radar-change product (backend/geo/gcov_change.py); maps are only files the summary itself lists.
  async changeSummary(scenario){try{const summary=JSON.parse(await readFile(join(gcov,'change','change-summary.json'),'utf8'));return summary.scenario===scenario?summary:null}catch(error){if(error.code==='ENOENT')return null;throw error}},
  async changeArtifact(scenario,filename){const summary=await this.changeSummary(scenario);if(!summary?.steps?.some(step=>step.file===filename)&&!summary?.findings?.some(finding=>finding.clouds?.optical?.file===filename))return null;try{return await readFile(join(gcov,'change',filename))}catch(error){if(error.code==='ENOENT')return null;throw error}},
  async gcovList(scenario){return {available:true,observations:await gcovObservations(scenario)}},
  async gcovArtifact(scenario,id,filename){
   const files={'backscatter.png':'gcov-context.png','color.png':'gcov-color.png','natural.png':'gcov-natural.png','shaded.png':'gcov-shaded.png','terrain.webp':'gcov-terrain.webp','backscatter.tif':'gcov-backscatter.tif','provenance.json':'gcov-provenance.json'}
   if(!Object.hasOwn(files,filename)||!(await gcovObservations(scenario)).some(observation=>observation.id===id))return null
   try{return await readFile(join(gcov,id,files[filename]))}catch(error){if(error.code==='ENOENT')return null;throw error}
  },
  async list(scenario){await initialized;const seen=new Set();return {available:true,source:'Local NISAR GOFF processor',jobs:[...jobMap.values()].filter(j=>j.scenario===scenario&&currentExtent(scenario,j.provenance?.qualitySummary?.studyAreaExtent)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(job=>{const p=job.provenance;if(job.status!=='complete'||!p?.sourceGranuleId)return true;const key=JSON.stringify([p.sourceGranuleId,p.frequency,p.polarization,p.layer,p.correlationThreshold]);if(seen.has(key))return false;seen.add(key);return true}).map(({input,...job})=>job)}},
  async importFile(scenario,request,options){
   await initialized
   if(queue.length>=3)throw Object.assign(new Error('The processing queue is full. Wait for the current files to finish.'),{status:429})
   const length=Number(request.headers.get('content-length'));if(length>3*1024**3)throw Object.assign(new Error('Science files must be below 3 GB'),{status:413})
   if(!request.body)throw Object.assign(new Error('Select a GOFF HDF5 file'),{status:400})
   const id=randomUUID(),target=join(raw,id+'.h5'),temporary=target+'.part',handle=await open(temporary,'wx');let size=0,signature=new Uint8Array(0)
   try{
    for await(const chunk of request.body){
     size+=chunk.byteLength;if(size>3*1024**3)throw Object.assign(new Error('Science file exceeds 3 GB'),{status:413})
     if(signature.length<8){const next=new Uint8Array(Math.min(8,signature.length+chunk.length));next.set(signature);next.set(chunk.subarray(0,8-signature.length),signature.length);signature=next}
     if(signature.length===8&&!signature.every((v,i)=>v===[137,72,68,70,13,10,26,10][i]))throw Object.assign(new Error('The selected file is not HDF5'),{status:400})
     await handle.writeFile(chunk)
    }
    if(signature.length!==8)throw Object.assign(new Error('The selected file is incomplete'),{status:400})
    await handle.close();await rename(temporary,target)
   }catch(error){await handle.close().catch(()=>{});await unlink(temporary).catch(()=>{});throw error}
   const job={id,scenario,status:'queued',createdAt:new Date().toISOString(),bytes:size,...options};await persist(job);queue.push(job);void pump();return job
  },
  async artifact(scenario,id,filename){await initialized;const job=jobMap.get(id);if(!job||job.scenario!==scenario||job.status!=='complete'||!['samples.geojson','provenance.json','radar-components.tif','radar-preview.tif','motion-preview.json'].includes(filename))return null;try{return await readFile(join(products,id,filename))}catch(error){if(error.code==='ENOENT')return null;throw error}},
  async retry(scenario,id){
   await initialized
   const job=jobMap.get(id)
   if(!job||job.scenario!==scenario)throw Object.assign(new Error('Observation job not found'),{status:404})
   if(retrying.has(id))throw Object.assign(new Error('This job is already restarting'),{status:409})
   if(!['failed','interrupted'].includes(job.status))throw Object.assign(new Error('Only failed or interrupted jobs can be retried'),{status:409})
   if(queue.length>=3)throw Object.assign(new Error('The processing queue is full'),{status:429})
   retrying.add(id)
   try{
    try{await stat(join(raw,id+'.h5'))}catch{throw Object.assign(new Error('The original file is missing. Import the file again.'),{status:410})}
    job.status='queued';delete job.error;await persist(job);queue.push(job);void pump();return job
   }finally{retrying.delete(id)}
  },
  close(){for(const child of children)child.kill()}
 }
}
