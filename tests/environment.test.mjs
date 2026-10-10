import test from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createApi} from '../backend/src/app.mjs'
import {createScienceService} from '../backend/src/science.mjs'
import {pythonExecutable} from '../backend/src/python.mjs'
import additional from '../database/imagery/additional-sentinel2.json' with {type:'json'}
const exec=promisify(execFile),python=pythonExecutable(process.cwd())
test('real annual environmental captures have verified bands, radiometry and seasonal dates',async()=>{
 const app=createApi()
 for(const id of ['sundarbans','rondonia']){
  const data=await (await app.request('/api/imagery/'+id)).json();assert.equal(data.frames.length,9)
  assert.deepEqual(data.frames.map(f=>f.date.slice(0,4)),Array.from({length:9},(_,i)=>String(2018+i)))
  for(const frame of data.frames){assert.ok(Date.parse(frame.date)<=Date.now());for(const band of ['green','red','nir','scl'])assert.ok(frame.assets[band].endsWith('.tif'));for(const band of ['green','red','nir']){const radiometry=frame.assetMetadata[band]['raster:bands'][0];assert.equal(radiometry.scale,.0001);assert.equal(radiometry.offset,Number(frame.date.slice(0,4))>=2022?-.1:0)}}
 }
})
test('analysis routes validate studies, origin, files, bands and tile coordinates',async()=>{
 let reads=0,prepared=0,tiles=0
 const app=createApi({analysis:{list:async()=>({available:true,frames:[]}),prepare:async()=>{prepared++;return {status:'queued'}},artifact:async(_id,_frame,file)=>file==='summary.json'?new TextEncoder().encode('{}'):null},renderIndex:async()=>{tiles++;return new Uint8Array([137,80,78,71])},fetchUpstream:async()=>{reads++;return new Response(null,{headers:{'Content-Length':'100'}})}})
 assert.equal((await app.request('/api/analysis/aletsch')).status,404)
 assert.equal((await app.request('/api/analysis/sundarbans/prepare',{method:'POST',headers:{Origin:'https://untrusted.example'}})).status,403)
 assert.equal((await app.request('/api/analysis/sundarbans/prepare',{method:'POST'})).status,202);assert.equal(prepared,1)
 const frame=additional.scenarios.sundarbans[0].id
 assert.equal((await app.request(`/api/imagery/cog/sundarbans/${frame}/nir.tif`,{method:'HEAD'})).status,200);assert.equal(reads,1)
 assert.equal((await app.request(`/api/imagery/cog/sundarbans/${frame}/private.tif`,{method:'HEAD'})).status,404);assert.equal(reads,1)
 assert.equal((await app.request(`/api/analysis/tiles/sundarbans/${frame}/index/14/12268/7167.png`)).status,200)
 assert.equal((await app.request(`/api/analysis/tiles/sundarbans/${frame}/index/14/99999/1.png`)).status,400);assert.equal(tiles,1)
 assert.equal((await app.request(`/api/analysis/sundarbans/${frame}/unknown.json`)).status,404)
})
test('GCOV schemas, aligned index change, masks and zero-power behavior are verified',async()=>{
 const {stderr}=await exec(python,['tests/gcov_schema_test.py'],{timeout:45000,maxBuffer:2*1024*1024});assert.match(stderr,/Ran 6 tests/);assert.match(stderr,/OK/)
})
test('science inspection, actual-channel selection and cached reprocessing work end to end',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sarscape-inspect-'));let service
 try{
  await mkdir(join(root,'backend/geo'),{recursive:true});await mkdir(join(root,'database'),{recursive:true})
  for(const file of ['goff.py','gcov.py','gcov_compare.py','inspect_nisar.py','preview.py','science.py','process_lifecycle.py'])await copyFile(join(process.cwd(),'backend/geo',file),join(root,'backend/geo',file))
  await copyFile('database/scenarios.json',join(root,'database/scenarios.json'))
  const file=join(root,'fixture.h5');await exec(python,['tests/gcov_schema_test.py','--fixture',file])
  service=createScienceService({root,python})
  const job=await service.importFile('aletsch',new Request('http://local/import',{method:'POST',body:await readFile(file)}),{inspectOnly:true})
  const waitFor=async status=>{const deadline=Date.now()+20000;let value;do{value=(await service.list('aletsch')).jobs.find(j=>j.id===job.id);if(value.status==='failed')assert.fail(value.error);if(value.status===status)return value;await new Promise(resolve=>setTimeout(resolve,30))}while(Date.now()<deadline);assert.fail('Timed out: '+value.status)}
  const inspected=await waitFor('awaiting_settings');assert.equal(inspected.inventory.product,'GCOV');assert.equal(inspected.inventory.choices.length,1)
  await assert.rejects(service.process('aletsch',job.id,{frequency:'B',polarization:'HH',layer:'layer1',correlation:.3}),error=>error.status===400)
  await service.process('aletsch',job.id,{frequency:'A',polarization:'HH',layer:'layer1',correlation:.3});const complete=await waitFor('complete');assert.equal(complete.provenance.product,'GCOV')
  assert.ok((await service.artifact('aletsch',job.id,'radar-components.tif')).length>100)
  assert.equal(await service.artifact('sundarbans',job.id,'radar-components.tif'),null)
  const another=await service.process('aletsch',job.id,{frequency:'A',polarization:'HH',layer:'layer1',correlation:.3});assert.notEqual(another.id,job.id);assert.ok((await service.artifact('aletsch',job.id,'samples.geojson')).length)
  const deadline=Date.now()+10000;while((await service.list('aletsch')).jobs.find(j=>j.id===another.id).status!=='complete'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,30))
 }finally{service?.close();await rm(root,{recursive:true,force:true})}
})
