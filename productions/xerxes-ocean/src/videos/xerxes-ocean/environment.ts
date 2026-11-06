/** Original Hellespont coast, Achaemenid pavilion and ship-pontoon construction.
 * All meshes/maps are generated here. No study imagery or external models are used.
 */
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {ctex, rep, planksHD, beamHD, stoneHD, waterNear, waterFar, rng} from './paint';
import {twoTone, untone} from './shade';
import {NOINK} from './ink';

type Mode = 'shore'|'tent'|'fleet';
const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const G = new THREE.BoxGeometry(1,1,1);
const materialCache=new Map<string,THREE.MeshLambertMaterial>();
const mat = (color:THREE.ColorRepresentation,map?:THREE.Texture) => {const key=new THREE.Color(color).getHexString()+'_'+(map?.uuid??'');let m=materialCache.get(key);if(!m){m=twoTone(new THREE.MeshLambertMaterial({color,...(map?{map}:{})}));materialCache.set(key,m);}return m;};
const transformed = (g:THREE.BufferGeometry,p:THREE.Vector3,s=V(1,1,1),q=new THREE.Quaternion()) => g.clone().applyMatrix4(new THREE.Matrix4().compose(p,q,s));
const between = (a:THREE.Vector3,b:THREE.Vector3,r:number,sides=7) => new THREE.CylinderGeometry(r,r,a.distanceTo(b),sides).applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(V(0,1,0),b.clone().sub(a).normalize()),V(1,1,1)));
const mesh = (parent:THREE.Object3D,g:THREE.BufferGeometry,m:THREE.Material|THREE.Material[],p=V()) => {const o=new THREE.Mesh(g,m);o.position.copy(p);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
const box = (parent:THREE.Object3D,m:THREE.Material,p:THREE.Vector3,s:THREE.Vector3) => mesh(parent,G,m,p).scale.copy(s);
const soften = (o:THREE.Object3D) => {o.traverse(v=>{v.layers.set(NOINK);});return o;};

const sandMap=()=>ctex('xerxes_sand',1024,1024,(g,r)=>{
  g.fillStyle='#d9b57c';g.fillRect(0,0,1024,1024);
  for(let i=0;i<95;i++){const x=r()*1024,y=r()*1024;g.fillStyle=i%2?'rgba(255,227,178,.11)':'rgba(153,111,65,.09)';g.beginPath();g.ellipse(x,y,50+r()*120,12+r()*45,r()*3,0,7);g.fill();}
  for(let i=0;i<1700;i++){g.fillStyle=i%3?'rgba(117,84,53,.11)':'rgba(255,238,197,.2)';g.fillRect(r()*1024,r()*1024,1+r()*2,1+r()*2);}
  g.lineWidth=1.5;g.strokeStyle='rgba(128,91,51,.09)';for(let i=0;i<35;i++){const y=r()*1024;g.beginPath();g.moveTo(0,y);g.bezierCurveTo(250,y-12,700,y+14,1024,y);g.stroke();}
});
const clothMap=(purple:boolean)=>ctex('xerxes_cloth_'+purple,1024,1024,(g,r)=>{
  g.fillStyle=purple?'#6a366f':'#e2bd89';g.fillRect(0,0,1024,1024);
  for(let y=0;y<1024;y+=128){g.fillStyle=purple?'#d8ae51':'#8c4358';g.fillRect(0,y,1024,12);g.fillRect(0,y+23,1024,4);}
  g.strokeStyle=purple?'rgba(244,198,101,.62)':'rgba(137,62,79,.35)';g.lineWidth=4;
  for(let y=62;y<1024;y+=128)for(let x=50;x<1024;x+=110){g.beginPath();g.moveTo(x,y-18);g.lineTo(x+20,y);g.lineTo(x,y+18);g.lineTo(x-20,y);g.closePath();g.stroke();}
  for(let i=0;i<5000;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.025)':'rgba(0,0,0,.035)';g.fillRect(r()*1024,r()*1024,2,6);}
});

/** Twin metal cuffs with alternating open-link connecting chain, intended as a visible insert prop. */
export function makeCuffs():THREE.Group {
  const root=new THREE.Group(),iron=mat('#727b8e'),shine=mat('#c9d4dc');
  for(const x of [-.77,.77]){
    mesh(root,new THREE.TorusGeometry(.46,.085,7,36),iron,V(x,0,0));
    mesh(root,new THREE.TorusGeometry(.46,.025,5,36),shine,V(x,-.01,.075));
    mesh(root,new THREE.BoxGeometry(.2,.18,.2),iron,V(x+(x<0?.38:-.38),0,0));
  }
  for(let i=0;i<5;i++){const o=mesh(root,new THREE.TorusGeometry(.12,.035,5,12),iron,V(-.28+i*.14,0,0));o.rotation.y=i%2?Math.PI/2:0;}
  return root;
}

/** Small complete ship used for the king's final ironic journey. Origin is the waterline. */
export function makeRoyalBoat():THREE.Group {
  const r=new THREE.Group();
  const hull=shipPrototype(false);mesh(r,hull.geometry,hull.materials);
  const oars:THREE.Group[]=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*1.35,.78,-.7);r.add(pivot);
    mesh(pivot,between(V(-side*.85,.05,0),V(side*3.25,-.26,.6),.057,7),mat('#c6955d'));
    const blade=mesh(pivot,new THREE.BoxGeometry(.32,.08,1.12),mat('#d9b478'),V(side*3.22,-.27,.65));blade.rotation.y=side*.12;
    oars.push(pivot);
  }
  r.userData.oars=oars;r.userData.animateOars=(frame:number)=>updateBoatOars(r,frame);updateBoatOars(r,0);return r;
}
/** Original rowing stroke: 48 frames, power and feather phases, deterministic on seeks. */
export function updateBoatOars(boat:THREE.Group,frame:number){
  const phase=frame/48*Math.PI*2;
  (boat.userData.oars as THREE.Group[]|undefined)?.forEach((o,i)=>{
    const side=i?1:-1;o.rotation.y=side*(.18+.46*Math.sin(phase));
    o.rotation.z=-side*(.045+.12*Math.max(0,Math.cos(phase)));
    o.rotation.x=.075*Math.sin(phase-.5);
  });
}

export const makeBoat=makeRoyalBoat;

function shipPrototype(shippedOars=true):{geometry:THREE.BufferGeometry;materials:THREE.Material[]} {
  const pieces:THREE.BufferGeometry[][]=[[],[],[],[],[]];
  const materials=[mat('#ae703c',beamHD()),mat('#d9aa62'),mat('#5e3f2d'),mat('#ceba83'),mat('#497583')];
  // Long pointed wooden hull, in transverse sections. Y=0 is the nominal waterline.
  const pos:number[]=[],uv:number[]=[],idx:number[]=[];const n=20,k=9;
  for(let j=0;j<=n;j++){
    const z=-5.7+j*11.4/n,w=1.63*Math.pow(Math.sin(Math.PI*j/n),.48)+.045;
    for(let a=0;a<=k;a++){const th=Math.PI*a/k;pos.push(-Math.cos(th)*w,.65-Math.sin(th)*1.23,z);uv.push(a/k,j/n*3);}
  }
  for(let j=0;j<n;j++)for(let a=0;a<k;a++){const q=j*(k+1)+a;idx.push(q,q+1,q+k+1,q+1,q+k+2,q+k+1);}
  const hull=new THREE.BufferGeometry();hull.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));hull.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));hull.setIndex(idx);hull.computeVertexNormals();pieces[0].push(hull.toNonIndexed());
  // Rubbing strakes follow hull sheer; not a generic rectangular barge.
  for(const side of [-1,1]){
    const pts=Array.from({length:17},(_,j)=>{const z=-5.65+j*11.3/16,w=1.63*Math.pow(Math.sin(Math.PI*j/16),.48)+.06;return V(side*w,.67+.1*Math.pow(Math.abs(z)/5.7,4),z);});
    pieces[1].push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,.1,5,false).toNonIndexed());
    for(let j=0;j<(shippedOars?4:0);j++){
      // Pontoon ships are anchored, with their oars shipped tight alongside the hull.
      // The 4.1 m full width leaves clearance between adjacent vessels 4.5 m apart.
      const z=-3.9+j*2.1;pieces[2].push(between(V(side*1.15,.37,z),V(side*1.98,.18,z+1.1),.052,5).toNonIndexed());
      const paddle=new THREE.BoxGeometry(.13,.07,.6);const q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),side*.06);pieces[1].push(transformed(paddle,V(side*1.98,.18,z+1.1),V(1,1,1),q).toNonIndexed());
    }
  }
  pieces[0].push(transformed(new THREE.BoxGeometry(2.7,.12,8.3),V(0,.43,0)).toNonIndexed());
  pieces[2].push(between(V(0,.48,-5.55),V(0,1.4,-6.18),.13,6).toNonIndexed());
  pieces[1].push(between(V(0,.47,5.55),V(0,1.2,6.05),.11,6).toNonIndexed());
  for(const z of [-3.5,3.5])pieces[2].push(transformed(new THREE.BoxGeometry(2.7,.2,.42),V(0,.7,z)).toNonIndexed());
  // Furled sail across a short lowered yard, unobtrusive beneath the roadway.
  pieces[3].push(between(V(-1.2,.8,3.5),V(1.2,.8,3.5),.19,7).toNonIndexed());
  // Painted eyes distinguish the ancient bow in closer construction shots.
  for(const side of [-1,1]){
    const q=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),side*Math.PI/2);
    pieces[3].push(transformed(new THREE.CircleGeometry(.21,12),V(side*.7,.35,-4.75),V(1,.6,1),q).toNonIndexed());
    pieces[4].push(transformed(new THREE.CircleGeometry(.085,10),V(side*.712,.35,-4.75),V(1,1,1),q).toNonIndexed());
  }
  const merged=pieces.map(a=>mergeGeometries(a,false)!);const geometry=mergeGeometries(merged,true)!;
  return {geometry,materials};
}

const plasterPaint=(color:string)=>ctex('xerxes_plaster_'+color,512,512,(g,r)=>{
  g.fillStyle=color;g.fillRect(0,0,512,512);
  for(let i=0;i<55;i++){const x=r()*512,y=r()*512;const gr=g.createRadialGradient(x,y,0,x,y,25+r()*65);gr.addColorStop(0,i%2?'rgba(255,244,210,.12)':'rgba(103,79,70,.07)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-90,y-90,180,180);}
  for(let i=0;i<1100;i++){g.fillStyle=i%3?'rgba(255,250,231,.045)':'rgba(64,50,47,.04)';g.fillRect(r()*512,r()*512,1+r()*2,1+r()*2);}
  g.strokeStyle='rgba(111,90,75,.1)';g.lineWidth=.6;for(let i=0;i<9;i++){const x=r()*512,y=r()*512;g.beginPath();g.moveTo(x,y);g.lineTo(x+5,y+25);g.lineTo(x+1,y+39);g.stroke();}
});
const deckPaint=()=>ctex('xerxes_deck_soft',1024,1024,(g,r)=>{
 const cols=['#d9b486','#d2a77b','#ddba8e','#cfaa7b','#dfbb8e','#d7b184'];
 for(let j=0;j<8;j++){const y=j*128;g.fillStyle=cols[j%cols.length];g.fillRect(0,y,1024,128);const gr=g.createLinearGradient(0,y,0,y+127);gr.addColorStop(0,'rgba(255,242,202,.2)');gr.addColorStop(.12,'rgba(255,242,202,0)');gr.addColorStop(.88,'rgba(79,45,29,0)');gr.addColorStop(1,'rgba(79,45,29,.12)');g.fillStyle=gr;g.fillRect(0,y,1024,128);g.fillStyle='rgba(74,43,28,.4)';g.fillRect(0,y+126,1024,2);for(let k=0;k<10;k++){g.strokeStyle=k%2?'rgba(102,65,37,.075)':'rgba(255,241,204,.1)';g.lineWidth=1+r();const yy=y+10+r()*100;g.beginPath();g.moveTo(0,yy);g.bezierCurveTo(250,yy-4,700,yy+4,1024,yy);g.stroke();}if(j%3===0){const x=200+r()*600;g.strokeStyle='rgba(115,72,40,.16)';g.lineWidth=1.5;g.beginPath();g.ellipse(x,y+64,22,7,.05,0,7);g.stroke();}}
});
const mosaicPaint=()=>ctex('xerxes_mosaic_r4',1024,1024,(g,r)=>{
 g.fillStyle='#d5c4a6';g.fillRect(0,0,1024,1024);const cols=['#d6c9ae','#e0d3b9','#c8b9a0','#d8c7ac'];
 for(let y=0;y<1024;y+=64)for(let x=0;x<1024;x+=64){g.fillStyle=cols[Math.floor(r()*4)];g.fillRect(x+1,y+1,62,62);}
 for(const c of [30,58,966,994]){g.fillStyle='#53797b';g.fillRect(c,30,12,964);g.fillRect(30,c,964,12);}
 g.strokeStyle='#b3935e';g.lineWidth=8;g.beginPath();g.arc(512,512,220,0,7);g.stroke();
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;g.save();g.translate(512+Math.cos(a)*193,512+Math.sin(a)*193);g.rotate(a);g.fillStyle=i%2?'#637e7c':'#b78162';g.beginPath();g.moveTo(-14,0);g.quadraticCurveTo(0,-22,14,0);g.quadraticCurveTo(0,22,-14,0);g.fill();g.restore();}
 g.fillStyle='#947f62';g.beginPath();g.arc(512,512,30,0,7);g.fill();
});
const royalTextile=(tone:'teal'|'plum'|'sand')=>ctex('xerxes_royal_'+tone,1024,1024,(g,r)=>{
 const base=tone==='teal'?'#2b6668':tone==='plum'?'#683b59':'#d1b17c';g.fillStyle=base;g.fillRect(0,0,1024,1024);
 const gr=g.createLinearGradient(0,0,1024,0);gr.addColorStop(0,'rgba(20,23,45,.3)');gr.addColorStop(.27,'rgba(255,225,172,.08)');gr.addColorStop(.53,'rgba(18,23,45,.12)');gr.addColorStop(.76,'rgba(255,225,172,.07)');gr.addColorStop(1,'rgba(20,23,45,.3)');g.fillStyle=gr;g.fillRect(0,0,1024,1024);
 g.fillStyle='#b79659';for(const x of [28,52,958,982])g.fillRect(x,0,6,1024);for(const y of [35,58,966,989])g.fillRect(0,y,1024,5);
 g.strokeStyle='rgba(220,184,112,.56)';g.lineWidth=2;
 for(let y=130;y<900;y+=150)for(let x=150;x<930;x+=150){g.beginPath();for(let i=0;i<=8;i++){const a=i/8*Math.PI*2;const rr=i%2?13:28;const xx=x+Math.cos(a)*rr,yy=y+Math.sin(a)*rr;i?g.lineTo(xx,yy):g.moveTo(xx,yy);}g.closePath();g.stroke();g.beginPath();g.arc(x,y,7,0,7);g.stroke();}
 for(let i=0;i<5000;i++){g.fillStyle=i%2?'rgba(255,250,220,.025)':'rgba(5,13,33,.025)';g.fillRect(r()*1024,r()*1024,1,4);}
});
const contactTex=()=>ctex('xerxes_ground_contact_r4',128,128,g=>{const gr=g.createRadialGradient(64,64,0,64,64,63);gr.addColorStop(0,'rgba(38,31,55,.35)');gr.addColorStop(.45,'rgba(38,31,55,.18)');gr.addColorStop(1,'rgba(38,31,55,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);});
function contact(parent:THREE.Object3D,x:number,z:number,w:number,d:number,y=.014){const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:contactTex(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));o.rotation.x=-Math.PI/2;o.position.set(x,y,z);o.layers.set(NOINK);parent.add(o);}
function hill(parent:THREE.Object3D,x:number,z:number,w:number,h:number,d:number,color:string,seed=0){const g=new THREE.SphereGeometry(1,24,12);const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const xx=p.getX(i),yy=p.getY(i),zz=p.getZ(i);const n=1+.045*Math.sin(xx*11+zz*7+seed)+.027*Math.cos(yy*9+xx*5+seed);p.setXYZ(i,xx*w*n,yy*h*n,zz*d*n);}g.computeVertexNormals();const o=mesh(parent,g,mat(color),V(x,-h*.5,z));o.layers.set(NOINK);return o;}
function mergeStatic(root:THREE.Group){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),sets=new Map<string,{m:THREE.Material|THREE.Material[];g:THREE.BufferGeometry[];o:THREE.Mesh[];layers:number;shadow:boolean;receive:boolean}>();
 root.traverse(o=>{if(!(o instanceof THREE.Mesh)||o instanceof THREE.InstancedMesh||o.userData.dynamic)return;let a:THREE.Object3D|null=o.parent;while(a&&a!==root){if(a.userData.dynamic)return;a=a.parent;}const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.some(m=>m.transparent))return;const key=ms.map(m=>m.uuid).join('_')+'_'+o.layers.mask+'_'+o.castShadow+'_'+o.receiveShadow;let q=sets.get(key);if(!q){q={m:o.material,g:[],o:[],layers:o.layers.mask,shadow:o.castShadow,receive:o.receiveShadow};sets.set(key,q);}const g=o.geometry.clone();g.applyMatrix4(inv.clone().multiply(o.matrixWorld));q.g.push(g.index?g.toNonIndexed():g);q.o.push(o);});
 for(const q of sets.values()){if(q.g.length<2)continue;const g=mergeGeometries(q.g,false);if(!g)continue;const o=new THREE.Mesh(g,q.m);o.layers.mask=q.layers;o.castShadow=q.shadow;o.receiveShadow=q.receive;root.add(o);q.o.forEach(o=>o.parent?.remove(o));}
}

export class HellespontEnvironment {
  root=new THREE.Group();
  readonly shore=new THREE.Group();readonly tent=new THREE.Group();readonly fleet=new THREE.Group();
  private water:THREE.Mesh;private waterMat:THREE.ShaderMaterial;
  private ships:THREE.InstancedMesh;private road:THREE.InstancedMesh;private beams:THREE.InstancedMesh;
  private ropes=new THREE.Group();private rain:THREE.LineSegments;
  private dummy=new THREE.Object3D();private spots:{x:number;z:number;i:number}[]=[];
  private spray:THREE.InstancedMesh;
  private coastal=new THREE.Group();
  private cloths:{mesh:THREE.Mesh;base:Float32Array;seed:number}[]=[];
  private flames:THREE.Object3D[]=[];
  private lashings:THREE.InstancedMesh;

  constructor(){
    const R=this.root;R.add(this.shore,this.tent,this.fleet,this.coastal);
    // Water geometry has enough subdivisions for a coherent storm silhouette near the lens.
    this.waterMat=new THREE.ShaderMaterial({
      uniforms:{uTime:{value:0},uStorm:{value:0},uGolden:{value:0},uNear:{value:untone('#126c8a')},uFar:{value:untone('#59b8ce')},uFoam:{value:untone('#d5eff0')},tNear:{value:waterNear()},tFar:{value:waterFar()}},
      vertexShader:`varying vec3 vP;uniform float uTime,uStorm;void main(){vec3 p=position;float a=.045+uStorm*.53;p.y+=a*(sin(p.z*.61+uTime*2.3)+.45*sin(p.x*.39+p.z*.22-uTime*1.6));vP=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}`,
      fragmentShader:`varying vec3 vP;uniform float uTime,uStorm,uGolden;uniform vec3 uNear,uFar,uFoam;uniform sampler2D tNear,tFar;void main(){vec3 V=vP-cameraPosition;float d=length(V);float dep=asin(clamp(-V.y/max(d,.01),0.,1.));float h=1.-smoothstep(0.,.58,dep);vec3 c=mix(uNear,uFar,h);vec2 p=vP.xz+vec2(.1*uTime,uTime*(.32+uStorm*.85));vec3 marks=mix(texture2D(tNear,p/8.).rgb,texture2D(tFar,p/40.+.37).rgb,smoothstep(20.,90.,d));float wave=sin(vP.z*.61+uTime*2.3)+.45*sin(vP.x*.39+vP.z*.22-uTime*1.6);float crest=smoothstep(.9,1.35,wave)*uStorm*.4;c=mix(c,c*.65,marks.g*.4);c=mix(c,uFoam,marks.r*(.24+uStorm*.37)+crest);c=mix(c,uFoam,marks.b*(.24+uGolden*.21));float wash=exp(-pow((vP.z+1.25-.13*sin(vP.x*.8)-.08*sin(uTime*1.7))/.24,2.))*(.5+.25*sin(vP.x*2.2+uTime*2.));if(vP.z>-2.5)c=mix(c,uFoam,clamp(wash,0.,.65));gl_FragColor=vec4(c,1.);}`,
      side:THREE.DoubleSide,
    });
    for(const k of ['tNear','tFar']){this.waterMat.uniforms[k].value.colorSpace=THREE.NoColorSpace;}
    const wg=new THREE.PlaneGeometry(800,550,160,110);wg.rotateX(-Math.PI/2);wg.translate(0,-.55,-273);
    this.water=new THREE.Mesh(wg,this.waterMat);this.water.layers.set(NOINK);R.add(this.water);
    const sand=mat('#ffffff',rep(sandMap(),18,9));
    const groundGeometry=new THREE.PlaneGeometry(760,280);groundGeometry.rotateX(-Math.PI/2);groundGeometry.translate(0,-.012,140.5);
    const ground=mesh(R,groundGeometry,sand);ground.castShadow=false;ground.layers.set(NOINK);
    // The beach slopes into the water, rather than ending at a vertical box wall.
    // Floor and water joins deliberately receive no geometric ink.
    const edgePos:number[]=[],edgeUv:number[]=[],edgeIdx:number[]=[],edgeColors:number[]=[];
    const nx=160,nz=8;
    for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
      const x=-380+i*760/nx,t=j/nz,irregular=(.14*Math.sin(x*.18)+.08*Math.sin(x*.57))*t;
      const z=.5-1.65*t+irregular,y=-.012-.55*(t*t*(3-2*t));
      edgePos.push(x,y,z);edgeUv.push(x/18,z/18);
      const col=new THREE.Color().lerpColors(new THREE.Color('#ffffff'),new THREE.Color('#b8b2a2'),t*.72);edgeColors.push(col.r,col.g,col.b);
      if(i<nx&&j<nz){const k=i*(nz+1)+j;edgeIdx.push(k,k+nz+1,k+1,k+1,k+nz+1,k+nz+2);}
    }
    const eg=new THREE.BufferGeometry();eg.setAttribute('position',new THREE.Float32BufferAttribute(edgePos,3));eg.setAttribute('uv',new THREE.Float32BufferAttribute(edgeUv,2));eg.setAttribute('color',new THREE.Float32BufferAttribute(edgeColors,3));eg.setIndex(edgeIdx);eg.computeVertexNormals();
    const wetSand=mat('#ffffff',sandMap());wetSand.vertexColors=true;
    const beachSlope=mesh(R,eg,wetSand);beachSlope.castShadow=false;beachSlope.layers.set(NOINK);
    const landscape=new THREE.Group();R.add(landscape);this.buildTerrain(landscape);this.buildHarborQuarter(landscape);mergeStatic(landscape);
    this.buildShore();this.buildPavilion();
    const proto=shipPrototype();const N=58;
    this.ships=new THREE.InstancedMesh(proto.geometry,proto.materials,N);this.ships.castShadow=true;this.ships.receiveShadow=true;this.fleet.add(this.ships);
    const plank=rep(deckPaint(),1.25,2.2);const wood=mat('#ffffff',plank);
    this.road=new THREE.InstancedMesh(new THREE.BoxGeometry(4.48,.25,5.15),wood,N);this.road.castShadow=true;this.road.receiveShadow=true;this.fleet.add(this.road);
    this.beams=new THREE.InstancedMesh(new THREE.BoxGeometry(.26,.34,6),mat('#a77647',beamHD()),N*2);this.beams.castShadow=true;this.beams.receiveShadow=true;this.fleet.add(this.beams);
    this.lashings=new THREE.InstancedMesh(new THREE.TorusGeometry(.24,.035,5,12),mat('#b39b71'),N*4);this.lashings.castShadow=true;this.fleet.add(this.lashings);
    for(let b=0;b<2;b++)for(let j=0;j<29;j++)this.spots.push({x:-63+j*4.5,z:-5-b*25,i:b*29+j});
    this.fleet.add(this.ropes);const ropeM=mat('#bc9561');
    // Compressed geography: low rocky approaches meet both ends of the pontoon roads.
    const abutment=mat('#c6b08a',sandMap()),rockM=mat('#c5b79e');
    for(const side of [-1,1]){
      const approach=mesh(this.fleet,new THREE.SphereGeometry(1,12,6),abutment,V(side*89,-2,-18));approach.scale.set(27,4.6,35);
      for(let j=0;j<5;j++){const rock=mesh(this.fleet,new THREE.DodecahedronGeometry(1,0),rockM,V(side*(67+j*4),-.1,-42+j*12));rock.scale.set(3+j*.2,1.6,4);}
      for(const z of [-5,-30]){mesh(this.fleet,new THREE.BoxGeometry(5,.5,6),mat('#a78d63'),V(side*66.5,.77,z));}
    }
    for(let b=0;b<2;b++)for(const zoff of [-2.52,2.52]){
      const zz=-5-b*25+zoff;const points=Array.from({length:81},(_,i)=>V(-66+i*132/80,1.52+.06*Math.cos(i*.7),zz));
      mesh(this.ropes,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),160,.085,8,false),ropeM).layers.set(NOINK);
      // Two fine windings retain a braided impression without thousands of separate links.
      for(const phase of [0,Math.PI]){const p=Array.from({length:661},(_,i)=>V(-66+i*.2,1.52+.07*Math.sin(i*1.25+phase),zz+.07*Math.cos(i*1.25+phase)));mesh(this.ropes,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p),660,.023,6,false),mat('#9c794d')).layers.set(NOINK);}
    }
    // Sparse rain streaks: storm only. World positions keep deterministic timing in random-access renders.
    const ra:number[]=[];const rand=rng(212);for(let i=0;i<350;i++){const x=(rand()-.5)*180,y=rand()*35,z=-rand()*100;ra.push(x,y,z,x-.35,y-1.8,z-.12);}
    const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(ra,3));this.rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:'#b9cddc',transparent:true,opacity:.33,depthWrite:false}));this.rain.layers.set(NOINK);R.add(this.rain);
    const sm=new THREE.MeshBasicMaterial({color:'#d8eceb',transparent:true,opacity:.65,depthWrite:false});
    this.spray=new THREE.InstancedMesh(new THREE.SphereGeometry(1,5,3),sm,50);this.spray.layers.set(NOINK);R.add(this.spray);
    this.buildConstructionYard();
    this.update(0,'shore',false,0,false);
  }

  private animateCloth(parent:THREE.Object3D,w:number,h:number,color:THREE.Material,p:THREE.Vector3,seed:number,rotateY=0){
    const g=new THREE.PlaneGeometry(w,h,12,16);const m=mesh(parent,g,color,p);m.rotation.y=rotateY;m.userData.dynamic=true;this.cloths.push({mesh:m,base:new Float32Array(g.getAttribute('position').array as Float32Array),seed});return m;
  }
  private amphora(parent:THREE.Object3D,x:number,z:number,s=1,y=0){
    const r=new THREE.Group();r.position.set(x,y,z);r.scale.setScalar(s);parent.add(r);const clay=mat('#b77c60'),rim=mat('#d8ae7b');
    const profile=[V(.03,0),V(.17,.05),V(.35,.25),V(.43,.6),V(.36,.93),V(.17,1.08),V(.14,1.3),V(.19,1.34)].map(p=>new THREE.Vector2(p.x,p.y));
    mesh(r,new THREE.LatheGeometry(profile,16),clay);for(const side of [-1,1]){const handle=mesh(r,new THREE.TorusGeometry(.19,.045,5,14,Math.PI*1.5),clay,V(side*.29,1.03,0));handle.rotation.z=side*2.45;}
    for(const y of [.49,.84]){const line=mesh(r,new THREE.TorusGeometry(y<.5?.405:.385,.016,4,24),rim,V(0,y,0));line.rotation.x=Math.PI/2;}contact(parent,x,z,s*1.2,s*.9,.014+y);
  }
  private olive(parent:THREE.Object3D,x:number,z:number,size=1){
    const r=new THREE.Group();r.position.set(x,0,z);r.scale.setScalar(size);parent.add(r);const bark=mat('#8f8067'),leaf=mat('#718976'),lit=mat('#96a48a');
    mesh(r,between(V(0,0,0),V(.16,2.6,.1),.19,7),bark);for(const side of [-1,1])mesh(r,between(V(.1,1.5,0),V(side*1.1,3,.25),.11,6),bark);
    for(let i=0;i<7;i++){const a=i*2.4,d=i?1.3:0;const o=mesh(r,new THREE.IcosahedronGeometry(1,1),i%3?leaf:lit,V(Math.cos(a)*d,3.1+(i%3)*.24,Math.sin(a)*d*.6));o.scale.set(1.35,.77,1.06);o.rotation.y=i;}
    contact(parent,x,z,5*size,3*size);
  }
  private cypress(parent:THREE.Object3D,x:number,z:number,h=6){
    mesh(parent,new THREE.CylinderGeometry(.13,.21,h*.6,7),mat('#837361'),V(x,h*.26,z));
    const g=new THREE.LatheGeometry([new THREE.Vector2(.06,0),new THREE.Vector2(.48,h*.17),new THREE.Vector2(.62,h*.42),new THREE.Vector2(.43,h*.71),new THREE.Vector2(.05,h)],12);mesh(parent,g,mat('#496d63'),V(x,h*.08,z));
  }
  private house(parent:THREE.Object3D,x:number,z:number,w:number,h:number,d:number,color:string,seed:number){
    const r=new THREE.Group();r.position.set(x,0,z);parent.add(r);
    const plaster=mat('#ffffff',plasterPaint(color)),trim=mat('#d8c7a5'),stone=mat('#bca78b',stoneHD('xerxes_oldblock',['#c4b69d','#b7ab94','#cdbfa7','#b8ad99'],'#9b9488')),dark=mat('#36565b'),wood=mat('#8d6d4c',beamHD()),blue=mat(seed%2?'#547b7d':'#787d88');dark.side=THREE.DoubleSide;
    box(r,plaster,V(0,h/2,0),V(w,h,d));box(r,stone,V(0,.28,0),V(w+.12,.56,d+.12));
    for(const yy of [h-.12,h+.13])box(r,trim,V(0,yy,0),V(w+.24,.17,d+.24));
    for(const side of [-1,1]){box(r,plaster,V(side*(w/2-.13),h+.44,0),V(.26,.68,d+.2));box(r,plaster,V(0,h+.44,side*(d/2-.13)),V(w,.68,.26));}
    const front=-d/2-.028,doorX=(seed%3-1)*w*.16,doorH=Math.min(2.6,h*.52),doorW=1.25;
    box(r,dark,V(doorX,doorH/2,front),V(doorW,doorH,.035));
    for(const side of [-1,1])box(r,trim,V(doorX+side*(doorW/2+.08),doorH/2,front-.07),V(.15,doorH+.16,.16));
    box(r,wood,V(doorX,doorH+.08,front-.1),V(doorW+.45,.22,.27));
    for(let k=0;k<5;k++)box(r,wood,V(doorX-doorW*.42+k*doorW*.2,doorH*.48,front-.04),V(.055,doorH*.86,.05));
    for(let k=0;k<3;k++)box(r,stone,V(doorX,.09+k*.12,front-.2-(2-k)*.26),V(doorW+.38,.18,.5+(2-k)*.36));
    for(const side of [-1,1])for(let row=0;row<(h>6.5?2:1);row++){
      const xx=side*w*.31,yy=doorH*.7+row*2.5;
      box(r,dark,V(xx,yy,front-.015),V(.7,.99,.04));box(r,trim,V(xx,yy-.56,front-.13),V(.94,.12,.26));box(r,trim,V(xx,yy+.55,front-.08),V(.94,.13,.17));
      const shutter=box(r,blue,V(xx+side*.48,yy,front-.04),V(.28,1.06,.1));
      for(let k=0;k<5;k++)box(r,wood,V(xx,yy-.4+k*.2,front-.07),V(.6,.045,.05));
    }
    if(seed%2===0){const shade=mat('#cda278');shade.side=THREE.DoubleSide;const awn=this.animateCloth(r,w*.63,1.4,shade,V(doorX,doorH+.18,front-.82),seed);awn.rotation.x=-.9;for(const side of [-1,1])mesh(r,between(V(doorX+side*w*.28,0,front-1.4),V(doorX+side*w*.28,doorH+.1,front-1.4),.065,6),wood);}
    if(seed%3===0)this.amphora(r,w*.3,0,.65,h+.78);
    contact(parent,x,z,w*1.5,d*1.6);
    return r;
  }
  private buildTerrain(parent:THREE.Group){
    const limestone=mat('#c7bba3',stoneHD('xerxes_limestone_r4',['#c8bca5','#c2b59e','#d0c3ac','#c8bca8'],'#a79e8e'));
    // Layered far coast has a real village at its foot, and soft mountain silhouettes behind it.
    for(let i=0;i<11;i++){hill(parent,-205+i*42,-222-(i%3)*17,40,18+i%4*5,26,['#9faeb0','#adbbba','#b4bdb9'][i%3],i);}
    for(let i=0;i<8;i++){hill(parent,-210+i*60,-300-(i%3)*25,62,32+i%3*9,38,['#b2bec5','#bdc6c9'][i%2],i+9);}
    for(let i=0;i<16;i++){
      const x=-130+i*17,z=-158-(i%4)*5;
      const bluff=mesh(parent,new THREE.BoxGeometry(18,2.2,11),limestone,V(x,-.4,z));bluff.rotation.y=Math.sin(i)*.12;
      this.house(parent,x,-169-(i%3)*5,6+i%3,5.1+i%4*1.2,5.5,['#d5c8b0','#d1b596','#c5bca5','#c9b394'][i%4],i+70);
      if(i%2)this.cypress(parent,x+4,-168-(i%3)*5,6.8);
    }
    // Inland quarter and olives provide a spatially rich reverse beach view.
    for(let i=0;i<7;i++)hill(parent,-65+i*22,63+(i%3)*12,25,9+i%3*3,20,['#a0a483','#a9ad91','#939f89'][i%3],i+30);
    for(const [x,z,h] of [[-10,29,6.4],[9,33,8.1],[17,25,6.8],[-18,22,6.5],[-4,40,8.7],[4,42,7.8]] as const)this.cypress(parent,x,z,h);
    for(const [x,z,s] of [[-9,12,1.1],[11,15,1.25],[-16,31,1.5],[22,35,1.35]] as const)this.olive(parent,x,z,s);
    // Terraced harbor headlands frame, rather than obstruct, the central sea corridor.
    for(const side of [-1,1]){
      const c=new THREE.Group();this.coastal.add(c);c.position.set(side*15,0,-17);c.rotation.y=side*-.12;
      hill(c,0,0,8.5,4.2,10,'#b8ad95',40+side);
      for(let k=0;k<3;k++)box(c,limestone,V(side*k*1.2,.1+k*.8,-1-k*1.3),V(8.8-k*.7,.75,6.8));
      this.house(c,side*1.4,-2,4.8,6.7,4.5,side<0?'#cda98c':'#d2c3a7',40+side);
      this.house(c,side*6,2,5.7,8.2,5.5,side<0?'#b7bea9':'#d8bd94',45+side);
      this.cypress(c,side*-2.3,1.7,7.2);this.olive(c,side*5,-4,.9);
      for(let k=0;k<5;k++)box(c,limestone,V(-side*4.6,.1+k*.3,-2+k*.4),V(2.6,.3,3.6-k*.4));
    }
    for(let i=0;i<14;i++){
      const side=i%2?-1:1,x=side*(7.6+i%5*3.7),z=2+Math.floor(i/5)*4;
      const o=mesh(parent,new THREE.IcosahedronGeometry(1,1),limestone,V(x,.15,z));o.scale.set(.7+i%3*.28,.4+i%3*.18,.85);o.rotation.y=i*.8;contact(parent,x,z,2,1.4);
    }
  }
  private buildHarborQuarter(parent:THREE.Group){
    // An original low-rise port settlement: flat roofs, deep doorways and shaded lanes.
    const colors=['#d6c6a9','#c7ad91','#b8c2ae','#d4b78d','#c3b4a0','#d5c8b0'];
    const buildings=[[-8,19,6,6.6,5],[-1.8,25,6.2,7.5,5.5],[5.6,22,6.5,8.3,6],[13,24,5.7,5.7,5],[-17,25,7.2,8,6],[-10,34,6.6,8.9,6],[.5,35,7,9.6,5.5],[10,36,7.5,10.3,6],[20,35,6,7,5]];
    buildings.forEach(([x,z,w,h,d],i)=>this.house(parent,x,z,w,h,d,colors[i%colors.length],i));
    // A short colonnade and raised courtyard make the layers readable behind camp activity.
    const stone=mat('#d1c0a1'),shadow=mat('#546f70'),wood=mat('#a88257',beamHD());
    box(parent,stone,V(-4.8,.2,15),V(11,.4,4.5));
    for(let i=0;i<5;i++){const x=-9.2+i*2.2;mesh(parent,new THREE.CylinderGeometry(.18,.25,3.4,12),stone,V(x,1.9,13.2));mesh(parent,new THREE.CylinderGeometry(.4,.45,.2,12),stone,V(x,.52,13.2));box(parent,stone,V(x,3.6,13.2),V(.7,.3,.65));}
    box(parent,wood,V(-4.8,3.93,14.2),V(11.2,.28,3.5));
    for(let i=0;i<7;i++)box(parent,wood,V(-9.5+i*1.55,4.1,14.2),V(.15,.15,3.65));
    for(const [x,z,s] of [[-6,11,.8],[-5.1,11.5,.55],[5.7,11.8,.85],[6.6,12,.65],[-12,18,.6]] as const)this.amphora(parent,x,z,s);
  }
  private buildShore(){
    const r=this.shore,wood=mat('#a9845b',beamHD()),deck=mat('#ffffff',rep(deckPaint(),1,4)),rope=mat('#b29c73');
    box(r,deck,V(6.6,.13,-2.5),V(2.1,.26,8));
    for(const x of [5.8,7.4])for(const z of [.5,-2.4,-5.6])mesh(r,new THREE.CylinderGeometry(.12,.17,1.9,8),wood,V(x,-.24,z));
    for(const [x,z,s] of [[-4.4,2.6,.95],[4.1,3.1,.7],[4.7,3.45,.54]] as const)this.amphora(r,x,z,s);
    // Coiled cables on a timber rack, stakes and actual engineering supplies.
    for(const x of [-4,-3.25])mesh(r,between(V(x,0,3.3),V(x,1.95,2.85),.075,7),wood);
    mesh(r,between(V(-4.16,1.65,2.9),V(-3.1,1.65,2.9),.075,7),wood);
    for(let i=0;i<5;i++){const coil=mesh(r,new THREE.TorusGeometry(.34+i*.025,.034,5,30),rope,V(-3.65,1.15-i*.02,3.04+i*.035));coil.scale.y=1.35;}
    for(let i=0;i<4;i++){const o=mesh(r,new THREE.BoxGeometry(.4,.13,3.1),wood,V(5.1+i*.25,.15+i*.11,6.1));o.rotation.y=.12*i;}
    // Low military awnings have real folds and side poles, unlike identical pyramids.
    for(const [x,z,sz] of [[-5.2,9.8,.85],[4.3,11.5,.76]] as const){
      const tent=new THREE.Group();tent.position.set(x,0,z);tent.scale.setScalar(sz);r.add(tent);const cream=mat('#ffffff',royalTextile('sand'));cream.side=THREE.DoubleSide;
      for(const side of [-1,1]){const roof=this.animateCloth(tent,3.6,4.2,cream,V(side*1.28,2.15,0),x+side);roof.rotation.y=side*Math.PI/2;roof.rotation.x=side*-.62;}
      for(const xx of [-2.65,2.65])for(const zz of [-1.8,1.8])mesh(tent,between(V(xx,0,zz),V(xx,1.25,zz),.055,6),wood);
      for(const zz of [-2,2])mesh(tent,between(V(0,0,zz),V(0,3.65,zz),.07,6),wood);
      mesh(tent,between(V(0,3.65,-2.2),V(0,3.65,2.2),.075,6),wood);
      for(const xx of [-2.7,2.7])for(const zz of [-1.8,1.8])mesh(tent,between(V(xx,1.15,zz),V(xx*1.28,0,zz*1.25),.018,4),rope);
    }
    // A small Persian cloth standard moves against the architecture, with no modern insignia.
    for(const [x,z] of [[-6.1,7.8],[6.8,10.5]] as const){mesh(r,new THREE.CylinderGeometry(.045,.075,5.5,7),wood,V(x,2.7,z));const m=mat('#ffffff',royalTextile('plum'));m.side=THREE.DoubleSide;this.animateCloth(r,1.55,2.2,m,V(x+.7,3.7,z),x);}
    mergeStatic(r);mergeStatic(this.coastal);
  }
  private buildPavilion(){
    const r=this.tent,gold=mat('#b99860'),sand=mat('#d9c6a1'),wood=mat('#967151',beamHD()),teal=mat('#ffffff',royalTextile('teal')),plum=mat('#ffffff',royalTextile('plum'));teal.side=plum.side=THREE.DoubleSide;
    const floor=mat('#ffffff',mosaicPaint());box(r,floor,V(0,-.075,2),V(16,.15,13));
    const rug=mesh(r,new THREE.PlaneGeometry(6.9,7.4),plum,V(0,.018,2.5));rug.rotation.x=-Math.PI/2;
    // Weighted fabric rear with an open lattice clerestory; shade provides a real interior value mass.
    this.animateCloth(r,6.3,5.45,teal,V(0,2.78,-2.45),2);
    // A recessed timber lattice closes the bright seam above the rear fabric.
    // The small openings admit daylight without a distracting white strip.
    for(const y of [5.49,6.13])box(r,wood,V(0,y,-2.51),V(6.55,.11,.12));
    for(let i=0;i<19;i++){
      const x=-3.1+i*.345;
      const bar=mesh(r,between(V(x,5.52,-2.5),V(x+.27,6.1,-2.5),.025,6),gold);bar.layers.set(NOINK);
      const cross=mesh(r,between(V(x+.27,5.52,-2.48),V(x,6.1,-2.48),.025,6),wood);cross.layers.set(NOINK);
    }
    for(const side of [-1,1]){
      const wall=this.animateCloth(r,4.2,5.8,plum,V(side*5.1,3.05,.8),side*7,side*Math.PI/2);
      for(let j=0;j<6;j++){const c=this.animateCloth(r,.52,5.5,j%2?teal:plum,V(side*(3.1+j*.3),2.95,-1.2+j*.035),j+side);c.scale.z=.7;}
      const x=side*2.65,z=-.6;
      const column=mesh(r,new THREE.CylinderGeometry(.16,.22,5.5,16),gold,V(x,2.75,z));
      for(const [y,rad,ht] of [[.11,.42,.22],[.29,.29,.14],[5.28,.29,.18],[5.5,.42,.22]] as const)mesh(r,new THREE.CylinderGeometry(rad,rad*.93,ht,14),sand,V(x,y,z));
      for(let k=0;k<9;k++){const a=k/9*Math.PI*2;mesh(r,new THREE.CylinderGeometry(.022,.025,4.6,5),sand,V(x+Math.cos(a)*.17,2.77,z+Math.sin(a)*.17));}
      // Stylized opposed bull-head capital: period-derived original geometry.
      for(const dir of [-1,1]){const cap=mesh(r,new THREE.SphereGeometry(.2,10,6),gold,V(x+dir*.3,5.52,z));cap.scale.set(1.4,.8,.9);mesh(r,between(V(x+dir*.45,5.58,z),V(x+dir*.53,5.83,z-.05),.035,6),sand);}
      mesh(r,new THREE.TorusGeometry(.47,.065,6,24),gold,V(side*3.7,2.2,-.92)).scale.y=.65;
    }
    box(r,gold,V(0,5.7,-.6),V(6.1,.27,.4));box(r,plum,V(0,6,-.6),V(6.3,.4,.4));
    for(let i=0;i<13;i++){const x=-2.7+i*.45;const tassel=mesh(r,new THREE.ConeGeometry(.06,.23,7),gold,V(x,5.49,-.3));tassel.rotation.z=.06*Math.sin(i);}
    // Side clerestory opening, physical lattice and warm rimmed lamps add depth behind the throne.
    for(const side of [-1,1]){
      const x=side*4.4;
      for(let i=0;i<5;i++)mesh(r,between(V(x-.65+i*.28,1.5,-2.2),V(x-.65+i*.28,4.5,-2.2),.035,5),wood);
      for(let i=0;i<6;i++)mesh(r,between(V(x-.8,1.6+i*.5,-2.15),V(x+.8,1.6+i*.5,-2.15),.035,5),gold);
    }
    const roofM=mat('#ffffff',royalTextile('sand'));roofM.side=THREE.DoubleSide;
    const peak=V(0,7.8,1),corners=[V(-7.8,5.9,-3.8),V(7.8,5.9,-3.8),V(7.8,5.9,8.2),V(-7.8,5.9,8.2)];
    for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a.toArray(),...b.toArray(),...peak.toArray()],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));g.computeVertexNormals();mesh(r,g,roofM);mesh(r,between(a,b,.08,7),gold);}
    // Exposed warm rafters give the shaded canopy a constructed underside.
    const underPeak=peak.clone().add(V(0,-.11,0));
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4];
      for(const f of [0,.33,.67]){
        const eave=a.clone().lerp(b,f).add(V(0,-.1,0));
        mesh(r,between(eave,underPeak,.045,8),wood).layers.set(NOINK);
      }
      for(const f of [.44,.75]){
        const a2=peak.clone().lerp(a,f).add(V(0,-.1,0)),b2=peak.clone().lerp(b,f).add(V(0,-.1,0));
        mesh(r,between(a2,b2,.034,8),gold).layers.set(NOINK);
      }
    }
    for(const side of [-1,1])for(const zz of [-3.4,7.8])mesh(r,new THREE.CylinderGeometry(.12,.17,5.9,12),gold,V(side*7.4,2.95,zz));
    // Furniture is carved, padded and deliberately low so faces remain unobstructed.
    const throne=new THREE.Group();throne.position.set(-3.55,0,-.4);r.add(throne);
    box(throne,gold,V(0,.6,0),V(2,.3,1.7));box(throne,plum,V(0,.83,0),V(1.9,.24,1.5));box(throne,gold,V(0,1.65,-.72),V(2.1,1.8,.18));box(throne,teal,V(0,1.65,-.6),V(1.72,1.48,.08));
    for(const side of [-1,1]){box(throne,gold,V(side*.93,1.02,0),V(.14,.6,1.6));for(const zz of [-.57,.57])mesh(throne,new THREE.CylinderGeometry(.06,.1,.6,8),wood,V(side*.82,.3,zz));}
    for(const [x,z,c] of [[3.7,2.8,'#767a6d'],[4.8,3.3,'#bc9464'],[-4.8,2.4,'#6a7769']] as const){const cushion=mesh(r,new THREE.SphereGeometry(1,14,8),mat(c),V(x,.19,z));cushion.scale.set(.78,.21,.54);cushion.rotation.y=x*.3;contact(r,x,z,1.7,1.25);}
    for(const x of [-2.1,2.1]){
      const z=-.1;mesh(r,new THREE.CylinderGeometry(.12,.26,1.25,10),gold,V(x,.63,z));mesh(r,new THREE.CylinderGeometry(.48,.26,.3,14),gold,V(x,1.32,z));
      const flame=new THREE.Group();flame.position.set(x,1.6,z);flame.userData.dynamic=true;r.add(flame);
      const outer=mesh(flame,new THREE.SphereGeometry(1,10,7),new THREE.MeshBasicMaterial({color:new THREE.Color(3.7,1.05,.13)}),V(0,.16,0));outer.scale.set(.19,.46,.18);outer.layers.set(NOINK);
      const inner=mesh(flame,new THREE.ConeGeometry(.1,.53,9),new THREE.MeshBasicMaterial({color:new THREE.Color(5,3.6,1.1)}),V(.015,.13,.035));inner.layers.set(NOINK);this.flames.push(flame);
      contact(r,x,z,1.6,1.1);
    }
    this.amphora(r,-5.3,3.8,.95);this.amphora(r,5.4,4.2,.8);
    mergeStatic(r);
  }
  private buildConstructionYard(){
    const wood=mat('#ad8d64',beamHD()),rope=mat('#b9a277'),stone=mat('#b5ac96');
    for(const side of [-1,1]){
      for(const z of [-5,-30]){
        const g=new THREE.Group();g.position.set(side*63,1.3,z);this.fleet.add(g);
        for(let i=0;i<3;i++){const o=mesh(g,new THREE.BoxGeometry(2.5,.12,.32),wood,V(-side*(.5+i*.2),.08+i*.12,1.1));o.rotation.y=i*.12;}
        for(let i=0;i<4;i++){const coil=mesh(g,new THREE.TorusGeometry(.52+i*.035,.035,5,25),rope,V(side*.3,.06+i*.035,-1.1));coil.rotation.x=Math.PI/2;}
        mesh(g,new THREE.CylinderGeometry(.12,.17,1.4,7),wood,V(side*.9,.7,1.9));
      }
    }
  }

  update(frame:number,mode:Mode,storm:boolean,broken:number,golden:boolean){
    this.shore.visible=mode==='shore';this.tent.visible=mode==='tent';this.fleet.visible=mode==='fleet';this.coastal.visible=mode!=='fleet';
    const t=frame/30,b=THREE.MathUtils.clamp(broken,0,1),wu=this.waterMat.uniforms;
    wu.uTime.value=t;wu.uStorm.value=storm?1:0;wu.uGolden.value=golden?1:0;
    untone(storm?'#263f58':golden?'#253e67':'#145f77',wu.uNear.value);
    untone(storm?'#7d94a7':golden?'#c5919d':'#71b4c1',wu.uFar.value);
    untone(golden?'#f4d0b6':'#d5eff0',wu.uFoam.value);
    this.rain.visible=storm;this.rain.position.y=-(t*18%12);this.spray.visible=storm;
    const dummy=this.dummy;
    for(let i=0;i<this.spots.length;i++){
      const s=this.spots[i],wave=(storm?.2:.035)*Math.sin(t*(storm?2.4:.7)+i*.73),impact=b*(.4+Math.sin(i*2.17)*.4);
      dummy.position.set(s.x+b*Math.sin(i*7)*3,.05+wave-b*.3,s.z+b*Math.cos(i*4)*3.5);
      dummy.rotation.set((storm?.055:.01)*Math.sin(t*1.7+i)+b*Math.sin(i*2)*.23,b*Math.cos(i)*.2,(storm?.04:.008)*Math.sin(t*2+i));dummy.scale.set(1,1,1);dummy.updateMatrix();this.ships.setMatrixAt(i,dummy.matrix);
      dummy.position.set(s.x+b*Math.sin(i*5)*5,1.17+wave-impact*1.5,s.z+b*Math.cos(i*3)*5);dummy.rotation.set(b*Math.sin(i*9)*.5,0,b*Math.cos(i*4)*.32);dummy.updateMatrix();this.road.setMatrixAt(i,dummy.matrix);
      const roadP=dummy.position.clone(),roadQ=dummy.quaternion.clone();
      for(let j=0;j<2;j++){dummy.position.copy(V(j?1.76:-1.76,-.21,0).applyQuaternion(roadQ)).add(roadP);dummy.quaternion.copy(roadQ);dummy.updateMatrix();this.beams.setMatrixAt(i*2+j,dummy.matrix);}
      for(let k=0;k<4;k++){dummy.position.copy(V(k%2?1.76:-1.76,-.16,k<2?-2.3:2.3).applyQuaternion(roadQ)).add(roadP);dummy.quaternion.copy(roadQ);dummy.rotateX(Math.PI/2);dummy.scale.set(1,1,1);dummy.updateMatrix();this.lashings.setMatrixAt(i*4+k,dummy.matrix);}
    }
    for(const o of [this.ships,this.road,this.beams,this.lashings]){o.instanceMatrix.needsUpdate=true;o.computeBoundingSphere();}
    this.ropes.visible=b<.42;
    if(storm)for(let i=0;i<50;i++){
      const q=((t*.65+i*.213)%1);dummy.position.set(-55+(i*7.3)%110,-.15+Math.sin(q*Math.PI)*1.7,-1-(i*3.9)%48);dummy.rotation.set(0,0,0);dummy.scale.set(.08+q*.18,.1+q*.35,.07+q*.12);dummy.updateMatrix();this.spray.setMatrixAt(i,dummy.matrix);
    }
    this.spray.instanceMatrix.needsUpdate=true;
    for(const c of this.cloths){const a=c.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<a.count;i++){const x=c.base[i*3],y=c.base[i*3+1],z=c.base[i*3+2];const edge=Math.max(0,Math.min(1,(a.getX(i)+2)/4));a.setXYZ(i,x,y,z+Math.sin(x*2.4+y*.8+t*1.9+c.seed)*.075*edge);}a.needsUpdate=true;c.mesh.geometry.computeVertexNormals();}
    this.flames.forEach((fl,i)=>{fl.scale.y=1+.12*Math.sin(t*13+i*2);fl.scale.x=1+.06*Math.sin(t*9+i);});
  }
}
