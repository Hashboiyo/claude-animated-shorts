// Our cast as lit flat sprites in the 3D world for "The Wooden Bomb". Each frame every character asks for a
// drawing (a key + a draw call); the pool keeps one canvas per distinct drawing, so the carpenters' 7 head shapes
// x 3 outfits share canvases and the marching beat stays cheap. Characters are yaw-only billboards shaded by
// cardShade(); standing ones get a soft multiply contact blob. Effects are unlit cards on the NOINK layer.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, LUFT, LUFT_OFF, LUFT_GREATCOAT, CARP, RAF_PLOT,
  fxBurst, fxShadow, fxContact, fxSpeed, fxPuff,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, V3, clamp01, smooth, BUILD, railX, CLONK, SHOTS,
} from "./story";
import type { BuildState } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool (unchanged machinery) ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes (unchanged machinery) ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    this.mesh.onBeforeRender = (renderer) => { const rt = renderer.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : renderer.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
// the WWII field cast: 7 head shapes
export const CREW = [0, 1, 2, 3].map((v) => LUFT(v));
export const OFFS = LUFT_OFF;
export const COATS = [0, 1].map((v) => LUFT_GREATCOAT(v));
export const CARPS = [0, 1, 2].map((v) => CARP(v));
const SEEDS = [1, 2, 3, 4, 5, 6, 7];
const seedOf = (i: number) => SEEDS[(i * 5 + 3) % 7];
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440x2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light (unchanged machinery) ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e2 = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e2 < err) { err = e2; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks + reaction timing ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
/** reaction swap beats (s): the visual lands 0-3 f before its word */
const SWAPS: Record<number, number[]> = {
  1: [4.2 - 0.1],          // flash-forward: no cast
  2: [6.9, 8.9],           // "British bombers..." shock -> "decide to build a decoy" stern
  6: [24.5],               // photo plane glint: look up
  7: [30.5, 32.4],         // mugs up on "hardly believe" -> nod on "clearly working"
  10: [CLONK, 45.05],      // trench crew pops at the clonk; the officer reads on "Unluckily"
  14: [64.1],              // the last stare on "compliment"
};
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts = {}, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2 * scale, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing card: tight contact pool + a day tail away from the sun */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** hammer strike cycles for the build beats: 1 = struck, 0 = raised; sync frames land on the beat grid */
const hammerK = (t: number, i: number, period = 0.52) => {
  const u = (t / period + i * 0.37) % 1;
  return u > 0.62 ? q((u - 0.62) / 0.38, 30) : 0;
};

/** shot 2: the colonel + greatcoat officers at the wrecked real field, map out, fingers of blame */
const wreckCast = (cam: CamInfo, t: number, out: Stage) => {
  const stab = t > 7.2 && t < 8.4 ? 0.5 + 0.5 * Math.sin(t * 17) : 0; // repeated stabs on "flattening"
  const [mx, mz] = BUILD.colonelMap;
  const co: Who = { i: 310, o: OFFS, okey: "luftoff" };
  out.places.push(person(cam, co, mx, 0, mz, { side: false, mirror: false },
    { mode: "stand", expr: t < 6.9 ? "stern" : t < 8.9 ? "shock" : "stern", prop: "map", look: stab ? 1 : 0, blink: lidAt(t, 310, SWAPS[2]) }));
  blob(out, mx, 0, mz, 1.08);
  BUILD.officersMap.forEach(([x, z], i) => {
    const who: Who = { i: 311 + i, o: COATS[i % 2], okey: `coat${i % 2}` };
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false },
      { mode: "stand", expr: t < 6.9 ? "nervous" : "stern", look: t < 8.9 ? 1 : 0, blink: lidAt(t, 311 + i, SWAPS[2]) }));
    blob(out, x, 0, z);
  });
  // one soldier points west at the smoking craters on "keep flattening"
  const who: Who = { i: 313, o: CREW[1], okey: "crew1" };
  out.places.push(person(cam, who, -45.5, 0, 6.4, { side: false, mirror: false },
    { mode: "stand", expr: "shock", look: -1, wave: t > 7.4 && t < 8.5 ? q(Math.abs(Math.sin(t * 9)), 40) : undefined, blink: lidAt(t, 313) }));
  blob(out, -45.5, 0, 6.4);
};

/** shot 3: the plank crews ride the tide edge, hammers in rhythm; the painter follows with the grey */
const plankCast = (cam: CamInfo, t: number, out: Stage) => {
  const edge = plankEdgeOf(t);
  const crew = BUILD.plankCrew(edge);
  crew.forEach(([x, z], i) => {
    const who: Who = { i: 320 + i, o: CARPS[i % 3], okey: `carp${i % 3}` };
    const strike = hammerK(t, i);
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false },
      { mode: "stand", expr: i % 3 === 0 ? "grin" : "neutral", prop: ["hammer", strike], blink: lidAt(t, 320 + i) }));
    blob(out, x, 0, z);
  });
  // the painter + the two carriers with shoulder planks
  const [px, pz] = BUILD.painter(edge);
  out.places.push(person(cam, { i: 325, o: CARPS[2], okey: "carp2" }, px, 0, pz, { side: false, mirror: false },
    { mode: "stand", expr: "smile_closed", prop: "plank", blink: lidAt(t, 325) }));
  blob(out, px, 0, pz);
  for (const [ix, spot] of [BUILD.carrierA(edge), BUILD.carrierB(edge)].entries()) {
    out.places.push(person(cam, { i: 327 + ix, o: CARPS[ix % 2], okey: `carp${ix % 2}` }, spot[0], 0, spot[1], { side: false, mirror: false },
      { mode: "stand", expr: "neutral", prop: "plank", blink: lidAt(t, 327 + ix) }));
    blob(out, spot[0], 0, spot[1]);
  }
};
const plankEdgeOf = (t: number) => -34 + 78 * clamp01((t - 12.14) / 2.37);

/** shot 4: the hangar crews + a truck driver + the gun crew (background life for the big build beat) */
const shellsCast = (cam: CamInfo, t: number, out: Stage) => {
  BUILD.hangarCrew.forEach(([x, z], i) => {
    const who: Who = { i: 330 + i, o: CARPS[i % 3], okey: `carp${i % 3}` };
    const carry = i % 2 === 1;
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false },
      { mode: "stand", expr: carry ? "neutral" : i % 4 === 0 ? "grin" : "stern", prop: carry ? "plank" : ["hammer", hammerK(t, i + 3, 0.6)], blink: lidAt(t, 330 + i) }));
    blob(out, x, 0, z);
  });
  const who: Who = { i: 337, o: CREW[2], okey: "crew2" };
  const [x, z] = BUILD.truckDriver;
  out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false },
    { mode: "stand", expr: "grin", prop: "shako", blink: lidAt(t, 337) }));
  blob(out, x, 0, z);
  BUILD.gunCrew.forEach(([x, z], i) => {
    out.places.push(person(cam, { i: 338 + i, o: CREW[(i + 1) % 3], okey: `crew${(i + 1) % 3}` }, x, 0, z, { side: false, mirror: false },
      { mode: "stand", expr: "stern", prop: i ? null : ["hammer", hammerK(t, i + 9, 0.9)], blink: lidAt(t, 338 + i) }));
    blob(out, x, 0, z);
  });
};

/** shot 5: the rail staff wave their caps as the fighter trundles past */
const railsCast = (cam: CamInfo, t: number, out: Stage) => {
  BUILD.railStaff.forEach(([x, z], i) => {
    const near = Math.abs(railX(t) - x) < 7;
    const who: Who = { i: 340 + i, o: CARPS[i % 3], okey: `carp${i % 3}` };
    const fo: FrontOpts = { mode: "stand", expr: near ? (i % 2 ? "laugh" : "grin") : "smile_closed",
      wave: near ? q(Math.sin(t * 8 + i * 1.4), 40) : undefined, blink: lidAt(t, 340 + i, SWAPS[5] ?? []) };
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo));
    blob(out, x, 0, z);
  });
};

/** shot 6: the field crew shades its eyes at the photo pass */
const gawkCast = (cam: CamInfo, t: number, out: Stage) => {
  BUILD.gawkCrew.forEach(([x, z], i) => {
    const who: Who = { i: 345 + i, o: CREW[i % 3], okey: `crew${i % 3}` };
    const fo: FrontOpts = { mode: "stand", expr: i % 3 === 1 ? "shock" : "stern", look: -1,
      wave: i % 2 ? undefined : q(Math.max(0, Math.sin(t * 5 + i)) * 0.4, 40), blink: lidAt(t, 345 + i, SWAPS[6]) };
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo));
    blob(out, x, 0, z);
  });
};

/** shot 7: the mug party behind the hangars; the colonel raises his and nods */
const partyCast = (cam: CamInfo, t: number, out: Stage) => {
  const up = t > 30.45 && t < 34.6 ? 1 : Math.max(0, smooth((t - 29.9) / 0.55) - smooth((t - 34.4) / 0.5));
  BUILD.party.forEach(([x, z], i) => {
    const who: Who = { i: 350 + i, o: CREW[i % 3], okey: `crew${i % 3}` };
    const fo: FrontOpts = { mode: "stand", expr: i % 3 === 0 ? "laugh" : i % 3 === 1 ? "grin" : "smile_closed",
      prop: ["mug", q(up, 40)], look: i % 2, blink: lidAt(t, 350 + i, SWAPS[7]) };
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo));
    blob(out, x, 0, z);
  });
  const [cx, cz] = BUILD.colonelParty;
  out.places.push(person(cam, { i: 356, o: OFFS, okey: "luftoff" }, cx, 0, cz, { side: false, mirror: false },
    { mode: "stand", expr: "stern", prop: ["mug", q(up, 40)], blink: lidAt(t, 356, SWAPS[7]) }));
  blob(out, cx, 0, cz, 1.08);
};

/** shot 8: one carpenter taps the final plank down in the dawn, then wipes his brow */
const crossCast = (cam: CamInfo, t: number, out: Stage) => {
  const [x, z] = BUILD.finalPlankSpot;
  const strike = t > 35.4 && t < 36.8 ? hammerK(t, 0, 0.44) : 0;
  const done = t > 36.9;
  out.places.push(person(cam, { i: 360, o: CARPS[0], okey: "carp0" }, x, 0, z, { side: false, mirror: false },
    { mode: "stand", expr: done ? "relief" : strike > 0.9 ? "grin" : "neutral", prop: done ? undefined : ["hammer", strike], blink: lidAt(t, 360) }));
  blob(out, x, 0, z, 1, done ? 0.9 : 1);
};

/** shot 10: the trench crew pops up at the clonk; the officer walks up and reads the painted side */
const clonkCast = (cam: CamInfo, t: number, out: Stage) => {
  const risen = smooth((t - CLONK - 0.05) / 0.4);
  BUILD.trenchCrew.forEach(([x, z], i) => {
    const who: Who = { i: 363 + i, o: i === 1 ? CREW[1] : { ...CREW[i % 3], hat: null }, okey: `bare${i % 3}` };
    const y = -1.05 + 1.05 * risen;
    out.places.push(person(cam, who, x, y, z, { side: false, mirror: false },
      { mode: risen > 0.9 ? "stand" : "fall", expr: risen < 0.5 ? "shock" : i ? "dazed" : "relief_open", blink: lidAt(t, 363 + i, SWAPS[10]) }));
    if (risen > 0.9) blob(out, x, 0, z, 0.92);
  });
  // the officer: from the apron to the bomb, stops, bends to the text, then the flat stare to camera
  const t0 = 42.9, walkT = clamp01((t - t0) / 1.6);
  const [fx0, fz0] = BUILD.officerWalkFrom, [ex, ez] = BUILD.officerAtBomb;
  const x = fx0 + (ex - fx0) * smooth(walkT), z = fz0 + (ez - fz0) * smooth(walkT);
  const reading = t > 45.05;
  const stroll = walkT < 1;
  const who: Who = { i: 366, o: OFFS, okey: "luftoff" };
  const fo: FrontOpts = stroll
    ? { mode: "stroll", phase: q(((t - t0) * 1.05 / 1.4) % 1, 120), expr: "stern", blink: lidAt(t, 366, SWAPS[10]) }
    : { mode: "stand", expr: reading ? (t > 45.62 ? "stern" : "shock") : "stern", look: 0, blink: lidAt(t, 366, SWAPS[10]) };
  out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false }, fo));
  blob(out, x, 0, z, 1.08);
};

/** shot 11: speed lines behind the cockpit card's pilot (the card itself lives in world.ts) */
const pilotCast = (cam: CamInfo, t: number, out: Stage) => {
  void cam;
  for (let i = 0; i < 2; i++) {
    const u = q(((t * 0.9 + i * 0.5) % 1 + 1) % 1, 30);
    out.fx.push({ key: `speed${u}`, cw: 620, ch: 300, draw: (p) => fxSpeed(p, u),
      x: -140.0 + i * 0.4, y: 9.2 - i * 2.2, z: 60.5, w: 5.0, h: 2.4 });
  }
};

/** shot 13: the idle night crew tending the British decoys + small thud blooms where the German bombs land */
const decoysCast = (cam: CamInfo, t: number, out: Stage) => {
  BUILD.nightCrew.forEach(([x, z], i) => {
    const who: Who = { i: 370 + i, o: i === 1 ? RAF_PLOT : { ...CREW[i % 3], hat: null }, okey: i === 1 ? "rafplot" : `bare${i % 3}` };
    out.places.push(person(cam, who, x, 0, z, { side: false, mirror: false },
      { mode: "stand", expr: i === 1 ? "relief" : "nervous", look: i - 1, blink: lidAt(t, 370 + i), prop: i === 1 ? ["mug", 0.2] : undefined }));
    blob(out, x, 0, z);
  });
  const thuds = [56.3, 58.05, 59.85, 60.55];
  thuds.forEach((th, i) => {
    const u = (t - th) / 1.1;
    if (u < 0 || u >= 1) return;
    out.fx.push({ key: `thud${i}|${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#ffd9a0", 7, 30, 170),
      x: -92 + i * 3.1, y: 0.3, z: 72 + i * 4.4, w: 2.4, h: 2.4 });
    const u2 = q(clamp01(u * 1.25), 30);
    out.fx.push({ key: `dust${i}|${u2}`, cw: 400, ch: 400, draw: (p) => fxPuff(p, u2), soft: true,
      x: -92 + i * 3.1, y: 0.6, z: 72 + i * 4.4, w: 3.6, h: 3.6 });
  });
};

/** shot 14: one ground crewman stares at the bomb with arms crossed (the film's last stillness) */
const tailCast = (cam: CamInfo, t: number, out: Stage) => {
  void cam;
  const x = -7.4, z = 4.4;
  out.places.push(person(cam, { i: 380, o: CREW[0], okey: "crew0" }, x, 0, z, { side: false, mirror: false },
    { mode: "stand", expr: "stern", look: 1, blink: lidAt(t, 380, SWAPS[14]) }));
  blob(out, x, 0, z);
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo, b: BuildState): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  void b;
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.crowd) {
    case "wreck": wreckCast(cam, t, out); break;
    case "planks": plankCast(cam, t, out); break;
    case "shells": shellsCast(cam, t, out); break;
    case "rails": railsCast(cam, t, out); break;
    case "gawk": gawkCast(cam, t, out); break;
    case "party": partyCast(cam, t, out); break;
    case "cross": crossCast(cam, t, out); break;
    case "clonk": clonkCast(cam, t, out); break;
    case "pilot": pilotCast(cam, t, out); break;
    case "decoys": decoysCast(cam, t, out); break;
    case "tail": tailCast(cam, t, out); break;
    default: break;
  }
  return out;
};

// no-op shims kept for the world contract (no bridge snap/splash/creak in this film)
export const snapFx = (_t: number, _at: V3, _out: Stage) => {};
export const splashFx = (_t: number, _out: Stage) => {};
export const creakFx = (_t: number, _pts: V3[], _out: Stage) => {};
export { FPS };
