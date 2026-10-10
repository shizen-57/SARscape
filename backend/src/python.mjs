import {existsSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'
export function pythonExecutable(root){
 const local=join(root,'backend','.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python')
 const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
 return process.env.SARSCAPE_PYTHON??(existsSync(local)?local:existsSync(bundled)?bundled:'python')
}
