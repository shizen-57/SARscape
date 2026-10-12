import {spawn} from 'node:child_process'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
const python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
for(const script of ['prepare_glacier_surfaces.py','prepare_elevation_surface.py']){
 const code=await new Promise((resolve,reject)=>{const child=spawn(python,['-u',`backend/geo/${script}`,...(script==='prepare_glacier_surfaces.py'?process.argv.slice(2):[])],{stdio:'inherit',windowsHide:true});child.on('error',reject);child.on('exit',resolve)})
 if(code!==0){process.exitCode=Number(code)||1;break}
}
