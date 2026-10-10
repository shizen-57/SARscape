import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {createServer} from 'node:net'
const root=fileURLToPath(new URL('../',import.meta.url))
for(const port of [5173,8787,8788]){
 try{await new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(resolve))})}
 catch{console.error(`Port ${port} is already in use. Stop the existing SARscape instance before starting another.`);process.exit(1)}
}
const children=[spawn(process.execPath,['scripts/backend-dev.mjs'],{cwd:root,stdio:['inherit','inherit','inherit','ipc'],windowsHide:true}),spawn(process.execPath,['../node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:fileURLToPath(new URL('../frontend/',import.meta.url)),stdio:'inherit',windowsHide:true})]
let stopping=false
const stop=(code=0)=>{if(stopping)return;stopping=true;children.forEach(child=>{if(child.connected)child.send({type:'shutdown'});else child.kill()});process.exitCode=code}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop())
children.forEach(child=>{child.on('error',error=>{console.error('Could not start SARscape:',error.message);stop(1)});child.on('exit',code=>{if(!stopping)stop(code??1)})})
