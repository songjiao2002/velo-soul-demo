import {allowedRequestOrigin} from './native-origin.mjs';
import WebSocket,{WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
import {chatConfig} from './chat-service.mjs';
import {relayScribeRealtime} from './scribe-realtime.mjs';

export function attachRealtimeAsr(server,{env=process.env,reserve,connect=(url,options)=>new WebSocket(url,options)}={}){
 const sockets=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  const reject=status=>{socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);};
  let url;try{url=new URL(req.url,'http://localhost');}catch{return reject(400);}
  if(url.pathname!=='/api/transcribe/live')return reject(404);
  if(!req.headers.origin||!allowedRequestOrigin(req))return reject(403);
  // Reject invalid handshakes before reserving the shared paid-service budget.
  if(req.method!=='GET'||req.headers.upgrade?.toLowerCase()!=='websocket'||!/^\s*13\s*$/.test(req.headers['sec-websocket-version']||'')||! /^[+/0-9A-Za-z]{22}==$/.test(req.headers['sec-websocket-key']||''))return reject(400);
  const language=url.searchParams.get('language')||'auto';if(!['ko','en','zh','auto'].includes(language))return reject(400);
  const config=chatConfig(env);
  const useScribe=config.scribeApiKey&&(language==='en'||language==='ko');
  if(env.QWEN_REALTIME_ASR==='off'||(!useScribe&&!config.configured))return reject(503);
  let release;try{release=reserve();}catch{return reject(429);}
  socket.once('close',release);
  try{
   sockets.handleUpgrade(req,socket,head,client=>{
    if(useScribe)relayScribeRealtime(client,{language,apiKey:config.scribeApiKey,connect,release});
    else relay(client,language,config,release);
   });
  }catch{release();socket.destroy();}
 });
 server.on('close',()=>{for(const client of sockets.clients)client.terminate();sockets.close();});
 function relay(client,language,config,release){
  let upstream,ready=false,closed=false,finishing=false,finishSent=false,total=0,queued=[],readyTimer,lifeTimer;
  const segments=new Map();
  const model=language==='en'?config.realtimeAsrModelEn:config.realtimeAsrModel;
  const messageModel=model==='qwen-audio-3.1-asr-flash-message';
  const duplex=messageModel||/^qwen-audio-3\.[01]-asr-flash-streaming$/.test(model);
  const taskId=randomUUID();
  const vocabulary={en:{Mori:2,Popo:2,Lulu:2},ko:{모리:2,포포:2,루루:2},zh:{莫里:2,波波:2,露露:2}}[language];
  const send=event=>{if(client.readyState!==WebSocket.OPEN)return;if(client.bufferedAmount>131072){client.terminate();return;}client.send(JSON.stringify(event));};
  const cleanup=()=>{if(closed)return;closed=true;clearTimeout(readyTimer);clearTimeout(lifeTimer);queued=[];release();if(upstream&&upstream.readyState!==WebSocket.CLOSED)upstream.terminate();};
  const fail=error=>{if(closed)return;send({type:'error',error});client.close(1011,'Recognition unavailable');cleanup();};
  const transmit=data=>{
   if(closed||upstream.readyState!==WebSocket.OPEN)return;
   if(upstream.bufferedAmount>131072)return fail('network');
   upstream.send(data);
  };
  const emit=event=>transmit(JSON.stringify({event_id:randomUUID(),...event}));
  const task=(action,payload)=>transmit(JSON.stringify({header:{action,task_id:taskId,streaming:'duplex'},payload}));
  const append=pcm=>duplex?transmit(pcm):emit({type:'input_audio_buffer.append',audio:pcm.toString('base64')});
  const finish=()=>{
   if(!ready||!finishing||finishSent)return;
   finishSent=true;
   if(duplex)task('finish-task',{input:{}});else emit({type:'session.finish'});
  };
  const result=()=>[...segments.values()].map(s=>s.final??s.partial??'').filter(Boolean).join(' ').trim().slice(0,1000);
  const unsettledInitial=language==='en' ? /^[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]$/u
    : language==='ko' ? /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u : null;
  let previousPreview='';
  function sendPreview(provisional){
   const text=result();
   // The first live hypothesis can be a single glyph in a different script.
   // A revised phrase or a confirmed word remains eligible in any language.
   if(text===previousPreview||(!previousPreview&&provisional&&unsettledInitial?.test(text)))return;
   previousPreview=text;send({type:'partial',text});
  }
  client.on('close',cleanup);client.on('error',cleanup);
  client.on('message',(raw,binary)=>{
   if(closed)return;
   if(binary){
    if(finishing||!raw.length||raw.length%2||raw.length>16384||(total+=raw.length)>512000)return fail('invalid_request');
    if(ready)append(raw);else queued.push(Buffer.from(raw));
   }else{
    let event;try{event=JSON.parse(raw);}catch{return fail('invalid_request');}
    if(!event||typeof event!=='object'||Array.isArray(event)||event.type!=='finish'||finishing)return fail('invalid_request');finishing=true;finish();
   }
  });
  readyTimer=setTimeout(()=>fail('asr_timeout'),8000);lifeTimer=setTimeout(()=>fail('asr_timeout'),50000);
  try{
   const endpoint=new URL(config.baseURL);
   endpoint.protocol='wss:';
   endpoint.pathname=duplex?'/api-ws/v1/inference':'/api-ws/v1/realtime';
   if(!duplex)endpoint.searchParams.set('model',model);
   upstream=connect(endpoint.href,{headers:{Authorization:'Bearer '+config.apiKey},handshakeTimeout:8000,maxPayload:131072,perMessageDeflate:false});
  }catch{return fail('network');}
  upstream.on('open',()=>{
   if(duplex){
    const parameters={format:'pcm',sample_rate:16000,max_sentence_silence:420,...(language==='auto'?{}:{language_hints:[language],vocabulary})};
    if(messageModel||model==='qwen-audio-3.1-asr-flash-streaming')parameters.vad_model='near_meeting_16k';
    if(messageModel){
     parameters.intermediate_result_enabled=true;
     parameters.disfluency_removal_enabled=false;
    }
    task('run-task',{task_group:'audio',task:'asr',function:'recognition',model,parameters,input:{}});
   }else emit({type:'session.update',session:{input_audio_format:'pcm',sample_rate:16000,input_audio_transcription:{...(language==='auto'?{}:{language})},turn_detection:{type:'server_vad',threshold:0.2,silence_duration_ms:300}}});
  });
  upstream.on('error',()=>fail('network'));
  upstream.on('close',()=>{if(!closed)fail('network');});
  upstream.on('message',raw=>{
   if(closed)return;let event;try{event=JSON.parse(raw);}catch{return fail('invalid_response');}
   if(!event||typeof event!=='object'||Array.isArray(event))return fail('invalid_response');
   const type=duplex?event.header?.event:event.type;
   if(typeof type!=='string')return fail('invalid_response');
   if(duplex&&event.header.task_id!==taskId)return fail('invalid_response');
   if(type==='session.updated'||type==='task-started'){
    if(ready)return;
    clearTimeout(readyTimer);ready=true;send({type:'ready'});for(const pcm of queued)append(pcm);queued=[];finish();
   }else if(duplex&&type==='result-generated'){
    const sentence=event.payload?.output?.sentence;
    if(sentence?.heartbeat)return;
    if(!Number.isSafeInteger(sentence?.sentence_id)||typeof sentence.text!=='string'||typeof sentence.sentence_end!=='boolean')return fail('invalid_response');
    const key=sentence.sentence_id;
    if(!segments.has(key)&&segments.size>=40)return fail('invalid_response');
    if(segments.get(key)?.final!==undefined)return;
    segments.set(key,{[sentence.sentence_end?'final':'partial']:sentence.text.slice(0,1000).trim()});
    sendPreview(!sentence.sentence_end);
   }else if(event.type==='conversation.item.input_audio_transcription.text'){
    if(typeof event.text!=='string'||typeof(event.stash??'')!=='string')return fail('invalid_response');
    const key=event.item_id||'utterance';if(segments.size>40)return fail('invalid_response');
    const previous=segments.get(key);if(previous?.final!==undefined)return;
    segments.set(key,{partial:(event.text+(event.stash||'')).slice(0,1000)});sendPreview(true);
   }else if(event.type==='conversation.item.input_audio_transcription.completed'){
    if(typeof event.transcript!=='string')return fail('invalid_response');
    const key=event.item_id||'utterance';if(!segments.has(key)&&segments.size>=40)return fail('invalid_response');
    segments.set(key,{final:event.transcript.slice(0,1000)});sendPreview(false);
   }else if(type==='session.finished'||type==='task-finished'){
    // A VAD segment may finish during a natural pause. Submit only once our
    // client ends its utterance, using confirmed segments, never tentative text.
    if(!finishing)return fail('invalid_response');
    if([...segments.values()].some(s=>s.final===undefined))return fail('invalid_response');
    send({type:'final',text:result()});client.close(1000,'Utterance complete');cleanup();
   }else if(type==='error'||type==='task-failed'||type==='conversation.item.input_audio_transcription.failed'){
    const code=event.header?.error_code||event.error?.code||event.code||'';
    fail(/quota|rate|limit/i.test(code)?'provider_quota':/auth|key/i.test(code)?'provider_auth':'provider_unavailable');
   }
  });
 }
 return sockets;
}
