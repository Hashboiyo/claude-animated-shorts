/** Original Persian cartoon cast: soft bean silhouettes, articulated acting and scene-lit cards. */
import * as THREE from 'three';
import {cardShade, CARD_K, setCardPose} from './cardshade';
import {NOINK} from './ink';

export type PersianRole='king'|'soldier'|'engineer'|'herald';
export type PersianAction='idle'|'point'|'angry'|'whip'|'brand'|'read'|'worried'|'walk'|'sit'|'brace'|'pull'|'row'|'recoil'|'throw'|'smug'|'dismiss';
type Point=[number,number];
type Expression='deadpan'|'stern'|'shout'|'nervous'|'shock'|'strain'|'grin'|'read'|'disappointed';
type Pose={head:Point;tilt:number;look:number;shoulder:Point;hip:Point;left:Point;right:Point;le:Point;re:Point;feet:[Point,Point];knees:[Point,Point];expr:Expression;seated:boolean;};
type Drawing={texture:THREE.CanvasTexture;left:Point;right:Point;};
const INK='#2a202c',HAIR='#49322e',GOLD='#ddb15c',SIZE=768;
const SKIN=['#fbf6ed','#f5eee2','#f0e4d3','#f9eee0'];
const cache=new Map<string,Drawing>();
const worldPosition=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),bufferSize=new THREE.Vector2();
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const P=(x:number,y:number):Point=>[x,y];
const kingRole=(role:PersianRole)=>role==='king';
const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1]];

/** Two-bone knees bend as planted feet pass beneath the body. */
function knee(hip:Point,foot:Point,bend=1):Point{
 const dx=foot[0]-hip[0],dy=foot[1]-hip[1],d=Math.max(1,Math.hypot(dx,dy));
 const h=Math.sqrt(Math.max(0,157*157-d*d*.25));
 return [(hip[0]+foot[0])*.5+dy/d*h*bend,(hip[1]+foot[1])*.5-dx/d*h*bend];
}
function walkFoot(t:number,offset:number):Point{
 const p=((t+offset)%1+1)%1;
 if(p<.5)return P(500+66-p*264,975);
 const q=(p-.5)*2;return P(500-66+132*ease(q),975-Math.sin(q*Math.PI)*69);
}

function poseAt(role:PersianRole,variant:number,action:PersianAction,phase:number,progress:number):Pose{
 const seated=action==='sit'||action==='row';
 const p:Pose={head:P(500,seated?440:300),tilt:0,look:0,shoulder:P(500,seated?579:441),hip:P(500,seated?827:692),left:P(365,seated?795:673),right:P(637,seated?795:673),le:P(366,seated?702:566),re:P(642,seated?702:566),feet:[P(439,975),P(566,975)],knees:[P(451,838),P(551,838)],expr:role==='king'?'deadpan':'deadpan',seated};
 const q=phase/48,tau=q*Math.PI*2;
 if(action==='walk'){
  const t=phase/24,bob=12*Math.cos(t*Math.PI*4),lean=21+7*Math.cos(t*Math.PI*4);
  p.shoulder=P(500+lean,441+bob);p.hip=P(500,692+bob);p.head=P(500+lean*1.2,300+bob);p.tilt=.04;
  p.feet=[walkFoot(t,0),walkFoot(t,.5)];p.feet[0][0]-=14;p.feet[1][0]+=14;
  p.knees=[knee(P(473,687+bob),p.feet[0]),knee(P(527,687+bob),p.feet[1])];
  const swing=Math.sin(t*Math.PI*2)*69;
  p.left=P(363+swing,641+bob);p.le=P(365+swing*.5,550+bob);p.right=P(646-swing,639+bob);p.re=P(640-swing*.5,550+bob);
  p.look=.65;p.expr=variant%3===0?'stern':'deadpan';
 }else if(action==='whip'){
  // 0–19 anticipation/held wind-up, 20–23 strike, 24–35 follow-through, 36–47 recovery.
  const wind=ease(phase/14),hit=ease((phase-19)/4),recover=ease((phase-35)/12),w=wind*(1-hit),s=hit*(1-recover);
  const dx=-26*w+46*s,dy=12*s;
  p.shoulder=P(500+dx,440+dy);p.hip=P(500+dx*.27,700+dy*.5);p.head=P(500+dx*1.35,296+dy);p.tilt=-.14*w+.14*s;p.look=.7;
  p.right=P(635-130*w+151*s,483-257*w+125*s);p.re=P(637-86*w+40*s,463-157*w+36*s);
  p.left=P(364-30*s,647+24*s);p.le=P(365-22*s,550+20*s);
  p.feet=[P(418,975),P(586,975)];p.knees=[P(442+dx*.5,843+dy),P(557+dx*.4,843+dy)];
  p.expr=s>.4?'strain':w>.65?'stern':'deadpan';
 }else if(action==='point'||action==='angry'||action==='dismiss'||action==='smug'){
  const extend=ease(progress/.23),talk=.5+.5*Math.sin(tau);
  const angry=action==='angry',dismiss=action==='dismiss';
  p.head=P(500+14*extend,295);p.tilt=angry?-.09:dismiss?.09:-.045;p.look=.75;
  p.shoulder=P(508,440);p.right=P(mix(615,795,extend),mix(568,dismiss?510:449,extend));p.re=P(650,500+18*(1-extend));
  p.left=P(365,665);p.le=P(360,553);
  p.expr=action==='smug'?'grin':angry&&talk>.57?'shout':angry?'stern':action==='point'&&kingRole(role)?(progress>.45&&progress<.72?'shout':'stern'):'deadpan';
  if(dismiss){p.right=P(730+20*Math.sin(tau),489-18*Math.cos(tau));p.re=P(648,533);p.expr=role==='king'?'stern':'deadpan';}
 }else if(action==='worried'){
  const recoil=ease(progress/.3);p.head=P(493-12*recoil,300+12*recoil);p.tilt=-.08;p.look=-.2;
  p.shoulder=P(497,454);p.hip=P(505,708);p.left=P(366,391);p.le=P(354,543);p.right=P(649,399);p.re=P(662,545);
  p.feet=[P(432,975),P(564,975)];p.knees=[P(460,858),P(534,858)];p.expr=progress>.48?'shock':'nervous';
 }else if(action==='brace'||action==='pull'){
  const strain=.5+.5*Math.sin(tau),tug=action==='pull'?strain:.6;
  p.head=P(455-15*tug,314+9*tug);p.tilt=-.11;p.look=.8;p.shoulder=P(460-18*tug,456+10*tug);p.hip=P(504,719);
  p.left=P(670-70*tug,590+12*tug);p.le=P(495,575+25*tug);p.right=P(721-70*tug,627+12*tug);p.re=P(565,602+20*tug);
  p.feet=[P(391,975),P(611,975)];p.knees=[P(440,858),P(566,871)];p.expr='strain';
 }else if(action==='recoil'){
  const shock=ease(progress/.2)*(1-.25*ease((progress-.65)/.3));
  p.head=P(500-46*shock,291+16*shock);p.tilt=-.18*shock;p.look=.85;p.shoulder=P(500-36*shock,446+16*shock);p.hip=P(508,712);
  p.left=P(374-42*shock,602-130*shock);p.le=P(367-34*shock,553);p.right=P(643+53*shock,600-127*shock);p.re=P(653+26*shock,540);
  p.feet=[P(424,975),P(590,975)];p.knees=[P(451,859),P(553,859)];p.expr='shock';
 }else if(action==='throw'){
  const wind=1-ease(progress/.38),release=ease((progress-.38)/.2);
  p.head=P(494+19*release,296);p.tilt=-.09*wind+.08*release;p.look=.8;p.shoulder=P(493+22*release,444);p.hip=P(500,700);
  p.right=P(576-75*wind+218*release,360-102*wind+104*release);p.re=P(611-69*wind+75*release,401-59*wind+40*release);p.expr=release>.5?'stern':'deadpan';
 }else if(action==='brand'){
  const press=.5+.5*Math.sin(tau);p.head=P(508,306);p.tilt=.08;p.look=.6;p.shoulder=P(509,451);p.hip=P(500,705);
  p.right=P(664+15*press,607+13*press);p.re=P(639,532);p.left=P(363,648);p.le=P(365,560);p.expr=press>.7?'strain':'deadpan';
 }else if(action==='read'){
  p.head=P(502,306);p.tilt=-.055;p.look=-.12;p.shoulder=P(503,451);p.hip=P(500,700);
  p.left=P(356,590);p.right=P(645,590);p.le=P(355,544);p.re=P(648,541);p.expr='read';
 }else if(action==='row'){
  const sweep=Math.sin(tau),back=Math.cos(tau);
  p.head=P(496+26*back,440+7*Math.abs(sweep));p.tilt=.055*back;p.look=.6;p.shoulder=P(500+27*back,581);p.hip=P(500,833);
  p.left=P(414+39*back,731+32*sweep);p.right=P(638+39*back,716+32*sweep);p.le=P(381+18*back,675);p.re=P(661+19*back,660);
  p.feet=[P(388,975),P(643,967)];p.knees=[P(430,903),P(591,898)];p.expr=back<-.45?'strain':'deadpan';
 }else if(action==='sit'){
  p.head=P(499,441);p.tilt=role==='king'?.055:-.035;p.look=role==='king'?-.6:.4;
  p.left=P(397,812);p.right=P(616,812);p.le=P(371,718);p.re=P(644,719);p.feet=[P(391,975),P(646,970)];p.knees=[P(434,911),P(593,903)];p.expr=role==='king'?'disappointed':'deadpan';
 }else{
  // Deliberate glance change rather than continuously bobbing a standing character.
  p.look=progress>.65?-.45:progress>.2?.45:0;p.tilt=variant%2?.025:-.025;p.expr=role==='king'?'deadpan':variant%3===1?'stern':'deadpan';
 }
 return p;
}

function draw(role:PersianRole,variant:number,action:PersianAction,phase:number,progress:number,blink:number):Drawing{
 const key=[role,variant,action,phase,progress,blink].join('/');
 const hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);return hit;}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const g=canvas.getContext('2d')!;g.scale(SIZE/1000,SIZE/1000);g.lineCap='round';g.lineJoin='round';
 const p=poseAt(role,variant,action,phase,progress),king=role==='king';
 const skin=SKIN[variant],ink=INK;let cloth=king?'#72558c':role==='herald'?'#ba6658':role==='engineer'?'#d2a660':variant%2?'#d9b469':'#e9d7a9';
 const shade=king?'#453a67':role==='herald'?'#79445c':role==='engineer'?'#836a69':'#9c8d91';
 const path=(pts:Point[],close=false)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));if(close)g.closePath();};
 const line=(pts:Point[],color=ink,width=9)=>{path(pts);g.strokeStyle=color;g.lineWidth=width;g.stroke();};
 const ellipse=(x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient,width=0,angle=0)=>{g.beginPath();g.ellipse(x,y,rx,ry,angle,0,Math.PI*2);g.fillStyle=fill;g.fill();if(width){g.lineWidth=width;g.strokeStyle=ink;g.stroke();}};
 const fillPath=(fill:string|CanvasGradient,width=9)=>{g.fillStyle=fill;g.fill();if(width){g.strokeStyle=ink;g.lineWidth=width;g.stroke();}};
 const curve=(start:Point,a:Point,b:Point,end:Point,color=ink,width=8)=>{g.beginPath();g.moveTo(...start);g.bezierCurveTo(...a,...b,...end);g.strokeStyle=color;g.lineWidth=width;g.stroke();};
 const hand=(h:Point)=>{ellipse(h[0],h[1],11,11,ink);ellipse(h[0]-2,h[1]-2,5,5,skin);};
 const arm=(shoulder:Point,elbow:Point,wrist:Point,back=false)=>{curve(shoulder,elbow,elbow,wrist,ink,back?14:13);};
 // Far leg and arm first: limbs retain an unmistakable silhouette against the cloth.
 const leftHip=P(p.hip[0]-29,p.hip[1]-7),rightHip=P(p.hip[0]+29,p.hip[1]-7);
 [0,1].forEach(i=>{const h=i?rightHip:leftHip,k=p.knees[i],f=p.feet[i];line([h,k,f],i?'#40343b':'#665b65',13);line([P(f[0]-13,f[1]),P(f[0]+25,f[1]-2)],ink,16);});
 const sl=P(p.shoulder[0]-89,p.shoulder[1]+28),sr=P(p.shoulder[0]+90,p.shoulder[1]+28);
 arm(sl,p.le,p.left,true);arm(sr,p.re,p.right,true);
 // Rounded clothed bean: shoulder narrower than belly, long soft sides, curved weighty hem.
 const bottom=king?p.hip[1]+74:p.hip[1]+22;
 const body=()=>{g.beginPath();g.moveTo(p.shoulder[0]-79,p.shoulder[1]+5);g.bezierCurveTo(p.shoulder[0]-104,p.shoulder[1]+73,p.hip[0]-111,bottom-79,p.hip[0]-91,bottom-18);g.bezierCurveTo(p.hip[0]-54,bottom+15,p.hip[0]+60,bottom+14,p.hip[0]+94,bottom-20);g.bezierCurveTo(p.hip[0]+111,bottom-92,p.shoulder[0]+102,p.shoulder[1]+67,p.shoulder[0]+78,p.shoulder[1]+4);g.bezierCurveTo(p.shoulder[0]+31,p.shoulder[1]-20,p.shoulder[0]-37,p.shoulder[1]-21,p.shoulder[0]-79,p.shoulder[1]+5);g.closePath();};
 const cg=g.createLinearGradient(p.shoulder[0]-103,0,p.shoulder[0]+121,0);cg.addColorStop(0,cloth);cg.addColorStop(.48,cloth);cg.addColorStop(1,shade);body();fillPath(cg,10);
 g.save();body();g.clip();
 // Folds and cuffs are painted values, not a forest of black geometry lines.
 curve(P(p.shoulder[0]-59,p.shoulder[1]+38),P(p.shoulder[0]-69,p.shoulder[1]+107),P(p.hip[0]-66,bottom-60),P(p.hip[0]-67,bottom-21),king?'#ac8cb5':'#f1dfb1',7);
 if(king){
  g.fillStyle='#337b7b';g.beginPath();g.moveTo(p.shoulder[0]-84,p.shoulder[1]+8);g.bezierCurveTo(p.shoulder[0]-35,p.shoulder[1]+49,p.hip[0]+50,bottom-89,p.hip[0]+103,bottom-57);g.lineTo(p.hip[0]+108,bottom-19);g.bezierCurveTo(p.hip[0]+43,bottom-39,p.shoulder[0]-27,p.shoulder[1]+79,p.shoulder[0]-104,p.shoulder[1]+39);g.closePath();g.fill();
  curve(P(p.shoulder[0]-85,p.shoulder[1]+15),P(p.shoulder[0]-11,p.shoulder[1]+66),P(p.hip[0]+37,bottom-75),P(p.hip[0]+102,bottom-48),'#d5b978',5);
  curve(P(p.hip[0]-95,bottom-25),P(p.hip[0]-39,bottom-6),P(p.hip[0]+46,bottom-9),P(p.hip[0]+99,bottom-27),GOLD,12);
  for(let j=0;j<5;j++){const x=p.hip[0]-61+j*31;ellipse(x,bottom-25,4,4,'#f3d27c');}
 }else if(role==='engineer'){
  const ag=g.createLinearGradient(p.hip[0]-80,0,p.hip[0]+90,0);ag.addColorStop(0,'#b98254');ag.addColorStop(.5,'#bd946c');ag.addColorStop(1,'#6c5a60');
  g.beginPath();g.moveTo(p.shoulder[0]-50,p.shoulder[1]+47);g.lineTo(p.shoulder[0]+45,p.shoulder[1]+47);g.bezierCurveTo(p.hip[0]+56,bottom-117,p.hip[0]+74,bottom-56,p.hip[0]+69,bottom-14);g.quadraticCurveTo(p.hip[0],bottom-2,p.hip[0]-73,bottom-15);g.closePath();fillPath(ag,4);
  line([P(p.shoulder[0]-47,p.shoulder[1]+45),P(p.head[0]-38,p.shoulder[1]-8)],'#b8956b',9);line([P(p.shoulder[0]+44,p.shoulder[1]+45),P(p.head[0]+37,p.shoulder[1]-8)],'#b8956b',9);
  curve(P(p.hip[0]-28,bottom-80),P(p.hip[0]-25,bottom-52),P(p.hip[0]+29,bottom-53),P(p.hip[0]+29,bottom-80),'#664d4b',5);
 }else{
  const beltY=p.hip[1]-70;
  curve(P(p.shoulder[0]-82,p.shoulder[1]+16),P(p.shoulder[0]-21,p.shoulder[1]+79),P(p.hip[0]+33,beltY-22),P(p.hip[0]+102,beltY+3),'#75455e',22);
  curve(P(p.hip[0]-110,beltY),P(p.hip[0]-27,beltY+11),P(p.hip[0]+31,beltY+10),P(p.hip[0]+104,beltY-3),'#75455e',21);
  ellipse(p.hip[0]+6,beltY+3,11,10,GOLD,3);
  curve(P(p.hip[0]-100,bottom-23),P(p.hip[0]-30,bottom-7),P(p.hip[0]+31,bottom-7),P(p.hip[0]+98,bottom-25),'#b18e63',6);
 }
 g.restore();
 // Tiny shoulder-to-body rim and lower contour carry the thick/thin ink weight.
 body();g.strokeStyle=ink;g.lineWidth=8;g.stroke();curve(P(p.hip[0]-89,bottom-18),P(p.hip[0]-50,bottom+14),P(p.hip[0]+54,bottom+14),P(p.hip[0]+92,bottom-20),ink,12);
 arm(sl,p.le,p.left);arm(sr,p.re,p.right);hand(p.left);hand(p.right);
 // Smooth asymmetric bean face, independent head tilt, broad hair silhouette.
 g.save();g.translate(...p.head);g.rotate(p.tilt);
 const headPath=()=>{g.beginPath();g.moveTo(-151,-30);g.bezierCurveTo(-158,-105,-93,-154,-8,-149);g.bezierCurveTo(77,-158,148,-111,151,-36);g.bezierCurveTo(159,33,109,118,18,139);g.bezierCurveTo(-56,151,-137,103,-148,38);g.bezierCurveTo(-153,15,-154,-12,-151,-30);g.closePath();};
 // The hair is a soft volume around the face; a side curl and light streak are original Persian cues.
 g.beginPath();g.moveTo(-163,23);g.bezierCurveTo(-194,-60,-134,-162,-40,-170);g.bezierCurveTo(77,-188,180,-128,174,-18);g.bezierCurveTo(170,66,135,132,89,143);g.bezierCurveTo(44,168,-117,162,-158,90);g.closePath();const hg=g.createLinearGradient(-155,-110,165,110);hg.addColorStop(0,'#644838');hg.addColorStop(.45,HAIR);hg.addColorStop(1,'#292433');fillPath(hg,9);
 headPath();const sg=g.createRadialGradient(-54,-65,25,-34,-32,226);sg.addColorStop(0,skin);sg.addColorStop(.48,skin);sg.addColorStop(.82,'#ddd5de');sg.addColorStop(1,'#c0b7cf');fillPath(sg,8);
 // Lower jaw ink is heavier than the lit upper-left crown.
 curve(P(-147,35),P(-133,110),P(-58,152),P(18,139),ink,11);
 // Curved dark forelock follows the head instead of boxing it inside a helmet.
 g.beginPath();g.moveTo(-151,-35);g.bezierCurveTo(-124,-125,-33,-113,13,-146);g.bezierCurveTo(61,-154,115,-120,141,-75);g.bezierCurveTo(77,-101,58,-101,9,-100);g.bezierCurveTo(-71,-72,-102,-77,-151,-35);g.closePath();fillPath(hg,6);
 curve(P(-129,-87),P(-92,-134),P(-34,-125),P(-7,-143),'#a47c4d',8);
 if(king){
  // Short curled beard leaves a round, expressive face above it.
  g.beginPath();g.moveTo(-127,43);g.bezierCurveTo(-103,69,-68,80,-17,80);g.bezierCurveTo(49,78,89,57,128,30);g.bezierCurveTo(125,108,80,158,17,170);g.bezierCurveTo(-63,169,-118,121,-127,43);g.closePath();fillPath(hg,8);
  for(let row=0;row<2;row++)for(let j=0;j<6-row;j++){const x=-74+j*30+row*14,y=106+row*28;curve(P(x-9,y),P(x-12,y+18),P(x+12,y+18),P(x+10,y+1),'#a07955',3);}
  const crownG=g.createLinearGradient(-129,0,130,0);crownG.addColorStop(0,'#b38643');crownG.addColorStop(.23,'#f4d388');crownG.addColorStop(.5,'#e7bd68');crownG.addColorStop(.8,'#ca994d');crownG.addColorStop(1,'#9a7041');
  g.beginPath();g.moveTo(-125,-111);g.lineTo(-111,-231);g.bezierCurveTo(-48,-253,51,-251,113,-228);g.lineTo(129,-113);g.quadraticCurveTo(0,-88,-125,-111);g.closePath();fillPath(crownG,8);
  for(let x=-91;x<=93;x+=23)curve(P(x,-226),P(x*.98,-190),P(x*1.03,-150),P(x*1.06,-117),'rgba(124,83,37,.5)',3);
  ellipse(0,-229,111,19,'#eecb82',6);ellipse(-15,-235,80,7,'#ffdfa0');
  curve(P(-125,-111),P(-49,-91),P(52,-92),P(129,-113),'#f2d99c',11);
  ellipse(0,-115,17,20,'#477e7a',5);ellipse(-52,-109,5,5,'#7b4f43');ellipse(54,-109,5,5,'#7b4f43');
 }else{
  const cap=role==='herald'?'#99536b':role==='engineer'?'#e6d9b8':variant%2?'#9d8068':'#c6a775';
  g.beginPath();g.moveTo(-146,-78);g.bezierCurveTo(-144,-133,-86,-173,-23,-169);g.bezierCurveTo(58,-181,124,-148,149,-93);g.bezierCurveTo(67,-112,-50,-101,-146,-78);g.closePath();fillPath(cap,7);
  curve(P(-142,-80),P(-56,-112),P(70,-112),P(146,-92),role==='herald'?'#dbaf87':role==='engineer'?'#fff1cc':'#e7cda0',11);
  if(role==='engineer'||role==='herald'){
   g.beginPath();g.moveTo(121,-101);g.bezierCurveTo(165,-75,169,-9,143,51);g.quadraticCurveTo(127,68,117,48);g.bezierCurveTo(142,5,140,-46,115,-71);g.closePath();fillPath(cap,5);
  }
 }
 // Face features slide/turn toward the subject while the round head keeps its volume.
 const turn=p.look*17,ey=1,eyeXs=[-49+turn,47+turn];
 const shocked=p.expr==='shock',nervous=p.expr==='nervous',strained=p.expr==='strain',stern=p.expr==='stern'||p.expr==='shout';
 for(let i=0;i<2;i++){
  const x=eyeXs[i];
  if(blink>=1){curve(P(x-19,ey),P(x-5,ey+5),P(x+9,ey+5),P(x+20,ey),ink,6);}
  else if(shocked||nervous){ellipse(x,ey,shocked?28:21,shocked?34:29,'#fffaf4',6);ellipse(x+p.look*3,ey+4,shocked?8:7,shocked?13:12,ink);}
  else if(strained&&i===0){line([P(x-18,ey-7),P(x+1,ey+2),P(x-17,ey+11)],ink,6);}
  else{ellipse(x+p.look*4,ey+5,9,17,ink);if(blink===.5||p.expr==='deadpan'||p.expr==='disappointed'||stern){line([P(x-22,ey-5),P(x+21,ey-5)],ink,6);}}
 }
 const brow=(x:number,left:boolean)=>{
  const dir=left?1:-1;
  let outer=-39,inner=-42;
  if(stern||strained){outer=-48;inner=-28;}if(nervous||shocked){outer=-35;inner=-58;}if(p.expr==='disappointed'){outer=left?-39:-54;inner=left?-44:-36;}
  g.beginPath();g.moveTo(x-dir*27,outer);g.quadraticCurveTo(x,Math.min(outer,inner)-10,x+dir*23,inner);g.lineTo(x+dir*23,inner+9);g.quadraticCurveTo(x,Math.min(outer,inner)+2,x-dir*27,outer+4);g.closePath();g.fillStyle=ink;g.fill();
 };
 brow(eyeXs[0],true);brow(eyeXs[1],false);
 const mx=turn*.8,my=63;
 if(p.expr==='shock'){ellipse(mx,my+2,22,29,'#663b4e',6);ellipse(mx,my+14,12,9,'#cd8790');}
 else if(p.expr==='shout'||p.expr==='read'){
  const open=p.expr==='read'?(.5+.5*Math.sin(phase/48*Math.PI*6)):1;
  if(open<.35)ellipse(mx,my,14,17,'#663b4e',5);
  else{g.beginPath();g.moveTo(mx-36,my-11);g.quadraticCurveTo(mx,my-18,mx+37,my-11);g.bezierCurveTo(mx+31,my+34,mx-28,my+36,mx-36,my-11);g.closePath();fillPath('#68374a',5);g.save();g.clip();g.fillStyle='#fff9e9';g.fillRect(mx-36,my-12,73,12);ellipse(mx+8,my+26,23,10,'#d6828a');g.restore();}
 }else if(p.expr==='grin'){
  g.beginPath();g.moveTo(mx-43,my-10);g.quadraticCurveTo(mx,my+4,mx+45,my-12);g.bezierCurveTo(mx+26,my+31,mx-27,my+28,mx-43,my-10);g.closePath();fillPath('#68374a',5);g.save();g.clip();g.fillStyle='#fff8ea';g.fillRect(mx-46,my-11,92,18);g.restore();
 }else if(strained){
  g.beginPath();g.moveTo(mx-30,my-9);g.quadraticCurveTo(mx,my-19,mx+34,my-8);g.lineTo(mx+29,my+11);g.quadraticCurveTo(mx,my+4,mx-29,my+13);g.closePath();fillPath('#fff6e6',5);line([P(mx-9,my-6),P(mx-10,my+7)],'#9c7b78',2);line([P(mx+12,my-6),P(mx+12,my+7)],'#9c7b78',2);
 }else if(nervous){curve(P(mx-31,my+4),P(mx-16,my-8),P(mx-9,my+12),P(mx+4,my+1),ink,5);curve(P(mx+4,my+1),P(mx+15,my-9),P(mx+24,my+10),P(mx+34,my+1),ink,5);}
 else if(stern||p.expr==='disappointed'){curve(P(mx-28,my+9),P(mx-9,my-4),P(mx+15,my-1),P(mx+32,my+6),ink,6);}
 else{curve(P(mx-29,my+1),P(mx-7,my+12),P(mx+17,my+8),P(mx+34,my-4),ink,5);}
 // Curled moustache is small enough that eyes and mouth remain the central acting cues.
 if(king){curve(P(-2,41),P(-22,26),P(-37,37),P(-45,43),HAIR,10);curve(P(2,41),P(24,26),P(35,36),P(46,41),HAIR,10);}
 else if(variant===1){curve(P(mx-1,38),P(mx-19,31),P(mx-25,36),P(mx-32,42),HAIR,6);curve(P(mx+1,38),P(mx+16,31),P(mx+26,35),P(mx+31,40),HAIR,6);}
 if(nervous){g.beginPath();g.moveTo(148,17);g.bezierCurveTo(133,39,137,56,149,54);g.bezierCurveTo(160,54,162,41,148,17);g.closePath();fillPath('#afd3df',4);}
 g.restore();
 // Foreground hands remain above the scroll and costume, tied to the actual wrists.
 if(action==='read'){
  const y=548;
  const pg=g.createLinearGradient(354,y,645,y+169);pg.addColorStop(0,'#f8e8bc');pg.addColorStop(.6,'#ead29c');pg.addColorStop(1,'#c9ac81');
  g.beginPath();g.moveTo(355,y);g.quadraticCurveTo(501,y+12,646,y+1);g.lineTo(639,y+172);g.quadraticCurveTo(499,y+187,362,y+171);g.closePath();fillPath(pg,6);
  for(const x of [358,642]){ellipse(x,y+4,13,10,'#f9e9bf',4);curve(P(x,y+14),P(x-2,y+77),P(x+2,y+126),P(x,y+170),'#ba9c73',6);ellipse(x,y+172,13,10,'#e4cc95',4);}
  g.beginPath();g.arc(520,y+118,17,0,7);g.fillStyle='#aa5a59';g.fill();ellipse(520,y+118,8,8,'#c87e6d');
  hand(p.left);hand(p.right);
 }
 if(action==='point'||action==='angry'||action==='dismiss'){
  curve(p.right,P(p.right[0]+14,p.right[1]-7),P(p.right[0]+24,p.right[1]-12),P(p.right[0]+44,p.right[1]-13),skin,10);hand(p.right);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const result={texture,left:p.left,right:p.right};cache.set(key,result);
 while(cache.size>96){const first=cache.keys().next().value as string|undefined;if(first===undefined)break;const entry=cache.get(first)!;cache.delete(first);entry.texture.dispose();}
 return result;
}

let shadow:THREE.CanvasTexture|null=null;
function shadowTexture(){
 if(shadow)return shadow;const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;
 const gr=g.createRadialGradient(64,64,0,64,64,62);gr.addColorStop(0,'rgba(35,26,49,.48)');gr.addColorStop(.35,'rgba(35,26,49,.27)');gr.addColorStop(1,'rgba(35,26,49,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);shadow=new THREE.CanvasTexture(c);return shadow;
}

/** Feet at origin; pose acts inside the card. Scene owns translation and real prop geometry. */
export class PersianActor extends THREE.Group{
 readonly role:PersianRole;readonly variant:number;
 private card:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshLambertMaterial>;private depth:THREE.MeshDepthMaterial;private shadow:THREE.Mesh;
 private wrists:{left:Point;right:Point}={left:P(365,673),right:P(637,673)};
 constructor(role:PersianRole,variant=0){
  super();this.role=role;this.variant=((variant%4)+4)%4;
  const image=draw(role,this.variant,'idle',0,0,0),material=cardShade(new THREE.MeshLambertMaterial({map:image.texture,transparent:true,alphaTest:.35,side:THREE.DoubleSide}));
  this.card=new THREE.Mesh(new THREE.PlaneGeometry(4,4),material);this.card.position.y=1.9;this.card.layers.set(NOINK);this.card.castShadow=this.card.receiveShadow=true;
  this.depth=new THREE.MeshDepthMaterial({map:image.texture,alphaTest:.35,depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});this.card.customDepthMaterial=this.depth;
  this.card.onBeforeRender=r=>{r.getDrawingBufferSize(bufferSize);CARD_K.uPx.value=bufferSize.y/1920;};this.add(this.card);
  this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.72),new THREE.MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));this.shadow.rotation.x=-Math.PI/2;this.shadow.position.y=.018;this.shadow.layers.set(NOINK);this.add(this.shadow);
 }
 pose(frame:number,action:PersianAction,camera:THREE.Camera,progress=0){
  this.getWorldPosition(worldPosition);camera.getWorldPosition(cameraPosition);this.card.rotation.y=Math.atan2(cameraPosition.x-worldPosition.x,cameraPosition.z-worldPosition.z);
  const raw=((frame%48)+48)%48;
  const cyclic=action==='whip'||action==='row'||action==='brand'||action==='pull'||action==='brace'||action==='read'||action==='angry'||action==='dismiss';
  const phase=action==='walk'?Math.floor(((frame%24)+24)%24):action==='whip'||action==='row'?Math.floor(raw):cyclic?Math.floor(raw/2)*2:0;
  // Progress does not enter cyclic poses: this prevents needless 48x walk-texture churn.
  const needsProgress=action==='point'||action==='angry'||action==='dismiss'||action==='smug'||action==='worried'||action==='recoil'||action==='throw';
  const prog=needsProgress?Math.floor(clamp(progress)*48)/48:action==='idle'?(progress>.65?.8:progress>.2?.4:0):0;
  const blinkFrame=((frame+this.variant*19)%79+79)%79;
  const lid=blinkFrame===18||blinkFrame===21?.5:blinkFrame===19||blinkFrame===20?1:0;
  const image=draw(this.role,this.variant,action,phase,prog,lid);this.card.material.map=image.texture;this.depth.map=image.texture;this.wrists={left:image.left,right:image.right};
  setCardPose(this.card.material,action==='sit'||action==='row');
  this.shadow.scale.set(action==='sit'||action==='row'?1.05:action==='whip'||action==='pull'||action==='brace'?1.2:1,1,1);
 }
 getHand(side:'left'|'right'):THREE.Vector3{
  const p=this.wrists[side];this.updateWorldMatrix(true,true);return this.card.localToWorld(new THREE.Vector3((p[0]-500)*.004,(500-p[1])*.004,.018));
 }
}
