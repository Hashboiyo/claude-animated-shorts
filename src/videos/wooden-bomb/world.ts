// The whole place as one three.js scene for "The Wooden Bomb": sky, polder, sea, the painted-plank runway that
// builds itself with the words, growing hangars, the parked decoy fighters, the rail plane, the RAF aircraft and
// the bomb fall, crater smoke, the night decoy site with its flare path, and the two flat card scenes (cockpit +
// pilot, dark hallway with the coat). update(id, f, cam, scene) poses everything; it is a pure function of shot + frame.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { Batch, V, lam, buildField, makePlane, makeBomb, makeRail, kitClone, Kit } from "./build";
import { ctex, grassHD, cobbleHD, stoneHD, beamHD, waterMarks, cloudHD, runwayHD, runwayEdge, hangarHD, hangarRoofHD, airframeHD, craterHD } from "./paint";
import { Pen, RAF_PLOT, bodyFront, Expr } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, LFB, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Actor, Fx, Pool, stage, CamInfo } from "./cast";
import { FPS, SHOTS, camAt, build, railX, railRoll, planeAt, bombState, splinterAge, RELEASE, V3, FOREGROUND, ShotDef, clamp01 } from "./story";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "windmill", "cart", "stall-red"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

/** every lens position of the film looking at its subject (hedges/houses there are left out) */
const sightLines = (): any[] => {
  const out: any[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Mats = Record<string, THREE.Material>;

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** per-shot sun override (lighting.md 9.1: right-light the field so the wide reads) */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = { 2: { az: 45 }, 8: { az: -50, el: 9 }, 9: { az: -60, el: 9 }, 10: { az: -55, el: 10 }, 11: { az: -30, el: 10 }, 12: { az: -30, el: 10 }, 13: { az: -25, el: 8 } };
const smokeTex = () => ctex("smoke", 256, 256, (g) => {
  const p = new Pen(g);
  for (const [x, y, r, c] of [[90, 150, 60, "#8f8d96"], [150, 120, 70, "#a3a1aa"], [170, 165, 55, "#8f8d96"], [120, 100, 50, "#b4b2ba"]] as const) p.ell(x, y, r, r * 0.85, c, 0);
});

/** soft radial blob texture (light pools) */
const glowTex = (rgb: string, a: number) => ctex("glowTex", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 12, 64, 64, 62);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});

/** ground top quad (uv tiles u across x, v across z) */
function gQuad(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, dy, z1, x1, dy, z1, x1, dy, z0, x0, dy, z1, x1, dy, z0, x0, dy, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}

/** place a factory object in the world (generic so Group fields keep their type) */
const plain = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, yaw = 0, show = true): T => {
  o.position.set(x, y, z); o.rotation.y = yaw; o.visible = show;
  o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
};
const popScale = (t: number, t0: number) => {
  const x = clamp01((t - t0) / 0.5);
  return x <= 0 ? 0 : x * x * (3 - 2 * x);
};

// ---------------- factories for the popped props ----------------
const makeTruck = () => {
  const g = new THREE.Group();
  const wood = lam("truckWood", () => ({ map: airframeHD() }));
  const dark = lam("truckDark", () => ({ color: "#3a3f43" }));
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 1.9), lam("truckFrame", () => ({ color: "#5a4632" })));
  chassis.position.y = 0.75; g.add(chassis);
  const boss = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.05, 1.85), wood);
  boss.position.set(-0.6, 1.35, 0); g.add(boss);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.8), lam("truckHood", () => ({ color: "#6b6f66" })));
  hood.position.set(1.85, 1.25, 0); g.add(hood);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.7), lam("truckCab", () => ({ color: "#8d9186" })));
  cab.position.set(1.2, 1.75, 0); g.add(cab);
  for (const [x, z] of [[1.7, -0.85], [1.7, 0.85], [-1.6, -0.9], [-1.6, 0.9]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12), dark);
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w);
  }
  return g;
};
const makeGun = () => {
  const g = new THREE.Group();
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.4, 0.55, 14), lam("gunPit", () => ({ color: "#8a7a5c" })));
  pit.position.y = 0.27; g.add(pit);
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), lam("gunBase", () => ({ color: "#3a3f43" })));
  base.position.y = 0.7; g.add(base);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.4, 10), lam("gunBarrel", () => ({ color: "#2f3338" })));
  barrel.position.set(Math.cos(0.6) * 1.55, 1.35, Math.sin(0.6) * 1.55); barrel.rotation.z = 1.1; g.add(barrel);
  return g;
};
const makeBarrels = () => {
  const g = new THREE.Group();
  const oil = lam("fuelBarrel", () => ({ color: "#7a5c30" }));
  for (const [x, z] of [[-0.5, 0], [0.55, -0.2], [0.05, 0.5]] as const) {
    const bbl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 12), oil);
    bbl.position.set(x, 0.52, z); g.add(bbl);
  }
  return g;
};
const makeTower = () => {
  const g = new THREE.Group();
  const wood = lam("towerWood", () => ({ color: "#7a6a4a" }));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 5.4, 0.22), wood);
    leg.position.set(x * 1.1, 2.7, z * 1.1); leg.rotation.z = -x * 0.05; g.add(leg);
  }
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.9, 3.0), wood);
  cab.position.y = 6.2; g.add(cab);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), lam("towerRoof", () => ({ color: "#5a4a35" })));
  roof.position.y = 7.75; roof.rotation.y = Math.PI / 4; g.add(roof);
  return g;
};
const makeTrenchPlanks = () => {
  const g = new THREE.Group();
  const wood = lam("trenchWood", () => ({ color: "#8a6a42" }));
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 2.0), wood);
    p.position.set(-1.4 + i * 0.95, 0.32, 0.1); p.rotation.y = (i % 2 - 0.5) * 0.16; g.add(p);
  }
  return g;
};
/** a hangar shell: posts + wall box + arch roof + chalk door hint; grows by scaleY (pivot at the ground) */
const makeHangar = (cx: number, cz: number): THREE.Group => {
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  const wood = lam("hangarWood", () => ({ color: "#8d8474" }));
  const wall = lam("hangarWall", () => ({ map: hangarHD() }));
  const roof = lam("hangarRoof", () => ({ map: hangarRoofHD() }));
  const door = lam("hangarDoor", () => ({ map: hangarHD() }));
  const W = 13.5, D = 11, H = 7.4;
  const body = new THREE.Group(); g.add(body);
  const box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wall);
  box.position.y = H / 2; body.add(box);
  const rg = new THREE.CylinderGeometry(W / 2, W / 2, D, 18, 1, true, -Math.PI / 2, Math.PI);
  rg.rotateZ(Math.PI / 2);
  const roofM = new THREE.Mesh(rg, roof);
  roofM.position.set(0, H, 0); body.add(roofM);
  const dm = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.72, D * 0.5), door);
  dm.position.set(0, 2.4, D / 2 + 0.06); body.add(dm);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, H + 0.3, 0.26), wood);
    post.position.set(sx * (W / 2 - 0.06), H / 2, sz * (D / 2 - 0.06)); body.add(post);
  }
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
};

// ---------------- the flat card scenes ----------------
// Card canvas: 1210 x 2010. At the shot framings the visible band is the centre ~560 x 1000 px, so the key content
// lives there and breathing room extends past it.
type CardPainter = (p: Pen) => void;
type CardDef = { w: number; h: number; paint: CardPainter };
const mkCard = (key: string, d: CardDef) => {
  const tex = ctex(key, d.w, d.h, (g) => d.paint(new Pen(g)));
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
};

/** shot 11: the dawn sky through the canopy, the pilot's head-and-shoulders CU, instruments below */
const cockpitPoster: CardPainter = (p) => {
  const g = p.g;
  // dawn sky band behind the canopy
  const gr = g.createLinearGradient(0, 300, 0, 1700);
  gr.addColorStop(0, "#6a4f8c"); gr.addColorStop(0.36, "#a1738f"); gr.addColorStop(0.58, "#e8967c"); gr.addColorStop(0.75, "#ffc47c"); gr.addColorStop(1, "#f2b98a");
  g.fillStyle = gr; g.fillRect(200, 0, 810, 2010);
  // the pilot (front view, big: design x2, head band y ~505..1120)
  g.save(); g.setTransform(2.0, 0, 0, 2.0, 5, 282);
  bodyFront(p, RAF_PLOT, { mode: "stand", expr: "nervous" as Expr, look: 0, blink: 0, light: 2.4, seed: 4 });
  g.restore();
  // instrument cowl below the band (in front of the chest)
  g.fillStyle = "#22242f"; g.fillRect(0, 1430, 1210, 300);
  g.fillStyle = "#2f3240"; g.fillRect(60, 1462, 1090, 240);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "#1d1f28"; g.beginPath(); g.arc(230 + i * 165, 1582, 52, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#565a70"; g.beginPath(); g.arc(230 + i * 165, 1582, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#aeb3c6"; g.fillRect(228 + i * 165 - 2, 1582 - 34, 4, 34);
  }
  // canopy frame: the posts are painted so the pilot sits inside a cockpit, not a void
  g.fillStyle = "#23252f";
  g.fillRect(0, 0, 210, 2010); g.fillRect(1000, 0, 210, 2010);
  g.fillRect(210, 0, 800, 250);
  g.beginPath(); g.moveTo(210, 250); g.quadraticCurveTo(605, 480, 1000, 250); g.lineTo(1000, 100); g.quadraticCurveTo(605, 330, 210, 100); g.closePath(); g.fill();
  g.fillRect(210, 1760, 800, 250);
  for (let i = 0; i < 26; i++) { g.fillStyle = "#3c3f4e"; g.fillRect(18 + i * 46, 12, 3, 30); g.fillRect(18 + i * 46, 1975, 3, 30); }
};

/** shot 12: dark hallway, warm door light, the coat on a hook that reads as a man */
const coatPoster: CardPainter = (p) => {
  const g = p.g;
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#453f55" : "#3d374c"; g.fillRect(0, i * 168, 1210, 168); }
  const gr = g.createRadialGradient(1075, 830, 60, 1075, 830, 700);
  gr.addColorStop(0, "rgba(255,200,120,0.62)"); gr.addColorStop(0.5, "rgba(255,185,95,0.30)"); gr.addColorStop(1, "rgba(255,185,95,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 1210, 2010);
  // warm rim from the door catching the coat's right edge (keeps the silhouette readable in the low light)
  const rim = g.createRadialGradient(660, 860, 30, 660, 860, 340);
  rim.addColorStop(0, "rgba(255,204,130,0.5)"); rim.addColorStop(1, "rgba(255,204,130,0)");
  g.fillStyle = rim; g.fillRect(280, 300, 620, 1400);
  g.fillStyle = "#221d33"; g.fillRect(940, 240, 270, 1770);
  g.strokeStyle = "#3a3247"; g.lineWidth = 14; g.strokeRect(970, 290, 200, 760); g.strokeRect(970, 1110, 200, 620);
  p.ell(972, 1020, 10, 10, "#c8a24e", 0);
  // hook board + stem + the hook
  g.fillStyle = "#2c2739"; g.fillRect(360, 470, 130, 44);
  p.stroke([[425, 500], [425, 626]], 12, "#4a4152");
  p.ell(425, 632, 9, 9, "#4a4152", 0);
  // the coat: shoulders long, collar notch = the "head gap"
  const coat: [number, number][] = [
    [425, 636], [380, 654], [338, 810], [350, 1010], [382, 1300], [368, 1560], [620, 1560], [608, 1300],
    [640, 1010], [652, 810], [610, 654],
  ];
  g.fillStyle = "#5a526c";
  g.beginPath(); coat.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  g.strokeStyle = "#1a1622"; g.lineWidth = 9; g.stroke();
  g.fillStyle = "#665d7a";
  g.beginPath(); g.moveTo(388, 680); g.lineTo(448, 742); g.lineTo(508, 680); g.lineTo(448, 656); g.closePath(); g.fill();
  // a thin_waiting_ lamp pool on the floor
  const sh = g.createRadialGradient(455, 1810, 30, 455, 1810, 340);
  sh.addColorStop(0, "rgba(210,190,255,0.30)"); sh.addColorStop(1, "rgba(210,190,255,0)");
  g.fillStyle = sh; g.fillRect(0, 1500, 1210, 510);
};

const RUNS = { x0: -34, x1: 50, z0: -8, z1: 8, step: 1.31, wall: 0.5 };
const RUNS_N = Math.ceil((RUNS.x1 - RUNS.x0) / RUNS.step);
const plankEdge = (t: number) => -34 + 78 * clamp01((t - 12.14) / 2.37);
const plankShape = (t: number, x: number) => {
  if (t < 12.0) return 0;
  const d = clamp01((plankEdge(t) - x) / (RUNS.step * 1.5));
  return d * d * (3 - 2 * d);
};
const RAIL_X0 = 20, RAIL_X1 = 40, RAIL_Z = 17.5;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private WU: Record<string, THREE.IUniform>;
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private smoke: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; top: V3; k: number }[] = [];
  private runway: THREE.Mesh; private runwayGeo: THREE.BufferGeometry;
  private edges: THREE.Mesh[] = [];
  private hangars: THREE.Group[] = [];
  private parked: THREE.Group[] = [];
  private trucks: THREE.Group[] = [];
  private gun: THREE.Group; private tower: THREE.Group; private barrels: THREE.Group;
  private trench = new THREE.Group(); private trenchPlanks: THREE.Group;
  private railPlane: THREE.Group; private rafPlane: THREE.Group; private bomb: THREE.Group;
  private splints: THREE.InstancedMesh;
  private lamps: THREE.Group[] = []; private lampGlows: THREE.Mesh[] = [];
  private decoys: THREE.Group[] = [];
  private bomber: THREE.Group; private bomberDot: THREE.Sprite;
  private posterA: THREE.Mesh; private posterB: THREE.Mesh;
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private vv = new THREE.Vector3(); private sph = new THREE.Sphere();
  private camInfo: CamInfo = { pos: new THREE.Vector3(), right: new THREE.Vector3() };

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light (the proven look engine) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- polder ground + sea + access road + crater zone + broken planks ----
    const b = new Batch();
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.iron = twoTone(new THREE.MeshPhongMaterial({ color: "#3d414c", specular: "#8a8a8a", shininess: 60 })) as THREE.Material;
    M.wood = lam("beamHD", () => ({ map: beamHD() }));
    M.airwood = lam("airframeWood", () => ({ map: airframeHD() }));
    M.dark = lam("darkProp", () => ({ color: "#43403a" }));
    M.runEdge = lam("runEdge", () => ({ map: runwayEdge() }));
    b.add(gQuad(-330, 600, -600, 600, 36, 36), M.grass);
    b.add(gQuad(-60, 60, 22.6, 26.6, 30, 1), M.cobble);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BoxGeometry(1.15 + (i % 3) * 0.35, 0.1, 0.35);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.01, i * 1.9, 0.03));
      b.add(g, M.airwood, new THREE.Matrix4().compose(V(-34 + i * 4.2, 0.032, (i % 2 ? 1 : -1) * (7.6 + 0.9 * i)), q, V(1, 1, 1)));
    }
    b.build(R);
    buildField(R, kit, sightLines());

    // sea east-of-coast... west of x -330, all z; beach strip between them
    const wNear = waterMarks("seaNear", 40, 12), wFar = waterMarks("seaFar", 260, 44);
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wShade: { value: new THREE.Vector3(0.5, 0.56, 0.72) }, wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const seaM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    seaM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", SEA_DECL)
        .replace("#include <map_fragment>", SEA_COL)
        .replace("#include <lights_fragment_begin>", "float sunVis = 1.0;\n" + LFB)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb * mix(wShade, vec3(1.0), sunVis);\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    seaM.customProgramCacheKey = () => "sea1";
    const sea = new THREE.Mesh(gQuad(-4000, -330, -4000, 4000, 120, 120, -2.4), seaM);
    R.add(sea);
    const sand = new THREE.Mesh(gQuad(-338, -330, -4000, 4000, 2, 240, -0.05), lam("sandside", () => ({ color: "#e2c992" })));
    sand.receiveShadow = true;
    R.add(sand);

    const cratM = new THREE.MeshBasicMaterial({ map: craterHD(), transparent: true, depthWrite: false });
    for (const [x, z, n] of [[-44, 2, 3.2], [-37, -2.5, 2.6], [-31, 5, 2.2], [-26, -4, 1.8]] as const) {
      const cm = new THREE.Mesh(new THREE.PlaneGeometry(4.4 * n, 4.4 * n), cratM);
      cm.rotation.x = -Math.PI / 2; cm.rotation.z = (x * 13) % 6;
      cm.position.set(x, 0.03, z); cm.renderOrder = 0.4; cm.layers.set(NOINK);
      R.add(cm);
    }

    // ---- the plank runway (live) ----
    // layout per slab: 8 verts = top quad (4) + south skirt (4); rebuilt y-only each frame
    this.runwayGeo = new THREE.BufferGeometry();
    this.runwayGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(RUNS_N * 8 * 3), 3));
    const runIdx: number[] = [];
    const uvs: number[] = [];
    const nrms: number[] = [];
    for (let j = 0; j < RUNS_N; j++) {
      const u0 = ((j * RUNS.step) % 16) / 16, u1 = u0 + RUNS.step / 16;
      // top quad + skirt: 8 uv corners (per-vertex), v = 1 row on the top, 0.05 on the skirt face
      uvs.push(u0, 1, u1, 1, u1, 1, u0, 1);       // top quad corners (a, b, c, d)
      uvs.push(u0, 0.05, u1, 0.05, u1, 0, u0, 0); // skirt corners (bottom..top orientation visually)
      nrms.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
      const A = j * 8;
      runIdx.push(A, A + 1, A + 2, A, A + 2, A + 3);       // top quad
      runIdx.push(A + 4, A + 5, A + 6, A + 4, A + 6, A + 7); // skirt
    }
    this.runwayGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    this.runwayGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nrms, 3));
    this.runwayGeo.setIndex(runIdx);
    const runTex = runwayHD(); runTex.wrapS = runTex.wrapT = THREE.RepeatWrapping; runTex.anisotropy = 16; runTex.needsUpdate = true;
    this.runway = new THREE.Mesh(this.runwayGeo, lam("runwayTex", () => ({ map: runTex })));
    this.runway.receiveShadow = true; this.runway.castShadow = true; this.runway.frustumCulled = false;
    R.add(this.runway);
    for (const s of [-1, 1]) {
      const em = new THREE.Mesh(new THREE.BoxGeometry(RUNS.x1 - RUNS.x0 + 1.2, 0.24, RUNS.wall), M.runEdge);
      em.position.set((RUNS.x0 + RUNS.x1) / 2, 0.1, s * (RUNS.z1 + RUNS.wall / 2 + 0.05));
      em.castShadow = true; em.receiveShadow = true;
      this.edges.push(em); R.add(em);
    }

    // ---- hangars + parked fighters + popped props ----
    for (const cx of [-18, 0, 18]) this.hangars.push(makeHangar(cx, -30.5));
    for (const h of this.hangars) R.add(h);
    const parkedAt: [number, number, number][] = [[-24, 14.2, -0.12], [-12, 14.8, 0.1], [0, 14.2, -0.05], [12, 14.6, 0.14], [24, 14.2, -0.1]];
    for (const [x, z, yaw] of parkedAt) {
      const g = plain(makePlane("liveryLW", true), x, 0, z, yaw, false);
      this.parked.push(g); R.add(g);
    }
    this.trucks.push(plain(makeTruck(), -30, 0, 18.6, 0.2, false), plain(makeTruck(), -21, 0, 18.2, -0.1, false));
    for (const tr of this.trucks) R.add(tr);
    this.gun = plain(makeGun(), 41.5, 0, 15.5, -0.5, false); R.add(this.gun);
    this.barrels = plain(makeBarrels(), -6.5, 0, 17.4, 0, false); R.add(this.barrels);
    this.tower = plain(makeTower(), -40, 0, 21.5, 0.5, false); R.add(this.tower);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.6, 1.9), lam("trench", () => ({ color: "#7b6a52" })));
    lip.position.set(-7.5, 0.22, -15.8); lip.castShadow = true; lip.receiveShadow = true;
    const pit = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.6, 1.2), lam("trenchIn", () => ({ color: "#42372a" })));
    pit.position.set(-7.5, 0.2, -15.6);
    this.trench.add(lip, pit);
    this.trench.visible = false;
    this.trenchPlanks = plain(makeTrenchPlanks(), -7.5, 0.02, -15.4, 0.06, false);
    R.add(this.trench, this.trenchPlanks);

    // ---- the rail + the live rail plane ----
    const railMesh = plain(makeRail(), (RAIL_X0 + RAIL_X1) / 2 - 1.4, 0, RAIL_Z, 0, true);
    R.add(railMesh);
    this.railPlane = plain(makePlane("liveryLW", true), RAIL_X0, 0, RAIL_Z, Math.PI, false);
    R.add(this.railPlane);

    // ---- the RAF plane + the bomb + splinters ----
    this.rafPlane = plain(makePlane("liveryRAF", true), 0, 0, 0, 0, false);
    this.rafPlane.scale.setScalar(0.9);
    R.add(this.rafPlane);
    this.bomb = plain(makeBomb(), 0, 0, 0, 0, false);
    this.bomb.scale.setScalar(1.15);
    R.add(this.bomb);
    this.splints = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.05, 0.1), lam("splint", () => ({ color: "#b98d55" })), 12);
    this.splints.castShadow = true; this.splints.frustumCulled = false; this.splints.visible = false;
    R.add(this.splints);

    // ---- crater smoke ----
    const smk = smokeTex();
    for (const [top, n] of [[[-44, 0.4, 2], 6], [[-37, 0.4, -2.5], 5], [[-31, 0.4, 5], 4]] as const)
      for (let k = 0; k < n; k++) {
        const mat = new THREE.MeshLambertMaterial({ map: smk, transparent: true, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        m.layers.set(NOINK);
        this.smoke.push({ m, mat, top: top as unknown as V3, k: k / n }); R.add(m);
      }

    // ---- the night decoy site ----
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 1.1), fog: false });
    const lampGlow = haloTex();
    for (const [x, z] of [[-96, 62], [-88, 70], [-94, 80], [-86, 88]] as const) {
      const gg = new THREE.Group();
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.2, 8), M.dark);
      mast.position.y = 1.1; mast.castShadow = true;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), lampMat);
      bulb.position.y = 2.25;
      gg.add(mast, bulb);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: lampGlow, color: new THREE.Color(2.2, 1.6, 0.9), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      glow.position.set(x, 2.4, z); glow.renderOrder = 5; glow.layers.set(NOINK);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ map: glowTex("255,196,120", 0.5), transparent: true, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.04, z); pool.renderOrder = 0.3; pool.layers.set(NOINK);
      gg.position.set(x, 0, z);
      this.lamps.push(gg); this.lampGlows.push(glow);
      R.add(gg, glow, pool);
    }
    for (const [x, z, yaw] of [[-102, 66, 0.3], [-100, 76, -0.15], [-103, 84, 0.1]] as const) {
      const d = plain(makePlane("liveryRAF", false), x, 0, z, yaw, false);
      d.scale.setScalar(0.92);
      this.decoys.push(d); R.add(d);
    }
    this.bomber = plain(makePlane("liveryLW", true), -96, 46, 78, Math.PI - 0.8, false);
    R.add(this.bomber);
    this.bomberDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(0.7, 0.58, 0.46), fog: false, depthWrite: false, transparent: true, opacity: 0.55 }));
    this.bomberDot.scale.setScalar(1.6); this.bomberDot.layers.set(NOINK);
    R.add(this.bomberDot);

    // ---- the two poster cards ----
    const yawCard = Math.atan2(-10, -8) + 0.02;
    this.posterA = new THREE.Mesh(new THREE.PlaneGeometry(12.15, 20.85), mkCard("posterA", { w: 1210, h: 2010, paint: cockpitPoster }));
    this.posterA.position.set(-148, 6.4, 60); this.posterA.rotation.y = yawCard;
    this.posterA.layers.set(NOINK);
    R.add(this.posterA);
    this.posterB = new THREE.Mesh(new THREE.PlaneGeometry(12.15, 20.85), mkCard("posterB", { w: 1210, h: 2010, paint: coatPoster }));
    this.posterB.position.set(-148.2, 6.3, 126); this.posterB.rotation.y = yawCard;
    this.posterB.layers.set(NOINK);
    R.add(this.posterB);

    // near framing objects built once, never sight-line filtered, toggled per frame
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const ss = s as ShotDef & { sunAz?: number; sunEl?: number };
    const az = THREE.MathUtils.degToRad(ss.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(ss.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], b = build(t), hook = s.id === 1, L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    this.camInfo.pos.copy(cam.position);
    this.camInfo.right.setFromMatrixColumn(cam.matrixWorld, 0);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const earr = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(earr[1], earr[2], earr[3], earr[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    this.WU.wTime.value = t;
    // ---- the set, posed ----
    this.poseRunway(t, b, hook);
    this.poseHangars(t, b, hook);
    this.poseProps(t, hook);
    this.poseRailPlane(t, hook);
    this.poseBomb(t, hook);
    this.poseNightShot(s.id, t);
    this.poseFg(f);
    // ---- smoke ----
    for (const sm of this.smoke) {
      const u = ((t * 0.05 + sm.k) % 1 + 1) % 1, sz = (3 + u * 9) * 0.85;
      sm.m.position.set(sm.top[0] - u * 11, sm.top[1] + u * 12 + u * u * 4, sm.top[2] + u * 2.4);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.8 * (1 - u) ** 1.2;
    }
    // ---- poster cards drift mildly ----
    this.posterA.position.y = 6.55 + 0.01 * Math.sin(t * 1.1);
    this.posterB.position.y = 6.55 + 0.012 * Math.sin(t * 1.4 + 1.7);
    // ---- cast + effects ----
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const st = stage(id, t, this.camInfo, b);
    const used: Actor[] = [];
    let ai = 0;
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.vv.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(s.light === "golden" ? "#ffcf9e" : "#ffffff");
      a.mesh.castShadow = s.light === "golden";
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const pp of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.vv.set(pp.x, pp.y, pp.z), Math.max(pp.w, pp.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(pp.key, pp.cw, pp.ch, 1, pp.draw);
      e2.use(!!pp.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(pp.x, pp.y, pp.z);
      if (pp.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, pp.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(pp.rot ?? 0); }
      e2.mesh.scale.set(pp.w, pp.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e2 of fused) e2.bind();
    return focus;
  }

  // ---------------- pose helpers ----------------
  private poseRunway(t: number, b: { runway: number }, hook: boolean) {
    const on = hook ? 1 : b.runway;
    const pos = this.runwayGeo.attributes.position.array as Float32Array;
    for (let j = 0; j < RUNS_N; j++) {
      const x0 = RUNS.x0 + j * RUNS.step, x1 = Math.min(RUNS.x1, x0 + RUNS.step);
      const k = hook ? 1 : plankShape(t, x0);
      const y = -0.3 + 0.336 * k, ysk = y - 0.05 * Math.max(0.05, k);
      const o = j * 8 * 3;
      pos[o] = x0; pos[o + 1] = y; pos[o + 2] = RUNS.z1;
      pos[o + 3] = x1; pos[o + 4] = y; pos[o + 5] = RUNS.z1;
      pos[o + 6] = x1; pos[o + 7] = y; pos[o + 8] = RUNS.z0;
      pos[o + 9] = x0; pos[o + 10] = y; pos[o + 11] = RUNS.z0;
      pos[o + 12] = x0; pos[o + 13] = ysk; pos[o + 14] = RUNS.z0 - 0.004;
      pos[o + 15] = x1; pos[o + 16] = ysk; pos[o + 17] = RUNS.z0 - 0.004;
      pos[o + 18] = x1; pos[o + 19] = ysk; pos[o + 20] = RUNS.z0;
      pos[o + 21] = x0; pos[o + 22] = ysk; pos[o + 23] = RUNS.z0;
      if (k <= 0.001) for (let q2 = 0; q2 < 24; q2 += 3) { pos[o + q2] = x0; pos[o + q2 + 1] = -0.4; pos[o + q2 + 2] = RUNS.z0; }
    }
    this.runwayGeo.attributes.position.needsUpdate = true;
    this.runwayGeo.computeBoundingSphere();
    const edgeOn = hook ? 1 : plankShape(t, RUNS.x0 + 2);
    this.edges.forEach((em) => { em.visible = edgeOn > 0.01; });
  }
  private poseHangars(t: number, b: { shells: number }, hook: boolean) {
    for (const h of this.hangars) {
      const k = hook ? 1 : b.shells;
      h.visible = k > 0.012;
      h.scale.y = Math.max(0.012, k);
    }
  }
  private poseProps(t: number, hook: boolean) {
    const ap = (i: number, t0: number) => popScale(t, hook ? -9 : t0 + i * 0.55);
    this.trucks.forEach((tr, i) => { tr.visible = ap(i, 16.3) > 0.012; });
    this.gun.visible = ap(0, 17.32) > 0.012;
    this.barrels.visible = ap(1, 17.32) > 0.012;
    this.tower.visible = popScale(t, hook ? -9 : 15.55) > 0.012;
    this.trench.visible = ap(0, 18.2) > 0.012;
    this.trenchPlanks.visible = ap(0, 18.75) > 0.05;
    this.parked.forEach((p, i) => { p.visible = ap(i + 2, 18.2) > 0.012; });
  }
  private poseRailPlane(t: number, hook: boolean) {
    const live = hook || t >= 20.2;
    this.railPlane.visible = live;
    if (!live) return;
    const x = hook ? RAIL_X0 + 9 : railX(t);
    this.railPlane.position.x = x; this.railPlane.position.z = RAIL_Z;
    this.railPlane.position.y = 0.03 + 0.014 * Math.sin(t * 13);
    const v = railX(t + 0.05) - railX(t - 0.05);
    const still = Math.abs(v) < 0.004;
    this.railPlane.rotation.y = (v < -0.004 ? Math.PI : 0) + (still ? 0.32 * Math.sin(t * 0.9) : 0);
    this.railPlane.rotation.z = hook ? 0.02 * Math.sin(t * 7) : railRoll(t);
  }
  private poseBomb(t: number, hook: boolean) {
    const q = bombState(t);
    this.rafPlane.visible = !hook && t >= 34.55 && t < 46.5;
    if (this.rafPlane.visible) {
      const p = planeAt(t);
      this.rafPlane.position.set(p.x, p.y, p.z);
      this.rafPlane.rotation.set(p.bank * 0.4, p.yaw, -p.bank);
    }
    this.bomb.visible = !hook && q.phase !== "held";
    if (this.bomb.visible) {
      this.bomb.position.set(q.x, q.y, q.z);
      // rest yaw turns the stencil band's centre to the lens: the officer read (shot 10, yaw 1.08) and the final
      // push-in (shot 14, yaw 0.55) both sit east of north, so 0.80 rad splits them (text band ~25 deg wide reads in both)
      this.bomb.rotation.set(q.roll, q.phase === "rest" ? 3.94 : 0, q.pitch);
    }
    const sa = splinterAge(t);
    this.splints.visible = sa > 0.006 && sa < 1;
    if (this.splints.visible) {
      const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), one = V(1, 1, 1), pos = V(0, 0, 0), up = V(0, 1, 0);
      for (let k = 0; k < 12; k++) {
        const ang = (k * 2.31) % 6.283 - 0.3, sp2 = 1.9 + (k % 5) * 0.4, rise = 2.2 + (k % 3) * 0.6;
        const tt = sa * 0.62 * (0.7 + (k % 4) * 0.14);
        pos.set(-0.8 + Math.cos(ang) * sp2 * tt, Math.max(-0.2, 0.7 + rise * tt - 4.9 * tt * tt), 1.4 + Math.sin(ang) * sp2 * tt);
        qq.setFromAxisAngle(up, ang + tt * 5);
        mm.compose(pos, qq, one);
        this.splints.setMatrixAt(k, mm);
      }
      this.splints.instanceMatrix.needsUpdate = true;
    }
  }
  private poseNightShot(id: number, t: number) {
    const night = id === 13;
    for (const l of this.lamps) l.visible = night;
    for (const g of this.lampGlows) {
      g.visible = night;
      if (night) g.lookAt(this.camInfo.pos.x, g.position.y, this.camInfo.pos.z);
    }
    for (const d of this.decoys) d.visible = night;
    this.bomber.visible = this.bomberDot.visible = night;
    if (night) {
      this.bomber.position.set(-96 + 2.4 * (t - 55.2), 46, 78 + 1.8 * (t - 55.2));
      this.bomber.rotation.y = Math.PI - 0.8 + 0.04 * Math.sin(t * 1.3);
      this.bomber.rotation.z = 0.06;
      this.bomberDot.position.set(this.bomber.position.x - 2, this.bomber.position.y + 1.4, this.bomber.position.z - 2);
    }
  }
  private poseFg(f: number) {
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b;
  }
}

const SEA_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint, wShade;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const SEA_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.35 * wTime, 0.0);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;

/** Batch helper: merge another batch's contents into ours at build time */
declare module "./build" { interface Batch { addBatch(other: Batch): void; } }
