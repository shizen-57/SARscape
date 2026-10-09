import {useQuery} from '@tanstack/react-query'
import type {FeatureCollection,Polygon} from 'geojson'
export type SampleProperties={id:number;value:number;quality:number;color:string;dateIndex:number;unit:string;synthetic:boolean;source:string;longitude:number;latitude:number}
export type SampleCollection=FeatureCollection<Polygon,SampleProperties>
export type LayerBundle={scenario:string;dates:string[];frames:SampleCollection[];history:Record<number,number[]>;metadata:{synthetic:boolean;unit:string;source:string;qualityThreshold:number|null}}
export const EMPTY_SAMPLES:SampleCollection={type:'FeatureCollection',features:[]}
export function useLayers(scenarioId:string,quality:boolean){return useQuery<LayerBundle>({queryKey:['layers',scenarioId,quality],queryFn:async({signal})=>{const response=await fetch(`/api/layers/${scenarioId}?quality=${quality}`,{signal});if(!response.ok)throw new Error('The backend could not prepare the map layer. Check that it is running, then retry.');return response.json()},staleTime:3600000,gcTime:3600000,retry:1})}
