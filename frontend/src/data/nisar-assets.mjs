const base='/api/science/study/supplied/'
const valid=(name,bytes)=>{
 if(name.endsWith('.json'))JSON.parse(new TextDecoder().decode(bytes))
 else {const signature=new Uint8Array(bytes);if(signature.length<8||[137,80,78,71,13,10,26,10].some((v,i)=>signature[i]!==v))throw new Error('The presentation asset is not a complete PNG response.')}
}
export async function readNisarArtifact(name,{signal,fetcher=fetch,storage=typeof caches==='undefined'?null:caches,retryDelay=500}={}){
 if(!/^(summary\.json|presentation\.json|presentation-context\.png|layer[123]\.json|qa-page-(2|5|8|11|13|15|17|19|21)\.png)$/.test(name))throw new Error('Unknown presentation asset.')
 const url=base+name;let disk
 try{disk=await storage?.open('sarscape-nisar-stage-v1');const response=await disk?.match(url);if(response&&Number(response.headers.get('x-stage-expires'))>Date.now()){const bytes=await response.arrayBuffer();valid(name,bytes);return bytes}}catch{}
 for(let attempt=0;attempt<3;attempt++){
  if(signal?.aborted)throw signal.reason
  try{
   const deadline=AbortSignal.timeout(20000),response=await fetcher(url,{signal:signal?AbortSignal.any([signal,deadline]):deadline,cache:attempt?'reload':'no-cache'})
   if(!response.ok){const error=new Error(`Presentation asset ${name} returned ${response.status}. Run npm run science:study and npm run science:presentation.`);error.permanent=response.status>=400&&response.status<500&&![408,429].includes(response.status);await response.body?.cancel();throw error}
   const bytes=await response.arrayBuffer();valid(name,bytes)
   try{await disk?.put(url,new Response(bytes,{headers:{'Content-Type':name.endsWith('.json')?'application/json':'image/png','x-stage-expires':String(Date.now()+30*86400000)}}))}catch{}
   return bytes
  }catch(error){if(signal?.aborted||error.permanent||attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,retryDelay*2**attempt))}
 }
}
