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

const acknowledgement=/^(?:hm+|m{2,}|oh|ah|hi|hey|ok(?:ay)?|sure|well|yeah|yes|yep|no|nope|음+|응+|어|아|네|그래|좋아|좋지|맞아|잠깐|嗯+|哦|好|好呀|好啊|行|行呀|对|对呀)$/iu;
const shortPhrase=/^(?:I see|on it|go on|got it|all set|go ahead|let['’]s go|thank you|thanks|go|가요|좋아요|그래요|괜찮아요|같이 가요|가자|好呀|好啊|走吧|可以)$/iu;
// A final period from one delta may still be the middle of a title, an
// initial, a decimal or a domain. Require lookahead unless the phrase is known.
const abbreviation=/(?:\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|e\.g|i\.e)|\b(?:[a-z]\.)*[a-z])\.$/iu;
function sentenceDot(text,end){
 const prefix=text.slice(0,end);
 if(abbreviation.test(prefix)||text[end]&&!/\s/u.test(text[end]))return false;
 if(end<text.length)return true;
 const phrase=prefix.slice(0,-1).trim();
 return shortPhrase.test(phrase)||acknowledgement.test(phrase);
}
let chineseWords;
function chineseLead(input){
 // Keep the last word in the buffer; the next delta may continue it (看 → 看看).
 const text=input.trimStart(),start=input.length-text.length;
 const pause=/^\p{Script=Han}{1,8}[，、；：…～—]+/u.exec(text);
 if(pause)return start+pause[0].length;
 const finalParticle=/^\p{Script=Han}{2,4}[吧呀啦呢嘛啊哦](?:[，、…～]+|$)/u.exec(text);
 if(finalParticle)return start+finalParticle[0].length;
 if(typeof globalThis.Intl?.Segmenter!=='function'){
  // Five characters plus one lookahead bounds startup on older WebViews.
  // Keep a reduplicated verb (看看、走走) together in the next speech chunk.
  const match=/^\p{Script=Han}{6}/u.exec(text);
  if(!match)return 0;
  const chars=Array.from(match[0]),count=chars[4]===chars[5]?4:5;
  return start+chars.slice(0,count).join('').length;
 }
 if(!/^\p{Script=Han}{4}/u.test(text))return 0;
 chineseWords??=new Intl.Segmenter('zh',{granularity:'word'});
 let end=0;
 for(const {index} of chineseWords.segment(text)){
  if(index>5)break;
  if(index>=3)end=index;
 }
 return end?start+end:0;
}

function firstPhraseEnd(text,soul){
 const han=/^\s*\p{Script=Han}/u.test(text);
 const chinese=han?chineseLead(text):0;
 if(chinese)return chinese;
 // Wait for a real word boundary in space-delimited speech.
 for(const match of text.matchAll(/[\s,，、;；:：…~～—]+/gu)){
  const prefix=text.slice(0,match.index).trim();
  const letters=prefix.match(/[\p{L}\p{N}]/gu)?.length||0;
  const pause=/\S/u.test(match[0]),end=match.index+match[0].length;
  if(!letters||abbreviation.test(prefix))continue;
  // An article belongs to the following noun ("half an hour").
  if(!pause&&/\b(?:a|an|the)$/iu.test(prefix))continue;
  if(/\d$/u.test(prefix)&&/^[,:]/u.test(match[0]))continue;
  if(/^(?:https?|ftp)$/iu.test(prefix)&&match[0][0]===':')continue;
  if(shortPhrase.test(prefix)||acknowledgement.test(prefix)&&(pause||soul==='mori'))return end;
  if(pause?letters>=2:letters>=5)return end;
 }
 return 0;
}

export async function readVoiceReply(response,{soul,onText,onSentence}){
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',text='',spoken=0,result;
 const sentences=final=>{
  const remaining=text.slice(spoken);
  let consumed=0;
  for(const match of remaining.matchAll(/[。！？!?]+|\.+/gu)){
   const end=match.index+match[0].length;
   if(match[0][0]==='.'&&(match[0].length!==1||!sentenceDot(remaining,end)))continue;
   const phrase=remaining.slice(consumed,end).trim();
   if(/[\p{L}\p{N}]/u.test(phrase))onSentence(phrase);
   consumed=end;
  }
  spoken+=consumed;
  // Queue a pronounceable first phrase while the rest is still arriving.
  if(!final&&spoken===0){
   const end=firstPhraseEnd(text,soul);
   if(end){onSentence(text.slice(0,end).trim());spoken=end;}
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
