import test from 'node:test'
import assert from 'node:assert/strict'
import {createSatelliteAccess} from '../backend/src/satellite-fetch.mjs'
const asset='https://sentinel2l2a01.blob.core.windows.net/sentinel2-l2/scene/TCI.tif'

test('concurrent image ranges share signing and forward Range to the same asset',async()=>{
 let signs=0,reads=0
 const access=createSatelliteAccess(async(url,options)=>{
  if(url.startsWith('https://planetarycomputer.microsoft.com/')){
   signs++;assert.equal(new URL(url).searchParams.get('href'),asset)
   await new Promise(resolve=>setTimeout(resolve,5))
   return Response.json({href:asset+'?sig=test'})
  }
  reads++;assert.equal(url,asset+'?sig=test');assert.equal(options.headers.Range,'bytes=0-3')
  return new Response(new Uint8Array([73,73,42,0]),{status:206})
 })
 const responses=await Promise.all(Array.from({length:12},()=>access.fetch(asset,{headers:{Range:'bytes=0-3'}})))
 assert.equal(signs,1);assert.equal(reads,12)
 assert.ok(responses.every(r=>r.status===206))
 assert.equal(asset.includes('?sig='),false)
})

test('expired access renews once and other public hosts are fetched directly',async()=>{
 let signs=0,reads=0
 const access=createSatelliteAccess(async url=>{
  if(url.startsWith('https://planetarycomputer.microsoft.com/'))return Response.json({href:asset+'?sig='+ ++signs})
  if(url.startsWith(asset)){reads++;return new Response(null,{status:reads===1?403:206})}
  assert.equal(url,'https://example.org/public.tif');return new Response(null,{status:200})
 })
 assert.equal((await access.fetch(asset)).status,206)
 assert.equal(signs,2);assert.equal(reads,2)
 assert.equal((await access.fetch('https://example.org/public.tif')).status,200)
 assert.equal(signs,2)
})

test('unexpected asset substitutions from the signing response are rejected',async()=>{
 for(const href of ['https://example.org/TCI.tif','http://sentinel2l2a01.blob.core.windows.net/sentinel2-l2/scene/TCI.tif',asset.replace('/scene/','/other/')]){
  const access=createSatelliteAccess(async()=>Response.json({href}))
  await assert.rejects(access.sign(asset),/Unexpected signed satellite asset/)
 }
})

test('container-scoped signatures are shared across registered band assets',async()=>{
 let signs=0;const access=createSatelliteAccess(async url=>{signs++;const href=new URL(url).searchParams.get('href');return Response.json({href:href+'?sr=c&sig=test'})})
 const red=asset.replace('TCI','B04'),nir=asset.replace('TCI','B08')
 const signed=await Promise.all([access.sign(asset),access.sign(red),access.sign(nir)])
 assert.equal(signs,1);assert.equal(new URL(signed[1]).pathname,new URL(red).pathname);assert.equal(new URL(signed[2]).searchParams.get('sig'),'test')
})
