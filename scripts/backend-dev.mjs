import {fileURLToPath} from 'node:url'
import {superviseBackend} from './backend-supervisor.mjs'

const backend=superviseBackend({root:fileURLToPath(new URL('../',import.meta.url))})
const stop=async()=>{await backend.close();if(process.connected)process.disconnect()}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
process.on('message',message=>{if(message?.type==='shutdown')stop()})
process.on('disconnect',stop)
