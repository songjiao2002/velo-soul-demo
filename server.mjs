import http from 'node:http';
import {attachRealtimeAsr} from './asr-realtime.mjs';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, crc32 } from 'node:zlib';
import qrcode from './vendor/qrcode.mjs';
import {QrCache} from './qr-cache.mjs';
import { createChatHandler } from './chat-service.mjs';
import {createWeatherService,createWeatherHandler} from './weather-service.mjs';
import {loadAssetManifest,preferredEncoding,matchesETag} from './static-assets.mjs';

// .env is local-only and excluded from Git/Docker; Railway injects environment variables.
const envPath=fileURLToPath(new URL('./.env',import.meta.url));
if(existsSync(envPath))process.loadEnvFile(envPath);
const weatherService=createWeatherService();
const handleWeather=createWeatherHandler(weatherService);
const handleChat=createChatHandler({getWeather:id=>weatherService.resolve(id)});

const root = fileURLToPath(new URL('./public/', import.meta.url));
const assets=loadAssetManifest(new URL('./public/',import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.json':'application/json; charset=utf-8' };
const colors = { lumi:'#2441c7', mori:'#117455', bori:'#a84313' };
const qrCache=new QrCache();

function qrCode(soul, origin) {
  const qr = qrcode(0, 'M');
  qr.addData(new URL('/?bike=' + soul, origin).href);
  qr.make();
  return qr;
}

export function makeQr(soul, origin) {
  const qr=qrCode(soul,origin);
  return qr.createSvgTag({ cellSize:8, margin:32, scalable:true }).replace('fill="black"', 'fill="' + colors[soul] + '"');
}

export function makeQrPng(soul,origin){
  const qr=qrCode(soul,origin),modules=qr.getModuleCount(),cell=32,margin=4*cell,size=modules*cell+2*margin;
  const rgb=[1,3,5].map(i=>parseInt(colors[soul].slice(i,i+2),16));
  const stride=size*3+1,pixels=Buffer.alloc(size*stride,255);
  for(let y=0;y<size;y++)pixels[y*stride]=0; // PNG scanline filter: none.
  for(let row=0;row<modules;row++)for(let col=0;col<modules;col++)if(qr.isDark(row,col)){
    for(let y=margin+row*cell;y<margin+(row+1)*cell;y++)for(let x=margin+col*cell;x<margin+(col+1)*cell;x++){
      const at=y*stride+1+x*3;pixels[at]=rgb[0];pixels[at+1]=rgb[1];pixels[at+2]=rgb[2];
    }
  }
  const chunk=(type,data)=>{const name=Buffer.from(type),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(Buffer.concat([name,data])),data.length+8);return out;};
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

function originFor(req) {
  if (process.env.PUBLIC_BASE_URL) return new URL(process.env.PUBLIC_BASE_URL).origin;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN;
  const host = req.headers.host || 'localhost:3000';
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(host)) throw new Error('Invalid host');
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return new URL(proto + '://' + host).origin;
}

export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  if(await handleWeather(req,res)||await handleChat(req,res))return;
  const send = (code, body, type='text/plain; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type':type, 'Content-Length':Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  if (!['GET','HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return send(405, 'Method not allowed');
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/healthz') return send(200, '{"status":"ok","app":"velo-soul"}', types['.json']);
    const qrMatch = pathname.match(/^\/qr-(lumi|mori|bori)\.(svg|png)$/);
    if (qrMatch) {
      const [,soul,format]=qrMatch,origin=originFor(req);
      const qr=qrCache.get(soul,origin,format,()=>format==='png'?makeQrPng(soul,origin):makeQr(soul,origin));
      res.setHeader('Cache-Control','public, max-age=3600');
      res.setHeader('ETag',qr.etag);
      if(format==='png')res.setHeader('Content-Disposition',`attachment; filename="velo-soul-${soul}.png"`);
      if(matchesETag(req.headers['if-none-match'],qr.etag)){res.writeHead(304);res.end();return;}
      return send(200,qr.body,types['.'+format]);
    }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(p=>p.startsWith('.'))) return send(404, 'Not found');
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root)) return send(404, 'Not found');
    const info = await stat(file);
    if (!info.isFile()) return send(404, 'Not found');
    const entry=assets.files[pathname==='/'?'/index.html':pathname];
    const version=new URL(req.url,'http://localhost').searchParams.get('v');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control',entry&&path.extname(file)!=='.html'&&version===assets.version?'public, max-age=31536000, immutable':/\.(mp3|wav|png)$/.test(file)?'public, max-age=86400':'no-cache');
    if(entry){
      if(entry.br||entry.gzip)res.setHeader('Vary','Accept-Encoding');
      // Byte ranges always refer to the original file, including media playback.
      const coding=req.headers.range?'identity':preferredEncoding(req.headers['accept-encoding'],entry);
      if(!coding)return send(406,'No acceptable encoding');
      const variant=coding==='identity'?entry:entry[coding],etag='"'+variant.sha256+'"';
      res.setHeader('ETag',etag);
      if(coding!=='identity')res.setHeader('Content-Encoding',coding);
      if(matchesETag(req.headers['if-none-match'],etag)){res.writeHead(304);return res.end();}
      if(coding!=='identity'){
        res.setHeader('Content-Length',variant.size);
        if(req.method==='HEAD')return res.end();
        const stream=createReadStream(file+variant.suffix);
        stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());
        return stream.pipe(res);
      }
    }
    let start=0, end=info.size-1, status=200;
    if (req.headers.range && req.method === 'GET') {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) {
        res.setHeader('Content-Range', 'bytes */' + info.size);
        return send(416, 'Invalid range');
      }
      if (match[1]) {
        start=Number(match[1]);
        if (match[2]) end=Math.min(Number(match[2]), end);
      } else start=Math.max(0, info.size-Number(match[2]));
      if (!Number.isSafeInteger(start) || start>=info.size || end<start) {
        res.setHeader('Content-Range', 'bytes */' + info.size);
        return send(416, 'Invalid range');
      }
      status=206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${info.size}`);
    }
    res.writeHead(status, {
      'Content-Type':types[path.extname(file)] || 'application/octet-stream',
      'Content-Length':Math.max(0,end-start+1),
      'Accept-Ranges':'bytes'
    });
    if (req.method === 'HEAD' || info.size === 0) return res.end();
    const stream=createReadStream(file,{start,end});
    stream.on('error',()=>res.destroy());
    res.on('close',()=>stream.destroy());
    stream.pipe(res);
  } catch (err) {
    if (res.headersSent) return res.destroy();
    send(err.code === 'ENOENT' || err.code === 'ENOTDIR' ? 404 : 400, 'Not found or invalid request');
  }
});

attachRealtimeAsr(server,{reserve:handleChat.reserveRealtime});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0',()=>console.log(`VELO SOUL: http://127.0.0.1:${port}`));
  process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
