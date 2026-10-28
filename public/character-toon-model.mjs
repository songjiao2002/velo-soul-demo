import * as T from 'three';

// Art-directed geometry based on the supplied character board. Every body,
// limb, prop and bicycle part is a real mesh; no portrait/sprite textures.
// Two discrete light bands keep the reference colors flat while geometry turns.
const ramp=new T.DataTexture(new Uint8Array([175,255]),2,1,T.RedFormat);
ramp.minFilter=ramp.magFilter=T.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;
const skin=new T.SphereGeometry(1,24,18),unitCylinder=new T.CylinderGeometry(1,1,1,12);
const UP=new T.Vector3(0,1,0),v=new T.Vector3(),q=new T.Quaternion();
// The bicycle's front is local +Z. The camera looks down -Z, so an AR rider
// following the road faces away from the lens; portraits still face the viewer.
export const CHARACTER_FACING=Object.freeze({portrait:.55,ride:Math.PI+.35});
const palettes={lumi:{fur:0xfff6e9,accent:0xefac69,hat:0xdcb98a,bag:0xe88c43},bori:{fur:0xfff8ee,accent:0xffd574,hat:0xffd574,bag:0xedba4d},mori:{fur:0xfffaf3,accent:0x363433,hat:0xf4eee5,bag:0x7e9a63}};
function material(color,roughness=.68){const m=new T.MeshToonMaterial({color,gradientMap:ramp});m.userData.outlineParameters={thickness:.0025,color:new T.Color(0x716857).toArray()};return m;}
function group(parent,name,x=0,y=0,z=0){const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;}
function ball(parent,name,mat,p,s){const m=new T.Mesh(skin,mat);m.name=name;m.position.set(...p);m.scale.set(...s);parent.add(m);return m;}
function ring(parent,name,mat,r,t,p,rotation){const m=new T.Mesh(new T.TorusGeometry(r,t,10,36),mat);m.name=name;m.position.set(...p);if(rotation)m.rotation.set(...rotation);parent.add(m);return m;}
function rod(parent,name,mat,a,b,r=.035){const mesh=new T.Mesh(unitCylinder,mat);mesh.name=name;parent.add(mesh);segment(mesh,a,b,r);return mesh;}
function segment(mesh,a,b,r=.12){const av=new T.Vector3(...a),bv=new T.Vector3(...b);mesh.position.copy(av).add(bv).multiplyScalar(.5);v.copy(bv).sub(av);mesh.quaternion.setFromUnitVectors(UP,v.clone().normalize());mesh.scale.set(r,v.length(),r);}
function roundBox(parent,name,mat,p,s){const m=ball(parent,name,mat,p,s);m.geometry=new T.BoxGeometry(1,1,1,4,4,4);const pos=m.geometry.attributes.position;const radius=.16;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);const center=v.clone().clampScalar(-.5+radius,.5-radius);v.sub(center).normalize().multiplyScalar(radius).add(center);pos.setXYZ(i,v.x,v.y,v.z);}m.geometry.computeVertexNormals();return m;}
function curve(parent,name,mat,points,r=.025){const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const m=new T.Mesh(new T.TubeGeometry(path,24,r,8,false),mat);m.name=name;parent.add(m);return m;}
// Rounded silhouette, with no sharp low-poly cone corners.
function catEar(parent,mat,name,scale,z=0){const s=new T.Shape();s.moveTo(-.23,-.2);s.quadraticCurveTo(-.2,.09,-.13,.34);s.quadraticCurveTo(-.1,.43,-.035,.39);s.quadraticCurveTo(.12,.29,.23,-.17);s.quadraticCurveTo(.02,-.25,-.23,-.2);const g=new T.ExtrudeGeometry(s,{depth:.095,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.045,bevelThickness:.045,curveSegments:12});g.computeVertexNormals();const m=new T.Mesh(g,mat);m.name=name;m.scale.setScalar(scale);m.position.z=z;parent.add(m);return m;}
// Fur markings follow the rounded head surface rather than floating above it.
function facePatch(parent,name,mat,cx,cy,rx,ry,rotation=0,radii=[.63,.55,.51]){const vertices=[],indices=[],rings=8,steps=40;for(let j=0;j<=rings;j++)for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2,r=j/rings,x=rx*r*Math.cos(a),y=ry*r*Math.sin(a),px=cx+x*Math.cos(rotation)-y*Math.sin(rotation),py=cy+x*Math.sin(rotation)+y*Math.cos(rotation);vertices.push(px,py,radii[2]*Math.sqrt(Math.max(.005,1-(px/radii[0])**2-(py/radii[1])**2))+.006);}for(let j=0;j<rings;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i,b=a+steps+1;indices.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const patchMat=mat.clone();patchMat.userData.outlineParameters={visible:false};const mesh=new T.Mesh(g,patchMat);mesh.name=name;parent.add(mesh);return mesh;}
function details(parent,name,mat,points,scale){const mesh=new T.InstancedMesh(skin,mat,points.length);mesh.name=name;const matrix=new T.Matrix4(),size=new T.Vector3(...scale);points.forEach((p,i)=>{matrix.compose(new T.Vector3(...p),new T.Quaternion(),size);mesh.setMatrixAt(i,matrix);});parent.add(mesh);return mesh;}
function croissant(parent,mats,x,y,z,scale=1){const g=group(parent,'croissant',x,y,z);g.scale.setScalar(scale);for(let i=0;i<7;i++){const a=(i/6-.5)*Math.PI*.95,r=.15,bulge=.043+.04*Math.sin(i/6*Math.PI);const roll=ball(g,'pastry-layer',mats.bread,[Math.sin(a)*r,-Math.cos(a)*r*.45,0],[bulge,.11-i%2*.006,.09]);roll.rotation.z=-a*.7;}return g;}
function bread(parent,mats,x=0,y=0,z=0,scale=1){const g=group(parent,'bread',x,y,z);g.scale.setScalar(scale);ball(g,'loaf',mats.bread,[0,0,0],[.13,.23,.105]);for(let i=0;i<3;i++){const cut=ball(g,'bread-score',mats.crumb,[0,-.1+i*.095,.085],[.095,.014,.013]);cut.rotation.z=-.3;}return g;}
function bicycle(parent,mats,id){
 const bike=group(parent,'bicycle'),wheels=[];
 for(const z of [-.67,.67]){const wheel=group(bike,'wheel',0,.36,z);ring(wheel,'tire',mats.rubber,.29,.066,[0,0,0],[0,Math.PI/2,0]);ring(wheel,'rim',mats.metal,.235,.019,[0,0,0],[0,Math.PI/2,0]);for(let k=0;k<8;k++){const a=k*Math.PI/4;rod(wheel,'spoke',mats.metal,[0,0,0],[0,.23*Math.cos(a),.23*Math.sin(a)],.009);}ball(wheel,'hub',mats.dark,[0,0,0],[.1,.05,.05]);
  for(const x of [-.067,.067]){const sidewall=ring(wheel,'tire-sidewall',mats.tread,.292,.008,[x,0,0],[0,Math.PI/2,0]);sidewall.name='tire-sidewall';ball(wheel,'axle-cap',mats.rim,[x*1.6,0,0],[.014,.028,.028]);}
  details(wheel,'rubber-tread',mats.tread,Array.from({length:32},(_,i)=>[0,.353*Math.cos(i*Math.PI/16),.353*Math.sin(i*Math.PI/16)]),[.025,.009,.009]);wheels.push(wheel);}
 const rear=[0,.36,-.67],front=[0,.36,.67],pedal=[0,.49,-.03],seat=[0,.99,-.3],steer=[0,1.06,.49];
 for(const [a,b]of [[rear,seat],[rear,pedal],[seat,pedal],[seat,steer],[pedal,steer],[steer,front]])rod(bike,'frame-tube',mats.bike,a,b,.044);
 for(const x of [-.06,.06]){rod(bike,'front-fork',mats.bike,[x,.36,.67],[x,1.06,.49],.027);rod(bike,'rear-fork',mats.bike,[x,.36,-.67],[x,.99,-.3],.025);}
 ball(bike,'saddle',mats.dark,[0,1.02,-.31],[.19,.055,.23]);rod(bike,'handle-stem',mats.metal,steer,[0,1.24,.51],.028);
 curve(bike,'handlebar',mats.dark,[[-.46,1.2,.46],[-.34,1.25,.53],[.34,1.25,.53],[.46,1.2,.46]],.04);
 for(const x of [-.35,.35]){rod(bike,'handle-grip',mats.rubber,[x-.065,1.24,.51],[x+.065,1.24,.51],.052);rod(bike,'brake-lever',mats.metal,[x,1.225,.56],[x*.83,1.2,.61],.012);}
 curve(bike,'brake-cable',mats.dark,[[.24,1.23,.56],[.16,1.06,.63],[.05,.85,.62],[0,.72,.61]],.007);
 ball(bike,'bike-light-housing',mats.dark,[0,1.05,.57],[.06,.06,.05]);ball(bike,'bike-light-lens',mats.crumb,[0,1.05,.615],[.044,.044,.012]);
 curve(bike,'chain',mats.metal,[[.075,.5,-.03],[.075,.52,-.62],[.075,.36,-.68],[.075,.39,-.03],[.075,.5,-.03]],.009);
 const crank=group(bike,'crank',0,.49,-.03);rod(crank,'crank-left',mats.metal,[-.2,0,0],[-.2,-.17,0],.027);rod(crank,'crank-right',mats.metal,[.2,0,0],[.2,.17,0],.027);
 for(const side of [-1,1])roundBox(crank,'pedal',mats.dark,[side*.27,side*.17,0],[.2,.055,.13]);
 if(id==='bori'){
  roundBox(bike,'bread-basket',mats.bike,[0,1.01,.87],[.63,.38,.36]);ring(bike,'basket-rim',mats.hat,.29,.035,[0,1.2,.88],[Math.PI/2,0,0]).scale.y=.6;
  const roll=croissant(bike,mats,-.08,1.27,.95,.85);roll.rotation.z=-.16;bread(bike,mats,.13,1.31,.8,.75).rotation.z=-.24;bread(bike,mats,-.18,1.31,.78,.6).rotation.z=.3;
  ball(bike,'basket-paw',mats.white,[0,1.02,1.06],[.07,.06,.014]);for(const x of [-.07,0,.07])ball(bike,'paw-toe',mats.white,[x,1.09,1.065],[.025,.027,.01]);
 }
 return {bike,wheels,crank};
}

function fitPandaFace(object,x,y,lift=0){const z=.52*Math.sqrt(Math.max(.005,1-(x/.65)**2-(y/.58)**2));object.position.set(x,y,z+lift);object.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(x/.65**2,y/.58**2,z/.52**2).normalize());}
function makeSleepingPanda(root,head,bag,mats){
 const sleeping=group(root,'sleeping-panda');sleeping.visible=false;
 ball(sleeping,'sleeping-body',mats.fur,[0,.32,-.39],[.43,.3,.62]);
 for(const side of [-1,1]){ball(sleeping,'tucked-hind-paw',mats.dark,[side*.27,.15,-.72],[.18,.14,.21]);ball(sleeping,'resting-front-paw',mats.dark,[side*.35,.115,.65],[.19,.11,.22]);}
 const sleepingHead=head.clone(true);sleepingHead.name='sleeping-head';sleepingHead.position.set(0,.70,.29);sleepingHead.rotation.set(.04,0,-.04);
 sleepingHead.traverse(o=>{if(o.name==='eye'||o.name==='helmet')o.visible=false;if(o.name==='closed-eyes')o.visible=true;});sleeping.add(sleepingHead);
 const pack=bag.clone(true);pack.name='sleeping-backpack';pack.position.set(0,.55,-.43);pack.rotation.set(Math.PI/2,0,0);sleeping.add(pack);
 return sleeping;
}

export function createCharacterModel(id){
 if(!palettes[id])throw Error('Unknown character');
 const p=palettes[id],panda=id==='mori',headRadii=panda?[.65,.58,.52]:[.63,.55,.51],root=new T.Group();root.name=id;
 const mats={fur:material(p.fur),accent:material(p.accent),hat:material(p.hat),bag:material(p.bag),bike:material(id==='lumi'?0xe3a24f:id==='bori'?0xeab741:0x6d8b58),white:material(0xfffaf0),dark:material(0x343332),black:material(0x181d1b,.25),pink:material(0xe6ad9e),rubber:material(0x303536),metal:material(0x737d77,.4),bread:material(0xdca44e),crumb:material(0xf5ca79),glass:material(0x303637,.16),strap:material(0x71583d),rim:material(0xb49674,.36),stitch:material(0xeed2a4),tread:material(0x454643,.85)};
 if(panda){mats.dark.color.setHex(0x41443f);mats.black.color.setHex(0x252b27);mats.pink.color.setHex(0xefcfc4);mats.hat.color.setHex(0xf4f3e9);mats.rim.color.setHex(0xa8b99a);mats.bag.color.setHex(0x879e74);}
 for(const key of ['black','white','pink','metal','glass','stitch','tread'])mats[key].userData.outlineParameters={visible:false};
 const avatar=group(root,'avatar'),torso=group(avatar,'torso');
 ball(torso,'body',mats.fur,[0,.62,0],panda?[.465,.43,.38]:[.44,.43,.35]);
 if(id==='mori')ball(torso,'black-shoulder-band',mats.dark,[0,.85,-.015],[.465,.18,.37]);
 ball(torso,'belly',mats.fur,[0,.6,.16],[.38,.32,.22]);
 const head=group(torso,'head',0,1.27,.03);head.scale.set(panda?1.16:id==='bori'?1.16:1.2,panda?1.14:id==='bori'?1.1:1.04,panda?1.1:1.12);
 ball(head,'head-mesh',mats.fur,[0,0,0],headRadii);
 if(id==='lumi'){
  for(const side of [-1,1]){
   const ear=group(head,'cat-ear',side*.44,.48,-.12);ear.rotation.z=side*-.16;catEar(ear,mats.accent,'outer-ear',.84);catEar(ear,mats.pink,'inner-ear',.58,.11);
   facePatch(head,'orange-forehead-mark',mats.accent,side*.42,.24,.135,.21,side*-.4);
   for(let i=0;i<2;i++)rod(head,'whisker',mats.accent,[side*.4,-.12-i*.07,.376],[side*.52,-.09-i*.075,.284],.011);
  }
  const tail=group(torso,'tail',.23,.62,-.27),path=new T.CatmullRomCurve3([[0,0,0],[.34,.03,-.15],[.63,.2,-.16],[.74,.4,-.13],[.65,.56,-.08]].map(p=>new T.Vector3(...p)));
  for(let i=0;i<5;i++){const section=new T.CatmullRomCurve3(Array.from({length:7},(_,j)=>path.getPoint((i+j/6)/5)));const stripe=new T.Mesh(new T.TubeGeometry(section,8,.15,12,false),i%2?mats.fur:mats.accent);stripe.name='tail-stripe';tail.add(stripe);}ball(tail,'tail-tip',mats.accent,path.getPoint(1).toArray(),[.15,.15,.15]);
 }else for(const side of [-1,1]){ball(head,'round-ear',id==='mori'?mats.dark:mats.fur,[side*(panda?.475:.46),panda?.515:.51,-.1],panda?[.17,.185,.14]:[.19,.205,.14]);if(id==='bori')ball(head,'inner-ear',mats.pink,[side*.46,.51,.025],[.125,.14,.055]);}
 const eyes=[];for(const side of [-1,1]){
  if(panda)facePatch(head,'eye-patch',mats.dark,side*.25,-.006,.145,.178,side*-.34,headRadii);
  const eye=group(head,'eye',side*.235,panda?.015:.025,.5);ball(eye,'pupil',mats.black,[0,0,0],panda?[.047,.058,.024]:[.043,.052,.027]);ball(eye,'catchlight',mats.white,[-.012,.02,.023],panda?[.015,.018,.007]:[.012,.015,.007]);if(panda)fitPandaFace(eye,side*.235,.015,.012);eyes.push(eye);
  if(panda)facePatch(head,'blush',mats.pink,side*.365,-.155,.052,.024,side*-.1,headRadii);else ball(head,'blush',mats.pink,[side*.36,-.12,.43],[.075,.035,.012]);
 }
 ball(head,'nose',mats.black,[0,panda?-.095:-.105,.521],panda?[.045,.031,.022]:[.049,.029,.028]);if(!panda)rod(head,'philtrum',mats.dark,[0,-.12,.526],[0,-.165,.516],.006);
 const mouth=ball(head,'talking-mouth',mats.dark,[0,-.21,.504],[.055,.013,.012]);
 const smile=curve(head,'smile',mats.dark,panda?[[-.035,-.165,.507],[0,-.181,.508],[.035,-.165,.507]]:[[-.025,-.184,.5],[0,-.162,.514],[.025,-.184,.5]],panda?.007:.006);
 if(panda){const closed=group(head,'closed-eyes');closed.visible=false;for(const side of [-1,1]){const lid=curve(closed,'sleeping-eyelid',mats.rim,[[-.05,.008,0],[0,-.012,.008],[.05,.008,0]],.009);fitPandaFace(lid,side*.235,.015,.037);}}
 const helmet=group(head,'helmet',0,panda?.285:.22,panda?-.035:-.015);
 const dome=new T.Mesh(new T.SphereGeometry(panda?.65:.66,28,16,0,Math.PI*2,0,Math.PI/2),mats.hat);dome.name='helmet-shell';dome.scale.set(1,panda?.67:.63,panda?.84:.85);helmet.add(dome);
 const brim=ring(helmet,'helmet-brim',mats.hat,panda?.618:.65,panda?.025:.048,[0,-.008,panda?.018:.04],[Math.PI/2,0,0]);brim.scale.y=panda?.84:.86;
 if(id==='lumi'){const band=ring(helmet,'hat-band',mats.strap,.625,.026,[0,.065,.015],[Math.PI/2,0,0]);band.scale.y=.86;}
 // A single soft rim keeps Lulu's helmet fitted, without stacked rings.
 const crown=[];for(let i=0;i<=18;i++){const a=i/18*Math.PI/2;crown.push([0,Math.sin(a)*(id==='mori'?.437:.418),Math.cos(a)*(panda?.547:.562)]);}curve(helmet,'crown-seam',id==='lumi'?mats.rim:mats.hat,crown,.006);
 if(id==='lumi')details(helmet,'brim-stitch',mats.stitch,Array.from({length:38},(_,i)=>{const a=i/38*Math.PI*2;return [.648*Math.cos(a),.016,.04+.555*Math.sin(a)];}),[.008,.004,.007]);
 if(id==='lumi'){
  const goggles=group(helmet,'goggles',0,.19,.47);goggles.rotation.x=-.35;for(const side of [-1,1]){const rim=ring(goggles,'goggle-frame',mats.rim,.16,.032,[side*.205,0,0]);rim.scale.y=.78;ball(goggles,'goggle-lens',mats.glass,[side*.205,0,.009],[.149,.115,.036]);curve(goggles,'lens-reflection',mats.rim,[[side*.205-.075,.055,.039],[side*.205-.035,.08,.043],[side*.205+.025,.085,.042]],.006);}rod(goggles,'goggle-bridge',mats.strap,[-.05,0,0],[.05,0,0],.026);
  curve(helmet,'helmet-seam',mats.accent,[[0,.41,-.25],[0,.42,0],[0,.25,.51]],.009);
 }else if(id==='bori')for(const x of [-.17,0,.17])ball(helmet,'helmet-vent',mats.dark,[x,.27,.44],[.024,.033,.013]);
 const bag=group(torso,'backpack',0,.73,-.36);roundBox(bag,'pack',mats.bag,[0,0,-.07],[.55,.58,.26]);roundBox(bag,'pack-pocket',mats.bag,[0,-.1,-.23],[.39,.26,.1]);
 curve(bag,'pack-piping',mats.rim,[[-.24,.23,-.18],[0,.27,-.2],[.24,.23,-.18],[.25,-.22,-.18],[0,-.25,-.2],[-.25,-.22,-.18],[-.24,.23,-.18]],.009);
 curve(bag,'carry-handle',mats.bag,[[-.1,.26,-.07],[-.085,.36,-.07],[.085,.36,-.07],[.1,.26,-.07]],.026);
 details(bag,'pocket-stitch',mats.stitch,Array.from({length:11},(_,i)=>[-.17+i*.034,-.2,-.283]),[.006,.004,.0025]);
 for(const x of [-.19,.19]){rod(bag,'buckle-strap',mats.dark,[x,.2,-.22],[x,-.21,-.25],.018);const buckle=ring(bag,'strap-buckle',mats.rim,.035,.009,[x,.02,-.26]);buckle.scale.y=1.35;}
 for(const x of [-.21,.21]){curve(torso,'backpack-strap',mats.bag,[[x,.98,-.22],[x,1.01,.1],[x,.7,.27],[x,.45,.2]],.035);roundBox(bag,'buckle',mats.dark,[x,-.01,-.22],[.07,.11,.035]);}
 const arms=[];for(const side of [-1,1]){
  const shoulder=group(torso,'shoulder',side*.39,.85,.06);const fur=id==='mori'?mats.dark:mats.fur;
  ball(shoulder,'upper-arm',fur,[side*.025,-.1,0],[.15,.18,.145]);
  const elbow=group(shoulder,'elbow',side*.025,-.22,0);ball(elbow,'forearm',fur,[0,-.075,.015],[.13,.145,.13]);ball(elbow,'hand',fur,[0,-.15,.035],[.14,.13,.135]);arms.push({shoulder,elbow,side});
 }
 const legs=[];for(const side of [-1,1]){const leg=group(avatar,'leg'),fur=id==='mori'?mats.dark:mats.fur;const upper=ball(leg,'thigh',fur,[0,0,0],[1,1,1]),lower=ball(leg,'shin',fur,[0,0,0],[1,1,1]),foot=ball(leg,'foot',fur,[side*.21,.12,.1],[.155,.11,.21]);const pad=ball(foot,'paw-pad',id==='mori'?mats.rubber:mats.pink,[0,-.65,.14],[.45,.08,.44]);details(foot,'paw-toes',id==='mori'?mats.rubber:mats.pink,[[-.4,-.66,.56],[0,-.66,.65],[.4,-.66,.56]],[.14,.07,.16]);legs.push({upper,lower,foot,side});}
 const snack=group(arms[1].elbow,'hand-snack',0,-.13,.14);bread(snack,mats,0,0,0,.9);details(snack,'bread-crumb',mats.crumb,[[-.05,.02,.105],[.06,-.12,.1],[.025,.17,.075]],[.008,.009,.004]);
 const question=group(root,'question-mark',.8,2.22,.02);curve(question,'question-hook',mats.accent,[[-.11,.13,0],[-.1,.25,0],[.04,.29,0],[.15,.19,0],[.1,.08,0],[0,.01,0],[0,-.06,0]],.027);ball(question,'question-dot',mats.accent,[0,-.16,0],[.03,.03,.03]);
 const sleep=group(root,'sleep-z',.72,1.6,0);for(let i=0;i<3;i++){const x=i*.12,y=i*.21,s=.12-i*.02;curve(sleep,'z',mats.bag,[[x,y+s,0],[x+s,y+s,0],[x,y,0],[x+s,y,0]],.012);}
 const {bike,wheels,crank}=bicycle(root,mats,id);const sleepingPanda=panda?makeSleepingPanda(root,head,bag,mats):null;
 const shadow=new T.Mesh(new T.PlaneGeometry(2.6,2.6),new T.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 uv0;void main(){float d=length((uv0-.5)*2.);gl_FragColor=vec4(.3,.27,.22,.19*pow(max(0.,1.-d),2.));}'}));shadow.material.userData.outlineParameters={visible:false};shadow.rotation.x=-Math.PI/2;shadow.position.y=.004;root.add(shadow);
 return {id,root,avatar,torso,head,bag,sleepingPanda,tail:torso.getObjectByName('tail'),ears:head.children.filter(o=>o.name==='cat-ear'||o.name==='round-ear'),eyes,mouth,smile,helmet,hatMaterial:mats.hat,arms,legs,snack,question,sleep,bike,wheels,crank,shadow,materials:Object.values(mats),currentRide:0,currentSleep:0,entranceAt:0,lastState:null};
}
const damp=(a,b,dt)=>T.MathUtils.lerp(a,b,1-Math.exp(-dt*7));
function limb(mesh,a,b,r){const av=new T.Vector3(...a),bv=new T.Vector3(...b);mesh.position.copy(av).add(bv).multiplyScalar(.5);v.copy(bv).sub(av);mesh.quaternion.setFromUnitVectors(UP,v.clone().normalize());mesh.scale.set(r,v.length()*.65,r);}
export function animateCharacter(model,{time,dt=.033,state='idle',speed=12,expression='rest',speech=0,yaw=0,reduced=false}={}){
 const m=model,t=reduced?0:time,ride=state==='riding',sleep=state==='resting'&&m.id==='mori',eat=m.id==='bori'&&!ride;
 if(state!==m.lastState){m.lastState=state;m.entranceAt=time;}
 const age=time-m.entranceAt,enter=state==='greeting'&&!reduced?T.MathUtils.clamp(age/(m.id==='mori'?3:1.4),0,1):1;
 m.currentRide=damp(m.currentRide,ride?1:0,dt);m.currentSleep=damp(m.currentSleep,sleep?1:0,dt);
 m.pedalPhase=(m.pedalPhase||0)+(reduced||!ride?0:dt*Math.min(9,Math.max(0,speed||0)*.45));
 const r=m.currentRide,s=m.currentSleep,phase=m.pedalPhase;
 m.root.rotation.y=yaw+(!ride&&m.id==='lumi'?Math.sin(t*.65)*.18:0);m.root.position.y=(1-enter)*-.3;
 m.root.scale.setScalar(.8+.2*(1-Math.pow(1-enter,3)));
 m.avatar.position.set(0,.43*r+s*.08+.025*Math.sin(t*(ride?5:1.8)),s*-.35);
 m.avatar.rotation.set(s*1.2,ride?Math.sin(t*.7)*.035:0,0);
 m.torso.scale.y=1+(reduced?0:.013*Math.sin(t*(sleep?1.5:2.1)));
 m.bag.rotation.z=reduced?0:Math.sin(t*(ride?5:1.4))*(ride?.025:.008);if(m.tail)m.tail.rotation.y=reduced?0:Math.sin(t*1.6)*.08;
 for(let i=0;i<m.ears.length;i++)m.ears[i].rotation.x=reduced?0:Math.sin(t*2.3+i)*.022;
 m.head.rotation.y=(ride?.06:Math.sin(t*.8)*.2)*(m.id==='lumi'?1.5:.7);m.head.rotation.z=eat?Math.sin(t*5)*.035:Math.sin(t*.9)*.035;
 m.head.rotation.x=-s*1.05+(expression==='listening'?-.06:0)+(eat?Math.sin(t*5)*.025:0);
 m.helmet.visible=s<.9;
 if(m.sleepingPanda){m.avatar.visible=s<.6;m.sleepingPanda.visible=s>=.6;m.sleepingPanda.scale.y=1+(reduced?0:.012*Math.sin(t*1.4));m.mouth.visible=speech>.05;const sleepyMouth=m.sleepingPanda.getObjectByName('talking-mouth');sleepyMouth.visible=speech>.05;sleepyMouth.scale.y=.008+Math.max(0,speech)*.065;m.sleepingPanda.getObjectByName('smile').visible=speech<.08;}
 const blink=s>.5?.07:(t%5.6>5.35?.08:1);for(const eye of m.eyes)eye.scale.y=blink;
 m.mouth.scale.y=s>.5?.008:.013+Math.max(0,speech)*.08+(eat?.009*(1+Math.sin(t*7)):0);m.mouth.scale.x=.055-Math.max(0,speech)*.015;m.smile.visible=speech<.08;
 const pickup=state==='resting'&&eat&&!reduced?T.MathUtils.smoothstep(age,.5,2):1;
 m.snack.visible=eat&&(pickup>.1||reduced);m.question.visible=m.id==='lumi'&&state==='greeting';m.question.position.y=2.22+.065*Math.sin(t*3);m.question.rotation.z=Math.sin(t*2)*.08;
 m.snack.rotation.x=eat?1.8:0;
 m.sleep.visible=s>.4;m.sleep.position.y=1.45+.08*Math.sin(t*1.5);
 // Lulu keeps the fitted pale helmet in every awake pose.
 for(const arm of m.arms){
  const chewing=eat&&arm.side===1?1:0,looking=m.id==='lumi'&&state==='resting';
  arm.shoulder.position.z=.06+.11*r+.11*chewing*pickup;arm.shoulder.position.x=arm.side*(.39-.07*r);
  arm.shoulder.rotation.x=-1.05*r+(1-r)*chewing*((1-pickup)*.9-pickup*1);arm.shoulder.rotation.z=arm.side*(.12+(.12*Math.sin(t*2))*(1-r))*(1-s)*(1-r)+s*-.3;
  arm.elbow.rotation.x=-.55*r-(1-r)*chewing*(.8+.06*Math.sin(t*6));
  if(m.id==='lumi'&&state==='greeting'&&arm.side===-1&&!reduced&&age<2.6){arm.shoulder.rotation.z=-.7+Math.sin(t*6)*.12;arm.elbow.rotation.x=-.6;}
  if(looking&&arm.side===-1){arm.shoulder.rotation.x=-.6+.2*Math.sin(t);arm.shoulder.rotation.z=-.65;}
 }
 m.bike.visible=r>.025;m.bike.scale.setScalar(Math.max(.02,r));m.bike.position.x=-.3*(1-r);
 // Positive X rotation rolls toward the front (+Z); the upper pedal follows.
 for(const wheel of m.wheels)wheel.rotation.x=phase;m.crank.rotation.x=phase;
 for(const leg of m.legs){
  const a=phase+(leg.side===1?Math.PI:0),hip=[leg.side*.21,.45,0];
  const stand=[leg.side*.23,.11,.04],pedal=[leg.side*.27,.59+leg.side*.17*Math.cos(phase)-m.avatar.position.y,-.03+leg.side*.17*Math.sin(phase)];
  const foot=stand.map((x,i)=>T.MathUtils.lerp(x,pedal[i],r));const dy=foot[1]-hip[1],dz=foot[2]-hip[2],d=Math.min(.5,Math.hypot(dy,dz)),bend=Math.sqrt(Math.max(0,.26**2-(d/2)**2));
  const knee=[leg.side*.22,(hip[1]+foot[1])/2+dz/(d||1)*bend,(hip[2]+foot[2])/2-dy/(d||1)*bend];
  limb(leg.upper,hip,knee,.13);limb(leg.lower,knee,foot,.115);leg.foot.position.set(...foot);leg.foot.rotation.x=r*Math.sin(a)*.25;
 }
 return m;
}
export function disposeCharacter(model){const geometry=new Set(),material=new Set();model.root.traverse(o=>{if(o.geometry&&o.geometry!==skin&&o.geometry!==unitCylinder)geometry.add(o.geometry);if(o.material)material.add(o.material);});for(const g of geometry)g.dispose();for(const m of material)m.dispose();}
