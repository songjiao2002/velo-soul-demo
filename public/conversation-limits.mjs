// Byte envelopes protect the HTTP and WebSocket transports. They are not
// model token settings. A fresh turn always goes to the model in full.
export const CHAT_REQUEST_BYTES=2*1024*1024;
export const TRANSCRIPT_FRAME_BYTES=1024*1024;
const historyBytes=CHAT_REQUEST_BYTES/2, encoder=new TextEncoder();

// Keep the newest uninterrupted run of complete turns that fits this request.
export function conversationMessages(history,text){
 const messages=[{role:'user',content:text}];
 let size=encoder.encode(JSON.stringify(messages[0])).byteLength;
 for(let i=history.length-2;i>=0;i-=2){
  const user=history[i],assistant=history[i+1];
  if(user.role!=='user'||assistant.role!=='assistant')break;
  const turnSize=encoder.encode(JSON.stringify([user,assistant])).byteLength;
  if(size+turnSize>historyBytes)break;
  messages.unshift(user,assistant);
  size+=turnSize;
 }
 return messages;
}

export const COMMUNICATION_LIMIT_COPY={
 en:{
  service_busy:'Other requests are still finishing.',
  minute_limit:'The project has reached its limit for this minute.',
  provider_rate_limited:'The AI service is handling too many requests right now.',
  daily_limit:'The project has used its daily allowance. Try again after it resets.',
  provider_quota:'The AI account has no available quota. Contact the project owner to check it.',
  rate_limited:'Requests are limited right now. Please try again later.'
 },
 ko:{
  service_busy:'아직 처리 중인 요청이 있어요.',
  minute_limit:'프로젝트의 분당 요청 한도에 도달했어요.',
  provider_rate_limited:'지금은 AI 서비스에 요청이 몰렸어요.',
  daily_limit:'프로젝트의 오늘 사용량을 다 썼어요. 한도가 초기화되면 다시 이용할 수 있어요.',
  provider_quota:'AI 계정에 사용 가능한 할당량이 없어요. 프로젝트 관리자에게 확인해주세요.',
  rate_limited:'지금은 요청이 제한돼요. 잠시 후 다시 시도해주세요.'
 },
 zh:{
  service_busy:'还有请求正在处理。',
  minute_limit:'项目已达到本分钟的请求上限。',
  provider_rate_limited:'AI 服务当前收到的请求过多。',
  daily_limit:'项目今天的用量已达上限，额度重置后可以继续。',
  provider_quota:'AI 账号已没有可用额度，请联系项目管理员检查。',
  rate_limited:'请求暂时受限，请稍后再试。'
 }
};

export function conversationServiceError(data,headers,fallback='network'){
 const error=new Error(typeof data?.error==='string'&&data.error?data.error:fallback);
 for(const value of [data?.retryAfter,headers?.get?.('Retry-After')]){
  const seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds>0){error.retryAfter=Math.ceil(seconds);break;}
 }
 return error;
}

export function retryAfterLabel(language,seconds){
 if(!seconds)return '';
 if(language==='zh')return ` ${seconds} 秒后可重试。`;
 if(language==='ko')return ` ${seconds}초 후 다시 시도할 수 있어요.`;
 return ` Try again in ${seconds} ${seconds===1?'second':'seconds'}.`;
}

export const isConversationLimit=code=>Object.hasOwn(COMMUNICATION_LIMIT_COPY.en,code);
