import {readFileSync} from 'node:fs';
import {verifiedReleaseMetadata} from '../../release-validation.mjs';
const repo='songjiao2002/velo-soul-demo',source=process.env.BUILD_COMMIT;
if(process.env.GITHUB_REPOSITORY!==repo||process.env.GITHUB_REF!=='refs/heads/main'||source!==process.env.GITHUB_SHA)throw Error('Only the tested main revision may publish');
async function api(path,body,method=body?'POST':'GET'){
 const response=await fetch(`https://api.github.com/repos/${repo}/${path}`,{method,headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});
 if(!response.ok)throw Error(`GitHub request failed (${response.status})`);return response.json();
}
const verification=JSON.parse(readFileSync('release/verification.json','utf8'));
const githubRelease=await api('releases/tags/'+encodeURIComponent(`v${verification.version}-mobile-preview`));
const metadata=verifiedReleaseMetadata({verification,githubRelease,previous:JSON.parse(readFileSync('public/app-release.json','utf8')),source});
async function assertHead(){if((await api('git/ref/heads/main')).object.sha!==source)throw Error('Main changed; APK is published but download metadata was not changed. Rebuild the latest main.');}
await assertHead();
const parent=await api('git/commits/'+source);
const tree=await api('git/trees',{base_tree:parent.tree.sha,tree:[{path:'public/app-release.json',mode:'100644',type:'blob',content:JSON.stringify(metadata,null,2)+'\n'}]});
const commit=await api('git/commits',{message:`Publish verified Android ${verification.version} download [skip ci]`,tree:tree.sha,parents:[source]});
await assertHead();await api('git/refs/heads/main',{sha:commit.sha,force:false},'PATCH');
console.log(JSON.stringify({version:metadata.version,versionCode:metadata.android.versionCode,sha256:metadata.android.sha256,commit:commit.sha}));
