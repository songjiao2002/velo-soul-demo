import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import WebSocket from 'ws';
import {relayScribeRealtime} from './scribe-realtime.mjs';
import {createMicrophoneRecognition} from './public/microphone-asr.mjs';

class Socket extends EventEmitter {
  readyState = WebSocket.OPEN;
  bufferedAmount = 0;
  sent = [];
  send(raw) { this.sent.push(JSON.parse(raw)); }
  close() { this.terminate(); }
  terminate() {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
  receive(event) { this.emit('message', Buffer.from(JSON.stringify(event)), false); }
  audio(data) { this.emit('message', data, true); }
}

function session(t, language = 'en', draft) {
  const client = new Socket();
  const upstream = new Socket();
  let url, options, releases = 0;
  relayScribeRealtime(client, {
    language, draft, apiKey:'scribe-test-key',
    connect(endpoint, opts) { url = new URL(endpoint); options = opts; return upstream; },
    release() { releases++; }
  });
  t.after(() => client.terminate());
  return {client, upstream, url, options, get releases() { return releases; }};
}

test('Scribe binds speculative captions only after real microphone data and preserves its confirmed transcript',t=>{
 const calls=[],ctx=[];
 const draft={configure:value=>ctx.push(value),transcript:(text,final)=>{calls.push([text,final]);return 'prepared-turn';},close(){}};
 const s=session(t,'ko',draft);
 s.upstream.receive({message_type:'session_started'});
 assert.equal(s.client.sent[0].prepareReply,true);
 s.client.receive({type:'reply_context',soul:'bori',history:[]});
 s.upstream.receive({message_type:'partial_transcript',text:'오늘은'});
 assert.equal(s.client.sent.at(-1).draftId,undefined);
 s.client.audio(Buffer.alloc(6400,5));
 s.upstream.receive({message_type:'partial_transcript',text:'오늘 정말 뿌듯했어.'});
 s.client.receive({type:'finish'});
 s.upstream.receive({message_type:'committed_transcript',text:'오늘 정말 뿌듯했어.'});
 assert.equal(ctx.length,1);
 assert.deepEqual(calls,[['오늘 정말 뿌듯했어.',false],['오늘 정말 뿌듯했어.',true]]);
 assert.deepEqual(s.client.sent.at(-1),{type:'final',text:'오늘 정말 뿌듯했어.',draftId:'prepared-turn'});
});

test('Mandarin previews preserve a breath inside a time clause and leave complete and final utterances intact',t=>{
 const {client,upstream}=session(t,'zh');
 upstream.receive({message_type:'session_started'});
 client.audio(Buffer.alloc(320));
 const samples=[
  ['我过弯以前。','我过弯以前'],['我过弯以前总。','我过弯以前总'],
  ['出发之前。','出发之前'],['我總是。','我總是'],
  ['我过弯以前总怕。','我过弯以前总怕。'],['我今天很开心。','我今天很开心。'],
  ['我刚看到陈总。','我刚看到陈总。'],['我很怀念以前。','我很怀念以前。'],
  ['我终于骑上来了！','我终于骑上来了！'],['好。','好。']
 ];
 for(const [raw,expected] of samples){
  upstream.receive({message_type:'partial_transcript',text:raw});
  assert.deepEqual(client.sent.at(-1),{type:'partial',text:expected});
 }
 client.receive({type:'finish'});
 upstream.receive({message_type:'committed_transcript',text:'我过弯以前。'});
 assert.deepEqual(client.sent.at(-1),{type:'final',text:'我过弯以前。'});
});

test('Scribe respects the selected language, revises provisional Korean and retains previously committed text', t => {
  const {client, upstream, url, options} = session(t, 'ko');
  assert.equal(url.origin, 'wss://api.elevenlabs.io');
  assert.equal(url.pathname, '/v1/speech-to-text/realtime');
  assert.equal(url.searchParams.get('model_id'), 'scribe_v3_live');
  assert.equal(url.searchParams.get('commit_strategy'), 'manual');
  assert.equal(url.searchParams.get('language_code'), 'ko');
  assert.ok(!url.searchParams.has('multilang_mode'));
  assert.equal(options.headers['xi-api-key'], 'scribe-test-key');
  assert.ok(!url.href.includes('scribe-test-key'));
  const a = Buffer.from([1,2,3,4]), b = Buffer.from([5,6]);
  client.audio(a);
  assert.deepEqual(upstream.sent, []);
  upstream.receive({message_type:'session_started', config:{model_id:'scribe_v3_live'}});
  assert.deepEqual(client.sent, [{type:'ready'}]);
  client.audio(b);
  assert.deepEqual(upstream.sent.map(c=>Buffer.from(c.audio_base_64,'base64')), [a,b]);
  assert.ok(upstream.sent.every(c=>c.message_type==='input_audio_chunk' && c.sample_rate===16000 && !c.commit));
  upstream.receive({message_type:'partial_transcript', text:'잠깐'});
  upstream.receive({message_type:'partial_transcript', text:'잠깐만'});
  upstream.receive({message_type:'committed_transcript', text:'잠깐만.'});
  upstream.receive({message_type:'partial_transcript', text:'여기'});
  assert.deepEqual(client.sent.slice(1), [
    {type:'partial',text:'잠깐'}, {type:'partial',text:'잠깐만'},
    {type:'partial',text:'잠깐만.'}, {type:'partial',text:'잠깐만. 여기'}
  ]);
  client.receive({type:'finish'});
  assert.deepEqual(upstream.sent.at(-1), {message_type:'input_audio_chunk',audio_base_64:'',sample_rate:16000,commit:true});
  upstream.receive({message_type:'committed_transcript', text:'여기서 쉬자.'});
  upstream.receive({message_type:'committed_transcript', text:'late'});
  assert.deepEqual(client.sent.filter(e=>e.type==='final'), [{type:'final',text:'잠깐만. 여기서 쉬자.'}]);
  assert.equal(upstream.readyState, WebSocket.CLOSED);
});

test('Scribe finish during handshake preserves queued frames, flushes once, and an empty commit stays empty', t => {
  const s=session(t);
  assert.equal(s.url.searchParams.get('language_code'), 'en');
  s.client.audio(Buffer.alloc(20));
  s.client.audio(Buffer.alloc(30));
  s.client.receive({type:'finish'});
  assert.equal(s.upstream.sent.length, 0);
  s.upstream.receive({message_type:'session_started'});
  assert.deepEqual(s.upstream.sent.map(c=>[Buffer.from(c.audio_base_64,'base64').length,c.commit]), [[20,false],[30,false],[0,true]]);
  s.upstream.receive({message_type:'partial_transcript', text:'Thank you'});
  s.upstream.receive({message_type:'committed_transcript', text:''});
  assert.deepEqual(s.client.sent.at(-1), {type:'final',text:''});
  assert.equal(s.releases, 1);
});

test('Scribe signals fallback on provider errors, malformed transcripts, and a lost connection without leaking details', t => {
  for (const [event, error] of [
    [{message_type:'auth_error',error:'sensitive diagnostic'},'provider_auth'],
    [{message_type:'quota_exceeded'},'provider_unavailable'],
    [{message_type:'error'},'provider_unavailable'],
    [{message_type:'partial_transcript',text:15},'invalid_response'],
    [{message_type:'committed_transcript',text:'x'.repeat(1024*1024+1)},'invalid_response'],
    [null,'invalid_response']
  ]) {
    const s=session(t);
    s.upstream.receive({message_type:'session_started'});
    s.upstream.receive(event);
    assert.deepEqual(s.client.sent.at(-1), {type:'error',error});
    assert.equal(s.releases,1);
    assert.ok(!JSON.stringify(s.client.sent).includes('sensitive'));
  }
  const s=session(t);
  s.upstream.receive({message_type:'session_started'});
  s.upstream.receive({message_type:'partial_transcript',text:'tentative'});
  s.upstream.terminate();
  assert.deepEqual(s.client.sent.at(-1), {type:'error',error:'network'});
  assert.equal(s.releases, 1);
  assert.ok(!s.client.sent.some(e=>e.type==='final'));
});

for(const [language,expected] of [['en','Wait here.'],['zh','在这里等。']]){
test(`a ${language} Scribe quota failure uses one Qwen HTTP fallback for the retained utterance`, async () => {
  const client=new Socket(), upstream=new Socket(), input={attach:async()=>{}, detach(){}, onLevel(){}};
  const uploads=[], results=[];
  class BrowserSocket {
    readyState=WebSocket.OPEN;
    bufferedAmount=0;
    constructor(url) {
      client.send=raw=>this.onmessage?.({data:raw});
      assert.equal(new URL(url).searchParams.get('language'),language);
      if(language==='zh')assert.equal(new URL(url).searchParams.get('provider'),'scribe');
      relayScribeRealtime(client,{language,apiKey:'example',connect:()=>upstream,release(){}});
      queueMicrotask(()=>{this.onopen?.();upstream.receive({message_type:'session_started'});});
    }
    send(data) {
      if(typeof data==='string') client.emit('message',Buffer.from(data),false);
      else client.audio(Buffer.from(data));
    }
    close() { this.readyState=WebSocket.CLOSED;client.terminate(); }
  }
  const Recognition=createMicrophoneRecognition({
    input,Socket:BrowserSocket,location:new URL('https://localhost/'),
    fetchImpl:async(path,options)=>{uploads.push({path,body:options.body});return Response.json({text:expected});}
  });
  const instance=new Recognition();
  instance.inputLanguage=language;
  instance.onresult=e=>{if(e.results[0].isFinal)results.push(e.results[0][0].transcript);};
  try {
    instance.start();
    await new Promise(resolve=>setImmediate(resolve));
    const voice=Float32Array.from({length:4800},(_,i)=>.1*Math.sin(2*Math.PI*225*i/16000));
    instance.samples(voice,16000);
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(upstream.sent.length);
    upstream.receive({message_type:'quota_exceeded'});
    instance.samples(voice,16000);
    await instance.stop();
    assert.equal(uploads.length,1);
    assert.equal(uploads[0].path,'/api/transcribe?language='+language);
    assert.ok(uploads[0].body.length>1000);
    assert.deepEqual(results,[expected]);
  } finally { instance.abort(); }
});
}

test('Scribe limits malformed, post-finish and excess audio, provider backpressure and client cancellation', t => {
  for (const action of [
    s => s.client.audio(Buffer.alloc(3)),
    s => s.client.audio(Buffer.alloc(16386)),
    s => { for(let i=0;i<32;i++) s.client.audio(Buffer.alloc(16384)); },
    s => { s.client.audio(Buffer.alloc(4)); s.client.receive({type:'finish'}); s.client.audio(Buffer.alloc(4)); }
  ]) {
    const s=session(t);
    action(s);
    assert.deepEqual(s.client.sent.at(-1), {type:'error',error:'invalid_request'});
    assert.equal(s.releases, 1);
  }
  const blocked=session(t);
  blocked.upstream.receive({message_type:'session_started'});
  blocked.upstream.bufferedAmount=131073;
  blocked.client.audio(Buffer.alloc(3200));
  assert.deepEqual(blocked.client.sent.at(-1), {type:'error',error:'network'});
  const cancelled=session(t);
  cancelled.client.terminate();
  cancelled.upstream.receive({message_type:'session_started'});
  assert.deepEqual(cancelled.client.sent, []);
  assert.equal(cancelled.upstream.readyState, WebSocket.CLOSED);
  assert.equal(cancelled.releases, 1);
});
