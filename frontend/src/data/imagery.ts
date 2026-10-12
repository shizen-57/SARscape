import {useQuery} from '@tanstack/react-query'
export type ImagerySource='sentinel2'|'swissimage'|'reference'
import {hasDisplayDate} from './observation-date.mjs'
export type ImageryFrame={id:string;date:string;label?:string;cloudCover:number|null;url:string;metadataUrl:string;platform:string;resolutionMeters:number|null;bbox:number[];tileTemplate?:string;datePrecision?:'mosaic-year'|'acquisition'|'undated';attribution?:string}
export type ImagerySequence={source:string;selection:string;retrievedAt:string;eventUrl?:string;frames:ImageryFrame[]}
export function useImagery(id:string,source='sentinel2'){return useQuery({queryKey:['imagery',id,source],queryFn:async({signal})=>{const r=await fetch(`/api/imagery/${id}?source=${source}`,{signal});if(!r.ok)throw new Error('Could not load the observation timeline. Retry.');const data=await r.json() as ImagerySequence;const frames=data.frames.filter(hasDisplayDate);if(!frames.length)throw new Error('No dated imagery is available for this study area.');return {...data,frames}},staleTime:3600000,retry:1})}
