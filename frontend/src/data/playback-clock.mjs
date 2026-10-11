// Elapsed-time animation: speed stays constant when frames are delayed.
export function animateProgress({start=0,duration=6000,onFrame,onComplete=()=>{},request=requestAnimationFrame,cancel=cancelAnimationFrame,now=()=>performance.now(),hidden=()=>document.hidden,subscribeVisibility=callback=>{document.addEventListener('visibilitychange',callback);return()=>document.removeEventListener('visibilitychange',callback)}}){
 let id,stopped=false,previous=now(),progress=start
 const unsubscribe=subscribeVisibility(()=>{previous=now()})
 const tick=time=>{
  if(stopped)return
  if(!hidden())progress=Math.min(1,progress+Math.max(0,time-previous)/duration)
  previous=time
  if(!hidden())onFrame(progress)
  if(progress>=1){stopped=true;unsubscribe();onComplete();return}
  id=request(tick)
 }
 id=request(tick)
 return()=>{stopped=true;unsubscribe();if(id!==undefined)cancel(id)}
}
