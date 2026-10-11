// Only registered public COGs are addressable; never accept arbitrary upstream URLs.
export function createCogReader(fetchUpstream=fetch){
 const pending=new Map(),pendingChunks=new Map()
 const chunks=new Map();let cacheBytes=0,active=0;const waiting=[]
 const limited=async work=>{if(active>=12)await new Promise(resolve=>waiting.push(resolve));active++;try{return await work()}finally{active--;waiting.shift()?.()}}
 const readChunk=async(url,start,end)=>{
  const key=`${url}:${start}-${end}`
  if(chunks.has(key)){const result=chunks.get(key);chunks.delete(key);chunks.set(key,result);return result}
  // Different range requests often overlap. Share their chunk fetches too,
  // including those waiting for an upstream concurrency slot.
  if(pendingChunks.has(key))return pendingChunks.get(key)
  const job=limited(async()=>{
   const response=await fetchUpstream(url,{headers:{Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(15000)})
   if(response.status!==206)throw new Error('Satellite server did not honor a range')
   const bytes=new Uint8Array(await response.arrayBuffer()),length=Number(response.headers.get('content-length'))
   if(bytes.length!==end-start+1||length!==bytes.length)throw new Error('Incomplete satellite byte range')
   const result={bytes,contentRange:response.headers.get('content-range'),etag:response.headers.get('etag')}
   while(cacheBytes+bytes.length>32*1024*1024&&chunks.size){const key=chunks.keys().next().value;cacheBytes-=chunks.get(key).bytes.length;chunks.delete(key)}
   chunks.set(key,result);cacheBytes+=bytes.length;return result
  }).finally(()=>pendingChunks.delete(key))
  pendingChunks.set(key,job)
  return job
 }
 return async(frame,method,range)=>{
  if(method!=='HEAD'){
   const match=/^bytes=(\d+)-(\d+)$/.exec(range??'')
   if(!match||Number(match[2])<Number(match[1])||Number(match[2])-Number(match[1])>=16*1024*1024)return new Response('A bounded byte range is required',{status:416})
  }
  const key=`${frame.id}:${method}:${range??''}`
  if(!pending.has(key))pending.set(key,(async()=>{
   for(let attempt=0;attempt<2;attempt++){
    try{
     if(method==='GET'){
      const [,startText,endText]=/^bytes=(\d+)-(\d+)$/.exec(range),start=Number(startText),end=Number(endText),parts=[]
      for(let offset=start;offset<=end;offset+=65536)parts.push([offset,Math.min(offset+65535,end)])
      const results=await Promise.all(parts.map(([s,e])=>readChunk(frame.url,s,e)))
      const bytes=new Uint8Array(end-start+1);let offset=0
      for(const result of results){bytes.set(result.bytes,offset);offset+=result.bytes.length}
      const total=results[0].contentRange?.split('/')[1]
      if(!total)throw new Error('Satellite server omitted the range size')
      return {bytes,status:206,headers:new Headers({'Content-Type':'image/tiff','Content-Length':String(bytes.length),'Content-Range':`bytes ${start}-${end}/${total}`,'Accept-Ranges':'bytes','Cache-Control':'public,max-age=86400'})}
     }
     const response=await fetchUpstream(frame.url,{method,signal:AbortSignal.timeout(15000)})
     if(response.status!==(method==='HEAD'?200:206))throw new Error('COG byte-range access failed')
     const headers=new Headers()
     for(const name of ['content-type','content-length','content-range','accept-ranges','etag'])if(response.headers.has(name))headers.set(name,response.headers.get(name))
     headers.set('Cache-Control','public,max-age=86400')
     const bytes=method==='HEAD'?null:new Uint8Array(await response.arrayBuffer())
     if(bytes&&headers.has('content-length')&&bytes.length!==Number(headers.get('content-length')))throw new Error('Incomplete satellite byte range')
     return {bytes,status:response.status,headers}
    }catch(error){if(attempt===1)throw error}
   }
  })().finally(()=>pending.delete(key)))
  const result=await pending.get(key)
  return new Response(result.bytes,{status:result.status,headers:result.headers})
 }
}
