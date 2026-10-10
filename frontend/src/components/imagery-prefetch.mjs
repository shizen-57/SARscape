// Warm the same tile URLs MapLibre requests, so HTTP and persistent server
// caches are shared. Background work stays below the visible capture's priority.
export function prefetchCaptures({frames,step,tiles,fetchTile=fetch,delayMs=1200,concurrency=1}){
 const controller=new AbortController()
 const order=[]
 for(let distance=1;distance<frames.length;distance++){
  if(step+distance<frames.length)order.push(frames[step+distance])
  if(step-distance>=0)order.push(frames[step-distance])
 }
 const templates=[...new Set(tiles)].slice(-48)
 const urls=order.flatMap(frame=>templates.map(template=>template.replace(/\/(?:\{frame\}|%7Bframe%7D)\//gi,`/${encodeURIComponent(frame.id)}/`)))
 let next=0
 const timer=setTimeout(async()=>{
  const work=async()=>{while(next<urls.length){
   if(controller.signal.aborted)return
   const url=urls[next++]
   try{
    const response=await fetchTile(url,{signal:controller.signal,cache:'force-cache',priority:'low'})
    // Consume the image to complete browser caching. Never persist failures here.
    if(response.ok)await response.arrayBuffer()
   }catch{if(controller.signal.aborted)return}
  }}
  await Promise.all(Array.from({length:Math.min(concurrency,urls.length)},work))
 },delayMs)
 return()=>{clearTimeout(timer);controller.abort()}
}
