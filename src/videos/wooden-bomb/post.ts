// The post chain for "The Wooden Bomb", driven by the raw `postprocessing` EffectComposer instead of the R3F
// wrapper (multi-pass rendering inside the R3F wrapper is broken on this swangle stack: any composer with >= 2
// passes rendered a transparent canvas silently, verified pass-by-pass on frame-0 probes).
// Chain (identical to the bridge house style): RenderPass -> InkPass (own world-only normals pass) -> lens pre ->
// lens main -> bloom (emissive only) -> NEUTRAL tone map -> display-referred grade. MSAA off (swangle-safe); the
// ink pass does its own tent-AA and the DOF handles edges softly.
import * as THREE from "three";
import { EffectComposer, EffectPass, RenderPass, BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass } from "./ink";
import { LensBlur, GrainEffect } from "./lensblur";
import { GradeEffect, GRADES, GRADE_STRENGTH } from "./grade";

export const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.5, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

export class PostChain {
  readonly composer: EffectComposer;
  readonly ink: InkPass;
  readonly lens: LensBlur;
  readonly tone: ToneMappingEffect;
  readonly grade: GradeEffect;
  readonly grain: GrainEffect;
  readonly bloom: BloomEffect;
  // the effect toggles act on these wrapping passes (an Effect itself has no `enabled`)
  readonly prePass: EffectPass;
  readonly mainPass: EffectPass;
  readonly bloomPass: EffectPass;
  readonly gradePass: EffectPass;
  readonly grainPass: EffectPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.ink = new InkPass(scene, camera);
    this.lens = new LensBlur({ maxCoC: 24, nearScale: 1.2 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
    this.grade = new GradeEffect(GRADES.day, GRADE_STRENGTH.day);
    this.grain = new GrainEffect({ amount: 0.025, cellPx: 1.5 }); // OFF (kept in the chain for inputProps post.grain tests)
    this.bloom = makeBloom();
    this.prePass = new EffectPass(camera, this.lens.pre);
    this.mainPass = new EffectPass(camera, this.lens.main);
    this.bloomPass = new EffectPass(camera, this.bloom);
    this.gradePass = new EffectPass(camera, this.tone, this.grade);
    this.grainPass = new EffectPass(camera, this.grain);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.ink);
    this.composer.addPass(this.prePass);
    this.composer.addPass(this.mainPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(this.grainPass);
    // A/B toggles for test stills (inputProps { post: { ink/lens/pre/bloom/grade/grain } }); everything else stays on.
    const on = (globalThis as unknown as { __post?: { ink?: boolean; lens?: boolean; pre?: boolean; bloom?: boolean; grade?: boolean; grain?: boolean } }).__post ?? {};
    this.ink.enabled = on.ink ?? true;
    this.prePass.enabled = (on.lens ?? true) && (on.pre ?? true);
    this.mainPass.enabled = on.lens ?? true;
    this.bloomPass.enabled = on.bloom ?? true;
    this.gradePass.enabled = on.grade ?? true;
    this.grainPass.enabled = on.grain ?? false;
  }

  /** resize to the output canvas' backbuffer size (called on creation and on resize) */
  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.ink.dispose();
    this.lens.dispose();
    this.bloom.dispose();
    this.tone.dispose();
    this.grade.dispose();
    this.grain.dispose();
    this.composer.dispose();
  }
}
