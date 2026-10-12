// Key by the actual source: recreated maps/sources must receive their data even
// when their bounds match the previous view. Weak keys release removed sources.
const extents=new WeakMap()
export function setExtent(source,bounds){
 const previous=extents.get(source)
 if(previous&&previous.every((value,index)=>value===bounds[index]))return false
 const [w,s,e,n]=bounds
 source.setData({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}})
 extents.set(source,[...bounds])
 return true
}
export function setVisibility(map,id,visible){
 const value=visible?'visible':'none'
 if(!map.getLayer(id)||map.getLayoutProperty(id,'visibility')===value)return
 map.setLayoutProperty(id,'visibility',value)
}
