import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSoulQR} from './public/soul-core.mjs';
import {QR_IDS,soulQRURL} from './public/qr-links.mjs';
const origin='https://velo-soul-demo-production.up.railway.app';
test('revoked, forged, cross-character and ambiguous codes never activate a character',()=>{
 for(const soul of Object.keys(QR_IDS)){
  const valid=soulQRURL(soul,origin);assert.equal(parseSoulQR(valid,origin),soul);
  for(const url of [origin+'/?bike='+soul,valid+'&qr=other',valid+'&bike='+soul,valid.replace(QR_IDS[soul],'old'),valid.replace(origin,'https://evil.example'),valid.replace('bike='+soul,'bike='+Object.keys(QR_IDS).find(id=>id!==soul))])assert.equal(parseSoulQR(url,origin),null,url);
 }
});
