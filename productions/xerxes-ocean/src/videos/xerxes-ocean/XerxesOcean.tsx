import React, {useEffect, useMemo, useState} from 'react';
import * as THREE from 'three';
import {AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode} from 'postprocessing';
import {InkPass, NOINK, noInkFallback} from './ink';
import {LensBlur} from './lensblur';
import {GradeEffect, GRADES, gradeFor} from './grade';
import {CINEMATIC_LIGHTS, LOOK} from './lights';
import {TONE, CHAR, LOCAL, untone, twoTone} from './shade';
import {cloudHD} from './paint';
import {Shot, camAt, shotAt, smooth} from './story';
import {HellespontEnvironment, makeCuffs, makeRoyalBoat} from './environment';
import {PersianActor, PersianAction} from './characters';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const up = V(0,1,0);
const material = (color:string) => twoTone(new THREE.MeshLambertMaterial({color}));
const cylinderBetween = (mesh:THREE.Mesh, a:THREE.Vector3, b:THREE.Vector3) => {
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());
  mesh.scale.y=a.distanceTo(b);
};
function radialMap(halo:boolean) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const g=canvas.getContext('2d')!,r=g.createRadialGradient(64,64,0,64,64,64);
  r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(halo?.14:.87,halo?'rgba(255,255,255,.45)':'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(canvas);
}
function planningTable() {
  const root=new THREE.Group(),wood=material('#805d49'),trim=material('#d3b476');
  const top=new THREE.Mesh(new THREE.BoxGeometry(3.2,.16,1.9),wood);top.position.y=1.18;top.castShadow=top.receiveShadow=true;root.add(top);
  for(const x of [-1.32,1.32]) for(const z of [-.67,.67]) {const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.11,1.15,8),wood);leg.position.set(x,.57,z);leg.castShadow=true;root.add(leg);}
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=640;const g=canvas.getContext('2d')!;
  const grad=g.createLinearGradient(0,0,1024,640);grad.addColorStop(0,'#e9d5a8');grad.addColorStop(1,'#b79b72');g.fillStyle=grad;g.fillRect(0,0,1024,640);
  g.fillStyle='#5c99a0';g.beginPath();g.moveTo(440,0);g.bezierCurveTo(580,120,365,270,530,390);g.bezierCurveTo(650,470,530,560,620,640);g.lineTo(770,640);g.bezierCurveTo(670,500,780,440,620,335);g.bezierCurveTo(510,210,700,90,595,0);g.closePath();g.fill();
  g.strokeStyle='#826f50';g.lineWidth=5;for(let i=0;i<3;i++){g.beginPath();g.moveTo(100,170+i*65);g.bezierCurveTo(170,100+i*65,250,120+i*65,325,90+i*65);g.stroke();}
  g.strokeStyle='#f1d29e';g.lineWidth=12;for(const y of [250,300]){g.beginPath();g.moveTo(445,y);g.lineTo(600,y+15);g.stroke();}
  for(const p of [[220,450],[760,190],[730,480]]){g.fillStyle='#944e4d';g.beginPath();g.arc(p[0],p[1],14,0,Math.PI*2);g.fill();}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const paper=new THREE.Mesh(new THREE.PlaneGeometry(2.85,1.62),twoTone(new THREE.MeshLambertMaterial({map})));paper.rotation.x=-Math.PI/2;paper.position.y=1.27;paper.receiveShadow=true;root.add(paper);
  for(const x of [-1.48,1.48]){const roll=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,1.68,10),trim);roll.rotation.x=Math.PI/2;roll.position.set(x,1.29,0);root.add(roll);}
  root.position.set(-.8,0,4.8);root.rotation.y=-.12;return root;
}

class ProductionWorld {
  root=new THREE.Group();environment=new HellespontEnvironment();
  king=new PersianActor('king');guards=Array.from({length:5},(_,i)=>new PersianActor('soldier',i));
  engineers=Array.from({length:3},(_,i)=>new PersianActor('engineer',i));herald=new PersianActor('herald');
  army=Array.from({length:42},(_,i)=>new PersianActor('soldier',i%4));
  cuffs=makeCuffs();boat=makeRoyalBoat();table=planningTable();
  whips=Array.from({length:2},()=>new THREE.InstancedMesh(new THREE.TorusGeometry(.055,.017,5,12),twoTone(new THREE.MeshPhongMaterial({color:'#899ca8',specular:'#eadcc2',shininess:45})),36));
  workingRopes=Array.from({length:3},()=>new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1,7),material('#bd9c68')));
  brand=new THREE.Mesh(new THREE.CylinderGeometry(.034,.034,1,8),material('#637887'));
  hotTip=new THREE.Mesh(new THREE.BoxGeometry(.13,.07,.24),new THREE.MeshBasicMaterial({color:new THREE.Color(4.5,1.5,.22)}));
  droplets=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshBasicMaterial({color:'#e1f8f1',transparent:true,opacity:.85,depthWrite:false}),30);
  steam=new THREE.Group();ripples=new THREE.Group();
  sun=new THREE.DirectionalLight('#ffe0ae',3);hemi=new THREE.HemisphereLight('#b7dbe6','#746b81',.65);fill=new THREE.DirectionalLight('#94c9e9',.35);
  pavilionSpot=new THREE.SpotLight('#ffcf8b',32,19,.58,.85,1.5);
  practicals=[new THREE.PointLight('#ff9d50',8,7,1.8),new THREE.PointLight('#ffb775',7,7,1.8)];
  sky:THREE.Mesh;skyMaterial:THREE.ShaderMaterial;clouds=new THREE.Group();sunDisc:THREE.Sprite;sunHalo:THREE.Sprite;
  fog=new THREE.Fog('#b6cad0',55,310);
  dummy=new THREE.Object3D();
  constructor() {
    this.root.add(this.environment.root,this.king,...this.guards,...this.engineers,this.herald,...this.army,this.cuffs,this.boat,this.table,this.sun,this.sun.target,this.hemi,this.fill,this.fill.target,this.pavilionSpot,this.pavilionSpot.target,...this.practicals,...this.whips,...this.workingRopes,this.brand,this.hotTip,this.droplets,this.ripples,this.steam);
    this.droplets.layers.set(NOINK);this.hotTip.layers.set(NOINK);this.whips.forEach(w=>w.layers.set(NOINK));
    for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.65,.012,4,48),new THREE.MeshBasicMaterial({color:'#b6ddd7',transparent:true,opacity:.5,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.layers.set(NOINK);this.ripples.add(ring);}
    for(let i=0;i<8;i++){const puff=new THREE.Sprite(new THREE.SpriteMaterial({map:radialMap(true),color:'#d9f1e7',transparent:true,opacity:.15,depthWrite:false}));puff.layers.set(NOINK);this.steam.add(puff);}
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.radius=3;
    this.pavilionSpot.position.set(-2.6,6.3,4.5);this.pavilionSpot.target.position.set(0,1.2,1.5);this.pavilionSpot.castShadow=false;
    this.practicals[0].position.set(-4.7,2.3,1);this.practicals[1].position.set(4.7,2.3,1);
    this.skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new THREE.Color()},mid:{value:new THREE.Color()},horizon:{value:new THREE.Color()}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform vec3 top,mid,horizon;void main(){float h=max(0.,normalize(p).y);vec3 c=mix(horizon,mid,smoothstep(0.,.14,h));c=mix(c,top,smoothstep(.12,.48,h));gl_FragColor=vec4(c,1.);}'});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(900,32,20),this.skyMaterial);this.sky.layers.set(NOINK);this.sky.renderOrder=-10;this.root.add(this.sky);
    for(let i=0;i<12;i++){const map=cloudHD(i%4,LOOK.day.cloud);const cloud=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,fog:true,color:'#fff1da'}));cloud.position.set(-220+i*42,28+i%3*9,-165-i%4*42);cloud.scale.set(55+i%3*12,15+i%3*4,1);cloud.layers.set(NOINK);this.clouds.add(cloud);}this.root.add(this.clouds);
    this.sunDisc=new THREE.Sprite(new THREE.SpriteMaterial({map:radialMap(false),color:new THREE.Color(4,2.7,1.2),depthWrite:false,fog:false}));this.sunHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:radialMap(true),color:new THREE.Color(1.25,.7,.25),transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));
    this.sunDisc.layers.set(NOINK);this.sunHalo.layers.set(NOINK);this.sunDisc.scale.set(18,18,1);this.sunHalo.scale.set(180,180,1);this.root.add(this.sunDisc,this.sunHalo);
  }
  update(f:number,s:Shot,camera:THREE.PerspectiveCamera,scene:THREE.Scene) {
    const ca=camAt(s,f),u=(f-s.a)/(s.b-s.a),golden=s.light==='golden',storm=!!s.storm,pavilion=s.mode==='tent';
    camera.position.set(...ca.pos);camera.up.copy(up);camera.lookAt(...ca.look);camera.rotateZ(ca.roll);camera.fov=ca.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const light=CINEMATIC_LIGHTS[storm?'storm':pavilion?'pavilion':golden?'golden':'coast'],look=LOOK[s.light];
    this.skyMaterial.uniforms.top.value.copy(untone(light.top));this.skyMaterial.uniforms.mid.value.copy(untone(golden?'#e6a3a0':storm?'#506c80':'#629dc8'));this.skyMaterial.uniforms.horizon.value.copy(untone(light.hor));this.sky.position.copy(camera.position);
    this.fog.color.copy(untone(light.fog));this.fog.near=light.fogNear;this.fog.far=light.fogFar;scene.fog=this.fog;
    TONE.uLitCol.value.set(...light.lit);TONE.uShadeCol.value.set(...light.shade);TONE.uShadeLift.value.set(...light.lift);TONE.uLambert.value=light.lambert;TONE.uSideK.value=light.sideK;TONE.uTerm.value=light.term;TONE.uBounce.value.set(...look.bounce);TONE.uSat.value=look.sat;
    CHAR.uCharTint.value.set(...light.charTint);CHAR.uCharShade.value=light.charShade;CHAR.uGrad.value=light.charGrad;CHAR.uBodyGrad.value=light.bodyGrad;CHAR.uSideTint.value.set(...light.sideTint);
    LOCAL.uLocalPos.value.set(-.5,2.6,2);LOCAL.uLocalColor.value.set('#ffc17d');LOCAL.uLocalStrength.value=pavilion?1.05:0;LOCAL.uLocalRadius.value=6.2;
    // The lighting direction is derived from the START of the shot and stays fixed while its camera glides.
    const forward=V(...s.look).sub(V(...s.pos)).setY(0).normalize(),right=forward.clone().cross(up).normalize();
    const az=THREE.MathUtils.degToRad(s.sunAz??light.az),el=THREE.MathUtils.degToRad(s.sunEl??light.el);
    const direction=forward.clone().multiplyScalar(Math.cos(az)*Math.cos(el)).addScaledVector(right,Math.sin(az)*Math.cos(el)).addScaledVector(up,Math.sin(el));
    this.sun.position.copy(V(...s.look).addScaledVector(direction,95));this.sun.target.position.set(...s.look);this.sun.color.set(light.sunCol);
    const lightning=storm&&((f-s.a===58)||(f-s.a===59)||(f-s.a===93));this.sun.intensity=light.sunI*(lightning?2.4:1);this.hemi.color.set(light.sky);this.hemi.groundColor.set(light.ground);this.hemi.intensity=light.hemiI;
    this.sun.shadow.bias=light.bias;this.sun.shadow.normalBias=light.normalBias;
    const shadowExtent=s.mode==='fleet'?48:13;Object.assign(this.sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent,near:1,far:190});this.sun.shadow.camera.updateProjectionMatrix();
    this.fill.position.copy(V(...s.look).addScaledVector(right,-25).addScaledVector(forward,-15).addScaledVector(up,15));this.fill.target.position.set(...s.look);this.fill.intensity=pavilion?.45:.25;
    this.pavilionSpot.visible=pavilion;this.practicals.forEach(p=>p.visible=pavilion);this.clouds.visible=!storm;
    this.clouds.children.forEach((o,i)=>{o.position.x=-220+i*42+f*.004;});
    this.sunDisc.visible=this.sunHalo.visible=golden;const sunPosition=V(...s.look).addScaledVector(forward,350).addScaledVector(right,88).addScaledVector(up,55);this.sunDisc.position.copy(sunPosition);this.sunHalo.position.copy(sunPosition);
    this.environment.update(f,s.mode,storm,(s.id===4||s.id===15)?smooth((u-.12)/.64):0,golden);
    const actors=[this.king,...this.guards,...this.engineers,this.herald,...this.army];actors.forEach(a=>{a.visible=false;a.scale.setScalar(1);});
    this.cuffs.visible=this.boat.visible=this.brand.visible=this.hotTip.visible=this.droplets.visible=this.ripples.visible=this.steam.visible=false;
    this.whips.forEach(w=>w.visible=false);this.workingRopes.forEach(w=>w.visible=false);this.table.visible=pavilion&&s.id!==11;
    const place=(a:PersianActor,x:number,y:number,z:number,action:PersianAction='idle',phase=0,progress=u)=>{a.visible=true;a.position.set(x,y,z);a.pose(f+phase,action,camera,progress);};
    if(s.id===1){place(this.king,-.55,0,2,u<.24?'smug':'point');place(this.guards[0],.55,-.45,-1.15,'whip');this.cuffs.visible=true;this.cuffs.position.set(.25,.1,-1.8);this.cuffs.scale.setScalar(.7);this.cuffs.rotation.set(-.4,.15,-.18);}
    if(s.id===2){place(this.king,.2,0,2,u<.45?'point':'smug');place(this.engineers[0],-1.7,0,1.5,'brace');place(this.guards[0],1.7,0,-1,'idle',13);}
    if(s.id===3){for(let i=0;i<3;i++)place(this.engineers[i],(i-1)*3,1.3,-4.2,'pull',i*11);}
    if(s.id===5)place(this.king,0,0,2,u<.28?'recoil':u<.65?'angry':'dismiss');
    if(s.id===6){place(this.guards[0],-.8,0,.5,'whip');place(this.guards[1],1.25,0,.4,'whip',21);}
    if(s.id===7)place(this.guards[0],0,0,.25,'brand');
    if(s.id===8){place(this.guards[2],-.65,0,.7,'throw');this.cuffs.visible=true;const start=this.guards[2].getHand('right');const end=V(0,-1.45,-3.1);const t=smooth((u-.22)/.6);this.cuffs.position.copy(start).lerp(end,t);this.cuffs.position.y+=Math.sin(t*Math.PI)*1.2;this.cuffs.scale.setScalar(.66);this.cuffs.rotation.set(.2+t*1.6,.2,t*.6);}
    if(s.id===9){place(this.herald,0,0,1,'read');place(this.guards[0],-2.35,0,-.25,'brace',9);place(this.king,1.9,0,-1,u<.65?'smug':'dismiss',3);}
    if(s.id===10){this.ripples.visible=true;this.ripples.position.set(0,-.48,-3);this.ripples.children.forEach((o,i)=>{const q=(u+i*.3)%1;o.scale.setScalar(.6+q*2);(o as THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial>).material.opacity=(1-q)*.44;});}
    if(s.id===11){place(this.king,2.7,0,.4,'dismiss');for(let i=0;i<3;i++)place(this.engineers[i],-1.9+i*1.65,0,2.7,u<.35?'worried':'recoil',i*11);place(this.guards[0],-3.5,0,.3,'brace');}
    if(s.id===12){for(let i=0;i<3;i++)place(this.engineers[i],(i-1)*3.2,1.3,-4.3,'pull',i*13);for(let i=0;i<8;i++)place(this.army[i],-15+i*4+u*2.4,1.3,-5.3,'walk',i*3);}
    if(s.id===13)place(this.engineers[1],0,1.3,-4.2,'pull');
    if(s.id===14){for(let i=0;i<this.army.length;i++){const row=Math.floor(i/3),col=i%3;const x=(row-6.5)*3.2+u*5.95;place(this.army[i],x,1.3,-6.6+col*1.3,'walk',row*2);}}
    if(s.id===16){this.boat.visible=true;this.boat.position.set(-u*.8,-.32+Math.sin(f*.09)*.065,-4-u*.55);this.boat.rotation.set(Math.sin(f*.07)*.017,1.15,Math.sin(f*.09+.8)*.015);this.boat.scale.set(.65,.7,.4);this.boat.userData.animateOars?.(f);
      const kp=V(0,.27,.85).applyAxisAngle(up,1.15).add(this.boat.position),gp=V(0,.27,-.85).applyAxisAngle(up,1.15).add(this.boat.position);place(this.king,kp.x,kp.y,kp.z,'sit');place(this.guards[0],gp.x,gp.y,gp.z,'row');this.king.scale.setScalar(.85);this.guards[0].scale.setScalar(.78);
    }
    if(s.id===3||s.id===12||s.id===13){for(let i=0;i<3;i++){const actor=this.engineers[i];if(!actor.visible)continue;const hand=actor.getHand('right'),anchor=V(hand.x+2.3,1.5,-2.6);this.workingRopes[i].visible=true;cylinderBetween(this.workingRopes[i],hand,anchor);}}
    let splash:THREE.Vector3|null=null;
    if(s.id===1||s.id===6){for(let j=0;j<(s.id===1?1:2);j++){
      const actor=this.guards[j],phase=((f+(j===1?21:0))%48+48)%48,hand=actor.getHand('right');
      const cameraRight=V(1,0,0).applyQuaternion(camera.quaternion).setY(0).normalize();
      const high=hand.clone().addScaledVector(cameraRight,.8).add(V(0,1.1,-.25)),low=actor.position.clone().addScaledVector(cameraRight,1.18);low.y=-.48;low.z=-1.6;
      const strike=smooth((phase-19)/5)*(1-smooth((phase-35)/12));const end=high.clone().lerp(low,strike);
      const control=hand.clone().add(end).multiplyScalar(.5).addScaledVector(cameraRight,.25);control.y+=phase<20?.65:-.2;
      const curve=new THREE.QuadraticBezierCurve3(hand,control,end),links=this.whips[j];links.visible=true;
      for(let k=0;k<36;k++){const t=k/35;this.dummy.position.copy(curve.getPoint(t));this.dummy.quaternion.setFromUnitVectors(up,curve.getTangent(t));this.dummy.rotateY(k%2*Math.PI/2);this.dummy.scale.setScalar(1);this.dummy.updateMatrix();links.setMatrixAt(k,this.dummy.matrix);}links.instanceMatrix.needsUpdate=true;links.computeBoundingSphere();
      if(phase>=24&&phase<=33)splash=low;
    }}
    if(s.id===7){const hand=this.guards[0].getHand('right');const side=V(1,0,0).applyQuaternion(camera.quaternion).setY(0).normalize();const end=this.guards[0].position.clone().addScaledVector(side,.95);end.y=-.43;end.z=-1.5;this.brand.visible=this.hotTip.visible=true;cylinderBetween(this.brand,hand,end);this.hotTip.position.copy(end);this.hotTip.rotation.y=.4;this.steam.visible=true;
      this.steam.children.forEach((o,i)=>{const q=((f+i*11)%67)/67;o.position.copy(end).add(V(Math.sin(i*2.4+q*3)*.15,q*1.5,Math.cos(i*2)*.12));o.scale.setScalar(.12+q*.35);(o as THREE.Sprite).material.opacity=(1-q)*.24;});splash=end;
    }
    if(s.id===8&&u>.66&&u<.9)splash=V(0,-.48,-3.1);
    if(splash){this.droplets.visible=true;const q=((f%12)+1)/13;for(let k=0;k<30;k++){const angle=k*2.4,r=.12+.62*q;this.dummy.position.copy(splash).add(V(Math.cos(angle)*r,Math.sin(q*Math.PI)*(.2+k%5*.085),Math.sin(angle)*r*.6));this.dummy.scale.set(.017,.035+(1-q)*.05,.017);this.dummy.quaternion.identity();this.dummy.updateMatrix();this.droplets.setMatrixAt(k,this.dummy.matrix);}this.droplets.instanceMatrix.needsUpdate=true;this.droplets.computeBoundingSphere();}
    noInkFallback(this.root);return V(...ca.look);
  }
}

const SceneContent:React.FC<{ready:()=>void}>=({ready})=>{
  const frame=useCurrentFrame(),{camera,scene,gl,advance}=useThree();
  const world=useMemo(()=>new ProductionWorld(),[]);
  const fx=useMemo(()=>({ink:new InkPass(scene,camera as THREE.PerspectiveCamera),lens:new LensBlur({maxCoC:26,nearScale:1.25}),bloom:new BloomEffect({blendFunction:BlendFunction.ADD,intensity:.48,luminanceThreshold:1.1,luminanceSmoothing:.25,mipmapBlur:true,levels:5,radius:.65}),tone:new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL}),grade:new GradeEffect(GRADES.day,1)}),[camera,scene]);
  const shot=shotAt(frame),focus=world.update(frame,shot,camera as THREE.PerspectiveCamera,scene);
  fx.lens.focus=Math.max(.3,focus.sub(camera.position).dot(camera.getWorldDirection(V())));fx.lens.cInf=shot.dof;gradeFor(fx.grade,shot.light);
  useEffect(()=>{let second=0;const first=requestAnimationFrame(()=>{advance(performance.now());second=requestAnimationFrame(()=>{advance(performance.now());gl.getContext().finish();ready();});});return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};},[advance,gl,ready]);
  return <><primitive object={world.root}/><EffectComposer multisampling={4}><primitive object={fx.ink} dispose={null}/><primitive object={fx.lens.pre} dispose={null}/><primitive object={fx.lens.main} dispose={null}/><primitive object={fx.bloom} dispose={null}/><primitive object={fx.tone} dispose={null}/><primitive object={fx.grade} dispose={null}/></EffectComposer></>;
};
export const XerxesOcean:React.FC=()=>{
  const [hold]=useState(()=>delayRender('Xerxes scene and postprocessing initial draw'));
  const ready=useMemo(()=>()=>continueRender(hold),[hold]);
  const dpr=(getInputProps() as {post?:{dpr?:number}}).post?.dpr??1;
  return <AbsoluteFill style={{background:'#b6cad0'}}><ThreeCanvas width={1080} height={1920} dpr={dpr} shadows gl={{antialias:false,stencil:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.shadowMap.type=THREE.PCFSoftShadowMap;}} camera={{fov:42,near:.15,far:1200}}><SceneContent ready={ready}/></ThreeCanvas></AbsoluteFill>;
};
