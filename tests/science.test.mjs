import test from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
import {createApi} from '../backend/src/app.mjs'
import {createScienceService} from '../backend/src/science.mjs'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
test('science endpoints validate settings, file origin, availability and artifact access',async()=>{
 let imported=0,retries=0;const service={list:async()=>({available:true,jobs:[]}),importFile:async()=>{imported++;return {id:'job',status:'queued'}},retry:async()=>{retries++;return {id:'job',status:'queued'}},artifact:async()=>null},app=createApi({science:service})
 assert.equal((await app.request('/api/science/unknown')).status,404)
 assert.equal((await app.request('/api/science/aletsch/import?frequency=C',{method:'POST',body:'a'})).status,400)
 assert.equal((await app.request('/api/science/aletsch/import',{method:'POST',headers:{Origin:'https://untrusted.example'},body:'a'})).status,403)
 assert.equal((await app.request('/api/science/aletsch/import',{method:'POST',headers:{Origin:'http://127.0.0.1:5173'},body:'a'})).status,202);assert.equal(imported,1)
 assert.equal((await app.request('/api/science/aletsch/products/unknown/samples.geojson')).status,404)
 assert.equal((await app.request('/api/science/aletsch/jobs/job/retry',{method:'POST',headers:{Origin:'https://untrusted.example'}})).status,403);assert.equal(retries,0)
 assert.equal((await app.request('/api/science/aletsch/jobs/job/retry',{method:'POST',headers:{Origin:'http://127.0.0.1:5173'}})).status,202);assert.equal(retries,1)
 const hosted=createApi();assert.equal((await (await hosted.request('/api/science/aletsch')).json()).available,false);assert.equal((await hosted.request('/api/science/aletsch/import',{method:'POST',body:'a'})).status,503)
})
test('GOFF processor validates official schema, real units, masks, pair duration and uncertainty',async()=>{
 const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
 const {stderr}=await promisify(execFile)(python,['tests/goff_schema_test.py'],{timeout:120000,maxBuffer:2*1024*1024});assert.match(stderr,/Ran 6 tests/);assert.match(stderr,/OK/)
})
test('aerial-shaded radar maths',async()=>{
 const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
 const {stderr}=await promisify(execFile)(python,['tests/gcov_shaded_test.py'],{timeout:120000,maxBuffer:2*1024*1024});assert.match(stderr,/Ran 3 tests/);assert.match(stderr,/OK/)
})
test('motion preview filters, stable-ground reference and flow-direction decision',async()=>{
 const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
 const {stderr}=await promisify(execFile)(python,['tests/goff_motion_test.py'],{timeout:120000,maxBuffer:2*1024*1024});assert.match(stderr,/Ran 8 tests/);assert.match(stderr,/OK/)
})
test('interrupted processing reuses the existing upload and prevents duplicate retries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'sarscape-retry-')),id='recovery-fixture'
 let service
 try{
  await mkdir(join(root,'database/jobs'),{recursive:true});await mkdir(join(root,'database/raw'),{recursive:true})
  await writeFile(join(root,'database/jobs',id+'.json'),JSON.stringify({id,scenario:'aletsch',status:'processing',createdAt:new Date().toISOString(),frequency:'A',polarization:'HH',layer:'layer1',correlation:0.3}))
  await writeFile(join(root,'database/raw',id+'.h5'),'test-only incomplete file')
  // Deliberately unavailable processor: exercises recovery without publishing science fixtures.
  service=createScienceService({root,python:join(root,'missing-python.exe')})
  assert.equal((await service.list('aletsch')).jobs[0].status,'interrupted')
  await assert.rejects(service.retry('columbia',id),error=>error.status===404)
  const attempts=await Promise.allSettled([service.retry('aletsch',id),service.retry('aletsch',id)])
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1)
  assert.equal(attempts.find(a=>a.status==='rejected').reason.status,409)
  const deadline=Date.now()+5000
  while((await service.list('aletsch')).jobs[0].status!=='failed'&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20))
  assert.equal((await service.list('aletsch')).jobs[0].status,'failed')
 }finally{service?.close();await rm(root,{recursive:true,force:true})}
})
