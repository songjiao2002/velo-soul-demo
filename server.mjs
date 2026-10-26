import {nativeCors} from './native-origin.mjs';
import http from 'node:http';
import {openBikeMemory,createMemoryHandler} from './bike-memory.mjs';
import {attachRealtimeAsr} from './asr-realtime.mjs';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {makeQr,makeQrPng} from './qr-images.mjs';
export {makeQr,makeQrPng} from './qr-images.mjs';
import {QrCache} from './qr-cache.mjs';
import { createChatHandler } from './chat-service.mjs';
import {createWeatherService,createWeatherHandler} from './weather-service.mjs';
import {loadAssetManifest,preferredEncoding,matchesETag} from './static-assets.mjs';

// .env is local-only and excluded from Git/Docker; Railway injects environment variables.
const envPath=fileURLToPath(new URL('./.env',import.meta.url));
if(existsSync(envPath))process.loadEnvFile(envPath);
const weatherService=createWeatherService();
const handleWeather=createWeatherHandler(weatherService);
const bikeMemories=openBikeMemory();
const handleMemory=createMemoryHandler(bikeMemories);
const handleChat=createChatHandler({getWeather:id=>weatherService.resolve(id),getBikeMemory:id=>bikeMemories?.latest(id)});

const root = fileURLToPath(new URL('./public/', import.meta.url));
const assets=loadAssetManifest(new URL('./public/',import.meta.url));
const types = { '.webmanifest':'application/manifest+json; charset=utf-8', '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.json':'application/json; charset=utf-8' };
const qrCache=new QrCache();

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
  res.setHeader('Content-Security-Policy', "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), speaker-selection=(self)');
  const send = (code, body, type='text/plain; charset=utf-8') => {
    res.writeHead(code, { 'Content-Type':type, 'Content-Length':Buffer.byteLength(body) });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  try {
    // All URL parsing and async API dispatch stays inside the error boundary.
    // An invalid absolute request target must not reject this async listener.
    new URL(req.url, 'http://localhost');
    if(nativeCors(req,res))return;
    if(await handleMemory(req,res)||await handleWeather(req,res)||await handleChat(req,res))return;
    if (!['GET','HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, 'Method not allowed');
    }
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
