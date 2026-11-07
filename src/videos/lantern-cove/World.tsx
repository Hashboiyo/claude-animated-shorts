import React, { useMemo } from "react";
import * as THREE from "three";
import { Outlines } from "@react-three/drei";
import { PALETTE } from "./palette";
import { hash, swayAt, type Vec3 } from "./timeline";

const INK = PALETTE.worldInk;

// ---------------------------------------------------------------------------
// Canvas textures (all deterministic, no network assets)
// ---------------------------------------------------------------------------
const makeRadialTexture = (stops: Array<[number, string]>) => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [p, color] of stops) g.addColorStop(p, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const makeCloudTexture = () => {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, 512, 256);
  for (let i = 0; i < 16; i++) {
    const x = 70 + hash(i + 1) * 372;
    const y = 118 + (hash(i + 31) - 0.5) * 62;
    const r = 36 + hash(i + 61) * 58;
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,246,232,0.95)");
    g.addColorStop(0.55, "rgba(255,232,210,0.55)");
    g.addColorStop(1, "rgba(255,226,205,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const makeLeafTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.clearRect(0, 0, 256, 512);
  ctx.beginPath();
  ctx.moveTo(128, 14);
  ctx.bezierCurveTo(226, 120, 236, 300, 128, 498);
  ctx.bezierCurveTo(20, 300, 30, 120, 128, 14);
  ctx.closePath();
  ctx.fillStyle = "#2f5a3a";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#14251b";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 38);
  ctx.lineTo(128, 470);
  ctx.strokeStyle = "rgba(190,225,170,0.45)";
  ctx.lineWidth = 5;
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const y = 100 + i * 52;
    const spread = 44 - i * 3;
    ctx.beginPath();
    ctx.moveTo(128, y);
    ctx.quadraticCurveTo(128 + spread, y + 22, 128 + spread + 22, y + 58);
    ctx.moveTo(128, y);
    ctx.quadraticCurveTo(128 - spread, y + 22, 128 - spread - 22, y + 58);
    ctx.strokeStyle = "rgba(190,225,170,0.3)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

const makeWaterTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = "#3f9fb5";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 18; i++) {
    const y = hash(i + 3) * 256;
    const x = hash(i + 91) * 256;
    ctx.beginPath();
    ctx.ellipse(x, y, 28 + hash(i + 11) * 34, 2.5, hash(i + 7) * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(190,240,240,${0.12 + hash(i + 17) * 0.18})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// ---------------------------------------------------------------------------
// Sky, sun, moon, clouds
// ---------------------------------------------------------------------------
const SkyDome: React.FC = () => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color(PALETTE.skyTop) },
          mid: { value: new THREE.Color(PALETTE.skyMid) },
          horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
        },
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          uniform vec3 top;
          uniform vec3 mid;
          uniform vec3 horizon;
          void main() {
            float h = normalize(vPos).y * 0.5 + 0.5;
            vec3 low = mix(horizon, mid, smoothstep(0.0, 0.30, h));
            vec3 col = mix(low, top, smoothstep(0.30, 0.95, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    [],
  );
  return (
    <mesh scale={[1, 1, 1]} renderOrder={-10}>
      <sphereGeometry args={[70, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
};

const SunGlow: React.FC = () => {
  const glow = useMemo(() => makeRadialTexture([[0, "rgba(255,236,201,1)"], [0.28, "rgba(255,196,124,0.72)"], [1, "rgba(255,180,100,0)"]]), []);
  return (
    <sprite position={[-8.5, 6.4, -30]} scale={[18, 18, 1]}>
      <spriteMaterial map={glow} color={PALETTE.sun} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  );
};

const Moon: React.FC = () => {
  const glow = useMemo(() => makeRadialTexture([[0, "rgba(255,244,215,0.9)"], [0.55, "rgba(255,220,170,0.25)"], [1, "rgba(255,210,150,0)"]]), []);
  return (
    <group position={[0, 10.6, -28]}>
      <sprite scale={[18, 18, 1]}>
        <spriteMaterial map={glow} color={PALETTE.moon} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <mesh>
        <sphereGeometry args={[4.9, 40, 40]} />
        <meshBasicMaterial color={new THREE.Color(1.65, 1.5, 1.2)} toneMapped={false} fog={false} />
      </mesh>
      <mesh rotation={[1.12, 0.18, 0.26]}>
        <torusGeometry args={[8.2, 0.07, 8, 96]} />
        <meshBasicMaterial color={PALETTE.moon} transparent opacity={0.35} toneMapped={false} fog={false} />
      </mesh>
    </group>
  );
};

const CLOUDS = [
  { x: -12, y: 12.5, z: -26, s: 10, o: 0.52 },
  { x: 10, y: 10.5, z: -25, s: 8, o: 0.44 },
  { x: -3, y: 15.0, z: -30, s: 12, o: 0.35 },
  { x: 15, y: 7.8, z: -22, s: 6.5, o: 0.5 },
  { x: -16, y: 8.5, z: -20, s: 7, o: 0.42 },
];

const Clouds: React.FC<{ frame: number }> = ({ frame }) => {
  const tex = useMemo(makeCloudTexture, []);
  return (
    <>
      {CLOUDS.map((c, i) => (
        <sprite key={i} position={[c.x + Math.sin(frame / 150 + i) * 0.8, c.y, c.z]} scale={[c.s, c.s * 0.52, 1]}>
          <spriteMaterial map={tex} transparent opacity={c.o} depthWrite={false} fog={false} />
        </sprite>
      ))}
    </>
  );
};

const Bird: React.FC<{ frame: number; i: number }> = ({ frame, i }) => {
  const x = -7 + i * 2.9 + Math.sin(frame / 95 + i) * 0.7;
  const y = 7.6 + (i % 3) * 0.55 + Math.sin(frame / 44 + i) * 0.16;
  const z = -9 - i * 0.92;
  const flap = 0.32 + Math.sin(frame / 5.5 + i * 1.7) * 0.26;
  return (
    <group position={[x, y, z]} scale={0.34}>
      <mesh rotation={[0, 0, flap]}>
        <boxGeometry args={[0.9, 0.055, 0.035]} />
        <meshBasicMaterial color="#2b2230" toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -flap]}>
        <boxGeometry args={[0.9, 0.055, 0.035]} />
        <meshBasicMaterial color="#2b2230" toneMapped={false} />
      </mesh>
    </group>
  );
};

const Birds: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {[0, 1, 2, 3, 4].map((i) => (
      <Bird key={i} frame={frame} i={i} />
    ))}
  </>
);

// ---------------------------------------------------------------------------
// Island, town, trees, water
// ---------------------------------------------------------------------------
const Island: React.FC = () => {
  const rocks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2 + hash(i + 4) * 0.2;
        const r = 5.35 + hash(i + 20) * 0.7;
        return { p: [Math.cos(a) * r, -0.04 + hash(i + 44) * 0.14, Math.sin(a) * r] as Vec3, s: 0.18 + hash(i + 72) * 0.28, r: hash(i + 99) * Math.PI };
      }),
    [],
  );
  const tufts = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const a = hash(i + 8) * Math.PI * 2;
        const r = 1.2 + hash(i + 40) * 4.2;
        return { p: [Math.cos(a) * r, 0.06, Math.sin(a) * r] as Vec3, s: 0.35 + hash(i + 70) * 0.45 };
      }),
    [],
  );
  return (
    <group>
      <mesh receiveShadow position={[0, -0.45, 0]}>
        <cylinderGeometry args={[6.2, 5.4, 0.9, 56]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={0.95} />
        <Outlines thickness={0.02} color={INK} />
      </mesh>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, -2.05, 0]}>
        <coneGeometry args={[5.4, 3.4, 56]} />
        <meshStandardMaterial color={PALETTE.rock} roughness={1} flatShading />
        <Outlines thickness={0.025} color={INK} />
      </mesh>
      {rocks.map((r, i) => (
        <mesh key={i} position={r.p} rotation={[r.r, r.r * 0.6, r.r * 0.3]} scale={r.s} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.rock : PALETTE.rockDark} roughness={1} flatShading />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
      ))}
      {tufts.map((t, i) => (
        <mesh key={i} position={t.p} scale={[t.s, t.s * 1.7, t.s]}>
          <coneGeometry args={[0.11, 1, 5]} />
          <meshStandardMaterial color={i % 3 === 0 ? PALETTE.grassLight : PALETTE.grassDark} roughness={1} />
        </mesh>
      ))}
    </group>
  );
};

type HouseProps = {
  position: Vec3;
  rotation: number;
  width: number;
  depth: number;
  height: number;
  roofHeight: number;
  wall: string;
  roof: string;
  frame: number;
  chimney?: boolean;
  tower?: boolean;
};

const House: React.FC<HouseProps> = ({ position, rotation, width, depth, height, roofHeight, wall, roof, frame, chimney = false, tower = false }) => {
  const windowY = height * 0.58;
  const windows = [-1, 1].map((side) => width * 0.24 * side);
  const glow = useMemo(
    () => makeRadialTexture([[0, "rgba(255,226,160,0.95)"], [0.45, "rgba(255,180,80,0.35)"], [1, "rgba(255,150,60,0)"]]),
    [],
  );
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={wall} roughness={0.92} />
        <Outlines thickness={0.022} color={INK} />
      </mesh>

      {/* hip roof: a four-sided cone reads as a stylised painted roof */}
      <mesh castShadow position={[0, height + roofHeight / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(width, depth) * 0.82, roofHeight, 4]} />
        <meshStandardMaterial color={roof} roughness={0.9} flatShading />
        <Outlines thickness={0.024} color={INK} />
      </mesh>

      {/* front windows */}
      {windows.map((x, i) => (
        <group key={i} position={[x, windowY, depth / 2 + 0.012]}>
          <mesh>
            <planeGeometry args={[width * 0.2, height * 0.2]} />
            <meshBasicMaterial color={new THREE.Color(2.3, 1.55, 0.72)} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.006]}>
            <boxGeometry args={[width * 0.23, height * 0.23, 0.03]} />
            <meshStandardMaterial color={PALETTE.woodDark} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.023]}>
            <planeGeometry args={[width * 0.2, height * 0.2]} />
            <meshBasicMaterial color={new THREE.Color(2.3, 1.55, 0.72)} toneMapped={false} />
          </mesh>
          <sprite position={[0, 0, 0.07]} scale={[0.62, 0.62, 1]}>
            <spriteMaterial
              map={glow}
              color="#ffd27a"
              transparent
              opacity={0.34}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}

      {/* door */}
      <mesh position={[0, 0.46, depth / 2 + 0.014]}>
        <planeGeometry args={[width * 0.22, 0.86]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.9} />
        <Outlines thickness={0.012} color={INK} />
      </mesh>

      {chimney && (
        <group position={[width * 0.27, height + roofHeight * 0.55, -depth * 0.16]}>
          <mesh castShadow>
            <boxGeometry args={[0.24, 0.9, 0.24]} />
            <meshStandardMaterial color={PALETTE.brick} roughness={1} />
            <Outlines thickness={0.015} color={INK} />
          </mesh>
          <Smoke frame={frame} />
        </group>
      )}

      {tower && (
        <group position={[0, height + roofHeight * 0.55, 0]}>
          <mesh castShadow>
            <boxGeometry args={[width * 0.34, roofHeight * 1.5, depth * 0.34]} />
            <meshStandardMaterial color={wall} roughness={0.92} />
            <Outlines thickness={0.018} color={INK} />
          </mesh>
          <mesh position={[0, roofHeight * 0.92, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[width * 0.3, roofHeight * 0.8, 4]} />
            <meshStandardMaterial color={roof} roughness={0.9} flatShading />
            <Outlines thickness={0.02} color={INK} />
          </mesh>
        </group>
      )}
    </group>
  );
};

const Smoke: React.FC<{ frame: number }> = ({ frame }) => {
  const tex = useMemo(() => makeRadialTexture([[0, "rgba(240,230,216,0.9)"], [0.5, "rgba(220,208,194,0.35)"], [1, "rgba(210,198,184,0)"]]), []);
  return (
    <>
      {[0, 1, 2].map((i) => {
        const life = ((frame * 0.008 + i * 0.33) % 1 + 1) % 1;
        const y = 0.35 + life * 2.1;
        const x = Math.sin(life * 5.2 + i) * 0.24;
        const opacity = 0.23 * (1 - life);
        const scale = 0.32 + life * 0.65;
        return (
          <sprite key={i} position={[x, y, 0]} scale={[scale, scale, 1]}>
            <spriteMaterial map={tex} transparent opacity={opacity} depthWrite={false} />
          </sprite>
        );
      })}
    </>
  );
};

const Town: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <House frame={frame} position={[-3.2, 0, -2.6]} rotation={0.3} width={2.4} depth={1.8} height={3.2} roofHeight={1.5} wall={PALETTE.cream} roof={PALETTE.terracotta} chimney />
    <House frame={frame} position={[-0.7, 0, -3.5]} rotation={0.12} width={2.2} depth={1.8} height={3.8} roofHeight={1.6} wall={PALETTE.ochre} roof={PALETTE.slate} />
    <House frame={frame} position={[1.9, 0, -3.7]} rotation={-0.16} width={2.6} depth={2.0} height={3.4} roofHeight={1.7} wall={PALETTE.cream} roof={PALETTE.brick} chimney />
    <House frame={frame} position={[4.3, 0, -2.2]} rotation={-0.4} width={2.0} depth={1.7} height={3.0} roofHeight={1.4} wall={PALETTE.terracotta} roof={PALETTE.moss} />
    <House frame={frame} position={[-4.9, 0, 0.0]} rotation={0.62} width={1.9} depth={1.6} height={2.8} roofHeight={1.3} wall={PALETTE.cream} roof={PALETTE.slate} />
    <House frame={frame} position={[0.5, 0, -5.1]} rotation={-0.05} width={2.0} depth={1.8} height={5.2} roofHeight={2.2} wall={PALETTE.cream} roof={PALETTE.slate} tower />
  </>
);

const Tree: React.FC<{ position: Vec3; scale: number; frame: number; phase: number; tone: string }> = ({ position, scale, frame, phase, tone }) => {
  const sway = swayAt(frame, phase) * 0.012;
  return (
    <group position={position} scale={scale} rotation={[0, hash(phase * 13 + 1) * Math.PI * 2, sway]}>
      <mesh castShadow position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.13, 0.2, 1.8, 7]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={1} />
        <Outlines thickness={0.02} color={INK} />
      </mesh>
      <mesh castShadow position={[0, 2.2, 0]}>
        <icosahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial color={tone} roughness={0.95} flatShading />
        <Outlines thickness={0.022} color={INK} />
      </mesh>
      <mesh castShadow position={[0.48, 2.75, 0.08]} scale={0.72}>
        <icosahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial color={tone} roughness={0.95} flatShading />
        <Outlines thickness={0.024} color={INK} />
      </mesh>
      <mesh castShadow position={[-0.42, 2.55, -0.05]} scale={0.58}>
        <icosahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial color={PALETTE.grassDark} roughness={0.95} flatShading />
        <Outlines thickness={0.026} color={INK} />
      </mesh>
    </group>
  );
};

const TREES: Array<{ p: Vec3; s: number; tone: string }> = [
  { p: [-5.3, 0, 2.4], s: 1.15, tone: PALETTE.grassDark },
  { p: [-4.6, 0, -4.2], s: 1.0, tone: PALETTE.grass },
  { p: [5.2, 0, 1.4], s: 1.2, tone: PALETTE.grass },
  { p: [5.6, 0, -2.0], s: 0.95, tone: PALETTE.grassDark },
  { p: [-2.6, 0, -5.4], s: 0.9, tone: PALETTE.grass },
  { p: [3.4, 0, -5.3], s: 0.85, tone: PALETTE.grassDark },
  { p: [-0.2, 0, 3.8], s: 0.72, tone: PALETTE.grass },
  { p: [3.8, 0, 3.2], s: 0.8, tone: PALETTE.grassDark },
];

const Trees: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {TREES.map((t, i) => (
      <Tree key={i} position={t.p} scale={t.s} frame={frame} phase={i + 1} tone={t.tone} />
    ))}
  </>
);

const Pond: React.FC<{ frame: number }> = ({ frame }) => {
  const water = useMemo(makeWaterTexture, []);
  water.offset.set(frame * 0.0018, frame * 0.0024);
  const stones = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return { p: [-2.7 + Math.cos(a) * 1.7, 0.06, 1.5 + Math.sin(a) * 1.45] as Vec3, s: 0.12 + hash(i + 5) * 0.16 };
      }),
    [],
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.7, 0.025, 1.5]}>
        <circleGeometry args={[1.55, 56]} />
        <meshPhysicalMaterial map={water} color={PALETTE.water} roughness={0.16} metalness={0.12} clearcoat={0.7} clearcoatRoughness={0.2} transparent opacity={0.94} />
      </mesh>
      {/* lily pads */}
      {[
        [-3.2, 0.045, 1.1, 0.28],
        [-2.2, 0.046, 1.8, 0.22],
        [-3.4, 0.047, 2.0, 0.18],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, hash(i + 30) * Math.PI]} position={[x, y, z]}>
          <circleGeometry args={[r, 22]} />
          <meshStandardMaterial color={PALETTE.grassDark} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {stones.map((s, i) => (
        <mesh key={i} position={s.p} scale={s.s} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={i % 2 ? PALETTE.rock : PALETTE.rockDark} roughness={1} flatShading />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
      ))}
    </group>
  );
};

const Lantern: React.FC<{ position: Vec3; frame: number; phase: number }> = ({ position, frame, phase }) => {
  const swing = Math.sin(frame / 38 + phase) * 0.05;
  const glow = useMemo(
    () => makeRadialTexture([[0, "rgba(255,226,160,0.95)"], [0.4, "rgba(255,170,70,0.4)"], [1, "rgba(255,140,50,0)"]]),
    [],
  );
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.055, 0.085, 2.6, 8]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.95} />
        <Outlines thickness={0.018} color={INK} />
      </mesh>
      <group position={[0.18, 2.48, 0]} rotation={[0, 0, swing]}>
        <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.38, 7]} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={1} />
        </mesh>
        <mesh position={[0.34, -0.12, 0]}>
          <boxGeometry args={[0.24, 0.3, 0.24]} />
          <meshBasicMaterial color={new THREE.Color(3.2, 1.85, 0.7)} toneMapped={false} />
        </mesh>
        <mesh position={[0.34, 0.08, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.22, 0.16, 4]} />
          <meshStandardMaterial color={PALETTE.woodDark} roughness={1} />
          <Outlines thickness={0.016} color={INK} />
        </mesh>
        <sprite position={[0.34, -0.12, 0.2]} scale={[1.05, 1.05, 1]}>
          <spriteMaterial
            map={glow}
            color="#ffb45e"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      </group>
    </group>
  );
};

const Lanterns: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <Lantern position={[3.7, 0, 2.0]} frame={frame} phase={0.4} />
    <Lantern position={[-3.9, 0, 2.2]} frame={frame} phase={1.7} />
    <pointLight position={[4.05, 2.35, 2.0]} color={PALETTE.lantern} intensity={12} distance={7} decay={2} />
  </>
);

const Flowers: React.FC = () => {
  const items = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const a = hash(i + 12) * Math.PI * 2;
        const r = 1.4 + hash(i + 47) * 4.0;
        const colors = [PALETTE.window, PALETTE.scarf, "#b78bd1", PALETTE.cream];
        return { p: [Math.cos(a) * r, 0.19, Math.sin(a) * r] as Vec3, c: colors[i % colors.length] };
      }),
    [],
  );
  return (
    <>
      {items.map((it, i) => (
        <mesh key={i} position={it.p}>
          <sphereGeometry args={[0.075, 8, 8]} />
          <meshStandardMaterial color={it.c} roughness={0.8} />
        </mesh>
      ))}
    </>
  );
};

const Fireflies: React.FC<{ frame: number }> = ({ frame }) => {
  const items = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const a = hash(i + 21) * Math.PI * 2;
        const r = 1.4 + hash(i + 63) * 4.3;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.45 + hash(i + 87) * 2.2, phase: hash(i + 5) * Math.PI * 2 };
      }),
    [],
  );
  return (
    <>
      {items.map((it, i) => {
        const y = it.y + Math.sin(frame / 18 + it.phase) * 0.13;
        const x = it.x + Math.sin(frame / 31 + it.phase) * 0.08;
        const s = 0.65 + Math.sin(frame / 9 + it.phase) * 0.3;
        return (
          <mesh key={i} position={[x, y, it.z]} scale={s}>
            <sphereGeometry args={[0.032, 7, 7]} />
            <meshBasicMaterial color={new THREE.Color(3.4, 2.25, 0.95)} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
};

const Foreground: React.FC<{ frame: number }> = ({ frame }) => {
  const leaf = useMemo(makeLeafTexture, []);
  const branch = useMemo(
    () => new THREE.CylinderGeometry(0.09, 0.17, 4.2, 7),
    [],
  );
  return (
    <>
      <group position={[-2.7, 0.2, 6.3]} rotation={[0.1, 0.5, -0.62 + Math.sin(frame / 70) * 0.01]}>
        <mesh geometry={branch} castShadow>
          <meshStandardMaterial color={PALETTE.woodDark} roughness={1} />
          <Outlines thickness={0.02} color={INK} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0.35 + i * 0.08, 0.8 + i * 0.62, 0]} rotation={[0, 0.2 * i, -0.75 + i * 0.12]} scale={[1.1, 1.9, 1]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={leaf} transparent alphaTest={0.2} side={THREE.DoubleSide} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </>
  );
};

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------
const Lights: React.FC = () => (
  <>
    <ambientLight intensity={0.28} color="#ffe1c2" />
    <hemisphereLight args={["#cfe0ff", "#6b4a2f", 0.7]} />
    <directionalLight
      castShadow
      position={[7, 11, 8]}
      intensity={2.1}
      color="#ffd6a0"
      shadow-mapSize-width={1024}
      shadow-mapSize-height={1024}
      shadow-camera-left={-12}
      shadow-camera-right={12}
      shadow-camera-top={12}
      shadow-camera-bottom={-12}
      shadow-camera-near={0.5}
      shadow-camera-far={40}
      shadow-bias={-0.0006}
    />
    <directionalLight position={[-7, 7, -12]} intensity={1.6} color="#ffb36b" />
    <directionalLight position={[-3, 4, 9]} intensity={0.35} color="#9fc2ff" />
  </>
);

export const World: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <SkyDome />
    <SunGlow />
    <Moon />
    <Clouds frame={frame} />
    <Birds frame={frame} />
    <Lights />
    <Island />
    <Town frame={frame} />
    <Trees frame={frame} />
    <Pond frame={frame} />
    <Lanterns frame={frame} />
    <Flowers />
    <Fireflies frame={frame} />
    <Foreground frame={frame} />
  </>
);
