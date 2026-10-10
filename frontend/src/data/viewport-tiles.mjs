// MapLibre's public coveringTiles result includes canonical tiles at mixed zooms.
export function viewportTemplates(tiles,frame,scenario,origin){
 const bounds=scenario.imageryExtent??scenario.extent
 return [...new Set(tiles.flatMap(({canonical:{z,x,y}})=>{
  const n=2**z,lat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI
  const w=x/n*360-180,e=(x+1)/n*360-180,north=lat(y),south=lat(y+1)
  if(e<=bounds[0]||w>=bounds[2]||north<=bounds[1]||south>=bounds[3])return []
  const template=frame.tileTemplate?frame.tileTemplate.replace(`/${frame.id}/`,'/{frame}/'):`/api/imagery/tiles/${scenario.id}/{frame}/{z}/{x}/{y}.png?v=9`
  return [new URL(template.replace('{z}',String(z)).replace('{x}',String(x)).replace('{y}',String(y)),origin).href.replace(/%7Bframe%7D/gi,'{frame}')]
 }))]
}
