import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

export function createSurfaceService({root}) {
 const directory=join(root,'database/processed/surfaces')
 const valid=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,80}$/.test(value)
 const read=async(scenario,file)=>{try{return await readFile(join(directory,scenario,file))}catch(e){if(e.code==='ENOENT')return null;throw e}}
 const manifest=async scenario=>{
  if(!valid(scenario))return null
  const bytes=await read(scenario,'manifest.json');if(!bytes)return null
  const data=JSON.parse(bytes.toString());if(data.scenario!==scenario||!Array.isArray(data.frames))throw new Error('Invalid surface manifest')
  return data
 }
 return {
  async list(scenario){const data=await manifest(scenario);return data?{available:true,...data}:{available:false,frames:[],reason:'Measured glacier surfaces have not been prepared for this region.'}},
  async artifact(scenario,file){
   const data=await manifest(scenario);if(!data)return null
   const allowed=new Set(['outlines.geojson',...data.frames.flatMap(f=>[f.image,f.grid,f.raster].filter(Boolean))])
   if(!allowed.has(file)||!/^[-a-zA-Z0-9_.]+$/.test(file))return null
   return read(scenario,file)
  }
 }
}
