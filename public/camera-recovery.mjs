import {isNative,PUBLIC_ORIGIN} from './app-network.mjs';
import {browserAudioContext,companionBrowserLinks} from './audio-browser.mjs';
import {hasNativeMedia,openMediaSettings} from './native-media.mjs';
const COPY={
 en:{title:'Let’s reconnect your camera.',retry:'Try camera again',settings:'App permissions',native:'In App permissions, allow Camera. For voice with paired headphones, allow Microphone and Nearby devices too.',web:'Allow Camera in this browser’s site settings. If another app is using it, close that camera first.',embedded:'The in-app browser may block camera access. Open the same companion in your phone browser.',outside:'Open in Chrome',link:'Open companion link',failed:'Could not open settings. Open VELO SOUL in your phone’s app settings.'},
 ko:{title:'카메라를 다시 연결해 볼까요?',retry:'카메라 다시 켜기',settings:'앱 권한 설정',native:'앱 권한에서 카메라를 허용해 주세요. 연결된 이어폰으로 대화하려면 마이크와 근처 기기도 허용해 주세요.',web:'브라우저 사이트 설정에서 카메라를 허용해 주세요. 다른 앱에서 사용 중이면 해당 카메라를 먼저 꺼 주세요.',embedded:'앱 내 브라우저가 카메라를 제한할 수 있어요. 같은 소울을 휴대폰 브라우저에서 열어 주세요.',outside:'Chrome에서 열기',link:'소울 링크 열기',failed:'설정을 열지 못했어요. 휴대폰 앱 설정에서 VELO SOUL을 선택해 주세요.'},
 zh:{title:'重新连接相机',retry:'重试相机',settings:'打开 App 权限',native:'在 App 权限中允许相机。使用已配对耳机对话时，也请允许麦克风和附近设备。',web:'请在浏览器的网站设置中允许相机；如果其他 App 正在使用相机，请先关闭它。',embedded:'内置浏览器可能限制相机访问。可以在手机浏览器中打开同一个伙伴。',outside:'在 Chrome 打开',link:'打开伙伴链接',failed:'未能打开设置，请在手机的应用设置中找到 VELO SOUL。'}
};
export function paintCameraRecovery({state,code,language='en',selected='lumi',scanning=false,document=globalThis.document}){
 const host=document.getElementById('cameraRecovery');if(!host)return;host.hidden=state!=='error';if(host.hidden){host.replaceChildren();return;}
 const c=COPY[language]||COPY.en,native=isNative(),browser=browserAudioContext(globalThis.navigator?.userAgent||'');
 const make=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 host.replaceChildren(make('b',c.title),make('p',native?c.native:browser.embedded?c.embedded:c.web));
 const actions=document.createElement('div'),retry=make('button',c.retry);retry.dataset.action='camera-start';retry.className='primary';actions.append(retry);
 if(hasNativeMedia()){const settings=make('button',c.settings);settings.className='secondary';settings.onclick=()=>openMediaSettings().catch(()=>{host.querySelector('p').textContent=c.failed;});actions.append(settings);}
 else if(browser.embedded){const links=companionBrowserLinks(scanning?PUBLIC_ORIGIN+'/?view=scan':PUBLIC_ORIGIN+'/?bike='+encodeURIComponent(selected)),link=make('a',browser.android?c.outside:c.link);link.className='secondary';link.href=browser.android?links.chrome:links.link;actions.append(link);}
 host.append(actions);const details=document.createElement('details');details.append(make('summary',language==='ko'?'상세 정보':language==='zh'?'错误详情':'Details'),make('small',String(code||'CameraError')));host.append(details);
}
