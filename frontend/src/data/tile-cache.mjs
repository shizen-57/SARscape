export function createTileStore({fetchTile=fetch,maxBytes=64*1024*1024,persistent=typeof caches==='undefined'?null:caches,maxConcurrent=6,maxAttempts=5,retryDelayMs=750}={}){
 const memory=new Map(),pending=new Map(),waiting=[];let size=0,active=0,background=0
 const cancelled=signal=>signal.reason??new DOMException('Cancelled','AbortError')
 // Reserve capacity for the visible capture. Old camera requests must not hold
 // these slots for three minutes after all of their consumers have left.
 const drain=()=>{
  while(active<maxConcurrent){
   let index=waiting.findIndex(job=>job.entry.priority!=='low')
   if(index<0){if(background>=Math.min(2,maxConcurrent))return;index=0}
   const job=waiting.splice(index,1)[0];if(!job)return
   job.entry.controller.signal.removeEventListener('abort',job.abort)
   if(job.entry.controller.signal.aborted){job.reject(cancelled(job.entry.controller.signal));continue}
   const low=job.entry.priority==='low';active++;if(low)background++
   job.work().then(job.resolve,job.reject).finally(()=>{active--;if(low)background--;drain()})
  }
 }
 const limited=(entry,work)=>new Promise((resolve,reject)=>{
  const job={entry,work,resolve,reject,abort:()=>{const index=waiting.indexOf(job);if(index>=0){waiting.splice(index,1);reject(cancelled(entry.controller.signal))}}}
  waiting.push(job);entry.controller.signal.addEventListener('abort',job.abort,{once:true});drain()
 })
 const download=(url,entry)=>limited(entry,async()=>{
  const signal=AbortSignal.any([entry.controller.signal,AbortSignal.timeout(210000)])
  for(let attempt=0;attempt<maxAttempts;attempt++){
   let retryAfter=0
   try{
    const response=await fetchTile(url,{signal,cache:attempt?'reload':'force-cache',priority:entry.priority==='low'?'low':'auto'})
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
    await new Promise((resolve,reject)=>{
     const abort=()=>{clearTimeout(timer);reject(cancelled(signal))}
     const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},Math.min(10000,Math.max(retryDelayMs*2**attempt,Number.isFinite(retryAfter)?retryAfter:0)))
     signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
    })
   }
  }
 })
 const remember=(url,bytes,expires)=>{
  if(memory.has(url))size-=memory.get(url).bytes.byteLength
  while(size+bytes.byteLength>maxBytes&&memory.size){const key=memory.keys().next().value;size-=memory.get(key).bytes.byteLength;memory.delete(key)}
  if(bytes.byteLength<=maxBytes){memory.set(url,{bytes,expires});size+=bytes.byteLength}
 }
 const read=(url,signal,options={})=>{
  if(signal?.aborted)return Promise.reject(cancelled(signal))
  const hit=memory.get(url)
  if(hit?.expires>Date.now()){memory.delete(url);memory.set(url,hit);return Promise.resolve(hit.bytes.slice(0))}
  let entry=pending.get(url)
  if(!entry){
   entry={controller:new AbortController(),consumers:new Set(),priority:options.priority??'auto'}
   pending.set(url,entry)
   const owned=entry
   entry.work=(async()=>{
   let disk
   try{disk=await persistent?.open('sarscape-observations-v2');const cached=await disk?.match(url);if(cached&&Number(cached.headers.get('x-sarscape-expires'))>Date.now()){const bytes=await cached.arrayBuffer();remember(url,bytes,Number(cached.headers.get('x-sarscape-expires')));return bytes}}catch{}
   if(owned.controller.signal.aborted)throw cancelled(owned.controller.signal)
   const {bytes,png}=await download(url,owned)
   const expires=Date.now()+(url.includes('/aerial/')?86400000:30*86400000)
   remember(url,bytes,expires)
   try{if(disk){const keys=await disk.keys();if(keys.length>=1200)await disk.delete(keys[0]);await disk.put(url,new Response(bytes,{headers:{'Content-Type':png?'image/png':'image/jpeg','x-sarscape-expires':String(expires)}}))}}catch{}
   return bytes
   })().finally(()=>{if(pending.get(url)===owned)pending.delete(url)})
  }else if(options.priority!=='low'){entry.priority='auto';drain()}
  const owned=entry,consumer={};owned.consumers.add(consumer)
  return new Promise((resolve,reject)=>{
   const release=()=>{signal?.removeEventListener('abort',abort);owned.consumers.delete(consumer)}
   const abort=()=>{
    release();reject(cancelled(signal))
    if(!owned.consumers.size){owned.controller.abort();if(pending.get(url)===owned)pending.delete(url)}
   }
   signal?.addEventListener('abort',abort,{once:true})
   owned.work.then(bytes=>{release();if(signal?.aborted)reject(cancelled(signal));else resolve(bytes.slice(0))},error=>{release();reject(error)})
   if(signal?.aborted)abort()
  })
 }
 return {read,stats:()=>({bytes:size,tiles:memory.size,pending:pending.size})}
}
export const tileStore=createTileStore()
export async function prepareCaptures({frames,tiles,signal,onProgress=()=>{},read=(url,s)=>tileStore.read(url,s),concurrency=4}){
 const urls=[...new Set(frames.flatMap(frame=>tiles.map(template=>template.replace(/\/(?:\{frame\}|%7Bframe%7D)\//gi,`/${encodeURIComponent(frame.id)}/`))))]
 if(!urls.length)throw new Error('Move the map to the study area and wait for its current capture to load.')
 const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
 let next=0,completed=0,failed=false;onProgress({completed,total:urls.length})
 const work=async()=>{while(!failed&&next<urls.length){if(combined.aborted)throw combined.reason;const url=urls[next++];try{await read(url,combined);if(!failed&&!combined.aborted)onProgress({completed:++completed,total:urls.length})}catch(error){failed=true;throw error}}}
 try{await Promise.all(Array.from({length:Math.min(concurrency,urls.length)},work))}finally{controller.abort()}
 return {completed,total:urls.length}
}
