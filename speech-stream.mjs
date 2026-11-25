const bytesPerMs=48; // 24 kHz mono PCM16
export function createSpeechWave(){
 const chunks=[];
 let size=0,complete=false;
 return {
  append(frame){
   if(frame.done){complete=true;return;}
   if(complete||frame.rate!==24000||!frame.audio)throw Error('invalid_audio');
   const bytes=Buffer.from(frame.audio,'base64');
   size+=bytes.length;
   if(size>4000000)throw Error('invalid_audio');
   chunks.push(bytes);
  },
  finish(){
   if(!complete||!size||size%2)throw Error('invalid_audio');
   const header=Buffer.alloc(44);
   header.write('RIFF');header.writeUInt32LE(36+size,4);
   header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);
   header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
   header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);
   header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
   header.write('data',36);header.writeUInt32LE(size,40);
   return Buffer.concat([header,...chunks],size+44);
  }
 };
}
const keepLead=80*bytesPerMs, maxLead=720*bytesPerMs;
const keepTail=150*bytesPerMs, maxTail=720*bytesPerMs;
// Below -66 dBFS. A quiet breath, rumble or single consonant above this
// amplitude counts as sound; surrounding margins remain in the original PCM.
const audible=16;
function firstSound(pcm,from=0){
 for(let at=from;at+1<Math.min(pcm.length,maxLead);at+=2){
  if(Math.abs(pcm.readInt16LE(at))>=audible)return at;
 }
 return -1;
}
function lastSound(pcm){
 for(let at=pcm.length-2;at>=0;at-=2){
  if(Math.abs(pcm.readInt16LE(at))>=audible)return at;
 }
 return -1;
}
function trimLength(first){return Math.max(0,first-keepLead);}

function speechLead(){
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

function speechEdges(){
 const lead=speechLead();
 let odd=null,heard=false,grace=keepTail,quiet=[],head=0,held=0;
 function release(count,out){
  while(count>0){
   const part=quiet[head],n=Math.min(count,part.length);
   out.push(part.subarray(0,n));held-=n;count-=n;
   if(n===part.length)head++;else quiet[head]=part.subarray(n);
  }
  if(head===quiet.length||head>=64&&head*2>=quiet.length){quiet=quiet.slice(head);head=0;}
 }
 return {
  push(chunk){
   // Packet edges may split a 16-bit signed sample.
   if(odd!==null){chunk=Buffer.concat([Buffer.from([odd]),chunk]);odd=null;}
   if(chunk.length%2){odd=chunk.at(-1);chunk=chunk.subarray(0,-1);}
   const pcm=lead.push(chunk);
   if(!pcm.length)return pcm;
   const last=lastSound(pcm);
   if(!heard&&last<0)return pcm;
   const out=[];
   if(last>=0){heard=true;release(held,out);grace=keepTail;}
   const after=last<0?0:last+2;
   const margin=Math.min(grace,pcm.length-after);grace-=margin;
   const immediate=after+margin;
   if(immediate)out.push(pcm.subarray(0,immediate));
   const rest=pcm.subarray(immediate);
   if(rest.length){
    // Defer only extra quiet. If a later sample is audible, restore every
    // deferred byte before it. Prolonged pauses keep at most maxTail in memory.
    const excess=Math.max(0,held+rest.length-maxTail),old=Math.min(held,excess);
    release(old,out);
    const overflow=excess-old;
    if(overflow)out.push(rest.subarray(0,overflow));
    const extra=rest.subarray(overflow);
    if(extra.length){quiet.push(Buffer.from(extra));held+=extra.length;}
   }
   return out.length===1?out[0]:Buffer.concat(out);
  },
  finish(){
   if(odd!==null)throw Error('invalid_audio');
   return lead.finish(); // Remaining held bytes are verified trailing padding.
  }
 };
}

export function trimSpeechWave(wave){
 // These paired sizes are the canonical 44-byte streaming header used on the
 // provider's complete HTTP downloads. Mixed or unfamiliar lengths pass through.
 if(wave.length<44||wave.toString('ascii',0,4)!=='RIFF'||wave.toString('ascii',8,12)!=='WAVE')return wave;
 const sentinel=wave.readUInt32LE(4)===0x7fffffbf&&wave.toString('ascii',12,16)==='fmt '&&wave.readUInt32LE(16)===16&&wave.toString('ascii',36,40)==='data'&&wave.readUInt32LE(40)===0x7fffff9b;
 if(!sentinel&&wave.readUInt32LE(4)!==wave.length-8)return wave;
 if(sentinel){
  // With no declared data length, a RIFF footer would be ambiguous. Leave
  // files containing a plausible terminal metadata chunk untouched.
  for(let at=wave.length-8;at>=44;at-=2){
   const size=wave.readUInt32LE(at+4);
   if(at+8+size+size%2===wave.length&&/^[A-Za-z][A-Za-z0-9 ]{3}$/.test(wave.toString('latin1',at,at+4)))return wave;
  }
 }
 let format=false;
 for(let at=12;at+8<=wave.length;){
  const tag=wave.toString('ascii',at,at+4),start=at+8,size=sentinel&&tag==='data'?wave.length-start:wave.readUInt32LE(at+4);
  if(size>wave.length-start)return wave;
  if(!['fmt ','data','JUNK','PAD '].includes(tag))return wave;
  if(tag==='fmt '&&size>=16)format=wave.readUInt16LE(start)===1&&wave.readUInt16LE(start+2)===1&&wave.readUInt32LE(start+4)===24000&&wave.readUInt32LE(start+8)===48000&&wave.readUInt16LE(start+12)===2&&wave.readUInt16LE(start+14)===16;
  if(tag==='data'&&format&&start+size===wave.length&&size%2===0){
   const pcm=wave.subarray(start),first=firstSound(pcm),last=lastSound(pcm);
   const head=trimLength(first<0&&size>=maxLead?maxLead:first);
   const tail=last<0?0:Math.max(0,Math.min(maxTail,size-last-2-keepTail));
   if(!head&&!tail&&!sentinel)return wave;
   const result=Buffer.concat([wave.subarray(0,start),wave.subarray(start+head,wave.length-tail)]);
   result.writeUInt32LE(result.length-8,4);
   result.writeUInt32LE(size-head-tail,at+4);
   return result;
  }
  at=start+size+size%2;
 }
 return wave;
}

// Provider SSE stays on the server. Only bounded PCM and an explicit completion
// marker reach the browser; credentials, provider URLs and errors never do.
export async function relaySpeech(response,emit,{trimPadding=false,providerError=()=>new Error('provider_stream_error')}={}){
 if(!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('invalid_stream');
 const edges=trimPadding?speechEdges():null;
 const decoder=new TextDecoder();let pending='',header=Buffer.alloc(0),ready=false,done=false,total=0;
 async function line(value){
  if(!value.startsWith('data:'))return;
  const raw=value.slice(5).trim();if(!raw||raw==='[DONE]')return;
  const data=JSON.parse(raw);if(data.code||data.error)throw providerError(data);
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
      if(tag==='fmt '){if(size<16||header.readUInt16LE(at+8)!==1||header.readUInt16LE(at+10)!==1||header.readUInt32LE(at+12)!==24000||header.readUInt32LE(at+16)!==48000||header.readUInt16LE(at+20)!==2||header.readUInt16LE(at+22)!==16)throw new Error('invalid_audio');format=true;}
      at+=8+size+(size%2);
     }
     if(!found){if(header.length>65536)throw new Error('invalid_audio');return;}
    }else pcm=header;
    ready=true;header=Buffer.alloc(0);
   }
   if(edges)pcm=edges.push(pcm);
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
 const tail=edges?.finish();
 if(tail?.length)await emit({audio:tail.toString('base64'),rate:24000});
 await emit({done:true});
}
