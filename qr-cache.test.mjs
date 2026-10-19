import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QrCache} from './qr-cache.mjs';

test('repeated QR requests reuse the exact bytes while origin, soul and format remain isolated',()=>{
 const cache=new QrCache();let renders=0;const render=()=>{renders++;return Buffer.from('QR bytes');};
 const first=cache.get('lumi','https://a.test','png',render);
 assert.equal(cache.get('lumi','https://a.test','png',render),first);assert.equal(renders,1);
 for(const [soul,origin,format]of [['mori','https://a.test','png'],['lumi','https://b.test','png'],['lumi','https://a.test','svg']])assert.notEqual(cache.get(soul,origin,format,render),first);
 assert.equal(renders,4);assert.equal(first.body.toString(),'QR bytes');assert.match(first.etag,/^"[a-f0-9]{64}"$/);
});

test('QR cache evicts the least recently used entries and bounds retained bytes',()=>{
 const cache=new QrCache({maxEntries:2,maxBytes:10});const get=k=>cache.get(k,'origin','png',()=>Buffer.alloc(4,k.charCodeAt(0)));
 const a=get('a');get('b');assert.equal(get('a'),a);get('c');assert.equal(cache.entries.size,2);assert.equal(cache.bytes,8);
 assert.equal(get('a'),a);const oldB=get('b');assert.equal(cache.entries.size,2);assert.equal(cache.bytes,8);
 const large=cache.get('huge','origin','png',()=>Buffer.alloc(100));assert.equal(large.body.length,100);assert.equal(cache.bytes,8);assert.equal(get('b'),oldB);
 const byteBound=new QrCache({maxEntries:10,maxBytes:6});for(let i=0;i<8;i++)byteBound.get(i,'o','p',()=>Buffer.alloc(4));assert.equal(byteBound.bytes,4);assert.equal(byteBound.entries.size,1);
});
