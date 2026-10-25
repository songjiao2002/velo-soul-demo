import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {SceneGate} from './public/vision-core.mjs';
import {SoulVisionObserver,captureVisionFrame} from './public/soul-vision.mjs';
import {validateVision,createChatService,createChatHandler} from './chat-service.mjs';
const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,2,255,217]).toString('base64');
const body={soul:'lumi',language:'zh',image};
const observed={soul:'lumi',scene:'purple_vehicle',confidence:.92,shouldSpeak:true,reply:'That purple car looks like a little grape on wheels!'};
const json=(v,status=200)=>new Response(JSON.stringify(v),{status});
const upstream=v=>json({choices:[{message:{content:JSON.stringify(v)},finish_reason:'stop'}]});

test('vision accepts only bounded inline JPEG data, never remote URLs or arbitrary bodies',()=>{
 assert.equal(validateVision(body).language,'en');
 for(const value of ['https://example.com/private.jpg','data:image/png;base64,aaaa','data:image/jpeg;base64,YmFk','data:image/jpeg;base64,'+'a'.repeat(650001)])assert.throws(()=>validateVision({...body,image:value}),{code:'invalid_image'});
});
test('vision uses Qwen VL with supplied frame and validated structured output',async()=>{
 let sent;const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},fetchImpl:async(_,options)=>{sent=JSON.parse(options.body);return upstream(observed);}});
 const result=await service.reply(body,{vision:true});assert.equal(result.reply,observed.reply);assert.equal(result.scene,'purple_vehicle');assert.equal(sent.model,'qwen3-vl-plus');assert.equal(sent.response_format.type,'json_object');assert.equal(sent.messages[1].content[0].image_url.url,image);assert.match(sent.messages[0].content,/You are Mori/);assert.match(sent.messages[0].content,/English/);assert.doesNotMatch(JSON.stringify(result),/base64|test-only/);
});
test('unclear or low-confidence observations stay quiet and malformed output is rejected',async()=>{
 for(const result of [{...observed,confidence:.3},{...observed,scene:'unclear'},{...observed,shouldSpeak:false}]){
  const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},fetchImpl:async()=>upstream(result)});const response=await service.reply(body,{vision:true});assert.equal(response.shouldSpeak,false);assert.equal(response.reply,'');
 }
 const service=createChatService({env:{DASHSCOPE_API_KEY:'test-only'},fetchImpl:async()=>upstream({...observed,scene:'invented-category'})});await assert.rejects(service.reply(body,{vision:true}),{code:'invalid_response'});
});
test('scene gate avoids repetition and rapid interruptions',()=>{
 const gate=new SceneGate();assert.equal(gate.accept(observed,0),true);assert.equal(gate.accept(observed,60000),false);assert.equal(gate.accept({...observed,scene:'trees'},1000),false);assert.equal(gate.accept({...observed,scene:'trees'},60000),true);assert.equal(gate.accept(observed,181000),true);assert.equal(gate.accept({...observed,scene:'unclear'},400000),false);
});
test('observer sends no frames until explicitly started and configured',async()=>{
 let captures=0,calls=0;const states=[];const observer=new SoulVisionObserver({capture:()=>{captures++;return image;},fetchImpl:async()=>{calls++;return json({configured:false});},onState:s=>states.push(s)});
 assert.equal(calls,0);assert.equal(captures,0);await observer.start('lumi','zh');assert.equal(captures,0);assert.equal(calls,1);assert.equal(observer.active,false);assert.equal(states.at(-1),'not_configured');
});
test('stopping camera observation aborts requests and ignores late replies',async()=>{
 let resolveFrame,signal,calls=0,replies=0;const observer=new SoulVisionObserver({capture:()=>image,onReply:()=>replies++,fetchImpl:async(url,options)=>{calls++;if(url.endsWith('/status'))return json({configured:true});signal=options.signal;return await new Promise(r=>resolveFrame=r);}});
 const pending=observer.start('lumi','zh');while(!resolveFrame)await new Promise(r=>setTimeout(r,1));observer.stop();assert.equal(signal.aborted,true);resolveFrame(json(observed));await pending;assert.equal(replies,0);assert.equal(calls,2);assert.equal(observer.active,false);
});
test('a conversation starting during analysis suppresses the camera reply',async()=>{
 let available=true,replies=0;const observer=new SoulVisionObserver({capture:()=>image,canObserve:()=>available,onReply:()=>replies++,fetchImpl:async url=>{if(url.endsWith('/status'))return json({configured:true});available=false;return json(observed);}});
 await observer.start('lumi','en');observer.stop();assert.equal(replies,0);
});
test('camera sampling uses only the video image at a bounded resolution',()=>{
 const old=globalThis.document,video={readyState:4,videoWidth:1080,videoHeight:1920};let drawn,canvas;
 globalThis.document={createElement:()=>canvas={getContext:()=>({drawImage:(...args)=>drawn=args}),toDataURL:(type,q)=>{assert.equal(type,'image/jpeg');assert.equal(q,.65);return image;}}};
 try{assert.equal(captureVisionFrame(video),image);assert.equal(canvas.width,360);assert.equal(canvas.height,640);assert.equal(drawn[0],video);}finally{globalThis.document=old;}
});
test('vision HTTP route is private to same-origin usage and shares chat budget',async t=>{
 const handler=createChatHandler({env:{DASHSCOPE_API_KEY:'test',QWEN_MAX_DAILY_REQUESTS:'1'},fetchImpl:async()=>upstream(observed)});
 const app=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.statusCode=404;res.end();}});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const base='http://127.0.0.1:'+app.address().port;
 const send=origin=>fetch(base+'/api/vision',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
 assert.equal((await send('https://another-site.example')).status,403);assert.equal((await send(base)).status,200);
 const r=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({soul:'lumi',language:'en',messages:[{role:'user',content:'Hello'}]})});assert.equal(r.status,429);assert.equal((await r.json()).error,'rate_limited');
});
