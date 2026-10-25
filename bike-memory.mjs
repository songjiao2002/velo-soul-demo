import {allowedRequestOrigin} from './native-origin.mjs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,timingSafeEqual} from 'node:crypto';
import {mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {BIKE_IDS,MEMORY_DAYS,MEMORY_LIMIT,memoryTheme} from './public/bike-memory-core.mjs';
import {ChatError,readChatBody} from './chat-service.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
const validToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function normalizeMemory(body){
 if(!body||!BIKE_IDS.includes(body.bike)||!validId(body.id)||!validToken(body.token)||body.consent!==true||typeof body.text!=='string')throw new ChatError('invalid_memory');
 const text=body.text.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim();
 if(!text||[...text].length>120)throw new ChatError('invalid_memory');
 if(/https?:|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}/iu.test(text))throw new ChatError('memory_contact');
 return {id:body.id,bike:body.bike,text,theme:memoryTheme(text),tokenHash:hash(body.token)};
}
export class BikeMemoryStore{
 constructor(filename,{now=Date.now}={}){
  this.now=now;this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY,bike TEXT NOT NULL,text TEXT NOT NULL,theme TEXT NOT NULL,created INTEGER NOT NULL,tokenHash TEXT NOT NULL); CREATE INDEX IF NOT EXISTS bike_created ON memories(bike,created DESC,id DESC); CREATE TABLE IF NOT EXISTS writes (at INTEGER NOT NULL);`);this.prune();
 }
 prune(){this.db.prepare('DELETE FROM memories WHERE created < ?').run(this.now()-MEMORY_DAYS*86400000);this.db.prepare('DELETE FROM writes WHERE at < ?').run(this.now()-86400000);}
 public(row){return row?{id:row.id,bike:row.bike,text:row.text,theme:row.theme,createdAt:row.created}:null;}
 latest(bike){this.prune();return this.public(this.db.prepare('SELECT * FROM memories WHERE bike=? ORDER BY created DESC,id DESC LIMIT 1').get(bike));}
 put(body){
  const m=normalizeMemory(body);this.prune();const old=this.db.prepare('SELECT * FROM memories WHERE id=?').get(m.id);
  if(old){if(old.bike!==m.bike||old.text!==m.text||old.tokenHash!==m.tokenHash)throw new ChatError('memory_conflict',409);return this.public(old);}
  // Global bounded write budget persists through process restarts.
  if(this.db.prepare('SELECT COUNT(*) AS n FROM writes WHERE at>?').get(this.now()-60000).n>=10||this.db.prepare('SELECT COUNT(*) AS n FROM writes').get().n>=120)throw new ChatError('rate_limited',429);
  this.db.exec('BEGIN IMMEDIATE');try{
   this.db.prepare('INSERT INTO memories VALUES (?,?,?,?,?,?)').run(m.id,m.bike,m.text,m.theme,this.now(),m.tokenHash);
   this.db.prepare('INSERT INTO writes VALUES (?)').run(this.now());
   this.db.prepare('DELETE FROM memories WHERE bike=? AND id NOT IN (SELECT id FROM memories WHERE bike=? ORDER BY created DESC,id DESC LIMIT ?)').run(m.bike,m.bike,MEMORY_LIMIT);
   this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
  return this.public(this.db.prepare('SELECT * FROM memories WHERE id=?').get(m.id));
 }
 remove(body){
  if(!body||!BIKE_IDS.includes(body.bike)||!validId(body.id)||!validToken(body.token))throw new ChatError('invalid_memory');
  const old=this.db.prepare('SELECT * FROM memories WHERE id=? AND bike=?').get(body.id,body.bike);
  if(old&&!timingSafeEqual(Buffer.from(old.tokenHash,'hex'),Buffer.from(hash(body.token),'hex')))throw new ChatError('memory_forbidden',403);
  if(old)this.db.prepare('DELETE FROM memories WHERE id=?').run(body.id);
 }
 close(){this.db.close();}
}
export function openBikeMemory(env=process.env){
 // Production sharing stays unavailable until durable storage is mounted.
 const mount=env.RAILWAY_VOLUME_MOUNT_PATH||'/data';
 const filename=env.SOUL_MEMORY_DB||(env.NODE_ENV==='production'?(existsSync(mount)?path.join(mount,'velo-memory','memories.sqlite'):null):path.resolve('.data','memories.sqlite'));
 if(!filename)return null;
 try{mkdirSync(path.dirname(filename),{recursive:true});return new BikeMemoryStore(filename);}catch{console.warn('Bicycle memory unavailable: check persistent storage permissions.');return null;}
}
export function createMemoryHandler(store){
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/bike-memory')return false;
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
  try{
   if(['GET','HEAD'].includes(req.method)){const bike=url.searchParams.get('bike');if(!BIKE_IDS.includes(bike))throw new ChatError('invalid_memory');send(200,{available:!!store,memory:store?.latest(bike)||null});return true;}
   if(!['POST','DELETE'].includes(req.method)){res.setHeader('Allow','GET, HEAD, POST, DELETE');throw new ChatError('method_not_allowed',405);}
   const origin=req.headers.origin;
   if(!allowedRequestOrigin(req))throw new ChatError('origin_not_allowed',403);
   if(!store)throw new ChatError('memory_unavailable',503);
   const body=await readChatBody(req,4096);
   if(req.method==='DELETE'){store.remove(body);send(200,{removed:true});}else send(200,{memory:store.put(body)});
  }catch(error){send(error instanceof ChatError?error.status:500,{error:error instanceof ChatError?error.code:'memory_unavailable'});}
  return true;
 };
}
