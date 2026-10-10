// Bound upstream traffic during map navigation and comparison. The timeout starts
// after a download slot is available, and covers both headers and image bytes.
export function createAerialReader(fetchUpstream=fetch,{concurrency=6,timeoutMs=15000,retryDelayMs=250}={}){
 let active=0
 const waiting=[]
 const limited=async work=>{
  if(active>=concurrency)await new Promise(resolve=>waiting.push(resolve))
  else active++
  try{return await work()}
  finally{const next=waiting.shift();if(next)next();else active--}
 }
 return (year,z,x,y)=>limited(async()=>{
  const tile=`${year}/3857/${z}/${x}/${y}.jpeg`
  for(let attempt=0;attempt<3;attempt++){
   try{
    const response=await fetchUpstream(`https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/${tile}`,{signal:AbortSignal.timeout(timeoutMs)})
    if(!response.ok){
     await response.body?.cancel()
     const error=new Error(`Aerial imagery returned ${response.status}`)
     error.retryable=response.status===408||response.status===429||response.status>=500
     throw error
    }
    const bytes=new Uint8Array(await response.arrayBuffer())
    if(bytes.length<4||bytes[0]!==255||bytes[1]!==216){
     const error=new Error('Aerial service did not return a JPEG')
     error.retryable=false
     throw error
    }
    return bytes
   }catch(error){
    if(error.retryable===false||attempt===2)throw new Error(`Swiss aerial tile ${tile}: ${error.message}`,{cause:error})
    await new Promise(resolve=>setTimeout(resolve,retryDelayMs*2**attempt))
   }
  }
 })
}
