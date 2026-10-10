import test from 'node:test'
import assert from 'node:assert/strict'
import {createTileStore,prepareCaptures} from '../frontend/src/data/tile-cache.mjs'
import {animateProgress} from '../frontend/src/data/playback-clock.mjs'
import {readSavedViews,savedFrameIndex} from '../frontend/src/data/saved-views.mjs'
import {viewportTemplates} from '../frontend/src/data/viewport-tiles.mjs'
import {createServer} from 'node:http'
const png=new Uint8Array([137,80,78,71,13,10,26,10])

test('tile cache coalesces work, survives a consumer abort and gives transferable copies',async()=>{
 let reads=0,finish
 const store=createTileStore({persistent:null,fetchTile:async()=>{reads++;await new Promise(resolve=>finish=resolve);return new Response(png)}}),controller=new AbortController()
 const first=store.read('https://local/one.png',controller.signal),second=store.read('https://local/one.png')
 controller.abort();await assert.rejects(first);finish();const bytes=await second
 structuredClone(bytes,{transfer:[bytes]});assert.equal(bytes.byteLength,0)
 const again=await store.read('https://local/one.png');assert.equal(again.byteLength,8);assert.equal(reads,1);assert.equal(store.stats().pending,0)
})

test('image failures never poison caches; memory usage is bounded',async()=>{
 let calls=0
 const store=createTileStore({persistent:null,maxBytes:8,fetchTile:async()=>new Response(++calls===1?'HTML error':png)})
 await assert.rejects(store.read('https://local/one.png'),/image/)
 await store.read('https://local/one.png');await store.read('https://local/two.png')
 assert.equal(store.stats().bytes,8);assert.equal(store.stats().tiles,1)
 await store.read('https://local/one.png');assert.equal(calls,4)
})

test('persistent images are reused after a new store is created',async()=>{
 const entries=new Map(),persistent={open:async()=>({match:async key=>entries.get(key)?.clone(),keys:async()=>[...entries.keys()],delete:async key=>entries.delete(key),put:async(key,response)=>entries.set(key,response)})}
 const store=createTileStore({persistent,fetchTile:async()=>new Response(png)})
 await store.read('https://local/one.png')
 const restarted=createTileStore({persistent,fetchTile:async()=>{throw new Error('Network unavailable')}})
 assert.equal((await restarted.read('https://local/one.png')).byteLength,8)
})

test('abandoned camera downloads and queued tiles release capacity for the next view',async()=>{
 const controllers=Array.from({length:3},()=>new AbortController()),started=[]
 const store=createTileStore({persistent:null,maxConcurrent:1,fetchTile:async(url,{signal})=>{
  started.push(url)
  if(url.endsWith('/new'))return new Response(png)
  return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))
 }})
 const old=store.read('https://local/old',controllers[0].signal),queued=store.read('https://local/queued',controllers[1].signal)
 const rejected=Promise.allSettled([old,queued])
 await new Promise(resolve=>setImmediate(resolve))
 controllers[1].abort();controllers[0].abort()
 assert.ok((await rejected).every(result=>result.status==='rejected'))
 assert.equal((await store.read('https://local/new')).byteLength,8)
 assert.deepEqual(started,['https://local/old','https://local/new'])
 assert.equal(store.stats().pending,0)
})

test('background warming leaves capacity for visible imagery and foreground requests overtake queued warming',async()=>{
 const started=[],release=new Map()
 const store=createTileStore({persistent:null,maxConcurrent:3,fetchTile:async url=>{started.push(url);await new Promise(resolve=>release.set(url,resolve));return new Response(png)}})
 const low=['warm1','warm2','warm3'].map(id=>store.read(id,undefined,{priority:'low'}))
 await new Promise(resolve=>setImmediate(resolve))
 assert.deepEqual(started,['warm1','warm2'])
 const visible=store.read('visible'),next=store.read('next-visible')
 await new Promise(resolve=>setImmediate(resolve))
 assert.deepEqual(started,['warm1','warm2','visible'])
 release.get('visible')();await visible
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(started.at(-1),'next-visible')
 release.get('next-visible')();await next
 release.get('warm1')();await low[0]
 await new Promise(resolve=>setImmediate(resolve))
 assert.equal(started.at(-1),'warm3')
 release.get('warm2')();release.get('warm3')();await Promise.all(low)
 assert.equal(store.stats().pending,0)
})

test('cancelling during retry backoff releases the download slot immediately',async()=>{
 const controller=new AbortController(),calls=[]
 const store=createTileStore({persistent:null,maxConcurrent:1,retryDelayMs:10000,fetchTile:async url=>{calls.push(url);return new Response(url==='old'?'Restarting':png,{status:url==='old'?503:200})}})
 const old=store.read('old',controller.signal),rejected=assert.rejects(old)
 await new Promise(resolve=>setImmediate(resolve));controller.abort();await rejected
 assert.equal((await store.read('new')).byteLength,8)
 assert.deepEqual(calls,['old','new'])
})

test('observation preparation survives a real connection reset and proxy 500 without caching failures',async()=>{
 let calls=0
 const server=createServer((request,response)=>{calls++;if(calls===1){request.socket.destroy();return}if(calls===2){response.writeHead(500);response.end('Proxy failed');return}response.writeHead(200,{'Content-Type':'image/png'});response.end(png)})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 try{
  const store=createTileStore({persistent:null,retryDelayMs:0}),url=`http://127.0.0.1:${server.address().port}/2018/tile.png`
  const result=await prepareCaptures({frames:[{id:'2018'}],tiles:[url],read:(url,signal)=>store.read(url,signal)})
  assert.equal(result.completed,1);assert.equal(calls,3);assert.equal((await store.read(url)).byteLength,8);assert.equal(calls,3)
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
})

test('retries include response-body resets and bypass the browser HTTP cache',async()=>{
 const policies=[];let calls=0
 const store=createTileStore({persistent:null,retryDelayMs:0,fetchTile:async(_url,options)=>{policies.push(options.cache);if(++calls===1)return new Response(new ReadableStream({start(controller){controller.error(new TypeError('Connection reset while reading body'))}}));return new Response(png)}})
 assert.equal((await store.read('https://local/body.png')).byteLength,8);assert.deepEqual(policies,['force-cache','reload'])
})

test('transient retries and parallel downloads are bounded; permanent errors release their slot',async()=>{
 let active=0,maximum=0;const calls=new Map()
 const store=createTileStore({persistent:null,maxConcurrent:2,maxAttempts:3,retryDelayMs:0,fetchTile:async url=>{calls.set(url,(calls.get(url)??0)+1);maximum=Math.max(maximum,++active);await new Promise(resolve=>setTimeout(resolve,1));active--;return new Response(url.endsWith('missing')?'Missing':url.endsWith('down')?'Down':png,{status:url.endsWith('missing')?404:url.endsWith('down')?503:200})}})
 const results=await Promise.allSettled(['missing','down','good1','good2','good3'].map(id=>store.read('https://local/'+id)))
 assert.equal(maximum,2);assert.equal(calls.get('https://local/missing'),1);assert.equal(calls.get('https://local/down'),3)
 assert.equal(results.filter(r=>r.status==='fulfilled').length,3);assert.equal(store.stats().tiles,3);assert.equal(store.stats().pending,0)
})

test('timeline preparation caches every unique visible version with bounded concurrency',async()=>{
 let active=0,maximum=0;const calls=[],progress=[]
 const result=await prepareCaptures({frames:[{id:'2018'},{id:'2026'}],tiles:['https://local/%7Bframe%7D/14/1/1.png','https://local/{frame}/14/1/2.png','https://local/{frame}/14/1/1.png'],concurrency:2,onProgress:p=>progress.push(p),read:async url=>{maximum=Math.max(maximum,++active);calls.push(url);await new Promise(resolve=>setTimeout(resolve,2));active--;return png.buffer}})
 assert.equal(maximum,2);assert.equal(calls.length,4);assert.equal(result.completed,4);assert.deepEqual(progress.at(-1),{completed:4,total:4});assert.ok(calls.every(url=>!url.includes('{frame}')))
 const abort=new AbortController();abort.abort();await assert.rejects(prepareCaptures({frames:[{id:'a'}],tiles:['/{frame}/tile'],signal:abort.signal,read:()=>assert.fail('No work after cancellation')}))
})

test('radar playback uses elapsed time, pauses hidden time and resumes without a jump',()=>{
 let tick,time=0,hidden=false,visibility,complete=0,unsubscribed=0;const values=[]
 const cancel=animateProgress({start:.2,duration:1000,onFrame:p=>values.push(p),onComplete:()=>complete++,request:callback=>{tick=callback;return 1},cancel:()=>{},now:()=>time,hidden:()=>hidden,subscribeVisibility:callback=>{visibility=callback;return()=>unsubscribed++}})
 time=100;tick(time);assert.ok(Math.abs(values.at(-1)-.3)<1e-10)
 hidden=true;visibility();time=10100;hidden=false;visibility();time=10200;tick(time);assert.ok(Math.abs(values.at(-1)-.4)<1e-10)
 time=10800;tick(time);assert.equal(values.at(-1),1);assert.equal(complete,1);assert.equal(unsubscribed,1);cancel()
})

test('saved views restore real frame identities, comparisons and validated display settings',()=>{
 const raw=JSON.stringify([{name:'Useful comparison',scenario:'aletsch',step:7,terrain:true,satellite:true,camera:null,imagerySource:'sentinel2',frameId:'real-2026',baselineId:'real-2018',compare:true,compareMode:'swipe',split:67,lens:{x:25,y:35},adjustments:{brightness:.8,contrast:.2,saturation:-.3},studyOverlay:{layer:'layer3',threshold:.4,progress:.5,scale:90}}])
 const [view]=readSavedViews(raw,[{id:'aletsch',kind:'glacier'}]);assert.equal(view.compare,true);assert.equal(view.split,67);assert.equal(view.adjustments.brightness,.8);assert.equal(view.studyOverlay.progress,.5)
 assert.equal(savedFrameIndex([{id:'real-2026'},{id:'other'}],view.frameId,view.step),0)
 assert.equal(savedFrameIndex([{id:'other'}],'missing',90),0)
 assert.deepEqual(readSavedViews('{broken',[]),[])
 const bad=JSON.parse(raw);bad[0].camera={center:[900,0]};assert.deepEqual(readSavedViews(JSON.stringify(bad),[{id:'aletsch'}]),[])
})

test('viewport preparation includes only covering canonical tiles inside the study area',()=>{
 const templates=viewportTemplates([{canonical:{z:1,x:1,y:0}},{canonical:{z:1,x:0,y:1}},{canonical:{z:1,x:1,y:0}}],{id:'2025',tileTemplate:'/api/imagery/aerial/2025/{z}/{x}/{y}.jpeg'},{id:'aletsch',extent:[8,46,9,47]},'https://local')
 assert.deepEqual(templates,['https://local/api/imagery/aerial/{frame}/1/1/0.jpeg'])
})
