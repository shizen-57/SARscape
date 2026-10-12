import test from 'node:test'
import assert from 'node:assert/strict'
import {displayScale,gridToLonLat,lonLatToGrid,motionColor,motionValue,motionVector,pairFrame,particlePaths,pointOnPath,travelExaggeration} from '../frontend/src/data/motion-preview.mjs'

const reference='2026-09-23T04:27:22.000000000',secondary='2026-10-05T04:27:22.000000000'

test('only the two GOFF acquisitions are labelled as observations; every frame between is interpolated',()=>{
 assert.deepEqual(pairFrame(0,reference,secondary),{date:'2026-09-23T04:27:22.000Z',kind:'reference',observed:true,label:'NISAR acquisition · reference'})
 assert.equal(pairFrame(1,reference,secondary).kind,'secondary')
 assert.equal(pairFrame(1,reference,secondary).date,'2026-10-05T04:27:22.000Z')
 for(const p of [0.001,0.25,0.5,0.999]){const frame=pairFrame(p,reference,secondary);assert.equal(frame.kind,'interpolated');assert.equal(frame.observed,false);assert.match(frame.label,/not observed/)}
 assert.equal(pairFrame(0.5,reference,secondary).date,'2026-09-29T04:27:22.000Z')
 assert.equal(pairFrame(-3,reference,secondary).kind,'reference')
 assert.equal(pairFrame(0.5,secondary,reference),null)
 assert.equal(pairFrame(0.5,'unknown',secondary),null)
})

const preview=(status,cells,geometry={available:true,alongTrackAxis:[-0.335,0.942],groundRangeAxis:[-0.952,-0.306]})=>({status,pairDays:12,geometry,grid:{shape:[6,6],postingMetres:[80,80]},cellFields:['row','col','alongTrack','slantRange','east','north'],cells})

test('without resolved flow, particles move only along the measured radar axis',()=>{
 const p=preview('components',[[0,0,-0.4,0.1,0.2,-0.5]]),cell={row:0,col:0,alongTrack:-0.4,slantRange:0.1,east:0.2,north:-0.5}
 const along=motionVector(cell,p,'alongTrack')
 assert.ok(Math.abs(along[0]/along[1]-(-0.335/0.942))<1e-12)
 assert.deepEqual(motionVector(cell,p,'slantRange'),[-0.952*0.1,-0.306*0.1])
 assert.equal(motionValue(cell,p,'alongTrack'),-0.4)
 assert.equal(motionVector(cell,preview('components',[],{available:false}),'alongTrack'),null)
 const flow=preview('flow',[]);assert.deepEqual(motionVector(cell,flow,'alongTrack'),[0.2,-0.5]);assert.equal(motionValue(cell,flow,'alongTrack'),Math.hypot(0.2,-0.5))
})

test('display scale, exaggeration and colours stay bounded and explainable',()=>{
 assert.equal(displayScale([null,NaN]),null)
 assert.ok(displayScale(Array.from({length:100},(_,i)=>i===99?50:i/100))<1)
 assert.equal(travelExaggeration(0.8,12,480),50)
 assert.equal(travelExaggeration(100,12,480),1)
 assert.equal(travelExaggeration(null,12),1)
 assert.equal(motionColor(0,1,'components'),'rgb(150,160,174)')
 assert.equal(motionColor(-9,1,'components'),'rgb(240,128,40)')
 assert.equal(motionColor(9,1,'flow'),'rgb(14,84,140)')
})

test('grid affine round-trips and particle paths stay inside displayed cells',()=>{
 const affine=[[8.0177,0.00104,0.0000124],[46.5102,0.0000086,-0.00072]],[lon,lat]=gridToLonLat(affine,12.5,40.5),[col,row]=lonLatToGrid(affine,lon,lat)
 assert.ok(Math.abs(col-12.5)<1e-9&&Math.abs(row-40.5)<1e-9)
 // A 2×4 strip of displayed cells; strong southward flow must stop at the strip edge.
 const cells=[];for(let r=0;r<4;r++)for(let c=0;c<2;c++)cells.push([r,c,0,0,0,-1])
 const paths=particlePaths(preview('flow',cells),'alongTrack',100)
 assert.equal(paths.length,2)
 for(const {path} of paths)for(const [x,y] of path){assert.ok(x>=0&&x<2&&y>=0&&y<4)}
 assert.ok(paths[0].path.at(-1)[1]>paths[0].path[0][1])
 assert.deepEqual(pointOnPath([[0,0],[2,2]],0.5),[1,1])
})

test('every particle path maps to a coloured scene cell',async()=>{
 const {motionScene}=await import('../frontend/src/data/motion-preview.mjs')
 const cells=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)cells.push([r,c,r%2?0.3:-0.3,0.05,null,null])
 const scene=motionScene(preview('components',cells),'alongTrack')
 assert.ok(scene.paths.length>0)
 for(const {index,seed} of scene.paths){assert.equal(scene.cells[index],seed);assert.match(motionColor(scene.values[index],scene.scale,scene.mode),/^rgb\(\d+,\d+,\d+\)$/)}
})
test('the flow legend widens for a fast glacier and keeps the slow-glacier floor',async()=>{
 const {motionScene,niceCeil}=await import('../frontend/src/data/motion-preview.mjs')
 const field=speed=>{const cells=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)cells.push([r,c,null,null,speed*(1+c/10),0]);return preview('flow',cells)}
 assert.equal(motionScene(field(0.3),'alongTrack').scale,300/365.25)
 assert.equal(motionScene(field(3),'alongTrack').scale,5)
 assert.equal(motionScene(field(3),'alongTrack',2).scale,2.5)
 assert.deepEqual([0.82,1,1.1,3.1,5,6,20].map(niceCeil),[1,1,2,5,5,10,20])
})
