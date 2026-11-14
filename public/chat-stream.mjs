// Shared bounded readers: provider SSE stays on the server; the client sees text only.
export async function readProviderChat(response,onDelta){
 if(!response.headers.get('content-type')?.includes('text/event-stream')||!response.body)throw Error('invalid_stream');
 const decoder=new TextDecoder();let pending='',text='',finished=false,reason;
 async function line(raw){
  if(!raw.startsWith('data:'))return;const data=raw.slice(5).trim();if(data==='[DONE]'){finished=true;return;}if(!data)return;
  const event=JSON.parse(data);if(event.error)throw Error('invalid_stream');const choice=event.choices?.[0];
  const delta=choice?.delta?.content;
  if(delta!==undefined&&delta!==null){if(typeof delta!=='string'||text.length+delta.length>10000)throw Error('invalid_stream');text+=delta;if(delta)await onDelta(delta);}
  if(choice?.finish_reason){reason=choice.finish_reason;finished=true;}
 }
 for await(const chunk of response.body){pending+=decoder.decode(chunk,{stream:true});if(pending.length>131072)throw Error('invalid_stream');let end;while((end=pending.indexOf('\n'))>=0){await line(pending.slice(0,end).trimEnd());pending=pending.slice(end+1);}if(finished)break;}
 if(!finished)throw Error('incomplete_stream');
 return {choices:[{message:{content:text},finish_reason:reason||'stop'}]};
}

export async function readVoiceReply(response,{soul,onText,onSentence}){
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',text='',spoken=0,result;
 const sentences=final=>{
  const remaining=text.slice(spoken);const pattern=/[^.!?。！？]+(?:[。！？!?]|[.](?=\s))/g;let match;
  let consumed=0;while((match=pattern.exec(remaining))){if(/[\p{L}\p{N}]/u.test(match[0]))onSentence(match[0].trim());consumed=match.index+match[0].length;}
  spoken+=consumed;
  // Start the first audio request as soon as five spoken characters exist.
  // CJK can split by character; Latin/Hangul words finish at a word boundary.
  if(!final&&spoken===0){
   let letters=0,end=0;
   const chars=Array.from(text);
   for(let i=0;i<chars.length;i++){
    const ch=chars[i];end+=ch.length;if(/[\p{L}\p{N}]/u.test(ch))letters++;
    const boundary=/[\s,，;；:：.!?。！？]/u.test(ch);
    const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch);
    if((letters>=5&&(cjk||boundary))||(letters>=2&&/[,，;；:：]/u.test(ch))){
     const part=text.slice(0,end).trim();if(part){onSentence(part);spoken=end;}break;
    }
   }
  }
  if(final&&text.slice(spoken).trim()){const tail=text.slice(spoken).trim();if(/[\p{L}\p{N}]/u.test(tail))onSentence(tail);spoken=text.length;}
 };
 const line=raw=>{
  if(!raw.trim())return;const frame=JSON.parse(raw);if(frame.error)throw Error(frame.error);if(result)throw Error('invalid_response');
  if(frame.type==='delta'&&typeof frame.text==='string'){text+=frame.text;if(text.length>10000)throw Error('invalid_response');onText(text);sentences(false);}
  else if(frame.type==='complete'&&frame.soul===soul&&typeof frame.reply==='string'&&frame.reply.trim()===text.trim()){result=frame;sentences(true);}
  else throw Error('invalid_response');
 };
 try{while(!result){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});if(pending.length>131072)throw Error('invalid_response');let end;while((end=pending.indexOf('\n'))>=0){line(pending.slice(0,end));pending=pending.slice(end+1);}}if(!result)throw Error('incomplete_response');return result;}
 finally{await reader.cancel().catch(()=>{});}
}
