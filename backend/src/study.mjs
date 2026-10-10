import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

// The supplied report and prepared products are local, read-only artifacts.
// No request parameter can select an arbitrary path on the user's computer.
export function createSuppliedStudy(root){
 const directory=join(root,'database/processed/supplied-nisar')
 return {async artifact(name){
  if(!/^(summary\.json|presentation\.json|presentation-context\.png|layer[123]\.(json|geojson)|layer[123]-(components\.tif|preview\.tif|provenance\.json)|qa-report\.pdf|qa-page-([1-9]|1[0-9]|2[0-2])\.png)$/.test(name))return null
  try{return new Uint8Array(await readFile(join(directory,name)))}
  catch(error){if(error.code==='ENOENT')return null;throw error}
 }}
}
