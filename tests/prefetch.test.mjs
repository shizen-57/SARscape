import test from 'node:test'
import assert from 'node:assert/strict'
import {prefetchCaptures} from '../frontend/src/components/imagery-prefetch.mjs'

test('warming caches identical tile URLs serially, nearest captures first',{timeout:10000},async t=>{
 const urls=[],options=[];let active=0,maxActive=0
 let complete;const finished=new Promise(resolve=>complete=resolve)
 const cancel=prefetchCaptures({frames:[{id:'a'},{id:'b'},{id:'c'},{id:'d'}],step:1,tiles:['/tiles/{frame}/12/1/2.png?v=7','/tiles/{frame}/12/1/2.png?v=7'],delayMs:0,fetchTile:async(url,opts)=>{
  urls.push(url);options.push(opts);maxActive=Math.max(maxActive,++active)
  await new Promise(resolve=>setTimeout(resolve,5));active--
  if(urls.length===3)complete()
  return new Response(new Uint8Array([1]))
 }})
 t.after(cancel)
 await finished;cancel()
 assert.deepEqual(urls,['/tiles/c/12/1/2.png?v=7','/tiles/a/12/1/2.png?v=7','/tiles/d/12/1/2.png?v=7'])
 assert.equal(maxActive,1);assert.ok(options.every(o=>o.cache==='force-cache'&&o.priority==='low'))
})

test('navigation cancels in-flight warming and prevents further capture requests',async()=>{
 let calls=0,signal,started
 const waiting=new Promise(resolve=>started=resolve)
 const cancel=prefetchCaptures({frames:[{id:'a'},{id:'b'},{id:'c'}],step:0,tiles:['/tiles/{frame}/12/1/2.png'],delayMs:0,fetchTile:async(_url,opts)=>{
  calls++;signal=opts.signal;started()
  return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('Aborted'))))
 }})
 await waiting;cancel();await new Promise(resolve=>setTimeout(resolve,10))
 assert.equal(signal.aborted,true);assert.equal(calls,1)
})
