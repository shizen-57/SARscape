// Warm the same tile URLs MapLibre requests, so HTTP and persistent server
// caches are shared. One background request limits competition with navigation.
export function prefetchCaptures({frames,step,tiles,fetchTile=fetch,delayMs=1200}){
 const controller=new AbortController()
 const order=[]
 for(let distance=1;distance<frames.length;distance++){
  if(step+distance<frames.length)order.push(frames[step+distance])
  if(step-distance>=0)order.push(frames[step-distance])
 }
 const templates=[...new Set(tiles)].slice(-48)
 const timer=setTimeout(async()=>{
  for(const frame of order)for(const template of templates){
   if(controller.signal.aborted)return
   const url=template.replace('/{frame}/',`/${encodeURIComponent(frame.id)}/`)
   try{
    const response=await fetchTile(url,{signal:controller.signal,cache:'force-cache',priority:'low'})
    // Consume the image to complete browser caching. Never persist failures here.
    if(response.ok)await response.arrayBuffer()
   }catch{if(controller.signal.aborted)return}
  }
 },delayMs)
 return()=>{clearTimeout(timer);controller.abort()}
}
