import test from 'node:test'
import assert from 'node:assert/strict'
import {createCanvas} from '@napi-rs/canvas'
import {annualState,annualCrop,validateAnnual,drawAnnual} from '../frontend/src/data/annual-presentation.mjs'
import {createSuppliedStudy} from '../backend/src/study.mjs'
import {readNisarArtifact} from '../frontend/src/data/nisar-assets.mjs'

const frame=(year)=>({id:'scene-'+year,date:`${year}-09-27T10:30:19Z`,image:`annual-${year}.png`,imageSha256:'a'.repeat(64),inputSha256:'b'.repeat(64),sourceResolutionMeters:10})
const manifest={version:1,scenario:'aletsch',crs:'EPSG:3857',bounds:[0,0,6000,13000],width:120,height:260,frames:[frame(2018),frame(2019)]}
test('annual playback holds real acquisitions, dissolves smoothly and stops at the final actual capture',()=>{
 assert.deepEqual(annualState(0,9),{lower:0,upper:1,mix:0,observed:true,index:0})
 for(let i=0;i<9;i++){const state=annualState(i/8,9);assert.equal(state.index,i);assert.equal(state.observed,true)}
 const midway=annualState(.65/8,9);assert.ok(Math.abs(midway.mix-.5)<1e-12);assert.equal(midway.observed,false)
 let previous=0;for(let n=0;n<=1000;n++){const state=annualState(n/8000,9),position=state.lower+state.mix;assert.ok(position>=previous);previous=position}
 assert.equal(annualState(1,9).index,8);assert.equal(annualState(2,9).index,8);assert.equal(annualState(-1,9).index,0)
 // No abrupt visual velocity at either end of a dissolve.
 assert.ok(annualState(.3001/8,9).mix<1e-6);assert.ok(1-annualState(.9999/8,9).mix<1e-6)
})
test('source validation rejects undated, reordered, duplicate, synthetic-resolution or mismatched imagery',()=>{
 assert.equal(validateAnnual(manifest),manifest)
 for(const frames of [[frame(2019),frame(2018)],[frame(2018),frame(2018)],[frame(2018),{...frame(2019),date:'undated'}],[frame(2018),{...frame(2019),image:'annual-2020.png'}],[frame(2018),{...frame(2019),sourceResolutionMeters:1}]])assert.throws(()=>validateAnnual({...manifest,frames}),/observations/)
 assert.throws(()=>validateAnnual({...manifest,bounds:[4,4,0,0]}),/grid/)
})
test('comparison uses the same crop on both sides, keeps reference pixels fixed and blends only observed images',()=>{
 const images=['#c00000','#0040c0'].map(color=>{const c=createCanvas(120,260);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,120,260);return c}),canvas=createCanvas(600,400),ctx=canvas.getContext('2d'),sample=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data)
 const options={width:600,height:400,manifest,images,baseline:0,view:'tongue',comparison:'paired'}
 drawAnnual(ctx,{...options,state:annualState(0,2)});const reference=sample(200,200),before=sample(400,200);assert.deepEqual(before,reference)
 drawAnnual(ctx,{...options,state:annualState(.65,2)});assert.deepEqual(sample(200,200),reference);const midpoint=sample(400,200);assert.ok(Math.abs(midpoint[0]-96)<=1);assert.ok(Math.abs(midpoint[2]-96)<=1)
 drawAnnual(ctx,{...options,state:annualState(1,2)});assert.deepEqual(sample(200,200),reference);assert.deepEqual(sample(400,200),[0,64,192,255])
 const crop=annualCrop(300,400,manifest,'tongue',1),closer=annualCrop(300,400,manifest,'tongue',2);assert.equal(closer.width,crop.width/2);assert.equal(closer.x+closer.width/2,crop.x+crop.width/2)
 drawAnnual(ctx,{...options,comparison:'swipe',divider:.6,state:annualState(1,2)});assert.deepEqual(sample(200,200),reference);assert.deepEqual(sample(400,200),[0,64,192,255])
})
test('annual assets use restricted routes and persistent cache without admitting arbitrary years or files',async()=>{
 const service=createSuppliedStudy(process.cwd());assert.equal(await service.artifact('annual-2027.png'),null);assert.equal(await service.artifact('../annual.json'),null)
 const entries=new Map(),storage={open:async()=>({match:async key=>entries.get(key)?.clone(),put:async(key,response)=>entries.set(key,response)})};let calls=0
 await readNisarArtifact('annual.json',{storage,fetcher:async()=>{calls++;return new Response(JSON.stringify(manifest))}})
 await readNisarArtifact('annual.json',{storage,fetcher:()=>assert.fail('The reopening must read local cache')});assert.equal(calls,1)
 await assert.rejects(readNisarArtifact('annual-2027.png',{fetcher:()=>assert.fail('Unknown years cannot fetch')}))
})
