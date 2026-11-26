import {allowedRequestOrigin} from './native-origin.mjs';
import WebSocket,{WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
import {chatConfig,ChatError,qwenFailure} from './chat-service.mjs';
import {relayScribeRealtime} from './scribe-realtime.mjs';
import {interimTranscript} from './asr-preview.mjs';

function terminateUpstream(socket){
 if(socket&&socket.readyState!==WebSocket.CLOSED){
  // ws may emit a final error when an in-progress handshake is terminated.
  socket.once('error',()=>{});
  socket.terminate();
 }
}

function qwenRoute(config,language){
 const model=language==='en'?config.realtimeAsrModelEn:config.realtimeAsrModel;
 const messageModel=model==='qwen-audio-3.1-asr-flash-message';
 const duplex=messageModel||/^qwen-audio-3\.[01]-asr-flash-streaming$/.test(model);
 const endpoint=new URL(config.baseURL);
 endpoint.protocol='wss:';
 endpoint.pathname=duplex?'/api-ws/v1/inference':'/api-ws/v1/realtime';
 if(!duplex)endpoint.searchParams.set('model',model);
 return {model,messageModel,duplex,endpoint:endpoint.href};
}

export function attachRealtimeAsr(server,{env=process.env,reserve,connect=(url,options)=>new WebSocket(url,options)}={}){
 const sockets=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false});
 let waitingClients=0,waitingForDuplex=0;
 let idleQwen=null,stopping=false,nextPreparation=0;
 const dialQwen=(endpoint,apiKey)=>connect(endpoint,{headers:{Authorization:'Bearer '+apiKey},handshakeTimeout:8000,maxPayload:131072,perMessageDeflate:false});
 function removeIdle(){
  const entry=idleQwen;
  if(!entry)return null;
  idleQwen=null;
  clearTimeout(entry.timer);
  entry.socket.off('close',discardIdle);
  entry.socket.off('error',discardIdle);
  entry.socket.off('message',discardIdle);
  return entry;
 }
 function discardIdle(){
  terminateUpstream(removeIdle()?.socket);
 }
 function keepIdle(socket,endpoint,apiKey,taskId,lifetime){
  if(stopping||socket.readyState>WebSocket.OPEN){terminateUpstream(socket);return;}
  discardIdle();
  // A fresh handshake or a finished duplex task. No audio or protocol messages
  // may be sent until an active rider has exclusively claimed the transport.
  idleQwen={socket,endpoint,apiKey,taskId,timer:setTimeout(discardIdle,lifetime)};
  idleQwen.timer.unref();
  socket.once('close',discardIdle);
  socket.once('error',discardIdle);
  socket.once('message',discardIdle);
 }
 function prepareDuplex(endpoint,apiKey){
  if(stopping||idleQwen||Date.now()<nextPreparation)return;
  // Limit speculative handshakes even if listeners repeatedly open and cancel.
  nextPreparation=Date.now()+5000;
  try{keepIdle(dialQwen(endpoint,apiKey),endpoint,apiKey,null,35000);}catch{/* Speech can still open a fresh connection. */}
 }
 server.on('upgrade',(req,socket,head)=>{
  const reject=status=>{socket.end(`HTTP/1.1 ${status} Rejected\r\nConnection: close\r\n\r\n`);};
  let url;try{url=new URL(req.url,'http://localhost');}catch{return reject(400);}
  const standby=url.pathname==='/api/transcribe/standby';
  if(!standby&&url.pathname!=='/api/transcribe/live')return reject(404);
  if(!req.headers.origin||!allowedRequestOrigin(req))return reject(403);
  // Reject invalid handshakes before reserving the shared paid-service budget.
  if(req.method!=='GET'||req.headers.upgrade?.toLowerCase()!=='websocket'||!/^\s*13\s*$/.test(req.headers['sec-websocket-version']||'')||! /^[+/0-9A-Za-z]{22}==$/.test(req.headers['sec-websocket-key']||''))return reject(400);
  const language=url.searchParams.get('language')||'auto';if(!['ko','en','zh','auto'].includes(language))return reject(400);
  const config=chatConfig(env);
  // Older Mandarin clients describe a Qwen-only route in their privacy notice.
  const scribeMandarin=language==='zh'&&url.searchParams.get('provider')==='scribe';
  const useScribe=config.scribeApiKey&&(language==='en'||language==='ko'||scribeMandarin);
  if(env.QWEN_REALTIME_ASR==='off'||(!useScribe&&!config.configured))return reject(503);
  const route=useScribe?null:qwenRoute(config,language);
  if(standby&&waitingClients>=32)return reject(429);
  let release;
  function startProvider(client){
   if(useScribe)relayScribeRealtime(client,{language,apiKey:config.scribeApiKey,connect,release});
   else relay(client,language,config,route,release);
  }
  function reserveTask(client){
   try{release=reserve();socket.once('close',release);return true;}
   catch(error){
    // A browser cannot read the 429 body during a rejected WebSocket upgrade.
    client.once('error',()=>client.terminate());
    const failure=error instanceof ChatError?error:new ChatError('rate_limited',429);
    client.send(JSON.stringify({type:'error',error:failure.code,retryAfter:failure.retryAfter}));
    client.close(1013,'Recognition unavailable');return false;
   }
  }
  try{
   sockets.handleUpgrade(req,socket,head,client=>{
    if(!standby){if(reserveTask(client))startProvider(client);return;}
    // The duplex endpoint accepts an authenticated WebSocket before run-task.
    // Other protocols can start sessions on upgrade and must remain on demand.
    waitingClients++;
    if(route?.duplex){waitingForDuplex++;prepareDuplex(route.endpoint,config.apiKey);}
    let waiting=true;
    const timeout=setTimeout(()=>client.terminate(),45000);
    timeout.unref();
    const leave=()=>{
     if(!waiting)return;
     waiting=false;
     clearTimeout(timeout);waitingClients--;
     client.off('message',activate);client.off('close',leave);client.off('error',onError);
     if(route?.duplex){
      waitingForDuplex--;
      if(waitingForDuplex===0&&idleQwen&&!idleQwen.taskId)discardIdle();
     }
    };
    const onError=()=>client.terminate();
    const activate=(raw,binary)=>{
     if(binary||raw.length>64||raw.toString()!=='{"type":"start"}'){
      client.close(1008,'Invalid standby request');return;
     }
     if(!reserveTask(client)){leave();return;}
     try{startProvider(client);}finally{leave();}
    };
    client.once('message',activate);client.once('close',leave);client.on('error',onError);
   });
  }catch{release?.();socket.destroy();}
 });
 server.on('close',()=>{stopping=true;discardIdle();for(const client of sockets.clients)client.terminate();sockets.close();});
 function relay(client,language,config,route,release){
  let upstream,ready=false,closed=false,finishing=false,finishSent=false,total=0,queued=[],readyTimer,lifeTimer;
  const segments=new Map();
  const {model,messageModel,duplex,endpoint}=route;
  let taskId=randomUUID(),previousTaskId=null,retryPrepared=false;
  const vocabulary={en:{Mori:2,Popo:2,Lulu:2},ko:{모리:2,포포:2,루루:2},zh:{莫里:2,波波:2,露露:2}}[language];
  const send=event=>{if(client.readyState!==WebSocket.OPEN)return;if(client.bufferedAmount>131072){client.terminate();return;}client.send(JSON.stringify(event));};
  const cleanup=()=>{if(closed)return;closed=true;clearTimeout(readyTimer);clearTimeout(lifeTimer);queued=[];release();terminateUpstream(detachUpstream());};
  const fail=(error,retryAfter)=>{if(closed)return;send({type:'error',error,retryAfter});client.close(1011,'Recognition unavailable');cleanup();};
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
  const result=()=>[...segments.values()].map(s=>s.final??s.partial??'').filter(Boolean).join(' ').trim();
  const unsettledInitial=language==='en' ? /^[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]$/u
    : language==='ko' ? /^(?:\p{Script=Han}{1,3}|[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Latin}])$/u : null;
  let previousPreview='';
  function sendPreview(provisional){
   const text=interimTranscript(result(),language);
   // Briefly withheld first guesses include short all-Han prefixes heard on Korean input.
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
   let existing=null;
   if(duplex&&idleQwen){
    if(idleQwen.endpoint===endpoint&&idleQwen.apiKey===config.apiKey&&idleQwen.socket.readyState<=WebSocket.OPEN)existing=removeIdle();
    else discardIdle();
   }
   attachUpstream(existing);
  }catch{return fail('network');}
  function attachUpstream(existing){
   previousTaskId=existing?.taskId??null;
   retryPrepared=Boolean(existing);
   upstream=existing?.socket??dialQwen(endpoint,config.apiKey);
   upstream.on('error',onTransportFailure);
   upstream.on('close',onTransportFailure);
   upstream.on('unexpected-response',onHandshakeFailure);
   upstream.on('message',onMessage);
   if(existing&&upstream.readyState===WebSocket.OPEN)beginTask();
   else upstream.once('open',beginTask);
  }
  function detachUpstream(){
   const socket=upstream;
   if(socket){
    upstream=null;
    socket.off('open',beginTask);
    socket.off('error',onTransportFailure);
    socket.off('close',onTransportFailure);
    socket.off('unexpected-response',onHandshakeFailure);
    socket.off('message',onMessage);
   }
   return socket;
  }
  function onHandshakeFailure(request,response){
   // End a rejected handshake explicitly once ws hands ownership to us.
   const failure=qwenFailure({},response.statusCode,response.headers?.['retry-after']);
   response.resume();fail(failure.code,failure.retryAfter);
  }
  function onTransportFailure(){
   if(closed)return;
   // An idle peer may have closed while the socket still looked open. No PCM
   // can have reached that task until task-started; keep the queued frames.
   if(retryPrepared&&!ready){
    terminateUpstream(detachUpstream());
    taskId=randomUUID();
    try{attachUpstream(null);}catch{fail('network');}
   }else fail('network');
  }
  function beginTask(){
   if(duplex){
    const parameters={format:'pcm',sample_rate:16000,max_sentence_silence:420,...(language==='auto'?{}:{language_hints:[language],vocabulary})};
    if(messageModel||model==='qwen-audio-3.1-asr-flash-streaming')parameters.vad_model='near_meeting_16k';
    if(messageModel){
     parameters.intermediate_result_enabled=true;
     parameters.disfluency_removal_enabled=false;
    }
    task('run-task',{task_group:'audio',task:'asr',function:'recognition',model,parameters,input:{}});
   }else emit({type:'session.update',session:{input_audio_format:'pcm',sample_rate:16000,input_audio_transcription:{...(language==='auto'?{}:{language})},turn_detection:{type:'server_vad',threshold:0.2,silence_duration_ms:300}}});
  }
  function onMessage(raw){
   if(closed)return;let event;try{event=JSON.parse(raw);}catch{return fail('invalid_response');}
   if(!event||typeof event!=='object'||Array.isArray(event))return fail('invalid_response');
   const type=duplex?event.header?.event:event.type;
   if(typeof type!=='string')return fail('invalid_response');
   if(duplex&&event.header.task_id!==taskId){
    if(previousTaskId&&event.header.task_id===previousTaskId)return;
    return fail('invalid_response');
   }
   if(type===(duplex?'task-started':'session.updated')){
    if(ready)return;
    clearTimeout(readyTimer);ready=true;send({type:'ready'});for(const pcm of queued)append(pcm);queued=[];finish();
   }else if(duplex&&type==='result-generated'){
    const sentence=event.payload?.output?.sentence;
    if(sentence?.heartbeat)return;
    if(!Number.isSafeInteger(sentence?.sentence_id)||typeof sentence.text!=='string'||typeof sentence.sentence_end!=='boolean')return fail('invalid_response');
    const key=sentence.sentence_id;
    if(!segments.has(key)&&segments.size>=40)return fail('invalid_response');
    if(segments.get(key)?.final!==undefined)return;
    segments.set(key,{[sentence.sentence_end?'final':'partial']:sentence.text.trim()});
    sendPreview(!sentence.sentence_end);
   }else if(event.type==='conversation.item.input_audio_transcription.text'){
    if(typeof event.text!=='string'||typeof(event.stash??'')!=='string')return fail('invalid_response');
    const key=event.item_id||'utterance';if(segments.size>40)return fail('invalid_response');
    const previous=segments.get(key);if(previous?.final!==undefined)return;
    segments.set(key,{partial:(event.text+(event.stash||''))});sendPreview(true);
   }else if(event.type==='conversation.item.input_audio_transcription.completed'){
    if(typeof event.transcript!=='string')return fail('invalid_response');
    const key=event.item_id||'utterance';if(!segments.has(key)&&segments.size>=40)return fail('invalid_response');
    segments.set(key,{final:event.transcript});sendPreview(false);
   }else if(type===(duplex?'task-finished':'session.finished')){
    // A VAD segment may finish during a natural pause. Submit only once our
    // client ends its utterance, using confirmed segments, never tentative text.
    if(!ready||!finishSent)return fail('invalid_response');
    if([...segments.values()].some(s=>s.final===undefined))return fail('invalid_response');
    send({type:'final',text:result()});
    if(duplex&&client.readyState===WebSocket.OPEN)keepIdle(detachUpstream(),endpoint,config.apiKey,taskId,15000);
    client.close(1000,'Utterance complete');cleanup();
   }else if(type==='error'||type==='task-failed'||type==='conversation.item.input_audio_transcription.failed'){
    const detail=event.header?.error_code?{code:event.header.error_code,message:event.header.error_message}:event;
    const failure=qwenFailure(detail);
    fail(failure.code,failure.retryAfter);
   }
  }
 }
 return sockets;
}
