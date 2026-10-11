import test from 'node:test'
import assert from 'node:assert/strict'
import {createTileCache} from '../backend/src/tiles.mjs'
import {createCogReader} from '../backend/src/cog.mjs'
test('concurrent raster requests share one render and persist the PNG',async()=>{
 const entries=new Map(),cache={get:async k=>entries.get(k),set:async(k,v)=>entries.set(k,v)};let renders=0
 const render=createTileCache(cache,async()=>{renders++;await new Promise(r=>setTimeout(r,10));return new Uint8Array([137,80,78,71,13,10,26,10])})
 const results=await Promise.all([render({id:'a'},12,1,2,'aletsch'),render({id:'a'},12,1,2,'aletsch')]);assert.equal(renders,1);assert.deepEqual(results[0],results[1]);await render({id:'a'},12,1,2,'aletsch');assert.equal(renders,1)
})
test('incomplete ranges are retried and HTML errors cannot enter image cache',async()=>{
 let calls=0;const read=createCogReader(async()=>{calls++;return new Response(new Uint8Array(calls===1?2:4),{status:206,headers:{'Content-Length':'4','Content-Range':'bytes 0-3/100'}})})
 assert.equal((await (await read({id:'a',url:'https://registered.example/a.tif'},'GET','bytes=0-3')).arrayBuffer()).byteLength,4);assert.equal(calls,2)
 let stored=false;const render=createTileCache({get:async()=>null,set:async()=>stored=true},async()=>new TextEncoder().encode('<html>Error</html>'));await assert.rejects(render({id:'a'},1,0,0,'a'),/PNG/);assert.equal(stored,false)
})

test('concurrent persistent tile hits share one lookup and preserve exact PNG bytes',async()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,255]);let reads=0
 const render=createTileCache({get:async()=>{reads++;await Promise.resolve();return Buffer.from(png).toString('base64')},set:async()=>assert.fail('Cache hit must not be rewritten')},async()=>assert.fail('Cache hit must not be rendered'))
 const results=await Promise.all(Array.from({length:8},()=>render({id:'dated'},12,1,2,'aletsch')))
 assert.equal(reads,1)
 for(const bytes of results)assert.deepEqual(new Uint8Array(bytes),png)
})

test('failed tile jobs are released for retry and different observation dates stay separate',async()=>{
 const entries=new Map();let calls=0
 const render=createTileCache({get:async key=>entries.get(key),set:async(key,value)=>entries.set(key,value)},async frame=>{
  if(++calls===1)throw new Error('Temporary imagery failure')
  return new Uint8Array([137,80,78,71,13,10,26,10,frame.id==='before'?1:2])
 })
 await assert.rejects(render({id:'before'},12,1,2,'aletsch'),/Temporary/)
 const before=await render({id:'before'},12,1,2,'aletsch'),after=await render({id:'after'},12,1,2,'aletsch')
 assert.equal(calls,3);assert.notDeepEqual(before,after);assert.equal(entries.size,2)
})

test('overlapping COG requests share in-flight chunks and return exact byte ranges',async()=>{
 const source=Uint8Array.from({length:196608},(_,i)=>i%251),ranges=[]
 const read=createCogReader(async(_url,options)=>{
  const range=options.headers.Range;ranges.push(range)
  const [,start,end]=/^bytes=(\d+)-(\d+)$/.exec(range).map(Number)
  await Promise.resolve()
  return new Response(source.slice(start,end+1),{status:206,headers:{'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${source.length}`}})
 })
 const frame={id:'observation',url:'https://registered.example/observation.tif'}
 const [a,b]=await Promise.all([read(frame,'GET','bytes=0-131071'),read(frame,'GET','bytes=65536-196607')])
 assert.equal(ranges.length,3,'Two overlapping ranges fetch only three distinct chunks')
 assert.equal(a.headers.get('Content-Range'),'bytes 0-131071/196608')
 assert.deepEqual(new Uint8Array(await a.arrayBuffer()),source.slice(0,131072))
 assert.deepEqual(new Uint8Array(await b.arrayBuffer()),source.slice(65536,196608))
 await read(frame,'GET','bytes=0-131071');assert.equal(ranges.length,3)
})
