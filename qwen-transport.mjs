import {Pool,buildConnector} from 'undici';

// Open TLS during microphone capture. An idle socket carries no HTTP request,
// audio, credentials or model tokens. Chat and its first speech request can overlap.
export function createQwenTransport(origin,{dial=buildConnector({timeout:5000,allowH2:false}),idleMs=12000}={}){
  const url=new URL(origin);
  const address={protocol:url.protocol,hostname:url.hostname,host:url.host,port:url.port||'443',servername:url.hostname};
  const spares=new Set();
  let nextAttempt=0,closed=false;

  function drop(entry){
    spares.delete(entry);
    clearTimeout(entry.timer);
    entry.socket?.destroy();
  }

  function connect(options,callback){
    for(const entry of spares){
      if(!entry.ready||entry.socket.destroyed||entry.socket.readableEnded)continue;
      spares.delete(entry);
      clearTimeout(entry.timer);
      entry.socket.removeListener('close',entry.onClose);
      entry.socket.removeListener('end',entry.onEnd);
      entry.socket.ref();
      // Undici must finish its dispatch pass before resuming the queued request.
      queueMicrotask(()=>{
        if(entry.socket.destroyed||entry.socket.readableEnded)dial(options,callback);
        else callback(null,entry.socket);
      });
      return;
    }
    dial(options,callback);
  }

  const pool=new Pool(url.origin,{connections:12,connect,allowH2:false});
  return {
    dispatcher:pool,
    warm(){
      if(closed||Date.now()<nextAttempt)return;
      const needed=2-pool.stats.free-spares.size;
      if(needed<=0)return;
      nextAttempt=Date.now()+1200;
      for(let i=0;i<needed;i++){
        const entry={};
        spares.add(entry);
        entry.timer=setTimeout(()=>drop(entry),idleMs).unref();
        try{
          dial(address,(error,socket)=>{
            if(error||!spares.has(entry)){drop(entry);socket?.destroy();return;}
            entry.socket=socket;
            entry.ready=true;
            entry.onClose=()=>{spares.delete(entry);clearTimeout(entry.timer);};
            entry.onEnd=()=>drop(entry);
            socket.once('close',entry.onClose).once('end',entry.onEnd).unref();
          });
        }catch{drop(entry);}
      }
    },
    close(){
      closed=true;
      for(const entry of spares)drop(entry);
      return pool.close();
    }
  };
}
