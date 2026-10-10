export function createTileStore({fetchTile=fetch,maxBytes=64*1024*1024,persistent=typeof caches==='undefined'?null:caches,maxConcurrent=6,maxAttempts=5,retryDelayMs=750}={}){
 const memory=new Map(),pending=new Map(),waiting=[];let size=0,active=0
 const limited=async work=>{if(active>=maxConcurrent)await new Promise(resolve=>waiting.push(resolve));else active++;try{return await work()}finally{const next=waiting.shift();if(next)next();else active--}}
 const download=url=>limited(async()=>{
  const signal=AbortSignal.timeout(210000)
  for(let attempt=0;attempt<maxAttempts;attempt++){
   let retryAfter=0
   try{
    const response=await fetchTile(url,{signal,cache:attempt?'reload':'force-cache'})
    if(!response.ok){
     const error=new Error(`Observation download failed (${response.status})`)
     error.retryable=[408,429].includes(response.status)||response.status>=500
     const after=response.headers.get('retry-after'),seconds=Number(after)
     retryAfter=after?(Number.isFinite(seconds)?seconds*1000:Date.parse(after)-Date.now()):0
     await response.body?.cancel()
     throw error
    }
    const bytes=await response.arrayBuffer(),signature=new Uint8Array(bytes)
    const png=signature[0]===137&&signature[1]===80&&signature[2]===78&&signature[3]===71,jpeg=signature[0]===255&&signature[1]===216
    if(!png&&!jpeg){const error=new Error('Observation service did not return an image');error.retryable=false;throw error}
    return {bytes,png}
   }catch(error){
    if(signal.aborted||error.retryable===false||attempt===maxAttempts-1)throw error
    await new Promise(resolve=>setTimeout(resolve,Math.min(10000,Math.max(retryDelayMs*2**attempt,Number.isFinite(retryAfter)?retryAfter:0))))
   }
  }
 })
 const remember=(url,bytes,expires)=>{
  if(memory.has(url))size-=memory.get(url).bytes.byteLength
  while(size+bytes.byteLength>maxBytes&&memory.size){const key=memory.keys().next().value;size-=memory.get(key).bytes.byteLength;memory.delete(key)}
  if(bytes.byteLength<=maxBytes){memory.set(url,{bytes,expires});size+=bytes.byteLength}
 }
 const read=async url=>{
  const hit=memory.get(url)
  if(hit?.expires>Date.now()){memory.delete(url);memory.set(url,hit);return hit.bytes}
  if(!pending.has(url))pending.set(url,(async()=>{
   let disk
   try{disk=await persistent?.open('sarscape-observations-v2');const cached=await disk?.match(url);if(cached&&Number(cached.headers.get('x-sarscape-expires'))>Date.now()){const bytes=await cached.arrayBuffer();remember(url,bytes,Number(cached.headers.get('x-sarscape-expires')));return bytes}}catch{}
   const {bytes,png}=await download(url)
   const expires=Date.now()+(url.includes('/aerial/')?86400000:30*86400000)
   remember(url,bytes,expires)
   try{if(disk){const keys=await disk.keys();if(keys.length>=1200)await disk.delete(keys[0]);await disk.put(url,new Response(bytes,{headers:{'Content-Type':png?'image/png':'image/jpeg','x-sarscape-expires':String(expires)}}))}}catch{}
   return bytes
  })().finally(()=>pending.delete(url)))
  return pending.get(url)
 }
 return {async read(url,signal){if(signal?.aborted)throw signal.reason;const work=read(url);if(!signal)return (await work).slice(0);return new Promise((resolve,reject)=>{const abort=()=>reject(signal.reason??new DOMException('Cancelled','AbortError'));signal.addEventListener('abort',abort,{once:true});work.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)abort();else resolve(value.slice(0))},error=>{signal.removeEventListener('abort',abort);reject(error)})})},stats:()=>({bytes:size,tiles:memory.size,pending:pending.size})}
}
export const tileStore=createTileStore()
export async function prepareCaptures({frames,tiles,signal,onProgress=()=>{},read=(url,s)=>tileStore.read(url,s),concurrency=4}){
 const urls=[...new Set(frames.flatMap(frame=>tiles.map(template=>template.replace(/\/(?:\{frame\}|%7Bframe%7D)\//gi,`/${encodeURIComponent(frame.id)}/`))))]
 if(!urls.length)throw new Error('Move the map to the study area and wait for its current capture to load.')
 let next=0,completed=0,failed=false;onProgress({completed,total:urls.length})
 const work=async()=>{while(!failed&&next<urls.length){if(signal?.aborted)throw signal.reason;const url=urls[next++];try{await read(url,signal);if(!failed&&!signal?.aborted)onProgress({completed:++completed,total:urls.length})}catch(error){failed=true;throw error}}}
 await Promise.all(Array.from({length:Math.min(concurrency,urls.length)},work))
 return {completed,total:urls.length}
}
