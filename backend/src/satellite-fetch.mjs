// Public Planetary Computer assets use expiring read-only URLs. Keep signatures
// in memory; registered manifests and exported provenance retain unsigned URLs.
export function createSatelliteAccess(fetchImpl=fetch){
 const signed=new Map(),pending=new Map(),containers=new Map(),containerPending=new Map()
 const isAzure=url=>new URL(url).hostname.endsWith('.blob.core.windows.net')
 const containerKey=url=>{const parsed=new URL(url);return parsed.origin+'/'+parsed.pathname.split('/')[1]}
 const fromContainer=url=>{const cached=containers.get(containerKey(url));if(cached?.expires>Date.now()){const parsed=new URL(url);parsed.search=cached.search;return parsed.href}}
 const sign=async url=>{
  if(!isAzure(url))return url
  const shared=fromContainer(url);if(shared)return shared
  const cached=signed.get(url)
  if(cached?.expires>Date.now())return cached.url
  const scope=containerKey(url)
  if(containerPending.has(scope)&&!pending.has(url)){await containerPending.get(scope);const shared=fromContainer(url);if(shared)return shared}
  if(!pending.has(url)){
   const work=(async()=>{
   let response
   for(let attempt=0;attempt<3;attempt++){
    response=await fetchImpl('https://planetarycomputer.microsoft.com/api/sas/v1/sign?href='+encodeURIComponent(url),{signal:AbortSignal.timeout(15000)})
    if(response.ok||!(response.status===429||response.status>=500)||attempt===2)break
    const retry=Number(response.headers.get('retry-after'));await response.body?.cancel()
    await new Promise(resolve=>setTimeout(resolve,Number.isFinite(retry)&&retry>0?Math.min(retry*1000,60000):250*2**attempt))
   }
   if(!response.ok)throw new Error(`Satellite access service returned ${response.status}`)
   const data=await response.json(),original=new URL(url),result=new URL(data.href)
   if(result.protocol!=='https:'||result.hostname!==original.hostname||result.pathname!==original.pathname)throw new Error('Unexpected signed satellite asset')
   const expiry=Date.parse(result.searchParams.get('se')??''),expires=Math.min(Date.now()+10*60*1000,Number.isFinite(expiry)?expiry-60000:Infinity)
   signed.set(url,{url:data.href,expires})
   if(result.searchParams.get('sr')==='c')containers.set(scope,{search:result.search,expires})
   return data.href
   })().finally(()=>{pending.delete(url);if(containerPending.get(scope)===work)containerPending.delete(scope)})
   pending.set(url,work);if(!containerPending.has(scope))containerPending.set(scope,work)
  }
  return pending.get(url)
 }
 return {
  sign,
  fetch:async(url,options)=>{
   const response=await fetchImpl(await sign(url),options)
   if(response.status!==403||!isAzure(url))return response
   await response.body?.cancel();signed.delete(url);containers.delete(containerKey(url))
   return fetchImpl(await sign(url),options)
  }
 }
}
export const satelliteAccess=createSatelliteAccess()
