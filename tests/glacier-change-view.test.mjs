import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'

// Render the actual component offline; no DOM, browser, HTTP listener or app launch.
const require=createRequire(import.meta.url)
const bundle=await build({
  entryPoints:[fileURLToPath(new URL('../frontend/src/components/GlacierChangeSummary.tsx',import.meta.url))],
  bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',
  plugins:[{name:'shared-react',setup(builder){builder.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:pathToFileURL(require.resolve(args.path)).href,external:true}))}}]
})
const {default:Summary}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const frame={kind:'velocity',units:'m/year',source:'ITS_LIVE',maskYear:2017,start:'2022-01-01',end:'2022-02-01',label:'1 Jan → 1 Feb 2022'}
const selected={...frame,start:'2022-04-01',end:'2022-05-01',label:'1 Apr → 1 May 2022'}
const grid=(speed,error=[])=>({shape:[1,speed.length],bounds3857:[0,0,speed.length,1],speed,error})
const render=props=>renderToStaticMarkup(createElement(Summary,props))

test('actual comparison view explains paired dates, common coverage and uncertainty without a hazard probability',()=>{
  const html=render({mode:'change',frame:selected,baseline:frame,grid:grid([120,null,220],[1,null,3]),baselineGrid:grid([100,80,200],[2,3,4])})
  assert.match(html,/1 Jan → 1 Feb 2022/);assert.match(html,/1 Apr → 1 May 2022/)
  assert.match(html,/\+20\.0/);assert.match(html,/66\.7% of A · 100\.0% of B/)
  assert.match(html,/not confidence bounds/);assert.match(html,/statistical significance is not assessed/)
  assert.doesNotMatch(html,/Landslide Risk|confidence score|NaN|Infinity/)
})

test('no common observations never renders a zero change headline',()=>{
  const html=render({mode:'change',frame:selected,baseline:frame,grid:grid([10,null]),baselineGrid:grid([null,20])})
  assert.match(html,/No locations have accepted measurements in both intervals/)
  assert.doesNotMatch(html,/change-headline|Median speed difference/)
})

test('incompatible scientific sources, units and masks do not display a numerical comparison',()=>{
  for(const changed of [{source:'Other product'},{units:'m/day'},{maskYear:1973},{kind:'elevation'}]){
    const html=render({mode:'change',frame:{...selected,...changed},baseline:frame,grid:grid([120]),baselineGrid:grid([100])})
    assert.match(html,/No numerical comparison is shown/);assert.doesNotMatch(html,/change-headline/)
  }
})

test('self comparisons are explicitly labeled',()=>{
  const html=render({mode:'change',frame,baseline:frame,grid:grid([100]),baselineGrid:grid([100])})
  assert.match(html,/self-comparison does not measure change across time/)
})

test('elevation view explains signed mean rates, unavailable uncertainty and fixed geometry',()=>{
  const html=render({mode:'elevation',frame:{...frame,kind:'elevation',label:'2000 → 2020'},grid:{...grid([null,null]),elevationChange:[-2,-1]}})
  assert.match(html,/-1\.50/);assert.match(html,/Uncertainty is unavailable/)
  assert.match(html,/cannot reconstruct absolute heights/);assert.doesNotMatch(html,/Median reported speed error/)
})

test('inventory area gains remain signed gains and do not become a melt or annual retreat claim',()=>{
  const html=render({mode:'extent',outline:{properties:{year:2017,areaKm2:110,acquisitionLabel:'Acquired 2017'}},firstOutline:{properties:{year:1973,areaKm2:100,acquisitionLabel:'Inventory 1973'}}})
  assert.match(html,/\+10\.00/);assert.match(html,/\+10\.0%/);assert.match(html,/Acquired 2017/)
  assert.match(html,/not ice volume lost or a precise annual retreat rate/)
})
