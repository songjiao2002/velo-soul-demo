import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getRideQuickReply,RIDE_QUICK_REPLIES} from './public/ride-quick-replies.mjs';

const souls=['lumi','mori','bori'];
const languages=['en','ko','zh'];
const examples={
  pace:[
    'Should we slow down on this hill?', 'Please, can we cycle a little slower?',
    'Let’s slow down a bit here.', 'I want to ride slower.', 'Can we slow down?',
    '우리 속도를 좀 줄일까?', '이 오르막길에서 우리 조금 더 천천히 갈까요?',
    '这段上坡路我们要不要骑慢一点？', '慢点骑吧。', '我想慢慢骑。'
  ],
  rest:[
    'Can we take a break?', 'I could use a breather.', 'Let’s stop for a minute.',
    '우리 잠깐 쉬고 갈까?', '잠깐 쉴까?', '잠시 쉬어도 될까요?',
    '我们可以停下来歇一会儿吗？', '我想歇口气。'
  ],
  quiet:[
    'Can you stay quiet for a bit?', 'Please stop talking.', 'Let’s ride in silence.',
    '잠깐 조용히 해줘.', '우리 잠시 조용히 달리자.',
    '请先别说话。', '咱们安静地骑一会儿吧。'
  ]
};

test('a confirmed self-contained request can get a whole reply from any character in the selected output language',()=>{
  assert.equal(RIDE_QUICK_REPLIES.length,27);
  const keys=new Set();
  for(const soul of souls)for(const language of languages)for(const [intent,requests] of Object.entries(examples)){
    const expected=RIDE_QUICK_REPLIES.find(clip=>clip.soul===soul&&clip.language===language&&clip.intent===intent);
    assert.ok(expected.text.trim());
    assert.match(expected.path,new RegExp('^/audio/ride-quick/'+soul+'-'+language+'-'+intent+'\\.wav$'));
    keys.add(expected.path);
    for(const transcript of requests)assert.equal(getRideQuickReply(transcript,{soul,language}),expected,transcript);
  }
  assert.equal(keys.size,27);
});

test('ambiguous speech, extra context, unsafe situations and device commands stay in open conversation',()=>{
  const requests=[
    '',null,'sure','stop','slow down','Speak slower please.',
    'Can we slow down the music?', 'Should we slow down on this hill or keep going?',
    "Don't slow down.",'Could we ride slower? My brakes failed.',
    'I need a break because my chest hurts.', 'Tell me when I can take a break.',
    "Can we take a break from riding together forever?", 'We should not take a break.',
    'Stop the ride.', 'Mute the mic.', 'Don’t be quiet.',
    '你可以说慢一点吗？','不要骑慢一点。','我们要不要骑慢一点还是快点？',
    '慢点骑吧，前面有车！','别说话，帮我关掉麦克风。','你想休息一下吗？','结束骑行。',
    '천천히 말해 줘.', '천천히 가지 말자.', '쉬지 말자.', '잠깐 쉴까? 가슴이 아파.',
    '지금 여기에서 멈춰도 안전할까?', '마이크 꺼 줘.', '쉬자고 한 이유가 뭐야?'
  ];
  for(const transcript of requests)assert.equal(getRideQuickReply(transcript,{soul:'mori',language:'en'}),undefined,transcript);
  assert.equal(getRideQuickReply('Can we take a break?',{soul:'unknown',language:'en'}),undefined);
  assert.equal(getRideQuickReply('Can we take a break?',{soul:'mori',language:'invalid'}),undefined);
});
