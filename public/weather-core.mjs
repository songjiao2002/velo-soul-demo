import {CHARACTERS} from './character-art.mjs';
export const WEATHER_MAX_AGE=15*60*1000;
export const WEATHER_CODES=new Set([0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99]);
export function weatherArea(point,now=Date.now()){
 if(!point||![point.lat,point.lon,point.accuracy,point.time].every(Number.isFinite)||Math.abs(point.lat)>90||Math.abs(point.lon)>180||point.accuracy<0||point.accuracy>100||now-point.time>120000||point.time-now>5000)return null;
 const latitude=Math.round(point.lat*50)/50,longitude=Math.round(point.lon*50)/50;
 return {latitude,longitude,accuracy:Math.round(point.accuracy),observedAt:point.time};
}
export function weatherFresh(w,now=Date.now()){
 return !!w&&Number.isFinite(w.fetchedAt)&&Number.isFinite(w.observedAt)&&now>=w.fetchedAt-5000&&now-w.fetchedAt<WEATHER_MAX_AGE&&now-w.observedAt<45*60000;
}
export function condition(code){
 if([95,96,97,99].includes(code))return 'storm';
 if([56,57,66,67].includes(code))return 'freezing_rain';
 if([71,73,75,77,85,86].includes(code))return 'snow';
 if([51,53,55,61,63,65,80,81,82].includes(code))return 'rain';
 if([45,48].includes(code))return 'fog';
 return code===0||code===1?'clear':code===2?'partly_cloudy':'cloudy';
}
export function weatherRisks(w,now=Date.now()){
 const c=condition(w.code),wet=w.precipitationMm>.05||['rain','snow','freezing_rain'].includes(c)||w.recentPrecipitationMm>.1;
 const risks=[];
 if(c==='storm')risks.push({kind:'storm',level:4});
 else if(c==='freezing_rain'||(w.temperatureC<=2&&wet))risks.push({kind:'ice',level:3});
 else if(c==='snow'||w.snowfallCm>0)risks.push({kind:'snow',level:2});
 else if(c==='rain'||w.precipitationMm>.05)risks.push({kind:'rain',level:2});
 else if(w.recentPrecipitationMm>.1)risks.push({kind:'wet',level:1});
 const seen=new Set();
 for(const h of [...(w.nextHours||[])].sort((a,b)=>a.at-b.at)){
  if(!Number.isFinite(h.at)||h.at<=now||h.at>now+2*3600000)continue;
  const hc=condition(h.code),kind=hc==='storm'?'forecast_storm':hc==='freezing_rain'?'forecast_ice':hc==='snow'||h.snowfallCm>0?'forecast_snow':h.probability>=60||h.precipitationMm>=.2||hc==='rain'?'forecast_rain':null;
  if(!kind||seen.has(kind))continue;seen.add(kind);
  risks.push({kind,level:kind==='forecast_storm'?3:kind==='forecast_ice'?2:1,withinHours:Math.max(1,Math.ceil((h.at-now)/3600000)),at:h.at,probability:h.probability});
 }
 return risks.sort((a,b)=>b.level-a.level);
}
export function weatherRisk(w,now=Date.now()){return weatherRisks(w,now)[0]||null;}
const conditions={en:{clear:'clear skies',partly_cloudy:'partly cloudy skies',cloudy:'cloudy skies',rain:'rain',snow:'snow',freezing_rain:'freezing rain',fog:'fog',storm:'thunderstorms'},ko:{clear:'맑음',partly_cloudy:'구름 조금',cloudy:'흐림',rain:'비',snow:'눈',freezing_rain:'어는 비',fog:'안개',storm:'뇌우'},zh:{clear:'晴',partly_cloudy:'局部多云',cloudy:'阴',rain:'雨',snow:'雪',freezing_rain:'冻雨',fog:'雾',storm:'雷雨'}};
export function weatherSummary(w,language='en'){
 const lang=conditions[language]?language:'en';return `${conditions[lang][condition(w.code)]} · ${Math.round(w.temperatureC)}°C`;
}
export function weatherWarning(risk,language='en'){
 let text=warnings[language]?.[risk.kind]||warnings.en[risk.kind];
 if(risk.withinHours===1)text=text.replace('next two hours','next hour').replace('앞으로 두 시간 안에','앞으로 한 시간 안에').replace('未来两小时','未来约一小时');
 return text;
}
const warnings={
 zh:{storm:'当地天气资料显示有雷雨。先暂停骑行，找安全的室内场所避雨吧。',ice:'冻雨或低温潮湿时，部分路面可能结冰。避免急刹和急转，感觉抓地不稳时在安全处停止骑行。',snow:'当地天气资料显示有雪，路面可能湿滑。放慢速度，避免急刹，必要时安全停下休息。',rain:'当地天气资料显示有雨，湿路面可能打滑。放慢速度，避免急刹和急转。',wet:'天气资料显示近期有降水，部分路面可能仍然潮湿，转弯时慢一些。',forecast_snow:'未来两小时可能下雪，可以提前想好安全的休息地点。',forecast_rain:'未来两小时可能下雨，可以提前想好避雨地点；湿路面可能打滑。'},
 en:{storm:'Local weather data indicate thunderstorms. Let’s pause the ride and find a safe indoor shelter.',ice:'With freezing rain, or cold and wet conditions, some surfaces could be icy. Avoid abrupt braking or turns, and stop riding somewhere safe if grip feels uncertain.',snow:'Local weather data indicate snow. Surfaces may be slippery; ease your pace, avoid abrupt braking and consider a safe break.',rain:'Local weather data indicate rain. Wet surfaces may be slippery; ease your pace and avoid abrupt braking or turns.',wet:'The weather data show recent precipitation. Some surfaces may still be wet, so take turns gently.',forecast_snow:'The next two hours include possible snow. We could plan a safe place to pause before it arrives.',forecast_rain:'Rain is possible in the next two hours. We could plan a sheltered break; wet surfaces may become slippery.'},
 ko:{storm:'주변 날씨 정보에 뇌우가 있어. 라이딩을 쉬고 안전한 실내로 피하자.',ice:'어는 비이거나 춥고 젖은 조건이라 일부 노면이 얼었을 수 있어. 급제동·급회전을 피하고 접지력이 불안하면 안전한 곳에서 라이딩을 멈추자.',snow:'주변 날씨 정보에 눈이 있어. 노면이 미끄러울 수 있으니 속도를 낮추고 급제동을 피하자. 안전하게 쉬어가도 좋아.',rain:'주변 날씨 정보에 비가 있어. 젖은 노면이 미끄러울 수 있으니 속도를 낮추고 급제동·급회전을 피하자.',wet:'최근 강수 정보가 있어. 아직 젖은 곳이 있을 수 있으니 천천히 방향을 바꾸자.',forecast_snow:'앞으로 두 시간 안에 눈이 올 가능성이 있어. 내리기 전에 안전하게 쉴 곳을 생각해둘까?',forecast_rain:'앞으로 두 시간 안에 비가 올 가능성이 있어. 잠깐 피할 곳을 생각해둘까? 젖은 노면은 미끄러울 수 있어.'}
};
Object.assign(warnings.en,{forecast_snow:'Snow is possible in the next two hours. We could plan a safe place to pause before it arrives.',forecast_storm:'Thunderstorms are possible in the next two hours. Let’s plan a safe indoor stop before they arrive.',forecast_ice:'Freezing rain is possible in the next two hours. Surfaces could become icy; let’s plan to stop riding safely before it arrives.'});
Object.assign(warnings.ko,{forecast_storm:'앞으로 두 시간 안에 뇌우가 올 가능성이 있어. 시작되기 전에 안전한 실내에서 쉴 계획을 세우자.',forecast_ice:'앞으로 두 시간 안에 어는 비가 올 가능성이 있어. 노면이 얼 수 있으니 그 전에 안전하게 라이딩을 멈출 계획을 세우자.'});
Object.assign(warnings.zh,{forecast_storm:'未来两小时可能出现雷雨，提前计划在安全的室内停下休息吧。',forecast_ice:'未来两小时可能出现冻雨，路面可能结冰，提前计划安全停止骑行吧。'});
export function weatherLine(w,soul,language='en',risk=weatherRisk(w)){
 const ko=language==='ko';if(risk){const lead=ko?{lumi:'작은 날씨 소식이 있어. ',mori:'우리 여유 있게 가자. ',bori:'따뜻한 간식보다 먼저, 우리 안전부터 챙기자. '}:{lumi:'A little weather heads-up. ',mori:'Let’s take our time. ',bori:'Before any snack plans, let’s take care of you. '};return lead[soul]+weatherWarning(risk,ko?'ko':'en');}
 const temp=Math.round(w.temperatureC),c=conditions[ko?'ko':'en'][condition(w.code)];
 if(ko)return `주변 날씨 정보는 ${c}, 기온은 약 ${temp}도야. `+({lumi:'이런 날엔 어떤 작은 풍경이 눈에 들어올까?',mori:temp<8?'쌀쌀하네. 몸이 편한 속도로 함께 가자.':'바람은 편안하게 느껴져? 오늘은 네 속도에 맞출게.',bori:temp<12?'나중에 안전하게 쉬면서 따뜻한 간식 이야기할까?':'오늘 쉬는 시간엔 어떤 간식이 당겨?'}[soul]);
 return `Local weather data show ${c}, about ${temp} degrees Celsius. `+({lumi:'What little detail might catch your eye today?',mori:temp<8?'A chilly day. Let’s keep a comfortable pace together.':'How does the air feel to you? I’ll follow your pace.',bori:temp<12?'When we stop somewhere safe, shall we dream up a warm snack?':'What snack would you fancy when we take a break?'}[soul]);
}
export function weatherGreeting(w,soul,language='en',risk=weatherRisk(w)){
 const line=weatherLine(w,soul,language,risk);
 if(soul!=='mori'||!weatherFresh(w)||!WEATHER_CODES.has(w.code)||!Number.isFinite(w.temperatureC))return line;
 const current=condition(w.code),bad=['rain','snow','freezing_rain','storm','fog'].includes(current)||w.temperatureC<=2||w.temperatureC>=35;
 const good=['clear','partly_cloudy'].includes(current)&&w.temperatureC>=8&&w.temperatureC<=30&&!(w.precipitationMm>.05);
 const opening=bad?CHARACTERS.mori.badWeather:good?CHARACTERS.mori.goodWeather:null;
 return opening?opening[language in opening?language:'en']+' '+line:line;
}
export class WeatherNoticeGate{
 constructor(){this.seen=new Map();this.lastAt=-Infinity;this.lastLevel=0;this.lastKind=null;this.greeted=false;}
 candidate(w,now=Date.now()){
  if(!weatherFresh(w,now))return null;const risks=weatherRisks(w,now),risk=risks[0]||null,level=risk?.level||0;
  if(!this.greeted)return {kind:'greeting',level,risk,greeting:true};
  for(const risk of risks){const {kind,level}=risk,key=kind+(risk.withinHours?':'+risk.withinHours:'');
   if(now-(this.seen.get(key)??-Infinity)<30*60000)continue;
   if(now-this.lastAt<120000&&level<=this.lastLevel)continue;
   return {kind,level,risk};
  }return null;
 }
 mark(notice,now=Date.now()){if(notice.greeting)this.greeted=true;const risk=notice.risk,key=risk?risk.kind+(risk.withinHours?':'+risk.withinHours:''):notice.kind;this.seen.set(key,now);this.lastAt=now;this.lastLevel=notice.level;this.lastKind=notice.kind;}
}
