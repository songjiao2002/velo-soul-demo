import {createHash,timingSafeEqual} from 'node:crypto';
import {ChatError,readChatBody} from './chat-service.mjs';
import {allowedRequestOrigin} from './native-origin.mjs';
import {BIKE_IDS} from './public/bike-memory-core.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const validId=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const clean=s=>s.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim();
function boundedText(value,max){
 if(typeof value!=='string')throw new ChatError('invalid_review');
 const text=clean(value);
 if(!text||[...text].length>max)throw new ChatError('invalid_review');
 if(/https?:|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}/iu.test(text))throw new ChatError('review_contact');
 return text;
}
function owner(body){if(!body||!BIKE_IDS.includes(body.bike)||!validId(body.id)||!validToken(body.token))throw new ChatError('invalid_review');}
function identity(body,required=false){
 if(body?.authorToken==null&&!required)return null;
 if(!validToken(body?.authorToken))throw new ChatError('invalid_review');
 return hash(body.authorToken);
}
export function normalizeReview(body){
 owner(body);
 if(body.consent!==true||!Number.isInteger(body.rating)||body.rating<1||body.rating>5)throw new ChatError('invalid_review');
 return {id:body.id,bike:body.bike,nickname:boundedText(body.nickname,24),text:boundedText(body.text,280),rating:body.rating,tokenHash:hash(body.token),authorHash:identity(body)};
}
// Tokens prove ownership; display names never identify an author. Share the existing SQLite volume.
export class BikeReviewStore{
 constructor(db,{now=Date.now}={}){
  this.db=db;this.now=now;
  db.exec('CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY,bike TEXT NOT NULL,nickname TEXT NOT NULL,text TEXT NOT NULL,rating INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,tokenHash TEXT NOT NULL); CREATE INDEX IF NOT EXISTS review_bike_created ON reviews(bike,created DESC,id DESC); CREATE TABLE IF NOT EXISTS review_writes (at INTEGER NOT NULL);');
  if(!db.prepare('PRAGMA table_info(reviews)').all().some(c=>c.name==='authorHash'))db.exec('ALTER TABLE reviews ADD COLUMN authorHash TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS review_author ON reviews(authorHash); CREATE TABLE IF NOT EXISTS review_authors (authorHash TEXT PRIMARY KEY,nickname TEXT NOT NULL); CREATE TABLE IF NOT EXISTS review_replies (id TEXT PRIMARY KEY,bike TEXT NOT NULL,parentId TEXT NOT NULL,replyToId TEXT,nickname TEXT NOT NULL,text TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,tokenHash TEXT NOT NULL,authorHash TEXT NOT NULL); CREATE INDEX IF NOT EXISTS reply_parent_created ON review_replies(parentId,created,id); CREATE INDEX IF NOT EXISTS reply_author ON review_replies(authorHash);');
 }
 cleanup(){
  this.db.exec('DELETE FROM review_replies WHERE parentId NOT IN (SELECT id FROM reviews); UPDATE review_replies SET replyToId=NULL WHERE replyToId IS NOT NULL AND replyToId NOT IN (SELECT id FROM review_replies); DELETE FROM review_authors WHERE authorHash NOT IN (SELECT authorHash FROM reviews WHERE authorHash IS NOT NULL) AND authorHash NOT IN (SELECT authorHash FROM review_replies);');
 }
 prune(){this.db.prepare('DELETE FROM reviews WHERE created < ?').run(this.now()-30*86400000);this.db.prepare('DELETE FROM review_writes WHERE at < ?').run(this.now()-86400000);this.cleanup();}
 public(row){return row?{id:row.id,bike:row.bike,nickname:row.nickname,text:row.text,rating:row.rating,createdAt:row.created,updatedAt:row.updated,replyCount:this.db.prepare('SELECT COUNT(*) AS n FROM review_replies WHERE parentId=?').get(row.id).n}:null;}
 publicReply(row){
  if(!row)return null;
  const target=row.replyToId?this.db.prepare('SELECT nickname FROM review_replies WHERE id=?').get(row.replyToId):null;
  return {id:row.id,bike:row.bike,parentId:row.parentId,replyToId:target?row.replyToId:null,replyToNickname:target?.nickname||null,nickname:row.nickname,text:row.text,createdAt:row.created,updatedAt:row.updated};
 }
 list(bike){this.prune();return this.db.prepare('SELECT * FROM reviews WHERE bike=? ORDER BY created DESC,id DESC LIMIT 50').all(bike).map(row=>this.public(row));}
 replies(bike,parentId){
  if(!BIKE_IDS.includes(bike)||!validId(parentId))throw new ChatError('invalid_review');
  this.prune();this.parent(bike,parentId);
  return this.db.prepare('SELECT * FROM review_replies WHERE parentId=? ORDER BY created,id LIMIT 50').all(parentId).map(row=>this.publicReply(row));
 }
 parent(bike,id){const row=this.db.prepare('SELECT * FROM reviews WHERE id=? AND bike=?').get(id,bike);if(!row)throw new ChatError('review_missing',404);return row;}
 authorize(old,body){if(old&&(old.bike!==body.bike||!timingSafeEqual(Buffer.from(old.tokenHash,'hex'),Buffer.from(hash(body.token),'hex'))))throw new ChatError('review_forbidden',403);}
 budget(){if(this.db.prepare('SELECT COUNT(*) AS n FROM review_writes WHERE at>?').get(this.now()-60000).n>=20||this.db.prepare('SELECT COUNT(*) AS n FROM review_writes').get().n>=240)throw new ChatError('rate_limited',429);}
 transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
 author(authorHash,nickname){
  if(!authorHash)return nickname;
  this.db.prepare('INSERT OR IGNORE INTO review_authors VALUES (?,?)').run(authorHash,nickname);
  return this.db.prepare('SELECT nickname FROM review_authors WHERE authorHash=?').get(authorHash).nickname;
 }
 rename(body){
  const authorHash=identity(body,true),nickname=boundedText(body.nickname,24),proofs=body.proofs??[];
  if(!Array.isArray(proofs)||proofs.length>3||new Set(proofs.map(p=>p?.id)).size!==proofs.length)throw new ChatError('invalid_review');
  this.prune();
  // Validate all legacy proofs before any mutation. Same-name strangers are unrelated.
  const rows=proofs.map(p=>{owner(p);const row=this.db.prepare('SELECT * FROM reviews WHERE id=?').get(p.id);this.authorize(row,p);return row;}).filter(Boolean);
  const author=this.db.prepare('SELECT nickname FROM review_authors WHERE authorHash=?').get(authorHash);
  const changed=author?.nickname!==nickname||rows.some(r=>r.nickname!==nickname||r.authorHash!==authorHash);
  if((author||rows.length)&&changed){
   this.budget();this.transaction(()=>{
    this.db.prepare('INSERT INTO review_authors VALUES (?,?) ON CONFLICT(authorHash) DO UPDATE SET nickname=excluded.nickname').run(authorHash,nickname);
    for(const row of rows)this.db.prepare('UPDATE reviews SET authorHash=? WHERE id=?').run(authorHash,row.id);
    this.db.prepare('UPDATE reviews SET nickname=? WHERE authorHash=?').run(nickname,authorHash);
    this.db.prepare('UPDATE review_replies SET nickname=? WHERE authorHash=?').run(nickname,authorHash);
    this.db.prepare('INSERT INTO review_writes VALUES (?)').run(this.now());
   });
  }
  return {nickname};
 }
 put(body){
  const r=normalizeReview(body);this.prune();const old=this.db.prepare('SELECT * FROM reviews WHERE id=?').get(r.id);this.authorize(old,body);
  const authorHash=r.authorHash||old?.authorHash||null;
  const existingName=authorHash?this.db.prepare('SELECT nickname FROM review_authors WHERE authorHash=?').get(authorHash)?.nickname:null;
  r.nickname=existingName||r.nickname;
  if(old&&['nickname','text','rating'].every(k=>old[k]===r[k])&&old.authorHash===authorHash)return this.public(old);
  this.budget();this.transaction(()=>{
   const now=this.now(),nickname=this.author(authorHash,r.nickname);
   this.db.prepare('INSERT INTO reviews (id,bike,nickname,text,rating,created,updated,tokenHash,authorHash) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,text=excluded.text,rating=excluded.rating,updated=excluded.updated,authorHash=excluded.authorHash').run(r.id,r.bike,nickname,r.text,r.rating,old?.created??now,now,r.tokenHash,authorHash);
   this.db.prepare('INSERT INTO review_writes VALUES (?)').run(now);
   this.db.prepare('DELETE FROM reviews WHERE bike=? AND id NOT IN (SELECT id FROM reviews WHERE bike=? ORDER BY created DESC,id DESC LIMIT 50)').run(r.bike,r.bike);
   this.cleanup();
  });
  return this.public(this.db.prepare('SELECT * FROM reviews WHERE id=?').get(r.id));
 }
 putReply(body){
  owner(body);const authorHash=identity(body,true),nickname=boundedText(body.nickname,24),text=boundedText(body.text,280);
  if(body.consent!==true||!validId(body.parentId)||(body.replyToId!=null&&!validId(body.replyToId)))throw new ChatError('invalid_review');
  this.prune();this.parent(body.bike,body.parentId);
  const old=this.db.prepare('SELECT * FROM review_replies WHERE id=?').get(body.id);this.authorize(old,body);
  if(old&&(old.parentId!==body.parentId||old.authorHash!==authorHash||old.replyToId!==(body.replyToId??null)))throw new ChatError('review_forbidden',403);
  if(body.replyToId&&!this.db.prepare('SELECT id FROM review_replies WHERE id=? AND parentId=?').get(body.replyToId,body.parentId))throw new ChatError('review_missing',404);
  if(old&&old.text===text)return this.publicReply(old);
  if(!old&&this.db.prepare('SELECT COUNT(*) AS n FROM review_replies WHERE parentId=?').get(body.parentId).n>=50)throw new ChatError('thread_full',409);
  this.budget();this.transaction(()=>{
   const now=this.now();
   this.db.prepare('INSERT INTO review_replies VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET text=excluded.text,updated=excluded.updated').run(body.id,body.bike,body.parentId,body.replyToId??null,this.author(authorHash,nickname),text,old?.created??now,now,hash(body.token),authorHash);
   this.db.prepare('INSERT INTO review_writes VALUES (?)').run(now);
  });
  return this.publicReply(this.db.prepare('SELECT * FROM review_replies WHERE id=?').get(body.id));
 }
 remove(body,reply=false){
  owner(body);const table=reply?'review_replies':'reviews',old=this.db.prepare('SELECT * FROM '+table+' WHERE id=?').get(body.id);this.authorize(old,body);
  if(old)this.transaction(()=>{this.db.prepare('DELETE FROM '+table+' WHERE id=?').run(body.id);this.cleanup();});
 }
}
export function createReviewHandler(store){
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),route=url.pathname;
  if(!['/api/bike-reviews','/api/bike-reviews/replies','/api/bike-reviews/nickname'].includes(route))return false;
  const isReply=route.endsWith('/replies'),isName=route.endsWith('/nickname');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
  try{
   if(['GET','HEAD'].includes(req.method)&&!isName){
    const bike=url.searchParams.get('bike');if(!BIKE_IDS.includes(bike))throw new ChatError('invalid_review');
    send(200,isReply?{available:!!store,replies:store?.replies(bike,url.searchParams.get('id'))||[]}:{available:!!store,reviews:store?.list(bike)||[]});return true;
   }
   if(!(isName?['POST']:['POST','DELETE']).includes(req.method)){res.setHeader('Allow',isName?'POST':'GET, HEAD, POST, DELETE');throw new ChatError('method_not_allowed',405);}
   if(!allowedRequestOrigin(req))throw new ChatError('origin_not_allowed',403);
   if(!store)throw new ChatError('reviews_unavailable',503);
   const body=await readChatBody(req,4096);
   if(isName)send(200,store.rename(body));
   else if(req.method==='DELETE'){store.remove(body,isReply);send(200,{removed:true});}
   else send(200,isReply?{reply:store.putReply(body)}:{review:store.put(body)});
  }catch(error){send(error instanceof ChatError?error.status:500,{error:error instanceof ChatError?error.code:'reviews_unavailable'});}
  return true;
 };
}

