import type {Map,RasterSourceSpecification} from 'maplibre-gl'
export function requestFrames(entries:{map:Map;id:string;scenarioId:string;source:RasterSourceSpecification}[],options:{onState:(state:'loading'|'ready'|'error')=>void;onCommit:()=>void;timeoutMs?:number;fadeMs?:number;retain?:number}):()=>void
