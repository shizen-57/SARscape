import test from 'node:test'
import assert from 'node:assert/strict'
import {createAerialReader} from '../backend/src/aerial.mjs'
import {createApi} from '../backend/src/app.mjs'

const jpeg=new Uint8Array([255,216,255,217])

test('a burst of different aerial tiles has bounded simultaneous downloads',async()=>{
 let active=0,peak=0,calls=0
 const read=createAerialReader(async()=>{
  calls++;peak=Math.max(peak,++active)
  await new Promise(resolve=>setTimeout(resolve,5))
  active--
  return new Response(jpeg)
 },{concurrency:2})
 const results=await Promise.all(Array.from({length:12},(_,x)=>read(2018,15,x,1)))
 assert.equal(calls,12);assert.equal(peak,2)
 assert.ok(results.every(bytes=>bytes[0]===255&&bytes[1]===216))
})

test('temporary connection and service failures recover, coalesce and cache only the JPEG',async()=>{
 let calls=0
 const app=createApi({fetchUpstream:async()=>{
  calls++
  if(calls===1)throw new TypeError('fetch failed')
  if(calls===2)return new Response('Temporarily unavailable',{status:503})
  return new Response(jpeg)
 }})
 const path='/api/imagery/aerial/2018/15/17118/11598.jpeg'
 const results=await Promise.all([app.request(path),app.request(path)])
 assert.ok(results.every(r=>r.status===200))
 for(const response of results)assert.deepEqual(new Uint8Array(await response.arrayBuffer()),jpeg)
 assert.equal(calls,3)
 assert.equal((await app.request(path)).headers.get('X-Cache'),'HIT')
 assert.equal(calls,3)
})

test('image body failures retry and exhausted failures release the next download slot',async()=>{
 let calls=0
 const read=createAerialReader(async()=>{
  calls++
  if(calls<=3){const response=new Response(jpeg);response.arrayBuffer=async()=>{throw new TypeError('Connection interrupted')};return response}
  return new Response(jpeg)
 },{concurrency:1,retryDelayMs:0})
 const results=await Promise.allSettled([read(2018,15,1,1),read(2018,15,2,1)])
 assert.equal(results[0].status,'rejected')
 assert.match(results[0].reason.message,/Swiss aerial tile 2018\/3857\/15\/1\/1.jpeg/)
 assert.equal(results[1].status,'fulfilled')
 assert.deepEqual(results[1].value,jpeg);assert.equal(calls,4)
})

test('permanent HTTP errors and non-image responses are not retried or cached',async()=>{
 for(const response of [()=>new Response('Missing',{status:404}),()=>new Response('<html>Unavailable</html>')]){
  let calls=0
  const app=createApi({fetchUpstream:async()=>{calls++;return response()}})
  const path='/api/imagery/aerial/2018/15/17118/11598.jpeg'
  assert.equal((await app.request(path)).status,502)
  assert.equal((await app.request(path)).status,502)
  assert.equal(calls,2)
 }
})

test('connection and image-body timeouts retry before returning a complete image',async()=>{
 let calls=0
 const timedOut=[]
 const stall=signal=>new Promise((resolve,reject)=>{
  // Keep the mock connection alive while AbortSignal's unref'ed timer fires.
  setTimeout(()=>resolve(new Response(jpeg)),100)
  signal.addEventListener('abort',()=>{timedOut.push(signal.reason.name);reject(signal.reason)},{once:true})
 })
 const read=createAerialReader(async(_url,{signal})=>{
  calls++
  if(calls===1)return stall(signal)
  const response=new Response(jpeg)
  if(calls===2)response.arrayBuffer=()=>stall(signal)
  return response
 },{timeoutMs:10,retryDelayMs:0})
 assert.deepEqual(await read(2018,15,1,1),jpeg)
 assert.equal(calls,3);assert.deepEqual(timedOut,['TimeoutError','TimeoutError'])
})
