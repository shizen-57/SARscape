import {useQuery} from '@tanstack/react-query'
export type ImageryFrame={id:string;date:string;cloudCover:number|null;url:string;metadataUrl:string;platform:string;resolutionMeters:number|null;bbox:number[];tileTemplate?:string;datePrecision?:'mosaic-year'|'undated';attribution?:string}
export type ImagerySequence={source:string;selection:string;retrievedAt:string;frames:ImageryFrame[]}
export function useImagery(id:string,source='sentinel2'){return useQuery({queryKey:['imagery',id,source],queryFn:async({signal})=>{const r=await fetch(`/api/imagery/${id}?source=${source}`,{signal});if(!r.ok)throw new Error('Could not load the observation timeline. Retry.');return r.json() as Promise<ImagerySequence>},staleTime:3600000,retry:1})}
