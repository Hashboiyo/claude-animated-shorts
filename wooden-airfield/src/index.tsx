
/*
========================================================================
THE WOODEN AIRFIELD
A 21-SCENE 1-BIT NOIR DOCUMENTARY
========================================================================

ART DIRECTION
------------
Reference: Return of the Obra Dinn
Visual language: Engraved monochrome illustration
Output: Strict black and ivory
Dithering: Ordered 4x4 Bayer
Surface detail: Material-specific engraving
Lighting: Hard chiaroscuro, silhouette, rim light
Animation: Deterministic Remotion frame timeline
Camera: Individually choreographed shots
Format: 1080 x 1920, 24 FPS, 77.333 seconds (synced to supplied narration)

IMPORTANT
---------
This is a self-contained procedural 3D production.
It uses custom procedural geometry rather than external video footage.
The scene assets are deliberately shared to preserve continuity.

INSTALL
-------
npm ci

RENDER
------
npx remotion render src/index.tsx WoodenAirfield out/film.mp4

AUDIO FILES (OPTIONAL)
---------------------
public/audio/narration.mp3 (included, enabled by default)
public/audio/score.wav
public/audio/aircraft.wav
public/audio/construction.wav
public/audio/wood-impact.wav

========================================================================
*/

import timing from "./timing.json";

import React, {useMemo} from "react";
import * as THREE from "three";
import {ThreeCanvas} from "@remotion/three";
import {useThree} from "@react-three/fiber";

import {
  AbsoluteFill,
  Audio,
  Composition,
  Sequence,
  staticFile,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ====================================================================
// 01. GLOBAL FILM CONFIGURATION
// ====================================================================

const FPS = timing.fps;
const WIDTH = 1080;
const HEIGHT = 1920;
const TOTAL_FRAMES = timing.totalFrames;
const DURATION_SECONDS = TOTAL_FRAMES / FPS;

const BLACK = "#030303";
const IVORY = "#eee9dc";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

const smooth = (n: number) => {
  const x = clamp(n);
  return x * x * (3 - 2 * x);
};

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * t;

type V3 = [number, number, number];

type MaterialName =
  | "wood"
  | "woodLight"
  | "woodDark"
  | "cloth"
  | "clothDark"
  | "metal"
  | "paper"
  | "stone"
  | "earth"
  | "grass"
  | "water"
  | "ink"
  | "ivory";

// ====================================================================
// 02. THE VISUAL MATERIAL ENGINE
//
// This is not a random pixelation filter.
//
// Every material receives:
// - World-space material detail.
// - Deterministic 4x4 Bayer dithering.
// - Shadow-specific engraving.
// - A binary black/ivory final surface.
//
// The screen-space Bayer pattern is deliberately stable.
// No random noise, grain generation or temporal flicker.
// ====================================================================

type MaterialPattern =
  | "wood"
  | "cloth"
  | "metal"
  | "paper"
  | "stone"
  | "earth"
  | "grass"
  | "water"
  | "plain";

function createInkMaterial(
  color: string,
  pattern: MaterialPattern
) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const patterns: Record<MaterialPattern, string> = {
    wood: `
      float grain = sin(
        vInkWorld.x * 18.0 +
        sin(vInkWorld.z * 2.0) * 2.0
      );

      float grainFine = sin(
        vInkWorld.x * 57.0 +
        vInkWorld.y * 1.5
      );

      float knot = sin(
        length(vInkWorld.xz * vec2(0.55, 1.8)) * 22.0
      );

      inkLum += grain * 0.048;
      inkLum += grainFine * 0.016;
      inkLum += knot * 0.009;
    `,

    cloth: `
      float weaveA = step(
        0.91,
        fract(vInkWorld.x * 12.0)
      );

      float weaveB = step(
        0.91,
        fract(vInkWorld.y * 12.0)
      );

      inkLum -= (weaveA + weaveB) * 0.025;
    `,

    metal: `
      float brushed = sin(
        vInkWorld.x * 75.0 +
        vInkWorld.z * 0.5
      );

      inkLum += brushed * 0.022;
    `,

    paper: `
      float fibreA = sin(
        vInkWorld.x * 29.0 +
        vInkWorld.z * 4.0
      );

      float fibreB = sin(
        vInkWorld.y * 19.0
      );

      inkLum += fibreA * 0.014;
      inkLum += fibreB * 0.009;
    `,

    stone: `
      float masonry = step(
        0.93,
        fract(vInkWorld.x * 3.5)
      );

      inkLum -= masonry * 0.035;
    `,

    earth: `
      float soilA = sin(vInkWorld.x * 6.0);
      float soilB = sin(vInkWorld.z * 12.0);

      inkLum += soilA * 0.024;
      inkLum += soilB * 0.015;
    `,

    grass: `
      float bladeA = step(
        0.92,
        fract(vInkWorld.x * 14.0)
      );

      float bladeB = step(
        0.95,
        fract(vInkWorld.z * 11.0)
      );

      inkLum += (bladeA + bladeB) * 0.035;
    `,

    water: `
      float ripple = sin(
        vInkWorld.z * 13.0 +
        vInkWorld.x * 2.0
      );

      inkLum += ripple * 0.065;
    `,

    plain: "",
  };

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `
        #include <common>
        varying vec3 vInkWorld;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `
        #include <begin_vertex>
        vInkWorld =
          (modelMatrix * vec4(position, 1.0)).xyz;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
        #include <common>

        varying vec3 vInkWorld;

        float bayer4(vec2 p) {
          float x = mod(p.x, 4.0);
          float y = mod(p.y, 4.0);
          float v = 0.0;

          if (y < 1.0) {
            if (x < 1.0) v = 0.0;
            else if (x < 2.0) v = 8.0;
            else if (x < 3.0) v = 2.0;
            else v = 10.0;
          }
          else if (y < 2.0) {
            if (x < 1.0) v = 12.0;
            else if (x < 2.0) v = 4.0;
            else if (x < 3.0) v = 14.0;
            else v = 6.0;
          }
          else if (y < 3.0) {
            if (x < 1.0) v = 3.0;
            else if (x < 2.0) v = 11.0;
            else if (x < 3.0) v = 1.0;
            else v = 9.0;
          }
          else {
            if (x < 1.0) v = 15.0;
            else if (x < 2.0) v = 7.0;
            else if (x < 3.0) v = 13.0;
            else v = 5.0;
          }

          return (v + 0.5) / 16.0;
        }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <dithering_fragment>",
      `
        float inkLum = dot(
          gl_FragColor.rgb,
          vec3(0.2126, 0.7152, 0.0722)
        );

        ${patterns[pattern]}

        inkLum = clamp(inkLum, 0.0, 1.0);

        // Engraving in deep shadow, never random.
        float darkness = 1.0 -
          smoothstep(0.12, 0.52, inkLum);

        float hatchA = step(
          0.93,
          fract((vInkWorld.x + vInkWorld.y) * 3.1)
        );

        float hatchB = step(
          0.94,
          fract((vInkWorld.x - vInkWorld.y) * 3.1)
        );

        inkLum -= darkness *
          (hatchA + hatchB) * 0.052;

        inkLum = clamp(inkLum, 0.0, 1.0);

        // Fixed screen-space Bayer threshold.
        vec2 pixel = floor(gl_FragCoord.xy / 2.0);

        float threshold = bayer4(pixel);

        float binaryInk = step(
          threshold,
          inkLum
        );

        // Strict two-tone output.
        gl_FragColor.rgb = vec3(binaryInk);
        gl_FragColor.a = 1.0;
      `
    );
  };

  material.customProgramCacheKey = () =>
    `wooden-airfield-ink-${pattern}`;

  return material;
}

const M: Record<MaterialName, THREE.MeshStandardMaterial> = {
  wood: createInkMaterial("#aaa497", "wood"),
  woodLight: createInkMaterial("#e5dfd2", "wood"),
  woodDark: createInkMaterial("#393630", "wood"),
  cloth: createInkMaterial("#b0aa9e", "cloth"),
  clothDark: createInkMaterial("#34322e", "cloth"),
  metal: createInkMaterial("#a8a49b", "metal"),
  paper: createInkMaterial("#e7e2d6", "paper"),
  stone: createInkMaterial("#8d8980", "stone"),
  earth: createInkMaterial("#656157", "earth"),
  grass: createInkMaterial("#777268", "grass"),
  water: createInkMaterial("#292927", "water"),
  ink: createInkMaterial("#050505", "plain"),
  ivory: createInkMaterial("#ffffff", "plain"),
};

// ====================================================================
// 03. GEOMETRY PRIMITIVES
// ====================================================================

const Box: React.FC<{
  p?: V3;
  s?: V3;
  r?: V3;
  m?: MaterialName;
}> = ({
  p = [0, 0, 0],
  s = [1, 1, 1],
  r = [0, 0, 0],
  m = "wood",
}) => (
  <mesh
    position={p}
    rotation={r}
    material={M[m]}
    castShadow
    receiveShadow
  >
    <boxGeometry args={s} />
  </mesh>
);

const Sphere: React.FC<{
  p?: V3;
  s?: V3;
  m?: MaterialName;
  detail?: number;
}> = ({
  p = [0, 0, 0],
  s = [1, 1, 1],
  m = "ivory",
  detail = 12,
}) => (
  <mesh
    position={p}
    scale={s}
    material={M[m]}
    castShadow
    receiveShadow
  >
    <sphereGeometry args={[1, detail, 8]} />
  </mesh>
);

const Cylinder: React.FC<{
  p?: V3;
  r?: V3;
  top?: number;
  bottom?: number;
  h?: number;
  m?: MaterialName;
  segments?: number;
}> = ({
  p = [0, 0, 0],
  r = [0, 0, 0],
  top = 0.5,
  bottom = 0.5,
  h = 1,
  m = "wood",
  segments = 10,
}) => (
  <mesh
    position={p}
    rotation={r}
    material={M[m]}
    castShadow
    receiveShadow
  >
    <cylinderGeometry args={[top, bottom, h, segments]} />
  </mesh>
);

const Cone: React.FC<{
  p?: V3;
  r?: V3;
  radius?: number;
  h?: number;
  m?: MaterialName;
}> = ({
  p = [0, 0, 0],
  r = [0, 0, 0],
  radius = 1,
  h = 1,
  m = "wood",
}) => (
  <mesh
    position={p}
    rotation={r}
    material={M[m]}
    castShadow
  >
    <coneGeometry args={[radius, h, 9]} />
  </mesh>
);

const Plane: React.FC<{
  p?: V3;
  r?: V3;
  size?: [number, number];
  m?: MaterialName;
}> = ({
  p = [0, 0, 0],
  r = [-Math.PI / 2, 0, 0],
  size = [20, 20],
  m = "earth",
}) => (
  <mesh
    position={p}
    rotation={r}
    material={M[m]}
    receiveShadow
  >
    <planeGeometry args={size} />
  </mesh>
);

const Beam: React.FC<{
  a: V3;
  b: V3;
  radius?: number;
  m?: MaterialName;
}> = ({
  a,
  b,
  radius = 0.08,
  m = "wood",
}) => {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const length = direction.length();

  const midpoint = start.clone().add(end).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return (
    <mesh
      position={midpoint.toArray()}
      quaternion={quaternion}
      material={M[m]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry
        args={[radius, radius, length, 7]}
      />
    </mesh>
  );
};

// ====================================================================
// 04. ARCHITECTURAL AND SURFACE ASSETS
// ====================================================================

const Tree: React.FC<{
  p: V3;
  scale?: number;
}> = ({p, scale = 1}) => (
  <group position={p} scale={scale}>
    <Cylinder
      p={[0, 2.4, 0]}
      top={0.12}
      bottom={0.23}
      h={4.8}
      m="woodDark"
    />

    <Beam a={[0, 2, 0]} b={[-1.1, 4.2, 0]} radius={0.1} m="woodDark" />
    <Beam a={[0, 2.7, 0]} b={[1.3, 4.6, 0.1]} radius={0.1} m="woodDark" />
    <Beam a={[0, 3.2, 0]} b={[-0.3, 5.6, 0.1]} radius={0.08} m="woodDark" />
    <Beam a={[-0.7, 3.7, 0]} b={[-1.7, 5.1, 0]} radius={0.06} m="woodDark" />
    <Beam a={[0.7, 4.1, 0]} b={[1.8, 5.4, 0]} radius={0.06} m="woodDark" />
    <Beam a={[-1.1, 4.4, 0]} b={[-2, 5.2, 0]} radius={0.04} m="woodDark" />
    <Beam a={[1.3, 4.8, 0]} b={[2.1, 5.7, 0]} radius={0.04} m="woodDark" />
  </group>
);

const Cloud: React.FC<{
  p: V3;
  scale?: number;
}> = ({p, scale = 1}) => (
  <group position={p} scale={scale}>
    <Sphere p={[-2, 0, 0]} s={[2.8, 1.1, 1.8]} m="ivory" />
    <Sphere p={[0, 0.4, 0]} s={[3.4, 1.6, 2.1]} m="paper" />
    <Sphere p={[2.6, 0, 0]} s={[2.5, 1.0, 1.7]} m="ivory" />
    <Sphere p={[0.7, 1.1, 0]} s={[1.9, 0.8, 1.6]} m="paper" />
  </group>
);

const Smoke: React.FC<{
  p: V3;
  scale?: number;
}> = ({p, scale = 1}) => (
  <group position={p} scale={scale}>
    <Sphere p={[0, 0, 0]} s={[1.2, 1.3, 1.1]} m="ink" />
    <Sphere p={[0.3, 1.1, 0]} s={[1.5, 1.7, 1.4]} m="woodDark" />
    <Sphere p={[-0.4, 2.6, 0.1]} s={[1.8, 2.1, 1.5]} m="ink" />
    <Sphere p={[0.4, 4.2, 0]} s={[2.0, 2.0, 1.8]} m="woodDark" />
    <Sphere p={[-0.3, 5.5, 0]} s={[2.3, 1.8, 1.9]} m="ink" />
  </group>
);

const Church: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <Box p={[0, 3, 0]} s={[3, 6, 3]} m="stone" />
    <Box p={[0, 6.4, 0]} s={[2.5, 1, 2.5]} m="woodDark" />

    <Cone p={[0, 9, 0]} radius={1.55} h={4} m="stone" />

    <Box p={[0, 11.2, 0]} s={[0.12, 1.3, 0.12]} m="ink" />
    <Box p={[0, 11.3, 0]} s={[0.9, 0.12, 0.12]} m="ink" />

    <Box p={[-0.85, 4.4, 1.53]} s={[0.4, 1.3, 0.08]} m="ink" />
    <Box p={[0.85, 4.4, 1.53]} s={[0.4, 1.3, 0.08]} m="ink" />
    <Box p={[0, 1.8, 1.54]} s={[0.8, 1.8, 0.08]} m="ink" />

    <Box p={[-1.6, 1.8, 0]} s={[0.45, 3.6, 0.45]} m="stone" />
    <Box p={[1.6, 1.8, 0]} s={[0.45, 3.6, 0.45]} m="stone" />
  </group>
);

const Farmhouse: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <Box p={[0, 1.8, 0]} s={[6, 3.6, 5]} m="stone" />

    <Box
      p={[-1.4, 3.9, 0]}
      s={[3.6, 0.25, 5.5]}
      r={[0, 0, 0.62]}
      m="woodDark"
    />

    <Box
      p={[1.4, 3.9, 0]}
      s={[3.6, 0.25, 5.5]}
      r={[0, 0, -0.62]}
      m="woodDark"
    />

    <Box p={[0, 0.9, 2.55]} s={[1, 1.8, 0.1]} m="ink" />
    <Box p={[-2, 2.1, 2.55]} s={[0.8, 0.9, 0.08]} m="ink" />
    <Box p={[2, 2.1, 2.55]} s={[0.8, 0.9, 0.08]} m="ink" />

    <Box p={[2, 5.0, -1]} s={[0.8, 2.2, 0.8]} m="stone" />
  </group>
);

// ====================================================================
// 05. DUTCH LANDSCAPE MASTER
//
// Continuity anchors:
// - Canal to the right.
// - Church at the far horizon.
// - Farmhouses on the left and far right.
// - Agricultural furrows.
// - Same runway orientation in every return shot.
// ====================================================================

const DutchWorld: React.FC = () => (
  <group>
    <Plane p={[0, -0.25, 0]} size={[150, 150]} m="earth" />

    {/* Farmland furrows */}
    {Array.from({length: 17}).map((_, i) => (
      <Box
        key={`field-${i}`}
        p={[-56 + i * 7, -0.15, -5]}
        s={[0.045, 0.025, 105]}
        m="grass"
      />
    ))}

    {/* Canal */}
    <Plane
      p={[26, -0.12, 0]}
      size={[5, 145]}
      m="water"
    />

    <Box p={[23.3, 0, 0]} s={[0.28, 0.3, 145]} m="earth" />
    <Box p={[28.7, 0, 0]} s={[0.28, 0.3, 145]} m="earth" />

    {Array.from({length: 25}).map((_, i) => (
      <Box
        key={`water-${i}`}
        p={[26, -0.045, -58 + i * 4.7]}
        s={[2.5, 0.018, 0.035]}
        m="ivory"
      />
    ))}

    {/* Hedgerows */}
    <Box p={[-30, 0.5, -18]} s={[0.5, 1, 68]} m="clothDark" />
    <Box p={[34, 0.5, -22]} s={[0.5, 1, 65]} m="clothDark" />

    {/* Architecture */}
    <Church p={[10, 0, -48]} />
    <Farmhouse p={[-33, 0, -32]} />
    <Farmhouse p={[37, 0, -18]} />

    {/* Bare trees */}
    <Tree p={[-25, 0, -15]} scale={1.15} />
    <Tree p={[18, 0, -37]} scale={0.85} />
    <Tree p={[-37, 0, 13]} scale={1.05} />
    <Tree p={[31, 0, 25]} scale={1.2} />
    <Tree p={[-17, 0, 37]} scale={0.8} />

    {/* Overcast cloud formations */}
    <Cloud p={[-20, 24, -45]} scale={2.0} />
    <Cloud p={[12, 28, -55]} scale={2.2} />
    <Cloud p={[39, 23, -34]} scale={1.6} />
  </group>
);

// ====================================================================
// 06. RUNWAY AND TIMBER CONSTRUCTION
// ====================================================================

const WoodenRunway: React.FC<{
  progress?: number;
  close?: boolean;
}> = ({
  progress = 1,
  close = false,
}) => {
  const boardCount = Math.max(2, Math.ceil(46 * progress));

  return (
    <group
      scale={close ? [1.2, 1, 1.25] : [1, 1, 1]}
      rotation={[0, -0.12, 0]}
    >
      {/* Supporting beams */}
      {Array.from({length: 12}).map((_, i) => (
        <Box
          key={`support-${i}`}
          p={[0, -0.05, -22 + i * 4]}
          s={[9, 0.25, 0.34]}
          m="woodDark"
        />
      ))}

      {/* Plank-by-plank construction */}
      {Array.from({length: boardCount}).map((_, i) => {
        const z = -23 + i * 1.02;

        return (
          <group key={`plank-${i}`}>
            <Box
              p={[0, 0.12, z]}
              s={[8.7, 0.17, 0.96]}
              m={i % 4 === 0 ? "woodLight" : "wood"}
            />

            {/* Visible nail heads */}
            {i % 3 === 0 && (
              <>
                <Sphere p={[-4.1, 0.23, z]} s={[0.055, 0.022, 0.055]} m="metal" detail={6} />
                <Sphere p={[4.1, 0.23, z]} s={[0.055, 0.022, 0.055]} m="metal" detail={6} />
              </>
            )}
          </group>
        );
      })}

      <Box p={[-4.45, 0.1, 0]} s={[0.16, 0.3, 47]} m="woodDark" />
      <Box p={[4.45, 0.1, 0]} s={[0.16, 0.3, 47]} m="woodDark" />
    </group>
  );
};

// ====================================================================
// 07. HANGAR MASTER
// ====================================================================

const Hangar: React.FC<{
  p: V3;
  scale?: number;
  open?: boolean;
  broken?: boolean;
}> = ({
  p,
  scale = 1,
  open = true,
  broken = false,
}) => (
  <group position={p} scale={scale}>
    {/* Timber columns */}
    <Box p={[-4, 2.6, -3.5]} s={[0.3, 5.2, 0.3]} m="woodDark" />
    <Box p={[4, 2.6, -3.5]} s={[0.3, 5.2, 0.3]} m="woodDark" />
    <Box p={[-4, 2.6, 3.5]} s={[0.3, 5.2, 0.3]} m="woodDark" />
    <Box p={[4, 2.6, 3.5]} s={[0.3, 5.2, 0.3]} m="woodDark" />

    {/* Main beams */}
    <Box p={[0, 5.1, -3.5]} s={[8.3, 0.28, 0.3]} m="wood" />
    <Box p={[0, 5.1, 3.5]} s={[8.3, 0.28, 0.3]} m="wood" />

    {/* Roof structure */}
    {[-3.5, 0, 3.5].map((z) => (
      <group key={z}>
        <Beam a={[-4, 5, z]} b={[0, 7.2, z]} radius={0.15} />
        <Beam a={[0, 7.2, z]} b={[4, 5, z]} radius={0.15} />
      </group>
    ))}

    <Beam a={[-4, 5, -3.5]} b={[-4, 5, 3.5]} radius={0.1} />
    <Beam a={[4, 5, -3.5]} b={[4, 5, 3.5]} radius={0.1} />
    <Beam a={[0, 7.2, -3.5]} b={[0, 7.2, 3.5]} radius={0.12} />

    {/* Doorway */}
    <Box
      p={[0, 2.25, 3.55]}
      s={[5.1, 4.4, 0.08]}
      m="ink"
    />

    {open ? (
      <>
        <Box p={[-3.2, 2.1, 3.65]} s={[1.35, 4.1, 0.16]} m="wood" />
        <Box p={[3.2, 2.1, 3.65]} s={[1.35, 4.1, 0.16]} m="wood" />
      </>
    ) : (
      <Box p={[0, 2.2, 3.65]} s={[6.9, 4.3, 0.18]} m="wood" />
    )}

    {/* Broken structural timber */}
    {broken && (
      <>
        <Beam a={[-4, 4.5, -3]} b={[2, 1.0, 3]} radius={0.2} m="woodDark" />
        <Beam a={[4, 4.2, 2]} b={[-1, 1.0, -2]} radius={0.18} m="woodDark" />
        <Box p={[0, 0.35, 2]} s={[5, 0.25, 0.4]} r={[0, 0, 0.2]} m="wood" />
      </>
    )}
  </group>
);

// ====================================================================
// 08. AIRCRAFT MASTER
//
// One consistent fighter asset appears throughout the film.
// Wood and metal variants share proportions and silhouette.
// ====================================================================

const Wing: React.FC<{
  p?: V3;
  scale?: V3;
  m?: MaterialName;
}> = ({
  p = [0, 0, 0],
  scale = [1, 1, 1],
  m = "wood",
}) => {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();

    shape.moveTo(-4.7, -0.65);
    shape.lineTo(4.7, -0.65);
    shape.lineTo(4.15, 0.65);
    shape.lineTo(-4.15, 0.65);
    shape.closePath();

    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.025,
      bevelThickness: 0.025,
    });

    g.rotateX(Math.PI / 2);
    return g;
  }, []);

  return (
    <mesh
      geometry={geometry}
      position={p}
      scale={scale}
      material={M[m]}
      castShadow
      receiveShadow
    />
  );
};

const Roundel: React.FC<{
  p: V3;
  scale?: number;
}> = ({
  p,
  scale = 1,
}) => (
  <group position={p} scale={scale}>
    <Cylinder p={[0, 0, 0]} top={0.48} bottom={0.48} h={0.025} m="ivory" segments={20} />
    <Cylinder p={[0, 0.025, 0]} top={0.31} bottom={0.31} h={0.025} m="ink" segments={20} />
    <Cylinder p={[0, 0.05, 0]} top={0.14} bottom={0.14} h={0.025} m="ivory" segments={20} />
  </group>
);

const Aircraft: React.FC<{
  p: V3;
  scale?: number;
  rotation?: V3;
  type?: "wood" | "metal";
  frame?: number;
  propeller?: boolean;
  markings?: boolean;
}> = ({
  p,
  scale = 1,
  rotation = [0, 0, 0],
  type = "wood",
  frame = 0,
  propeller = true,
  markings = false,
}) => {
  const mat: MaterialName =
    type === "wood" ? "wood" : "metal";

  const propRotation = propeller
    ? frame * 0.82
    : 0;

  return (
    <group position={p} scale={scale} rotation={rotation}>
      {/* Fuselage */}
      <Cylinder
        p={[0, 0, 0]}
        r={[Math.PI / 2, 0, 0]}
        top={0.26}
        bottom={0.26}
        h={5.3}
        m={mat}
        segments={14}
      />

      {/* Nose */}
      <Cone
        p={[0, 0, -2.9]}
        r={[-Math.PI / 2, 0, 0]}
        radius={0.27}
        h={0.9}
        m={mat}
      />

      {/* Wings */}
      <Wing m={mat} />

      {/* Rear stabilizer */}
      <Wing
        p={[0, 0.02, 2.05]}
        scale={[0.39, 1, 0.4]}
        m={mat}
      />

      {/* Vertical fin */}
      <Box
        p={[0, 0.38, 2.05]}
        s={[0.15, 0.95, 1.15]}
        m={mat}
      />

      {/* Cockpit */}
      <Sphere
        p={[0, 0.3, -0.55]}
        s={[0.36, 0.31, 0.78]}
        m="ink"
      />

      <Box
        p={[0, 0.48, -0.55]}
        s={[0.72, 0.07, 1.0]}
        m={mat}
      />

      {/* Engine housing */}
      <Cylinder
        p={[0, 0, -2.45]}
        r={[Math.PI / 2, 0, 0]}
        top={0.34}
        bottom={0.34}
        h={0.45}
        m={mat}
      />

      {/* Landing gear */}
      {[-1.0, 1.0].map((x) => (
        <group key={x}>
          <Beam
            a={[x * 0.6, -0.1, -0.25]}
            b={[x, -0.95, -0.25]}
            radius={0.065}
            m="metal"
          />

          <Cylinder
            p={[x, -1.0, -0.25]}
            r={[0, 0, Math.PI / 2]}
            top={0.24}
            bottom={0.24}
            h={0.14}
            m="ink"
            segments={12}
          />
        </group>
      ))}

      {/* Wing panel seams */}
      {[-2.8, -1.6, 1.6, 2.8].map((x) => (
        <Box
          key={x}
          p={[x, 0.09, 0]}
          s={[0.025, 0.025, 1.0]}
          m="woodDark"
        />
      ))}

      {/* Optional RAF roundels */}
      {markings && (
        <>
          <Roundel p={[-2.3, 0.12, 0]} scale={0.75} />
          <Roundel p={[2.3, 0.12, 0]} scale={0.75} />
        </>
      )}

      {/* Propeller */}
      <group
        position={[0, 0, -3.4]}
        rotation={[0, 0, propRotation]}
      >
        <Box p={[0, 0, 0]} s={[0.12, 1.7, 0.12]} m="ink" />
        <Box p={[0, 0, 0]} s={[0.12, 0.12, 1.7]} m="ink" />
        <Sphere p={[0, 0, 0]} s={[0.17, 0.17, 0.17]} m="metal" />
      </group>
    </group>
  );
};

// ====================================================================
// 09. RAF TWIN-ENGINE AIRCRAFT
// ====================================================================

const RAFBomber: React.FC<{
  p: V3;
  scale?: number;
  frame?: number;
  rotation?: V3;
}> = ({
  p,
  scale = 1,
  frame = 0,
  rotation = [0, 0, 0],
}) => (
  <group position={p} scale={scale} rotation={rotation}>
    <Aircraft
      p={[0, 0, 0]}
      type="metal"
      frame={frame}
      markings
    />

    {/* Twin engine nacelles */}
    {[-2.1, 2.1].map((x) => (
      <group key={x}>
        <Cylinder
          p={[x, -0.05, -0.2]}
          r={[Math.PI / 2, 0, 0]}
          top={0.43}
          bottom={0.43}
          h={2.3}
          m="metal"
        />

        <Cylinder
          p={[x, 0, -1.4]}
          r={[-Math.PI / 2, 0, 0]}
          top={0.4}
          bottom={0.4}
          h={0.12}
          m="ink"
        />
      </group>
    ))}
  </group>
);

// ====================================================================
// 10. WOODEN BOMB
// ====================================================================

const WoodenBomb: React.FC<{
  p: V3;
  scale?: number;
  rotation?: V3;
}> = ({
  p,
  scale = 1,
  rotation = [0, 0, 0],
}) => (
  <group position={p} scale={scale} rotation={rotation}>
    <Cylinder
      p={[0, 0, 0]}
      top={0.35}
      bottom={0.35}
      h={2.45}
      m="woodLight"
      segments={12}
    />

    <Cone
      p={[0, 1.55, 0]}
      radius={0.35}
      h={0.8}
      m="wood"
    />

    {/* Tail fins */}
    <Box p={[0, -1.15, 0]} s={[0.12, 0.8, 0.9]} m="woodDark" />
    <Box p={[0, -1.15, 0]} s={[0.9, 0.8, 0.12]} m="wood" />

    {/* Carved joinery */}
    <Cylinder p={[0, 0.7, 0]} top={0.37} bottom={0.37} h={0.055} m="woodDark" />
    <Cylinder p={[0, -0.65, 0]} top={0.37} bottom={0.37} h={0.055} m="woodDark" />

    {/* Grain lines */}
    {[-0.2, 0.15, 0.4].map((x) => (
      <Box
        key={x}
        p={[x, 0, 0.35]}
        s={[0.025, 1.7, 0.02]}
        m="woodDark"
      />
    ))}
  </group>
);

// ====================================================================
// 11. PERIOD SOLDIER ASSET
// ====================================================================

const Soldier: React.FC<{
  p: V3;
  scale?: number;
  pose?: "stand" | "kneel" | "binoculars" | "hammer";
  officer?: boolean;
  facing?: number;
}> = ({
  p,
  scale = 1,
  pose = "stand",
  officer = false,
  facing = 0,
}) => {
  const kneel = pose === "kneel";
  const binoculars = pose === "binoculars";
  const hammer = pose === "hammer";

  return (
    <group
      position={p}
      scale={scale}
      rotation={[0, facing, 0]}
    >
      {/* Boots */}
      <Box p={[-0.24, 0.13, 0.16]} s={[0.35, 0.25, 0.62]} m="ink" />
      <Box p={[0.24, 0.13, 0.16]} s={[0.35, 0.25, 0.62]} m="ink" />

      {/* Legs */}
      <Beam
        a={[-0.23, 1.15, 0]}
        b={[-0.23, kneel ? 0.4 : 0.25, 0.12]}
        radius={0.17}
        m="clothDark"
      />

      <Beam
        a={[0.23, 1.15, 0]}
        b={[0.23, kneel ? 0.4 : 0.25, 0.12]}
        radius={0.17}
        m="cloth"
      />

      {/* Coat and tunic */}
      <Box
        p={[0, 1.55, 0]}
        s={[0.95, 1.2, 0.58]}
        m="cloth"
      />

      <Box
        p={[0, 1.03, 0]}
        s={[1.05, 0.27, 0.65]}
        m="clothDark"
      />

      {/* Belt */}
      <Box p={[0, 1.22, 0.31]} s={[1.0, 0.13, 0.07]} m="ink" />
      <Box p={[0, 1.22, 0.36]} s={[0.18, 0.16, 0.04]} m="metal" />

      {/* Collar */}
      <Box p={[0, 2.08, 0.02]} s={[0.72, 0.17, 0.56]} m="clothDark" />

      {/* Head */}
      <Sphere p={[0, 2.37, 0]} s={[0.32, 0.4, 0.31]} m="stone" detail={10} />

      {/* Facial shadow */}
      <Box p={[0, 2.35, 0.27]} s={[0.42, 0.11, 0.06]} m="ink" />

      {/* Cap */}
      <Sphere
        p={[0, 2.72, 0]}
        s={[0.4, 0.2, 0.36]}
        m={officer ? "cloth" : "clothDark"}
        detail={10}
      />

      <Box
        p={[0, 2.68, 0.25]}
        s={[0.56, 0.08, 0.38]}
        m="clothDark"
      />

      {/* Shoulder straps */}
      <Beam a={[-0.38, 1.97, 0.28]} b={[-0.16, 1.45, 0.32]} radius={0.045} m="clothDark" />
      <Beam a={[0.38, 1.97, 0.28]} b={[0.16, 1.45, 0.32]} radius={0.045} m="clothDark" />

      {/* Arms */}
      <Beam
        a={[-0.46, 1.93, 0]}
        b={[
          binoculars ? -0.34 : hammer ? -0.75 : -0.68,
          binoculars ? 2.26 : 1.2,
          binoculars ? 0.45 : 0.1,
        ]}
        radius={0.16}
        m="clothDark"
      />

      <Beam
        a={[0.46, 1.93, 0]}
        b={[
          binoculars ? 0.34 : hammer ? 0.7 : 0.68,
          binoculars ? 2.26 : 1.2,
          binoculars ? 0.45 : 0.1,
        ]}
        radius={0.16}
        m="cloth"
      />

      {/* Gloves */}
      <Sphere
        p={[
          binoculars ? -0.34 : hammer ? -0.75 : -0.68,
          binoculars ? 2.26 : 1.2,
          binoculars ? 0.45 : 0.1,
        ]}
        s={[0.16, 0.16, 0.16]}
        m="ink"
      />

      <Sphere
        p={[
          binoculars ? 0.34 : hammer ? 0.7 : 0.68,
          binoculars ? 2.26 : 1.2,
          binoculars ? 0.45 : 0.1,
        ]}
        s={[0.16, 0.16, 0.16]}
        m="ink"
      />

      {/* Binoculars */}
      {binoculars && (
        <>
          <Cylinder p={[-0.12, 2.3, 0.49]} r={[Math.PI / 2, 0, 0]} top={0.11} bottom={0.11} h={0.3} m="ink" />
          <Cylinder p={[0.12, 2.3, 0.49]} r={[Math.PI / 2, 0, 0]} top={0.11} bottom={0.11} h={0.3} m="ink" />
        </>
      )}

      {/* Hammer */}
      {hammer && (
        <group position={[0.8, 1.9, 0]}>
          <Box p={[0, 0.3, 0]} s={[0.12, 0.8, 0.12]} r={[0, 0, -0.25]} m="woodDark" />
          <Box p={[0, 0.72, 0]} s={[0.75, 0.17, 0.2]} m="metal" />
        </group>
      )}

      {/* Officer insignia */}
      {officer && (
        <>
          <Box p={[-0.35, 2.05, 0.31]} s={[0.23, 0.09, 0.04]} m="metal" />
          <Box p={[0.35, 2.05, 0.31]} s={[0.23, 0.09, 0.04]} m="metal" />
        </>
      )}
    </group>
  );
};

// ====================================================================
// 12. MILITARY TRUCK
// ====================================================================

const Truck: React.FC<{p: V3; rotation?: number}> = ({
  p,
  rotation = 0,
}) => (
  <group position={p} rotation={[0, rotation, 0]}>
    <Box p={[0, 0.95, 0]} s={[3.7, 0.95, 1.8]} m="clothDark" />
    <Box p={[0, 1.75, -0.35]} s={[1.5, 1.15, 1.5]} m="metal" />
    <Box p={[0, 1.75, 0.42]} s={[1.25, 0.75, 0.05]} m="ink" />

    <Box p={[0, 0.42, 0]} s={[3.9, 0.2, 1.9]} m="metal" />
    <Box p={[0, 1.35, 0.94]} s={[3.0, 0.18, 0.08]} m="metal" />

    {[-1.15, 1.15].map((x) =>
      [-0.7, 0.7].map((z) => (
        <Cylinder
          key={`${x}-${z}`}
          p={[x, 0.45, z]}
          r={[0, 0, Math.PI / 2]}
          top={0.43}
          bottom={0.43}
          h={0.2}
          m="ink"
          segments={12}
        />
      ))
    )}

    {/* Headlights */}
    <Sphere p={[-0.65, 1.25, 0.98]} s={[0.12, 0.12, 0.07]} m="ivory" detail={6} />
    <Sphere p={[0.65, 1.25, 0.98]} s={[0.12, 0.12, 0.07]} m="ivory" detail={6} />
  </group>
);

// ====================================================================
// 13. WOODEN RAIL SYSTEM
// ====================================================================

const ConcealedRail: React.FC<{
  progress: number;
}> = ({progress}) => (
  <group>
    <Box p={[0, 0.02, 0]} s={[0.18, 0.22, 29]} m="metal" />
    <Box p={[1.25, 0.02, 0]} s={[0.18, 0.22, 29]} m="metal" />

    {Array.from({length: 17}).map((_, i) => (
      <Box
        key={i}
        p={[0.62, -0.08, -14 + i * 1.8]}
        s={[2.0, 0.15, 0.24]}
        m="woodDark"
      />
    ))}

    {/* Concealing turf */}
    <Box
      p={[0.62, 0.11, -14]}
      s={[2.3, 0.12, 5.5 * (1 - progress)]}
      m="grass"
    />
  </group>
);

// ====================================================================
// 14. GUN EMPLACEMENT AND CRATERS
// ====================================================================

const GunPit: React.FC<{p: V3}> = ({p}) => (
  <group position={p}>
    <Cylinder p={[0, 0.2, 0]} top={1.7} bottom={1.7} h={0.35} m="earth" segments={16} />
    <Cylinder p={[0, 0.4, 0]} top={1.0} bottom={1.0} h={0.3} m="ink" segments={16} />
    <Box p={[0, 0.85, 0]} s={[0.25, 1.1, 0.25]} m="metal" />
    <Box p={[0, 1.35, -0.6]} s={[0.2, 0.18, 1.6]} m="metal" />
  </group>
);

const Crater: React.FC<{
  p: V3;
  radius?: number;
}> = ({
  p,
  radius = 2,
}) => (
  <group position={p}>
    <Cylinder
      p={[0, 0.04, 0]}
      top={radius}
      bottom={radius * 0.9}
      h={0.1}
      m="ink"
      segments={18}
    />

    <Cylinder
      p={[0, 0.08, 0]}
      top={radius * 0.62}
      bottom={radius * 0.62}
      h={0.1}
      m="earth"
      segments={18}
    />

    {Array.from({length: 8}).map((_, i) => (
      <Box
        key={i}
        p={[
          Math.cos(i * Math.PI / 4) * radius * 0.85,
          0.15,
          Math.sin(i * Math.PI / 4) * radius * 0.85,
        ]}
        s={[0.7, 0.18, 0.3]}
        r={[0, i * Math.PI / 4, 0.4]}
        m="stone"
      />
    ))}
  </group>
);

// ====================================================================
// 15. MASTER AIRFIELD
// ====================================================================

const Airfield: React.FC<{
  frame: number;
  damaged?: boolean;
}> = ({
  frame,
  damaged = false,
}) => (
  <group>
    <DutchWorld />

    {!damaged ? (
      <>
        <WoodenRunway />

        <Hangar p={[-12, 0, -8]} />
        <Hangar p={[-12, 0, 5]} scale={0.82} />

        <Truck p={[-9, 0, 13]} />
        <Truck p={[-17, 0, 13]} rotation={0.25} />

        <GunPit p={[10, 0, -16]} />
        <GunPit p={[10, 0, 14]} />
        <GunPit p={[-17, 0, 16]} />

        <Aircraft
          p={[1.5, 0.85, -12]}
          scale={1}
          type="wood"
          frame={frame}
        />

        <Aircraft
          p={[2, 0.85, 8]}
          scale={0.82}
          type="wood"
          frame={frame}
        />
      </>
    ) : (
      <>
        {/* Real airfield runway */}
        <Plane p={[0, -0.05, 0]} size={[10, 56]} m="stone" />

        <Crater p={[-3, 0.03, -8]} radius={3} />
        <Crater p={[3, 0.03, 11]} radius={2.3} />
        <Crater p={[-4, 0.03, 23]} radius={2.7} />

        <Hangar p={[-12, 0, -8]} broken scale={0.9} />

        <Smoke p={[-15, 0, -8]} scale={1.2} />
        <Smoke p={[12, 0, 17]} scale={0.9} />

        <Aircraft
          p={[3, 0.55, -7]}
          type="metal"
          scale={1.2}
          frame={frame}
        />

        <Box p={[4, 0.3, 2]} s={[3, 0.2, 1]} r={[0, 0, 0.3]} m="woodDark" />
      </>
    )}
  </group>
);

// ====================================================================
// 16. INDIVIDUAL SCENE 01
// THE AIRFIELD MADE OF WOOD
//
// Composition:
// High aerial establishing view.
// Runway is the central graphic axis.
// Canal forms a dark vertical line on the right.
// Church anchors the horizon.
// Hangars and false aircraft create tiny recognizable silhouettes.
// ====================================================================

const Scene01: React.FC<{frame: number}> = ({frame}) => (
  <group>
    <Airfield frame={frame} />

    {/* Distant farm smoke */}
    <Smoke p={[-32, 0, -31]} scale={0.42} />

    {/* Foreground tree silhouette */}
    <Tree p={[17, 0, 17]} scale={1.5} />
  </group>
);

// ====================================================================
// 17. INDIVIDUAL SCENE 02
// THE WOODEN BOMB
//
// Composition:
// Close underside view of RAF bomber.
// Bomb silhouette dominates the foreground.
// Clouds and distant earth provide scale.
// ====================================================================

const Scene02: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <Cloud p={[-12, 15, -8]} scale={2.2} />
    <Cloud p={[11, 20, -18]} scale={2.5} />

    <RAFBomber
      p={[0, 13, -5]}
      scale={1.45}
      frame={frame}
      rotation={[0.08, 0, -0.05]}
    />

    <WoodenBomb
      p={[
        0,
        lerp(7, -2, smooth(progress)),
        0,
      ]}
      scale={1.1}
      rotation={[0.02, 0, 0.03]}
    />

    <Plane p={[0, -8, 0]} size={[100, 100]} m="earth" />
  </group>
);

// ====================================================================
// 18. INDIVIDUAL SCENE 03
// GERMAN OPERATIONS ROOM
//
// Composition:
// Low camera through the doorway.
// Large map table in the foreground.
// Officers in silhouette.
// One hanging pool of illumination.
// Wall map and timber beams.
// ====================================================================

const Scene03: React.FC = () => (
  <group>
    {/* Room */}
    <Box p={[0, -0.3, -5]} s={[21, 0.5, 19]} m="ink" />
    <Box p={[0, 5, -9.5]} s={[21, 10, 0.3]} m="woodDark" />
    <Box p={[-10.5, 5, 0]} s={[0.3, 10, 19]} m="woodDark" />
    <Box p={[10.5, 5, 0]} s={[0.3, 10, 19]} m="woodDark" />

    {/* Roof beams */}
    {[-6, -2, 2, 6].map((x) => (
      <Box
        key={x}
        p={[x, 9.2, 0]}
        s={[0.2, 0.3, 18]}
        m="wood"
      />
    ))}

    {/* Map table */}
    <Box p={[0, 1.5, 0]} s={[11, 0.3, 7]} m="woodLight" />

    {[-4.5, 4.5].map((x) =>
      [-2.6, 2.6].map((z) => (
        <Box
          key={`${x}-${z}`}
          p={[x, 0.7, z]}
          s={[0.22, 1.5, 0.22]}
          m="woodDark"
        />
      ))
    )}

    {/* Map */}
    <Plane
      p={[0, 1.67, 0]}
      r={[-Math.PI / 2, 0, 0]}
      size={[9.8, 5.8]}
      m="paper"
    />

    {/* Runway markings */}
    <Box p={[0, 1.7, 0]} s={[6.8, 0.025, 0.42]} m="ink" />
    <Box p={[0, 1.7, 0]} s={[0.04, 0.025, 4.8]} m="ink" />
    <Box p={[-2, 1.7, 1.2]} s={[1.8, 0.025, 0.04]} m="ink" />
    <Box p={[2.4, 1.7, -1.2]} s={[2.1, 0.025, 0.04]} m="ink" />

    {/* Map instruments */}
    <Cylinder p={[3.4, 1.83, 1.7]} top={0.06} bottom={0.06} h={3} m="metal" />
    <Box p={[-3, 1.8, -1.5]} s={[2.1, 0.08, 0.12]} m="woodDark" />

    {/* Officers */}
    <Soldier p={[-5, 0, -2]} officer />
    <Soldier p={[5, 0, -2]} officer />
    <Soldier p={[0, 0, -7]} officer />

    {/* Wall map */}
    <Plane p={[-6, 5.5, -9.25]} r={[0, 0, 0]} size={[4, 4.5]} m="paper" />
    <Box p={[-6, 5.5, -9.1]} s={[2.9, 0.04, 0.03]} m="ink" />
    <Box p={[-6, 5.5, -9.1]} s={[0.04, 3.2, 0.03]} m="ink" />

    {/* Hanging lamp */}
    <Cylinder p={[0, 8.1, 0]} top={0.05} bottom={0.05} h={2} m="ink" />
    <Cone p={[0, 6.8, 0]} radius={1.1} h={0.75} m="ivory" />
  </group>
);

// ====================================================================
// 19. INDIVIDUAL SCENE 04
// REAL AIRFIELDS UNDER BOMBARDMENT
//
// Composition:
// Wide damaged landscape.
// Three distinct craters.
// Smoke columns.
 // Broken hangar.
 // Concrete runway contrasts with wooden deception.
// ====================================================================

const Scene04: React.FC<{frame: number}> = ({frame}) => (
  <group>
    <Airfield frame={frame} damaged />

    <Smoke p={[-22, 0, -10]} scale={1.25} />
    <Smoke p={[14, 0, 12]} scale={0.9} />

    {/* Fallen antenna */}
    <Beam
      a={[8, 0.3, -10]}
      b={[14, 0.4, -2]}
      radius={0.12}
      m="metal"
    />

    <Soldier p={[-2, 0, 10]} facing={-0.5} />
  </group>
);

// ====================================================================
// 20. INDIVIDUAL SCENE 05
// SURVEYORS MARK THE LAND
//
// Composition:
// Low field-level camera.
// Surveyor's instrument foreground.
// Stakes recede into the distance.
// Two figures measure the runway.
// ====================================================================

const Scene05: React.FC = () => (
  <group>
    <DutchWorld />

    {/* Survey pegs */}
    {[-8, -4, 0, 4, 8].map((x) => (
      <group key={x}>
        <Box p={[x, 0.8, -1]} s={[0.12, 1.6, 0.12]} m="woodDark" />
        <Box p={[x, 1.6, -1]} s={[0.48, 0.08, 0.08]} m="ivory" />
      </group>
    ))}

    {/* Measuring rope */}
    <Beam a={[-8, 0.4, -1]} b={[8, 0.4, -1]} radius={0.025} m="ivory" />

    {/* Survey tripod */}
    <Beam a={[0, 2.1, 3]} b={[-0.8, 0, 3.7]} radius={0.08} />
    <Beam a={[0, 2.1, 3]} b={[0.8, 0, 3.7]} radius={0.08} />
    <Beam a={[0, 2.1, 3]} b={[0, 0, 2.1]} radius={0.08} />

    <Cylinder
      p={[0, 2.2, 3]}
      r={[0, 0, Math.PI / 2]}
      top={0.24}
      bottom={0.24}
      h={0.55}
      m="metal"
    />

    <Cylinder
      p={[0, 2.2, 3.35]}
      r={[Math.PI / 2, 0, 0]}
      top={0.09}
      bottom={0.09}
      h={0.3}
      m="ink"
    />

    <Soldier p={[-4, 0, 4]} officer />
    <Soldier p={[4, 0, 4]} />
  </group>
);

// ====================================================================
// 21. INDIVIDUAL SCENE 06
// CONSTRUCTION OF THE WOODEN AIRFIELD
//
// Composition:
// Incomplete runway.
// Timber hangar framework.
// Trucks and stacked planks.
// Workers in different poses.
// Visual impression of an airfield being assembled.
// ====================================================================

const Scene06: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <DutchWorld />

    <WoodenRunway progress={0.2 + progress * 0.8} />

    {/* Hangar frame in construction */}
    <Beam a={[-13, 0, -6]} b={[-13, 5, -6]} radius={0.18} />
    <Beam a={[-5, 0, -6]} b={[-5, 5, -6]} radius={0.18} />
    <Beam a={[-13, 5, -6]} b={[-9, 7, -6]} radius={0.16} />
    <Beam a={[-9, 7, -6]} b={[-5, 5, -6]} radius={0.16} />

    <Beam a={[-13, 0, 4]} b={[-13, 5, 4]} radius={0.18} />
    <Beam a={[-5, 0, 4]} b={[-5, 5, 4]} radius={0.18} />
    <Beam a={[-13, 5, 4]} b={[-9, 7, 4]} radius={0.16} />
    <Beam a={[-9, 7, 4]} b={[-5, 5, 4]} radius={0.16} />

    {/* Roof rafters */}
    {[-6, -3, 0, 3].map((z) => (
      <group key={z}>
        <Beam a={[-13, 5, z]} b={[-9, 7, z]} radius={0.11} />
        <Beam a={[-9, 7, z]} b={[-5, 5, z]} radius={0.11} />
      </group>
    ))}

    {/* Stacked lumber */}
    {Array.from({length: 4}).map((_, i) => (
      <Box
        key={i}
        p={[-18, 0.3 + i * 0.35, 7]}
        s={[4, 0.25, 1.2]}
        m={i % 2 ? "wood" : "woodLight"}
      />
    ))}

    <Truck p={[-19, 0, 12]} />
    <Truck p={[13, 0, 10]} rotation={-0.5} />

    <Soldier p={[-3, 0, 5]} pose="hammer" />
    <Soldier p={[3, 0, 5]} />
    <Soldier p={[-10, 0, 9]} officer />
    <Soldier p={[8, 0, -4]} />
  </group>
);

// ====================================================================
// 22. INDIVIDUAL SCENE 07
// THE PAINTED FIGHTER
//
// Composition:
// Intimate aircraft workshop.
// Wing fills the frame.
// Painter reaches over the surface.
// False markings and timber grain remain visible.
// ====================================================================

const Scene07: React.FC = () => (
  <group>
    <Plane p={[0, -0.4, 0]} size={[30, 22]} m="earth" />

    {/* Wooden aircraft on trestles */}
    <Aircraft
      p={[0, 1.5, -1]}
      scale={1.85}
      type="wood"
      propeller={false}
    />

    <Box p={[-4, 0.7, 0]} s={[0.5, 1.4, 0.5]} m="woodDark" />
    <Box p={[4, 0.7, 0]} s={[0.5, 1.4, 0.5]} m="woodDark" />

    {/* Painter */}
    <Soldier p={[-6, 0, 1]} pose="hammer" />

    {/* Brush */}
    <Beam
      a={[-4.2, 2.4, 0]}
      b={[-2.2, 2.0, -0.2]}
      radius={0.045}
      m="woodDark"
    />

    <Sphere p={[-2.1, 2.0, -0.2]} s={[0.1, 0.08, 0.1]} m="ivory" />

    {/* Paint tins */}
    <Cylinder p={[-5, 0.35, 4]} top={0.35} bottom={0.35} h={0.65} m="metal" />
    <Cylinder p={[-4, 0.35, 4]} top={0.25} bottom={0.25} h={0.65} m="ink" />

    {/* Workshop beams */}
    <Box p={[0, 5.5, -8]} s={[18, 0.25, 0.25]} m="woodDark" />
    <Box p={[-8, 3, -8]} s={[0.25, 6, 0.25]} m="woodDark" />
    <Box p={[8, 3, -8]} s={[0.25, 6, 0.25]} m="woodDark" />
  </group>
);

// ====================================================================
// 23. INDIVIDUAL SCENE 08
// THE FIGHTER ON THE HIDDEN RAIL
//
// Composition:
// Ground-level tracking view.
// Wooden wheel and undercarriage in foreground.
// Rail revealed beneath the grass.
// False aircraft moves along a concealed track.
// ====================================================================

const Scene08: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <DutchWorld />

    <ConcealedRail progress={progress} />

    <Aircraft
      p={[0.7, 1.35, -13 + progress * 22]}
      scale={1.05}
      type="wood"
      frame={frame}
    />

    {/* Pulling rope */}
    <Beam
      a={[0.7, 0.3, -8]}
      b={[0.7, 0.3, 8]}
      radius={0.035}
      m="woodDark"
    />

    <Soldier p={[-3, 0, 5]} />
    <Soldier p={[3, 0, 5]} />
  </group>
);

// ====================================================================
// 24. INDIVIDUAL SCENE 09
// UP CLOSE, IT WAS CARPENTRY
//
// Composition:
// Extreme close-up workshop.
// Hands, saw, plank, shavings and a wooden propeller.
// This shot deliberately contrasts with the aerial illusion.
// ====================================================================

const Scene09: React.FC<{
  frame: number;
}> = ({frame}) => (
  <group>
    <Plane p={[0, -0.3, 0]} size={[25, 20]} m="earth" />

    {/* Workbench */}
    <Box p={[0, 1.3, 0]} s={[12, 0.35, 3.8]} m="woodLight" />

    {[-5, 5].map((x) =>
      [-1.4, 1.4].map((z) => (
        <Box
          key={`${x}-${z}`}
          p={[x, 0.65, z]}
          s={[0.25, 1.3, 0.25]}
          m="woodDark"
        />
      ))
    )}

    {/* Long plank */}
    <Box
      p={[0, 1.55, 0]}
      s={[9, 0.16, 1.25]}
      m="wood"
    />

    {/* Hand saw */}
    <Box
      p={[2.8, 1.9, 1.1]}
      s={[3, 0.09, 0.35]}
      r={[0, 0, -0.06]}
      m="metal"
    />

    <Box
      p={[1.7, 2.25, 1.1]}
      s={[0.16, 0.75, 0.15]}
      r={[0, 0, -0.2]}
      m="woodDark"
    />

    {/* Carpenter */}
    <Soldier p={[-6, 0, 0]} pose="hammer" />

    {/* Hammer */}
    <Box
      p={[
        0,
        2.15 + Math.sin(frame / 2.5) * 0.18,
        0,
      ]}
      s={[0.8, 0.18, 0.2]}
      m="metal"
    />

    {/* Wood shavings */}
    {Array.from({length: 11}).map((_, i) => (
      <Beam
        key={i}
        a={[
          -2 + i * 0.38,
          1.75,
          2 + Math.sin(i) * 0.4,
        ]}
        b={[
          -1.7 + i * 0.38,
          1.85,
          2.2 + Math.sin(i) * 0.4,
        ]}
        radius={0.018}
        m="woodLight"
      />
    ))}

    {/* Wooden propeller being assembled */}
    <group position={[4, 1.8, -2]}>
      <Box p={[0, 0, 0]} s={[0.18, 2.8, 0.2]} m="woodLight" />
      <Box p={[0, 0, 0]} s={[2.8, 0.18, 0.2]} m="wood" />
      <Sphere p={[0, 0, 0.12]} s={[0.25, 0.25, 0.2]} m="woodDark" />
    </group>
  </group>
);

// ====================================================================
// 25. INDIVIDUAL SCENE 10
// FROM THE AIR, IT LOOKED REAL
//
// Composition:
// The cleanest aerial master shot.
// Everything appears plausibly military.
// Long shadow lines, runway geometry and buildings.
// No characters are oversized.
// ====================================================================

const Scene10: React.FC<{frame: number}> = ({frame}) => (
  <group>
    <Airfield frame={frame} />

    {/* Convincing ground equipment */}
    <Truck p={[-7, 0, 3]} />
    <Truck p={[-16, 0, 8]} rotation={0.4} />

    {/* Long shadows represented as dark silhouettes */}
    <Box p={[-12, 0.04, -5]} s={[1.2, 0.03, 15]} r={[0, 0, 0.25]} m="ink" />
    <Box p={[2, 0.04, -10]} s={[0.7, 0.03, 18]} r={[0, 0, -0.2]} m="ink" />
  </group>
);

// ====================================================================
// 26. INDIVIDUAL SCENE 11
// PHOTO RECONNAISSANCE
//
// Composition:
// Aircraft high overhead.
// Camera sees the plane's silhouette and the field below.
// A long shadow crosses the airfield.
// ====================================================================

const Scene11: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <Airfield frame={frame} />

    <RAFBomber
      p={[
        -20 + progress * 40,
        27,
        -8,
      ]}
      scale={0.9}
      frame={frame}
      rotation={[0.05, 0, -0.02]}
    />

    {/* Moving aircraft shadow */}
    <Box
      p={[-15 + progress * 30, 0.05, -5]}
      s={[3.5, 0.02, 13]}
      r={[0, 0, -0.1]}
      m="ink"
    />
  </group>
);

// ====================================================================
// 27. INDIVIDUAL SCENE 12
// WAITING FOR THE ATTACK
//
// Composition:
// Inside an observation shelter.
// Strong rectangular window framing.
// Two officers watch the empty horizon.
// Long, quiet composition.
// ====================================================================

const Scene12: React.FC = () => (
  <group>
    {/* Shelter */}
    <Box p={[0, 4, -5]} s={[16, 8, 0.35]} m="woodDark" />
    <Box p={[-7.8, 4, 0]} s={[0.35, 8, 12]} m="woodDark" />
    <Box p={[7.8, 4, 0]} s={[0.35, 8, 12]} m="woodDark" />
    <Box p={[0, 8, 0]} s={[16, 0.35, 12]} m="woodDark" />

    {/* Window */}
    <Box p={[0, 4.6, -4.75]} s={[7, 2.8, 0.1]} m="ivory" />
    <Box p={[0, 4.6, -4.5]} s={[0.12, 3, 0.2]} m="woodDark" />
    <Box p={[0, 4.6, -4.5]} s={[7.1, 0.12, 0.2]} m="woodDark" />

    {/* Table */}
    <Box p={[0, 1.25, 3]} s={[5, 0.25, 2]} m="wood" />

    <Soldier p={[-2.5, 0, 1]} officer />
    <Soldier p={[2.5, 0, 1]} pose="binoculars" officer />

    {/* Observation binocular stand */}
    <Beam a={[0, 2, 0]} b={[0, 3.5, 0]} radius={0.08} m="metal" />
    <Cylinder p={[0, 3.7, -0.1]} top={0.18} bottom={0.18} h={0.45} m="ink" />
  </group>
);

// ====================================================================
// 28. INDIVIDUAL SCENE 13
// THE PHOTOGRAPH
//
// Composition:
// Dark intelligence room.
// Aerial photograph occupies the frame.
// Magnifying glass reveals the runway.
// Officer leans over the desk.
// ====================================================================

const Scene13: React.FC = () => (
  <group>
    <Box p={[0, 0.75, 0]} s={[14, 0.3, 10]} m="woodDark" />

    {/* Photograph */}
    <Plane
      p={[0, 0.94, 0]}
      r={[-Math.PI / 2, 0, 0]}
      size={[8.4, 5.5]}
      m="paper"
    />

    {/* Aerial image inside photograph */}
    <Box p={[0, 0.97, 0]} s={[5.5, 0.025, 0.72]} m="ink" />
    <Box p={[-2, 0.98, 1.4]} s={[0.04, 0.025, 2]} m="ink" />
    <Box p={[2.2, 0.98, -1.2]} s={[0.04, 0.025, 1.8]} m="ink" />

    {/* Magnifying glass */}
    <Cylinder
      p={[2.5, 1.18, 0.6]}
      top={0.7}
      bottom={0.7}
      h={0.08}
      m="metal"
      segments={20}
    />

    <Beam
      a={[2.95, 1.15, 1.0]}
      b={[4.1, 1.1, 2.2]}
      radius={0.09}
      m="woodDark"
    />

    {/* Photograph edge */}
    <Box p={[0, 1.0, -2.7]} s={[8.5, 0.03, 0.07]} m="ink" />
    <Box p={[0, 1.0, 2.7]} s={[8.5, 0.03, 0.07]} m="ink" />

    <Soldier p={[-5, 0, -1]} officer />

    {/* Paper notes */}
    <Box p={[-4, 1.05, 3]} s={[2.2, 0.04, 1.2]} r={[0, 0, 0.15]} m="paper" />
  </group>
);

// ====================================================================
// 29. INDIVIDUAL SCENE 14
// THE FINAL PLANK
//
// Composition:
// Macro view of the last board.
// Nail and hammer are the focal point.
// Worker is partially visible.
// Dawn light catches the wood grain.
// ====================================================================

const Scene14: React.FC<{
  frame: number;
}> = ({frame}) => (
  <group>
    <Plane p={[0, -0.2, 0]} size={[25, 20]} m="earth" />

    <WoodenRunway close />

    {/* Final plank */}
    <Box
      p={[0, 0.38, 0]}
      s={[8.8, 0.18, 0.95]}
      m="woodLight"
    />

    {/* Nail */}
    <Cylinder
      p={[0.6, 0.58, 0]}
      top={0.045}
      bottom={0.045}
      h={0.35}
      m="metal"
    />

    <Sphere
      p={[0.6, 0.77, 0]}
      s={[0.09, 0.04, 0.09]}
      m="metal"
    />

    {/* Hammer movement */}
    <Box
      p={[
        1.2,
        1.2 + Math.sin(frame / 2.4) * 0.18,
        0,
      ]}
      s={[0.85, 0.18, 0.2]}
      m="metal"
    />

    <Beam
      a={[0.9, 1.15, 0]}
      b={[0.45, 2.0, 0]}
      radius={0.07}
      m="woodDark"
    />

    <Soldier p={[-3.5, 0, 2]} pose="hammer" />
  </group>
);

// ====================================================================
// 30. INDIVIDUAL SCENE 15
// THE RAF RETURNS
//
// Composition:
// A lone RAF aircraft crosses the Channel.
// Large sky, dark water and isolated aircraft silhouette.
// The camera stays wide to make the aircraft feel distant.
// ====================================================================

const Scene15: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    {/* Channel */}
    <Plane p={[0, -1, 0]} size={[140, 140]} m="water" />

    {/* Long horizontal water marks */}
    {Array.from({length: 35}).map((_, i) => (
      <Box
        key={i}
        p={[-35 + (i % 7) * 11, -0.8, -55 + i * 3.1]}
        s={[3.5, 0.02, 0.035]}
        m="ivory"
      />
    ))}

    {/* Cloud bank */}
    <Cloud p={[-20, 23, -20]} scale={2.2} />
    <Cloud p={[18, 27, -32]} scale={2.6} />

    {/* Lone aircraft */}
    <RAFBomber
      p={[-22 + progress * 44, 18, -8]}
      scale={1.25}
      frame={frame}
      rotation={[0.03, 0, -0.04]}
    />
  </group>
);

// ====================================================================
// 31. INDIVIDUAL SCENE 16
// THE WOODEN BOMB FALLS
//
// Composition:
// Aircraft at top of frame.
// Bomb isolated against the cloud.
// Ground target below.
// The bomb occupies a strong central vertical axis.
// ====================================================================

const Scene16: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <DutchWorld />

    <WoodenRunway />

    <RAFBomber
      p={[0, 20, -8]}
      scale={1.0}
      frame={frame}
    />

    <WoodenBomb
      p={[
        0,
        lerp(15, 1, smooth(progress)),
        -1,
      ]}
      scale={0.95}
    />

    {/* Airfield below */}
    <Hangar p={[-12, 0, -8]} />
    <Hangar p={[-12, 0, 5]} scale={0.8} />
  </group>
);

// ====================================================================
// 32. INDIVIDUAL SCENE 17
// THE OFFICER INSPECTS THE BOMB
//
// Composition:
// Bomb on wooden runway.
// Officer kneels beside it.
// Other soldiers stand in the distance.
// Deadpan stillness, no explosion, no spectacle.
// ====================================================================

const Scene17: React.FC = () => (
  <group>
    <DutchWorld />

    <WoodenRunway close />

    <WoodenBomb
      p={[0, 0.85, 0]}
      scale={0.9}
      rotation={[0, 0, Math.PI / 2]}
    />

    <Soldier
      p={[2.7, 0, 1]}
      pose="kneel"
      officer
      scale={1.2}
      facing={-0.5}
    />

    <Soldier p={[-5, 0, 5]} officer />
    <Soldier p={[6, 0, 5]} />

    <Hangar p={[-13, 0, -12]} scale={0.75} />
  </group>
);

// ====================================================================
// 33. INDIVIDUAL SCENE 18
// READING THE AIRFIELD FROM ABOVE
//
// Composition:
// Cockpit framing dominates.
// Crew silhouettes occupy the lower foreground.
// Airfield is visible through the windshield.
// Strong framing creates a visual tunnel.
// ====================================================================

const Scene18: React.FC = () => (
  <group>
    <Airfield frame={0} />

    {/* Cockpit canopy frame */}
    <Beam a={[-5, 0.4, 5]} b={[-4.7, 9, 5]} radius={0.22} m="ink" />
    <Beam a={[5, 0.4, 5]} b={[4.7, 9, 5]} radius={0.22} m="ink" />
    <Beam a={[-5, 9, 5]} b={[5, 9, 5]} radius={0.22} m="ink" />
    <Beam a={[-5, 0.4, 5]} b={[5, 0.4, 5]} radius={0.22} m="ink" />

    <Beam a={[0, 0.4, 5]} b={[0, 9, 5]} radius={0.14} m="ink" />

    {/* Instrument panel */}
    <Box p={[0, 1.1, 7]} s={[10, 1.5, 0.8]} m="woodDark" />

    {[-3.5, -2, -0.5, 1, 2.5, 4].map((x) => (
      <Cylinder
        key={x}
        p={[x, 1.5, 6.5]}
        top={0.24}
        bottom={0.24}
        h={0.08}
        m="metal"
        segments={16}
      />
    ))}

    {/* Crew silhouettes */}
    <Soldier p={[-2, 2.2, 8]} scale={1.2} />
    <Soldier p={[2, 2.2, 8]} scale={1.2} />
  </group>
);

// ====================================================================
// 34. INDIVIDUAL SCENE 19
// THE COAT ON THE HOOK
//
// Composition:
// Nearly black farmhouse hallway.
// Coat resembles a human silhouette.
// Moonlit window on the right.
// Strong negative space.
// Slow, unsettling camera push.
// ====================================================================

const Scene19: React.FC = () => (
  <group>
    {/* Hallway */}
    <Box p={[0, 4, -5]} s={[15, 9, 0.3]} m="ink" />
    <Box p={[-7.5, 4, 0]} s={[0.3, 9, 13]} m="ink" />
    <Box p={[7.5, 4, 0]} s={[0.3, 9, 13]} m="ink" />

    {/* Moonlit window */}
    <Box p={[4.4, 4.2, -4.72]} s={[2, 3.7, 0.08]} m="ivory" />

    <Box p={[4.4, 4.2, -4.5]} s={[0.13, 3.9, 0.12]} m="ink" />
    <Box p={[4.4, 4.2, -4.5]} s={[2.1, 0.13, 0.12]} m="ink" />

    {/* Hook */}
    <Box p={[0, 4.25, -4.65]} s={[0.8, 0.1, 0.2]} m="metal" />
    <Cylinder p={[0, 4.0, -4.55]} top={0.08} bottom={0.08} h={0.45} m="metal" />

    {/* Coat body */}
    <Box p={[0, 2.35, -4.25]} s={[2.0, 3.2, 0.45]} m="ink" />

    {/* Shoulder silhouette */}
    <Box p={[0, 3.7, -4.2]} s={[3.1, 0.65, 0.55]} m="ink" />

    {/* Sleeves */}
    <Box
      p={[-1.5, 2.45, -4.2]}
      s={[0.7, 2.5, 0.55]}
      r={[0, 0, -0.18]}
      m="ink"
    />

    <Box
      p={[1.5, 2.45, -4.2]}
      s={[0.7, 2.5, 0.55]}
      r={[0, 0, 0.18]}
      m="ink"
    />

    {/* Collar and hat */}
    <Box p={[0, 4.05, -4.1]} s={[1.1, 0.4, 0.55]} m="ink" />
    <Cylinder p={[0, 4.65, -4.2]} top={0.5} bottom={0.6} h={0.28} m="ink" />

    {/* Floorboards */}
    {Array.from({length: 8}).map((_, i) => (
      <Box
        key={i}
        p={[-4 + i * 1.1, -0.1, 2]}
        s={[0.035, 0.025, 12]}
        m="woodDark"
      />
    ))}
  </group>
);

// ====================================================================
// 35. INDIVIDUAL SCENE 20
// BRITAIN PLAYED THE SAME TRICK
//
// Composition:
// Aerial tableau of multiple dummy airfields.
// Several false runways are visible simultaneously.
// Small German bomber silhouettes cross overhead.
// Smoke columns indicate repeated attacks on decoys.
// ====================================================================

const MiniAirfield: React.FC<{
  p: V3;
  scale?: number;
  smoke?: boolean;
}> = ({
  p,
  scale = 1,
  smoke = false,
}) => (
  <group position={p} scale={scale}>
    <Box p={[0, 0, 0]} s={[8, 0.12, 34]} m="wood" />

    <Hangar p={[-7, 0, -5]} scale={0.55} />
    <Hangar p={[-7, 0, 7]} scale={0.48} />

    <Aircraft
      p={[0, 0.75, 10]}
      scale={0.45}
      type="wood"
    />

    <Truck p={[-11, 0, 13]} />

    {smoke && <Smoke p={[7, 0, -5]} scale={0.8} />}
  </group>
);

const Scene20: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <Plane p={[0, -0.4, 0]} size={[170, 160]} m="earth" />

    {/* Four independent dummy airfields */}
    <MiniAirfield p={[-24, 0, -22]} scale={0.82} smoke />
    <MiniAirfield p={[23, 0, -23]} scale={0.72} />
    <MiniAirfield p={[-22, 0, 25]} scale={0.75} smoke />
    <MiniAirfield p={[25, 0, 24]} scale={0.83} smoke />

    {/* German bombers crossing the map */}
    <Aircraft
      p={[-28 + progress * 55, 26, -3]}
      scale={1.0}
      type="metal"
      frame={frame}
    />

    <Aircraft
      p={[-34 + progress * 55, 29, 2]}
      scale={0.72}
      type="metal"
      frame={frame}
    />

    <Aircraft
      p={[-40 + progress * 55, 31, 8]}
      scale={0.62}
      type="metal"
      frame={frame}
    />
  </group>
);

// ====================================================================
// 36. INDIVIDUAL SCENE 21
// THE RAF RETURNED THE COMPLIMENT
//
// Composition:
// Return to the original Dutch airfield.
// The same canal, church and runway.
// Wooden bomb lies in the foreground.
// The aircraft disappears into the sky.
// Final camera pulls away from the deception.
// ====================================================================

const Scene21: React.FC<{
  frame: number;
  progress: number;
}> = ({frame, progress}) => (
  <group>
    <Airfield frame={frame} />

    <WoodenBomb
      p={[0, 0.75, 1]}
      scale={0.72}
      rotation={[0, 0, Math.PI / 2]}
    />

    <Aircraft
      p={[
        0,
        21 + progress * 9,
        -10 - progress * 10,
      ]}
      scale={0.65}
      type="metal"
      frame={frame}
    />

    {/* Distant smoke disappears into horizon */}
    <Smoke p={[-27, 0, -34]} scale={0.45} />
  </group>
);

// ====================================================================
// 37. SCENE TIMELINE
// ====================================================================

type SceneDefinition = {
  id: number;
  title: string;
  seconds: number;
  narration: string;
};

const SCENE_DEFINITIONS: SceneDefinition[] = [
  {
    id: 1,
    title: "An Airfield Made of Wood",
    seconds: 3.166667,
    narration: "The Germans built a wooden airfield to fool Britain.",
  },
  {
    id: 2,
    title: "The Wooden Bomb",
    seconds: 2.250000,
    narration: "Britain bombed it with a wooden bomb.",
  },
  {
    id: 3,
    title: "The Serious Plan",
    seconds: 3.333333,
    narration: "It sounds like a joke, but it began as a serious plan.",
  },
  {
    id: 4,
    title: "The Real Airfields",
    seconds: 4.708333,
    narration: "In occupied Holland in 1943, British bombers were pounding the real airfields.",
  },
  {
    id: 5,
    title: "The Surveyors",
    seconds: 2.958333,
    narration: "So the Germans decided to build a fake one out of wood.",
  },
  {
    id: 6,
    title: "Construction",
    seconds: 4.333333,
    narration: "First came a runway, then hangars, trucks, gun pits and a fighter squadron.",
  },
  {
    id: 7,
    title: "Painted to Perfection",
    seconds: 3.250000,
    narration: "Painted so carefully you could almost hear the engines.",
  },
  {
    id: 8,
    title: "The Hidden Rail",
    seconds: 3.666667,
    narration: "One fighter even ran along a hidden rail whenever enemy planes approached.",
  },
  {
    id: 9,
    title: "It Was Carpentry",
    seconds: 3.416667,
    narration: "Just to make the field look busy. Up close, it was carpentry.",
  },
  {
    id: 10,
    title: "From the Air",
    seconds: 2.500000,
    narration: "From the air, it was supposed to be an airfield.",
  },
  {
    id: 11,
    title: "Photo Reconnaissance",
    seconds: 3.583333,
    narration: "For months, it seemed to work. British photo planes passed overhead.",
  },
  {
    id: 12,
    title: "Waiting",
    seconds: 2.625000,
    narration: "While the Germans waited for an attack that never came.",
  },
  {
    id: 13,
    title: "The Photograph",
    seconds: 2.875000,
    narration: "Eventually, they decided the camouflage was doing its job.",
  },
  {
    id: 14,
    title: "The Final Plank",
    seconds: 2.250000,
    narration: "Then, the morning after the final plank,",
  },
  {
    id: 15,
    title: "The RAF Returns",
    seconds: 4.125000,
    narration: "A lone RAF plane crossed the Channel, circled once, and dropped a bomb.",
  },
  {
    id: 16,
    title: "The Wooden Bomb Falls",
    seconds: 4.375000,
    narration: "But it wasn't an explosive bomb. It was a large, extremely wooden one.",
  },
  {
    id: 17,
    title: "That Was the Damage",
    seconds: 4.083333,
    narration: "Luckily, it did no damage. Unluckily, that was the damage.",
  },
  {
    id: 18,
    title: "Reading the Airfield",
    seconds: 5.125000,
    narration: "From high above, a crew has seconds to read an airfield: a shape, a shadow, a silhouette.",
  },
  {
    id: 19,
    title: "The Coat on the Hook",
    seconds: 4.291667,
    narration: "The brain fills in the rest, just as a coat on a hook can look like a burglar at midnight.",
  },
  {
    id: 20,
    title: "Britain Played the Same Trick",
    seconds: 5.458333,
    narration: "Britain was playing the same trick, building hundreds of dummy airfields that German bombers attacked for years.",
  },
  {
    id: 21,
    title: "The RAF Returned the Compliment",
    seconds: 4.958333,
    narration: "The Germans wanted an airfield no one could ever destroy. The RAF returned the compliment.",
  },
];

// Cut at the aligned narration phrase onsets. Store absolute frame
// boundaries so per-scene rounding never drifts over the course of the film.
const SCENES = SCENE_DEFINITIONS.map((scene, index) => {
  const from = timing.sceneStartFrames[index];
  const to = timing.sceneStartFrames[index + 1] ?? TOTAL_FRAMES;
  return {...scene, from, to, frames: to - from, seconds: (to - from) / FPS};
});

if (
  timing.sceneStartFrames.length !== SCENE_DEFINITIONS.length ||
  SCENES[0].from !== 0 ||
  SCENES.some((scene) => scene.frames <= 0) ||
  TOTAL_FRAMES !== Math.ceil(timing.audioDurationSeconds * FPS)
) {
  throw new Error("Invalid narration timeline. Check src/timing.json.");
}

// ====================================================================
// 38. CAMERA CHOREOGRAPHY
//
// Every shot has its own camera start, camera end,
// target start, target end and focal length.
//
// Camera movements are declarative and frame deterministic.
// ====================================================================

type CameraShot = {
  from: V3;
  to: V3;
  targetFrom: V3;
  targetTo: V3;
  fov: number;
};

const SHOTS: Record<number, CameraShot> = {
  1: {
    from: [38, 78, 72],
    to: [23, 58, 56],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, -2],
    fov: 34,
  },

  2: {
    from: [7, 10, 17],
    to: [2, 5, 10],
    targetFrom: [0, 5, 0],
    targetTo: [0, 3, 0],
    fov: 33,
  },

  3: {
    from: [11, 7, 16],
    to: [7, 5, 12],
    targetFrom: [0, 2, 0],
    targetTo: [0, 2, 0],
    fov: 36,
  },

  4: {
    from: [42, 68, 68],
    to: [28, 48, 48],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, 0],
    fov: 35,
  },

  5: {
    from: [12, 5, 17],
    to: [7, 3.5, 12],
    targetFrom: [0, 1, 0],
    targetTo: [0, 1, 0],
    fov: 39,
  },

  6: {
    from: [19, 10, 22],
    to: [12, 6, 16],
    targetFrom: [0, 1, 0],
    targetTo: [0, 1, 0],
    fov: 38,
  },

  7: {
    from: [7, 4, 10],
    to: [2, 2.8, 6],
    targetFrom: [0, 1, 0],
    targetTo: [0, 1, 0],
    fov: 32,
  },

  8: {
    from: [9, 2.8, 13],
    to: [4, 1.8, 8],
    targetFrom: [0, 1, 0],
    targetTo: [0, 1, 0],
    fov: 36,
  },

  9: {
    from: [5, 3.5, 8],
    to: [1.8, 2.4, 5],
    targetFrom: [0, 1.2, 0],
    targetTo: [0, 1.2, 0],
    fov: 31,
  },

  10: {
    from: [33, 82, 50],
    to: [25, 68, 43],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, 0],
    fov: 34,
  },

  11: {
    from: [0, 52, 55],
    to: [0, 45, 48],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, 0],
    fov: 34,
  },

  12: {
    from: [10, 5, 12],
    to: [7, 3.7, 9],
    targetFrom: [0, 2, 0],
    targetTo: [0, 2, -2],
    fov: 38,
  },

  13: {
    from: [7, 5, 10],
    to: [3.5, 3.3, 7],
    targetFrom: [0, 1, 0],
    targetTo: [0, 1, 0],
    fov: 32,
  },

  14: {
    from: [3.8, 3.4, 8],
    to: [1.3, 1.9, 4.5],
    targetFrom: [0, 0.5, 0],
    targetTo: [0, 0.5, 0],
    fov: 29,
  },

  15: {
    from: [0, 25, 48],
    to: [0, 19, 39],
    targetFrom: [0, 5, 0],
    targetTo: [0, 5, 0],
    fov: 38,
  },

  16: {
    from: [6, 16, 19],
    to: [1.5, 8, 11],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, 0],
    fov: 32,
  },

  17: {
    from: [6, 5, 10],
    to: [3, 3.3, 6],
    targetFrom: [0, 1, 0],
    targetTo: [0, 1, 0],
    fov: 33,
  },

  18: {
    from: [0, 7, 17],
    to: [0, 8, 15],
    targetFrom: [0, 2, 0],
    targetTo: [0, 2, -3],
    fov: 39,
  },

  19: {
    from: [0, 3.2, 10],
    to: [0, 2.6, 6.2],
    targetFrom: [0, 2.3, -3],
    targetTo: [0, 2.3, -4],
    fov: 30,
  },

  20: {
    from: [42, 88, 72],
    to: [31, 75, 58],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, 0],
    fov: 36,
  },

  21: {
    from: [24, 61, 60],
    to: [10, 76, 78],
    targetFrom: [0, 0, 0],
    targetTo: [0, 0, 0],
    fov: 35,
  },
};

const CameraRig: React.FC<{
  sceneId: number;
  progress: number;
}> = ({
  sceneId,
  progress,
}) => {
  const camera = useThree((state) => state.camera);
  const shot = SHOTS[sceneId];

  const t = smooth(progress);

  camera.position.set(
    lerp(shot.from[0], shot.to[0], t),
    lerp(shot.from[1], shot.to[1], t),
    lerp(shot.from[2], shot.to[2], t)
  );

  camera.lookAt(
    lerp(shot.targetFrom[0], shot.targetTo[0], t),
    lerp(shot.targetFrom[1], shot.targetTo[1], t),
    lerp(shot.targetFrom[2], shot.targetTo[2], t)
  );

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
  }

  return null;
};

// ====================================================================
// 39. SCENE-SPECIFIC LIGHTING
//
// The monochrome lighting hierarchy:
// - Ambient fill is deliberately low.
// - Key light creates the dominant shadow shape.
// - Rim light separates subjects from black.
// - Interior lights create isolated pools of ivory.
// - Scene 19 is nearly black.
// ====================================================================

const LightingRig: React.FC<{
  sceneId: number;
  progress: number;
}> = ({
  sceneId,
  progress,
}) => {
  const interior = [3, 12, 13, 19].includes(sceneId);
  const night = sceneId === 19;
  const dramatic = [2, 14, 15, 16, 17].includes(sceneId);

  const intensity = sceneId === 21
    ? lerp(1.15, 0.35, smooth(progress))
    : night
      ? 0.65
      : 1.6;

  return (
    <>
      <ambientLight
        intensity={night ? 0.055 : interior ? 0.12 : 0.2}
      />

      <directionalLight
        position={interior ? [-5, 12, 6] : [-18, 28, 18]}
        intensity={intensity}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={180}
      />

      {interior && (
        <spotLight
          position={[0, 8, 1]}
          angle={0.48}
          penumbra={0.15}
          intensity={night ? 8 : 16}
          distance={30}
          castShadow
        />
      )}

      {dramatic && (
        <directionalLight
          position={[7, 12, -18]}
          intensity={1.1}
        />
      )}

      {!night && (
        <directionalLight
          position={[15, 6, -20]}
          intensity={0.28}
        />
      )}
    </>
  );
};

// ====================================================================
// 40. SCENE DISPATCHER
//
// All 21 scene modules are explicitly registered.
// Each receives deterministic local frame and progress.
// ====================================================================

const SceneWorld: React.FC<{
  sceneId: number;
  frame: number;
  progress: number;
}> = ({
  sceneId,
  frame,
  progress,
}) => {
  switch (sceneId) {
    case 1:
      return <Scene01 frame={frame} />;

    case 2:
      return <Scene02 frame={frame} progress={progress} />;

    case 3:
      return <Scene03 />;

    case 4:
      return <Scene04 frame={frame} />;

    case 5:
      return <Scene05 />;

    case 6:
      return <Scene06 frame={frame} progress={progress} />;

    case 7:
      return <Scene07 />;

    case 8:
      return <Scene08 frame={frame} progress={progress} />;

    case 9:
      return <Scene09 frame={frame} />;

    case 10:
      return <Scene10 frame={frame} />;

    case 11:
      return <Scene11 frame={frame} progress={progress} />;

    case 12:
      return <Scene12 />;

    case 13:
      return <Scene13 />;

    case 14:
      return <Scene14 frame={frame} />;

    case 15:
      return <Scene15 frame={frame} progress={progress} />;

    case 16:
      return <Scene16 frame={frame} progress={progress} />;

    case 17:
      return <Scene17 />;

    case 18:
      return <Scene18 />;

    case 19:
      return <Scene19 />;

    case 20:
      return <Scene20 frame={frame} progress={progress} />;

    case 21:
      return <Scene21 frame={frame} progress={progress} />;

    default:
      return <Scene01 frame={frame} />;
  }
};

// ====================================================================
// 41. REMOTION FILM COMPOSITION
// ====================================================================

type FilmProps = {
  narration?: string;
  score?: string;
  atmosphere?: string;
  effects?: Partial<Record<number, string>>;
};

const WoodenAirfieldFilm: React.FC<FilmProps> = ({
  narration,
  score,
  atmosphere,
  effects = {},
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const scene = SCENES.find(
    (s) => frame >= s.from && frame < s.to
  ) ?? SCENES[SCENES.length - 1];

  const localFrame = frame - scene.from;

  // Twelve FPS visual stepping, rendered at 24 FPS.
  // This preserves controlled movement without temporal noise.
  const visualFrame = Math.floor(localFrame / 2) * 2;

  const progress = clamp(
    localFrame / scene.frames
  );

  const fogNear = scene.id === 19 ? 8 : 35;
  const fogFar = scene.id === 19 ? 32 : 120;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BLACK,
        overflow: "hidden",
      }}
    >
      <ThreeCanvas
        width={width}
        height={height}
        orthographic={false}
        dpr={1}
        shadows
        camera={{
          position: [0, 40, 40],
          fov: 36,
          near: 0.1,
          far: 250,
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({gl}) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
        }}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: BLACK,
        }}
      >
        <color attach="background" args={[BLACK]} />

        <fog
          attach="fog"
          args={[
            new THREE.Color(BLACK),
            fogNear,
            fogFar,
          ]}
        />

        <LightingRig
          sceneId={scene.id}
          progress={progress}
        />

        <CameraRig
          sceneId={scene.id}
          progress={progress}
        />

        <SceneWorld
          sceneId={scene.id}
          frame={visualFrame}
          progress={progress}
        />
      </ThreeCanvas>

      {/* Narration is a single continuous recording. */}
      {narration && (
        <Audio
          src={staticFile(narration)}
          volume={1}
        />
      )}

      {/* Restrained documentary score. */}
      {score && (
        <Audio
          src={staticFile(score)}
          volume={0.23}
        />
      )}

      {/* Continuous environmental ambience. */}
      {atmosphere && (
        <Audio
          src={staticFile(atmosphere)}
          volume={0.25}
        />
      )}

      {/* Scene-specific sound effects. */}
      {SCENES.map((s) => {
        const effect = effects[s.id];

        if (!effect) return null;

        return (
          <Sequence
            key={`effect-${s.id}`}
            from={s.from}
            durationInFrames={s.frames}
          >
            <Audio
              src={staticFile(effect)}
              volume={0.8}
            />
          </Sequence>
        );
      })}

      {/* Final two frames cut to absolute black. */}
      {frame >= TOTAL_FRAMES - 2 && (
        <AbsoluteFill
          style={{
            backgroundColor: BLACK,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ====================================================================
// 42. PRODUCTION METADATA
// ====================================================================

export const WOODEN_AIRFIELD_PRODUCTION = {
  title: "The Wooden Airfield",

  artDirection: {
    reference: "Return of the Obra Dinn",
    rendering: "1-bit monochrome engraving",
    palette: ["#030303", "#eee9dc"],
    dithering: "4x4 ordered Bayer",
    pixelCellSize: 2,
    materialEngraving: true,
    directionalWoodGrain: true,
    wovenCloth: true,
    brushedMetal: true,
    paperFibres: true,
    shadowCrosshatching: true,
    randomNoise: false,
    colorGradients: false,
    temporalNoise: false,
  },

  output: {
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    durationSeconds: DURATION_SECONDS,
    durationInFrames: TOTAL_FRAMES,
    aspectRatio: "9:16",
    movementRate: "12 FPS stepped",
    renderRate: "24 FPS",
  },

  sceneCount: 21,

  continuity: {
    dutchCanal: "Right side of the Dutch landscape",
    church: "Same distant church in recurring aerial scenes",
    runway: "Same diagonal timber runway",
    hangars: "Consistent placement beside runway",
    fighter: "Same recurring aircraft silhouette",
    woodenBomb: "Same carved wooden bomb",
    soldierUniforms: "Consistent monochrome military clothing",
    lighting: "Hard key, deep shadow, controlled rim",
  },

  scenes: SCENES,

  qualityRules: [
    "No random pixelation.",
    "No grayscale overlay.",
    "No colored lighting.",
    "No generic full-screen noise.",
    "Every shot has its own camera choreography.",
    "Every environment has a deliberate foreground and background.",
    "Aircraft proportions must remain consistent.",
    "Wood must read as wood through grain and construction.",
    "Characters must read through silhouettes and posture.",
    "The wooden bomb must remain visually recognizable.",
    "The final shot returns to the original landscape.",
    "The final two frames are completely black.",
  ],
};

// ====================================================================
// 43. REMOTION REGISTRATION
// ====================================================================

const RemotionRoot: React.FC = () => (
  <Composition
    id="WoodenAirfield"
    component={WoodenAirfieldFilm}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={{
      narration: "audio/narration.mp3",
      score: undefined,
      atmosphere: undefined,
      effects: {},
    }}
  />
);

registerRoot(RemotionRoot);

// ====================================================================
// END OF THE 21-SCENE FILM
// ====================================================================
