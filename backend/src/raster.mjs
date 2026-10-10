import {spawn,spawnSync} from 'node:child_process'

// Starting just the backend must also support dated satellite tiles. Reuse an
// already running worker, and own/stop only the process created by this server.
// Native glacier crops load first; distant landscape overviews are on demand.
export function createRasterWorker({root,python,fetchHealth=fetch,spawnWorker=spawn,stopTree=spawnSync,startDelayMs=250,healthTimeoutMs=1000}){
 let child,starting,closed=false
 const healthy=async()=>{
  try{const response=await fetchHealth('http://127.0.0.1:8788/health',{signal:AbortSignal.timeout(healthTimeoutMs)});const ok=response.ok;await response.body?.cancel();return ok}
  catch{return false}
 }
 const stopOwned=()=>{
  const owned=child;child=undefined
  if(owned&&owned.exitCode===null){
   // Windows venv launchers have a second Python process. Stop the owned tree.
   if(process.platform==='win32')stopTree('taskkill',['/PID',String(owned.pid),'/T','/F'],{stdio:'ignore',windowsHide:true})
   else owned.kill()
  }
 }
 const ensure=()=>{
  if(closed)return Promise.reject(new Error('The imagery processor is shutting down'))
  if(process.env.SARSCAPE_TILE_SERVER)return Promise.resolve()
  if(!starting)starting=(async()=>{
   if(await healthy())return
   let failure
   console.log('Starting the dated satellite imagery processor')
   if(closed)throw new Error('The imagery processor is shutting down')
   stopOwned()
   child=spawnWorker(python,['backend/geo/tile_server.py','--parent-pid',String(process.pid)],{cwd:root,stdio:'inherit',windowsHide:true})
   child.once('error',error=>{failure=error})
   const owned=child
   child.once('exit',code=>{failure=new Error(`Imagery processor exited (${code}). Check the processor output and backend/requirements.txt.`);if(child===owned)child=undefined})
   for(let attempt=0;attempt<40;attempt++){
    if(failure)throw failure
    if(await healthy())return
    await new Promise(resolve=>setTimeout(resolve,startDelayMs))
   }
   stopOwned()
   throw new Error('The imagery processor did not become ready. Check the Python interpreter and backend/requirements.txt.')
  })().finally(()=>{starting=undefined})
  return starting
 }
 const close=()=>{
  closed=true;stopOwned()
 }
 process.once('exit',close)
 return {ensure,close}
}
