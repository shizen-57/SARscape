import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createSqliteCache} from '../backend/src/cache.mjs'
test('SQLite cache survives reopen and excludes expired entries',async()=>{const dir=await mkdtemp(join(tmpdir(),'sarscape-db-test-'));let cache;try{cache=createSqliteCache(dir);await cache.set('catalog-v1-aletsch',{records:['example']},60000);await cache.set('expired',{test:true},-1);cache.close();cache=createSqliteCache(dir);assert.deepEqual(await cache.get('catalog-v1-aletsch'),{records:['example']});assert.equal(await cache.get('expired'),null)}finally{cache?.close();assert.ok(dir.startsWith(join(tmpdir(),'sarscape-db-test-')),'Cleanup must stay in its exact temporary test directory');await rm(dir,{recursive:true,force:true})}})
