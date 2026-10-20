import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createSqliteCache} from '../backend/src/cache.mjs'
import {DatabaseSync} from 'node:sqlite'
test('SQLite cache survives reopen and excludes expired entries',async()=>{const dir=await mkdtemp(join(tmpdir(),'sarscape-db-test-'));let cache;try{cache=createSqliteCache(dir);await cache.set('catalog-v1-aletsch',{records:['example']},60000);await cache.set('expired',{test:true},-1);cache.close();cache=createSqliteCache(dir);assert.deepEqual(await cache.get('catalog-v1-aletsch'),{records:['example']});assert.equal(await cache.get('expired'),null)}finally{cache?.close();assert.ok(dir.startsWith(join(tmpdir(),'sarscape-db-test-')),'Cleanup must stay in its exact temporary test directory');await rm(dir,{recursive:true,force:true})}})

test('TTL is enforced immediately while SQLite expiry sweeps are throttled',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sarscape-db-test-'));let cache,db,time=1000
 try{
  cache=createSqliteCache(dir,{now:()=>time})
  db=new DatabaseSync(join(dir,'sarscape.sqlite'))
  const count=db.prepare('SELECT count(*) AS total FROM response_cache WHERE cache_key = ?')
  await cache.set('initial',{ok:true},120000)
  await cache.set('expired',{source:'dated observation',acquired:'2020-08-01'},1)
  time=1002
  assert.equal(await cache.get('expired'),null)
  await cache.set('tile','unchanged PNG payload',120000)
  assert.equal(count.get('expired').total,1,'Unexpired sweep interval avoids another disk cleanup')
  time=61000;await cache.set('next','next',120000)
  assert.equal(count.get('expired').total,0)
  assert.equal(await cache.get('tile'),'unchanged PNG payload')
 }finally{db?.close();cache?.close();assert.ok(dir.startsWith(join(tmpdir(),'sarscape-db-test-')));await rm(dir,{recursive:true,force:true})}
})
