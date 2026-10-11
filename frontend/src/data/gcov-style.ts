export type TrackInfo={identification?:{trackNumber?:string;orbitPassDirection?:string}}
// Radar tracks view the glacier from different directions, so playback and shading never mix them.
export const trackKey=(o:TrackInfo)=>`${o.identification?.trackNumber??'?'}${o.identification?.orbitPassDirection?.[0]??''}`
export const trackLabel=(key:string)=>`Track ${parseInt(key)||key} ${key.endsWith('A')?'ascending':key.endsWith('D')?'descending':''}`.trim()
export type GcovStyle='shaded'|'natural'|'false'|'grey'
type Colored={colorPreview?:{shaded?:unknown}}
// Image served for a radar date. Styles fall back to the HH grey image when their colour product is missing.
export const gcovImage=(style:GcovStyle,o:Colored)=>style==='grey'||!o.colorPreview?'backscatter':style==='shaded'?(o.colorPreview.shaded?'shaded':'natural'):style==='natural'?'natural':'color'
export const gcovStyleOf=(style:GcovStyle,o:Colored):GcovStyle=>gcovImage(style,o)==='backscatter'?'grey':gcovImage(style,o)==='shaded'?'shaded':style==='shaded'?'natural':style
