import {readdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {join} from 'node:path'
import {pythonExecutable} from '../backend/src/python.mjs'
const root=fileURLToPath(new URL('../',import.meta.url)),files=await readdir(root)
const matches=files.filter(name=>name.startsWith('NISAR_')&&name.endsWith('.h5')&&files.includes(name.slice(0,-3)+'_QA_REPORT.pdf'))
if(matches.length!==1)throw new Error('Place exactly one matching NISAR GOFF .h5 / _QA_REPORT.pdf pair in the project root.')
const child=spawn(pythonExecutable(root),['backend/geo/supplied_study.py','--input',join(root,matches[0]),'--report',join(root,matches[0].slice(0,-3)+'_QA_REPORT.pdf')],{cwd:root,stdio:'inherit',windowsHide:true})
child.on('error',error=>{console.error(error.message);process.exitCode=1});child.on('exit',code=>{process.exitCode=code??1})
