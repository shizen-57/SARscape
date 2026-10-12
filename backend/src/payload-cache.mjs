// Limit retained serialized payload bytes as well as entries. This is a payload
// budget, not an estimate of total JavaScript heap usage.
export function createPayloadCache({maxBytes=16*1024*1024,maxEntries=32,now=Date.now}={}){
 const entries=new Map();let bytes=0
 const remove=key=>{const entry=entries.get(key);if(entry){bytes-=entry.bytes;entries.delete(key)}}
 return {
  get(key){
   const entry=entries.get(key)
   if(!entry)return null
   if(entry.expires<=now()){remove(key);return null}
   entries.delete(key);entries.set(key,entry)
   return entry.value
  },
  set(key,value,expires,size){
   remove(key)
   if(expires<=now()||size>maxBytes||maxEntries<=0)return
   // Reclaim expired entries before evicting live, recently used payloads.
   for(const [id,entry] of entries)if(entry.expires<=now())remove(id)
   while(entries.size&&(entries.size>=maxEntries||bytes+size>maxBytes))remove(entries.keys().next().value)
   entries.set(key,{value,expires,bytes:size});bytes+=size
  },
  clear(){entries.clear();bytes=0}
 }
}
