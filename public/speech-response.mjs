import {conversationServiceError} from './conversation-limits.mjs';

export async function requireSpeechResponse(response){
 if(response.ok)return;
 const detail=await response.json().catch(()=>null);
 throw conversationServiceError(detail,response.headers,response.status===429?'rate_limited':'invalid_audio');
}

// Full-file players and prefetches expect audio bytes. Never cache an error
// frame as a playable file, even if its stream already sent HTTP 200.
export async function speechFileBytes(response){
 await requireSpeechResponse(response);
 if(Number(response.headers.get('content-length'))>4000000)throw Error('invalid_audio');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength>4000000)throw Error('invalid_audio');
 if(/application\/(?:x-ndjson|json)/i.test(response.headers.get('content-type')||'')){
  for(const line of new TextDecoder().decode(bytes).split('\n')){
   if(!line.trim())continue;
   const frame=JSON.parse(line);
   if(frame.error)throw conversationServiceError(frame,response.headers,'invalid_audio');
  }
  throw Error('invalid_audio');
 }
 if(bytes.byteLength<44)throw Error('invalid_audio');
 return bytes;
}

// HTMLMediaElement playback needs a seekable file. Rewrap the bounded first
// speech stream locally so this audio route also avoids a second round trip.
export async function inlineSpeechWave(response){
 await requireSpeechResponse(response);
 const chunks=[];let bytes=0,done=false;
 for(const line of (await response.text()).split('\n')){
  if(!line.trim())continue;
  const frame=JSON.parse(line);
  if(done)throw Error('invalid_audio');
  if(frame.done){done=true;continue;}
  if(frame.rate!==24000||typeof frame.audio!=='string'||frame.audio.length>32768)throw Error('invalid_audio');
  const pcm=atob(frame.audio);
  bytes+=pcm.length;if(bytes>4000000)throw Error('invalid_audio');
  chunks.push(pcm);
 }
 if(!done||!bytes||bytes%2)throw Error('incomplete_audio');
 const wave=new Uint8Array(44+bytes),view=new DataView(wave.buffer);
 const tag=(at,name)=>{for(let i=0;i<name.length;i++)wave[at+i]=name.charCodeAt(i);};
 tag(0,'RIFF');view.setUint32(4,36+bytes,true);tag(8,'WAVEfmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
 view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
 tag(36,'data');view.setUint32(40,bytes,true);
 let at=44;for(const chunk of chunks)for(let i=0;i<chunk.length;i++)wave[at++]=chunk.charCodeAt(i);
 return wave.buffer;
}
