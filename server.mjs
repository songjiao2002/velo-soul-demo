import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from './vendor/qrcode.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.mp3':'audio/mpeg', '.json':'application/json; charset=utf-8' };
const colors = { lumi:'#2441c7', mori:'#117455', bori:'#a84313' };

export function makeQr(soul, origin) {
  const qr = qrcode(0, 'M');
  qr.addData(new URL('/?bike=' + soul, origin).href);
  qr.make();
  return qr.createSvgTag({ cellSize:8, margin:32, scalable:true }).replace('fill="black"', 'fill="' + colors[soul] + '"');
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
    const qrMatch = pathname.match(/^\/qr-(lumi|mori|bori)\.svg$/);
    if (qrMatch) {
      res.setHeader('Cache-Control', 'no-store');
      return send(200, makeQr(qrMatch[1], originFor(req)), types['.svg']);
    }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(p=>p.startsWith('.'))) return send(404, 'Not found');
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root)) return send(404, 'Not found');
    const info = await stat(file);
    if (!info.isFile()) return send(404, 'Not found');
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
      'Accept-Ranges':'bytes',
      'Cache-Control':/\.(mp3|png)$/.test(file) ? 'public, max-age=86400' : 'no-cache'
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0',()=>console.log(`VELO SOUL: http://127.0.0.1:${port}`));
  process.on('SIGTERM',()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();});
}
