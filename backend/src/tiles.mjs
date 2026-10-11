export function createTileCache(cache,render){
 const pending=new Map()
 return async(frame,z,x,y,id)=>{
  const key=`optical-tile-v7-${id}-${frame.id}-${z}-${x}-${y}`
  if(!pending.has(key))pending.set(key,(async()=>{
   const cached=await cache.get(key)
   if(cached)return Buffer.from(cached,'base64')
   const bytes=await render(frame,z,x,y,id)
   if(!bytes||bytes.length<8||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw new Error('Raster renderer did not return a PNG')
   await cache.set(key,Buffer.from(bytes).toString('base64'),30*86400000)
   return bytes
  })().finally(()=>pending.delete(key)))
  return pending.get(key)
 }
}
