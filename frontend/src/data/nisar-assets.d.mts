export function readNisarArtifact(name:string,options?:{signal?:AbortSignal;fetcher?:typeof fetch;storage?:CacheStorage|null;retryDelay?:number}):Promise<ArrayBuffer>
