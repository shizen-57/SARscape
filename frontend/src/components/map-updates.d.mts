import type {Feature,Polygon} from 'geojson'
import type {Map} from 'maplibre-gl'
export function setExtent(source:{setData(data:Feature<Polygon>):unknown},bounds:readonly number[]):boolean
export function setVisibility(map:Pick<Map,'getLayer'|'getLayoutProperty'|'setLayoutProperty'>,id:string,visible:boolean):void
