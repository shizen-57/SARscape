import {useEffect,useRef,useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {LoaderCircle,Send,Trash2} from 'lucide-react'
import {Button} from './ui'
export type ChatMessage={role:'user'|'assistant';content:string;actions?:string[];error?:boolean}
export type AssistantAction={action:string;value?:string}
const RADAR_SUGGESTIONS=['Which radar dates do we have?','Why is the motion quality low?','Play the radar dates over the aerial photo','What does the false colour mean?']
const FLOOD_SUGGESTIONS=['Show the Sentinel-2 dates for this flood.','What changes are visible between captures?','Play the dated optical images.','What can these images tell us about flooding?']
const describe=(a:AssistantAction)=>a.action.replaceAll('_',' ')+(a.value?` · ${a.value}`:'')
export default function ChatAssistant({scenario,screen,messages,onMessages,onActions}:{scenario:string;screen:Record<string,string|number|boolean|null>;messages:ChatMessage[];onMessages:(m:ChatMessage[])=>void;onActions:(a:AssistantAction[])=>void}){
 const suggestions=scenario==='manchar'?FLOOD_SUGGESTIONS:RADAR_SUGGESTIONS
 const status=useQuery<{available:boolean}>({queryKey:['assistant-status'],queryFn:async()=>{const r=await fetch('/api/assistant/status');if(!r.ok)throw new Error('unreachable');return r.json()},staleTime:30000,refetchOnWindowFocus:false})
 const [draft,setDraft]=useState(''),[busy,setBusy]=useState(false),end=useRef<HTMLDivElement>(null),abort=useRef<AbortController|null>(null)
 useEffect(()=>{end.current?.scrollIntoView({block:'end'})},[messages,busy])
 useEffect(()=>()=>abort.current?.abort(),[])
 const send=async(text:string)=>{
  const content=text.trim();if(!content||busy)return
  const next:ChatMessage[]=[...messages,{role:'user',content}];onMessages(next);setDraft('');setBusy(true)
  abort.current=new AbortController()
  try{
   const response=await fetch('/api/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.current.signal,body:JSON.stringify({scenario,screen,messages:next.filter(m=>!m.error).map(({role,content})=>({role,content}))})})
   const result=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(result.error??'The assistant could not answer.')
   const actions:AssistantAction[]=Array.isArray(result.actions)?result.actions:[]
   onMessages([...next,{role:'assistant',content:String(result.reply??''),actions:actions.map(describe)}]);if(actions.length)onActions(actions)
  }catch(error){if((error as Error).name!=='AbortError')onMessages([...next,{role:'assistant',error:true,content:error instanceof Error?error.message:'The assistant could not answer.'}])}
  finally{setBusy(false)}
 }
 return <div className="chat-assistant">
  {status.data&&!status.data.available?<div className="chat-setup" role="status"><strong>Connect an AI provider</strong><p>Copy <code>.env.example</code> to <code>.env</code>, set <code>AI_API_KEY</code>, <code>AI_BASE_URL</code> and <code>AI_MODEL</code> (any OpenAI-compatible provider with tool calling), then restart the project.</p></div>:
  <>
   <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
    {!messages.length&&<div className="chat-empty"><p>{scenario==='manchar'?'Ask about the flood imagery and its limits, or tell me what to show on the map.':'Ask about the radar data, its quality limits, or tell me what to show on the map.'}</p><div className="chat-suggestions">{suggestions.map(s=><button key={s} onClick={()=>void send(s)} disabled={busy}>{s}</button>)}</div></div>}
    {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}${m.error?' error':''}`}><p>{m.content}</p>{m.actions?.length?<small>Map: {m.actions.join(', ')}</small>:null}</div>)}
    {busy&&<div className="chat-message assistant pending" role="status"><LoaderCircle size={14} className="spin"/>Thinking…</div>}
    <div ref={end}/>
   </div>
   <form className="chat-form" onSubmit={e=>{e.preventDefault();void send(draft)}}>
    <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask SARscape…" aria-label="Message the assistant" maxLength={1000} disabled={status.isPending}/>
    <Button size="icon" type="submit" aria-label="Send" disabled={busy||!draft.trim()}><Send size={15}/></Button>
    {messages.length>0&&<Button size="icon" variant="ghost" type="button" aria-label="Clear conversation" onClick={()=>{abort.current?.abort();setBusy(false);onMessages([])}}><Trash2 size={15}/></Button>}
   </form>
   <p className="chat-note">AI can be wrong. Numbers come from this app’s data; check the Data &amp; sources panel for the originals.</p>
  </>}
 </div>
}
