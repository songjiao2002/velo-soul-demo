import {distance,projectRoute,routeDistance,validPoint,SOULS} from './soul-core.mjs';

export const ROUTE_DIARY_COPY={
 en:{title:'The path we shared',moments:'Photo moments',empty:'No route was recorded on this ride.',alt:'Recorded ride route, with photo moments along the distance line.'},
 ko:{title:'우리가 함께 지나온 길',moments:'사진을 남긴 순간',empty:'이번 여정에는 기록된 경로가 없어요.',alt:'이동 거리선에 사진을 찍은 순간을 표시한 라이딩 경로.'},
 zh:{title:'一起走过的路',moments:'留下照片的时刻',empty:'这次骑行没有记录路线。',alt:'本次骑行路线，下方里程线上标出了拍照的时刻。'}
};
const copy=language=>ROUTE_DIARY_COPY[language]||ROUTE_DIARY_COPY.en;
const xml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const usable=points=>Array.isArray(points)&&points.length<=1800&&points.every(validPoint);
export const ROUTE_IMAGE_RATIO=480/760;

// A parallel record keeps camera photos unchanged and out of route-image storage.
// Missing/stale GPS never gets a made-up photo position.
export function rememberPhotoMoment(record,photoIndex,at,fix){
 const route=record?.route;
 if(!usable(route)||!route.length||!Number.isInteger(photoIndex)||photoIndex<0||photoIndex>=record.photos?.length||!Number.isFinite(at)||!validPoint(fix)||at-fix.time>15000||at-fix.time<0)return false;
 const last=route.at(-1);
 if(last.time>at||distance(last,fix)>Math.max(60,fix.accuracy))return false;
 record.photoMoments??=[];
 if(record.photoMoments.some(m=>m.photoIndex===photoIndex))return false;
 record.photoMoments.push({photoIndex,at,pointIndex:route.length-1,distanceM:routeDistance(route)});
 return true;
}

export function diaryRouteModel(record){
 const points=record?.route;
 if(!usable(points)||points.length<2)return null;
 const meters=routeDistance(points);
 if(!Number.isFinite(meters)||meters<1)return null;
 const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+distance(points[i-1],points[i]));
 const seen=new Set(),moments=[];
 for(const m of Array.isArray(record.photoMoments)?record.photoMoments:[]){
  if(!m||!Number.isInteger(m.photoIndex)||m.photoIndex<0||m.photoIndex>=record.photos?.length||seen.has(m.photoIndex)||!Number.isInteger(m.pointIndex)||m.pointIndex<0||m.pointIndex>=points.length||!Number.isFinite(m.distanceM)||Math.abs(m.distanceM-cumulative[m.pointIndex])>1)continue;
  seen.add(m.photoIndex);moments.push({...m,fraction:Math.max(0,Math.min(1,m.distanceM/meters))});
 }
 return {points,meters,moments};
}

// Self-contained image: no map tiles, third-party calls or generated GPS narrative.
// It is a local trace, displayed after photos and the companion's letter.
export function diaryRouteImage(record,language='en'){
 const model=diaryRouteModel(record);if(!model)return null;
 const c=copy(language),accent=SOULS[record.soul]?.color||'#6b9665';
 const projected=projectRoute(model.points,712,338).map(([x,y])=>[x+24,y+18]);
 const coords=projected.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' '),start=projected[0],end=projected.at(-1);
 const markers=model.moments.map(m=>{const p=projected[m.pointIndex];return `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#fcfbf6" stroke="${accent}" stroke-width="3"/>`;}).join('');
 const timeline=model.moments.map(m=>`<circle cx="${28+704*m.fraction}" cy="412" r="8" fill="${accent}"/>`).join('');
 const km=new Intl.NumberFormat(language,{minimumFractionDigits:model.meters>=1000?1:2,maximumFractionDigits:model.meters>=1000?1:2}).format(model.meters/1000);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="480" viewBox="0 0 760 480"><title>${xml(c.alt)}</title><rect width="760" height="480" fill="#fcfbf6"/><rect x="0" y="0" width="760" height="370" rx="16" fill="#eef2e9"/><defs><pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#c8d3c2"/></pattern></defs><rect width="760" height="370" rx="16" fill="url(#dots)"/><polyline points="${coords}" fill="none" stroke="#fffef9" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${coords}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${markers}<circle cx="${start[0]}" cy="${start[1]}" r="10" fill="#fcfbf6" stroke="${accent}" stroke-width="4"/><circle cx="${end[0]}" cy="${end[1]}" r="11" fill="${accent}" stroke="#fcfbf6" stroke-width="4"/><path d="M28 412H732" fill="none" stroke="#d9e1d3" stroke-width="6" stroke-linecap="round"/>${timeline}<g fill="#576851" font-family="Segoe UI,Arial,Apple SD Gothic Neo,Malgun Gothic,sans-serif" font-size="19"><text x="24" y="457">0 km</text><text x="736" y="457" text-anchor="end">${xml(km)} km</text></g></svg>`;
 return {...model,svg,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)};
}

export function diaryRouteMarkup(record,language='en'){
 const c=copy(language),image=diaryRouteImage(record,language);
 return `<figure class="diary-route" data-no-translate><figcaption><span>${c.title}</span>${image?.moments.length?`<small><i aria-hidden="true"></i>${c.moments}</small>`:''}</figcaption>${image?`<img class="diary-route-image" src="${xml(image.src)}" alt="${c.alt}" width="760" height="480" loading="lazy">`:`<p class="diary-route-empty">${c.empty}</p>`}</figure>`;
}
