import test from 'node:test'
import assert from 'node:assert/strict'
import {CHAPTERS,GUIDE_DURATION,chapterPreset,guideState,createSignalModel,representativeCell,validatePresentation,cellKey,mercator} from '../frontend/src/data/nisar-presentation.mjs'
import {geographicTransform,radarPosition,pickCell} from '../frontend/src/data/nisar-renderer.mjs'
import {readNisarArtifact} from '../frontend/src/data/nisar-assets.mjs'
import {createApi} from '../backend/src/app.mjs'
import {createSuppliedStudy} from '../backend/src/study.mjs'

const fixtureCells=[[0,0,8,46,-20,4,1,.5,.31,0,2],[0,1,8.001,46,20,8,1,.5,.5,0,2],[1,0,8,45.999,-19,5,1,.5,.34,0,2]]
const fixture={layer:'layer3',columns:['row','column','longitude','latitude','alongTrackOffsetM','slantRangeOffsetM'],shape:[2,2],cells:fixtureCells}
test('guided story follows exact phases, retains measured endpoints and never forecasts',()=>{
 assert.equal(GUIDE_DURATION,80000);assert.equal(CHAPTERS.length,4)
 assert.deepEqual(guideState(-1),chapterPreset(0))
 const signal=guideState((14000+12000)/GUIDE_DURATION);assert.equal(signal.chapter,1);assert.equal(signal.progress,.5);assert.equal(signal.view,'radar')
 const thresholds=new Set();for(let ms=38000;ms<60000;ms+=500){const frame=guideState(ms/GUIDE_DURATION);assert.equal(frame.progress,1);thresholds.add(frame.threshold)}
 assert.deepEqual([...thresholds],[0,.1,.2,.3,.4]);assert.equal(guideState(9).chapter,3);assert.equal(guideState(9).progress,1);assert.equal(guideState(9).threshold,.3)
})
test('signal models preserve original signed cells, screen exactly and choose a representative rather than an extreme',()=>{
 const model=createSignalModel(fixture,.3);assert.equal(model.cells.length,3);assert.ok(model.cells.every(c=>fixtureCells.includes(c)));assert.equal(model.along.median,-19)
 assert.equal(representativeCell(fixtureCells),fixtureCells[2]);assert.equal(cellKey(model.representative),'1:0')
 const screened=createSignalModel(fixture,.4);assert.equal(screened.cells.length,1);assert.equal(screened.scale,model.scale);assert.equal(screened.aScale,model.aScale);assert.equal(screened.sScale,model.sScale);assert.equal(createSignalModel(fixture,.8).representative,null);assert.equal(createSignalModel(fixture,.8).stats,null)
})
test('geographic cells stay fixed, radar positions use component axes, and clicks select the original source cell',()=>{
 const bounds=[890000,5750000,915000,5800000],t=geographicTransform(800,600,bounds)
 assert.deepEqual(t.project([(bounds[0]+bounds[2])/2,(bounds[1]+bounds[3])/2]),[400,300])
 const model=createSignalModel(fixture,.3),cell=fixtureCells[0],start=radarPosition(cell,0,800,600,model),end=radarPosition(cell,1,800,600,model),mid=radarPosition(cell,.5,800,600,model)
 assert.deepEqual(start,[400,300]);assert.ok(end[0]<400&&end[1]<300);assert.deepEqual(mid,[(start[0]+end[0])/2,(start[1]+end[1])/2])
 assert.equal(pickCell([{cell,x:30,y:50}],31,51),cell);assert.equal(pickCell([{cell,x:30,y:50}],300,500),null);assert.ok(mercator(8,46).every(Number.isFinite))
})
test('presentation rejects mismatched source identity, units, time intervals and invalid cells',()=>{
 const study={sourceSha256:'a'.repeat(64),referenceDate:'2026-09-23T04:27:22',secondaryDate:'2026-10-05T04:27:22',pairDays:12,layers:[{id:'layer3',shape:[2,2],eligibleSamples:3}]},context={sourceSha256:study.sourceSha256,radarReferenceDate:study.referenceDate,radarSecondaryDate:study.secondaryDate,crs:'EPSG:3857',bounds:[0,0,1,1]}
 assert.doesNotThrow(()=>validatePresentation(study,context,{layer3:fixture}))
 assert.throws(()=>validatePresentation(study,{...context,sourceSha256:'b'.repeat(64)},{layer3:fixture}),/source pair/)
 assert.throws(()=>validatePresentation({...study,pairDays:365},context,{layer3:fixture}),/interval/)
 assert.throws(()=>validatePresentation(study,context,{layer3:{...fixture,columns:[]}}),/source summary/)
 const cells=structuredClone(fixtureCells);cells[0][6]=-1;assert.throws(()=>validatePresentation(study,context,{layer3:{...fixture,cells}}),/Invalid measured cell/)
})
test('presentation assets survive reopening without network and never cache HTTP or JSON failures',async()=>{
 const entries=new Map(),storage={open:async()=>({match:async key=>entries.get(key)?.clone(),put:async(key,value)=>entries.set(key,value)})};let calls=0
 const fetcher=async()=>new Response(++calls===1?'Service restarting':'{"pairDays":12}',{status:calls===1?500:200})
 const first=await readNisarArtifact('summary.json',{storage,fetcher,retryDelay:0});assert.equal(JSON.parse(new TextDecoder().decode(first)).pairDays,12);assert.equal(calls,2)
 assert.equal((await readNisarArtifact('summary.json',{storage,fetcher:()=>assert.fail('Cache must serve the reopened presentation')})).byteLength,first.byteLength)
 await assert.rejects(readNisarArtifact('presentation.json',{storage,retryDelay:0,fetcher:async()=>new Response('HTML')}));assert.equal(entries.size,1)
 let attempts=0;await assert.rejects(readNisarArtifact('layer1.json',{storage,retryDelay:0,fetcher:async()=>{attempts++;return new Response('Missing',{status:404})}}));assert.equal(attempts,1);assert.equal(entries.size,1)
 await assert.rejects(readNisarArtifact('../../package.json',{fetcher:()=>assert.fail('Path traversal cannot fetch')}))
})
test('new presentation artifacts retain the restricted read-only study API contract',async()=>{
 const app=createApi({study:{artifact:async name=>name==='presentation.json'?new TextEncoder().encode('{"crs":"EPSG:3857"}'):name==='presentation-context.png'?new Uint8Array([137,80,78,71,13,10,26,10]):null}})
 assert.equal((await app.request('/api/science/study/supplied/presentation.json')).status,200)
 const image=await app.request('/api/science/study/supplied/presentation-context.png');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png')
 const service=createSuppliedStudy(process.cwd());assert.equal(await service.artifact('presentation-private.json'),null);assert.equal(await service.artifact('../presentation.json'),null)
})
