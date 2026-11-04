import {CHARACTERS,CHARACTER_ORDER} from './character-art.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COPY={
 en:{title:'Memories on this device',body:'Each companion keeps a few of your shared conversations here. Up to three past excerpts go to Qwen when you chat again. These are separate from public bicycle memories and never sync to other devices.',empty:'You haven’t shared a conversation yet.',met:'We have met before.',forget:'Clear this companion’s memories',done:'Memories cleared.',failed:'Device storage is unavailable. Memories cannot be saved or cleared.'},
 ko:{title:'이 기기의 추억',body:'친구마다 함께 나눈 대화 일부를 이 기기에 보관해요. 다음 대화 때 이전 대화 최대 3쌍을 Qwen에 보내요. 공개 자전거 기억과는 별개이며 다른 기기에 동기화되지 않아요.',empty:'아직 함께 나눈 대화가 없어요.',met:'전에 만난 사이예요.',forget:'이 친구의 기억 지우기',done:'기억을 지웠어요.',failed:'기기 저장소를 사용할 수 없어 기억을 저장하거나 지울 수 없어요.'},
 zh:{title:'这台设备上的回忆',body:'每个角色分别记住几段共同聊过的话。再次聊天时，最多3段旧对话会传给千问用于接续话题。这与公开的自行车回忆分开，不会同步到其他设备。',empty:'还没有留下共同聊过的片段。',met:'我们以前见过面。',forget:'清除此角色的记忆',done:'已清除记忆。',failed:'本机存储不可用，无法保存或清除记忆。'}
};
export function mountDeviceMemorySettings({memory,getLanguage,document=globalThis.document,onForget=()=>{}}){
 const root=document.createElement('details');root.className='device-memory-settings';root.dataset.noTranslate='';document.querySelector('#appSettingsDialog').append(root);
 let status='';function render(){const c=COPY[getLanguage()]||COPY.en;root.innerHTML=`<summary>${c.title}</summary><p>${c.body}</p>${CHARACTER_ORDER.map(id=>{const m=memory.read(id),name=getLanguage()==='ko'?CHARACTERS[id].name:CHARACTERS[id].en;return `<section><h3>${name}</h3>${m.exchanges.length?`<ul>${m.exchanges.map(x=>`<li>${escape(x.user)}</li>`).join('')}</ul>`:`<p>${m.visits?c.met:c.empty}</p>`}<button type="button" class="text-button" data-forget-companion="${id}" ${m.visits?'':'disabled'}>${c.forget}</button></section>`;}).join('')}<p role="status">${!memory.available?c.failed:status?c[status]:''}</p>`;}
 root.addEventListener('click',event=>{const id=event.target.closest('[data-forget-companion]')?.dataset.forgetCompanion;if(!id)return;if(memory.forget(id)){status='done';onForget(id);}else status='failed';render();});
 document.querySelector('#languageSelect').addEventListener('change',render);root.addEventListener('toggle',()=>{if(root.open)render();});render();return {render};
}
