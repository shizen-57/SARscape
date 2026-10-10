import manifest from '../../database/imagery/sentinel2.json' with {type:'json'}
import additional from '../../database/imagery/additional-sentinel2.json' with {type:'json'}
import {satelliteAccess} from './satellite-fetch.mjs'
export const imageryManifest={...manifest,scenarios:{...manifest.scenarios,...additional.scenarios}}
export const imagerySelection=id=>additional.scenarios[id]?additional.selection:manifest.selection
export function imageryFrame(scenarioId,frameId){return imageryManifest.scenarios[scenarioId]?.find(f=>f.id===frameId||f.sourceSceneId===frameId)}
export async function hostedImageryTile(frame,z,x,y,service){
 if(!service)throw new Error('A production raster service must be configured for hosted imagery')
 const params=new URLSearchParams({url:await satelliteAccess.sign(frame.url)})
 const response=await fetch(`${service.replace(/\/$/,'')}/cog/tiles/WebMercatorQuad/${z}/${x}/${y}.png?${params}`,{signal:AbortSignal.timeout(20000)})
 if(!response.ok)throw new Error(`Raster service returned ${response.status}`)
 return new Uint8Array(await response.arrayBuffer())
}
// Local COG renderer (backend/geo/tile_server.py). Preferred when running the full local stack; genuine Sentinel-2 pixels, no external demo dependency.
const localTileServer=typeof process!=='undefined'?(process.env.SARSCAPE_TILE_SERVER??'http://127.0.0.1:8788'):'http://127.0.0.1:8788'
export async function localImageryTile(frame,z,x,y,scenarioId){
 const response=await fetch(`${localTileServer}/tile/${scenarioId}/${frame.id}/${z}/${x}/${y}.png`,{signal:AbortSignal.timeout(180000)})
 if(!response.ok)throw new Error(`Local tile renderer returned ${response.status}`)
 return new Uint8Array(await response.arrayBuffer())
}
