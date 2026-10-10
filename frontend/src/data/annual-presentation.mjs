// Camera and timing are shared by both sides. Only actual observed frames enter
// the dissolve: no geometry deformation, inferred dates or generated ice edges.
export const ANNUAL_VIEWS={tongue:{x:.32,y:.84,span:.58},bend:{x:.56,y:.58,span:.86},whole:{x:.5,y:.5,span:1}}
export function annualState(progress,count){
 const p=Math.max(0,Math.min(1,progress)),position=p*Math.max(0,count-1),lower=Math.floor(position+1e-9),upper=Math.min(count-1,lower+1),fraction=Math.max(0,position-lower)
 // First third holds the acquisition; the remaining two thirds dissolve. A
 // smoothstep has zero velocity at each observed endpoint, avoiding jumps.
 const t=Math.max(0,Math.min(1,(fraction-.3)/.7)),mix=t*t*(3-2*t)
 return {lower,upper,mix,observed:mix===0||mix===1,index:mix===1?upper:lower}
}
export function annualCrop(width,height,manifest,view='tongue',zoom=1){
 const preset=ANNUAL_VIEWS[view]??ANNUAL_VIEWS.tongue,aspect=width/height
 const w=view==='whole'?Math.max(manifest.width,manifest.height*aspect):manifest.width*preset.span/zoom,h=w/aspect
 const x=preset.x*manifest.width-w/2,y=preset.y*manifest.height-h/2
 return {x:w<=manifest.width?Math.max(0,Math.min(manifest.width-w,x)):x,y:h<=manifest.height?Math.max(0,Math.min(manifest.height-h,y)):y,width:w,height:h}
}
export function validateAnnual(manifest){
 if(manifest?.version!==1||manifest.scenario!=='aletsch'||manifest.crs!=='EPSG:3857'||manifest.bounds?.length!==4||!manifest.bounds.every(Number.isFinite)||manifest.bounds[2]<=manifest.bounds[0]||manifest.bounds[3]<=manifest.bounds[1]||!Number.isFinite(manifest.width)||!Number.isFinite(manifest.height)||manifest.width<1||manifest.height<1||!Array.isArray(manifest.frames)||manifest.frames.length<2)throw new Error('Invalid annual imagery grid.')
 const dates=new Set(),ids=new Set()
 for(const [i,frame] of manifest.frames.entries()){
  if(!Number.isFinite(Date.parse(frame.date))||!/^annual-(201[89]|202[0-6])\.png$/.test(frame.image)||frame.image!==`annual-${frame.date.slice(0,4)}.png`||!(/^[a-f0-9]{64}$/.test(frame.imageSha256))||!(/^[a-f0-9]{64}$/.test(frame.inputSha256))||frame.sourceResolutionMeters!==10||dates.has(frame.date)||ids.has(frame.id)||(i&&Date.parse(frame.date)<=Date.parse(manifest.frames[i-1].date)))throw new Error('Annual scenes must be ordered, dated, source-linked 10 m observations.')
  dates.add(frame.date);ids.add(frame.id)
 }
 return manifest
}
export function drawAnnual(ctx,{width,height,manifest,images,state,baseline=0,divider=.5,comparison='paired',view='tongue',zoom=1}){
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#0b1c1b';ctx.fillRect(0,0,width,height)
 const paneWidth=comparison==='paired'?width/2:width,crop=annualCrop(paneWidth,height,manifest,view,zoom)
 const draw=(image,x=0)=>ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,x,0,paneWidth,height)
 const current=(x=0)=>{ctx.save();ctx.beginPath();ctx.rect(x,0,paneWidth,height);ctx.clip();ctx.globalAlpha=1;draw(images[state.lower],x);if(state.mix>0){ctx.globalAlpha=state.mix;draw(images[state.upper],x)}ctx.restore()}
 if(comparison==='paired'){ctx.save();ctx.beginPath();ctx.rect(0,0,paneWidth,height);ctx.clip();draw(images[baseline]);ctx.restore();current(paneWidth)}else current()
 // The baseline occupies the left of the same grid, without any registration
 // change. The divider is only a viewport cut; it is not a glacier boundary.
 if(comparison!=='paired'&&divider>0){ctx.save();ctx.beginPath();ctx.rect(0,0,width*divider,height);ctx.clip();draw(images[baseline]);ctx.restore()}
 const metersPerPixel=(manifest.bounds[2]-manifest.bounds[0])/manifest.width*crop.width/paneWidth*Math.cos(46.45*Math.PI/180),scale=500/metersPerPixel
 ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(width-24-scale,height-24);ctx.lineTo(width-24,height-24);ctx.stroke();ctx.font='11px system-ui';ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=4;ctx.fillText('500 m',width-24-scale,height-32);ctx.shadowBlur=0
}
