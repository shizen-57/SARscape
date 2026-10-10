import {mercator,cellKey} from './nisar-presentation.mjs'

// A rotated, flat geographic plane. Optical texture and cell coordinates stay
// fixed; no radar component is treated as a geographic motion vector.
export function geographicTransform(width,height,bounds){
 const worldW=bounds[2]-bounds[0],worldH=bounds[3]-bounds[1],angle=-.40,c=Math.cos(angle),s=Math.sin(angle),squish=.78
 const scale=Math.min((width-70)/(Math.abs(c)*worldW+Math.abs(s)*worldH*squish),(height-65)/(Math.abs(s)*worldW+Math.abs(c)*worldH*squish))
 const a=c*scale,b=s*scale,cc=-s*scale*squish,d=c*scale*squish
 return {a,b,c:cc,d,project(world){const x=world[0]-(bounds[0]+bounds[2])/2,y=(bounds[1]+bounds[3])/2-world[1];return [width/2+a*x+cc*y,height/2+b*x+d*y]}}
}
export function radarPosition(cell,progress,width,height,model){return [width/2+cell[4]*progress/model.aScale*(width*.38),height/2-cell[5]*progress/model.sScale*(height*.33)]}
export function drawBase(ctx,{width,height,context,image,view,model,extent}){
 ctx.clearRect(0,0,width,height)
 const bg=ctx.createRadialGradient(width*.5,height*.5,0,width*.5,height*.5,width*.75);bg.addColorStop(0,'#163036');bg.addColorStop(1,'#071114');ctx.fillStyle=bg;ctx.fillRect(0,0,width,height)
 ctx.strokeStyle='#aacbc910';ctx.lineWidth=1
 for(let x=0;x<width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
 for(let y=0;y<height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
 if(view==='geographic'){
  const t=geographicTransform(width,height,context.bounds),w=context.bounds[2]-context.bounds[0],h=context.bounds[3]-context.bounds[1]
  ctx.save();ctx.translate(width/2,height/2);ctx.transform(t.a,t.b,t.c,t.d,0,0);ctx.shadowColor='#000b';ctx.shadowBlur=28;ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore()
  ctx.fillStyle='#06141625';ctx.fillRect(0,0,width,height)
  const [west,south,east,north]=extent,corners=[[west,north],[east,north],[east,south],[west,south]].map(p=>t.project(mercator(...p)))
  ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.strokeStyle='#a5f0db';ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([])
  const top=corners[0],labelX=Math.max(12,top[0]-20),labelY=Math.max(24,top[1]-12);ctx.fillStyle='#092822e0';ctx.fillRect(labelX-5,labelY-14,136,20);ctx.fillStyle='#cdf2e8';ctx.font='11px system-ui';ctx.fillText('NISAR study footprint',labelX,labelY)
  const northLength=Math.hypot(t.c,t.d),nx=-t.c/northLength,ny=-t.d/northLength,ax=width-29,ay=43
  ctx.fillStyle='#c4ded7';ctx.fillText('N',width-31,27);ctx.beginPath();ctx.moveTo(ax+nx*11,ay+ny*11);ctx.lineTo(ax-nx*8+ny*5,ay-ny*8-nx*5);ctx.lineTo(ax-nx*8-ny*5,ay-ny*8+nx*5);ctx.closePath();ctx.fill()
 }else{
  ctx.strokeStyle='#d8ece650';ctx.beginPath();ctx.moveTo(width*.08,height/2);ctx.lineTo(width*.92,height/2);ctx.moveTo(width/2,height*.10);ctx.lineTo(width/2,height*.88);ctx.stroke()
  ctx.font='11px system-ui';ctx.fillStyle='#a9c3c1';ctx.textAlign='center'
  for(const f of [-1,-.5,0,.5,1]){const x=width/2+f*width*.38,y=height/2-f*height*.33;ctx.fillText(String(Math.round(f*model.aScale)),x,height/2+19);if(f)ctx.fillText(String(Math.round(f*model.sScale)),width/2+24,y+4)}
  ctx.fillText('ALONG-TRACK OFFSET · m',width/2,height-22);ctx.save();ctx.translate(18,height/2);ctx.rotate(-Math.PI/2);ctx.fillText('SLANT-RANGE OFFSET · m',0,0);ctx.restore();ctx.textAlign='left'
 }
}
export function drawSignal(ctx,{width,height,context,model,progress,selected,view,chapter,reveal}){
 ctx.clearRect(0,0,width,height)
 const transform=geographicTransform(width,height,context.bounds),markers=[]
 if(view==='radar'){
  ctx.fillStyle='#c6e8dc24'
  for(const point of model.points){const end=radarPosition(point.cell,1,width,height,model);ctx.fillRect(end[0]-1,end[1]-1,2,2)}
  ctx.strokeStyle='#dbe9ce70';ctx.lineWidth=1;ctx.beginPath();ctx.arc(width/2,height/2,7,0,Math.PI*2);ctx.stroke()
  ctx.font='11px system-ui';ctx.fillStyle='#c4d4c4';ctx.fillText('REFERENCE / ZERO',width/2+13,height/2-12)
  ctx.fillStyle='#90aaa2';ctx.fillText('Pale dots: measured endpoints',24,24)
 }
 const radius=view==='radar'?1.55:Math.max(.9,Math.min(2.3,width/420))
 for(const group of model.groups){
  const t=group.t*progress,target=group.negative?[242,128,157]:[86,224,218]
  ctx.fillStyle=`rgba(${Math.round(209+(target[0]-209)*t)},${Math.round(235+(target[1]-235)*t)},${Math.round(228+(target[2]-228)*t)},${chapter===0?.26:.78})`
  // Small source-cell glyphs avoid expensive overlapping vector paths. Palette
  // groups reduce state changes without changing the original cell positions.
  for(const point of group.points){const p=view==='radar'?radarPosition(point.cell,progress,width,height,model):transform.project(point.world);ctx.fillRect(p[0]-radius,p[1]-radius,radius*2,radius*2);markers.push({cell:point.cell,x:p[0],y:p[1]})}
 }
 if(chapter===0){const y=height*.2+reveal*height*.6;const glow=ctx.createLinearGradient(0,y-26,0,y+26);glow.addColorStop(0,'#8ce8de00');glow.addColorStop(.5,'#8ce8de38');glow.addColorStop(1,'#8ce8de00');ctx.fillStyle=glow;ctx.fillRect(0,y-26,width,52);ctx.strokeStyle='#8ce8de65';ctx.beginPath();ctx.moveTo(width*.12,y);ctx.lineTo(width*.88,y);ctx.stroke()}
 const key=cellKey(selected),point=markers.find(p=>cellKey(p.cell)===key)
 if(point){
  if(view==='radar'){
   const end=radarPosition(selected,1,width,height,model),start=[width/2,height/2]
   ctx.strokeStyle='#e8ead980';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();ctx.setLineDash([])
   ctx.strokeStyle='#fff5c6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...start);ctx.lineTo(point.x,point.y);ctx.stroke()
   const dx=point.x-start[0],dy=point.y-start[1],length=Math.hypot(dx,dy)
   if(length>12){const ux=dx/length,uy=dy/length;ctx.beginPath();ctx.moveTo(point.x,point.y);ctx.lineTo(point.x-ux*10+uy*5,point.y-uy*10-ux*5);ctx.lineTo(point.x-ux*10-uy*5,point.y-uy*10+ux*5);ctx.closePath();ctx.fillStyle='#fff5c6';ctx.fill()}
   // Reference and endpoint are explicit anchors. This arrow belongs to radar
   // component space, not the optical map's geographic coordinate system.
   ctx.font='12px system-ui';ctx.fillStyle='#f4ebc6';ctx.fillText(`SELECTED CELL / ${(progress*100).toFixed(0)}% OF PAIR OFFSET`,24,height-67)
   ctx.font='bold 17px system-ui';ctx.fillText(`Along ${(Number(selected[4])*progress).toFixed(1)} m  /  Slant ${(Number(selected[5])*progress).toFixed(1)} m`,24,height-43)
   // Formal uncertainty belongs to the observed endpoint, never a new observation.
   const ex=selected[6]/model.aScale*width*.38,ey=selected[7]/model.sScale*height*.33
   ctx.strokeStyle='#fff5c6a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(end[0]-ex,end[1]);ctx.lineTo(end[0]+ex,end[1]);ctx.moveTo(end[0],end[1]-ey);ctx.lineTo(end[0],end[1]+ey);ctx.stroke()
  }
  ctx.strokeStyle='#fff3b8';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(point.x,point.y,8,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(point.x,point.y,3,0,Math.PI*2);ctx.fillStyle='#fff3b8';ctx.fill();ctx.lineWidth=1
 }
 return markers
}
export function pickCell(markers,x,y,radius=15){let best=null,distance=radius*radius;for(const point of markers){const d=(point.x-x)**2+(point.y-y)**2;if(d<distance){best=point.cell;distance=d}}return best}
