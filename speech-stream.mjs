// Keep the lead-in to Lulu's breath and first consonant. The cloned voice
// sometimes produces several hundred milliseconds of near-silence before it.
const bytesPerMs=48; // 24 kHz mono PCM16
const keepLead=80*bytesPerMs, maxLead=720*bytesPerMs;
function firstSound(pcm,from=0){
 for(let at=from;at+1<Math.min(pcm.length,maxLead);at+=2){
  if(Math.abs(pcm.readInt16LE(at))>=24)return at;
 }
 return -1;
}
function trimLength(first){return Math.max(0,first-keepLead);}

function pandaStreamLead(){
 const prefix=Buffer.allocUnsafe(maxLead);
 let length=0,started=false;
 return {
  push(pcm){
   if(started||!pcm.length)return pcm;
   const previous=length,added=pcm.copy(prefix,length,0,Math.min(pcm.length,maxLead-length));
   length+=added;
   const first=firstSound(prefix.subarray(0,length),previous-previous%2);
   if(first<0&&length<maxLead)return Buffer.alloc(0);
   started=true;
   const lead=prefix.subarray(trimLength(first<0?maxLead:first),length);
   return added===pcm.length?lead:Buffer.concat([lead,pcm.subarray(added)]);
  },
  finish(){return started?Buffer.alloc(0):prefix.subarray(0,length);}
 };
}

export function trimPandaWave(wave){
 // Change only complete mono PCM WAVs with a terminal data chunk. Pass through
 // unfamiliar provider formats and files with timing metadata after the audio.
 if(wave.length<44||wave.toString('ascii',0,4)!=='RIFF'||wave.toString('ascii',8,12)!=='WAVE'||wave.readUInt32LE(4)!==wave.length-8)return wave;
 let format=false;
 for(let at=12;at+8<=wave.length;){
  const tag=wave.toString('ascii',at,at+4),size=wave.readUInt32LE(at+4),start=at+8;
  if(size>wave.length-start)return wave;
  if(tag==='fmt '&&size>=16)format=wave.readUInt16LE(start)===1&&wave.readUInt16LE(start+2)===1&&wave.readUInt32LE(start+4)===24000&&wave.readUInt32LE(start+8)===48000&&wave.readUInt16LE(start+12)===2&&wave.readUInt16LE(start+14)===16;
  if(tag==='data'&&format&&start+size===wave.length&&size%2===0){
   const first=firstSound(wave.subarray(start));
   const trim=trimLength(first<0&&size>=maxLead?maxLead:first);
   if(!trim)return wave;
   const result=Buffer.concat([wave.subarray(0,start),wave.subarray(start+trim)]);
   result.writeUInt32LE(result.length-8,4);
   result.writeUInt32LE(size-trim,at+4);
   return result;
  }
  at=start+size+size%2;
 }
 return wave;
}

// Provider SSE stays on the server. Only bounded PCM and an explicit completion
// marker reach the browser; credentials, provider URLs and errors never do.
export async function relaySpeech(response,emit,{trimPandaLead=false}={}){
 if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('invalid_stream');
 const lead=trimPandaLead?pandaStreamLead():null;
 const decoder=new TextDecoder();let pending='',header=Buffer.alloc(0),ready=false,done=false,total=0;
 async function line(value){
  if(!value.startsWith('data:'))return;
  const raw=value.slice(5).trim();if(!raw||raw==='[DONE]')return;
  const data=JSON.parse(raw);if(data.code||data.error)throw new Error('provider_stream_error');
  const encoded=data.output?.audio?.data;
  if(encoded){
   if(done||typeof encoded!=='string'||encoded.length>6000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('invalid_audio');
   let pcm=Buffer.from(encoded,'base64');total+=pcm.length;if(total>4000000)throw new Error('invalid_audio');
   if(!ready){
    header=Buffer.concat([header,pcm]);if(header.length<12)return;
    // Current DashScope streams begin with a WAV header whose sizes are unknown.
    // Raw PCM is also documented; both formats use signed 16-bit mono at 24 kHz.
    if(header.toString('ascii',0,4)==='RIFF'){
     if(header.toString('ascii',8,12)!=='WAVE')throw new Error('invalid_audio');
     let at=12,format=false,found=false;
     while(at+8<=header.length){
      const tag=header.toString('ascii',at,at+4),size=header.readUInt32LE(at+4);
      if(tag==='data'){if(!format)throw new Error('invalid_audio');pcm=header.subarray(at+8);found=true;break;}
      if(size>65536)throw new Error('invalid_audio');if(at+8+size>header.length)break;
      if(tag==='fmt '){if(size<16||header.readUInt16LE(at+8)!==1||header.readUInt16LE(at+10)!==1||header.readUInt32LE(at+12)!==24000||header.readUInt16LE(at+22)!==16)throw new Error('invalid_audio');format=true;}
      at+=8+size+(size%2);
     }
     if(!found){if(header.length>65536)throw new Error('invalid_audio');return;}
    }else pcm=header;
    ready=true;header=Buffer.alloc(0);
   }
   if(lead)pcm=lead.push(pcm);
   if(pcm.length)await emit({audio:pcm.toString('base64'),rate:24000});
  }
  if(data.output?.finish_reason==='stop')done=true;
 }
 for await(const chunk of response.body){
  pending+=decoder.decode(chunk,{stream:true});if(pending.length>6000000)throw new Error('invalid_stream');
  let end;while((end=pending.indexOf('\n'))!==-1){const value=pending.slice(0,end).trimEnd();pending=pending.slice(end+1);await line(value);}
  // The protocol's finish marker is authoritative. Release the connection and
  // shared request slot without waiting for a slow upstream socket to close.
  if(done)break;
 }
 pending+=decoder.decode();if(pending.trim())await line(pending.trimEnd());
 if(!ready||!done)throw new Error('incomplete_audio');
 const tail=lead?.finish();
 if(tail?.length)await emit({audio:tail.toString('base64'),rate:24000});
 await emit({done:true});
}
