// Scientific renderer verification, not browser screenshots or GPU/FPS claims.
import {createCanvas,loadImage} from '@napi-rs/canvas'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {join} from 'node:path'
import {createSignalModel,validatePresentation,cellKey} from '../frontend/src/data/nisar-presentation.mjs'
import {drawBase,drawSignal} from '../frontend/src/data/nisar-renderer.mjs'
const directory=join(process.cwd(),'database/processed/supplied-nisar'),output=join(process.cwd(),'database/processed/presentation-checks')
const json=async name=>JSON.parse(await readFile(join(directory,name),'utf8'))
const study=await json('summary.json'),context=await json('presentation.json'),layers={}
for(const meta of study.layers)layers[meta.id]=await json(meta.id+'.json')
validatePresentation(study,context,layers)
for(const meta of study.layers){const model=createSignalModel(layers[meta.id],.3),expected=meta.thresholds.find(t=>t.threshold===.3);assert.equal(model.cells.length,meta.defaultAcceptedSamples);assert.ok(Math.abs(model.along.median-expected.alongTrack.median)<1e-4);assert.ok(Math.abs(model.slant.median-expected.slantRange.median)<1e-4)}
const image=await loadImage(join(directory,'presentation-context.png'));await mkdir(output,{recursive:true})
const timings=[]
for(const [name,view,progress,threshold,chapter] of [['stage-acquisitions','geographic',0,0,0],['stage-geographic','geographic',1,.3,3],['stage-radar-midpoint','radar',.5,.3,1],['stage-confidence','geographic',1,.4,2]]){
 const width=900,height=650,model=createSignalModel(layers.layer3,threshold),selected=model.representative,base=createCanvas(width,height),field=createCanvas(width,height),options={width,height,context,model,view,image,extent:study.extent}
 drawBase(base.getContext('2d'),options);drawSignal(field.getContext('2d'),{...options,progress,selected,chapter,reveal:.5});base.getContext('2d').drawImage(field,0,0);await writeFile(join(output,name+'.png'),base.toBuffer('image/png'))
 for(let i=0;i<60;i++){const start=performance.now();drawSignal(field.getContext('2d'),{...options,progress:i/59,selected,chapter,reveal:.5});timings.push(performance.now()-start)}
 console.log(JSON.stringify({name,cells:model.cells.length,representative:cellKey(selected),along:selected?.[4],slant:selected?.[5]}))
}
timings.sort((a,b)=>a-b);const result={runtime:'Native CPU canvas; does not measure browser/GPU FPS',frames:timings.length,medianMs:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.floor(timings.length*.95)],sourceSha256:study.sourceSha256}
await writeFile(join(output,'render-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
