// Ready-state React markup and real source/API checks. Browser interaction and
// CSS layout require a connected browser and are not claimed by this check.
import {build} from 'esbuild'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {pathToFileURL} from 'node:url'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
const root=process.cwd(),assets=join(root,'database/processed/supplied-nisar'),out=join(root,'database/processed/presentation-checks')
await mkdir(out,{recursive:true})
const json=async name=>JSON.parse(await readFile(join(assets,name),'utf8')),query=new QueryClient(),annual=await json('annual.json'),study=await json('summary.json'),context=await json('presentation.json'),layers={}
for(const layer of study.layers)layers[layer.id]=await json(layer.id+'.json')
query.setQueryData(['annual-presentation-v1'],{manifest:annual,images:annual.frames.map(()=>({}))})
query.setQueryData(['nisar-presentation-v1'],{study,context,layers,image:{},reports:{}})
const catalogue=JSON.parse(await readFile(join(root,'database/imagery/sentinel2.json'),'utf8'))
query.setQueryData(['imagery','aletsch','sentinel2'],{source:'Sentinel-2',frames:catalogue.scenarios.aletsch})
const render=component=>renderToStaticMarkup(React.createElement(QueryClientProvider,{client:query},React.createElement(component,{onExit:()=>{},onExplore:()=>{},onMode:()=>{}})))
const names=['AnnualExperience','NisarExperience','App'],html={}
for(const name of names){const path=name==='App'?join(root,'frontend/src/App.tsx'):join(root,'frontend/src/components',name+'.tsx'),module=join(out,`verify-${name}.mjs`);await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',loader:{'.css':'empty'},outfile:module,logLevel:'silent'});globalThis.window={location:{hash:'#explore'}};globalThis.localStorage={getItem:()=>null};const component=(await import(pathToFileURL(module))).default;html[name]=render(component);await writeFile(join(out,`${name}-markup.html`),html[name])}
for(const name of names){assert.equal((html[name].match(/aria-label="Simulation mode"/g)||[]).length,name==='App'?0:1)}
assert.equal((html.AnnualExperience.match(/aria-label="Annual glacier observation timeline"/g)||[]).length,1)
assert.ok(html.AnnualExperience.includes('27 Sept 2026')||html.AnnualExperience.includes('27 Sep 2026'));assert.ok(html.AnnualExperience.includes('Side by side'))
assert.equal((html.NisarExperience.match(/aria-label="Presentation elapsed fraction within the measured pair"/g)||[]).length,1)
assert.equal((html.NisarExperience.match(/Play 80-second story/g)||[]).length,1)
assert.equal((html.NisarExperience.match(/>Explore<|>Explore<\/button>/g)||[]).length,1)
assert.equal((html.App.match(/aria-label="Capture date"/g)||[]).length,1)
for(const duplicate of ['Present NISAR','Capture details','About the data','study-map-controls'])assert.ok(!html.App.includes(duplicate),`Removed duplicate ${duplicate}`)
assert.ok(html.App.includes('Data &amp; analysis'));assert.ok(html.App.includes('Simulation'))
const http=[]
for(const name of ['annual.json',...annual.frames.map(f=>f.image),'summary.json','presentation.json','layer3.json']){const response=await fetch('http://127.0.0.1:5173/api/science/study/supplied/'+name);assert.equal(response.status,200,name);const bytes=await response.arrayBuffer();assert.ok(bytes.byteLength>1000,name);const frame=annual.frames.find(f=>f.image===name);if(frame)assert.equal(createHash('sha256').update(new Uint8Array(bytes)).digest('hex'),frame.imageSha256,name);http.push({name,bytes:bytes.byteLength})}
const result={reactReadyStates:names,oneActiveClockPerMode:true,guideButtonAppearsOnce:true,removedDuplicateEntries:true,localAssets:http,limit:'No connected browser: does not verify pointer interaction or responsive CSS layout'};await writeFile(join(out,'simulation-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
