import {createApi} from './app.mjs'
import {hostedImageryTile} from './imagery.mjs'
import {satelliteAccess} from './satellite-fetch.mjs'
let app,service
export default {fetch(request,env){if(!app||service!==env?.RASTER_SERVICE_URL){service=env?.RASTER_SERVICE_URL;app=createApi({fetchUpstream:satelliteAccess.fetch,renderTile:(frame,z,x,y)=>hostedImageryTile(frame,z,x,y,service)})}return app.fetch(request)}}
