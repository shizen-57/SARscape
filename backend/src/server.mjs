import {serve} from '@hono/node-server'
import {fileURLToPath} from 'node:url'
import {createApi} from './app.mjs'
import {createSqliteCache} from './cache.mjs'
import {hostedImageryTile,localImageryTile} from './imagery.mjs'
import {createTileCache} from './tiles.mjs'
import {createScienceService} from './science.mjs'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
import {serveStatic} from '@hono/node-server/serve-static'
const root=fileURLToPath(new URL('../../',import.meta.url)),bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
const science=createScienceService({root,python:process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')})
const cache=createSqliteCache(fileURLToPath(new URL('../../database/',import.meta.url)))
const renderTile=createTileCache(cache,async(frame,z,x,y,id)=>{
 try{return await localImageryTile(frame,z,x,y,id)}catch(error){
  if(!process.env.SARSCAPE_RASTER_SERVICE)throw error
  return hostedImageryTile(frame,z,x,y,process.env.SARSCAPE_RASTER_SERVICE)
 }
})
const app=createApi({cache,renderTile,science})
if(existsSync(join(root,'frontend/dist/index.html'))){
 app.use('/assets/*',async(c,next)=>{await next();if(c.res.ok)c.header('Cache-Control','public,max-age=31536000,immutable')})
 app.get('/*',serveStatic({root:'./frontend/dist'}))
}
const server=serve({fetch:app.fetch,hostname:'127.0.0.1',port:8787},()=>console.log('SARscape backend ready at http://127.0.0.1:8787'))
const stop=()=>{science.close();server.close(()=>{cache.close();process.exit(0)})}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
