// Pure, frame-driven timeline. Everything in the composition is a function of
// the absolute Remotion frame, so chunked cloud renders stitch together cleanly.
export const FPS = 30;
export const DURATION = 240;

export type Vec3 = [number, number, number];

export type CameraKey = {
  f: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll: number;
};

// One continuous camera journey: wide establishing shot -> drift toward the
// character -> close-up -> tilt up to the moon. Every segment eases, and the
// tiny drift added in cameraAt() keeps even the "holds" alive.
const KEYS: CameraKey[] = [
  { f: 0, pos: [0.0, 4.2, 14.5], look: [0.0, 3.4, 0.0], fov: 46, roll: 0.0 },
  { f: 60, pos: [0.8, 3.8, 13.2], look: [0.4, 3.2, 0.0], fov: 44, roll: -0.006 },
  { f: 120, pos: [3.4, 3.1, 10.2], look: [1.4, 2.9, 0.6], fov: 39, roll: -0.018 },
  { f: 180, pos: [2.0, 3.4, 8.4], look: [1.7, 3.2, 0.2], fov: 36, roll: 0.012 },
  { f: 240, pos: [-0.6, 4.6, 9.6], look: [1.0, 3.6, -0.8], fov: 38, roll: 0.024 },
];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const smoothstep = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

export const smootherstep = (x: number) => {
  const u = clamp01(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export type CameraState = { position: Vec3; look: Vec3; fov: number; roll: number };

export const cameraAt = (frame: number): CameraState => {
  const f = Math.max(0, Math.min(DURATION, frame));
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (f >= KEYS[i].f && f <= KEYS[i + 1].f) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(1, b.f - a.f);
  const t = smootherstep((f - a.f) / span);

  // A slow, intentional drift (never random jitter) so no frame is frozen.
  const driftX = Math.sin(frame * 0.019) * 0.045;
  const driftY = Math.cos(frame * 0.016) * 0.03;

  return {
    position: [lerp(a.pos[0], b.pos[0], t) + driftX, lerp(a.pos[1], b.pos[1], t) + driftY, lerp(a.pos[2], b.pos[2], t)],
    look: mix3(a.look, b.look, t),
    fov: lerp(a.fov, b.fov, t),
    roll: lerp(a.roll, b.roll, t) + Math.sin(frame * 0.012) * 0.002,
  };
};

// Stable pseudo-random value in [0, 1). Used for prop placement only.
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

// Blinks last four frames, roughly every 2 seconds, like the reference study.
const BLINKS = [52, 118, 187, 226];
export const blinkAt = (frame: number) => (BLINKS.some((b) => frame >= b && frame < b + 4) ? 1 : 0);

export const breathAt = (frame: number) => Math.sin(frame / 22);
export const swayAt = (frame: number, phase = 0) => Math.sin(frame / 42 + phase);

// Character looks up at the moon over the final third.
export const gazeAt = (frame: number) => smoothstep((frame - 120) / 80);
