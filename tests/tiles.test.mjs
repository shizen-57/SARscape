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
