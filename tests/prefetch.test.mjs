import test from 'node:test'
import assert from 'node:assert/strict'
import {prefetchCaptures,createCaptureWarmer} from '../frontend/src/components/imagery-prefetch.mjs'

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

test('unchanged idle plans do not restart; new views, dates and explicit cancellation do',()=>{
 let starts=0,stops=0
 const warmer=createCaptureWarmer(()=>{starts++;return()=>stops++})
 const plan={frames:[{id:'a'},{id:'b'},{id:'c'}],step:0,tiles:['/glacier/{frame}/2.png','/glacier/{frame}/1.png']}
 warmer.warm(plan)
 warmer.warm({...plan,frames:plan.frames.map(frame=>({...frame})),tiles:[...plan.tiles].reverse()})
 assert.equal(starts,1);assert.equal(stops,0)
 warmer.warm({...plan,step:1});assert.equal(starts,2);assert.equal(stops,1)
 warmer.warm({...plan,tiles:['/other-glacier/{frame}/1.png']});assert.equal(starts,3);assert.equal(stops,2)
 warmer.warm({...plan,frames:[{id:'a'},{id:'revised'},{id:'c'}]});assert.equal(starts,4);assert.equal(stops,3)
 warmer.cancel();warmer.cancel();assert.equal(stops,4)
 warmer.warm(plan);assert.equal(starts,5)
 warmer.warm({...plan,tiles:[]});assert.equal(stops,5)
})

test('warming drains image streams without whole-image copies and waits for the body',{timeout:10000},async t=>{
 let calls=0,release,notifyFirst,notifySecond
 const first=new Promise(resolve=>notifyFirst=resolve),second=new Promise(resolve=>notifySecond=resolve)
 const cancel=prefetchCaptures({frames:[{id:'a'},{id:'b'},{id:'c'}],step:0,tiles:['/tiles/{frame}/1.png'],delayMs:0,fetchTile:async()=>{
  calls++
  if(calls===2){notifySecond();return new Response(new Uint8Array([2]))}
  const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]));release=()=>controller.close()}}))
  response.arrayBuffer=()=>assert.fail('Preloading must not buffer the entire image')
  notifyFirst();return response
 }})
 t.after(cancel)
 await first;await new Promise(resolve=>setImmediate(resolve))
 assert.equal(calls,1,'The next request must wait for the current response body')
 release();await second;cancel();assert.equal(calls,2)
})

test('cancellation closes a stalled response stream and does not warm another date',{timeout:10000},async t=>{
 let calls=0,cancelled=0,started
 const waiting=new Promise(resolve=>started=resolve)
 const cancel=prefetchCaptures({frames:[{id:'a'},{id:'b'},{id:'c'}],step:0,tiles:['/tiles/{frame}/1.png'],delayMs:0,fetchTile:async()=>{
  calls++;started()
  return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1]))},cancel(){cancelled++}}))
 }})
 t.after(cancel)
 await waiting;await new Promise(resolve=>setImmediate(resolve));cancel()
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(cancelled,1);assert.equal(calls,1)
})

test('warming is bounded to four neighbouring observations and 48 visible tile templates',{timeout:10000},async t=>{
 const urls=[];let completed
 const finished=new Promise(resolve=>completed=resolve)
 const frames=Array.from({length:12},(_,i)=>({id:String(i)})),tiles=Array.from({length:60},(_,i)=>`/tiles/{frame}/${i}.png`)
 const cancel=prefetchCaptures({frames,step:5,tiles,delayMs:0,fetchTile:async url=>{
  urls.push(url);if(urls.length===192)completed()
  return new Response(new Uint8Array([1]))
 }})
 t.after(cancel)
 await finished;await new Promise(resolve=>setImmediate(resolve))
 assert.equal(urls.length,192)
 assert.deepEqual([...new Set(urls.map(url=>url.split('/')[2]))],['6','4','7','3'])
 assert.ok(urls.every(url=>Number(url.split('/')[3].split('.')[0])>=12))
})

test('cancellation before the idle delay starts no requests',t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 let calls=0
 const cancel=prefetchCaptures({frames:[{id:'a'},{id:'b'}],step:0,tiles:['/tiles/{frame}/1.png'],fetchTile:async()=>{calls++;return new Response()}})
 cancel();t.mock.timers.tick(2000);assert.equal(calls,0)
})
