// Read only one page of photo-bearing records at a time. Existing v1 data stays
// in the same store; the index provides stable newest-first pagination.
export class JourneyStore {
 constructor({indexedDB=globalThis.indexedDB,KeyRange=globalThis.IDBKeyRange,name='velo-soul-final'}={}){Object.assign(this,{indexedDB,KeyRange,name});}
 open(){return new Promise((resolve,reject)=>{
  let rejected=false;
  const request=this.indexedDB.open(this.name,2);
  request.onupgradeneeded=()=>{
   const db=request.result,store=db.objectStoreNames.contains('journeys')?request.transaction.objectStore('journeys'):db.createObjectStore('journeys',{keyPath:'id'});
   if(!store.indexNames.contains('by-created-id'))store.createIndex('by-created-id',['createdAt','id']);
  };
  request.onblocked=()=>{rejected=true;reject(new Error('Close other open VELO SOUL tabs and retry'));};
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();if(rejected)db.close();else resolve(db);};
 });}
 async run(mode,action){const db=await this.open();return new Promise((resolve,reject)=>{
  let tx,result;
  try{
   tx=db.transaction('journeys',mode);
   tx.oncomplete=()=>{db.close();resolve(result);};
   tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error('Storage unavailable'));};
   const request=action(tx.objectStore('journeys'));request.onsuccess=()=>{result=request.result;};
  }catch(error){try{tx?.abort();}catch{}db.close();reject(error);}
 });}
 async page({before=null,limit=4}={}){
  if(!Number.isInteger(limit)||limit<1||limit>20)throw new Error('Invalid page size');
  const db=await this.open();return new Promise((resolve,reject)=>{
   let tx,total=0,hasMore=false,after=before;const records=[];
   try{
    tx=db.transaction('journeys','readonly');
    tx.oncomplete=()=>{db.close();resolve({records,total,hasMore,after});};
    tx.onabort=tx.onerror=()=>{db.close();reject(tx.error||new Error('Storage unavailable'));};
    const store=tx.objectStore('journeys');
    const count=store.count();count.onsuccess=()=>{total=count.result;};
    const request=store.index('by-created-id').openCursor(before?this.KeyRange.upperBound(before,true):null,'prev');
    request.onsuccess=()=>{
     const cursor=request.result;if(!cursor)return;
     // Inspect the extra cursor's key, but never clone its photo payload.
     if(records.length===limit){hasMore=true;return;}
     records.push(cursor.value);after=cursor.key;cursor.continue();
    };
   }catch(error){try{tx?.abort();}catch{}db.close();reject(error);}
  });
 }
}

export class JourneyPager {
 constructor(store){this.store=store;this.generation=0;this.reset();}
 reset(){this.generation++;this.records=[];this.before=null;this.hasMore=true;this.busy=false;this.total=0;}
 async next(){
  if(this.busy||!this.hasMore)return null;
  const serial=this.generation;this.busy=true;
  try{
   const page=await this.store.page({before:this.before,limit:4});
   if(serial!==this.generation)return null;
   this.records.push(...page.records);this.before=page.after;this.hasMore=page.hasMore;this.total=page.total;return page;
  }catch(error){if(serial===this.generation)throw error;return null;}
  finally{if(serial===this.generation)this.busy=false;}
 }
}
