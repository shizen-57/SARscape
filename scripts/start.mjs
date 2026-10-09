import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
const root=fileURLToPath(new URL('../',import.meta.url)),bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
if(!existsSync(join(root,'frontend/dist/index.html'))){console.error('Build the application first: npm run build');process.exit(1)}
const python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
const children=[spawn(python,['backend/geo/tile_server.py'],{cwd:root,stdio:'inherit',windowsHide:true}),spawn(process.execPath,['backend/src/server.mjs'],{cwd:root,stdio:'inherit',windowsHide:true})]
let stopping=false
const stop=(code=0)=>{if(stopping)return;stopping=true;children.forEach(child=>child.kill());process.exitCode=code}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop())
for(const child of children){child.on('error',error=>{console.error('Could not start the application:',error.message);stop(1)});child.on('exit',code=>{if(!stopping)stop(code??1)})}
console.log('SARscape application: http://127.0.0.1:8787')
