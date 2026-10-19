// Session-only decoded audio. Bound both memory and entries on mobile devices.
export class SpeechAudioCache {
 constructor({maxBytes=6*1024*1024,maxEntries=8}={}){
  this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.entries=new Map();this.bytes=0;
 }
 get size(){return this.entries.size;}
 has(key){return this.entries.has(key);}
 get(key){
  const entry=this.entries.get(key);if(!entry)return;
  this.entries.delete(key);this.entries.set(key,entry);return entry.buffer;
 }
 set(key,buffer){
  const samples=buffer.length??Math.ceil(buffer.duration*(buffer.sampleRate||24000));
  const bytes=samples*(buffer.numberOfChannels||1)*4;
  if(!Number.isSafeInteger(bytes)||bytes<=0||bytes>this.maxBytes)return false;
  this.delete(key);
  while(this.entries.size&&(this.bytes+bytes>this.maxBytes||this.entries.size>=this.maxEntries))this.delete(this.entries.keys().next().value);
  this.entries.set(key,{buffer,bytes});this.bytes+=bytes;return true;
 }
 delete(key){const entry=this.entries.get(key);if(entry){this.bytes-=entry.bytes;this.entries.delete(key);}}
 clear(){this.entries.clear();this.bytes=0;}
}
