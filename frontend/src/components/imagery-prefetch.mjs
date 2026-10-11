// Warm the same tile URLs MapLibre requests, so HTTP and persistent server
// caches are shared. One background request limits competition with navigation.
async function consumeResponse(response,signal){
 const reader=response.body?.getReader()
 if(!reader)return
 const abort=()=>{void reader.cancel().catch(()=>{})}
 signal.addEventListener('abort',abort,{once:true})
 try{
  if(signal.aborted){await reader.cancel();return}
  // Drain in chunks to finish HTTP caching without allocating another whole
  // image buffer. No decoding, resizing or changes to imagery pixels.
  while(!signal.aborted){const {done}=await reader.read();if(done)return}
 }finally{signal.removeEventListener('abort',abort);reader.releaseLock()}
}

export function prefetchCaptures({frames,step,tiles,fetchTile=fetch,delayMs=1200}){
 const controller=new AbortController()
 const order=[]
 for(let distance=1;distance<frames.length;distance++){
  if(step+distance<frames.length)order.push(frames[step+distance])
  if(step-distance>=0)order.push(frames[step-distance])
 }
 const templates=[...new Set(tiles)].slice(-48)
 const timer=setTimeout(async()=>{
  // Warm a bounded neighbourhood; later timeline positions warm their own
  // neighbours rather than downloading every date on each idle view.
  for(const frame of order.slice(0,4))for(const template of templates){
   if(controller.signal.aborted)return
   const url=template.replace('/{frame}/',`/${encodeURIComponent(frame.id)}/`)
   try{
    const response=await fetchTile(url,{signal:controller.signal,cache:'force-cache',priority:'low'})
    // Consume the image to complete browser caching. Never persist failures here.
    if(response.ok)await consumeResponse(response,controller.signal)
    else await response.body?.cancel()
   }catch{if(controller.signal.aborted)return}
  }
 },delayMs)
 return()=>{clearTimeout(timer);controller.abort()}
}

export function createCaptureWarmer(start=prefetchCaptures){
 let signature=null,stop=null
 const cancel=()=>{stop?.();stop=null;signature=null}
 return {
  warm(options){
   const tiles=[...new Set(options.tiles)].slice(-48).sort()
   if(!tiles.length||options.frames.length<2){cancel();return}
   const key=JSON.stringify([options.frames.map(frame=>frame.id),options.step,tiles])
   // Retain the signature after completion too: repeated idle events should
   // not rerun the completed plan. Explicit cancellation permits a fresh plan.
   if(key===signature)return
   cancel()
   stop=start({...options,tiles});signature=key
  },
  cancel
 }
}
