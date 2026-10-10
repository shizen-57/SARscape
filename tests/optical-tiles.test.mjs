import test from 'node:test'
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {pythonExecutable} from '../backend/src/python.mjs'
test('local optical rendering preserves native study pixels and avoids unnecessary overview downloads',async()=>{
 const {stderr}=await promisify(execFile)(pythonExecutable(process.cwd()),['tests/optical_tiles_test.py'],{timeout:45000,maxBuffer:2*1024*1024})
 assert.match(stderr,/Ran 2 tests/);assert.match(stderr,/OK/)
})
