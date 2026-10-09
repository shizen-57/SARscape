import {spawnSync} from 'node:child_process'
import {mkdir,readFile,writeFile,readdir,copyFile,rm} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {join} from 'node:path'
import {build} from 'esbuild'
const root=fileURLToPath(new URL('../',import.meta.url)),frontend=join(root,'frontend')
for(const args of [['../node_modules/typescript/bin/tsc','-b'],['../node_modules/vite/bin/vite.js','build']]){const result=spawnSync(process.execPath,args,{cwd:frontend,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1)}
// Only generated directories below the verified project root are cleaned.
await rm(join(root,'dist'),{recursive:true,force:true})
await mkdir(join(root,'dist/server'),{recursive:true});await mkdir(join(root,'dist/client'),{recursive:true});await mkdir(join(root,'dist/.openai'),{recursive:true})
await build({entryPoints:[join(root,'backend/src/worker.mjs')],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:join(root,'dist/server/api.js'),minify:true})
const assets={}
async function copyAssets(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const source=join(dir,entry.name),relative=prefix+entry.name;if(entry.isDirectory()){await mkdir(join(root,'dist/client',relative),{recursive:true});await copyAssets(source,relative+'/')}else{const bytes=await readFile(source);assets['/'+relative]={base64:bytes.toString('base64'),type:relative.endsWith('.html')?'text/html; charset=utf-8':relative.endsWith('.css')?'text/css':/\.m?js$/.test(relative)?'text/javascript':relative.endsWith('.woff2')?'font/woff2':relative.endsWith('.png')?'image/png':'application/octet-stream'};await copyFile(source,join(root,'dist/client',relative))}}}
await copyAssets(join(frontend,'dist'))
const entry=`import api from './api.js';\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env,ctx){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api.fetch(request,env,ctx);if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}})}};\n`
await writeFile(join(root,'dist/server/index.js'),entry)
try{await copyFile(join(root,'.openai/hosting.json'),join(root,'dist/.openai/hosting.json'))}catch(error){if(error.code!=='ENOENT')throw error}
console.log('Frontend assets and backend Worker built in dist/')
