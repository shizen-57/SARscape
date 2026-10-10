import test from 'node:test'
import assert from 'node:assert/strict'
import {acceptedCells,summaryStats,interpolateOffset,histogram} from '../frontend/src/data/radar-study.mjs'
import {createApi} from '../backend/src/app.mjs'
import {createSuppliedStudy} from '../backend/src/study.mjs'

test('pair interpolation preserves signed measured endpoints and never extrapolates',()=>{
 for(const offset of [-20,0,14]){
  assert.equal(interpolateOffset(offset,0),offset*0)
  assert.equal(interpolateOffset(offset,1),offset)
  assert.equal(interpolateOffset(offset,.5),offset/2)
  assert.equal(interpolateOffset(offset,2),offset)
  assert.equal(interpolateOffset(offset,-1),offset*0)
 }
})
test('threshold screening preserves exact cells, empty results and distribution counts',()=>{
 const cells=[[0,0,8,46,-2,1,.1,.2,.2],[0,1,8,46,3,-1,.1,.2,.5]]
 assert.deepEqual(acceptedCells(cells,.3),[cells[1]])
 assert.deepEqual(acceptedCells(cells,.8),[])
 assert.equal(summaryStats([]),null)
 assert.equal(summaryStats([null,1,2,3,4]).median,2.5)
 assert.equal(histogram([-4,0,0,3,100]).bins.reduce((a,b)=>a+b,0),5)
})
test('study routes serve supplied artifacts only and report local-only availability',async()=>{
 const app=createApi({study:{artifact:async name=>name==='summary.json'?new TextEncoder().encode('{"pairDays":12}'):null}})
 const response=await app.request('/api/science/study/supplied/summary.json')
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{pairDays:12})
 assert.equal((await app.request('/api/science/study/supplied/missing.json')).status,404)
 assert.equal((await createApi().request('/api/science/study/supplied/summary.json')).status,503)
 const service=createSuppliedStudy(process.cwd())
 assert.equal(await service.artifact('../../package.json'),null)
 assert.equal(await service.artifact('secrets.json'),null)
})
