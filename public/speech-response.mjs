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
