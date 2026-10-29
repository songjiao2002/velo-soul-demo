import {createHash,timingSafeEqual} from 'node:crypto';
import {ChatError,readChatBody} from './chat-service.mjs';
import {allowedRequestOrigin} from './native-origin.mjs';
import {BIKE_IDS} from './public/bike-memory-core.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const validId=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const clean=s=>s.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim();
function owner(body){if(!body||!BIKE_IDS.includes(body.bike)||!validId(body.id)||!validToken(body.token))throw new ChatError('invalid_review');}
export function normalizeReview(body){
 owner(body);
 if(body.consent!==true||typeof body.nickname!=='string'||typeof body.text!=='string'||!Number.isInteger(body.rating)||body.rating<1||body.rating>5)throw new ChatError('invalid_review');
 const nickname=clean(body.nickname),text=clean(body.text);
 if(!nickname||[...nickname].length>24||!text||[...text].length>280)throw new ChatError('invalid_review');
 if(/https?:|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}/iu.test(nickname+' '+text))throw new ChatError('review_contact');
 return {id:body.id,bike:body.bike,nickname,text,rating:body.rating,tokenHash:hash(body.token)};
}
// Share the existing durable SQLite volume; reviews never enter model context.
export class BikeReviewStore{
 constructor(db,{now=Date.now}={}){
  this.db=db;this.now=now;
  db.exec('CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY,bike TEXT NOT NULL,nickname TEXT NOT NULL,text TEXT NOT NULL,rating INTEGER NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,tokenHash TEXT NOT NULL); CREATE INDEX IF NOT EXISTS review_bike_created ON reviews(bike,created DESC,id DESC); CREATE TABLE IF NOT EXISTS review_writes (at INTEGER NOT NULL);');
 }
 prune(){this.db.prepare('DELETE FROM reviews WHERE created < ?').run(this.now()-30*86400000);this.db.prepare('DELETE FROM review_writes WHERE at < ?').run(this.now()-86400000);}
 public(row){return row?{id:row.id,bike:row.bike,nickname:row.nickname,text:row.text,rating:row.rating,createdAt:row.created,updatedAt:row.updated}:null;}
 list(bike){this.prune();return this.db.prepare('SELECT * FROM reviews WHERE bike=? ORDER BY created DESC,id DESC LIMIT 50').all(bike).map(row=>this.public(row));}
 authorize(old,body){if(old&&(old.bike!==body.bike||!timingSafeEqual(Buffer.from(old.tokenHash,'hex'),Buffer.from(hash(body.token),'hex'))))throw new ChatError('review_forbidden',403);}
 put(body){
  const r=normalizeReview(body);this.prune();const old=this.db.prepare('SELECT * FROM reviews WHERE id=?').get(r.id);this.authorize(old,body);
  if(old&&['nickname','text','rating'].every(k=>old[k]===r[k]))return this.public(old);
  if(this.db.prepare('SELECT COUNT(*) AS n FROM review_writes WHERE at>?').get(this.now()-60000).n>=20||this.db.prepare('SELECT COUNT(*) AS n FROM review_writes').get().n>=240)throw new ChatError('rate_limited',429);
  this.db.exec('BEGIN IMMEDIATE');try{
   const now=this.now();
   this.db.prepare('INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,text=excluded.text,rating=excluded.rating,updated=excluded.updated').run(r.id,r.bike,r.nickname,r.text,r.rating,old?.created??now,now,r.tokenHash);
   this.db.prepare('INSERT INTO review_writes VALUES (?)').run(now);
   this.db.prepare('DELETE FROM reviews WHERE bike=? AND id NOT IN (SELECT id FROM reviews WHERE bike=? ORDER BY created DESC,id DESC LIMIT 50)').run(r.bike,r.bike);
   this.db.exec('COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
  return this.public(this.db.prepare('SELECT * FROM reviews WHERE id=?').get(r.id));
 }
 remove(body){owner(body);const old=this.db.prepare('SELECT * FROM reviews WHERE id=?').get(body.id);this.authorize(old,body);if(old)this.db.prepare('DELETE FROM reviews WHERE id=?').run(body.id);}
}
export function createReviewHandler(store){
 return async(req,res)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/bike-reviews')return false;
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify(data));};
  try{
   if(['GET','HEAD'].includes(req.method)){const bike=url.searchParams.get('bike');if(!BIKE_IDS.includes(bike))throw new ChatError('invalid_review');send(200,{available:!!store,reviews:store?.list(bike)||[]});return true;}
   if(!['POST','DELETE'].includes(req.method)){res.setHeader('Allow','GET, HEAD, POST, DELETE');throw new ChatError('method_not_allowed',405);}
   if(!allowedRequestOrigin(req))throw new ChatError('origin_not_allowed',403);
   if(!store)throw new ChatError('reviews_unavailable',503);
   const body=await readChatBody(req,4096);
   if(req.method==='DELETE'){store.remove(body);send(200,{removed:true});}else send(200,{review:store.put(body)});
  }catch(error){send(error instanceof ChatError?error.status:500,{error:error instanceof ChatError?error.code:'reviews_unavailable'});}
  return true;
 };
}
