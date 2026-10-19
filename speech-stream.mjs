// Provider SSE stays on the server. Only bounded PCM and an explicit completion
// marker reach the browser; credentials, provider URLs and errors never do.
export async function relaySpeech(response,emit){
 if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('invalid_stream');
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
 await emit({done:true});
}
