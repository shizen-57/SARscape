import {DatabaseSync} from 'node:sqlite'
import {mkdirSync,readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
export function createSqliteCache(root) {
 mkdirSync(root,{recursive:true})
 const db=new DatabaseSync(join(resolve(root),'sarscape.sqlite'))
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;')
 db.exec(readFileSync(fileURLToPath(new URL('../../database/migrations/001_cache.sql',import.meta.url)),'utf8'))
 const get=db.prepare('SELECT payload, expires_at FROM response_cache WHERE cache_key = ?')
 const put=db.prepare('INSERT INTO response_cache(cache_key,payload,expires_at,created_at) VALUES(?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at,created_at=excluded.created_at')
 const remove=db.prepare('DELETE FROM response_cache WHERE expires_at <= ?')
 const memory=new Map()
 return {
  async get(key){const current=memory.get(key);if(current?.expires>Date.now())return current.value;const row=get.get(key);if(row&&row.expires_at>Date.now()){const value=JSON.parse(row.payload);if(memory.size>=32)memory.delete(memory.keys().next().value);memory.set(key,{value,expires:row.expires_at});return value}return null},
  async set(key,value,ttl){const now=Date.now(),entry={value,expires:now+ttl};if(memory.size>=32)memory.delete(memory.keys().next().value);memory.set(key,entry);put.run(key,JSON.stringify(value),entry.expires,now);remove.run(now)},
  close(){db.close()}
 }
}
