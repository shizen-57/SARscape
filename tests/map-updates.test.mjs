import test from 'node:test'
import assert from 'node:assert/strict'
import {setExtent,setVisibility} from '../frontend/src/components/map-updates.mjs'

test('timeline positions with identical coverage upload geometry once; changed coverage updates exactly',()=>{
 const uploads=[],source={setData:data=>uploads.push(data)}
 const bounds=[8.01,46.02,8.15,46.22]
 for(let date=0;date<100;date++)setExtent(source,[...bounds])
 assert.equal(uploads.length,1)
 assert.deepEqual(uploads[0].geometry.coordinates,[[[8.01,46.02],[8.15,46.02],[8.15,46.22],[8.01,46.22],[8.01,46.02]]])
 setExtent(source,[8.02,46.02,8.15,46.22]);assert.equal(uploads.length,2)
 assert.equal(uploads[1].geometry.coordinates[0][0][0],8.02)
})

test('comparison maps and recreated sources each receive their own complete geometry',()=>{
 const uploads=[],bounds=[8,46,9,47]
 const source=()=>({setData:data=>uploads.push(data)})
 const primary=source(),comparison=source(),recreated=source()
 setExtent(primary,bounds);setExtent(comparison,bounds);setExtent(recreated,bounds)
 assert.equal(uploads.length,3);assert.deepEqual(uploads[0],uploads[2])
 bounds[0]=8.1
 assert.equal(setExtent(primary,bounds),true,'Mutable caller arrays must not change retained bounds')
 assert.equal(uploads.length,4)
})

test('globe visibility changes reuse layers and leave their existing sources untouched',()=>{
 const source={image:'full-resolution dated image',acquisition:'2020-08-01'},layer={source},changes=[]
 let visibility='visible'
 const map={
  getLayer:id=>id==='overlay'?layer:undefined,
  getLayoutProperty:()=>visibility,
  setLayoutProperty:(id,key,value)=>{changes.push([id,key,value]);visibility=value}
 }
 for(let i=0;i<100;i++)setVisibility(map,'overlay',false)
 setVisibility(map,'missing',false)
 for(let i=0;i<100;i++)setVisibility(map,'overlay',true)
 assert.deepEqual(changes,[['overlay','visibility','none'],['overlay','visibility','visible']])
 assert.equal(layer.source,source);assert.equal(source.acquisition,'2020-08-01')
})
