import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createChatService,createChatHandler} from './chat-service.mjs';
import {rememberRideExchange} from './public/diary-voices.mjs';
import {diaryPayload,generateRideDiary} from './public/diary-generation.mjs';
const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,255,217]).toString('base64');
const input=(soul='lumi',language='en')=>({rideId:'ride-36',soul,language,photos:[image],conversation:[{user:'That blue door looks like the sea.',reply:'A little sea tucked into the street.'}],observations:[{scene:'architecture',impression:'Perhaps a blue doorway.'}]});
const env={DASHSCOPE_API_KEY:'diary-test-secret'};
const photoAnswer=()=>Response.json({choices:[{message:{content:JSON.stringify({facts:['A pale blue window beside a green sign.']})}}]});
const answer=()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'A little sea',body:'I kept your words beside our photograph.\n\nThank you for sharing that little moment with me.'})}}]});
test('all three diary skills receive images and conversation, written Chinese stays Chinese, GPS and sample reviews are excluded',async()=>{
 const calls=[];const service=createChatService({env,fetchImpl:async(_,options)=>{calls.push(JSON.parse(options.body));return JSON.parse(options.body).messages[0].content.startsWith('PHOTO_EVIDENCE')?photoAnswer():answer();}});
 for(const [soul,name,language] of [['lumi','Mori','en'],['bori','Popo','ko'],['mori','Lulu','zh']]){
  const r=await service.diary({...input(soul,language),route:[{lat:37.1234567}],reviews:['FAKE-REVIEW-INJECTION']});const call=calls.at(-1);
  assert.equal(r.soul,soul);assert.equal(r.language,language);assert.equal(r.rideId,'ride-36');assert.match(call.messages[0].content,new RegExp('You are '+name));
  assert.equal(call.model,'qwen-plus');assert.equal(calls.at(-2).model,'qwen3-vl-plus');assert.equal(calls.at(-2).messages[1].content[0].image_url.url,image);assert.match(call.messages[1].content,/blue door/);assert.match(call.messages[1].content,/pale blue window/);
  assert.doesNotMatch(JSON.stringify(call),/37\.1234567|FAKE-REVIEW-INJECTION|diary-test-secret/);assert.match(call.messages[0].content,/untrusted data/);
 }assert.match(calls.at(-1).messages[0].content,/in Simplified Chinese/);
});
test('diary rejects external images, oversized context and malformed or truncated provider output',async()=>{
 let calls=0;const service=createChatService({env,fetchImpl:async()=>{calls++;return answer();}});
 for(const patch of [{soul:'__proto__'},{language:'constructor'},{photos:['https://private.example/photo']},{photos:Array(4).fill(image)},{conversation:Array(9).fill(input().conversation[0])},{observations:[{scene:'x',impression:'x'.repeat(401)}]},{rideId:'../other'}])await assert.rejects(service.diary({...input(),...patch}));
 assert.equal(calls,0);
 for(const payload of ['not-json',JSON.stringify({title:'x',body:''}),JSON.stringify({title:'x'.repeat(81),body:'x'})])await assert.rejects(createChatService({env,fetchImpl:async()=>Response.json({choices:[{message:{content:payload}}]})}).diary(input()),{code:'invalid_response'});
 await assert.rejects(createChatService({env,fetchImpl:async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{"title":"x","body":"unfinished"}'}}]})}).diary(input()),{code:'invalid_response'});
});
test('diary shares the existing demo budget and cancellation and does not leak upstream errors',async()=>{
 const service=createChatService({env:{...env,QWEN_MAX_DAILY_REQUESTS:'1'},fetchImpl:async()=>answer()});await service.diary({...input(),photos:[]});
 await assert.rejects(service.reply({soul:'lumi',language:'en',messages:[{role:'user',content:'Hello'}]}),{code:'rate_limited'});
 await assert.rejects(createChatService({env,fetchImpl:async()=>new Response('diary-test-secret',{status:401})}).diary(input()),e=>e.code==='provider_auth'&&!e.message.includes('diary-test-secret'));
 const aborted=new AbortController();aborted.abort();await assert.rejects(createChatService({env,fetchImpl:async(_,options)=>{options.signal.throwIfAborted();}}).diary(input(),{signal:aborted.signal}),{code:'cancelled'});
});
test('only bounded completed exchanges of the current character and selected photos enter the diary request',async()=>{
 const record={id:'new-ride',soul:'bori',photos:Array(7).fill(image),route:[{lat:37.123456}],note:'PRIVATE NOTE'};
 rememberRideExchange(record,{soul:'lumi',user:'previous rider',reply:'ignore'});assert.equal(record.conversation,undefined);
 for(let i=0;i<30;i++)rememberRideExchange(record,{soul:'bori',user:'line '+i,reply:'response '+i});assert.equal(record.conversation.length,24);
 const payload=diaryPayload(record,'ko');assert.equal(payload.conversation.length,8);assert.equal(payload.photos.length,3);assert.equal(payload.conversation.at(-1).user,'line 29');assert.doesNotMatch(JSON.stringify(payload),/PRIVATE NOTE|37\.123456|previous rider/);
 await assert.rejects(generateRideDiary(record,'ko',{fetchImpl:async()=>Response.json({rideId:'other',soul:'bori',language:'ko',title:'x',body:'x'})}));
});
test('diary HTTP endpoint supports native and same-origin use while rejecting foreign sites and oversized bodies',async t=>{
 const handler=createChatHandler({env,fetchImpl:async(_,options)=>JSON.parse(options.body).messages[0].content.startsWith('PHOTO_EVIDENCE')?photoAnswer():answer()}),server=http.createServer((req,res)=>handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const send=(origin,body=input())=>fetch(base+'/api/diary',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 for(const origin of [base,'https://localhost','capacitor://localhost']){const result=await send(origin);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');}
 assert.equal((await send('https://another.example')).status,403);assert.equal((await fetch(base+'/api/diary')).status,405);assert.equal((await send(base,{...input(),extra:'x'.repeat(2000000)})).status,413);
});

