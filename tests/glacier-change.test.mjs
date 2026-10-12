import test from 'node:test'
import assert from 'node:assert/strict'
import {measurementStats,summarizeSpeedChange,summarizeSurface,summarizeMappedArea} from '../frontend/src/data/glacier-change.mjs'

const grid=(speed,extra={})=>({shape:[1,speed.length],bounds3857:[0,0,speed.length,1],speed,error:speed.map(()=>null),...extra})

test('descriptive statistics preserve zeros and exclude missing/nonfinite values without mutating data',()=>{
  const values=[10,null,0,NaN,Infinity,20,-10,undefined]
  assert.deepEqual(measurementStats(values),{count:4,median:5,q25:-2.5,q75:12.5})
  assert.deepEqual(values,[10,null,0,NaN,Infinity,20,-10,undefined])
  assert.equal(measurementStats([null,NaN,undefined]),null)
})

test('speed comparison uses only common cells and the median of cell differences, not difference of medians',()=>{
  const a=grid([0,10,100,null,200],{error:[0,2,null,1,8]})
  const b=grid([20,10,200,80,null],{error:[1,3,5,6,null]})
  const result=summarizeSpeedChange(b,a)
  assert.equal(result.status,'ready');assert.equal(result.matchedCells,3)
  assert.equal(result.baselineCells,4);assert.equal(result.currentCells,4)
  assert.equal(result.baseline.median,10);assert.equal(result.current.median,20)
  assert.equal(result.difference.median,20)
  assert.notEqual(result.difference.median,result.current.median-result.baseline.median)
  assert.deepEqual(result.baselineError,{count:2,median:1,q25:.5,q75:1.5})
  assert.equal(result.currentError.count,3)
  assert.deepEqual(a.speed,[0,10,100,null,200])
})

test('unmatched, malformed and shifted grids never produce a fabricated difference',()=>{
  const a=grid([1,null]),b=grid([null,2])
  assert.equal(summarizeSpeedChange(b,a).status,'no-overlap')
  assert.equal(summarizeSpeedChange(b,a).difference,null)
  for(const malformed of [undefined,{...a,shape:[2,1]},{...a,bounds3857:[1,0,3,1]},{...a,speed:[1]},{...a,shape:[0,2]},{...a,bounds3857:[0,0,NaN,1]}]){
    assert.equal(summarizeSpeedChange(a,malformed).status,'incompatible')
  }
})

test('comparison direction reverses correctly and self comparisons report zero',()=>{
  const a=grid([100,200]),b=grid([80,220])
  const forward=summarizeSpeedChange(b,a),reverse=summarizeSpeedChange(a,b)
  assert.equal(forward.difference.q25,-10);assert.equal(reverse.difference.q25,-10)
  assert.equal(summarizeSpeedChange(grid([90,180]),a).difference.median,-15)
  assert.equal(summarizeSpeedChange(a,grid([90,180])).difference.median,15)
  assert.equal(summarizeSpeedChange(a,a).difference.median,0)
})

test('uncertainty availability never changes valid measurements or becomes an invented confidence score',()=>{
  const a=grid([100,200,300],{error:[NaN,-1,undefined]}),b=grid([120,210,300],{error:[0,null,Infinity]})
  const result=summarizeSpeedChange(b,a)
  assert.equal(result.matchedCells,3);assert.equal(result.baselineError,null)
  assert.equal(result.currentError.median,0);assert.equal(result.currentError.count,1)
  assert.equal('confidence' in result,false);assert.equal('probability' in result,false)
})

test('elevation summaries use signed height-change values rather than the empty speed field',()=>{
  const data=grid([null,null,null],{elevationChange:[-3,-1,0],error:[1,1,1]})
  const result=summarizeSurface(data,'elevation')
  assert.equal(result.measurements.median,-1);assert.equal(result.measurements.count,3)
  assert.equal(result.error,null)
  assert.equal(summarizeSurface(data,'velocity').measurements,null)
  assert.equal(summarizeSurface({...data,elevationChange:[-3]},'elevation'),null)
})

test('velocity summaries exclude negative speeds without discarding zero speed or zero error',()=>{
  const result=summarizeSurface(grid([-5,0,10],{error:[5,0,null]}),'velocity')
  assert.equal(result.measurements.count,2);assert.equal(result.measurements.median,5)
  assert.equal(result.error.median,0);assert.equal(result.error.count,1)
})

test('mapped inventory changes permit gains, flag self comparisons and reject invalid denominators',()=>{
  const a={year:1973,areaKm2:100},b={year:2010,areaKm2:80}
  assert.deepEqual(summarizeMappedArea(b,a),{baselineKm2:100,currentKm2:80,differenceKm2:-20,percent:-20,sameInventory:false})
  assert.equal(summarizeMappedArea({year:2017,areaKm2:110},a).percent,10)
  assert.equal(summarizeMappedArea(a,a).sameInventory,true)
  for(const bad of [undefined,{year:1973,areaKm2:0},{year:1973,areaKm2:NaN},{year:NaN,areaKm2:100}])assert.equal(summarizeMappedArea(b,bad),null)
})
