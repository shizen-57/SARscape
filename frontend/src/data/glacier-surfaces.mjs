// Shared scientific operations. No temporal interpolation or extrapolation of measurements.
export const VELOCITY_STOPS=[[0,[20,12,72]],[.15,[74,35,171]],[.35,[155,49,218]],[.6,[236,57,115]],[.8,[250,139,48]],[1,[255,226,90]]]
export const CHANGE_STOPS=[[0,[213,61,58]],[.5,[240,243,245]],[1,[36,124,180]]]
export function surfaceColor(value,range,stops=VELOCITY_STOPS){
 const at=Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0])))
 for(let i=1;i<stops.length;i++)if(at<=stops[i][0]){const [a,x]=stops[i-1],[b,y]=stops[i],t=(at-a)/(b-a);return x.map((v,k)=>Math.round(v+(y[k]-v)*t))}
 return stops.at(-1)[1]
}
export function differenceGrid(current,baseline){
 if(!current||!baseline||JSON.stringify(current.shape)!==JSON.stringify(baseline.shape)||JSON.stringify(current.bounds3857)!==JSON.stringify(baseline.bounds3857))return null
 return current.speed.map((v,i)=>Number.isFinite(v)&&Number.isFinite(baseline.speed[i])?v-baseline.speed[i]:null)
}
export function mercator(lon,lat){const R=6378137;return [R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))]}
export function surfaceCell(grid,lon,lat){
 const [x,y]=mercator(lon,lat),[w,s,e,n]=grid.bounds3857,[rows,cols]=grid.shape
 const col=Math.floor((x-w)/(e-w)*cols),row=Math.floor((n-y)/(n-s)*rows)
 if(col<0||row<0||col>=cols||row>=rows)return null
 const index=row*cols+col
 return {index,speed:grid.speed[index],error:grid.error?.[index],vx:grid.vx?.[index],vy:grid.vy?.[index]}
}
export function inspectSurfacePoint(scene,lon,lat){
 const outline=scene.outlines.features[scene.outlineIndex]
 const inside=outline?insideOutline([lon,lat],outline.geometry):false
 const cell=scene.grid?surfaceCell(scene.grid,lon,lat):null
 const result={longitude:lon,latitude:lat,insideOutline:inside,outlineYear:outline?.properties.year??null,index:cell?.index??null}
 if(scene.mode==='extent')return {...result,areaKm2:inside?outline?.properties.areaKm2??null:null}
 if(!cell)return {...result,status:'outside-grid'}
 if(scene.mode==='elevation'){
  const value=scene.grid?.elevationChange?.[cell.index]
  return {...result,status:Number.isFinite(value)?'measured':'missing',elevationChange:Number.isFinite(value)?value:null}
 }
 const speed=Number.isFinite(cell.speed)&&cell.speed>=0?cell.speed:null
 const error=Number.isFinite(cell.error)&&cell.error>=0?cell.error:null
 if(scene.mode==='velocity')return {...result,status:speed===null?'missing':'measured',speed,error}
 const baseCell=scene.baselineGrid?surfaceCell(scene.baselineGrid,lon,lat):null
 const baselineSpeed=Number.isFinite(baseCell?.speed)&&baseCell.speed>=0?baseCell.speed:null
 const baselineError=Number.isFinite(baseCell?.error)&&baseCell.error>=0?baseCell.error:null
 const difference=speed!==null&&baselineSpeed!==null?speed-baselineSpeed:null
 return {...result,status:difference===null?'missing':'measured',speed,error,baselineSpeed,baselineError,difference}
}
export function pointInRing(point,ring){
 let inside=false;const [x,y]=point
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i],[c,d]=ring[j]
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside
 }
 return inside
}
export function insideOutline(point,geometry){
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates
 return polygons.some(p=>pointInRing(point,p[0])&&!p.slice(1).some(r=>pointInRing(point,r)))
}
