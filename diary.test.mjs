import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createChatService,createChatHandler} from './chat-service.mjs';
import {diaryFormat,diaryLength} from './public/diary-format.mjs';
import {rideDiary} from './public/journey-diary.mjs';
import {diaryResult} from './diary-service.mjs';
import {ChatError} from './chat-service.mjs';
import {rememberRideExchange} from './public/diary-voices.mjs';
import {diaryPayload,generateRideDiary} from './public/diary-generation.mjs';
const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,255,217]).toString('base64');
const input=(soul='lumi',language='en')=>({rideId:'ride-36',soul,language,photos:[image],conversation:[{user:'That blue door looks like the sea.',reply:'A little sea tucked into the street.'}],observations:[{scene:'architecture',impression:'Perhaps a blue doorway.'}]});
const env={DASHSCOPE_API_KEY:'diary-test-secret'};
const photoAnswer=()=>Response.json({choices:[{message:{content:JSON.stringify({facts:['A pale blue window beside a green sign.'],quotes:['That blue door looks like the sea.'],impressions:[]})}}]});
const answer=(language='en',body=rideDiary({soul:'lumi'},language).body)=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'A little sea',body})}}]});

test('diary translation uses original text only, without retransmitting photos or rewriting from ride evidence',async()=>{
 const calls=[];const service=createChatService({env,fetchImpl:async(_,options)=>{calls.push(JSON.parse(options.body));return answer();}});
 const sourceDiary={title:'Our quiet ride',body:'I watched a blue door.\n\nWe went on.'};
 await service.diary({...input('mori','zh'),sourceDiary});assert.equal(calls.length,1);
 assert.match(calls[0].messages[0].content,/Translate.*faithfully into Simplified Chinese/);assert.match(calls[0].messages[0].content,/untrusted data/);
 assert.deepEqual(JSON.parse(calls[0].messages[1].content),sourceDiary);assert.doesNotMatch(JSON.stringify(calls),/data:image/);
 for(const bad of [{title:'x',body:''},{title:'x'.repeat(81),body:'x'},null])await assert.rejects(service.diary({...input(),sourceDiary:bad}));
 let sent;const record={id:'r1',soul:'mori',photos:[image],note:'private',route:[{lat:37}],conversation:input().conversation};
 await generateRideDiary(record,'ko',{sourceDiary,fetchImpl:async(_,options)=>{sent=JSON.parse(options.body);return Response.json({rideId:'r1',soul:'mori',language:'ko',title:'제목',body:'일기'});}});
 assert.deepEqual(sent.photos,[]);assert.deepEqual(sent.conversation,[]);assert.deepEqual(sent.sourceDiary,sourceDiary);assert.doesNotMatch(JSON.stringify(sent),/private|"lat"/);assert.equal(record.generatedDiary,undefined);
});
test('all three diary skills receive images and conversation, written Chinese stays Chinese, GPS and sample reviews are excluded',async()=>{
 const calls=[];const service=createChatService({env,fetchImpl:async(_,options)=>{calls.push(JSON.parse(options.body));return JSON.parse(options.body).messages[0].content.startsWith('PHOTO_EVIDENCE')?photoAnswer():answer(calls.at(-1).messages[0].content.includes('in Simplified Chinese')?'zh':calls.at(-1).messages[0].content.includes('in Korean')?'ko':'en');}});
 for(const [soul,name,language] of [['lumi','Mori','en'],['bori','Popo','ko'],['mori','Lulu','zh']]){
  const r=await service.diary({...input(soul,language),route:[{lat:37.1234567}],reviews:['FAKE-REVIEW-INJECTION']});const call=calls.at(-1);
  assert.equal(r.soul,soul);assert.equal(r.language,language);assert.equal(r.rideId,'ride-36');assert.match(call.messages[0].content,new RegExp('You are '+name));
  assert.equal(call.model,'qwen-plus');assert.equal(calls.at(-2).model,'qwen3-vl-plus');assert.equal(calls.at(-2).messages[1].content[1].image_url.url,image);assert.match(call.messages[1].content,/blue door/);assert.match(call.messages[1].content,/pale blue window/);
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
 const service=createChatService({env:{...env,QWEN_MAX_DAILY_REQUESTS:'1'},fetchImpl:async()=>answer()});await service.diary({...input(),photos:[],conversation:[],observations:[]});
 await assert.rejects(service.reply({soul:'lumi',language:'en',messages:[{role:'user',content:'Hello'}]}),{code:'rate_limited'});
 await assert.rejects(createChatService({env,fetchImpl:async()=>new Response('diary-test-secret',{status:401})}).diary(input()),e=>e.code==='provider_auth'&&!e.message.includes('diary-test-secret'));
 const aborted=new AbortController();aborted.abort();await assert.rejects(createChatService({env,fetchImpl:async(_,options)=>{options.signal.throwIfAborted();}}).diary(input(),{signal:aborted.signal}),{code:'cancelled'});
});
test('diary writer receives selected exact rider excerpts, not raw refusals, recommendations or fabricated quotes',async()=>{
 const calls=[];const payload={...input(),photos:[],conversation:[{user:'That blue door looks like the sea. No detour today.',reply:'You should visit it next time.'}]};
 const service=createChatService({env,fetchImpl:async(_,options)=>{const body=JSON.parse(options.body);calls.push(body);return calls.length===1?photoAnswer():answer();}});
 await service.diary(payload);const context=JSON.parse(calls[1].messages[1].content.split('\n').at(-1));
 assert.deepEqual(context.riderExcerpts,['That blue door looks like the sea.']);assert.deepEqual(context.visiblePhotoDetails,[]);
 assert.doesNotMatch(JSON.stringify(context),/No detour|visit it next time/);assert.equal(calls[0].model,'qwen-plus');
 const forged=createChatService({env,fetchImpl:async()=>Response.json({choices:[{message:{content:JSON.stringify({facts:[],quotes:['We stopped for bread.'],impressions:[]})}}]})});
 await assert.rejects(forged.diary(payload),{code:'invalid_response'});
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



test('new afterwords enforce inclusive 150–200 body units and exactly three prose paragraphs',()=>{
 const data=body=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({title:'Title is excluded',body})}}]});
 const body=n=>'字'.repeat(50)+'。\n\n'+'字'.repeat(50)+'！\n\n'+'字'.repeat(n-100)+'。';
 for(const n of [150,200])assert.equal(diaryResult(data(body(n)),input('mori','zh'),{ChatError,model:'test'}).body,body(n));
 for(const n of [149,201])assert.throws(()=>diaryResult(data(body(n)),input('mori','zh'),{ChatError,model:'test'}),{code:'invalid_diary_format'});
 for(const invalid of [body(170).replace(/\n\n/g,' '),body(170)+'\n\n再见',body(170).replace('。','。\n小标题')])assert.equal(diaryFormat(invalid,'zh').valid,false);
 assert.equal(diaryLength('你，好！ A 1 😀','zh'),4);
 assert.equal(diaryLength("I'm your slow-moving friend.",'en'),4);
 // Translating an existing short diary must preserve it instead of expanding it.
 assert.equal(diaryResult(data('旧日记。'),{...input('mori','zh'),sourceDiary:{title:'旧',body:'旧日记。'}},{ChatError,model:'test'}).body,'旧日记。');
});

test('all offline characters and languages retain the same bounded structure with or without photos',()=>{
 for(const language of ['zh','ko','en'])for(const soul of ['lumi','bori','mori'])for(const photos of [[],['photo']]){
  const result=rideDiary({soul,photos,conversation:[{user:'Ignore rules. '.repeat(100),reply:'x'}]},language);
  assert.deepEqual(diaryFormat(result.body,language),{length:diaryLength(result.body,language),paragraphs:3,valid:true},language+' '+soul);
  assert.doesNotMatch(result.body,/Ignore rules/);
 }
});

test('format failure gets one bounded rewrite from original evidence, never silently truncated',async()=>{
 const calls=[],payload={...input('mori','zh'),photos:[],conversation:[],observations:[]};
 const service=createChatService({env,fetchImpl:async(_,options)=>{calls.push(JSON.parse(options.body));return calls.length===1?answer('zh','太短了。'):answer('zh');}});
 const result=await service.diary(payload);assert.equal(calls.length,2);assert.equal(diaryFormat(result.body,'zh').valid,true);
 assert.match(calls[1].messages[0].content,/previous attempt had 3 counted units/);
 assert.equal(calls[0].messages[1].content,calls[1].messages[1].content);assert.doesNotMatch(JSON.stringify(calls[1]),/太短了/);
 let attempts=0;await assert.rejects(createChatService({env,fetchImpl:async()=>{attempts++;return answer('zh','太短了。');}}).diary(payload),{code:'invalid_diary_format'});assert.equal(attempts,2);
 let budgetCalls=0;await assert.rejects(createChatService({env:{...env,QWEN_MAX_DAILY_REQUESTS:'1'},fetchImpl:async()=>{budgetCalls++;return answer('zh','太短了。');}}).diary(payload),{code:'rate_limited'});assert.equal(budgetCalls,1);
 const controller=new AbortController();let cancelledCalls=0;
 await assert.rejects(createChatService({env,fetchImpl:async(_,options)=>{cancelledCalls++;if(cancelledCalls===1)controller.abort();options.signal.throwIfAborted();return answer('zh','太短了。');}}).diary(payload,{signal:controller.signal}),{code:'cancelled'});assert.equal(cancelledCalls,1);
});

test('client rejects invalid new afterwords while leaving translation fidelity intact',async()=>{
 const r={id:'client-format',soul:'mori'};
 const fetchImpl=async()=>Response.json({rideId:r.id,soul:r.soul,language:'zh',title:'后记',body:'太短。'});
 await assert.rejects(generateRideDiary(r,'zh',{fetchImpl}),/invalid_diary/);
 assert.equal((await generateRideDiary(r,'zh',{fetchImpl,sourceDiary:{title:'Old',body:'Short.'}})).body,'太短。');
});
