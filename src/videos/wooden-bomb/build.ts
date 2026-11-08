// Static scenery + the prop factories for "The Wooden Bomb": merged batches (one mesh per material), the polder
// field dressing (barn, hedges, windmill, trees, access road), the crater zone of the real airfield, and the
// factories for the planes (parked wooden fighters, the live rail plane, the RAF aircraft, the British decoy
// Spitfires) and the bomb. Merged static pieces never move; the live factories return small groups so world.ts
// can pose them per frame from the story physics.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, ctex, facadeHD, roofHD, hangarHD, hangarRoofHD, liveryHD, airframeHD, bombHD, bombNoseHD } from "./paint";
import { twoTone } from "./shade";

export type Kit = Record<string, THREE.Object3D>;
export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------- materials (shared, cached) ----------------
const mats = new Map<string, THREE.Material>();
export const lam = (key: string, make: () => THREE.MeshLambertMaterialParameters) => {
  let m = mats.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) { m = twoTone(new THREE.MeshLambertMaterial(make())); mats.set(key, m); }
  return m;
};

// ---------------- geometry pieces ----------------
const f32 = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
  const out = new Float32Array(a.count * a.itemSize);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
  return new THREE.Float32BufferAttribute(out, a.itemSize);
};
/** quad a,b,c,d counter-clockwise seen from its front; uv (u0,v0) at a, (u1,v1) at c */
export const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, u1 = 1, v1 = 1, u0 = 0, v0 = 0) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2, 3, 4, 5].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1], 2));
  return g;
};
export const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
  const g = new THREE.BufferGeometry();
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c].flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 2].flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  return g;
};
/** axis box from min to max, texture tiled every `tile` metres (0 = one image per face) */
export const boxGeo = (min: THREE.Vector3, max: THREE.Vector3, tile = 0, bottom = false) => {
  const [x0, y0, z0] = [min.x, min.y, min.z], [x1, y1, z1] = [max.x, max.y, max.z];
  const t = (a: number) => (tile ? a / tile : 1);
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const faces = [
    quad(V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), t(w), t(h)),
    quad(V(x1, y0, z0), V(x0, y0, z0), V(x0, y1, z0), V(x1, y1, z0), t(w), t(h)),
    quad(V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), t(d), t(h)),
    quad(V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1), t(d), t(h)),
    quad(V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0), t(w), t(d)),
  ];
  if (bottom) faces.push(quad(V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), t(w), t(d)));
  return mergeGeometries(faces, false);
};

/** collects pieces by material and merges them into one static mesh per material */
export class Batch {
  private g = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const src = geo.index ? geo.toNonIndexed() : geo;
    const x = new THREE.BufferGeometry();
    x.setAttribute("position", f32(src.attributes.position));
    if (src.attributes.normal) x.setAttribute("normal", f32(src.attributes.normal)); else x.computeVertexNormals();
    x.setAttribute("uv", src.attributes.uv ? f32(src.attributes.uv) : new THREE.Float32BufferAttribute(new Float32Array(src.attributes.position.count * 2), 2));
    if (m) x.applyMatrix4(m);
    const l = this.g.get(mat);
    if (l) l.push(x); else this.g.set(mat, [x]);
  }
  addObject(o: THREE.Object3D, m: THREE.Matrix4) {
    o.updateMatrixWorld(true);
    o.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!mesh.isMesh) return;
      this.add(mesh.geometry, toLambert(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material), new THREE.Matrix4().multiplyMatrices(m, mesh.matrixWorld));
    });
  }
  build(parent: THREE.Object3D, cast = true) {
    for (const [mat, list] of this.g) {
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = cast; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
      parent.add(mesh);
    }
    this.g.clear();
  }
}

/** clone a factory object with Lambert materials (for live props: the rail plane, the RAF plane, the bomb) */
export const liveClone = (o: THREE.Object3D): THREE.Object3D => {
  const c = o.clone(true);
  c.traverse((x) => {
    const mm = x as THREE.Mesh;
    if (mm.isMesh) { mm.material = toLambert(mm.material as THREE.MeshStandardMaterial); }
  });
  return c;
};

// ---------------- set dressing around the lens ----------------
/** a sight line of the film: from the lens toward the shot's subject, `len` along d (d has unit forward component) */
export type Ray = { o: THREE.Vector3; d: THREE.Vector3; len: number; core: boolean };
let sight: Ray[] = [];
/** does any sight line pass through this box? (centre lines only for small props, so they can still frame a shot) */
const inTheWay = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, coreOnly = false) => {
  for (const { o, d, len, core } of sight) {
    if (coreOnly && !core) continue;
    let t0 = 0, t1 = len;
    for (const [oo, dd, a, b] of [[o.x, d.x, x0, x1], [o.y, d.y, y0, y1], [o.z, d.z, z0, z1]]) {
      if (Math.abs(dd) < 1e-9) { if (oo < a || oo > b) t0 = Infinity; continue; }
      const ta = (a - oo) / dd, tb = (b - oo) / dd;
      t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t0 <= t1) return true;
  }
  return false;
};

// ---------------- cartoon vegetation (trees + hedges, same recipe as the house style) ----------------
type VegKind = "round" | "fat" | "tall" | "cone" | "bush" | "hedge";
const VEG: Record<string, VegKind> = {
  tree_oak: "round", tree_default: "round", tree_detailed: "round", tree_fat: "fat", "tree-high-round": "tall", tree: "tall",
  tree_cone: "cone", plant_bushLarge: "bush", plant_bushDetailed: "bush", plant_bush: "bush", hedge: "hedge",
};
const LEAF = ["#5a9c46", "#4c8f3c", "#68a94a", "#53a243"];
const leafTex = (i: number) => ctex("leafHD" + i, 256, 128, (g, r) => {
  const base = new THREE.Color(LEAF[i]), top = base.clone().offsetHSL(0.012, 0.03, 0.08), bot = base.clone().offsetHSL(-0.015, 0.0, -0.08);
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, "#" + top.getHexString()); gr.addColorStop(0.42, "#" + base.getHexString()); gr.addColorStop(1, "#" + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 46; k++) {
    const x = r() * 256, y = 10 + r() * 108, rad = 5 + r() * 9, light = y < 64 ? r() < 0.7 : r() < 0.25;
    for (const ox of [-256, 0, 256]) {
      g.strokeStyle = light ? "rgba(225,255,170,0.22)" : "rgba(20,70,30,0.2)"; g.lineWidth = 2.5; g.lineCap = "round";
      g.beginPath(); g.arc(x + ox, y + rad * 0.6, rad, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
});
const leafMat = (i: number) => lam("leafHD" + i, () => ({ map: leafTex(i) }));
const barkMat = () => lam("barkHD", () => ({ color: "#8f5d3b" }));
const vegGeo = new Map<string, THREE.BufferGeometry>();
const lobeGeo = (q: number) => {
  const k = "lobe" + q;
  let g = vegGeo.get(k);
  if (!g) { g = new THREE.SphereGeometry(1, [20, 14, 10][q], [14, 10, 7][q]); vegGeo.set(k, g); }
  return g;
};
const trunkGeo = () => {
  let g = vegGeo.get("trunk");
  if (!g) { g = new THREE.CylinderGeometry(0.6, 1, 1, 10, 1, true).translate(0, 0.5, 0); vegGeo.set("trunk", g); }
  return g;
};
const hedgeGeo = () => {
  let g = vegGeo.get("hedge");
  if (!g) {
    g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 10);
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute;
    const R = [0.106, 0.29, 0.385], v = new THREE.Vector3(), e = new THREE.Vector3(), qq = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      for (let a = 0; a < 3; a++) {
        const c = v.getComponent(a), lim = a === 1 && c < 0 ? 0.5 : 0.5 - R[a];
        qq[a] = THREE.MathUtils.clamp(c, -lim, lim); e.setComponent(a, (c - qq[a]) / R[a]);
      }
      const L = e.length();
      if (L < 1e-6) continue;
      e.divideScalar(L);
      p.setXYZ(i, qq[0] + e.x * R[0], qq[1] + e.y * R[1], qq[2] + e.z * R[2]);
      const nn = new THREE.Vector3(e.x / R[0], e.y / R[1], e.z / R[2]).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
    g.translate(0, 0.5, 0);
    vegGeo.set("hedge", g);
  }
  return g;
};
const yawQ = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), a);
const vegRad = (k: VegKind, h: number) => (k === "hedge" ? 1.7 : k === "bush" ? 0.85 * h : k === "tall" ? 0.2 * h : k === "cone" ? 0.27 * h : k === "fat" ? 0.44 * h : 0.39 * h);
const addVeg = (b: Batch, k: VegKind, x: number, y: number, z: number, h: number, seed: number, q = 0) => {
  const r = rng(Math.abs(Math.floor(seed)) % 200000 + 7), U2 = (a: number, c: number) => a + (c - a) * r();
  const leaf = leafMat(k === "hedge" ? 1 : k === "cone" ? 3 : Math.floor(r() * 3)), lobe = lobeGeo(q), yaw = r() * 6.28;
  const put = (px: number, py: number, pz: number, rad: number, sy = 0.9) =>
    b.add(lobe, leaf, new THREE.Matrix4().compose(V(x + px, y + py, z + pz), yawQ(r() * 6.28), V(rad, rad * sy, rad)));
  const trunk = (th: number, tr: number) =>
    b.add(trunkGeo(), barkMat(), new THREE.Matrix4().compose(V(x, y - 0.15, z), yawQ(yaw), V(tr, th + 0.15, tr)));
  const ring = (n: number, dist: number, r0: number, r1: number, cy: number, dy: number) => {
    const a0 = r() * 6.28;
    for (let i = 0; i < n; i++) {
      const ang = a0 + (i * 6.28) / n + U2(-0.35, 0.35), dd = dist * U2(0.85, 1.12);
      put(Math.cos(ang) * dd, cy + U2(-dy, dy), Math.sin(ang) * dd, U2(r0, r1));
    }
  };
  if (k === "round" || k === "fat") {
    const f = k === "fat";
    trunk((f ? 0.4 : 0.48) * h, 0.055 * h);
    const cy = (f ? 0.58 : 0.64) * h;
    put(0, cy, 0, (f ? 0.29 : 0.26) * h);
    ring(f ? 5 : 4, (f ? 0.22 : 0.18) * h, (f ? 0.19 : 0.17) * h, (f ? 0.23 : 0.21) * h, cy - 0.05 * h, 0.04 * h);
    put(U2(-0.05, 0.05) * h, cy + (f ? 0.15 : 0.17) * h, U2(-0.05, 0.05) * h, (f ? 0.19 : 0.17) * h);
  } else if (k === "tall") {
    trunk(0.34 * h, 0.045 * h);
    put(0, 0.47 * h, 0, 0.17 * h, 1.3);
    put(U2(-0.03, 0.03) * h, 0.65 * h, U2(-0.03, 0.03) * h, 0.15 * h, 1.3);
    put(0, 0.82 * h, 0, 0.11 * h, 1.25);
    ring(3, 0.1 * h, 0.1 * h, 0.12 * h, 0.55 * h, 0.06 * h);
  } else if (k === "cone") {
    trunk(0.2 * h, 0.05 * h);
    put(0, 0.3 * h, 0, 0.26 * h, 0.62);
    put(0, 0.5 * h, 0, 0.2 * h, 0.66);
    put(0, 0.68 * h, 0, 0.14 * h, 0.75);
    put(0, 0.84 * h, 0, 0.08 * h, 1.0);
  } else if (k === "bush") {
    put(0, 0.46 * h, 0, 0.5 * h);
    ring(3, 0.42 * h, 0.32 * h, 0.38 * h, 0.32 * h, 0.04 * h);
  } else b.add(hedgeGeo(), leaf, new THREE.Matrix4().compose(V(x, y - 0.06, z), new THREE.Quaternion(), V(3.3, h + 0.06, Math.max(0.9, h * 0.78))));
};

// ---------------- Kenney props ----------------
const boxes = new Map<THREE.Object3D, THREE.Box3>();
export const prop = (b: Batch, kit: Kit, name: string, x: number, y: number, z: number, h: number, yaw = 0) => {
  const vk = VEG[name];
  if (vk) {
    const rad = vegRad(vk, h);
    if (inTheWay(x - rad, x + rad, y, y + h, z - rad, z + rad, true)) return;
    const d = Math.hypot(x, z);
    addVeg(b, vk, x, y, z, h, x * 92.7 + z * 31.3 + yaw * 1000, d > 200 ? 2 : Math.abs(z) > 45 && d > 60 ? 1 : 0);
    return;
  }
  const o = kit[name];
  if (!o) return;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const s = h / Math.max(0.01, box.max.y - box.min.y), r = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * s * 0.5;
  if (inTheWay(x - r, x + r, y, y + h, z - r, z + r, true)) return;
  b.addObject(o, new THREE.Matrix4().compose(V(x, y - box.min.y * s, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s)));
};
export const kitClone = (kit: Kit, name: string, h: number): THREE.Object3D | null => {
  const vk = VEG[name];
  if (vk) {
    const vb = new Batch(), grp = new THREE.Group();
    addVeg(vb, vk, 0, 0, 0, h, name.length * 977 + h * 131, 0);
    vb.build(grp, false);
    grp.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = true; } });
    return grp;
  }
  const o = kit[name];
  if (!o) return null;
  let box = boxes.get(o);
  if (!box) { box = new THREE.Box3().setFromObject(o); boxes.set(o, box); }
  const c = o.clone(true), s = h / Math.max(0.01, box.max.y - box.min.y);
  c.traverse((x) => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { m.material = toLambert(Array.isArray(m.material) ? m.material[0] : m.material); m.castShadow = false; m.receiveShadow = true; }
  });
  const g = new THREE.Group();
  c.position.y = -box.min.y * s; c.scale.setScalar(s);
  g.add(c);
  return g;
};

// ---------------- Lambert conversion for factory objects ----------------
const lamOf = new Map<string, THREE.MeshLambertMaterial>();
const toLambert = (m: THREE.Material) => {
  let l = lamOf.get(m.uuid);
  if (!l) {
    const s = m as THREE.MeshStandardMaterial;
    l = twoTone(new THREE.MeshLambertMaterial({ color: s.color?.clone() ?? new THREE.Color("#ffffff"), map: s.map ?? null, side: s.side, alphaTest: s.alphaTest }));
    lamOf.set(m.uuid, l);
  }
  return l;
};

// ---------------- houses (polder farm) ----------------
type Style = { wall: string; shutter: string; roof: string };
const STYLES: Style[] = [
  { wall: "#ecdab2", shutter: "#3f6fb5", roof: "#d27a62" },
  { wall: "#d8a95f", shutter: "#2f6a43", roof: "#b8644f" },
  { wall: "#efdcb8", shutter: "#2f5f6a", roof: "#c9775a" },
  { wall: "#ddbd78", shutter: "#5a3b2a", roof: "#d27a62" },
];
const roofMat = (col: string) => lam("roof" + col, () => ({ map: roofHD(col), side: THREE.DoubleSide }));
export const house = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number, y = 0) => {
  if (inTheWay(x - w, x + w, y, y + h + d * 0.5 + 1.2, z - d, z + d)) return;
  const st = STYLES[si % STYLES.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
  const front = lam(`hf${si}_${w}_${h}`, () => ({ map: facadeHD(`hf${si}_${w}_${h}`, w, h, { ...st, door: true }) }));
  const side = lam(`hs${si}_${h}`, () => ({ map: facadeHD(`hs${si}_${h}`, 8, h, st) }));
  const hw = w / 2, hd = d / 2, rh = d * 0.42;
  const wall = lam("wall" + st.wall, () => ({ color: st.wall }));
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(tri(V(-hw, h, -hd), V(-hw, h, hd), V(-hw, h + rh, 0)), wall, m);
  b.add(tri(V(hw, h, hd), V(hw, h, -hd), V(hw, h + rh, 0)), wall, m);
  const ru = (w + 1) / 4, rv = Math.hypot(hd + 0.2, rh) / 4, rm = roofMat(st.roof);
  b.add(quad(V(-hw - 0.2, h - 0.25, hd + 0.2), V(hw + 0.2, h - 0.25, hd + 0.2), V(hw + 0.2, h + rh, 0), V(-hw - 0.2, h + rh, 0), ru, rv), rm, m);
  b.add(quad(V(hw + 0.2, h - 0.25, -hd - 0.2), V(-hw - 0.2, h - 0.25, -hd - 0.2), V(-hw - 0.2, h + rh, 0), V(hw + 0.2, h + rh, 0), ru, rv), rm, m);
};

// ================= prop factories =================
/** a parked wooden fighter: barrel fuselage, inline engine, straight wings with cross decals, tail + fins, prop disc;
 *  origin under the tail wheel, nose pointing +x */
export const makePlane = (key: string, decal = true): THREE.Group => {
  const g = new THREE.Group();
  const liver = lam(`livery/${key}`, () => ({ map: liveryHD(key) }));
  const wood = lam("airframe", () => ({ map: airframeHD() }));
  const glass = lam("glass", () => ({ color: "#bfe0ee" }));
  const dark = lam("planeDark", () => ({ color: "#3a3d40" }));
  const fus = new THREE.CylinderGeometry(0.52, 0.34, 5.4, 14); fus.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(fus, liver));
  const nose = new THREE.ConeGeometry(0.52, 1.3, 14); nose.rotateZ(-Math.PI / 2);
  const noseM = new THREE.Mesh(nose, dark); noseM.position.x = 3.35; g.add(noseM);
  const cowl = new THREE.CylinderGeometry(0.56, 0.56, 0.9, 14); cowl.rotateZ(Math.PI / 2);
  const cowlM = new THREE.Mesh(cowl, dark); cowlM.position.x = 2.9; g.add(cowlM);
  // cockpit canopy
  const cp = new THREE.SphereGeometry(0.42, 12, 9); cp.scale(1.5, 0.7, 0.8);
  const cpM = new THREE.Mesh(cp, glass); cpM.position.set(0.6, 0.5, 0); g.add(cpM);
  // wings: straight plank-shaped, tapered tips, low-wing
  const wing = new THREE.BoxGeometry(2.6, 0.16, 9.2); wing.translate(-0.6, 0, 0);
  const wingM = new THREE.Mesh(wing, decal ? liver : wood); wingM.position.set(0.4, -0.16, 0); g.add(wingM);
  const tipL = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 8); tipL.rotateZ(Math.PI / 2);
  const tipM = new THREE.Mesh(tipL, decal ? liver : wood); tipM.position.set(-1.1, -0.05, 0); g.add(tipM);
  // struts to the fuselage
  for (const s of [-1, 1]) {
    const st = new THREE.BoxGeometry(0.09, 0.09, 2.6); st.rotateX(0.5);
    const stM = new THREE.Mesh(st, wood); stM.position.set(0.15, 0.18 + 0.2 * s, s * 1.1); g.add(stM);
  }
  // tail: fin + rudder + stabilizer
  const fin = new THREE.BoxGeometry(0.75, 1.15, 0.1); fin.translate(-0.2, 0, 0);
  const finM = new THREE.Mesh(fin, wood); finM.position.set(-2.55, 0.72, 0); finM.rotation.z = 0.22; g.add(finM);
  const stab = new THREE.BoxGeometry(0.7, 0.08, 2.6);
  const stabM = new THREE.Mesh(stab, decal ? liver : wood); stabM.position.set(-2.6, 0.28, 0); g.add(stabM);
  // landing gear: two legs + wheels + a tail skid
  for (const s of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.05, 0.05, 0.66, 8); leg.rotateZ(-0.3);
    const legM = new THREE.Mesh(leg, dark); legM.position.set(1.35, -0.52, s * 0.85); g.add(legM);
    const wh = new THREE.TorusGeometry(0.26, 0.09, 8, 16);
    const whM = new THREE.Mesh(wh, dark); whM.position.set(1.55, -0.86, s * 0.85); whM.rotation.x = 0; whM.rotation.y = Math.PI / 2; g.add(whM);
  }
  // fixed two-blade prop (reads in stills)
  for (const s of [-1, 1]) {
    const bl = new THREE.BoxGeometry(0.06, 1.5, 0.16); bl.translate(0, s * 0.75, 0);
    const blM = new THREE.Mesh(bl, wood); blM.position.set(4.0, 0, 0); g.add(blM);
  }
  g.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
  return g;
};

/** the wooden bomb: olive barrel + stencil band + nose cone + 4 tail fins; origin at the strap line, nose +z dream;
 *  x forward = nose... we build nose along +x, length 2.4 m, dia 0.62 */
export const makeBomb = (): THREE.Group => {
  const g = new THREE.Group();
  const shell = lam("bombBody", () => ({ map: bombHD() }));
  const noseM2 = lam("bombNose", () => ({ map: bombNoseHD() }));
  const finM = lam("bombFin", () => ({ color: "#5d5a3c" }));
  const body = new THREE.CylinderGeometry(0.31, 0.31, 2.0, 20); body.rotateZ(Math.PI / 2);
  g.add(new THREE.Mesh(body, shell));
  const nose = new THREE.ConeGeometry(0.31, 0.75, 20); nose.rotateZ(-Math.PI / 2);
  const nm = new THREE.Mesh(nose, noseM2); nm.position.x = 1.37; g.add(nm);
  const rear = new THREE.CylinderGeometry(0.31, 0.24, 0.5, 20); rear.rotateZ(Math.PI / 2);
  const rm2 = new THREE.Mesh(rear, shell); rm2.position.x = -1.24; g.add(rm2);
  for (let k = 0; k < 4; k++) {
    const fin = new THREE.BoxGeometry(0.7, 0.03, 0.44); fin.translate(0, 0, 0);
    const fm = new THREE.Mesh(fin, finM);
    fm.position.x = -1.45; fm.rotation.x = (k * Math.PI) / 2 + Math.PI / 4;
    fm.position.y = 0.13 * Math.cos(fm.rotation.x); fm.position.z = 0.13 * Math.sin(fm.rotation.x);
    g.add(fm);
  }
  // strap + rusted hanger ring so the field office can hang it
  const strap = new THREE.TorusGeometry(0.335, 0.02, 6, 20); strap.rotateY(Math.PI / 2);
  const sm = new THREE.Mesh(strap, lam("bombStrap", () => ({ color: "#4a4636" }))); sm.position.x = 0.2; g.add(sm);
  g.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
  return g;
};

/** the German fighter's rail: a low track with two sleepers + side blocks, so the gag reads "built, not bought" */
export const makeRail = (): THREE.Group => {
  const g = new THREE.Group();
  const iron = lam("railIron", () => ({ color: "#3f434e" }));
  const wood = lam("railWood", () => ({ color: "#7a5230" }));
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(24, 0.07, 0.07), iron);
    rail.position.y = -0.16; rail.position.z = s * 0.55;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24.6, 0.14, 0.16), wood);
    beam.position.y = -0.08; beam.position.z = s * 0.55;
    g.add(rail, beam);
  }
  for (let i = 0; i < 17; i++) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.5), wood);
    tie.position.set(-12 + i * 1.5, -0.04, 0);
    g.add(tie);
  }
  g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  return g;
};

// ================= the field =================
const inFarm = (x: number, z: number) => z < 0 && x > -96 && x < -40 && z > -60 && z < -22;
export const FARMS: [number, number, number, number][] = [
  [-72, -38, Math.PI / 2, 0],   // farmhouse, front facing east (the field)
  [-88, -48, Math.PI / 2, 1],
];
export const buildField = (root: THREE.Object3D, kit: Kit, rays: Ray[] = []) => {
  const b = new Batch(), r = rng(23);
  sight = rays;
  // farmhouse + shed on the west edge of the field (their fronts face the film)
  for (const [x, z, yaw, si] of FARMS) house(b, x, z, yaw, 9, 7, 7.2, si);
  // barn shells belonged to the farm look: one big shed with a wooden roof south of the farmhouse
  house(b, -78, -58, 0, 13, 9, 6.2, 2);
  // western tree ring + hedges (cull via the sight lines like everything else)
  const trees = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree-high-round", "tree"];
  for (let i = 0; i < 60; i++) {
    const a = r() * 6.28, d = 92 + r() * 120;
    prop(b, kit, trees[i % trees.length], Math.cos(a) * d, 0, Math.sin(a) * d, 8 + r() * 4, r() * 6);
  }
  for (let x = -120; x < -60; x += 7) for (const zz of [-66, 66]) if (r() > 0.12) prop(b, kit, "hedge", x, 0, zz, 1.6);
  for (let z = -50; z < 50; z += 7) prop(b, kit, "hedge", -96 + 0.4 * r(), 0, z, 1.6);
  // scattered bushes on the field borders
  for (let i = 0; i < 30; i++) {
    const x = -90 + r() * 180, z = (r() < 0.5 ? -1 : 1) * (34 + r() * 10);
    if (r() > 0.3 && Math.abs(z) > 30 && Math.abs(x) < 60) prop(b, kit, "plant_bushLarge", x, 0, z, 1.2 + r() * 0.5);
  }
  // flowers along the ditch east of the field
  for (let i = 0; i < 26; i++) {
    const f = ["flower_redA", "flower_yellowA", "flower_purpleA"][i % 3];
    prop(b, kit, f, 62 + r() * 10, 0, (r() - 0.5) * 90, 0.5 + 0.2 * r());
  }
  // two haystacks at the farm edge (polder dressing; procedural, no GLB kit needed)
  const straw = lam("straw", () => ({ color: "#d9b565" }));
  for (const [x, z, s] of [[-64, -52, 2.6], [-56.5, -55, 1.9]] as const) {
    const cone = new THREE.ConeGeometry(s * 0.85, s, 12);
    b.add(cone, straw, new THREE.Matrix4().makeTranslation(x, s * 0.5, z));
  }
  b.build(root);
  sight = [];
};
