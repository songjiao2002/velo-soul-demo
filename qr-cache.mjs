import {createHash} from 'node:crypto';

// Bound both entry count and retained bytes even when request origins vary.
export class QrCache {
 constructor({maxEntries=24,maxBytes=2*1024*1024}={}){this.maxEntries=maxEntries;this.maxBytes=maxBytes;this.entries=new Map();this.bytes=0;}
 get(soul,origin,format,render){
  const key=JSON.stringify([soul,origin,format]),cached=this.entries.get(key);
  if(cached){this.entries.delete(key);this.entries.set(key,cached);return cached;}
  const body=Buffer.from(render()),entry={body,etag:'"'+createHash('sha256').update(body).digest('hex')+'"'};
  if(body.length>this.maxBytes||this.maxEntries<1)return entry;
  while(this.entries.size>=this.maxEntries||this.bytes+body.length>this.maxBytes){const oldest=this.entries.keys().next().value;this.bytes-=this.entries.get(oldest).body.length;this.entries.delete(oldest);}
  this.entries.set(key,entry);this.bytes+=body.length;return entry;
 }
}
