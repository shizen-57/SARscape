import {spawn} from 'node:child_process'
import {watch} from 'node:fs'
import {join} from 'node:path'

// Watch source files only. Processed imagery and database writes never restart
// the API. Unexpected exits recover even when no source file changes afterwards.
export function superviseBackend({root,spawnChild=spawn,watchDirectory=watch,retryDelayMs=500,debounceMs=250,shutdownMs=12000,log=console.error}){
 let child,retry,debounce,force,closed=false,restartRequested=false,failures=0
 let finished
 const stopped=new Promise(resolve=>finished=resolve)
 const watchers=[]
 const launch=()=>{
  if(closed)return
  restartRequested=false
  const started=Date.now()
  child=spawnChild(process.execPath,['backend/src/server.mjs'],{cwd:root,stdio:['inherit','inherit','inherit','ipc'],windowsHide:true})
  const owned=child
  const exited=(code,signal)=>{
   if(child!==owned)return
   clearTimeout(force);force=undefined;child=undefined
   if(closed){finished();return}
   if(Date.now()-started>30000)failures=0
   const delay=restartRequested?0:Math.min(5000,retryDelayMs*2**Math.min(failures++,4))
   log(restartRequested?'Reloading backend source…':`Backend exited (${code??signal}); restarting in ${delay} ms.`)
   retry=setTimeout(launch,delay)
  }
  owned.once('error',error=>{log(`Backend could not start: ${error.message}`);if(!owned.pid)exited(null,error.message)})
  owned.once('exit',exited)
 }
 const requestStop=()=>{
  if(!child||force)return
  const owned=child
  try{if(owned.connected)owned.send({type:'shutdown'});else owned.kill()}catch{owned.kill()}
  force=setTimeout(()=>{if(child===owned)owned.kill()},shutdownMs)
 }
 const sourceChanged=()=>{
  clearTimeout(debounce)
  debounce=setTimeout(()=>{
   if(closed)return
   restartRequested=true;clearTimeout(retry)
   if(child)requestStop();else launch()
  },debounceMs)
 }
 for(const [folder,accept] of [
  ['backend/src',name=>name.endsWith('.mjs')],
  ['backend/geo',name=>name.endsWith('.py')],
  ['database',name=>name==='scenarios.json'],
  ['database/imagery',name=>name.endsWith('.json')]
 ])watchers.push(watchDirectory(join(root,folder),(_event,name)=>{if(name&&accept(String(name)))sourceChanged()}))
 launch()
 return {close(){if(closed)return stopped;closed=true;watchers.forEach(watcher=>watcher.close());clearTimeout(retry);clearTimeout(debounce);if(child)requestStop();else finished();return stopped}}
}
