import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
const root=fileURLToPath(new URL('../',import.meta.url))
if(!existsSync(join(root,'frontend/dist/index.html'))){console.error('Build the application first: npm run build');process.exit(1)}
const children=[spawn(process.execPath,['backend/src/server.mjs'],{cwd:root,stdio:'inherit',windowsHide:true})]
let stopping=false
const stop=(code=0)=>{if(stopping)return;stopping=true;children.forEach(child=>child.kill());process.exitCode=code}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop())
for(const child of children){child.on('error',error=>{console.error('Could not start the application:',error.message);stop(1)});child.on('exit',code=>{if(!stopping)stop(code??1)})}
console.log('SARscape application: http://127.0.0.1:8787')
