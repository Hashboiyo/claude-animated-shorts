// "The Wooden Bomb": our 68 s short in the flat-characters-in-a-3D-toon-world style.
// One three.js world (world.ts) posed per frame from the story timeline (story.ts). The post chain (post.ts) is driven
// by the raw postprocessing EffectComposer inside useFrame (renderPriority 1 so R3F never auto-renders):
//   RenderPass -> InkPass -> lens pre -> lens main -> bloom (emissive only) -> NEUTRAL tone map -> grade.
// The R3F <EffectComposer> wrapper was verified broken on this swangle stack (any >= 2-pass setup rendered a
// transparent canvas); the raw composer preserves the house look end-to-end.
// Place changes crossfade by stacking a second canvas for the fade frames; the hook ends on a 4-frame white flash.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { World, loadKit } from "./world";
import { noInkFallback } from "./ink";
import { gradeFor } from "./grade";
import { Kit } from "./build";
import { TOTAL, FLASH_AT, SHOTS, layersAt, dofAt } from "./story";
import { PostChain } from "./post";

export const WOODEN_FRAMES = TOTAL;

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const useKit = () => {
  const [kit, setKit] = useState<Kit | null>(null);
  const [handle] = useState(() => delayRender("wooden kit"));
  useEffect(() => { loadKit().then((k) => { setKit(k); continueRender(handle); }); }, [handle]);
  return kit;
};

const Inner: React.FC<{ id: number; kit: Kit }> = ({ id, kit }) => {
  const f = useCurrentFrame();
  const { camera, scene, gl } = useThree();
  const world = useMemo(() => new World(kit), [kit]);
  const target = useMemo(() => new THREE.Vector3(), []);
  const chain = useMemo(() => new PostChain(gl, scene, camera as THREE.PerspectiveCamera), [gl, camera, scene]);
  useEffect(() => () => chain.dispose(), [chain]);
  // NOTE: no pass.enabled toggling here — a disabled pass blanks the whole composer on this stack (see post.ts).
  const cam = camera as THREE.PerspectiveCamera;
  const size = useMemo(() => new THREE.Vector2(), []);
  useFrame(() => {
    target.copy(world.update(id, f, cam, scene));
    noInkFallback(world.root);
    // thin-lens focus: distance along the view axis to the shot's focus point (default: the camera's look target)
    const d = dofAt(f);
    cam.getWorldDirection(fwd);
    if (d.focus) fpt.set(...d.focus(f)); else fpt.copy(target);
    chain.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
    chain.lens.cInf = d.cInf;
    gradeFor(chain.grade, SHOTS[id - 1].light);
    chain.grain.seed = f; // deterministic per frame
    gl.getDrawingBufferSize(size);
    chain.setSize(size.x, size.y);
    chain.render();
  }, 1);
  return <primitive object={world.root} dispose={null} />;
};

/** test stills only: inputProps `{ post: { dpr: 0.5 } }` forces the WebGL buffer size (R3F clamps dpr to >= 1 by default) */
const dprOverride = () => (getInputProps() as { post?: { dpr?: number } }).post?.dpr;
const ShotView: React.FC<{ id: number; kit: Kit; alpha: number }> = ({ id, kit, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas {...(dprOverride() ? { dpr: dprOverride() } : { dpr: 1 })} width={1080} height={1920} shadows
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1.02; }}
      camera={{ fov: 40, near: 0.2, far: 1500, position: [26, 26, -52] }}>
      <Inner id={id} kit={kit} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const WoodenBomb: React.FC = () => {
  const f = useCurrentFrame();
  const kit = useKit();
  if (!kit) return null;
  const flash = f >= FLASH_AT && f < FLASH_AT + 4 ? [1, 0.75, 0.45, 0.2][f - FLASH_AT] : 0;
  return (
    <AbsoluteFill style={{ background: "#cfe3f2" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} kit={kit} alpha={l.alpha} />)}
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
    </AbsoluteFill>
  );
};
