// These are Capacitor's bundled origins, not a wildcard CORS exemption.
const NATIVE_ORIGINS=new Set(['https://localhost','capacitor://localhost']);
export function isNativeOrigin(origin){return NATIVE_ORIGINS.has(origin);}
export function allowedRequestOrigin(req){
 const origin=req.headers.origin;
 if(isNativeOrigin(origin))return true;
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 if(!origin)return true;
 try{const url=new URL(origin);return ['http:','https:'].includes(url.protocol)&&url.host===req.headers.host;}catch{return false;}
}
export function nativeCors(req,res){
 if(!req.url?.startsWith('/api/')||!isNativeOrigin(req.headers.origin))return false;
 res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
 res.setHeader('Vary','Origin');
 if(req.method!=='OPTIONS')return false;
 const method=req.headers['access-control-request-method'];
 const headers=(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(!['GET','POST','DELETE'].includes(method)||headers.some(x=>!['content-type'].includes(x))){res.writeHead(403);res.end();return true;}
 res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Access-Control-Max-Age','600');res.writeHead(204);res.end();return true;
}
