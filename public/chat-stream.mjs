import {conversationServiceError} from './conversation-limits.mjs';
// Shared bounded readers: provider SSE stays on the server; the client sees text only.
export async function readProviderChat(response,onDelta,providerError=()=>Error('invalid_stream')){
 if(!response.headers.get('content-type')?.includes('text/event-stream')||!response.body)throw Error('invalid_stream');
 const decoder=new TextDecoder();let pending='',text='',finished=false,reason;
 async function line(raw){
  if(!raw.startsWith('data:'))return;const data=raw.slice(5).trim();if(data==='[DONE]'){finished=true;return;}if(!data)return;
  const event=JSON.parse(data);if(event.error||event.code)throw providerError(event);const choice=event.choices?.[0];
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
function chineseLead(input){
 const text=input.trimStart(),start=input.length-text.length;
 const pause=/^\p{Script=Han}+[，、；：…～—]+/u.exec(text);
 if(pause)return start+pause[0].length;
 const finalParticle=/^\p{Script=Han}{1,9}[吧呀啦呢嘛啊哦](?:[，、…～]+|$)/u.exec(text);
 if(finalParticle)return start+finalParticle[0].length;
 // A word boundary alone can leave a modifier hanging ("我们一起", "前面的").
 // Recognize complete short invitations without separating 看看 or dropping a particle.
 const action=/^(?:(?:我们|咱们|你|我)?(?:一起|先|再)?(?:慢慢来|慢点骑|歇一歇|歇会儿|试试看|看看|等等我|缓一缓|歇歇脚|放松点|停一下)|别着急|不用急|我陪你)(?=\p{Script=Han})/u.exec(text);
 return action?start+action[0].length:0;
}

const englishPhrase=/^(?:slow down|easy does it|take it easy|hold on|hang on|ride on|let['’]s (?:ride|rest|stop)|sounds (?:good|great)|that sounds (?:good|great|lovely|fun)|i(?:'m|’m| am) here|i know|keep going|good idea|half an hour)$/iu;
const koreanEnding=/(?:요|죠|하네|좋네|있네|같네|구나|잖아|할게|갈게|볼게|같아|좋아|괜찮아|하자|가자|보자|쉬자|천천히 가|알겠어|좋겠다|싶다)$/u;
const clauseJoin=/^\s*(?:(?:but|because|while|although|so that|and then)\b|(?:그런데|하지만|그러니까|그러면)\s)/iu;
function firstPhraseEnd(text,soul){
 const han=/^\s*\p{Script=Han}/u.test(text);
 const chinese=han?chineseLead(text):0;
 if(chinese)return chinese;
 // Prefer the speaker's punctuation when more than one boundary arrived together.
 let early=0;
 for(const match of text.matchAll(/[\s,，、;；:：…~～—]+/gu)){
  const prefix=text.slice(0,match.index).trim();
  const letters=prefix.match(/[\p{L}\p{N}]/gu)?.length||0;
  const pause=/\S/u.test(match[0]),end=match.index+match[0].length;
  if(!letters||abbreviation.test(prefix))continue;
  if(/\d$/u.test(prefix)&&/^[,:]/u.test(match[0]))continue;
  if(/^(?:https?|ftp)$/iu.test(prefix)&&match[0][0]===':')continue;
  if(pause&&(letters>=2||acknowledgement.test(prefix)))return end;
  if(pause)continue;
  if(shortPhrase.test(prefix)||englishPhrase.test(prefix)||soul==='mori'&&/^[a-z]/iu.test(prefix)&&acknowledgement.test(prefix)){early=end;continue;}
  if(/^\p{Script=Hangul}/u.test(prefix)&&koreanEnding.test(prefix)){early=end;continue;}
  if(letters>=8&&clauseJoin.test(text.slice(end)))early=end;
 }
 return early;
}

export function createVoiceSentenceReader(soul,onSentence){
 let spoken=0;
 return (text,final=false)=>{
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
}

export async function readVoiceReply(response,{soul,onText,onSentence}){
 const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',text='',result;
 const sentences=createVoiceSentenceReader(soul,onSentence);
 const line=raw=>{
  if(!raw.trim())return;const frame=JSON.parse(raw);if(frame.error)throw conversationServiceError(frame,response.headers);if(result)throw Error('invalid_response');
  if(frame.type==='delta'&&typeof frame.text==='string'){text+=frame.text;if(text.length>10000)throw Error('invalid_response');onText(text);sentences(text);}
  else if(frame.type==='complete'&&frame.soul===soul&&typeof frame.reply==='string'&&frame.reply.trim()===text.trim()){result=frame;sentences(text,true);}
  else throw Error('invalid_response');
 };
 try{while(!result){const chunk=await reader.read();if(chunk.done)break;pending+=decoder.decode(chunk.value,{stream:true});if(pending.length>131072)throw Error('invalid_response');let end;while((end=pending.indexOf('\n'))>=0){line(pending.slice(0,end));pending=pending.slice(end+1);}}if(!result)throw Error('incomplete_response');return result;}
 finally{await reader.cancel().catch(()=>{});}
}
