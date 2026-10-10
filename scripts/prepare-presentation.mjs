import {spawn} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {pythonExecutable} from '../backend/src/python.mjs'
const root=fileURLToPath(new URL('../',import.meta.url))
const child=spawn(pythonExecutable(root),['backend/geo/presentation.py'],{cwd:root,stdio:'inherit',windowsHide:true})
child.on('error',error=>{console.error(error.message);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
