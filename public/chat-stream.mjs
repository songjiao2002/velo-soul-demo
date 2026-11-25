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

// Lulu's short answers can open with a complete acknowledgement before five letters.
// Require an actual separator: a provider delta ending in "Yes" might continue as "Yesterday".
const luluAcknowledgement=/^\s*(?:hm+|m{2,}|oh|ah|hi|hey|ok(?:ay)?|sure|well|yeah|yes|yep|no|nope|음+|응+|어|아|네|그래|좋아|좋지|맞아|잠깐|嗯+|哦|好|好呀|好啊|行|行呀|对|对呀)(?:[,，、.!?。！？…~～—:：;；]+|\s+)/iu;
let chineseWords;
function luluChineseLead(input,canSegment){
 // Keep the last word in the buffer; the next delta may continue it (看 → 看看).
 const text=input.trimStart(),start=input.length-text.length;
 const finalParticle=/^\p{Script=Han}{2,4}[吧呀啦呢嘛啊哦](?:[，、…～]+|$)/u.exec(text);
 if(finalParticle)return start+finalParticle[0].length;
 if(!canSegment||!/^\p{Script=Han}{4}/u.test(text))return 0;
 chineseWords??=new Intl.Segmenter('zh',{granularity:'word'});
 let end=0;
 for(const {index} of chineseWords.segment(text)){
  if(index>5)break;
  if(index>=3)end=index;
 }
 return end?start+end:0;
}

export async function readVoiceReply(response,{soul,onText,onSentence}){
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',text='',spoken=0,result;
 const sentences=final=>{
  const remaining=text.slice(spoken);const pattern=/[^.!?。！？]+(?:[。！？!?]|[.](?=\s))/g;let match;
  let consumed=0;while((match=pattern.exec(remaining))){if(/[\p{L}\p{N}]/u.test(match[0]))onSentence(match[0].trim());consumed=match.index+match[0].length;}
  spoken+=consumed;
  // Queue a pronounceable first phrase while the rest is still arriving.
  if(!final&&spoken===0){
   const canSegmentMandarin=soul==='mori'&&/^\s*\p{Script=Han}/u.test(text)&&typeof globalThis.Intl?.Segmenter==='function';
   if(soul==='mori'){
    const end=luluAcknowledgement.exec(text)?.[0].length||luluChineseLead(text,canSegmentMandarin);
    if(end){onSentence(text.slice(0,end).trim());spoken=end;return;}
   }
   let letters=0,end=0;
   const chars=Array.from(text);
   for(let i=0;i<chars.length;i++){
    const ch=chars[i];end+=ch.length;if(/[\p{L}\p{N}]/u.test(ch))letters++;
    const boundary=/[\s,，;；:：.!?。！？]/u.test(ch);
    const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch);
    const canSplitCharacter=cjk&&!canSegmentMandarin;
    if((letters>=5&&(canSplitCharacter||boundary))||(letters>=2&&/[,，;；:：]/u.test(ch))){
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
