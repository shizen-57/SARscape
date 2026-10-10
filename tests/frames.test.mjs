import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {requestFrames} from '../frontend/src/components/frame-controller.mjs'
class Map extends EventEmitter{
 sources=new globalThis.Map();layers=[];loaded=new Set()
 getSource(id){return this.sources.get(id)}
 addSource(id,source){this.sources.set(id,{...source})}
 addLayer(layer){this.layers.push(layer)}
 getLayer(id){return this.layers.find(l=>l.id===id)}
 getStyle(){return {layers:this.layers}}
 removeLayer(id){this.layers=this.layers.filter(l=>l.id!==id)}
 removeSource(id){this.sources.delete(id);this.loaded.delete(id)}
 setPaintProperty(id,property,value){this.getLayer(id).paint[property]=value}
 isSourceLoaded(id){return this.loaded.has(id)}
 triggerRepaint(){this.emit('render')}
 finish(id){this.loaded.add(id);this.emit('sourcedata',{sourceId:id})}
}
const entry=(map,frame,scenarioId='aletsch')=>({map,id:`observation-${scenarioId}-${frame}`,scenarioId,source:{type:'raster',tiles:[`/api/imagery/tiles/${scenarioId}/${frame}/{z}/{x}/{y}.png`]}})
test('rapid seeks cannot commit a cancelled observation or get stuck waiting on unrelated tiles',()=>{
 const map=new Map(),commits=[],states=[]
 const first=entry(map,'2018'),next=entry(map,'2025')
 const cancel=requestFrames([first],{onState:s=>states.push(s),onCommit:()=>commits.push('2018')})
 cancel();const stop=requestFrames([next],{onState:s=>states.push(s),onCommit:()=>commits.push('2025')})
 map.finish(first.id);assert.deepEqual(commits,[])
 map.finish(next.id);assert.deepEqual(commits,['2025']);assert.equal(states.at(-1),'ready');assert.equal(map.getLayer(next.id).paint['raster-opacity'],1);assert.equal(map.getLayer(first.id),undefined);stop()
})
test('comparison pair waits for both maps before changing visible pixels or dates',()=>{
 const left=new Map(),right=new Map(),a=entry(left,'2018'),b=entry(right,'2025');let commits=0
 const stop=requestFrames([a,b],{onState:()=>{},onCommit:()=>commits++})
 left.finish(a.id);assert.equal(commits,0);assert.equal(left.getLayer(a.id).paint['raster-opacity'],0.001)
 right.finish(b.id);assert.equal(commits,1);assert.equal(left.getLayer(a.id).paint['raster-opacity'],1);assert.equal(right.getLayer(b.id).paint['raster-opacity'],1);stop()
})
test('failed frame keeps previous image, retries its failed source, and removes other glaciers',()=>{
 const map=new Map(),previous=entry(map,'2018'),next=entry(map,'2025'),states=[]
 requestFrames([previous],{onState:()=>{},onCommit:()=>{}});map.finish(previous.id)
 requestFrames([next],{onState:s=>states.push(s),onCommit:()=>{}});map.emit('error',{sourceId:next.id,error:new Error('502')})
 assert.equal(states.at(-1),'error');assert.equal(map.getLayer(previous.id).paint['raster-opacity'],1)
 let committed=false;requestFrames([next],{onState:()=>{},onCommit:()=>committed=true});map.finish(next.id);assert.equal(committed,true)
 const other=entry(map,'2024','langtang'),stop=requestFrames([other],{onState:()=>{},onCommit:()=>{}})
 assert.equal(map.getSource(previous.id),undefined);assert.equal(map.getSource(next.id),undefined);stop()
})

test('cancelling during a crossfade restores the last committed capture',async()=>{
 const map=new Map(),previous=entry(map,'2018'),next=entry(map,'2026');let commits=0
 requestFrames([previous],{onState:()=>{},onCommit:()=>{}});map.finish(previous.id)
 const stop=requestFrames([next],{fadeMs:20,onState:()=>{},onCommit:()=>commits++});map.finish(next.id);stop()
 await new Promise(resolve=>setTimeout(resolve,35))
 assert.equal(commits,0);assert.equal(map.getLayer(next.id),undefined);assert.equal(map.getLayer(previous.id).paint['raster-opacity'],1)
})

test('the unchanged comparison capture stays fully visible while its partner crossfades',async()=>{
 const left=new Map(),right=new Map(),a=entry(left,'2018'),b=entry(right,'2026'),draws=[]
 requestFrames([a],{onState:()=>{},onCommit:()=>{}});left.finish(a.id)
 left.on('render',()=>draws.push(left.getLayer(a.id)?.paint['raster-opacity']))
 const stop=requestFrames([a,b],{fadeMs:5,onState:()=>{},onCommit:()=>{}});right.finish(b.id)
 await new Promise(resolve=>setTimeout(resolve,15))
 assert.ok(draws.length);assert.ok(draws.every(opacity=>opacity===1));stop()
})
