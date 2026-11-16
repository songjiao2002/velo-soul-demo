// Public identifiers, not credentials. Rotating this catalog revokes earlier codes.
export const QR_GENERATION='20261116-v2';
export const QR_IDS=Object.freeze({lumi:'m2-6d81c29a',bori:'p2-a37e50b4',mori:'l2-942fb6e8'});
export function soulQRURL(soul,origin){
 if(!Object.hasOwn(QR_IDS,soul))throw Error('Unknown companion');
 const url=new URL('/',origin);url.searchParams.set('bike',soul);url.searchParams.set('qr',QR_IDS[soul]);return url.href;
}
export function currentSoulQR(url){
 const params=url instanceof URL?url.searchParams:new URLSearchParams(url);
 const soul=params.get('bike');
 return params.getAll('bike').length===1&&params.getAll('qr').length===1&&Object.hasOwn(QR_IDS,soul)&&params.get('qr')===QR_IDS[soul]?soul:null;
}
export function companionQuery(query){
 const params=new URLSearchParams(query),soul=params.get('bike');
 if(Object.hasOwn(QR_IDS,soul))params.set('qr',QR_IDS[soul]);
 return params.toString();
}
