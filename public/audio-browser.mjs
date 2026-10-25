import {isNative,PUBLIC_ORIGIN} from './app-network.mjs';
export function browserAudioContext(ua=''){
 const android=/Android/i.test(ua),wechat=/MicroMessenger/i.test(ua);
 const host=wechat?'WeChat':/KAKAOTALK/i.test(ua)?'KakaoTalk':/NAVER\(/i.test(ua)?'Naver':/DaumApps|DaumDevice/i.test(ua)?'Daum':/Instagram/i.test(ua)?'Instagram':/FBAN|FBAV/i.test(ua)?'Facebook':/Line\//i.test(ua)?'LINE':/\bwv\b/i.test(ua)?'WebView':'';
 return {android,wechat,host,embedded:!!host};
}
export function companionBrowserLinks(href){
 const input=new URL(href),original=isNative()?new URL(input.pathname+input.search,PUBLIC_ORIGIN):input;if(!['http:','https:'].includes(original.protocol))throw Error('url');
 // Keep only the soul choice. Camera URLs must not auto-request permissions
 // after opening another app; transient/sensitive query parameters are omitted.
 const url=new URL('/',original.origin),bike=original.searchParams.get('bike');if(['lumi','mori','bori'].includes(bike))url.searchParams.set('bike',bike);
 const link=url.href,make=packageName=>`intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0,-1)};package=${packageName};S.browser_fallback_url=${encodeURIComponent(link)};end`;
 return {link,chrome:make('com.android.chrome'),samsung:make('com.sec.android.app.sbrowser')};
}
