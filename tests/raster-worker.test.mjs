import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {createRasterWorker} from '../backend/src/raster.mjs'

const fakeChild=()=>Object.assign(new EventEmitter(),{pid:12345,exitCode:null,kill(){this.exitCode=0;this.emit('exit',0)}})

test('a previously healthy external renderer is checked again and replaced after it exits',async()=>{
 let online=true,starts=0,checks=0,child
 const worker=createRasterWorker({root:'.',python:'fixture',startDelayMs:0,fetchHealth:async()=>{checks++;return new Response(null,{status:online?200:503})},spawnWorker:()=>{starts++;online=true;return child=fakeChild()},stopTree:()=>child.kill()})
 try{await worker.ensure();assert.equal(starts,0);online=false;await Promise.all([worker.ensure(),worker.ensure(),worker.ensure()]);assert.equal(starts,1);assert.ok(checks>=3)}finally{worker.close()}
})

test('a crashed owned renderer restarts once for simultaneous requests',async()=>{
 let online=false,starts=0,child
 const worker=createRasterWorker({root:'.',python:'fixture',startDelayMs:0,fetchHealth:async()=>new Response(null,{status:online?200:503}),spawnWorker:()=>{starts++;online=true;return child=fakeChild()},stopTree:()=>child.kill()})
 try{await worker.ensure();online=false;child.exitCode=9;child.emit('exit',9);await Promise.all([worker.ensure(),worker.ensure()]);assert.equal(starts,2)}finally{worker.close()}
})

test('failed startup can recover and shutdown cannot spawn another renderer',async()=>{
 let recover=false,child,starts=0
 const worker=createRasterWorker({root:'.',python:'fixture',startDelayMs:0,fetchHealth:async()=>new Response(null,{status:recover&&starts>1?200:503}),spawnWorker:()=>{starts++;child=fakeChild();if(!recover)queueMicrotask(()=>child.emit('error',new Error('Failed startup')));return child},stopTree:()=>child.kill()})
 await assert.rejects(worker.ensure(),/Failed startup/);recover=true;await worker.ensure();assert.equal(starts,2);worker.close();await assert.rejects(worker.ensure(),/shutting down/);assert.equal(starts,2)
})
