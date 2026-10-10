import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {spawn} from 'node:child_process'
import additional from '../../database/imagery/additional-sentinel2.json' with {type:'json'}
export function createAnalysisService({root,python}){
 const directory=join(root,'database/processed/environment-v1'),states=new Map(),children=new Set(),queue=[];let active=false,closed=false
 const snapshot=async id=>{
  const frames=await Promise.all(additional.scenarios[id].map(async frame=>{
   try{const summary=JSON.parse(await readFile(join(directory,id,frame.id,'summary.json'),'utf8')),change=JSON.parse(await readFile(join(directory,id,frame.id,'change.json'),'utf8'));return {id:frame.id,date:frame.date,status:'complete',summary,change}}
   catch(error){if(error.code!=='ENOENT')throw error;return {id:frame.id,date:frame.date,status:'pending'}}
  }))
  return {available:true,completed:frames.filter(f=>f.status==='complete').length,total:frames.length,frames,...(states.get(id)??{status:'idle'})}
 }
 const pump=async()=>{
  if(active||closed||!queue.length)return
  active=true;const id=queue.shift();states.set(id,{status:'processing'})
  try{
   await new Promise((resolve,reject)=>{
    const child=spawn(python,['backend/geo/indices.py','--scenario',id,'--parent-pid',String(process.pid)],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});children.add(child)
    let errors='',line='';child.stderr.on('data',chunk=>errors=(errors+chunk).slice(-3000))
    child.stdout.on('data',chunk=>{line+=chunk;const lines=line.split('\n');line=lines.pop();for(const item of lines)try{states.set(id,{status:'processing',progress:JSON.parse(item)})}catch{}})
    const timer=setTimeout(()=>{child.kill();reject(new Error('Analysis exceeded 45 minutes. Retry to reuse completed crops.'))},45*60000)
    child.once('error',error=>{clearTimeout(timer);children.delete(child);reject(error)})
    child.once('exit',code=>{clearTimeout(timer);children.delete(child);code===0?resolve():reject(new Error(errors.trim()||'Index analysis failed'))})
   })
   states.set(id,{status:'complete'})
  }catch(error){states.set(id,{status:'failed',error:error.message.replaceAll(root,'[project]')})}
  active=false;void pump()
 }
 return {
  async list(id){return snapshot(id)},
  async prepare(id){const current=await snapshot(id);if(current.completed===current.total)return {...current,status:'complete'};if(!['queued','processing'].includes(states.get(id)?.status)){states.set(id,{status:'queued'});queue.push(id);void pump()}return snapshot(id)},
  async artifact(id,frame,file){if(!additional.scenarios[id]?.some(f=>f.id===frame)||!['summary.json','change.json','index.tif','change.tif','index.png','change.png'].includes(file))return null;try{return await readFile(join(directory,id,frame,file))}catch(error){if(error.code==='ENOENT')return null;throw error}},
  close(){closed=true;for(const child of children)child.kill()}
 }
}
