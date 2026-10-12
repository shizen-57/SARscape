import test from 'node:test'
import assert from 'node:assert/strict'
import {differenceGrid,insideOutline,surfaceCell,surfaceColor,mercator,inspectSurfacePoint} from '../frontend/src/data/glacier-surfaces.mjs'
import {createSurfaceService} from '../backend/src/surfaces.mjs'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {homedir} from 'node:os'
import {existsSync} from 'node:fs'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'

test('regional pipeline preserves scientific missing values and refuses full downloads',async()=>{
 const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
 const {stderr}=await promisify(execFile)(python,['tests/glacier_surface_pipeline_test.py'],{timeout:45000,maxBuffer:2*1024*1024})
 assert.match(stderr,/Ran 5 tests/);assert.match(stderr,/OK/)
})

test('speed differences preserve missing cells and require identical georeferenced grids',()=>{
 const a={shape:[1,3],bounds3857:[0,0,3,1],speed:[120,null,80]},b={...a,speed:[100,50,null]}
 assert.deepEqual(differenceGrid(a,b),[20,null,null])
 assert.equal(differenceGrid(a,{...b,bounds3857:[1,0,4,1]}),null)
 assert.equal(differenceGrid(a,{...b,shape:[3,1]}),null)
})
test('scientific color endpoints saturate consistently without changing units',()=>{
 assert.deepEqual(surfaceColor(0,[0,300]),[20,12,72]);assert.deepEqual(surfaceColor(300,[0,300]),[255,226,90]);assert.deepEqual(surfaceColor(600,[0,300]),surfaceColor(300,[0,300]))
})
test('surface inspector uses Mercator row/column orientation and excludes outside cells',()=>{
 const [x,y]=mercator(8,46),grid={shape:[2,2],bounds3857:[x-10,y-10,x+10,y+10],speed:[10,20,30,null],error:[1,2,3,null],vx:[1,2,3,null],vy:[1,2,3,null]}
 assert.equal(surfaceCell(grid,8,46).speed,null)
 assert.equal(surfaceCell(grid,0,0),null)
})
test('selected point readout reports paired velocity cells and preserves missing errors',()=>{
 const [x,y]=mercator(8,46),bounds3857=[x-100,y-100,x+100,y+100],shape=[2,2]
 const outline={type:'Feature',properties:{year:2017,areaKm2:80},geometry:{type:'Polygon',coordinates:[[[7,45],[9,45],[9,47],[7,47],[7,45]]]}}
 const current={shape,bounds3857,speed:[10,20,30,40],error:[1,2,null,4]},baselineGrid={shape,bounds3857,speed:[8,25,35,30],error:[.5,1,1.5,null]}
 const scene={mode:'change',grid:current,baselineGrid,outlines:{features:[outline]},outlineIndex:0}
 const measured=inspectSurfacePoint(scene,8,46)
 assert.equal(measured.status,'measured');assert.equal(measured.insideOutline,true);assert.equal(measured.speed,40);assert.equal(measured.baselineSpeed,30);assert.equal(measured.difference,10);assert.equal(measured.error,4);assert.equal(measured.baselineError,null)
 const gap=inspectSurfacePoint({...scene,grid:{...current,speed:[10,20,30,null]}},8,46)
 assert.equal(gap.status,'missing');assert.equal(gap.difference,null)
 const outside=inspectSurfacePoint(scene,0,0)
 assert.equal(outside.status,'outside-grid');assert.equal(outside.insideOutline,false)
})
test('selected point extent readout exposes whole inventory area only inside outline',()=>{
 const outline={type:'Feature',properties:{year:2017,areaKm2:80},geometry:{type:'Polygon',coordinates:[[[7,45],[9,45],[9,47],[7,47],[7,45]]]}}
 const scene={mode:'extent',outlines:{features:[outline]},outlineIndex:0}
 assert.equal(inspectSurfacePoint(scene,8,46).areaKm2,80)
 assert.equal(inspectSurfacePoint(scene,10,46).areaKm2,null)
})
test('glacier classification respects holes and disconnected polygons',()=>{
 const polygon={type:'Polygon',coordinates:[[[0,0],[4,0],[4,4],[0,4],[0,0]],[[1,1],[2,1],[2,2],[1,2],[1,1]]]}
 assert.equal(insideOutline([.5,.5],polygon),true);assert.equal(insideOutline([1.5,1.5],polygon),false);assert.equal(insideOutline([5,5],polygon),false)
})
test('surface service serves only manifest-listed artifacts and handles missing regions',async()=>{
 const root=await mkdtemp(join(tmpdir(),'glacier-surfaces-'));const folder=join(root,'database/processed/surfaces/aletsch');await mkdir(folder,{recursive:true})
 try{
  await writeFile(join(folder,'manifest.json'),JSON.stringify({scenario:'aletsch',frames:[{image:'velocity.png',grid:'velocity.json'}]}));await writeFile(join(folder,'velocity.png'),'raster');await writeFile(join(folder,'private.txt'),'private')
  const service=createSurfaceService({root});assert.equal((await service.list('aletsch')).available,true);assert.equal((await service.list('other')).available,false)
  assert.equal((await service.artifact('aletsch','velocity.png')).toString(),'raster');assert.equal(await service.artifact('aletsch','private.txt'),null);assert.equal(await service.artifact('../aletsch','velocity.png'),null)
 }finally{await rm(root,{recursive:true,force:true})}
})
