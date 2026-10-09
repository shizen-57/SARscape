import test from 'node:test'
import assert from 'node:assert/strict'
import {createApi} from '../backend/src/app.mjs'

test('catalog normalization handles real ASF field shapes and caches upstream',async()=>{let requests=0;const app=createApi({fetchUpstream:async url=>{requests++;assert.match(url,/dataset=NISAR/);assert.match(url,/processingLevel=GOFF/);return Response.json({features:[{properties:{fileID:'real-test-granule',startTime:'2026-09-23T04:27:22Z',stopTime:'2026-10-05T04:28:01Z',url:'https://example.org/PROVISIONAL/granule.h5',polarization:['HH','HV'],processingLevel:'GOFF'}}]})}});const response=await app.request('/api/catalog/aletsch');const body=await response.json();assert.equal(body.records[0].maturity,'PROVISIONAL');assert.equal(body.records[0].polarization,'HH, HV');assert.equal(body.records[0].id,'real-test-granule');await app.request('/api/catalog/aletsch');assert.equal(requests,1)})
test('upstream failures produce recoverable error responses',async()=>{const app=createApi({fetchUpstream:async()=>{throw new Error('Network down')}});assert.equal((await app.request('/api/catalog/aletsch')).status,502)})
test('imagery endpoint returns real dated optical captures and rejects unknown glaciers',async()=>{const app=createApi();const res=await app.request('/api/imagery/aletsch');assert.equal(res.status,200);const body=await res.json();assert.ok(Array.isArray(body.frames)&&body.frames.length>0);assert.ok(body.frames.every(f=>typeof f.id==='string'&&typeof f.url==='string'&&Array.isArray(f.bbox)));assert.match(body.source,/Sentinel-2/);assert.equal((await app.request('/api/imagery/unknown')).status,404)})
test('imagery tile route validates coordinates and streams bytes from the injected renderer',async()=>{let call=null;const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);const app=createApi({renderTile:async(frame,z,x,y,id)=>{call={frame:frame.id,z,x,y,id};return png}});assert.equal((await app.request('/api/imagery/tiles/aletsch/does-not-exist/12/2139/1448.png')).status,404);assert.equal((await app.request('/api/imagery/tiles/aletsch/S2B_32TMS_20180927_1_L2A/12/99999/1448.png')).status,400);const ok=await app.request('/api/imagery/tiles/aletsch/S2B_32TMS_20180927_1_L2A/12/2139/1448.png');assert.equal(ok.status,200);assert.equal(ok.headers.get('Content-Type'),'image/png');assert.match(ok.headers.get('Cache-Control'),/immutable/);assert.deepEqual([...new Uint8Array(await ok.arrayBuffer()).slice(0,4)],[0x89,0x50,0x4e,0x47]);assert.deepEqual(call,{frame:'S2B_32TMS_20180927_1_L2A',z:12,x:2139,y:1448,id:'aletsch'})})

test('shipping API never exposes synthetic measurements',async()=>{const app=createApi();for(const path of ['/api/layers/aletsch','/api/export/aletsch'])assert.equal((await app.request(path)).status,404)})
test('aerial mosaics retain year precision and cache valid official tiles',async()=>{
 let requests=0
 const app=createApi({fetchUpstream:async url=>{requests++;assert.match(url,/^https:\/\/wmts.geo.admin.ch\/1.0.0\/ch.swisstopo.swissimage-product\/default\/2025\/3857\/12\/2139\/1448.jpeg$/);return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}})}})
 const sequence=await (await app.request('/api/imagery/aletsch?source=swissimage')).json()
 assert.equal(sequence.frames[0].date,'2018');assert.equal(sequence.frames[0].datePrecision,'mosaic-year');assert.equal(sequence.frames[0].cloudCover,null)
 assert.match(sequence.selection,/not annual acquisitions/)
 assert.equal((await app.request('/api/imagery/langtang?source=swissimage')).status,400)
 assert.equal((await app.request('/api/imagery/aerial/1900/12/1/2.jpeg')).status,400)
 const path='/api/imagery/aerial/2025/12/2139/1448.jpeg'
 const first=await app.request(path),second=await app.request(path)
 assert.equal(first.status,200);assert.equal(second.headers.get('X-Cache'),'HIT');assert.equal(requests,1)
 assert.equal(first.headers.get('Cache-Control'),'public,max-age=86400')
})
test('sharp reference coverage never invents capture dates or yearly frames',async()=>{
 const app=createApi()
 for(const glacier of ['langtang','columbia']){
  const sequence=await (await app.request(`/api/imagery/${glacier}?source=reference`)).json()
  assert.equal(sequence.frames.length,1)
  assert.equal(sequence.frames[0].datePrecision,'undated')
  assert.equal(sequence.frames[0].resolutionMeters,null)
  assert.match(sequence.frames[0].tileTemplate,/World_Imagery/)
 }
})
test('COG proxy requires a registered scene and a small range',async()=>{let calls=0;const app=createApi({fetchUpstream:async(url,options)=>{calls++;assert.match(url,/sentinel-cogs/);assert.equal(options.headers.Range,'bytes=0-3');return new Response(new Uint8Array([73,73,42,0]),{status:206,headers:{'Content-Length':'4','Content-Range':'bytes 0-3/100'}})}});const path='/api/imagery/cog/aletsch/S2B_32TMS_20180927_1_L2A/TCI.tif';assert.equal((await app.request(path)).status,416);assert.equal((await app.request(path,{headers:{Range:'bytes=0-999999999'}})).status,416);assert.equal((await app.request('/api/imagery/cog/aletsch/unknown/TCI.tif',{headers:{Range:'bytes=0-3'}})).status,404);const r=await app.request(path,{headers:{Range:'bytes=0-3'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 0-3/100');assert.equal(calls,1)})
