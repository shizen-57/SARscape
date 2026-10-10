import config from '../database/scenarios.json' with {type:'json'}
const base='http://127.0.0.1:8787',selected=process.argv.filter(v=>v.startsWith('--location=')).map(v=>v.split('=')[1])
const locations=config.scenarios.filter(s=>!selected.length||selected.includes(s.id))
if(!locations.length)throw new Error('Unknown location. Use --location=aletsch, langtang, columbia, sundarbans or rondonia.')
const tile=([lon,lat],z)=>{const n=2**z,r=lat*Math.PI/180;return {z,x:Math.floor((lon+180)/360*n),y:Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)}}
async function image(path,jpeg=false){
 for(let attempt=0;attempt<3;attempt++){
  try{const response=await fetch(base+path,{signal:AbortSignal.timeout(210000),cache:'reload'});if(!response.ok)throw new Error(`Imagery returned ${response.status}`);const bytes=new Uint8Array(await response.arrayBuffer());if(jpeg?bytes[0]!==255||bytes[1]!==216:bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw new Error('Expected a complete image');return bytes.length}
  catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,1000*2**attempt))}
 }
}
let completed=0,total=locations.length*9
for(const scenario of locations){
 const response=await fetch(`${base}/api/imagery/${scenario.id}?source=sentinel2`);if(!response.ok)throw new Error('Start the local backend before caching observations.');const sequence=await response.json(),{z,x,y}=tile(scenario.center,14)
 for(const frame of sequence.frames){const start=performance.now();await image(`/api/imagery/tiles/${scenario.id}/${frame.id}/${z}/${x}/${y}.png?v=9`);console.log(`Cached ${++completed}/${total}: ${scenario.id} ${frame.date.slice(0,10)} (${Math.round(performance.now()-start)} ms)`)}
}
if(locations.some(s=>s.id==='aletsch')){
 const {z,x,y}=tile(config.scenarios.find(s=>s.id==='aletsch').center,16)
 const paths=Array.from({length:8},(_,i)=>2018+i).flatMap(year=>[-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>`/api/imagery/aerial/${year}/${z}/${x+dx}/${y+dy}.jpeg`)))
 let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<paths.length)await image(paths[next++],true)}))
 console.log(`Cached ${paths.length} central Swiss aerial mosaic tiles`)
}
console.log('Study crops and central tiles are cached on disk. Playback prepares the exact camera viewport in the browser.')
