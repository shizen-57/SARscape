import {serve} from '@hono/node-server'
import {fileURLToPath} from 'node:url'
import {createApi} from './app.mjs'
import {createSqliteCache} from './cache.mjs'
import {hostedImageryTile,localImageryTile} from './imagery.mjs'
import {createTileCache} from './tiles.mjs'
import {createScienceService} from './science.mjs'
import {createSurfaceService} from './surfaces.mjs'
import {createAssistant} from './assistant.mjs'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
import {serveStatic} from '@hono/node-server/serve-static'
import {pythonExecutable} from './python.mjs'
import {createRasterWorker} from './raster.mjs'
import {satelliteAccess} from './satellite-fetch.mjs'
import {createSuppliedStudy} from './study.mjs'
import {createAnalysisService} from './analysis.mjs'
const root=fileURLToPath(new URL('../../',import.meta.url)),python=pythonExecutable(root)
try{process.loadEnvFile(join(root,'.env'))}catch{/* optional */}
const science=createScienceService({root,python})
const raster=createRasterWorker({root,python})
const analysis=createAnalysisService({root,python})
const cache=createSqliteCache(fileURLToPath(new URL('../../database/',import.meta.url)))
const renderTile=createTileCache(cache,async(frame,z,x,y,id)=>{
 try{await raster.ensure();return await localImageryTile(frame,z,x,y,id)}catch(error){
  if(!process.env.SARSCAPE_RASTER_SERVICE)throw error
  return hostedImageryTile(frame,z,x,y,process.env.SARSCAPE_RASTER_SERVICE)
 }
})
const renderIndex=async(id,frame,mode,z,x,y)=>{await raster.ensure();const response=await fetch(`http://127.0.0.1:8788/index/${id}/${frame}/${mode}/${z}/${x}/${y}.png`,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Prepare the index study before showing it on the map.');return new Uint8Array(await response.arrayBuffer())}
const app=createApi({cache,renderTile,science,analysis,surfaces:createSurfaceService({root}),assistant:createAssistant({science}),renderIndex,study:createSuppliedStudy(root),fetchUpstream:satelliteAccess.fetch})
if(existsSync(join(root,'frontend/dist/index.html'))){
 app.use('/assets/*',async(c,next)=>{await next();if(c.res.ok)c.header('Cache-Control','public,max-age=31536000,immutable')})
 app.get('/*',serveStatic({root:join(root,'frontend/dist')}))
}
const server=serve({fetch:app.fetch,hostname:'127.0.0.1',port:8787},()=>console.log('SARscape backend ready at http://127.0.0.1:8787'))
let stopping=false
const stop=()=>{
 if(stopping)return
 stopping=true
 // Finish tiles already being served before stopping their raster worker. A
 // source reload should not reset every image connection in the browser.
 const deadline=setTimeout(()=>server.closeAllConnections(),10000)
 server.close(()=>{clearTimeout(deadline);science.close();analysis.close();raster.close();cache.close();process.exit(0)})
 server.closeIdleConnections()
}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
process.on('message',message=>{if(message?.type==='shutdown')stop()})
process.on('disconnect',stop)
