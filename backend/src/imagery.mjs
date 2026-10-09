import manifest from '../../database/imagery/sentinel2.json' with {type:'json'}
export const imageryManifest=manifest
export function imageryFrame(scenarioId,frameId){return manifest.scenarios[scenarioId]?.find(f=>f.id===frameId)}
export async function hostedImageryTile(frame,z,x,y,service){
 if(!service)throw new Error('A production raster service must be configured for hosted imagery')
 const params=new URLSearchParams({url:frame.url})
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
