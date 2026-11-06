import React, {useMemo,useState,useEffect} from 'react';
import * as T from 'three';
import {AbsoluteFill,useCurrentFrame,delayRender,continueRender} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {EffectComposer} from '@react-three/postprocessing';
import {ToneMappingEffect,ToneMappingMode,BloomEffect} from 'postprocessing';
import {InkPass,NOINK} from './ink';
import {LensBlur} from './lensblur';
import {GradeEffect,GRADES} from './grade';
import {storyTime,cameraAt} from './story';
const ink='#2b2034';
const maps=new Map<string,T.CanvasTexture>();
function surface(c:string,style='stone'){
 const key=c+style;if(maps.has(key))return maps.get(key)!;
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const p=canvas.getContext('2d')!;
 let seed=35;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 p.fillStyle=c;p.fillRect(0,0,1024,1024);
 if(style==='masonry'){
 p.fillStyle='#706657';p.fillRect(0,0,1024,1024);
 for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
 const x=col*256+(row%2)*128,y=row*128;p.fillStyle=c;p.fillRect(x+4,y+4,248,120);
 p.fillStyle=`rgba(255,238,198,${rand()*.12})`;p.fillRect(x+4,y+4,248,120);
 p.fillStyle='rgba(255,238,198,.2)';p.fillRect(x+5,y+5,246,5);
 p.fillStyle='rgba(40,30,35,.12)';p.fillRect(x+5,y+118,246,6);
 }}
 for(let i=0;i<1800;i++){const x=rand()*1024,y=rand()*1024;p.fillStyle=i%2?'rgba(45,30,30,.035)':'rgba(255,241,201,.05)';p.fillRect(x,y,rand()*22+1,rand()*10+1)}
 if(style==='wood')for(let i=0;i<52;i++){
 const x=rand()*1024;p.strokeStyle=i%3?'rgba(55,29,17,.18)':'rgba(255,226,166,.20)';p.lineWidth=1+rand()*3;
 p.beginPath();p.moveTo(x,0);p.bezierCurveTo(x+25,300,x-30,700,x+10,1024);p.stroke();}
 if(style==='fabric'){
 for(let i=0;i<1024;i+=6){p.fillStyle='rgba(255,215,150,.04)';p.fillRect(i,0,1,1024)}
 p.strokeStyle='#c4a267';p.lineWidth=10;p.strokeRect(34,30,956,964);p.lineWidth=3;p.strokeRect(53,48,918,928);
 for(let y=180;y<900;y+=200)for(let x=180;x<900;x+=220){p.beginPath();p.moveTo(x,y-45);p.lineTo(x+35,y);p.lineTo(x,y+45);p.lineTo(x-35,y);p.closePath();p.stroke();p.beginPath();p.arc(x,y,10,0,7);p.stroke();}
 }
 if(style==='water'){
 for(let i=0;i<130;i++){p.strokeStyle=i%3?'rgba(211,178,102,.3)':'rgba(38,40,30,.5)';p.lineWidth=2+rand()*3;p.beginPath();p.ellipse(rand()*1024,rand()*1024,12+rand()*45,3+rand()*10,0,0,Math.PI);p.stroke();}
 }
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;maps.set(key,t);return t;
}

function texture(kind:string,color:string,shock:boolean,variant=0,phase=0){
 const gesture=Math.sin(phase*.19+variant)*75;
 const climb=Math.sin(phase*.3)*65;
 const c=document.createElement('canvas');c.width=600;c.height=1000;const p=c.getContext('2d')!;
 p.lineJoin='round';p.lineCap='round';
 const path=(pts:number[][],fill?:string,w=12)=>{p.beginPath();pts.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));if(fill){p.closePath();p.fillStyle=fill;p.fill();}p.strokeStyle=ink;p.lineWidth=w;p.stroke();};
 const ellipse=(x:number,y:number,rx:number,ry:number,col:string,w=10)=>{p.beginPath();p.ellipse(x,y,rx,ry,0,0,Math.PI*2);p.fillStyle=col;p.fill();p.strokeStyle=ink;p.lineWidth=w;p.stroke();};
 // Adult silhouettes, long ink limbs, original period-inspired costumes.
 if(kind==='king'){path([[268,687],[145,735],[145,920],[110,935]],undefined,18);path([[330,687],[455,735],[455,920],[490,935]],undefined,18);}else if(kind==='rescuer'){path([[268,687],[210,765+climb],[205,850+climb],[170,850+climb]],undefined,15);path([[330,687],[365,830-climb],[365,930-climb],[400,930-climb]],undefined,15);}
 else{path([[268,687],[250,938],[212,950]],undefined,15);path([[330,687],[350,938],[385,950]],undefined,15);}
 if(kind==='king'||variant%3===1)path([[240,380],[182,750],[408,750],[370,385]],kind==='king'?'#a12c45':variant%2?'#475e71':'#92704d');
 const g=p.createLinearGradient(200,0,400,0);g.addColorStop(0,color);g.addColorStop(1,'#535375');
 p.beginPath();p.moveTo(250,385);p.bezierCurveTo(190,420,180,600,220,700);p.quadraticCurveTo(300,758,375,690);p.bezierCurveTo(410,580,375,430,345,385);p.closePath();p.fillStyle=g;p.fill();p.strokeStyle=ink;p.lineWidth=12;p.stroke();
 if(kind==='rescuer'){path([[210,440],[140,360+climb],[135,250+climb]],undefined,14);path([[380,440],[455,400-climb],[465,300-climb]],undefined,14);ellipse(135,250+climb,13,13,ink,1);ellipse(465,300-climb,13,13,ink,1);}
 else if(kind==='king'&&!shock){
 path([[210,440],[190,540],[130,540]],undefined,14);path([[380,440],[405,500+gesture*.4],[470,440+gesture*.6]],undefined,14);
 ellipse(130,540,13,13,ink,1);ellipse(470,440+gesture*.6,13,13,ink,1);
 }else{
 path([[210,440],[shock?140:180,shock?350+gesture:590+gesture],[shock?100:190,shock?250+gesture:640+gesture]],undefined,14);
 path([[380,440],[shock?460:420,shock?350-gesture:530-gesture],[shock?495:450,shock?265-gesture:490-gesture]],undefined,14);
 ellipse(shock?100:190,shock?250+gesture:640+gesture,12,12,ink,1);ellipse(shock?495:450,shock?265-gesture:490-gesture,12,12,ink,1);
 }
 path([[214,620],[385,620]],undefined,18);ellipse(300,620,17,18,'#e6bb59',5);
 if(kind==='king'||variant%3===1){path([[217,435],[270,478],[338,480],[380,435]],undefined,27);path([[217,435],[270,478],[338,480],[380,435]],'#ddccb2',14);}
 if(variant%3===2){path([[290,435],[290,605]],undefined,5);for(let y=460;y<590;y+=35)ellipse(306,y,5,5,'#ddb65e',1);}
 p.save();p.translate(300,350);p.rotate(Math.sin(phase*.055+variant)*.035);p.translate(-300,-350);
 // Bean head, tapered chin, asymmetric crown.
 p.beginPath();p.moveTo(295,180);p.bezierCurveTo(430,165,450,335,370,400);p.bezierCurveTo(300,450,185,395,181,300);p.bezierCurveTo(180,225,220,184,295,180);p.closePath();p.fillStyle=['#ffe5bf','#f2d0ae','#edc49b','#f9dfbe'][variant%4];p.fill();p.strokeStyle=ink;p.lineWidth=12;p.stroke();
 if(kind==='king'){path([[189,227],[190,150],[235,182],[285,125],[325,183],[388,148],[390,228]],'#e6b34b',9);ellipse(288,200,10,12,'#b52f42',3);}
 else if(kind==='bishop'){path([[207,235],[220,115],[290,60],[365,120],[384,235]],'#e9d8ab');path([[290,85],[290,210]],undefined,7);path([[253,165],[329,165]],undefined,7);}
 else if(kind==='noble'&&variant%6===5){path([[190,280],[210,240]],undefined,15);path([[383,240],[403,280]],undefined,15);path([[255,236],[335,236]],undefined,4);}
 else {path([[182,260],[198,197],[266,173],[372,195],[405,253]],color,10);}
 if(kind==='noble'&&variant%6===1){path([[200,330],[226,390],[300,430],[370,395],[405,328],[369,375],[304,389],[240,370]],'#938b83',5);}
 if(kind==='noble'&&variant%6===2){path([[192,264],[213,241],[235,249]],undefined,14);path([[366,249],[394,239],[410,267]],undefined,14);}
 if(kind==='noble'&&variant%6===3){path([[260,350],[300,338],[345,350]],undefined,15);}
 if(kind==='rescuer'){ellipse(298,310,108,88,'#665943',6);path([[220,340],[250,365],[350,365],[380,340]],undefined,7);}
 else if(shock){ellipse(269,300,29,36,'#fff4e7',6);ellipse(334,300,29,36,'#fff4e7',6);ellipse(273,306,8,15,ink,1);ellipse(334,306,8,15,ink,1);ellipse(304,369,22,28,'#713646',5);}
 else {const blink=(phase+variant*13)%57<4;
 if(blink){path([[247,303],[282,306]],undefined,9);path([[319,306],[352,303]],undefined,9);}else{ellipse(266,305,13,19,ink,1);ellipse(337,305,13,19,ink,1);}
 const talk=kind==='bishop'||(variant%3===0&&kind!=='king');
 if(talk)ellipse(301,367,15,6+Math.abs(Math.sin(phase*.22))*14,'#713646',5);else path([[285,368],[318,365]],undefined,8);
 path([[246,279],[280,284]],undefined,6);path([[319,281],[350,273]],undefined,6);}
 p.restore();
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}
function Box({p,s,c='#b6a690',r=[0,0,0],paint='stone'}:{p:number[],s:number[],c?:string,r?:number[],paint?:string}){const map=useMemo(()=>surface(c,paint),[c,paint]);return <mesh position={p as any} rotation={r as any} castShadow receiveShadow><boxGeometry args={s as any}/><meshStandardMaterial map={map} roughness={1}/></mesh>}
function Person({x,y,z,kind='noble',color='#42868f',shock=false,tilt=0,variant=0,scale=1}:{x:number,y:number,z:number,kind?:string,color?:string,shock?:boolean,tilt?:number,variant?:number,scale?:number}){
 const frame=useCurrentFrame();const pose=kind==='rescuer'?Math.min(frame,962):frame;
 const map=useMemo(()=>texture(kind,color,shock,variant,pose),[kind,color,shock,variant,pose]);
 useEffect(()=>()=>map.dispose(),[map]);
 return <group position={[x,y,z]} rotation={[0,0,tilt+(kind==='king'?Math.sin(frame*.07)*.035:0)]} scale={scale}><mesh position={[0,1.35,0]} layers={NOINK} castShadow><planeGeometry args={[1.62,2.7]}/><meshStandardMaterial map={map} transparent alphaTest={.1} side={T.DoubleSide} roughness={1}/></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,.016,0]}><circleGeometry args={[.38,24]}/><meshBasicMaterial color='#332638' transparent opacity={.2} depthWrite={false}/></mesh></group>;
}
function Cylinder({p,r=.1,h=.2,c='#bc9a5a'}:{p:number[],r?:number,h?:number,c?:string}){return <mesh position={p as any} castShadow receiveShadow><cylinderGeometry args={[r,r*.8,h,16]}/><meshStandardMaterial color={c} roughness={.65}/></mesh>}
function Candle({x,y,z}:{x:number,y:number,z:number}){return <group position={[x,y,z]}>
 <Cylinder p={[0,0,0]} r={.16} h={.06} c='#876b3e'/><Cylinder p={[0,.16,0]} r={.055} h={.3} c='#eadbb6'/>
 <mesh position={[0,.39,0]} scale={[.045,.14,.045]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color='#fff1ac' emissive='#ffb948' emissiveIntensity={3}/></mesh>
 </group>}
function Window({x}:{x:number}){return <group position={[x,0,-3.94]}>
 <Box p={[0,3.2,0]} s={[1.85,3.45,.08]} c='#8baab0'/>
 <Box p={[0,1.52,.3]} s={[2.35,.25,.8]} c='#d3c2a3'/>
 {[-1.05,1.05].map(v=><Box key={v} p={[v,3.08,.2]} s={[.24,3.2,.48]} c='#b9a88e'/>)}
 {Array.from({length:13},(_,i)=>{let a=i*Math.PI/12;return <Box key={i} p={[Math.cos(a)*1.05,4.55+Math.sin(a)*1.05,.25]} s={[.3,.43,.5]} r={[0,0,a-Math.PI/2]} c={i%2?'#c2b094':'#d2bfa0'}/>})}
 <Box p={[0,3.15,.13]} s={[.09,3.1,.1]} c='#6e7773'/>
 {[2,2.7,3.4,4.1,4.65].map(y=><Box key={y} p={[0,y,.12]} s={[1.8,.035,.05]} c='#687b79'/>)}
 {[-.55,.55].map(v=><Box key={v} p={[v,3.1,.12]} s={[.035,3,.05]} c='#687b79'/>)}
 </group>}
function Sconce({x,y,z}:{x:number,y:number,z:number}){return <group position={[x,y,z]}>
 <Box p={[0,0,0]} s={[.18,.5,.12]} c='#53515c'/><Box p={[0,-.12,.2]} s={[.08,.1,.5]} c='#53515c'/>
 <Candle x={-.13} y={0} z={.43}/><Candle x={.13} y={0} z={.43}/><pointLight position={[0,.5,.6]} color='#ffbc6b' intensity={4} distance={4} decay={2}/>
 </group>}
function Furnishings({foreground=false}:{foreground?:boolean}){return <group position={foreground?[-.8,0,4]:[-1.65,0,-1.2]}>
 <Box p={[0,1.02,0]} s={[3.8,.18,1.2]} c='#a2744e' paint='wood'/>
 {[-1.4,1.4].map(x=><group key={x}><Box p={[x,.5,0]} s={[.15,1,.75]} c='#825f46' paint='wood'/><Box p={[x,.08,0]} s={[.6,.14,1.05]} c='#825f46' paint='wood'/></group>)}
 <Box p={[0,.3,0]} s={[3.2,.14,.14]} c='#856246' paint='wood'/>
 <Box p={[.2,1.125,0]} s={[1.2,.012,.85]} c='#3d6268' paint='fabric'/>
 {[-1.15,.65,1.3].map((x,i)=><group key={x}><Box p={[x,1.145,.1]} s={[.55,.014,.4]} c='#e6d8b2' r={[0,i*.3,0]}/><Cylinder p={[x+.12,1.165,.18]} r={.05} h={.025} c='#a73b45'/></group>)}
 {[-.6,1.6].map(x=><group key={x}><Cylinder p={[x,1.15,-.25]} r={.11} h={.04}/><Cylinder p={[x,1.28,-.25]} r={.035} h={.24}/><mesh position={[x,1.43,-.25]}><sphereGeometry args={[.13,16,12,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color='#bc9a5a' side={T.DoubleSide} roughness={.45}/></mesh></group>)}
 <Candle x={-.1} y={1.14} z={-.22}/>
 <Box p={[-.6,.48,1.1]} s={[2.4,.14,.45]} c='#896245' paint='wood'/>
 {[-1.5,.3].map(x=><Box key={x} p={[x,.23,1.1]} s={[.13,.45,.4]} c='#896245' paint='wood'/>)}
 </group>}
function Ripples({x,z,r=1}:{x:number,z:number,r?:number}){const f=useCurrentFrame();return <group position={[x,-5.32,z]} rotation={[-Math.PI/2,0,0]}>
 {[.45,.8,1.15].map((n,i)=><mesh key={i} scale={[r, r*.65,1]}><torusGeometry args={[n+((f*.022+i*.3)%1)*.55,.012,6,48]}/><meshBasicMaterial color={i%2?'#b2a176':'#4c4634'} transparent opacity={.55*(1-((f*.022+i*.3)%1))}/></mesh>)}
 </group>}
function Hall({broken=false,drop=0,hook=false,interior=false}:{broken?:boolean,drop?:number,hook?:boolean,interior?:boolean}){
 const floor=[];for(let i=0;i<22;i++){const x=-4.7+i*.44;
 if(broken){if(x>=2||i%2)continue;floor.push(<Box key={i} p={[x,-Math.min(5.15,drop*(1.1+(i%5)*.12)),-2.8+(i*1.7)%6]} s={[.425,.16,1.5+(i%3)*.55]} c={['#b68b5b','#c29a69','#ae8054'][i%3]} paint='wood' r={[drop*.25*((i%3)-1)*(1-drop/5),i*.17,drop*.2*((i%5)-2)*(1-drop/5)]}/>);}
 else floor.push(<Box key={i} p={[x,0,interior?8:0]} s={[.425,.22,interior?24:7.5]} c={['#b68b5b','#c29a69','#ae8054'][i%3]} paint='wood'/>);
 }
 return <>
 <Box p={[0,-5.9,0]} s={[12,.6,10]} c='#655b50' paint='masonry'/>
 <Box p={[0,-5.45,0]} s={[10,.16,8]} c='#645934' paint='water'/>
 <Box p={[0,-2.75,-4.4]} s={[11,5.5,.8]} c='#736e67' paint='masonry'/>
 <Box p={[-5.1,-2.75,-.4]} s={[.7,5.5,8]} c='#736e67' paint='masonry'/>
 {/* Grounded masonry piers and damp ledges enclose the lower chamber. */}
 {[-4.5,-1.5,1.5,4.5].map(x=><group key={x}><Box p={[x,-2.7,-3.85]} s={[.5,5.5,.6]} c='#8a8071'/><Box p={[x,-.2,-3.75]} s={[.75,.3,.85]} c='#a2947b'/></group>)}
 <Box p={[0,-4.5,-3.95]} s={[10,.3,.22]} c='#5a6050'/>
 {hook&&<><Box p={[-2,-5.26,2.4]} s={[.3,.12,1.35]} c='#a08053' paint='wood' r={[0,-.6,.05]}/><Box p={[.7,-5.28,2.9]} s={[.22,.1,.9]} c='#b49362' paint='wood' r={[0,.8,0]}/><Box p={[-2.7,-5.25,-1]} s={[.19,.15,1.6]} c='#8f714e' paint='wood' r={[0,.3,0]}/></>}
 <Ripples x={-.9} z={1}/><Ripples x={1.3} z={-.5} r={.75}/><Ripples x={-2.5} z={-2} r={.5}/>
 {Array.from({length:16},(_,i)=><Box key={i} p={[-4+(i*1.37)%8,-5.29,-3+(i*1.73)%6]} s={[.08+(i%3)*.05,.035,.05]} c='#a09263' r={[0,i,0]}/>)}
 {!hook&&<>
 {floor}
 <Box p={[0,3.05,-4.4]} s={[11,6.1,.8]} c='#b5a58b' paint='masonry'/>
 <Box p={[-5.1,3.05,interior?8:-.4]} s={[.7,6.1,interior?24:8]} c='#a3937d' paint='masonry'/>
 {[-3,0,3].map(x=><Window key={x} x={x}/>)}
 {[-4.5,-1.5,1.5,4.5].map(x=><group key={x}><Box p={[x,3,-3.85]} s={[.42,6,.6]} c='#c1b093'/><Box p={[x,.22,-3.7]} s={[.75,.45,.9]} c='#c1b093'/><Box p={[x,5.6,-3.7]} s={[.8,.3,.9]} c='#ccba9b'/></group>)}
 <Box p={[0,5.9,-3.8]} s={[10.5,.32,.75]} c='#866449' paint='wood'/>
 {interior&&<mesh position={[0,6.15,5]} receiveShadow><boxGeometry args={[10.5,.16,22]}/><meshStandardMaterial map={surface('#715643','wood')}/></mesh>}
 {(interior?[-3,.1,3,6,9,12]:[-3,.1,3]).map(z=><group key={z}><Box p={[0,5.8,z]} s={[10,.34,.32]} c='#73523f' paint='wood'/><Box p={[-3.8,5.2,z]} s={[2.3,.22,.25]} r={[0,0,.6]} c='#8b674a' paint='wood'/><Box p={[3.8,5.2,z]} s={[2.3,.22,.25]} r={[0,0,-.6]} c='#8b674a' paint='wood'/></group>)}
 {[-1.5,1.5].map((x,i)=><group key={x}><Box p={[x,3.5,-3.43]} s={[.93,2.65,.05]} c={i?'#315a65':'#813749'} paint='fabric'/><Box p={[x,4.9,-3.4]} s={[1.2,.08,.12]} c='#c5a16a'/><Sconce x={x} y={1.85} z={-3.1}/></group>)}
 <Box p={[3.3,0,-1.9]} s={[2.5,.55,3]} c='#c6b99e'/><Box p={[3.8,-2.85,-2.5]} s={[1.45,5.3,2.6]} c='#a99d89' paint='masonry'/>
 <Box p={[3.3,.29,-1.9]} s={[1.95,.018,2.55]} c='#733344' paint='fabric'/>
 {!broken&&<Furnishings foreground={interior}/>}
 </>}
 {broken&&Array.from({length:10},(_,i)=><Box key={i} p={[-3.5+i*.7,-5.12,-1.5+(i%3)]} s={[.2,.15,1.3]} c='#b48a5e' paint='wood' r={[.1,i,.2]}/>)}
 </>;
}
// A stylized royal chair: its exact design is artistic reconstruction.
function RoyalChair(){return <group position={[3.2,0,-1.8]}>
 <Box p={[0,1.02,0]} s={[1.4,.2,1.05]} c='#9c663f'/>
 <Box p={[0,1.15,0]} s={[1.18,.12,.85]} c='#9e314e'/>
 <Box p={[0,1.93,-.48]} s={[1.36,1.9,.2]} c='#925d39'/>
 <Box p={[0,1.96,-.34]} s={[1.08,1.62,.08]} c='#9d3451'/>
 <Box p={[0,2.94,-.46]} s={[1.6,.16,.3]} c='#d0a359'/>
 <Box p={[0,3.08,-.46]} s={[.6,.15,.24]} c='#d0a359'/>
 {[-.64,.64].map(x=><group key={x}>
 <Box p={[x,1.56,-.47]} s={[.16,2.56,.26]} c='#b58044'/>
 <Box p={[x,.9,.43]} s={[.16,1.25,.18]} c='#9c663f'/>
 <Box p={[x,1.53,.02]} s={[.22,.14,1.17]} c='#c29453'/>
 <mesh position={[x,2.98,-.46]} castShadow><sphereGeometry args={[.13,12,8]}/><meshStandardMaterial color='#e1b861' roughness={.65}/></mesh>
 </group>)}
 <Box p={[0,.38,.7]} s={[1.15,.18,.45]} c='#ae8457'/>
 </group>}
function Ladder(){return <group position={[3,-2.7,-.4]} rotation={[-.2,0,0]}><Box p={[-.4,0,0]} s={[.12,5.8,.12]} c='#cfaa6e'/><Box p={[.4,0,0]} s={[.12,5.8,.12]} c='#cfaa6e'/>{Array.from({length:13},(_,i)=><Box key={i} p={[0,-2.7+i*.43,0]} s={[.86,.09,.1]} c='#cfaa6e'/>)}</group>}

function Splash({t,hook}:{t:number,hook:boolean}){
 const age=hook?(t%2.3):t-32.2;const active=hook||age>=0&&age<3;
 if(!active)return null;
 return <group>{Array.from({length:16},(_,i)=>{const a=i*2.399;const u=(age+i*.035)%1.25;const radius=.2+u*1.3;return <mesh key={i} position={[-.8+Math.cos(a)*radius,-5.28+Math.max(0,2.6*u-2.2*u*u),.8+Math.sin(a)*radius]} scale={[.035,.07,.035]}><sphereGeometry args={[1,6,4]}/><meshStandardMaterial color={i%2?'#9e8c52':'#75633b'}/></mesh>})}</group>;
}

function Scene(){
 const f=useCurrentFrame(),t=storyTime(f/30);const {camera,scene,gl,advance}=useThree();
 const hook=t<8, meeting=t>=8&&t<19, cutaway=t>=19&&t<29, falling=t>=29&&t<40, rescue=t>=40&&t<52;
 const broken=t>=30.2;const drop=falling?Math.min(5,Math.max(0,(t-30.2)*2.8)):5;
 const shot=cameraAt(t);const target=new T.Vector3(...shot.look);
 camera.position.set(...shot.pos);camera.lookAt(target);camera.rotateZ(shot.roll);
 const kickFrame=Math.round((t-29.35)*30);if(kickFrame>=0&&kickFrame<7)camera.rotateZ((kickFrame%2?1:-1)*.012*(1-kickFrame/7));
 camera.layers.enable(NOINK);camera.updateMatrixWorld();
 scene.background=new T.Color(hook?'#343a3c':'#6d747b');scene.fog=new T.Fog(hook?'#343a3c':'#6d747b',22,65);
 const fx=useMemo(()=>({ink:new InkPass(scene,camera as T.PerspectiveCamera,{widthNear:2.8,widthFar:1.7,strength:.8,color:'#2e2830'}),lens:new LensBlur({maxCoC:20,nearScale:1.2}),tone:new ToneMappingEffect({mode:ToneMappingMode.NEUTRAL}),grade:new GradeEffect(GRADES.day,.45),bloom:new BloomEffect({intensity:.45,luminanceThreshold:1})}),[scene,camera]);
 fx.lens.focus=camera.position.distanceTo(target);fx.lens.cInf=hook||meeting||t>=52?8:0;
 const [ready]=useState(()=>delayRender('Erfurt scene and postprocessing initialization'));
 useEffect(()=>{const a=setTimeout(()=>{gl.compile(scene,camera);advance(performance.now());advance(performance.now()+16);continueRender(ready)},150);return()=>clearTimeout(a)},[ready,gl,scene,camera]);
 return <>
 <hemisphereLight args={['#d2dce8','#77718c',1.6]}/><directionalLight position={[-3,8,5]} color='#ffe2ad' intensity={2.7} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={.04} shadow-radius={3}/><directionalLight position={[5,4,-2]} color="#a8c8ef" intensity={.7}/><pointLight position={[0,-3,2]} intensity={hook?10:3} color="#e2c59c" distance={13} decay={2}/>
 <Hall broken={broken} drop={drop} hook={hook} interior={meeting}/>
 {broken&&falling&&t<33&&Array.from({length:7},(_,i)=><Box key={'splinter'+i} p={[-3+i*.8,1-drop+(i%3)*.5,1.8+(i%2)]} s={[.08,.12,.5+(i%3)*.25]} c='#b78c5c' paint='wood' r={[t+i,i,t*.5]}/>)}
 {falling&&t>33.1&&<><Person x={-.9} y={-6.9+Math.sin(t*4)*.15} z={1} shock color='#b65c49'/><Person x={.7} y={-7.1+Math.sin(t*3.7+1)*.15} z={-1.5} shock color='#457d99'/></>}
 {hook?<><Person x={-.9+Math.sin(t*1.4)*.15} y={-6.9+Math.sin(t*4)*.19} z={1} shock color='#b65c49'/><Person x={.7} y={-7.1+Math.sin(t*3.7+1)*.17} z={-1.5} shock color='#457d99'/></>:<>
 <RoyalChair/><Person x={3.2} y={.25} z={-1.6} kind='king' color='#c64355' shock={t>=28.8&&t<48}/>
 {(!broken||falling&&t<33.2)&&Array.from({length:12},(_,i)=><Person key={i} variant={i*2+Math.floor(i/4)} scale={.88+((i*3)%5)*.055} x={-3.7+(i%4)*1.25} y={broken?-Math.min(7,Math.pow(Math.max(0,t-30.2-i*.045),2)*2.4):0} z={.15+Math.floor(i/4)*1.18} color={['#407786','#a26048','#7a714e','#684d68'][(i+Math.floor(i/4))%4]} shock={t>28.7-(i%4)*.05} tilt={broken?(i%2?-.48:.48)*drop:Math.sin(t*2.6+i)*.075}/>)}
 {!broken&&<Person x={1.1} y={.1} z={-1.8} kind='bishop' color='#dacb9e'/>}
 {(rescue||t>=52)&&<Ladder/>}{(rescue||t>=52)&&<Person x={3-Math.max(0,Math.min(1,(t-50)/4))*.75} y={-5.1+Math.min(1,(t-40)/11)*4.5+(t<52?Math.sin(t*6)*.025:0)+Math.max(0,Math.min(1,(t-51)/3))*.9} z={-.05-Math.max(0,Math.min(1,(t-50)/4))*.8} color='#72735d' variant={2} scale={.8} kind='rescuer'/>}
 </>}
 <Splash t={t} hook={hook}/><EffectComposer multisampling={4}><primitive object={fx.ink}/><primitive object={fx.lens.pre}/><primitive object={fx.lens.main}/><primitive object={fx.bloom}/><primitive object={fx.tone}/><primitive object={fx.grade}/></EffectComposer>
 </>;
}
export const ErfurtV2:React.FC<{preview?:boolean}>=({preview=false})=> <AbsoluteFill style={{background:'#a8c9e1'}}><ThreeCanvas width={preview?360:1080} height={preview?640:1920} style={preview?{transform:"scale(3)",transformOrigin:"top left"}:undefined} dpr={1} shadows camera={{fov:43,near:.1,far:200}} gl={{antialias:false}}><Scene/></ThreeCanvas></AbsoluteFill>;
