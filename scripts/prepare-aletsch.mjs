import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {existsSync} from 'node:fs'
const root=fileURLToPath(new URL('../',import.meta.url))
const envFile=join(root,'.env')
if(existsSync(envFile)&&typeof process.loadEnvFile==='function')process.loadEnvFile(envFile)
const bundled=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
const python=process.env.SARSCAPE_PYTHON??(existsSync(bundled)?bundled:'python')
const child=spawn(python,['-u','backend/geo/prepare_aletsch.py',...process.argv.slice(2)],{cwd:root,stdio:'inherit',windowsHide:true})
child.on('error',error=>{console.error('Could not start data preparation:',error.message);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
