/** Sculpted cartoon-card light. The drawing remains the albedo, including its own ink,
 * soft crescent and cloth painting; scene light adds form, real shadow and a warm rim. */
import * as THREE from 'three';
import {LFB, CHAR, LOCAL, CINE_WORLD_VERTEX, CINE_LOCAL_DECL} from './shade';

export const GRAD_K=4.6;
export const GRAD_KB=1.2;
export const TINT_K=.65;
export const CARD_K={uGradK:{value:GRAD_K},uGradKB:{value:GRAD_KB},uTintK:{value:TINT_K},uNorm:{value:.8},uGain:{value:1.045},uPx:{value:1}};

const CARD=/* glsl */ `
vec3 tintK=mix(vec3(1.0),uCharTint,uTintK);
tintK/=pow(max(dot(tintK,vec3(.2126,.7152,.0722)),.2),uNorm);
vec3 outgoingLight=diffuseColor.rgb*tintK;
#if NUM_DIR_LIGHTS>0
{
  vec3 sunV=normalize(directionalLights[0].direction);
  float head=smoothstep(.48,.62,vMapUv.y);
  float hx=clamp((vMapUv.x-.5)/mix(.14,.17,head),-1.,1.);
  float hy=clamp((vMapUv.y-uHeadCenter)/.145,-1.3,1.3);
  // A shallow virtual ellipsoid provides broad soft modelling on a flat actor card.
  vec3 n=normalize(vec3(hx*.57,hy*.24,sqrt(max(.12,1.-hx*hx*.62-hy*hy*.18))));
  float side=sign(sunV.x)*smoothstep(.02,.35,abs(sunV.x));
  // Start the soft crescent within the cheek, not just beneath the outer hair edge.
  // Otherwise a broad round white face still reads as a uniformly filled sticker.
  float dark=smoothstep(-.42,.83,-hx*side+max(-hy,0.)*.18);
  float gradient=mix(uBodyGrad*uGradKB,min(uGrad*uGradK,.52),head);
  vec3 sideK=mix(vec3(1.),uSideTint,dark*.85);
  float jaw=smoothstep(.1,1.2,-hy)*head;
  float browHighlight=exp(-pow((hx-side*.28)/.58,2.)-pow((hy-.35)/.8,2.))*head;
  float form=max(mix(.48,.60,head),(1.-gradient*dark)*(1.-jaw*.14)+browHighlight*.065);
  float keyFacing=max(dot(n,sunV),0.);
  float lightWrap=.975+.035*keyFacing;
  outgoingLight*=sideK*form*mix(uCharShade,1.,sunVis)*lightWrap*uGain;

  vec3 localWorld=uLocalPos-vCineWorld;
  float localFall=pow(1.-smoothstep(0.,uLocalRadius,length(localWorld)),1.7);
  vec3 localV=normalize(mat3(viewMatrix)*localWorld);
  float localForm=.08+.92*max(dot(n,localV),0.);
  // Local fill follows the same curved form. Adding an even warm wash here used to
  // erase the cool crescent and make the whole head the same pale value again.
  float poolShape=mix(1.,.52+.48*smoothstep(-.4,.8,hx*side+hy*.3),head);
  outgoingLight+=diffuseColor.rgb*uLocalColor*(uLocalStrength*localFall*localForm*.34*poolShape);
  // Retain a restrained amount of the physical fill/spot colour, normalized against
  // albedo so a dark costume does not become an emissive patch.
  outgoingLight+=reflectedLight.indirectDiffuse*.025+reflectedLight.directDiffuse*.018;

  #ifdef USE_MAP
  {
    float warm=clamp((1.-uCharTint.b)*4.5+.12,0.,.85);
    vec2 light2=normalize(vec2(sunV.x,sunV.y)+vec2(.0001));
    vec2 duv=2.1*uPx*(light2.x*dFdx(vMapUv)+light2.y*dFdy(vMapUv));
    float outside=1.-step(.3,texture2D(map,vMapUv+duv).a);
    vec4 inner=texture2D(map,vMapUv-normalize(duv+vec2(.00001))*vec2(.015,.01));
    float painted=step(.11,dot(inner.rgb,vec3(.2126,.7152,.0722)))*step(.5,inner.a);
    float thick=step(.4,texture2D(map,vMapUv-normalize(duv+vec2(.00001))*vec2(.04,.025)).a);
    float rim=warm*outside*painted*thick*mix(.45,1.,sunVis);
    outgoingLight+=vec3(.72,.36,.11)*rim;
  }
  #endif
}
#endif
`;
const DECL='#include <common>\nuniform vec3 uCharTint; uniform float uCharShade; uniform float uGrad; uniform float uBodyGrad; uniform vec3 uSideTint; uniform float uGradK; uniform float uGradKB; uniform float uTintK; uniform float uNorm; uniform float uGain; uniform float uPx; uniform float uHeadCenter;'+CINE_LOCAL_DECL;

export function cardShade(m:THREE.MeshLambertMaterial){
  m.emissive.set(0);m.emissiveIntensity=0;m.emissiveMap=null;
  const headCenter={value:.70};m.userData.cineHeadCenter=headCenter;
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,CHAR,LOCAL,CARD_K,{uHeadCenter:headCenter});
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCineWorld;').replace('#include <project_vertex>',CINE_WORLD_VERTEX);
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',DECL)
      .replace('#include <lights_fragment_begin>','float sunVis=1.;\n'+LFB)
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',CARD);
  };
  m.customProgramCacheKey=()=> 'cineCard4b';return m;
}
export function setCardPose(m:THREE.MeshLambertMaterial,seated:boolean){
  const center=m.userData.cineHeadCenter as {value:number}|undefined;
  if(center)center.value=seated?.56:.70;
}

/** ground contact blob: multiplies what is already drawn (the ground); drawn after the ground and before the cards */
export const blobMaterial = (map: THREE.Texture) => new THREE.MeshBasicMaterial({
  map, transparent: false, depthWrite: false, fog: false, toneMapped: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
});
