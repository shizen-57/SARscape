import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {basename,dirname,join,resolve} from 'node:path'
import {createApi} from '../backend/src/app.mjs'
import {createScienceService} from '../backend/src/science.mjs'

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')
const observation=(id,scenario,date)=>({id,scenario,product:'GCOV',acquisitionDate:date,
 displayPreview:{file:'gcov-context.png',rangeDb:[-25,0],coordinates:[[8.02,46.51],[8.10,46.51],[8.10,46.39],[8.02,46.39]]}})

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'sarscape-gcov-')),directory=join(root,'database/processed/gcov')
 await mkdir(directory,{recursive:true})
 const observations=[observation('later','aletsch','2026-10-05T04:27:22'),observation('earlier','aletsch','2026-09-23T04:27:22'),observation('other','columbia','2026-09-11T04:27:22'),observation('../escape','aletsch','2026-09-11T04:27:22')]
 await writeFile(join(directory,'manifest.json'),JSON.stringify({observations}))
 for(const item of observations.filter(item=>!item.id.includes('/'))){
  await mkdir(join(directory,item.id))
  await writeFile(join(directory,item.id,'gcov-context.png'),PNG)
  await writeFile(join(directory,item.id,'gcov-provenance.json'),JSON.stringify(item))
  await writeFile(join(directory,item.id,'gcov-backscatter.tif'),'fixture-only raster body')
  await writeFile(join(directory,item.id,'private.txt'),'not a public artifact')
 }
 const science=createScienceService({root,python:'unused-for-read-only-gcov-tests'})
 t.after(async()=>{
  await science.list('aletsch');science.close()
  // Delete only the temporary directory this fixture created beneath the OS temp directory.
  assert.equal(dirname(resolve(root)),resolve(tmpdir()))
  assert.ok(basename(root).startsWith('sarscape-gcov-'))
  await rm(root,{recursive:true,force:true})
 })
 return {root,directory,observations,science,app:createApi({science})}
}

test('GCOV manifests select the study area, sort acquisition dates, and refresh without restart',async t=>{
 const {directory,observations,science}=await fixture(t)
 assert.deepEqual((await science.gcovList('aletsch')).observations.map(item=>item.id),['earlier','later'])
 assert.deepEqual((await science.gcovList('columbia')).observations.map(item=>item.id),['other'])
 assert.deepEqual((await science.gcovList('unknown')).observations,[])
 await writeFile(join(directory,'manifest.json'),JSON.stringify({observations:[...observations,observation('new','aletsch','2026-09-11T04:27:22')]}))
 assert.deepEqual((await science.gcovList('aletsch')).observations.map(item=>item.id),['new','earlier','later'])
})

test('GCOV artifacts require an approved observation, its scenario, and a fixed public filename',async t=>{
 const {science}=await fixture(t)
 assert.deepEqual(await science.gcovArtifact('aletsch','earlier','backscatter.png'),PNG)
 assert.equal(JSON.parse((await science.gcovArtifact('aletsch','earlier','provenance.json')).toString()).id,'earlier')
 assert.ok(await science.gcovArtifact('aletsch','earlier','backscatter.tif'))
 for(const [scenario,id,file] of [['columbia','earlier','backscatter.png'],['aletsch','unknown','backscatter.png'],['aletsch','earlier','private.txt'],['aletsch','earlier','../private.txt'],['aletsch','../escape','backscatter.png'],['aletsch','earlier','__proto__']]){
  assert.equal(await science.gcovArtifact(scenario,id,file),null)
 }
})

test('GCOV routes return correctly typed artifacts and reject unknown or traversing requests',async t=>{
 const {app}=await fixture(t)
 const list=await app.request('/api/science/aletsch/gcov')
 assert.equal(list.status,200)
 assert.deepEqual((await list.json()).observations.map(item=>item.id),['earlier','later'])
 const png=await app.request('/api/science/aletsch/gcov/earlier/backscatter.png')
 assert.equal(png.status,200);assert.equal(png.headers.get('content-type'),'image/png')
 assert.equal(png.headers.get('x-content-type-options'),'nosniff')
 assert.deepEqual(Buffer.from(await png.arrayBuffer()),PNG)
 const provenance=await app.request('/api/science/aletsch/gcov/earlier/provenance.json')
 assert.equal(provenance.status,200);assert.equal(provenance.headers.get('content-type'),'application/json')
 assert.equal((await provenance.json()).id,'earlier')
 const tif=await app.request('/api/science/aletsch/gcov/earlier/backscatter.tif')
 assert.equal(tif.status,200);assert.equal(tif.headers.get('content-type'),'image/tiff')
 for(const path of ['/api/science/unknown/gcov','/api/science/columbia/gcov/earlier/backscatter.png','/api/science/aletsch/gcov/unknown/backscatter.png','/api/science/aletsch/gcov/earlier/private.txt','/api/science/aletsch/gcov/%2e%2e%2fescape/backscatter.png','/api/science/aletsch/gcov/earlier/%2e%2e%2fprivate.txt']){
  assert.equal((await app.request(path)).status,404,path)
 }
})

test('hosted deployments without the local GCOV service return an explicit empty catalog',async()=>{
 for(const app of [createApi(),createApi({science:{list:async()=>({available:true,jobs:[]})}})]){
  const response=await app.request('/api/science/aletsch/gcov')
  assert.equal(response.status,200)
  assert.deepEqual(await response.json(),{available:false,observations:[]})
  assert.equal((await app.request('/api/science/aletsch/gcov/earlier/backscatter.png')).status,404)
 }
})

test('a local installation with no GCOV manifest reports an available empty catalog',async t=>{
 const {directory,science}=await fixture(t)
 await rm(join(directory,'manifest.json'))
 assert.deepEqual(await science.gcovList('aletsch'),{available:true,observations:[]})
})
