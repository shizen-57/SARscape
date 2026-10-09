import {parentPort} from 'node:worker_threads'
import {prepareBundle} from './prepare.mjs'
parentPort.on('message',({id,scenario,dates,quality})=>{try{parentPort.postMessage({id,value:prepareBundle(scenario,dates,quality)})}catch(e){parentPort.postMessage({id,error:e.message})}})
