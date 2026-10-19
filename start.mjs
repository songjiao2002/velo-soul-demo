// The volume is owned by root when first mounted. Prepare only our own directory,
// then drop privileges before importing any request-handling application code.
import {mkdirSync,existsSync,chownSync} from 'node:fs';
import path from 'node:path';
if(process.getuid?.()===0){
 const mount=process.env.RAILWAY_VOLUME_MOUNT_PATH||'/data';
 if(existsSync(mount)){const folder=path.join(mount,'velo-memory');mkdirSync(folder,{recursive:true});chownSync(folder,1000,1000);}
 process.setgid(1000);process.setuid(1000);
}
const {server}=await import('./server.mjs');
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('VELO SOUL ready'));
process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
