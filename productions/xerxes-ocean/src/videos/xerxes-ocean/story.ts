export type V3 = [number,number,number];
export const FPS=30;
export type Stage='shore'|'tent'|'fleet';
export type Shot={id:number;name:string;a:number;b:number;mode:Stage;light:'day'|'golden';storm?:boolean;pos:V3;look:V3;end?:V3;lookEnd?:V3;fov:number;dof:number;roll?:number;sunAz?:number;sunEl?:number;};
// Provisional 68.5-second board, retimed to real word boundaries once voice.wav is supplied.
const shot=(id:number,name:string,a:number,b:number,mode:Stage,pos:V3,look:V3,fov=40,dof=0,extra:Partial<Shot>={}):Shot=>({id,name,a:Math.round(a*FPS),b:Math.round(b*FPS),mode,pos,look,fov,dof,light:'day',...extra});
export const SHOTS:Shot[]=[
shot(1,'The ocean is under arrest',0,4.4,'shore',[3.7,3.1,10.5],[.2,1.95,1],41,14,{end:[2.8,2.9,9.2],lookEnd:[.15,2.05,1]}),
shot(2,'A king and a strait',4.4,9.5,'tent',[4.4,4,12.6],[.2,1.8,2],44,11,{end:[3.5,3.6,11.4],lookEnd:[0,1.95,1.8]}),
shot(3,'Two roads over the sea',9.5,13.8,'fleet',[20,22,25],[0,.8,-17],46,0,{end:[16,19,23],lookEnd:[-2,.8,-18]}),
shot(4,'A storm breaks the crossing',13.8,18.7,'fleet',[8,4.3,8],[0,.6,-6],46,3,{storm:true,roll:-.065,end:[4,3.4,6],lookEnd:[-1,0,-7]}),
shot(5,'Xerxes takes it personally',18.7,22.1,'tent',[-1.1,3.1,8.5],[-.15,2.55,2],38,16,{end:[-.85,3,7.8],lookEnd:[-.05,2.65,2],roll:-.025}),
shot(6,'Three hundred lashes',22.1,27.2,'shore',[-2.8,2.7,-11.5],[0,1.5,.5],43,13,{end:[-1.9,2.5,-10.1],lookEnd:[.1,1.35,.3]}),
shot(7,'Red-hot justice',27.2,30.1,'shore',[-.6,2.1,-7.2],[0,1.3,.25],42,15,{end:[-.35,1.95,-6.5],lookEnd:[-.1,1.15,-.1]}),
shot(8,'Handcuffs for the Hellespont',30.1,33.4,'shore',[2.6,2.5,5.5],[.1,.75,-1.3],40,15,{end:[2,2.15,4.7],lookEnd:[0,.1,-2]}),
shot(9,'The official curse',33.4,38.2,'shore',[-1.6,2.85,8.3],[0,2.1,1],40,15,{end:[-1.1,2.75,7.5],lookEnd:[0,2.2,1]}),
shot(10,'The ocean remains unbothered',38.2,41.2,'shore',[.9,1.5,3.4],[0,-.3,-3],42,12,{end:[.4,1.3,2.5],lookEnd:[.1,-.25,-3]}),
shot(11,'The engineers are less lucky',41.2,44.8,'tent',[.4,3.5,16],[.2,1.9,2],45,11,{end:[.2,3.3,14.8],lookEnd:[.1,2,2]}),
shot(12,'A fleet becomes a foundation',44.8,51.1,'fleet',[14,8,16],[0,.5,-7],45,6,{end:[10,6.8,13],lookEnd:[-2,.9,-7]}),
shot(13,'Braided cables and a wooden road',51.1,54.5,'fleet',[4.2,3.6,3.2],[0,1.85,-4.2],44,14,{end:[3.25,3.2,2.6],lookEnd:[0,1.8,-4.2]}),
shot(14,'Seven days of marching',54.5,59,'fleet',[5.3,3.65,5.1],[0,2.8,-5],43,10,{light:'golden',end:[3.9,3.4,4.4],lookEnd:[-.1,2.7,-5]}),
shot(15,'The sea has the last word',59,63.5,'fleet',[12,6,13],[0,0,-8],46,2,{storm:true,roll:.065,end:[7,4.5,10],lookEnd:[-1,-.1,-9]}),
shot(16,'Everybody takes the boat',63.5,68.5,'shore',[2.7,2.6,5.4],[0,1.05,-4.5],40,14,{light:'golden',end:[1.6,2.45,4.6],lookEnd:[-.4,1.1,-4.8]}),
];
export const TOTAL=SHOTS[SHOTS.length-1].b;
export const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*t*(t*(t*6-15)+10);};
export const shotAt=(f:number)=>SHOTS.find(s=>f>=s.a&&f<s.b)??SHOTS[SHOTS.length-1];
export const camAt=(s:Shot,f:number)=>{
 const t=Math.max(0,Math.min(1,(f-s.a)/(s.b-s.a-1)));
 // An authored 36-frame glide settles into a continuing small push, rather than a barely moving full-shot ease.
 const p=.72*smooth((f-s.a)/36)+.28*t;
 const impact=s.id===4?s.a+65:s.id===15?s.a+60:s.id===6?s.a+25+48*Math.floor(Math.max(0,f-s.a-25)/48):-100;
 const age=f-impact,k=age>=0&&age<7?Math.pow(1-age/7,2)*(age%2?-1:1):0;
 return {pos:s.pos.map((v,i)=>v+((s.end??s.pos)[i]-v)*p+(i===0?k*.028:0)) as V3,look:s.look.map((v,i)=>v+((s.lookEnd??s.look)[i]-v)*p) as V3,fov:s.fov,roll:(s.roll??0)*(.35+.65*Math.sin(t*Math.PI))+k*.003};
};
