// Light presets per time of day. The sun is CAMERA-RELATIVE and frozen per shot (world.ts update()):
// az = degrees from the shot camera's forward axis (0 = sun straight ahead = backlight, +90 = screen right,
// 180 = behind camera), el = elevation. lit/shade/lift are LINEAR RGB multipliers for shade.ts (may exceed 1).
// Field names follow lighting.md 9.1 exactly (the CHAR and POST agents read them); values are tuned on renders.
type C3 = [number, number, number];
export type LightPreset = {
  az: number; el: number;
  lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number;      // world two-tone (shade.ts)
  charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; // character cards (cast.ts)
  blob: C3; actorShadow: boolean;                                                    // contact blobs / card shadows
  top: string; hor: string; skyCurve: C3; fog: string; fogNear: number; fogFar: number; sunDisc: string; // depth.md 6.5
  sunCol: string; sunI: number; sky: string; ground: string; hemiI: number;         // three lights (unpatched mats only)
  bias: number; normalBias: number;
};
export const LIGHTS: Record<"day" | "golden", LightPreset> = {
  day: {
    az: 75, el: 48,
    lit: [1.58, 1.5, 1.33], shade: [0.3, 0.29, 0.36], lift: [0.05, 0.06, 0.11], lambert: 0.35, sideK: 0.84, term: 0.2,
    charTint: [1.0, 0.94, 0.92], charShade: 0.86, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.92, 0.90, 0.96],
    blob: [0.62, 0.58, 0.58], actorShadow: false,
    top: "#3e7fd2", hor: "#b8d0ec", skyCurve: [0.0, 0.5, 0.6], fog: "#b8d0ec", fogNear: 25, fogFar: 300, sunDisc: "#000000",
    sunCol: "#fff3e0", sunI: 2.8, sky: "#dcecff", ground: "#b49a78", hemiI: 0.55,
    bias: -0.00025, normalBias: 0.015,
  },
  golden: {
    az: 6, el: 7,
    lit: [1.5, 1.25, 0.97], shade: [0.27, 0.26, 0.46], lift: [0.04, 0.06, 0.14], lambert: 0.35, sideK: 0.82, term: 0.14,
    charTint: [1.0, 0.92, 0.84], charShade: 0.88, charGrad: 0.1, bodyGrad: 0.25, sideTint: [0.88, 0.86, 0.98],
    blob: [0.75, 0.74, 0.9], actorShadow: true,
    top: "#6a4f8c", hor: "#ffd08a", skyCurve: [0.05, 0.6, 1.0], fog: "#efb489", fogNear: 50, fogFar: 380, sunDisc: "#ffcf9e",
    sunCol: "#ffd0a0", sunI: 3.2, sky: "#d8b0c8", ground: "#8a6a80", hemiI: 0.5,
    bias: -0.0006, normalBias: 0.03,
  },
};

/** Revision four: art-directed lighting by environment, not one global noon rig.
 * The warm/cool separation lives in the material illumination, not an orange overlay. */
export const CINEMATIC_LIGHTS: Record<'coast'|'pavilion'|'storm'|'golden',LightPreset> = {
  coast: {
    ...LIGHTS.day,
    az: 130, el: 35,
    lit: [1.55, 1.41, 1.20], shade: [0.24, 0.31, 0.41], lift: [0.018, 0.023, 0.037],
    lambert: .5, sideK: .88, term: .65,
    charTint: [1.0, .97, .92], charShade: .82, charGrad: .11, bodyGrad: .23, sideTint: [.82,.87,1.05],
    top:'#2f76b3', hor:'#c5dadb', fog:'#b6cad0', fogNear:55, fogFar:310,
    sunCol:'#ffe2b1', sunI:3.15, sky:'#c3e2ee', ground:'#9e8c85', hemiI:.7,
    bias:-.00018, normalBias:.018,
  },
  pavilion: {
    ...LIGHTS.day,
    az: 128, el: 27,
    lit: [1.38, 1.15, .86], shade: [.16,.23,.34], lift:[.016,.023,.046],
    lambert:.52, sideK:.85, term:.65,
    charTint:[1.0,.95,.88], charShade:.82, charGrad:.115, bodyGrad:.25, sideTint:[.80,.85,1.08],
    top:'#3c7caa', hor:'#d5d7c9', fog:'#b9ced3', fogNear:48, fogFar:295,
    sunCol:'#ffd7a3', sunI:2.35, sky:'#b5d6e1', ground:'#81727f', hemiI:.62,
    bias:-.00018, normalBias:.018,
  },
  storm: {
    ...LIGHTS.day,
    az: 64, el: 24,
    lit:[1.04,1.18,1.39], shade:[.14,.20,.30], lift:[.014,.024,.042],
    lambert:.53, sideK:.85, term:.65,
    charTint:[.87,.95,1.05], charShade:.78, charGrad:.10, bodyGrad:.24, sideTint:[.78,.86,1.08],
    top:'#233e59', hor:'#91adb7', fog:'#819da9', fogNear:35, fogFar:240,
    sunCol:'#c1e4fb', sunI:2.0, sky:'#9abccc', ground:'#596980', hemiI:.65,
    bias:-.00018, normalBias:.022,
  },
  golden: {
    ...LIGHTS.golden,
    az: 26, el: 14,
    lit:[1.70,1.19,.69], shade:[.19,.23,.41], lift:[.022,.028,.06],
    lambert:.47, sideK:.86, term:.65,
    charTint:[1.0,.93,.85], charShade:.79, charGrad:.115, bodyGrad:.24, sideTint:[.82,.83,1.08],
    top:'#785687', hor:'#ffcf94', fog:'#d4afb1', fogNear:70, fogFar:330,
    sunCol:'#ffc785', sunI:4.1, sky:'#c1badb', ground:'#786c94', hemiI:.62,
    bias:-.00022, normalBias:.025,
  },
};

/** world-only look per light (sky stops by elevation in degrees, river colours, cloud palette). All colours are
 *  ON-SCREEN targets under the current PBR-Neutral tone map; world.ts pre-inverts the tone map (shade.ts untone). */
export type WorldLook = {
  sky: { c: string[]; e: number[] };                         // 5 stops: c[i] at elevation e[i] (deg), smoothstep between
  water: { near: string; mid: string; far: string; crest: string; trough: string; glint: string; shade: C3 };
  bounce: C3;                                                 // shade.ts uBounce: albedo x bounce on shaded faces turned to the lens
  sat: number;                                                // shade.ts uSat: world albedo saturation (1 = as painted)
  cloud: { lit: string; mid: string; shade: string };
};
export const LOOK: Record<"day" | "golden", WorldLook> = {
  day: {
    // depth.md 2.2: horizon #9fb6e6 just above the skyline, upper sky #5e93d9 at ~20 deg (grade: frame top #5997e2)
    sky: { c: ["#b8d0ec", "#9cbfea", "#6a9fe0", "#4f8cdb", "#3373cc"], e: [0, 3, 8, 16, 40] },
    water: { near: "#22a7b6", mid: "#167fb2", far: "#1a5596", crest: "#7ddfe8", trough: "#0e4a80", glint: "#ffffff", shade: [0.5, 0.56, 0.72] },
    cloud: { lit: "#fbf8f1", mid: "#e1e5f3", shade: "#c3cbe9" },
    bounce: [0.025, 0.019, 0.012],
    sat: 1.02,
  },
  golden: {
    // sunset, not dusk: #ffd08a horizon, peach/orange through ~10 deg, warm rose at 20, muted warm mauve only near the top
    // (the golden grade adds ~+11/255 blue to shadows/mids, so these lean warm)
    sky: { c: ["#ffc47c", "#f7ae78", "#e8967c", "#c4848e", "#8a6f8a"], e: [0, 4, 10, 20, 40] },
    water: { near: "#1e3a6e", mid: "#355f96", far: "#d4a48e", crest: "#d9a088", trough: "#16294f", glint: "#ffe2b0", shade: [0.42, 0.46, 0.72] },
    cloud: { lit: "#ffd2a8", mid: "#f2a08f", shade: "#a98fc4" },
    bounce: [0.055, 0.033, 0.016],
    sat: 1.02,
  },
};
