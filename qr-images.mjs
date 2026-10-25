import {deflateSync,crc32} from 'node:zlib';
import qrcode from './vendor/qrcode.mjs';
const colors = { lumi:'#2441c7', mori:'#117455', bori:'#a84313' };


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

