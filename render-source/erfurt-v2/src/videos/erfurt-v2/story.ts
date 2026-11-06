// Timed to freshly generated Ryan narration. Camera moves remain deterministic across parallel chunks.
export const FRAMES=1157;
const real=[0, 5.824416666666666, 14.363604166666667, 20.557583333333334, 26.322, 32.562416666666664, 38.56666666666667];
const old=[0,8,19,29,40,52,60];
export function storyTime(t:number){let i=0;while(i<5&&t>=real[i+1])i++;return old[i]+(old[i+1]-old[i])*(t-real[i])/(real[i+1]-real[i]);}
type V=[number,number,number];
type Key={at:number,pos:V,look:V,roll:number,cut?:boolean};
export const keys:Key[]=[
 {at:0,pos:[-2,-3.8,7],look:[-.8,-4.85,.7],roll:-.035},
 {at:4,pos:[-.6,-4.1,5.4],look:[-.6,-4.8,.5],roll:.025},
 {at:7.99,pos:[.6,-3.7,5],look:[-.4,-4.7,0],roll:.045},
 {at:8,pos:[1.8,3.4,12.5],look:[.1,1.9,-.2],roll:0,cut:true},
 {at:11,pos:[.5,2.9,10.7],look:[.6,1.8,-.9],roll:-.025},
 {at:14,pos:[4,2.5,7.2],look:[3,1.9,-1.7],roll:.025},
 {at:16,pos:[2,2.6,8],look:[1.3,1.6,-1.1],roll:0},
 {at:18.99,pos:[.5,2.6,9],look:[0,1.6,-.3],roll:-.025},
 {at:19,pos:[.5,3,11],look:[-.5,1.25,.7],roll:0,cut:true},
 {at:22,pos:[1.7,1.3,10],look:[-.5,0,.3],roll:.025},
 {at:25,pos:[2,-2.3,10],look:[-.3,-3.5,.2],roll:.04},
 {at:28.99,pos:[.4,-3.4,9],look:[-.5,-4.5,.4],roll:0},
 {at:29,pos:[1.8,2.1,10.5],look:[-.5,1,.6],roll:-.02,cut:true},
 {at:31,pos:[2,-.8,10],look:[-.4,-2.3,.5],roll:-.07},
 {at:33,pos:[1.5,-3,9],look:[-.4,-4.7,.6],roll:.035},
 {at:36,pos:[-.3,-3.4,8],look:[-.5,-4.8,.4],roll:.015},
 {at:39.99,pos:[-1.4,-3.2,7],look:[-.3,-4.7,.3],roll:0},
 {at:40,pos:[4.5,2.6,8.5],look:[3.15,1.8,-1.7],roll:-.03,cut:true},
 {at:43,pos:[4,2.2,6.7],look:[3.2,1.7,-1.7],roll:0},
 {at:46,pos:[4.6,-.5,8.2],look:[3,-1.1,-.6],roll:.04},
 {at:49,pos:[4.2,.8,7.7],look:[3,.2,-.6],roll:.02},
 {at:51.99,pos:[3.8,2,7],look:[3,1.5,-.9],roll:0},
 {at:52,pos:[4.6,2.7,8.6],look:[3.2,1.8,-1.7],roll:0,cut:true},
 {at:55,pos:[3.6,2.5,7],look:[3.2,1.9,-1.7],roll:-.025},
 {at:58,pos:[2.7,2.3,5.9],look:[3.2,1.8,-1.7],roll:.02},
 {at:60,pos:[2.2,2.15,5.2],look:[3.2,1.65,-1.7],roll:0}
];
export function cameraAt(t:number){let i=0;while(i<keys.length-2&&t>=keys[i+1].at)i++;const a=keys[i],b=keys[i+1];if(b.cut)return a;let u=Math.max(0,Math.min(1,(t-a.at)/(b.at-a.at)));u=.65*u+.35*u*u*(3-2*u);const lerp=(x:V,y:V)=>x.map((v,j)=>v+(y[j]-v)*u) as V;return {pos:lerp(a.pos,b.pos),look:lerp(a.look,b.look),roll:a.roll+(b.roll-a.roll)*u};}
