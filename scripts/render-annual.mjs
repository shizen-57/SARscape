// The app's real canvas renderer on authentic assets. This is a scientific
// artifact check; it does not replace browser layout or pointer testing.
import {createCanvas,loadImage} from '@napi-rs/canvas'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
import assert from 'node:assert/strict'
import {validateAnnual,annualState,drawAnnual} from '../frontend/src/data/annual-presentation.mjs'
const root=process.cwd(),directory=join(root,'database/processed/supplied-nisar'),out=join(root,'database/processed/presentation-checks')
const manifest=validateAnnual(JSON.parse(await readFile(join(directory,'annual.json'),'utf8'))),images=[]
for(const frame of manifest.frames){const bytes=await readFile(join(directory,frame.image));assert.equal(createHash('sha256').update(bytes).digest('hex'),frame.imageSha256);assert.equal(createHash('sha256').update(await readFile(join(root,frame.cachedInput))).digest('hex'),frame.inputSha256);const image=await loadImage(bytes);assert.equal(image.width,manifest.width);assert.equal(image.height,manifest.height);images.push(image)}
await mkdir(out,{recursive:true})
const width=1300,height=610,canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),timings=[]
for(const [name,progress,comparison,view] of [['annual-opening',1,'paired','tongue'],['annual-mid-blend',(4+.65)/8,'paired','tongue'],['annual-swipe',1,'swipe','tongue'],['annual-whole',1,'paired','whole']]){drawAnnual(ctx,{width,height,manifest,images,state:annualState(progress,9),comparison,view});await writeFile(join(out,name+'.png'),canvas.toBuffer('image/png'))}
const figure=createCanvas(width,height+125),fc=figure.getContext('2d');fc.fillStyle='#071515';fc.fillRect(0,0,width,height+125);fc.fillStyle='#d6ecd9';fc.font='24px system-ui';fc.fillText('ALETSCH / A CHANGING GLACIER EDGE',22,36);fc.font='14px system-ui';fc.fillText('27 September 2018 / fixed reference',22,65);fc.fillText('27 September 2026 / observed capture',width/2+22,65);fc.save();fc.translate(0,80);drawAnnual(fc,{width,height,manifest,images,state:annualState(1,9)});fc.restore();fc.font='11px system-ui';fc.fillStyle='#a6c8b7';fc.fillText('Real Sentinel-2 images / same registered grid / 10 m source detail / seasonal appearance also varies / no measured retreat distance',22,height+105);await writeFile(join(out,'glacier-change-comparison.png'),figure.toBuffer('image/png'))
drawAnnual(ctx,{width,height,manifest,images,state:annualState(0,9)});const before=ctx.getImageData(0,0,width,height).data.slice()
drawAnnual(ctx,{width,height,manifest,images,state:annualState(1,9)});const after=ctx.getImageData(0,0,width,height).data
let leftChanged=0,rightChanged=0;for(let y=40;y<height-60;y++)for(let x=30;x<width-30;x++){const i=(y*width+x)*4,d=Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2]);if(d>0){if(x<width/2)leftChanged++;else rightChanged++}}
assert.equal(leftChanged,0);assert.ok(rightChanged>10000,'The visible current image must actually change at the glacier inspection scale')
for(let n=0;n<120;n++){const start=performance.now();drawAnnual(ctx,{width,height,manifest,images,state:annualState(n/119,9)});timings.push(performance.now()-start)}
timings.sort((a,b)=>a-b);const result={captures:images.length,allSceneHashesVerified:true,leftReferencePixelsChanged:leftChanged,currentPixelsChanged:rightChanged,medianMs:timings[60],p95Ms:timings[114],runtime:'Native CPU canvas; not browser/GPU FPS',dates:manifest.frames.map(f=>f.date)};await writeFile(join(out,'annual-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
