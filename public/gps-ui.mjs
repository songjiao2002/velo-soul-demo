export const GPS_COPY={
 zh:{title:'连接你所在的地方',connect:'连接 GPS 定位',stop:'停止定位',retry:'重新连接 GPS',off:'尚未连接定位',waiting:'正在请求定位权限并等待 GPS 信号…',connected:'GPS 已连接 · 正在更新位置',weak:'定位精度不足，等待更准的信号',denied:'定位权限未获允许。请在浏览器网站设置中允许定位，再重试。',error:'暂时无法获取位置。请确认手机定位已开启，在室外重试。',unsupported:'当前环境无法定位，请用手机浏览器打开 HTTPS 链接。',paused:'定位已暂停，可重新连接。',privacy:'只请求定位，不开启相机或麦克风。用于地图、附近地点与天气；天气查询使用约 2km 的网格位置。',accuracy:'精度',coordinates:'当前位置'},
 en:{title:'Connect to where you are',connect:'Connect GPS location',stop:'Stop location',retry:'Reconnect GPS',off:'Location is not connected',waiting:'Requesting location permission and waiting for GPS…',connected:'GPS connected · updating your location',weak:'Waiting for a more accurate location',denied:'Location permission was not granted. Allow location in the browser’s site settings, then retry.',error:'Location is unavailable. Enable phone location and try again outdoors.',unsupported:'Location is unavailable here. Open the HTTPS link in your phone browser.',paused:'Location paused. You can reconnect.',privacy:'Requests location only, without camera or microphone. Used for the map, nearby places and weather; weather queries use an approximately 2 km grid.',accuracy:'Accuracy',coordinates:'Current position'},
 ko:{title:'지금 있는 곳과 연결하기',connect:'GPS 위치 연결',stop:'위치 연결 끄기',retry:'GPS 다시 연결',off:'아직 위치가 연결되지 않았어요',waiting:'위치 권한과 GPS 신호를 기다리고 있어요…',connected:'GPS 연결됨 · 위치를 업데이트하고 있어요',weak:'더 정확한 위치 신호를 기다리고 있어요',denied:'위치 권한이 허용되지 않았어요. 브라우저의 사이트 설정에서 위치를 허용한 뒤 다시 시도해주세요.',error:'위치를 찾지 못했어요. 휴대폰 위치 기능을 켜고 실외에서 다시 시도해주세요.',unsupported:'이 환경에서는 위치를 사용할 수 없어요. 휴대폰 브라우저에서 HTTPS 링크를 열어주세요.',paused:'위치 연결을 잠시 멈췄어요. 다시 연결할 수 있어요.',privacy:'카메라나 마이크 없이 위치 권한만 요청해요. 지도·주변 장소·날씨에 사용하며, 날씨 조회에는 약 2km 격자 위치를 사용해요.',accuracy:'정확도',coordinates:'현재 위치'}
};
export function gpsMarkup(lang='ko',compact=false){const c=GPS_COPY[lang]||GPS_COPY.en;return `<section class="gps-connect ${compact?'gps-compact':''}" data-gps-panel data-no-translate><div class="gps-connect-head"><b data-gps-title>${c.title}</b><button type="button" class="secondary" data-action="gps" data-gps-toggle aria-pressed="false">${c.connect}</button></div><p data-gps-status role="status">${c.off}</p>${compact?'':`<p class="small" data-gps-detail></p><p class="small" data-gps-privacy>${c.privacy}</p>`}</section>`;}
export function validGPSPoint(pos,now=Date.now()){
 const c=pos?.coords;if(!c||![c.latitude,c.longitude,c.accuracy,pos.timestamp].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<0||now-pos.timestamp>30000||pos.timestamp-now>5000)return null;
 return {lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,time:pos.timestamp};
}
export function paintGPS(document,{language='ko',state='off',active=false,point=null}={}){
 const c=GPS_COPY[language]||GPS_COPY.en,copy=c[state]||c.off;
 for(const el of document.querySelectorAll('[data-gps-toggle]')){el.textContent=active?c.stop:['denied','error','paused','unsupported'].includes(state)?c.retry:c.connect;el.setAttribute('aria-pressed',String(active));}
 for(const el of document.querySelectorAll('[data-gps-title]'))el.textContent=c.title;
 for(const el of document.querySelectorAll('[data-gps-status]'))el.textContent=copy+(point?' · '+c.accuracy+' ±'+Math.round(point.accuracy)+' m':'');
 for(const el of document.querySelectorAll('[data-gps-detail]'))el.textContent=point?c.coordinates+': '+point.lat.toFixed(5)+', '+point.lon.toFixed(5):'';
 for(const el of document.querySelectorAll('[data-gps-privacy]'))el.textContent=c.privacy;
 return copy;
}
