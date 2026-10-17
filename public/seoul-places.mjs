// Coordinates are Visit Seoul's directions markers, verified 2026-10-17.
// A small curated catalog, not a live search for every cafe in Seoul.
export const SEOUL_PLACES=[
 {id:'daelim-changgo',kind:'cafe',lat:37.5416392066484,lon:127.056647865179,radius:180,name:{ko:'대림창고 갤러리',en:'Daelim Warehouse Gallery',zh:'大林仓库咖啡馆'},fact:'A cafe and gallery in a converted rice mill in Seongsu. Current opening hours, menu, and availability are not known.',source:'https://english.visitseoul.net/restaurants/daelimchanggo/ENPf8jiyc'},
 {id:'gyeongbokgung',kind:'landmark',lat:37.57590409118165,lon:126.97684292625048,radius:280,name:{ko:'경복궁·광화문',en:'Gyeongbokgung / Gwanghwamun',zh:'景福宫／光化门'},fact:'A royal palace of the Joseon dynasty. The marker is the official directions point near its southern entrance, not permission to ride inside.',source:'https://english.visitseoul.net/attractions/gyeongbokgung%20palace/ENP000072'},
 {id:'seoul-forest',kind:'park',lat:37.54429758656194,lon:127.03962333207576,radius:280,name:{ko:'서울숲',en:'Seoul Forest',zh:'首尔林'},fact:'An urban park with gardens and green spaces. Do not assume current weather, trail access, or cycling rules.',source:'https://english.visitseoul.net/nature/seoul-forest/ENP001838'}
];
const radians=n=>n*Math.PI/180;
export function metersBetween(a,b){const t=Math.sin(radians(b.lat-a.lat)/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lon-a.lon)/2)**2;return 6371000*2*Math.atan2(Math.sqrt(t),Math.sqrt(Math.max(0,1-t)));}
export function outputLanguage(input){return input==='ko'?'ko':'en';}
export class PlaceFence {
 constructor({places=SEOUL_PLACES,dwellMs=5000,cooldownMs=120000}={}){this.places=places;this.dwellMs=dwellMs;this.cooldownMs=cooldownMs;this.seen=new Set();this.candidate=null;this.lastTrigger=-Infinity;this.lastPoint=null;}
 pause(){this.candidate=null;this.lastPoint=null;}
 update(p,now=Date.now()){
  if(!p||![p.lat,p.lon,p.accuracy,p.time].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.accuracy<0||p.accuracy>60||Math.abs(now-p.time)>30000){this.candidate=null;return null;}
  if(this.lastPoint){const dt=(p.time-this.lastPoint.time)/1000;if(dt>30)this.candidate=null;if(dt<=0||metersBetween(p,this.lastPoint)/dt>25){this.candidate=null;return null;}}
  this.lastPoint=p;
  if(now-this.lastTrigger<this.cooldownMs)return null;
  const nearest=this.places.map(place=>({place,distance:metersBetween(p,place)})).filter(x=>!this.seen.has(x.place.id)&&x.distance+p.accuracy<=x.place.radius).sort((a,b)=>a.distance-b.distance)[0];
  if(!nearest){this.candidate=null;return null;}
  if(this.candidate?.id!==nearest.place.id){this.candidate={id:nearest.place.id,since:now};return null;}
  if(now-this.candidate.since<this.dwellMs)return null;
  this.seen.add(nearest.place.id);this.lastTrigger=now;this.candidate=null;return nearest.place;
 }
}
export function placeFallback(place,soul,language){
 const ko=language==='ko',name=place.name[ko?'ko':'en'];
 if(ko){if(soul==='lumi')return `위치상 ${name} 근처에 와 있나 봐. 안전하게 멈출 수 있다면, 어떤 작은 디테일이 눈에 들어오는지 같이 찾아볼까?`;if(soul==='mori')return `${name} 근처에 온 것 같아. 쉬고 싶다면 잠깐 멈춰도 좋아. 나는 네 속도에 맞출게.`;return place.kind==='cafe'?`${name} 근처에 온 것 같아! 쉬고 싶다면 카페에 들르는 건 어때? 문을 열었는지는 먼저 확인해보자.`:`${name} 근처에 왔나 봐. 오늘 이야기에 새로운 장소가 하나 더 생겼네!`;}
 if(soul==='lumi')return `Location suggests we're near ${name}. If you stop somewhere safe, what little detail would you like to discover together?`;
 if(soul==='mori')return `We seem to be near ${name}. If you'd like a pause, there's no rush. I'll keep you company at your pace.`;
 return place.kind==='cafe'?`We seem to be near ${name}! Fancy a little cafe break? We'd need to check whether it's open first.`:`We seem to be near ${name}. That's another little place in our story together!`;
}
