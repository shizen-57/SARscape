export type TrackInfo={identification?:{trackNumber?:string;orbitPassDirection?:string}}
// Radar tracks view the glacier from different directions, so playback and shading never mix them.
export const trackKey=(o:TrackInfo)=>`${o.identification?.trackNumber??'?'}${o.identification?.orbitPassDirection?.[0]??''}`
export const trackLabel=(key:string)=>`Track ${parseInt(key)||key} ${key.endsWith('A')?'ascending':key.endsWith('D')?'descending':''}`.trim()
export type GcovStyle='terrain'|'shaded'|'natural'|'false'|'grey'
type Colored={colorPreview?:{terrain?:unknown;shaded?:unknown}}
// File served for a radar date. A style whose product is missing falls back to the next radar-driven one, then HH grey.
export const gcovImage=(style:GcovStyle,o:Colored)=>style==='grey'||!o.colorPreview?'backscatter.png':style==='terrain'?(o.colorPreview.terrain?'terrain.webp':'natural.png'):style==='shaded'?(o.colorPreview.shaded?'shaded.png':'natural.png'):style==='natural'?'natural.png':'color.png'
const STYLE_OF:Record<string,GcovStyle>={'backscatter.png':'grey','terrain.webp':'terrain','shaded.png':'shaded','natural.png':'natural','color.png':'false'}
export const gcovStyleOf=(style:GcovStyle,o:Colored):GcovStyle=>STYLE_OF[gcovImage(style,o)]
