import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HandsFreeConversation} from './public/hands-free.mjs';
import {createVoiceSentenceReader} from './public/chat-stream.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function setup(fetchImpl,options={}){
 const recognizers=[],calls=[],voices=[],states=[],timers=new Map();let timerId=0,stops=0;
 class Recognition{constructor(){recognizers.push(this);}start(){this.active=true;this.onstart?.();}abort(){this.active=false;}stop(){this.active=false;this.onend?.();}hear(text){this.onspeechstart?.();this.onresult?.({results:[{0:{transcript:text},isFinal:true}]});}}
 const session=new HandsFreeConversation({Recognition,fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body),signal:options.signal});return fetchImpl?fetchImpl(url,options):new Response(JSON.stringify({soul:'bori',reply:'A little cafe break sounds lovely.'}));},getContext:()=>({context:{location:{placeId:'daelim-changgo'}},image:'synthetic-image-for-client-unit-test'}),speak:(text,lang,soul,callback)=>{assert.equal(recognizers.some(r=>r.active&&r!==session.interruptRecognizer),false);voices.push({text,lang,callback});},stopSpeech:()=>stops++,onState:s=>states.push(s),setTimer:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimer:id=>timers.delete(id),...options});
 const run=ms=>{const entry=[...timers.entries()].find(([,t])=>t.ms===ms);assert.ok(entry,'timer '+ms);timers.delete(entry[0]);entry[1].fn();};
 return {session,recognizers,calls,voices,states,timers,run,get stops(){return stops;}};
}
test('spoken input sends automatically with context, replies aloud, then resumes and preserves history',async()=>{
 const a=setup();a.session.start('bori','zh');assert.equal(a.recognizers[0].lang,'zh-CN');
 a.recognizers[0].hear('你看到什么？');await flush();assert.equal(a.calls.length,1);assert.equal(a.calls[0].url,'/api/chat/scene');assert.equal(a.calls[0].body.language,'zh');assert.equal(a.voices.length,1);
 assert.equal(a.recognizers[0].active,false);a.voices[0].callback('ended');a.run(100);assert.equal(a.recognizers.at(-1).active,true);
 a.recognizers.at(-1).hear('Tell me more');await flush();assert.equal(a.calls[1].body.messages.length,3);a.session.stop();assert.equal(a.timers.size,0);
});
test('changing languages in a ride cancels the old reply while preserving the companion and completed turns',async()=>{
 let finishOld;
 const a=setup((url,options)=>{
  const {soul,language,messages}=JSON.parse(options.body);
  if(messages.at(-1).content==='Wait a moment')return new Promise(resolve=>{finishOld=resolve;});
  return Response.json({soul,reply:language==='ko'?'기억해.':'记住了。'});
 });
 a.session.start('bori','zh');a.recognizers.at(-1).hear('我的头盔是蓝色的');await flush();
 a.voices[0].callback('ended');a.run(100);
 a.session.setLanguage('en');a.recognizers.at(-1).hear('Wait a moment');await flush();
 a.session.setLanguage('ko');assert.ok(a.calls[1].signal.aborted);
 finishOld(Response.json({soul:'bori',reply:'An obsolete English reply.'}));await flush();
 assert.equal(a.voices.length,1);assert.equal(a.session.state,'listening');
 assert.equal(a.recognizers.at(-1).lang,'ko-KR');
 a.recognizers.at(-1).hear('내 헬멧은 무슨 색이야?');await flush();
 assert.equal(a.calls[2].body.soul,'bori');assert.equal(a.calls[2].body.language,'ko');
 assert.deepEqual(a.calls[2].body.messages.map(m=>m.content),['我的头盔是蓝色的','记住了。','내 헬멧은 무슨 색이야?']);
 a.session.stop();a.session.setLanguage('zh');assert.equal(a.session.active,false);
});
test('reply-time monitoring accepts Chinese, English and Korean interruption without forwarding the command',async()=>{
 for(const [language,command] of [['zh','等一下'],['en','stop'],['ko','잠깐']]){
  const a=setup();a.session.start('bori',language);a.recognizers[0].hear('Hello');await flush();const old=a.voices[0];old.callback('playing');a.run(150);
  const monitor=a.recognizers.at(-1);assert.equal(monitor.interimResults,true);assert.equal(a.recognizers[0].active,false);
  monitor.hear(command);assert.equal(monitor.active,false);assert.equal(a.calls.length,1);assert.equal(a.session.state,'listening');
  old.callback('ended');a.run(150);assert.equal(a.recognizers.at(-1).interimResults,true);assert.equal(a.timers.size,1);a.session.stop();
 }
});
test('an interrupt may include a new question; late playback events cannot restart the old turn',async()=>{
 const a=setup();a.session.start('bori','zh');a.recognizers[0].hear('Hello');await flush();const old=a.voices[0];old.callback('playing');a.run(150);
 a.recognizers.at(-1).hear('等一下，我想喝咖啡');await flush();assert.equal(a.calls.at(-1).body.messages.at(-1).content,'我想喝咖啡');assert.equal(a.voices.length,2);
 old.callback('ended');assert.equal(a.session.state,'synthesizing');a.session.stop();assert.equal(a.timers.size,0);
});
test('stopping aborts an in-flight answer and ignores its eventual response',async()=>{
 let resolve;const a=setup(()=>new Promise(r=>resolve=r));a.session.start('bori','en');a.recognizers[0].hear('Hello');a.session.stop();assert.ok(a.calls[0].signal.aborted);
 resolve(new Response(JSON.stringify({soul:'bori',reply:'Too late'})));await flush();assert.equal(a.voices.length,0);assert.equal(a.session.active,false);
});
test('voice stop and permission denial end the loop; playback failure preserves the conversation',async()=>{
 const a=setup();a.session.start('bori','zh');a.recognizers[0].hear('停止对话');assert.equal(a.session.active,false);assert.equal(a.calls.length,0);
 a.session.start('bori','en');a.recognizers.at(-1).onerror({error:'not-allowed'});assert.equal(a.states.at(-1),'denied');assert.equal(a.timers.size,0);
 a.session.start('bori','en');a.recognizers.at(-1).hear('Hello');await flush();a.voices.at(-1).callback('blocked');assert.equal(a.states.at(-1),'audio_retry');assert.equal(a.session.active,true);a.run(1500);assert.equal(a.recognizers.at(-1).active,true);a.session.stop();assert.equal(a.timers.size,0);
});
test('automatic scene speech waits while the rider is talking',()=>{
 const a=setup();a.session.start('bori','en');a.recognizers[0].onspeechstart();assert.equal(a.session.announce('A cafe!','en'),false);assert.equal(a.recognizers[0].active,true);a.session.stop();
});

test('temporary recognition failures reconnect automatically with a bounded retry count',()=>{
 const a=setup();a.session.start('bori','en');
 for(const delay of [1500,3000,4500]){a.recognizers.at(-1).onerror({error:'network'});assert.equal(a.session.active,true);assert.equal(a.session.state,'reconnecting');a.run(delay);assert.equal(a.recognizers.at(-1).active,true);}
 a.recognizers.at(-1).onerror({error:'network'});assert.equal(a.session.active,false);assert.equal(a.session.state,'network');assert.equal(a.timers.size,0);
});

test('introduction plays before any chat/GPS request, resumes listening and does not repeat on pause',async()=>{
 const shared=new Set(),a=setup(null,{introduced:shared,getOpening:()=>({text:'안녕, 나는 포포야.',language:'ko'})});
 a.session.start('bori','ko');assert.equal(a.calls.length,0);assert.equal(a.voices[0].text,'안녕, 나는 포포야.');assert.equal(a.session.state,'synthesizing');
 assert.equal(a.session.announce('Weather','ko'),false);a.voices[0].callback('playing');assert.ok(shared.has('bori'));a.voices[0].callback('ended');a.run(100);assert.equal(a.session.state,'listening');
 a.recognizers.at(-1).hear('안녕');await flush();assert.equal(a.calls.length,1);a.voices.at(-1).callback('ended');a.session.stop();a.session.start('bori','ko');assert.equal(a.session.state,'listening');assert.equal(a.voices.length,2);a.session.stop();
 const b=setup(null,{introduced:shared,getOpening:()=>({text:'No repeated introduction',language:'ko'})});b.session.start('bori','ko');assert.equal(b.voices.length,0);b.session.stop();
});
test('failed or cancelled introduction cannot restart after exit and is retryable',()=>{
 const a=setup(null,{getOpening:()=>({text:'Hello!',language:'en'})});a.session.start('bori','en');const callback=a.voices[0].callback;a.session.stop();callback('playing');callback('ended');assert.equal(a.session.active,false);assert.equal(a.timers.size,0);assert.equal(a.session.introduced.size,0);
 a.session.start('bori','en');assert.equal(a.voices.length,2);a.voices[1].callback('blocked');assert.equal(a.session.audioIssue,true);a.session.stop();
});

test('a new spoken question interrupts the introduction; playback echoes and late events do not',async()=>{
 const transcripts=[],a=setup(null,{getOpening:()=>({text:'Hello, I am Popo. What can we discover today?',language:'en'}),onTranscript:(text,final)=>transcripts.push({text,final})});
 a.session.start('bori','en');const first=a.voices[0];first.callback('playing');a.run(150);const monitor=a.recognizers.at(-1);
 monitor.onresult({results:[{0:{transcript:'What can we discover today'},isFinal:true}]});await flush();assert.equal(a.calls.length,0);
 monitor.onresult({results:[{0:{transcript:'Can you hear'},isFinal:false}]});assert.deepEqual(transcripts.at(-1),{text:'Can you hear',final:false});assert.equal(a.calls.length,0);
 monitor.hear('Can you hear me clearly?');await flush();assert.equal(a.calls.length,1);assert.equal(a.calls[0].body.messages.at(-1).content,'Can you hear me clearly?');assert.equal(a.voices.length,2);
 first.callback('ended');assert.equal(a.session.state,'synthesizing');a.session.stop();assert.equal(a.timers.size,0);
});

test('microphone capture failures reacquire input with bounded retries, permissions do not loop',()=>{
 let releases=0;const a=setup(null,{releaseInput:()=>releases++});a.session.start('bori','en');const baseline=releases;
 for(const delay of [1500,3000,4500]){a.recognizers.at(-1).onerror({error:'audio-capture'});assert.equal(a.session.state,'audio_reconnecting');a.run(delay);}
 a.recognizers.at(-1).onerror({error:'audio-capture'});assert.equal(a.session.state,'audio-capture');assert.equal(a.session.active,false);assert.ok(releases>baseline);
 a.session.start('bori','en');a.recognizers.at(-1).onerror({error:'not-allowed'});assert.equal(a.session.state,'denied');assert.equal(a.timers.size,0);
});

test('a meaningful interim yields the floor in three languages while revisable words stay on the same microphone',async()=>{
 for(const [language,partial,final] of [
  ['en','Stop at the','Stop at the café for a minute.'],['ko','어디로 가면','어디로 가면 한강이 나와요?'],['zh','我想去','我想去前面的公园。']
 ]){
  const captions=[],a=setup(null,{getOpening:()=>({language,text:'It is a bright afternoon.'}),onTranscript:(text,confirmed)=>captions.push({text,confirmed})});
  a.session.start('mori',language);const old=a.voices[0];old.callback('playing');a.run(150);
  const mic=a.recognizers.at(-1),before=a.stops,preview=text=>mic.onresult({results:[{0:{transcript:text},isFinal:false}]});
  for(const sound of ['mmm','thank you','bright afternoon'])preview(sound);
  assert.equal(a.stops,before);assert.equal(a.calls.length,0);
  preview(partial);assert.equal(a.stops,before+1);assert.equal(a.session.state,'hearing');assert.equal(mic.active,true);
  old.callback('ended');assert.equal(a.calls.length,0);
  mic.hear(final);await flush();assert.equal(a.calls.length,1);assert.equal(a.calls[0].body.messages.at(-1).content,final);
  assert.deepEqual(captions.at(-1),{text:final,confirmed:true});a.session.stop();
 }
});

test('a rider speaking across two audio segments retains the entire utterance through final-only recognition',async()=>{
 let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
 a.session.start('bori','en');a.recognizers[0].hear('Hello');await flush();
 const frame=value=>stream.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));
 frame({type:'delta',text:'Look at that tree! '});frame({type:'delta',text:'Lovely shade!'});
 frame({type:'complete',soul:'bori',reply:'Look at that tree! Lovely shade!'});await flush();
 a.voices[0].callback('playing');a.run(150);const mic=a.recognizers.at(-1);
 mic.onspeechstart();a.voices[0].callback('ended');a.voices[1].callback('playing');
 assert.equal(a.session.interruptRecognizer,mic);const before=a.stops;
 mic.onresult({results:[{0:{transcript:'that tree lovely shade'},isFinal:false}]});
 assert.equal(a.stops,before);a.voices[1].callback('ended');assert.equal(mic.active,true);assert.equal(a.calls.length,1);
 mic.hear('Where does this path end?');await flush();
 assert.equal(a.calls.length,2);assert.equal(a.calls[1].body.messages.at(-1).content,'Where does this path end?');a.session.stop();stream.close();
});

test('temporary chat limits retry the same utterance once, respect delays and cancel cleanly',async()=>{
 for(const [code,seconds] of [['service_busy',1],['provider_rate_limited',9],['minute_limit',27],['rate_limited',3]]){
  let contexts=0;const a=setup(()=>new Response(JSON.stringify({error:code}),{status:429,headers:code==='service_busy'?{}:{'Retry-After':String(seconds)}}),{getContext:()=>({context:{capture:++contexts}})});
  a.session.start('lumi','ko');a.recognizers[0].hear('다시 물어봐도 돼?');await flush();
  assert.equal(a.session.state,code);assert.equal(a.session.active,true);assert.equal(a.session.announce('A café','en'),false);
  a.run(seconds*1000);await flush();assert.equal(a.calls.length,2);assert.deepEqual(a.calls[0].body,a.calls[1].body);assert.equal(contexts,1);
  a.run(seconds*1000);assert.equal(a.session.state,'listening');assert.equal(a.calls.length,2);a.session.stop();
 }
 const b=setup(()=>new Response(JSON.stringify({error:'service_busy'}),{status:429}));
 b.session.start('mori','en');b.recognizers[0].hear('Hello');await flush();const stale=[...b.timers.values()].find(x=>x.ms===1000).fn;
 b.session.stop();stale();await flush();assert.equal(b.calls.length,1);assert.equal(b.timers.size,0);
});

test('a rate limit after the first reply fragment never repeats the rider request',async()=>{
 const frames=[{type:'delta',text:'Sure! '},{error:'provider_rate_limited',retryAfter:8}].map(x=>JSON.stringify(x)).join('\n')+'\n';
 const a=setup(()=>new Response(frames,{headers:{'Content-Type':'application/x-ndjson'}}));
 a.session.start('mori','en');a.recognizers[0].hear('Are you there?');await flush();assert.equal(a.voices.length,1);assert.equal(a.session.state,'provider_rate_limited');
 a.voices[0].callback('ended');a.run(8000);assert.equal(a.session.state,'listening');assert.equal(a.calls.length,1);a.session.stop();
});

test('recognition respects retry timing and both voice paths expose the exact exhausted allowance',async()=>{
 const b=setup();b.session.start('mori','ko');b.recognizers[0].onerror({error:'minute_limit',retryAfter:12});
 assert.equal(b.session.state,'minute_limit');b.run(12000);assert.equal(b.session.state,'listening');b.session.stop();
 for(const code of ['daily_limit','provider_quota']){
  const a=setup(()=>new Response(JSON.stringify({error:code}),{status:429}));a.session.start('mori','en');a.recognizers[0].hear('Hi');await flush();
  assert.equal(a.session.state,code);assert.equal(a.session.active,false);assert.equal(a.timers.size,0);
  a.session.start('bori','en');a.recognizers.at(-1).onerror({error:code});assert.equal(a.session.state,code);assert.equal(a.timers.size,0);
 }
});

test('speech throttling retries a silent clip once, keeps generated text and never replays audible words',async()=>{
 for(const audible of [false,true]){
  const a=setup();a.session.start('bori','en');a.recognizers[0].hear('Any cafés?');await flush();
  const clip=a.voices[0];if(audible)clip.callback('playing');
  clip.callback('provider_rate_limited',{retryAfter:4});clip.callback('ended');
  assert.equal(a.session.active,true);assert.equal(a.session.state,'provider_rate_limited');assert.equal(a.session.histories.bori.length,2);
  a.run(4000);assert.equal(a.calls.length,1);
  if(audible){a.run(100);assert.equal(a.voices.length,1);}
  else{
   assert.equal(a.voices.length,2);assert.equal(a.voices[1].text,clip.text);
   a.voices[1].callback('service_busy');a.run(1000);a.run(100);assert.equal(a.voices.length,2);
  }
  assert.equal(a.session.state,'listening');a.session.stop();
 }
 const b=setup();b.session.start('bori','en');b.recognizers[0].hear('Hello');await flush();b.voices[0].callback('provider_quota');assert.equal(b.session.state,'provider_quota');assert.equal(b.session.active,false);
 const c=setup();c.session.start('bori','en');c.recognizers[0].hear('Hello');await flush();c.voices[0].callback('minute_limit',{retryAfter:5});const late=[...c.timers.values()].find(x=>x.ms===5000).fn;
 c.session.stop();late();assert.equal(c.voices.length,1);assert.equal(c.timers.size,0);
});

test('permission startup honors the recorder deadline and still cancels late callbacks',()=>{
 let r;class SlowPermission{constructor(){r=this;this.startTimeoutMs=50000;}start(){}abort(){}}
 const a=setup(null,{Recognition:SlowPermission});a.session.start('bori','en');assert.ok([...a.timers.values()].some(t=>t.ms===50000));assert.ok(![...a.timers.values()].some(t=>t.ms===12000));
 r.onstart();assert.equal(a.session.state,'listening');const late=r.onresult;a.session.stop();late({results:[{0:{transcript:'late'},isFinal:true}]});assert.equal(a.calls.length,0);assert.equal(a.timers.size,0);
});


test('streamed answer speaks its first sentence before completion and queues later speech without overlap',async()=>{
 let stream;const replies=[];const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}),{onReply:text=>replies.push(text)});
 a.session.start('bori','en');a.recognizers[0].hear('Hello');await flush();
 const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
 emit({type:'delta',text:'Hello there. '});await flush();assert.equal(a.voices.length,1);assert.equal(a.voices[0].text,'Hello there.');assert.equal(a.session.histories.bori.length,0);
 emit({type:'delta',text:'Let us ride.'});await flush();assert.equal(a.voices.length,1);assert.equal(replies.at(-1),'Hello there. Let us ride.');
 emit({type:'complete',soul:'bori',reply:'Hello there. Let us ride.'});await flush();assert.equal(a.session.histories.bori.length,2);assert.equal(a.voices.length,1);
 a.voices[0].callback('ended');assert.equal(a.voices.length,2);assert.equal(a.voices[1].text,'Let us ride.');a.voices[1].callback('ended');a.run(100);assert.equal(a.recognizers.at(-1).active,true);a.session.stop();
});

test('only the first spoken phrase claims each eligible voice turn, and a retry uses a fresh ID',async()=>{
 const voices=[];
 const reply='Easy! Keep pedaling.';
 const frames=[{type:'delta',text:reply},{type:'complete',soul:'bori',reply}].map(x=>JSON.stringify(x)+'\n').join('');
 let attempts=0;
 const a=setup(()=>++attempts===1?new Response(JSON.stringify({error:'service_busy'}),{status:429}):new Response(frames,{headers:{'Content-Type':'application/x-ndjson'}}),{
  getContext:()=>({}),canPrepareFirstSpeech:()=>true,speak:(text,language,soul,done,options)=>voices.push({text,language,soul,done,options})
 });
 a.session.start('bori','en');a.recognizers[0].hear('Can we slow down?');await flush();
 a.run(1000);await flush();
 const ids=a.calls.map(call=>call.body.firstSpeechId);
 assert.match(ids[0],/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i);
 assert.notEqual(ids[1],ids[0]);
 assert.deepEqual(voices[0].options,{firstSpeechId:ids[1],firstReplySegment:true});
 assert.equal(voices[0].language,'en');assert.equal(voices[0].soul,'bori');
 voices[0].done('ended');assert.equal(voices[1].options,undefined);a.session.stop();
});
test('voice turns without usable streaming output and camera queries omit early speech IDs',async()=>{
 for(const [canStream,question,image] of [[false,'Can we slow down?',false],[true,'What do you see?',false],[true,'What do you see?',true]]){
  const a=setup(null,{canPrepareFirstSpeech:()=>canStream,getContext:()=>image?{image:'frame'}:{}});
  a.session.start('bori','en');a.recognizers[0].hear(question);await flush();
  assert.equal(Object.hasOwn(a.calls[0].body,'firstSpeechId'),false);a.session.stop();
 }
});
test('English and Korean first clauses start TTS before the rest arrives without repeating text',async()=>{
 for(const [language,prefix,complement,rest] of [['en','I am feeling ','cozy,',' let us ride!'],['ko','오늘은 기분이 ','좋아,',' 같이 달리자!']]){
  let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
  a.session.start('mori',language);a.recognizers[0].hear(language==='ko'?'오늘 기분 어때?':'How are you?');await flush();
  const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
  emit({type:'delta',text:prefix});await flush();assert.equal(a.voices.length,0);
  const first=prefix+complement;
  emit({type:'delta',text:complement});await flush();assert.equal(a.voices[0].text,first);assert.equal(a.session.histories.mori.length,0);
  emit({type:'delta',text:rest});await flush();assert.equal(a.voices.length,1);
  a.voices[0].callback('ended');assert.equal(a.voices[1].text,rest.trim());
  emit({type:'complete',soul:'mori',reply:first+rest});await flush();assert.equal(a.voices.length,2);
  a.voices[1].callback('ended');a.session.stop();
 }
});

test('a talkative character preloads just the next clip and groups the remaining sentences',async()=>{
 const prepared=[];
 const reply='Look here! Over by the bridge! The birds are back. Two of them!';
 const frames=[{type:'delta',text:reply},{type:'complete',soul:'bori',reply}];
 const a=setup(()=>new Response(frames.map(frame=>JSON.stringify(frame)+'\n').join(''),{headers:{'Content-Type':'application/x-ndjson'}}),{prefetchSpeech:text=>prepared.push(text)});
 a.session.start('bori','en');a.recognizers[0].hear('What do you see?');await flush();
 assert.deepEqual(prepared,['Over by the bridge!']);
 assert.equal(a.voices[0].text,'Look here!');
 a.voices[0].callback('ended');
 assert.deepEqual(prepared,['Over by the bridge!','The birds are back. Two of them!']);
 a.voices[1].callback('ended');
 assert.equal(a.voices.map(voice=>voice.text).join(' '),reply);
 a.voices[2].callback('ended');a.session.stop();
});

test('a broken streamed answer stops already started speech and does not save a partial turn',async()=>{
 let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
 a.session.start('bori','en');a.recognizers[0].hear('Hello');await flush();stream.enqueue(new TextEncoder().encode(JSON.stringify({type:'delta',text:'Hello there. '})+'\n'));await flush();assert.equal(a.voices.length,1);const before=a.stops;stream.close();await flush();assert.ok(a.stops>before);assert.equal(a.session.histories.bori.length,0);a.session.stop();
});


test('Lulu holds the Mandarin modifier until its short action is complete, keeping 看看 together',async()=>{
 let stream;const prepared=[];const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}),{prefetchSpeech:(...args)=>prepared.push(args)});
 a.session.start('mori','zh');a.recognizers[0].hear('你看到了什么');await flush();
 const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
 emit({type:'delta',text:'我们一起'});await flush();assert.equal(a.voices.length,0);
 emit({type:'delta',text:'看'});await flush();assert.equal(a.voices.length,0);assert.equal(a.session.histories.mori.length,0);
 emit({type:'delta',text:'看河'});await flush();assert.equal(a.voices[0].text,'我们一起看看');
 emit({type:'delta',text:'边的风景吧。'});await flush();assert.equal(a.voices.length,1);assert.equal(prepared[0][0],'河边的风景吧。');
 emit({type:'complete',soul:'mori',reply:'我们一起看看河边的风景吧。'});await flush();a.voices[0].callback('ended');assert.equal(a.voices[1].text,'河边的风景吧。');
 assert.equal(a.voices.map(v=>v.text).join(''),'我们一起看看河边的风景吧。');a.session.stop();
});

test('Lulu queues complete short openings immediately in each language without guessing unfinished words',async()=>{
 for(const [language,opening,separator,rest] of [
  ['en','Sure',' ','let’s rest.'],['en','Mm','…',' shade sounds nice.'],
  ['ko','응',',',' 천천히 가자.'],['zh','嗯','，','我们慢慢骑。']
 ]){
  let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
  a.session.start('mori',language);a.recognizers[0].hear('Hello');await flush();
  const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
  emit({type:'delta',text:opening});await flush();assert.equal(a.voices.length,0);
  emit({type:'delta',text:separator});await flush();assert.equal(a.voices[0].text,(opening+separator).trim());
  emit({type:'delta',text:rest});emit({type:'complete',soul:'mori',reply:opening+separator+rest});await flush();
  a.voices[0].callback('ended');assert.equal(a.voices[1].text,rest.trim());
  a.voices[1].callback('ended');a.session.stop();
 }
});

test('without a word segmenter, an early Mandarin pause ends the first phrase cleanly',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(Intl,'Segmenter');
 Object.defineProperty(Intl,'Segmenter',{...descriptor,value:undefined});
 t.after(()=>Object.defineProperty(Intl,'Segmenter',descriptor));
 let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
 a.session.start('mori','zh');a.recognizers[0].hear('想去哪里');await flush();
 const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
 emit({type:'delta',text:'  我们一起'});await flush();assert.equal(a.voices.length,0);
 emit({type:'delta',text:'看'});await flush();assert.equal(a.voices.length,0);
 emit({type:'delta',text:'看，'});await flush();assert.equal(a.voices[0].text,'我们一起看看，');
 emit({type:'delta',text:'河边很美。'});emit({type:'complete',soul:'mori',reply:'我们一起看看，河边很美。'});await flush();
 a.voices[0].callback('ended');assert.equal(a.voices[1].text,'河边很美。');
 a.voices[1].callback('ended');a.session.stop();
});

test('older WebViews start a complete short action early and retain every character in longer phrases',async t=>{
 const descriptor=Object.getOwnPropertyDescriptor(Intl,'Segmenter');
 Object.defineProperty(Intl,'Segmenter',{...descriptor,value:undefined});
 t.after(()=>Object.defineProperty(Intl,'Segmenter',descriptor));
 for(const [prefix,more,rest,first] of [
  ['我们先','慢点骑，','前面下坡。','我们先慢点骑，'],
  ['我们一起看','看河','边。','我们一起看看'],
  ['𠮷田一起看','看','河边。',null]
 ]){
  let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
  a.session.start('mori','zh');a.recognizers[0].hear('出发吗');await flush();
  const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
  emit({type:'delta',text:prefix});await flush();assert.equal(a.voices.length,0);
  emit({type:'delta',text:more});await flush();assert.deepEqual(a.voices.map(v=>v.text),first?[first]:[]);
  emit({type:'delta',text:rest});emit({type:'complete',soul:'mori',reply:prefix+more+rest});await flush();
  a.voices[0].callback('ended');assert.equal(a.voices.map(v=>v.text).join(''),prefix+more+rest);a.session.stop();
 }
});

test('a short prefix cannot cut Yesterday in half, and other characters keep their speech timing',async()=>{
 for(const soul of ['mori','lumi','bori']){
  let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
  a.session.start(soul,'en');a.recognizers[0].hear('Hello');await flush();
  const delta=text=>stream.enqueue(new TextEncoder().encode(JSON.stringify({type:'delta',text})+'\n'));
  if(soul==='mori'){
   delta('Yes');await flush();assert.equal(a.voices.length,0);
   delta('terday ');await flush();assert.equal(a.voices.length,0);
   delta('felt warmer,');await flush();assert.equal(a.voices[0].text,'Yesterday felt warmer,');
  }else{
   delta('Sure ');await flush();assert.equal(a.voices.length,0);
   delta('thing!');await flush();assert.equal(a.voices[0].text,'Sure thing!');
  }
  a.session.stop();stream.close();
 }
});

test('short Chinese clauses start earlier, and a stopped turn cannot speak late text',async()=>{
 let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
 a.session.start('mori','zh');a.recognizers[0].hear('一起走吧');await flush();const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
 emit({type:'delta',text:'好呀，'});await flush();assert.equal(a.voices[0].text,'好呀，');a.session.stop();
 emit({type:'delta',text:'我们走吧。'});emit({type:'complete',soul:'mori',reply:'好呀，我们走吧。'});await flush();assert.equal(a.voices.length,1);
});


test('punctuation after an exact five-character reply does not create an empty speech request',async()=>{
 let stream;const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));a.session.start('mori','zh');a.recognizers[0].hear('出发了吗');await flush();
 const emit=frame=>stream.enqueue(new TextEncoder().encode(JSON.stringify(frame)+'\n'));
 emit({type:'delta',text:'我们出发吧'});await flush();assert.equal(a.voices.length,1);
 emit({type:'delta',text:'。'});emit({type:'complete',soul:'mori',reply:'我们出发吧。'});await flush();a.voices[0].callback('ended');assert.equal(a.voices.length,1);assert.equal(a.session.state,'listening');a.session.stop();
});

test('all companions request real speech for a complete short phrase in the first delta, before more text arrives',async()=>{
 for(const soul of ['lumi','mori','bori']){
  for(const [language,word,boundary,tail] of [
   ['en','On it',' ','I can see the river.'],
   ['en','Go','.',' Then take a break.'],
   ['ko','가요',',',' 강이 보여요.']
  ]){
   let stream;
   const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
   const frame=value=>stream.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));
   a.session.start(soul,language);a.recognizers[0].hear(language==='ko'?'들려요?':'Are you there?');await flush();
   frame({type:'delta',text:word});await flush();assert.equal(a.voices.length,0,'incomplete words are held');
   frame({type:'delta',text:boundary});await flush();
   assert.deepEqual(a.voices.map(v=>v.text),[(word+boundary).trim()],soul);
   assert.equal(a.session.histories[soul].length,0);
   frame({type:'delta',text:tail});frame({type:'complete',soul,reply:word+boundary+tail});await flush();
   a.voices[0].callback('ended');assert.equal(a.voices[1].text,tail.trim());
   a.voices[1].callback('ended');a.session.stop();
  }
 }
});

test('each companion holds incomplete subjects, modifiers and complements across individual deltas',()=>{
 const examples=[
  ['Should we ','slow down here?'],['That sounds ','lovely,'],['I would ','take the shady path.'],
  ['The bend near the ','river looks steep.'],['We are looking at ','the same bridge.'],
  ['오늘은 바람이 ','잔잔하네요.'],['저기 보이는 ','자전거 예쁘다.'],['이 동네 ','길이 좁네.'],
  ['我觉得这个','路口好安静。'],['那只戴着','红围巾的小狗好可爱。'],['你说的那','座桥在前面。']
 ];
 for(const soul of ['lumi','mori','bori']){
  for(const [opening,end] of examples){
   const spoken=[],read=createVoiceSentenceReader(soul,phrase=>spoken.push(phrase));
   let text='';for(const char of opening){text+=char;read(text);}
   assert.deepEqual(spoken,[],opening);read(opening+end,true);
   assert.equal(spoken.join(' '),opening+end,opening);
  }
  for(const early of ['Slow down ','That sounds lovely ','잠깐 쉬자 ','出发吧','先慢点骑，']){
   const spoken=[],read=createVoiceSentenceReader(soul,phrase=>spoken.push(phrase));read(early);
   assert.deepEqual(spoken,[early.trim()],early);
  }
 }
});
test('streamed initials, abbreviations and decimal points stay in the spoken text even across deltas',async()=>{
 for(const [start,tail] of [
  ['Dr. ','Lee rides here!'],['U.S. ','routes are long!'],['e.g. ','an elm!'],['3.','50 km ahead!']
 ]){
  let stream;
  const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
  const frame=value=>stream.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));
  a.session.start('bori','en');a.recognizers[0].hear('What is that?');await flush();
  frame({type:'delta',text:start});await flush();assert.equal(a.voices.length,0,start);
  frame({type:'delta',text:tail});await flush();assert.deepEqual(a.voices.map(v=>v.text),[start+tail]);
  frame({type:'complete',soul:'bori',reply:start+tail});await flush();
  a.voices[0].callback('ended');assert.equal(a.voices.length,1);a.session.stop();
 }
});

test('the first spoken English phrase keeps an article with its noun',async()=>{
 let stream;
 const a=setup(()=>new Response(new ReadableStream({start(c){stream=c;}}),{headers:{'Content-Type':'application/x-ndjson'}}));
 const frame=value=>stream.enqueue(new TextEncoder().encode(JSON.stringify(value)+'\n'));
 a.session.start('bori','en');a.recognizers[0].hear('How long?');await flush();
 frame({type:'delta',text:'Half an '});await flush();assert.equal(a.voices.length,0);
 frame({type:'delta',text:'hour '});await flush();assert.equal(a.voices[0].text,'Half an hour');
 frame({type:'delta',text:'sounds good.'});frame({type:'complete',soul:'bori',reply:'Half an hour sounds good.'});await flush();
 a.voices[0].callback('ended');assert.equal(a.voices[1].text,'sounds good.');a.session.stop();
});
