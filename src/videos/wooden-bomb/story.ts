// Timeline of the Woody Bomb short, timed to the voice words (wooden-bomb-short/voice/words.json):
// the camera grammar measured in the reference study: continuous slow push-ins; symmetric smootherstep glides
// of 18-40 f; big reframes are cuts; the wooden CLONK is a 7-frame kick that flips sign every frame; no hand-held float.
// Story physics: the build beat-by-beat (planks -> hangars -> the rail plane -> complete), the rail plane's ride,
// the RAF plane's crossing + one circle, and the bomb's slow cartoon fall, bounce and splinters.
export const FPS = 30;
export const TOTAL = 2040; // 68.0 s: voice ends 65.51 s, then a 2.5 s tail

// ---------------- shared types + easing ----------------
export type V3 = [number, number, number];
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};
/** eased move from a to b between t0 and t1 (smootherstep) */
export const seg = (t0: number, t1: number, a: number, b: number, t: number) => a + (b - a) * smooth((t - t0) / (t1 - t0));

// ---------------- build progress (t = story time in seconds from the voice timeline) ----------------
// The field grows beat by beat with the words. Workers are always placing something; every piece pops with a
// small eased stagger. The runway planks run west -> east; the final plank at the east end waits for the dawn tap.
export type BuildState = { runway: number; finalPlank: number; shells: number; fit: number; props: number; live: number };
/** staggered per-index pop 0..1 (smootherstep) for a piece whose slot starts at t0 + i*gap */
export const popAt = (t: number, t0: number, gap: number, i: number) => smooth((t - (t0 + i * gap)) / 0.5);
export const build = (t: number): BuildState => ({
  runway: t < 11.9 ? 0 : 1,                    // the west-east plank run built in shot 3
  finalPlank: clamp01((t - 35.2) / 0.75),       // the last plank tapped down in shot 8 ("the final plank goes down")
  shells: t < 15.12 ? 0 : clamp01((t - 15.12) / 2.6), // hangar shells rise through "arrive"
  fit: t < 16.2 ? 0 : 1,                       // roofs, door frames and struts trim after the shells
  props: t < 16.2 ? 0 : clamp01((t - 16.2) / 2.4), // trucks, gun pit, watchtower, fuel pops in a stagger
  live: t < 20.2 ? 0 : 1,                      // the rail plane is switched on ("One fake fighter even trundles")
});
/** how far the plank run has progressed at x (world geometry: slabs from x -34 east; the final plank gap 47.4..50
 *  waits for the dawn tap in shot 8) */
export const plankAt = (t: number, x: number) => {
  const edge = seg(12.14, 14.51, -34, 47.4, t);
  return x <= edge ? 1 : 0;
};
/** the painter sliding along the fresh planks ("painted the exact grey of the real thing") */
export const paintX = (t: number) => seg(13.0, 14.25, -30, 44, t);

// ---------------- the rail plane (L5, 20.2-24.0 s) ----------------
export const RAIL = { x0: 20, x1: 40, z: 17.5 };
const railKnots: [number, number][] = [[20.2, RAIL.x0], [21.9, RAIL.x1], [22.4, RAIL.x1], [23.65, RAIL.x0 + 5]];
/** x along the rail: trundles out, waits ("whenever enemy planes come near"), reverses, parks half-turned out */
export const railX = (t: number) => {
  if (t < 20.2) return RAIL.x0;
  if (t >= 23.65) return RAIL.x0 + 5;
  for (let i = 1; i < railKnots.length; i++) {
    const [t1, b] = railKnots[i], [t0, a] = railKnots[i - 1];
    if (t <= t1) return a + (b - a) * smooth((t - t0) / (t1 - t0));
  }
  return RAIL.x0 + 5;
};
/** roll wobble while moving, near-still at the stops (no frozen pixels) */
export const railRoll = (t: number) => {
  const v = railX(t + 0.05) - railX(t - 0.05);
  return -0.05 * Math.sign(v || 1) * Math.min(1, Math.abs(v) / 0.05) - 0.012 * Math.sin(t * 9);
};

// ---------------- the RAF plane + the bomb ----------------
export type PlaneState = { x: number; y: number; z: number; yaw: number; bank: number; prov: number };
/** prov keys: 0 = over the sea (crossing), 1 = the one circle, 2 = the exit east */
const CX = 2, CZ = 2; // the one-circle centre
const ENTRY: V3 = [CX - 14.9, 11, CZ + 21.4]; // the lap entry point (angle 2.2 rad, R 26)
export const planeAt = (t: number): PlaneState => {
  const lapT0 = 38.0, lapT1 = 40.2, TH0 = 2.2, TAU = Math.PI * 2, R = 26;
  if (t < lapT0) { // the crossing: sea horizon south-west -> the circle entry point at the field
    const u = smooth(clamp01((t - 35.8) / (lapT0 - 35.8)));
    const x = -92 + (ENTRY[0] + 92) * u, y = 11.4 - 0.4 * u, z = 46 + (ENTRY[2] - 46) * u;
    return { x, y, z, yaw: 0.8 - 0.6 * u, bank: 0.09, prov: 0 };
  }
  const th = t < lapT1 ? TH0 - TAU * (t - lapT0) / (lapT1 - lapT0) : TH0 - TAU; // one full lap
  const cx = CX + R * Math.cos(th), cz = CZ + R * Math.sin(th);
  if (t < lapT1) return { x: cx, y: 11, z: cz, yaw: -th + Math.PI / 2, bank: 0.36, prov: 1 };
  // exits east on the tangent (the lap ends pointing east, the plane keeps the heading)
  const e = easeOut(clamp01((t - lapT1) / 2.6)) * 96;
  return { x: CX + R * Math.cos(TH0 - TAU) + e, y: 11 + e * 0.035, z: CZ + R * Math.sin(TH0 - TAU) + e * 0.12, yaw: Math.PI / 2, bank: -0.05, prov: 2 };
};
export const RELEASE = 40.30, CLONK = 42.64, FALL_T = 2.34, B_H = 10.25;
const G = 2 * B_H / (FALL_T * FALL_T); // cartoon-slow gravity so the fall fills the joke
/** REL: the plane's position at RELEASE (lap angle th(40.3) = 2.2 - 2pi*2.3/2.2) */
const RELX = -18.16, RELZ = 26.26;
export type BombQ = { x: number; y: number; z: number; pitch: number; roll: number; phase: "held" | "fall" | "b1" | "b2" | "rest"; age: number };
export const LAND: V3 = [-2.9, 0.62, 1.2];
export const bombState = (t: number): BombQ => {
  const r = t - RELEASE;
  if (r < 0) { const p = planeAt(t); return { x: p.x, y: p.y - 0.75, z: p.z, pitch: 0.12, roll: 0.15, phase: "held", age: 0 }; }
  if (r < FALL_T) { // nose-over fall, drifting forward onto the planks
    const u = r / FALL_T, drop = 0.5 * G * r * r;
    return { x: RELX + (LAND[0] - RELX) * u, y: B_H - drop, z: RELZ + (LAND[2] - RELZ) * u,
      pitch: 1.35 * easeOut(u), roll: 0.18 * Math.sin(u * 5.2), phase: "fall", age: u };
  }
  const tb = r - FALL_T;
  if (tb < 0.56) { const u = tb / 0.56; return { x: -2.9 + 2.2 * u, y: 0.62 + 1.5 * Math.sin(Math.PI * u), z: 1.2 + 0.5 * u,
    pitch: -0.35 * Math.sin(Math.PI * u), roll: 0.5, phase: "b1", age: u }; }
  const t2 = tb - 0.56;
  if (t2 < 0.44) { const u = t2 / 0.44; return { x: -2.9 + 2.2 + 0.8 * u, y: 0.62 + 0.55 * Math.sin(Math.PI * u), z: 1.2 + 0.5 + 0.2 * u,
    pitch: -0.2 * Math.sin(Math.PI * u), roll: 0.32, phase: "b2", age: u }; }
  return { x: 0.1, y: 0.62, z: 1.9, pitch: -0.12, roll: 0.22, phase: "rest", age: clamp01((r - FALL_T - 1.0) / 0.6) };
};
/** splinter shard scatter after the clonk (age 0..1) */
export const splinterAge = (t: number) => clamp01((t - CLONK) / 1.5);
export const clonkKick = (t: number) => {
  let a = 0;
  const n = Math.floor((t - CLONK) * FPS + 1e-6);
  if (n >= 0 && n < 7) a = 1.3 * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  const n2 = Math.floor((t - (CLONK + 0.56)) * FPS + 1e-6); // second bounce, smaller
  if (n2 >= 0 && n2 < 7) a += 0.55 * (n2 % 2 ? -1 : 1) * (1 - n2 / 7) ** 1.5;
  return a;
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "hook" | "wreck" | "planks" | "shells" | "rails" | "gawk" | "party" | "cross" | "circle" | "clonk" | "pilot" | "coat" | "decoys" | "tail" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 127, light: "day", crowd: "hook", tau: (t) => t },
  { id: 2, a: 127, b: 327, light: "day", crowd: "wreck", tau: (t) => t },
  { id: 3, a: 327, b: 455, light: "day", crowd: "planks", tau: (t) => t },
  { id: 4, a: 455, b: 606, light: "day", crowd: "shells", tau: (t) => t },
  { id: 5, a: 606, b: 737, light: "day", crowd: "rails", tau: (t) => t },
  { id: 6, a: 737, b: 890, light: "day", crowd: "gawk", tau: (t) => t },
  { id: 7, a: 890, b: 1053, light: "day", crowd: "party", tau: (t) => t },
  { id: 8, a: 1053, b: 1146, light: "golden", crowd: "cross", tau: (t) => t },
  { id: 9, a: 1146, b: 1240, light: "golden", crowd: "circle", tau: (t) => t },
  { id: 10, a: 1240, b: 1420, light: "golden", crowd: "clonk", tau: (t) => t },
  { id: 11, a: 1420, b: 1525, light: "golden", crowd: "pilot", tau: (t) => t },
  { id: 12, a: 1525, b: 1656, light: "golden", crowd: "coat", tau: (t) => t },
  { id: 13, a: 1656, b: 1830, light: "golden", crowd: "decoys", tau: (t) => t },
  { id: 14, a: 1830, b: TOTAL, light: "day", crowd: "tail", tau: (t) => t },
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 8: 8, 11: 8, 12: 6, 13: 8, 14: 8 };
export const FLASH_AT = 127;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
// Grammar (motion.md): every move is a symmetric smootherstep glide of 18-40 f (peak speed = 1.875 x distance / dur,
// so dur >= 0.075 x the move in 720p px keeps the peak near the reference 14-25 px/f); a reframe bigger than about
// half a frame width or 40 % zoom is a hard cut on its key frame. Glides are centred on the old key frame (the
// whoosh in the sound mix peaks there), so a glide key starts dur/2 earlier. Holds push in (dolly toward the look
// point or a fov zoom near walls/towers): 0.15-0.35 %/f, ~0.6 %/f for ~35 f on punch words. Rolls of 4-8 deg
// over >= 18 f on emphasis beats, held tilt <= 0.07 rad.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release, ~10 f each on a 23 f move) */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put, for lenses next to walls/hangars): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook): high 3/4 aerial of the wooden field -> glide to the row of fake fighters -> near one fighter's nose
const PLANE_ROW_Z = 14.5;
const S1a = (f: number) => dolly([26, 26, -52], [4, 1.2, 6], pushK(f, 0, 0.0025), { fov: 44 });
const S1b = (f: number) => dolly([12, 7.5, -26], [8, 1.6, 10], pushK(f, 30, 0.002), { fov: 40, roll: -0.04 });
const S1c = (f: number) => dolly([4.6, 2.0, 18.6], [1, 1.5, 14.2], pushK(f, 72, 0.003), { fov: 38, roll: 0.045 });
// shot 2 (the real field, bombed): craters + smoke + colonel with the map; punch on "flattening"
const S2a = (f: number) => zoom([-24, 6.5, -30], [-38, 1.4, 4], 44, pushK(f, 133, 0.002));
const S2b = (f: number) => zoom([-32, 3.6, -18], [-44, 1.2, 2], 40, pushK(f, 195, 0.002));
const S2c = (f: number) => dolly([-38.5, 2.1, 3.4], [-52, 1.25, 1.4], pushK(f, 249, 0.0018, 0.006, 35), { fov: 38, roll: 0.035 }); // colonel at the map, MS
// shot 3 (carpenters): runway close, hammers in rhythm -> lower over the plank row (boots + planks CU)
const S3a = (f: number) => dolly([-14, 2.3, 12.5], [2, 0.7, -2], pushK(f, 333, 0.002), { fov: 42 });
const S3b = (f: number) => dolly([-2.6, 0.9, 7.4], [4, 0.35, -2.5], pushK(f, 393, 0.0018), { fov: 38, roll: 0.03 });
// shot 4 (shells): hangar row rising, truck rolls in, gun pit placed; side arc
const S4a = (f: number) => dolly([-42, 3.4, 6], [6, 3.4, -30], pushK(f, 461, 0.0018), { fov: 46 });
const S4b = (f: number) => dolly([-16, 2.6, 2], [10, 3.2, -30], pushK(f, 511, 0.002), { fov: 40, roll: 0.03 });
const S4c = (f: number) => dolly([10, 2.2, 10], [26, 1.4, 8], pushK(f, 557, 0.002), { fov: 38 });
// shot 5 (the rail plane): MS of the fighter idling at the rail block -> track-along -> let it exit and hold
const S5a = (f: number) => dolly([24.5, 1.9, 25.5], [22, 1.5, 17.5], pushK(f, 612, 0.0022), { fov: 40, roll: -0.03 });
const S5b = (f: number) => { const x = railFX(f); return dolly([x - 1.5, 2.1, 25.4], [x, 1.5, 17.5], pushK(f, 659, 0.002), { fov: 38 }); };
const S5c = (f: number) => dolly([31, 2.4, 23.5], [26, 1.4, 17.5], pushK(f, 697, 0.0018), { fov: 42, roll: 0.035 });
// shot 6 (gawk): the recon glint above + faces shading eyes -> follow the shadow of the camera plane? hold
const S6a = (f: number) => zoom([6, 9.5, 24], [2, 8, 2], 46, pushK(f, 743, 0.002), { roll: -0.03 }); // sky/contrail framing, cutout of the field below
const S6b = (f: number) => dolly([-6.5, 2.0, 12], [0, 1.7, 16], pushK(f, 789, 0.0022), { fov: 40 }); // faces shading eyes
// shot 7 (party): mugs up behind the hangar; colonel nods "working"
const S7a = (f: number) => dolly([-24, 1.9, -18], [-14, 1.5, -24], pushK(f, 896, 0.002), { fov: 42 });
const S7b = (f: number) => dolly([-19.5, 1.7, -20.5], [-15.5, 1.45, -24], pushK(f, 949, 0.0018), { fov: 38, roll: 0.03 });
const S7c = (f: number) => zoom([-20.5, 1.6, -21.3], [-16, 1.5, -24], 40, pushK(f, 1005, 0.0015, 0.006, 30), { roll: -0.03 });
// shot 8 (crossing): the final plank + bright dawn -> the lone RAF plane far over the sea, crossing west-east
const S8a = (f: number) => dolly([36, 2.2, 10], [22, 0.7, -4], pushK(f, 1059, 0.0015), { fov: 44 }); // the final plank, golden
const S8b = (f: number) => dolly([46, 3.0, 6], [8, 6.5, -20], pushK(f, 1093, 0.002), { fov: 46, roll: 0.03 }); // tilt up-left into the sky
const S8c = (f: number) => { const p = planeAt(f / FPS); return dolly([p.x - 9, p.y + 2.6, p.z + 12], [p.x + 6, p.y - 0.4, p.z - 1], pushK(f, 1119, 0.0018), { fov: 40, roll: -0.04 }); };
// shot 9 (one circle): high over the field watching the lap, closer on the last quarter (release)
const S9a = (f: number) => dolly([2, 21, 46], [2, 9, 2], pushK(f, 1152, 0.0016), { fov: 46 });
const S9b = (f: number) => { const p = planeAt(f / FPS); return dolly([p.x + 7, p.y + 2.8, p.z + 9], [p.x, p.y, p.z], pushK(f, 1198, 0.002), { fov: 40, roll: 0.04 }); };
// shot 10 (clonk + WOOD FOR WOOD): ground level at the runway: fall past lens, clonk + bounce, then the officer walks up
const S10a = (f: number) => dolly([8.5, 2.4, 12.5], [1, 0.8, 1], pushK(f, 1246, 0.0018), { fov: 42 });
const S10b = (f: number) => dolly([3.2, 1.1, 5.6], [-1.6, 0.6, 1.0], pushK(f, 1292, 0.002), { fov: 38, roll: -0.035 });
const S10c = (f: number) => dolly([2.9, 0.8, 4.6], [-0.6, 0.55, 1.6], pushK(f, 1330, 0.0022), { fov: 34 }); // CU on the painted side text
// shot 11 (pilot): cockpit close-up, the eyes that get two seconds
const S11a = (f: number) => zoom([-158, 7.2, 52], [-148, 6.4, 60], 42, pushK(f, 1426, 0.0022), { roll: 0.03 });
const S11b = (f: number) => zoom([-156.5, 7.0, 53.5], [-148.5, 6.5, 60], 36, pushK(f, 1479, 0.002), { roll: -0.03 });
// shot 12 (coat): the dark hallway, coat on a hook (a night inside the joke)
const S12a = (f: number) => zoom([-158, 6.8, 118], [-148, 6.2, 126], 42, pushK(f, 1531, 0.002), { roll: -0.02 });
const S12b = (f: number) => zoom([-157.2, 6.6, 119.2], [-148.2, 6.3, 126], 37, pushK(f, 1589, 0.0018, 0.006, 30), { roll: 0.03 });
// shot 13 (decoys): the British mirror trick at dusk, fake Spitfires + flare path; bomber overhead; thuds land
const S13a = (f: number) => dolly([-118, 3.2, 52], [-92, 2.2, 84], pushK(f, 1662, 0.0016), { fov: 46 });
const S13b = (f: number) => dolly([-104, 2.4, 66], [-88, 2.0, 84], pushK(f, 1715, 0.002), { fov: 40 });
const S13c = (f: number) => zoom([-101, 2.3, 68], [-87, 2.0, 84], 40, pushK(f, 1765, 0.0018, 0.005, 28), { roll: 0.03 });
// shot 14 (tail): the wooden field whole again, then the final push-in to the bomb on the last words
const S14a = (f: number) => dolly([40, 14, 52], [0, 1.5, 0], pushK(f, 1836, 0.0012), { fov: 46 });
const S14b = (f: number) => dolly([7, 3.2, 14], [-0.4, 0.75, 1.7], pushK(f, 1897, 0.0018), { fov: 40, roll: -0.03 });
const S14c = (f: number) => dolly([2.1, 1.0, 5.2], [-0.6, 0.55, 1.6], pushK(f, 1957, 0.0022, 0.006, 40), { fov: 34, roll: 0.03 });

const railFX = (f: number) => railX(f / FPS);

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 30, dur: 37, s: S1b }, // glide to the fighter row on "wooden" (0.72-1.0)
    { f: 72, dur: 30, s: S1c }, // nose down to the fighter on "fool Britain", roll flip
  ],
  2: [
    { f: 133, s: S2a }, // cut (post-flash) to the cratered real field
    { f: 195, dur: 18, s: S2b }, // centred on 204 ("flattening")
    { f: 249, dur: 20, s: S2c }, // to the colonel + map on "decide to build a decoy"
  ],
  3: [
    { f: 333, s: S3a }, // cut on "So the carpenters"
    { f: 393, dur: 26, s: S3b }, // centred on 406 ("painted the exact grey")
  ],
  4: [
    { f: 461, s: S4a }, // cut on "the wooden hangars"
    { f: 511, cut: true, s: S4b }, // cut on "gun pits"
    { f: 557, dur: 22, s: S4c }, // glide with the trucks on "squadron paint"
  ],
  5: [
    { f: 612, s: S5a }, // cut on "One fake fighter"
    { f: 659, dur: 34, s: S5b }, // track-along with the plane
    { f: 697, dur: 20, s: S5c }, // hold on the managers waving caps
  ],
  6: [
    { f: 743, s: S6a }, // cut up at the sky on "Month after month"
    { f: 789, dur: 22, s: S6b }, // down to the faces shading eyes
  ],
  7: [
    { f: 896, s: S7a }, // cut on "And month after month"
    { f: 949, dur: 18, s: S7b },
    { f: 1005, dur: 26, s: S7c }, // punch on "The camouflage, clearly, is working" -> zoom
  ],
  8: [
    { f: 1059, s: S8a },
    { f: 1093, cut: true, s: S8b }, // tilt into the sky on "lone RAF plane"
    { f: 1119, dur: 18, s: S8c }, // ride alongside the crossing plane
  ],
  9: [
    { f: 1152, s: S9a }, // high over the field
    { f: 1198, cut: true, s: S9b }, // closer on the lap + release
  ],
  10: [
    { f: 1246, s: S10a },
    { f: 1292, cut: true, s: S10b }, // cut to the clonk framing (kick lands there)
    { f: 1330, dur: 26, s: S10c }, // CU the painted side on "Unluckily..."
  ],
  11: [
    { f: 1426, s: S11a },
    { f: 1479, dur: 24, s: S11b },
  ],
  12: [
    { f: 1531, s: S12a },
    { f: 1589, dur: 28, s: S12b },
  ],
  13: [
    { f: 1662, s: S13a },
    { f: 1715, dur: 24, s: S13b },
    { f: 1765, dur: 26, s: S13c },
  ],
  14: [
    { f: 1836, s: S14a },
    { f: 1897, dur: 26, s: S14b }, // glide to the bomb on "no one could ever destroy"
    { f: 1957, dur: 30, s: S14c }, // the final push-in on "returned the compliment"
  ],
};

// impact kicks: the image offset flips sign every frame (~3 px at 720p per unit), decays under 7 f
export const kickAt = (t: number) => clonkKick(t);

export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(TW(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
const TW = (f: number) => f / FPS;
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Reference: DOF on in ~1/3 of shots; when on, background sigma720 CU 4.2, MS 4.0, FS 2.7, WS 1.9,
 *  foreground objects 4-8 (disc radius at 1080p = 3 x sigma720). Establishing/wide/most full shots stay sharp.
 *  Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point (else the
 *  camera look point). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const railXY = (f: number): V3 => [railX(f), 1.4, 17.5];
export const DOF: Dof[] = [
  { f: 0, cInf: 14, focus: () => [8, 2.2, 14.5] }, // hook glide: the fighter row sharp, the field soft
  { f: 72, dur: 30, cInf: 15, focus: () => [1, 1.5, 14.2] }, // nose CU
  { f: 133, cInf: 0 }, // cratered real field (establishing)
  { f: 333, cInf: 0 }, // carpenters: kept readable
  { f: 393, dur: 26, cInf: 11, focus: () => [2, 0.5, -2] }, // planks + boots CU
  { f: 461, cInf: 0 }, // shells wide
  { f: 557, cInf: 8, focus: () => [26, 1.4, 8] }, // trucks roll in, mild
  { f: 612, cInf: 0 },
  { f: 659, dur: 34, cInf: 12, focus: railXY }, // track-along plane
  { f: 743, cInf: 0 },
  { f: 789, dur: 22, cInf: 12, focus: () => [0, 1.7, 16] }, // gawking faces
  { f: 896, cInf: 0 },
  { f: 1005, dur: 26, cInf: 10, focus: () => [-16, 1.5, -24] }, // colonel nods
  { f: 1059, cInf: 4, focus: () => [30, 0.6, -4] }, // golden final plank, mild
  { f: 1093, cInf: 0 }, // sky + crossing: sharp
  { f: 1246, cInf: 8, focus: () => [0, 2.5, 1] }, // bomb fall past lens
  { f: 1292, cInf: 10, focus: () => [-1.6, 0.6, 1] }, // clonk area
  { f: 1330, dur: 26, cInf: 14, focus: () => [-0.6, 0.55, 1.6] }, // WOOD FOR WOOD CU
  { f: 1426, cInf: 0 }, // cockpit card scene: sharp draw
  { f: 1525, cInf: 0 }, // coat card scene: sharp
  { f: 1662, cInf: 0 }, // decoys wide: kept readable
  { f: 1830, cInf: 0 }, // tail wide
  { f: 1957, dur: 30, cInf: 15, focus: () => [-0.6, 0.55, 1.6] }, // final push on the bomb
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // S3a: the cart in the bottom-left corner at ~2.6 m (sight ~6 m)
  { a: 333, b: 393, kit: "cart", pos: [-11.2, 0, 10.6], s: 0.9, yaw: 0.35 },
  // S14b: a bush in the bottom-left, clear of the bomb itself
  { a: 1897, b: 1957, kit: "plant_bushDetailed", pos: [3.4, 0, 3.6], s: 1.1, yaw: 0.5 },
];

// ================= cast anchors (one table, so world and cast agree on every spot) =================
/** standing spots of the build crews, keyed to what each shot needs; cast.ts offsets from these */
export const BUILD = {
  // the plank line crews ride the tide edge in shot 3 (5 hammers + painter + 2 carriers ride behind the edge)
  plankCrew: (edgeX: number): [number, number][] => [
    [edgeX - 2.2, -4.6], [edgeX - 2.0, -1.8], [edgeX - 2.4, 0.9], [edgeX - 2.1, 3.6], [edgeX - 2.3, 6.2],
  ],
  painter: (edgeX: number): [number, number] => [edgeX - 5.4, 4.6],
  carrierA: (edgeX: number): [number, number] => [edgeX - 7.6, -2.6],
  carrierB: (edgeX: number): [number, number] => [edgeX - 9.2, 2.2],
  // hangar crew for shot 4: frames + a rolled-truck driver
  hangarCrew: [[-24.5, -25.2], [-19.5, -26.4], [-13.5, -25.6], [-8.6, -27.2], [-3.6, -26.0], [2.6, -27.0], [8.4, -25.8]] as [number, number][],
  truckDriver: [-29.2, 17.0] as [number, number],
  gunCrew: [[40.2, 16.8], [42.8, 14.6]] as [number, number][],
  // rail-plane staff for shot 5 (waving caps as it goes by, then shake heads proudly)
  railStaff: [[25.5, 21.6], [28.8, 22.2], [32.6, 21.4], [35.9, 22.0]] as [number, number][],
  // shot 6: faces shading eyes along the south apron (watching the photo pass)
  gawkCrew: [[-7.6, 13.4], [-4.2, 14.6], [-0.8, 13.0], [2.8, 15.2], [6.4, 14.0], [9.8, 15.6]] as [number, number][],
  // shot 7: the mug party behind the hangar row (raised mugs on "hardly believe it")
  party: [[-23.4, -21.8], [-20.8, -23.4], [-18.0, -22.0], [-15.6, -23.8], [-13.2, -22.2], [-16.8, -25.2]] as [number, number][],
  colonelParty: [-19.2, -25.6] as [number, number],
  // shot 2: the colonel + two greatcoat officers at the wrecked real-field map table
  colonelMap: [-52.0, 1.5] as [number, number],
  officersMap: [[-50.4, 3.4], [-50.8, -0.6]] as [number, number][],
  // shot 8: the dawn carpenter at the final plank (east end)
  finalPlankSpot: [48.6, 0] as [number, number],
  // shot 10: the trench crew pops up at the clonk; the officer walks from the apron to the bomb
  trenchCrew: [[-8.9, -15.2], [-7.1, -15.0], [-5.6, -15.5]] as [number, number][],
  officerWalkFrom: [-14.5, 8.0] as [number, number],
  officerAtBomb: [2.15, 3.0] as [number, number],
  // shot 13: the British night crew tending decoys (idle hands, one on a lamp)
  nightCrew: [[-90.5, 69.5], [-94.5, 76.0], [-99.0, 82.0]] as [number, number][],
};
