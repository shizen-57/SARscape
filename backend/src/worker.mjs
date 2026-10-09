import {createApi} from './app.mjs'
import {hostedImageryTile} from './imagery.mjs'
let app,service
export default {fetch(request,env){if(!app||service!==env?.RASTER_SERVICE_URL){service=env?.RASTER_SERVICE_URL;app=createApi({renderTile:(frame,z,x,y)=>hostedImageryTile(frame,z,x,y,service)})}return app.fetch(request)}}
