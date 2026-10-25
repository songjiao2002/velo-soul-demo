import {allowedRequestOrigin} from './native-origin.mjs';
import WebSocket,{WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
import {chatConfig} from './chat-service.mjs';

export function attachRealtimeAsr(server,{env=process.env,reserve,connect=(url,options)=>new WebSocket(url,options)}={}){
 const sockets=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url,'http://localhost');
  const reject=status=>{socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);};
  if(url.pathname!=='/api/transcribe/live')return reject(404);
  if(!req.headers.origin||!allowedRequestOrigin(req))return reject(403);
  const language=url.searchParams.get('language')||'auto';if(!['ko','en','zh','auto'].includes(language))return reject(400);
  const config=chatConfig(env);if(!config.configured||env.QWEN_REALTIME_ASR==='off')return reject(503);
  let release;try{release=reserve();}catch{return reject(429);}
  socket.once('close',release);
  try{sockets.handleUpgrade(req,socket,head,client=>relay(client,language,config,release));}catch{release();socket.destroy();}
 });
 server.on('close',()=>{for(const client of sockets.clients)client.terminate();sockets.close();});
 function relay(client,language,config,release){
  let upstream,ready=false,closed=false,finishing=false,finishSent=false,total=0,queued=[],readyTimer,lifeTimer;
  const segments=new Map();
  const send=event=>{if(client.readyState!==WebSocket.OPEN)return;if(client.bufferedAmount>131072){client.terminate();return;}client.send(JSON.stringify(event));};
  const cleanup=()=>{if(closed)return;closed=true;clearTimeout(readyTimer);clearTimeout(lifeTimer);queued=[];release();if(upstream&&upstream.readyState!==WebSocket.CLOSED)upstream.terminate();};
  const fail=error=>{if(closed)return;send({type:'error',error});client.close(1011,'Recognition unavailable');cleanup();};
  const emit=event=>{if(closed||upstream.readyState!==WebSocket.OPEN)return;if(upstream.bufferedAmount>131072)return fail('network');upstream.send(JSON.stringify({event_id:randomUUID(),...event}));};
  const finish=()=>{if(ready&&finishing&&!finishSent){finishSent=true;emit({type:'session.finish'});}};
  const result=()=>[...segments.values()].map(s=>s.final??s.partial??'').filter(Boolean).join(' ').trim().slice(0,1000);
  client.on('close',cleanup);client.on('error',cleanup);
  client.on('message',(raw,binary)=>{
   if(closed)return;
   if(binary){
    if(finishing||!raw.length||raw.length%2||raw.length>16384||(total+=raw.length)>512000)return fail('invalid_request');
    if(ready)emit({type:'input_audio_buffer.append',audio:raw.toString('base64')});else queued.push(Buffer.from(raw));
   }else{
    let event;try{event=JSON.parse(raw);}catch{return fail('invalid_request');}
    if(event.type!=='finish'||finishing)return fail('invalid_request');finishing=true;finish();
   }
  });
  readyTimer=setTimeout(()=>fail('asr_timeout'),8000);lifeTimer=setTimeout(()=>fail('asr_timeout'),50000);
  try{
   const endpoint=new URL(config.baseURL);endpoint.protocol='wss:';endpoint.pathname='/api-ws/v1/realtime';endpoint.searchParams.set('model',env.QWEN_ASR_REALTIME_MODEL||'qwen3-asr-flash-realtime');
   upstream=connect(endpoint.href,{headers:{Authorization:'Bearer '+config.apiKey},handshakeTimeout:8000,maxPayload:131072,perMessageDeflate:false});
  }catch{return fail('network');}
  upstream.on('open',()=>emit({type:'session.update',session:{input_audio_format:'pcm',sample_rate:16000,input_audio_transcription:{...(language==='auto'?{}:{language})},turn_detection:{type:'server_vad',threshold:0,silence_duration_ms:400}}}));
  upstream.on('error',()=>fail('network'));
  upstream.on('close',()=>{if(!closed)fail('network');});
  upstream.on('message',raw=>{
   if(closed)return;let event;try{event=JSON.parse(raw);}catch{return fail('invalid_response');}
   if(event.type==='session.updated'){
    clearTimeout(readyTimer);ready=true;send({type:'ready'});for(const pcm of queued)emit({type:'input_audio_buffer.append',audio:pcm.toString('base64')});queued=[];finish();
   }else if(event.type==='conversation.item.input_audio_transcription.text'){
    if(typeof event.text!=='string'||typeof(event.stash??'')!=='string')return fail('invalid_response');
    const key=event.item_id||'utterance';if(segments.size>40)return fail('invalid_response');
    const previous=segments.get(key);if(previous?.final!==undefined)return;
    segments.set(key,{partial:(event.text+(event.stash||'')).slice(0,1000)});send({type:'partial',text:result()});
   }else if(event.type==='conversation.item.input_audio_transcription.completed'){
    if(typeof event.transcript!=='string')return fail('invalid_response');
    segments.set(event.item_id||'utterance',{final:event.transcript.slice(0,1000)});send({type:'partial',text:result()});
   }else if(event.type==='session.finished'){
    // A VAD segment may finish during a natural pause. Submit only once our
    // client ends its utterance, using confirmed segments, never tentative text.
    if(!finishing)return fail('invalid_response');
    if([...segments.values()].some(s=>s.final===undefined))return fail('invalid_response');
    send({type:'final',text:result()});client.close(1000,'Utterance complete');cleanup();
   }else if(event.type==='error'||event.type==='conversation.item.input_audio_transcription.failed'){
    const code=event.error?.code||event.code||'';
    fail(/quota|rate|limit/i.test(code)?'provider_quota':/auth|key/i.test(code)?'provider_auth':'provider_unavailable');
   }
  });
 }
 return sockets;
}
