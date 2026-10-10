import test from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {superviseBackend} from '../scripts/backend-supervisor.mjs'
import {spawn} from 'node:child_process'
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,dirname,basename} from 'node:path'

const turn=()=>new Promise(resolve=>setTimeout(resolve,10))
function fixture(){
 const children=[],watched=new Map(),messages=[],launches=new EventEmitter();let closed=0
 const supervisor=superviseBackend({root:'.',retryDelayMs:0,debounceMs:0,log:message=>messages.push(message),
  watchDirectory:(folder,callback)=>{watched.set(folder.replaceAll('\\','/'),callback);return {close:()=>closed++}},
  spawnChild:(_exe,args,options)=>{assert.deepEqual(args,['backend/src/server.mjs']);assert.equal(options.windowsHide,true);assert.equal(options.stdio[3],'ipc');const child=Object.assign(new EventEmitter(),{pid:children.length+1,connected:true,send(message){assert.equal(message.type,'shutdown');queueMicrotask(()=>this.emit('exit',0))},kill(){assert.fail('Healthy backend receives a graceful IPC shutdown')}});children.push(child);launches.emit('launch');return child}
 })
 return {supervisor,children,watched,messages,closed:()=>closed,waitForStarts:count=>children.length>=count?Promise.resolve():new Promise(resolve=>{const ready=()=>{if(children.length>=count){launches.off('launch',ready);resolve()}};launches.on('launch',ready)})}
}
test('backend recovers after an unexpected exit without requiring another file edit',{timeout:2000},async()=>{
 const f=fixture()
 try{f.children[0].emit('exit',1);await f.waitForStarts(2);assert.equal(f.children.length,2);assert.match(f.messages[0],/restarting/)}finally{await f.supervisor.close()}
 await turn();assert.equal(f.children.length,2);assert.equal(f.closed(),4)
})
test('processed data cannot trigger reloads; source edit bursts cause one graceful restart',{timeout:2000},async()=>{
 const f=fixture()
 try{
  f.watched.get('database')('change','sarscape.sqlite-wal');f.watched.get('backend/geo')('change','__pycache__');await turn();assert.equal(f.children.length,1)
  f.watched.get('backend/src')('change','server.mjs');f.watched.get('backend/src')('change','server.mjs');f.watched.get('backend/geo')('change','optical_tiles.py')
  await f.waitForStarts(2);assert.equal(f.children.length,2);assert.match(f.messages[0],/Reloading backend/)
 }finally{await f.supervisor.close()}
})
test('stopping during crash backoff prevents a later restart',async()=>{
 const f=fixture();f.children[0].emit('exit',1);await f.supervisor.close();await turn();assert.equal(f.children.length,1);assert.equal(f.closed(),4)
})

test('real backend process recovers after a fatal exit and shuts down through IPC',{timeout:10000},async()=>{
 const root=await mkdtemp(join(tmpdir(),'sarscape-supervisor-'))
 const owned=await realpath(root)
 assert.equal(dirname(owned),await realpath(tmpdir()));assert.match(basename(owned),/^sarscape-supervisor-/)
 for(const folder of ['backend/src','backend/geo','database/imagery'])await mkdir(join(root,folder),{recursive:true})
 await writeFile(join(root,'backend/src/server.mjs'),`import {createServer} from 'node:http';
 const server=createServer((req,res)=>{if(req.url==='/crash'){process.exit(9)}else{res.end('ready')}});
 server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.on('message',message=>{if(message.type==='shutdown')server.close(()=>process.exit(0))});`)
 const ready=[],listeners=[]
 const nextReady=()=>ready.length?Promise.resolve(ready.shift()):new Promise(resolve=>listeners.push(resolve))
 const supervisor=superviseBackend({root,retryDelayMs:0,log:()=>{},spawnChild:(exe,args,options)=>{
  const child=spawn(exe,args,{...options,stdio:['ignore','ignore','ignore','ipc']})
  child.on('message',message=>{const listener=listeners.shift();if(listener)listener(message.port);else ready.push(message.port)})
  return child
 }})
 try{
  const first=await nextReady();assert.equal(await (await fetch(`http://127.0.0.1:${first}/`)).text(),'ready')
  await assert.rejects(fetch(`http://127.0.0.1:${first}/crash`))
  const recovered=await nextReady();assert.equal(await (await fetch(`http://127.0.0.1:${recovered}/`)).text(),'ready')
 }finally{await supervisor.close();await rm(root,{recursive:true,force:true})}
})
