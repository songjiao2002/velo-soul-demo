import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NativeSpeechPlayer} from './public/native-speech.mjs';
import {AudioDevices} from './public/audio-devices.mjs';
import {browserAudioContext,companionBrowserLinks} from './public/audio-browser.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function setup(){
 const requests=[],urls=new Set(),states=[];let captures=0,automatic=true,fetcher=async()=>new Response(new Uint8Array(100));
 const audio={paused:true,muted:false,currentTime:0,setAttribute(){},removeAttribute(){this.src='';},pause(){this.paused=true;},play(){this.paused=false;queueMicrotask(()=>{this.onplaying?.();if(automatic)this.onended?.();});return Promise.resolve();}};
 const player=new NativeSpeechPlayer({document:{createElement:()=>audio},URL:{createObjectURL(){const id='blob:'+Math.random();urls.add(id);return id;},revokeObjectURL:id=>urls.delete(id)},fetchImpl:async(...a)=>{requests.push(a);return fetcher(...a);}});
 const session={inputs:new Map(),nativeSpeech:player,navigator:{mediaDevices:{getUserMedia(){captures++;},enumerateDevices:async()=>[]}},getContext(){throw Error('Web Audio must not be used for media playback');}};
 const devices=new AudioDevices({session});session.playbackMode='media';
 return {player,audio,session,devices,requests,urls,states,getCaptures:()=>captures,setAuto:v=>automatic=v,setFetch:fn=>fetcher=fn,options:{language:'ko',soul:'lumi',report:s=>states.push(s),allowed:()=>!['missing','unavailable','checking'].includes(devices.state)}};
}
test('media compatibility reuses one native element, caches clips and never requests a mic or Web Audio output',async()=>{
 const a=setup();for(let i=0;i<3;i++)await a.player.speak(['hello'],a.options);
 assert.equal(a.requests.length,1);assert.equal(a.requests[0][0],'/api/speech');assert.equal(a.getCaptures(),0);assert.deepEqual(a.states,['playing','ended','playing','ended','playing','ended']);assert.equal(a.urls.size,0);a.player.dispose();a.devices.dispose();
});
test('saved media test loads only the introduction and does not call the speech API',async()=>{
 const a=setup();await a.player.prepare();await a.player.speak(['intro'],{...a.options,source:'/audio/intro/lumi-ko.wav'});assert.equal(a.requests.length,1);assert.equal(a.requests[0][0],'/audio/intro/lumi-ko.wav');assert.equal(a.getCaptures(),0);assert.equal(a.urls.size,0);a.player.dispose();a.devices.dispose();
});
test('native speech shares a pending weather preload instead of generating the same greeting twice',async()=>{
 const a=setup();let finish;a.setFetch(()=>new Promise(r=>finish=r));const preloaded=a.player.preload('weather',a.options),spoken=a.player.speak(['weather'],a.options);assert.equal(a.requests.length,1);finish(new Response(new Uint8Array(100)));await preloaded;await spoken;assert.deepEqual(a.states,['playing','ended']);assert.equal(a.requests.length,1);a.player.dispose();a.devices.dispose();
});
test('stopping a pending native fetch prevents late playback and releases resources',async()=>{
 const a=setup();let finish;a.setFetch(()=>new Promise(r=>finish=r));const pending=a.player.speak(['hello'],a.options);a.player.stop();finish(new Response(new Uint8Array(100)));await pending;assert.deepEqual(a.states,[]);assert.equal(a.urls.size,0);a.player.dispose();a.devices.dispose();
});
test('stopping native playback resolves its pending turn without a stale ended event',async()=>{
 const a=setup();a.setAuto(false);const pending=a.player.speak(['hello'],a.options);await flush();assert.deepEqual(a.states,['playing']);a.player.stop();await pending;assert.deepEqual(a.states,['playing']);assert.equal(a.audio.paused,true);assert.equal(a.urls.size,0);a.player.dispose();a.devices.dispose();
});
test('denied native autoplay reports blocked without falling back to Web Audio or the speaker',async()=>{
 const a=setup();a.audio.play=()=>Promise.reject(Object.assign(Error('autoplay'),{name:'NotAllowedError'}));await a.player.speak(['hello'],a.options);assert.deepEqual(a.states,['blocked']);assert.equal(a.urls.size,0);a.player.dispose();a.devices.dispose();
});
test('an empty device inventory does not mute or block a native reply',async()=>{
 const a=setup();await a.devices.refresh();await a.player.speak(['hello'],a.options);assert.equal(a.audio.muted,false);assert.deepEqual(a.states,['playing','ended']);assert.equal(a.requests.length,1);a.player.dispose();a.devices.dispose();
});
test('native output is not forced or muted during device refresh',async()=>{
 const a=setup();let routed=0;a.audio.setSinkId=async()=>{routed++;};await a.devices.refresh();assert.equal(routed,0);assert.equal(a.audio.muted,false);assert.equal(a.devices.state,'system');a.player.dispose();a.devices.dispose();
});
test('KakaoTalk, WeChat and Korean embedded browsers are recognized without mislabelling normal Samsung/Chrome',()=>{
 for(const [token,host]of [['MicroMessenger/8','WeChat'],['KAKAOTALK/10.8.3 (INAPP)','KakaoTalk'],['NAVER(inapp; search; 1200)','Naver'],['DaumApps/6','Daum'],['Instagram 280','Instagram'],['Line/14','LINE'],['FBAV/2','Facebook'],['; wv)','WebView']]){const result=browserAudioContext('Mozilla/5.0 (Linux; Android 14; SM-S908N) '+token);assert.equal(result.host,host);assert.equal(result.embedded,true);assert.equal(result.android,true);}
 for(const ua of ['Mozilla/5.0 (Linux; Android 14; SM-S908N) SamsungBrowser/28.0 Chrome/130','Mozilla/5.0 (Linux; Android 14) Chrome/130','Mozilla/5.0 (iPhone) Version/17 Safari/605'])assert.equal(browserAudioContext(ua).embedded,false);
 assert.equal(browserAudioContext('iPhone KAKAOTALK/10.8').embedded,true);
});
test('external browser links keep soul choice and omit media autostart and arbitrary parameters',()=>{
 const links=companionBrowserLinks('https://velo-soul-demo-production.up.railway.app/?bike=mori&view=camera&token=private#state');
 assert.equal(links.link,'https://velo-soul-demo-production.up.railway.app/?bike=mori');assert.match(links.chrome,/package=com.android.chrome;/);assert.match(links.samsung,/package=com.sec.android.app.sbrowser;/);assert.doesNotMatch(JSON.stringify(links),/private|view=camera|#state/);assert.throws(()=>companionBrowserLinks('javascript:alert(1)'));
});
