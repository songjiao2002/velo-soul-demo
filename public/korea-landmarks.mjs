import {SEOUL_PLACES} from './seoul-places.mjs';

// Curated display points, checked 2026-10-20. These are not entrance/navigation
// coordinates or additional voice geofences. Source links travel with each pin.
const names=(ko,en,zh)=>({ko,en,zh});
const wiki=page=>`https://en.wikipedia.org/wiki/${page}`;
const unesco=id=>`https://whc.unesco.org/en/list/${id}/`;
const dms=(d,m,s)=>d+m/60+s/3600;
const point=(id,kind,region,lat,lon,ko,en,zh,source)=>({
 id,kind,region,lat,lon,name:names(ko,en,zh),source,positionType:'representative'
});
export const KOREA_LANDMARKS=[
 ...SEOUL_PLACES.map(p=>({...p,region:'seoul',positionType:'representative',kind:p.id==='gyeongbokgung'?'palace':p.kind})),
 point('changdeokgung','palace','seoul',dms(37,34,44),dms(126,59,28),'창덕궁','Changdeokgung Palace','昌德宫',unesco(816)),
 point('jongmyo','temple','seoul',dms(37,34,29),dms(126,59,37),'종묘','Jongmyo Shrine','宗庙',unesco(738)),
 point('n-seoul-tower','tower','seoul',37.551216,126.988276,'남산서울타워','N Seoul Tower','南山首尔塔',wiki('N_Seoul_Tower')),
 point('hwaseong','fortress','gyeonggi',dms(37,16,19.992),dms(127,0,29.988),'수원 화성','Suwon Hwaseong Fortress','水原华城',unesco(817)),
 point('namhansanseong','fortress','gyeonggi',37.47889,127.18111,'남한산성','Namhansanseong','南汉山城',wiki('Namhansanseong')),
 point('seoraksan','nature','gangwon',38.11944,128.46556,'설악산','Seoraksan','雪岳山',wiki('Seoraksan')),
 point('gongsanseong','fortress','chungcheong',36.46306,127.12639,'공주 공산성','Gongsanseong Fortress','公州公山城',wiki('Gongsanseong')),
 point('hahoe','village','gyeongsang',36.53917,128.51667,'안동 하회마을','Andong Hahoe Village','安东河回村',wiki('Hahoe_Folk_Village')),
 point('cheomseongdae','tower','gyeongsang',35.834722,129.219,'경주 첨성대','Cheomseongdae','庆州瞻星台',wiki('Cheomseongdae')),
 point('bulguksa','temple','gyeongsang',35.79,129.33222,'불국사','Bulguksa Temple','佛国寺',wiki('Bulguksa')),
 point('seokguram','temple','gyeongsang',dms(35,47,29.393),dms(129,20,56.504),'석굴암','Seokguram Grotto','石窟庵',unesco(736)),
 point('haeinsa','temple','gyeongsang',dms(35,48,6.019),dms(128,5,55.36),'해인사 장경판전','Haeinsa Janggyeong Panjeon','海印寺藏经板殿',unesco(737)),
 point('haeundae','coast','busan',35.15855,129.16053,'해운대해수욕장','Haeundae Beach','海云台海水浴场',wiki('Haeundae_Beach')),
 point('gamcheon','village','busan',dms(35,6,5),dms(129,0,33),'감천문화마을','Gamcheon Culture Village','甘川文化村','https://www.wikidata.org/wiki/Q18641306'),
 point('naganeupseong','village','jeolla',34.90694,127.33889,'순천 낙안읍성','Naganeupseong Folk Village','顺天乐安邑城',wiki('Naganeupseong')),
 point('hallasan','nature','jeju',33.36167,126.52917,'한라산','Hallasan','汉拿山',wiki('Hallasan')),
 point('seongsan','nature','jeju',33.4585,126.942,'성산일출봉','Seongsan Ilchulbong','城山日出峰',wiki('Seongsan_Ilchulbong'))
];
export const MAP_REGIONS={
 all:names('한국 전체','All Korea','韩国全图'),seoul:names('서울','Seoul','首尔'),
 gyeonggi:names('경기','Gyeonggi','京畿'),gangwon:names('강원','Gangwon','江原'),
 chungcheong:names('충청','Chungcheong','忠清'),gyeongsang:names('경상 · 경주','Gyeongsang · Gyeongju','庆尚 · 庆州'),
 busan:names('부산','Busan','釜山'),jeolla:names('전라','Jeolla','全罗'),jeju:names('제주','Jeju','济州')
};
export const MAP_KINDS={
 palace:names('궁궐','Palace','宫殿'),temple:names('사찰 · 사당','Temple / shrine','寺庙／宗庙'),
 fortress:names('성곽','Fortress','古城'),village:names('마을','Village','村落'),
 tower:names('탑 · 관측대','Tower / observatory','塔／观测台'),nature:names('산 · 자연','Mountain / nature','山岳自然'),
 coast:names('해변','Coast','海岸'),park:names('공원','Park','公园'),cafe:names('카페','Cafe','咖啡馆')
};
export const LANDMARK_COPY={
 ko:{region:'지역',all:'한국 전체 보기',near:'내 위치로',browse:'명소 목록',selected:'명소 위치',source:'좌표 출처',representative:'명소 대표 지점 · 입구나 자전거 경로가 아니에요.',close:'닫기',group:'개 장소 · 확대하기',explore:'한국의 명소를 만나보세요',key:'궁궐 · 사찰 · 자연',count:'개 장소'},
 en:{region:'Region',all:'Explore Korea',near:'My location',browse:'Browse places',selected:'Place location',source:'Coordinate source',representative:'Representative point · not an entrance or cycling route.',close:'Close',group:'places · zoom in',explore:'Discover places across Korea',key:'Palaces · temples · nature',count:'places'},
 zh:{region:'地区',all:'韩国全图',near:'回到定位',browse:'浏览名胜',selected:'景点位置',source:'坐标来源',representative:'景点代表位置 · 不代表入口或骑行路线。',close:'关闭',group:'处地点 · 点击放大',explore:'发现韩国各地的风景',key:'宫殿 · 寺庙 · 自然',count:'处地点'}
};
export const MAP_ICONS={
 palace:'<path d="M2 10l10-6 10 6H2M5 10v9h14v-9M9 19v-5h6v5M3 21h18"/>',
 temple:'<path d="M12 2v3M7 8l5-3 5 3H7M5 13l7-4 7 4H5M3 18l9-4 9 4H3M7 18v4m10-4v4"/>',
 fortress:'<path d="M3 21V7h4v3h3V5h4v5h3V7h4v14H3M9 21v-6h6v6"/>',
 village:'<path d="M2 11l6-5 6 5M4 10v10h8V10M10 6l5-4 7 6M15 9v11h5V8M7 20v-5h3"/>',
 tower:'<path d="M12 2v4M7 6h10v4H7V6M9 10l-2 11h10l-2-11M4 21h16M10 15h4"/>',
 nature:'<path d="M2 20L10 4l5 10 3-6 4 12H2M7 10l3 2 2-3"/>',
 coast:'<path d="M3 17q3-3 6 0t6 0 6 0M3 21q3-3 6 0t6 0 6 0M12 14V4M4 8q8-10 16 0H4"/>',
 park:'<path d="M12 3L5 12h3l-4 5h16l-4-5h3L12 3M12 17v4"/>',
 cafe:'<path d="M4 7h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7M16 8h2a3 3 0 0 1 0 6h-2M4 21h15M8 3v1M12 3v1"/>'
};
export const landmarkIcon=kind=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MAP_ICONS[kind]||MAP_ICONS.palace}</svg>`;
// Group nearby projected points to keep small-screen national views readable.
// Never discard a point: every item remains available in the accessible list.
export function groupLandmarks(places,project,radius=42){
 const groups=[];
 for(const p of places){const xy=project([p.lon,p.lat]);const g=groups.find(g=>Math.hypot(g.x-xy.x,g.y-xy.y)<radius);
  if(g){g.places.push(p);}else groups.push({x:xy.x,y:xy.y,places:[p]});}
 return groups;
}
