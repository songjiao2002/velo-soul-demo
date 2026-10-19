// Manual shutter only. Keep the download in the original tap's user activation.
// Browsers choose the destination; a click cannot confirm a filesystem write.
export function photoFilename(soul, time=Date.now(), sequence=1) {
 const name=['lumi','mori','bori'].includes(soul)?soul:'soul';
 return `velo-soul-${name}-${new Date(time).toISOString().replace(/[:.]/g,'-')}-${sequence}.jpg`;
}

export function capturePhoto(video, doc=globalThis.document) {
 if(!video?.videoWidth||!video.videoHeight)throw new Error('Camera frame unavailable');
 const canvas=doc.createElement('canvas');
 const ratio=Math.min(1,2560/Math.max(video.videoWidth,video.videoHeight));
 canvas.width=Math.max(1,Math.round(video.videoWidth*ratio));
 canvas.height=Math.max(1,Math.round(video.videoHeight*ratio));
 const context=canvas.getContext('2d');
 if(!context)throw new Error('Camera canvas unavailable');
 context.drawImage(video,0,0,canvas.width,canvas.height);
 const full=canvas.toDataURL('image/jpeg',.9);
 if(!full.startsWith('data:image/jpeg;base64,'))throw new Error('Photo encoding failed');
 const preview=doc.createElement('canvas'),scale=Math.min(1,720/Math.max(canvas.width,canvas.height));
 preview.width=Math.max(1,Math.round(canvas.width*scale));
 preview.height=Math.max(1,Math.round(canvas.height*scale));
 const previewContext=preview.getContext('2d');
 if(!previewContext)throw new Error('Photo preview unavailable');
 // Use the same frozen frame for the file and the journey thumbnail.
 previewContext.drawImage(canvas,0,0,preview.width,preview.height);
 return {full,preview:preview.toDataURL('image/jpeg',.75)};
}

export function downloadPhoto(src, filename, doc=globalThis.document) {
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(src))throw new Error('Invalid photo');
 const link=doc.createElement('a');
 link.href=src;link.download=filename;link.hidden=true;
 doc.body.append(link);
 try{link.click();}finally{link.remove();}
}
