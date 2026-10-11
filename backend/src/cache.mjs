import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createPayloadCache} from './payload-cache.mjs'
export function createSqliteCache(root,{now=Date.now}={}) {
 mkdirSync(root,{recursive:true})
 const db=new DatabaseSync(join(resolve(root),'sarscape.sqlite'))
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;')
 db.exec(readFileSync(fileURLToPath(new URL('../../database/migrations/001_cache.sql',import.meta.url)),'utf8'))
 const get=db.prepare('SELECT payload, expires_at FROM response_cache WHERE cache_key = ?')
 const put=db.prepare('INSERT INTO response_cache(cache_key,payload,expires_at,created_at) VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,created_at=excluded.created_at')
 const remove=db.prepare('DELETE FROM response_cache WHERE expires_at <= ?')
 const memory=createPayloadCache({now})
 let nextSweep=0
 return {
  async get(key){
   const current=memory.get(key)
   if(current!==null)return current
   const row=get.get(key)
   if(!row||row.expires_at<=now())return null
   const value=JSON.parse(row.payload)
   memory.set(key,value,row.expires_at,Buffer.byteLength(row.payload,'utf8'))
   return value
  },
  async set(key,value,ttl){
   const time=now(),expires=time+ttl,payload=JSON.stringify(value)
   put.run(key,payload,expires,time)
   memory.set(key,value,expires,Buffer.byteLength(payload,'utf8'))
   // Reads still enforce TTL immediately; disk housekeeping runs at most once
   // a minute instead of after every tile written.
   if(time>=nextSweep){remove.run(time);nextSweep=time+60000}
  },
  close(){memory.clear();db.close()}
 }
}
