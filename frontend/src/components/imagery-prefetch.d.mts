export type PrefetchOptions={frames:{id:string}[];step:number;tiles:string[];fetchTile?:typeof fetch;delayMs?:number}
export function prefetchCaptures(options:PrefetchOptions):()=>void
export function createCaptureWarmer(start?:typeof prefetchCaptures):{warm(options:PrefetchOptions):void;cancel():void}
