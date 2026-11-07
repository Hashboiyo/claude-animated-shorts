/**
 * Cloud/SSR still renderer + contact sheet builder.
 * Run by .github/workflows/stills.yml and by the validate job of
 * .github/workflows/render-video.yml. No local full-video rendering.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { ensureDir, formatBytes, parseArgs, setGithubOutput, writeJson } from "./lib.mjs";
import { makeContactSheet } from "./contact-sheet.mjs";

const args = parseArgs();
const entry = path.resolve(args.entry ?? "src/index.ts");
const comp = args.comp ?? args.composition ?? "LanternCove";
const scale = Number(args.scale ?? 0.5);
const outDir = path.resolve(args.out ?? "out/stills");
const contactPath = path.resolve(args.contact ?? path.join(outDir, "contact-sheet.png"));
const requestedGl = args.gl ?? process.env.REMOTION_GL ?? "angle";
const requireVariance = args["require-variance"] === "true";
const requestedFrames = String(args.frames ?? "auto");

if (!fs.existsSync(entry)) throw new Error(`Entry point not found: ${entry}`);
if (!(scale > 0)) throw new Error(`--scale must be positive, got ${args.scale}`);

console.log(`Bundling ${entry} ...`);
const serveUrl = await bundle({
  entryPoint: entry,
  onProgress: (progress) => {
    if (progress === 0 || progress === 100 || progress % 25 === 0) console.log(`  bundle ${progress}%`);
  },
});

const readComposition = async (openGl) =>
  selectComposition({
    serveUrl,
    id: comp,
    chromiumOptions: { gl: openGl },
  });

let activeGl = requestedGl;
let composition;
try {
  composition = await readComposition(activeGl);
} catch (error) {
  if (activeGl === "angle") {
    console.warn(`angle failed; retrying with swangle: ${error.message}`);
    activeGl = "swangle";
    composition = await readComposition(activeGl);
  } else {
    throw error;
  }
}

let frames;
if (requestedFrames === "auto") {
  const count = 12;
  const set = new Set();
  for (let i = 0; i < count; i++) set.add(Math.round((i * (composition.durationInFrames - 1)) / (count - 1)));
  frames = [...set];
} else {
  frames = requestedFrames
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v));
}
frames = [...new Set(frames)].filter((f) => f >= 0 && f < composition.durationInFrames).sort((a, b) => a - b);
if (!frames.length) throw new Error(`No valid frames requested (composition has ${composition.durationInFrames} frames)`);

ensureDir(outDir);

const renderOne = async (frame, openGl) => {
  const output = path.join(outDir, `still-${String(frame).padStart(4, "0")}.png`);
  await renderStill({
    composition,
    serveUrl,
    output,
    frame,
    scale,
    imageFormat: "png",
    chromiumOptions: { gl: openGl },
    timeoutInMilliseconds: 180_000,
    logLevel: "info",
  });
  if (!fs.existsSync(output) || fs.statSync(output).size === 0) throw new Error(`Still ${frame} was not written`);
  return output;
};

const images = [];
for (const frame of frames) {
  let file;
  try {
    file = await renderOne(frame, activeGl);
  } catch (error) {
    if (activeGl === "angle") {
      console.warn(`angle failed at frame ${frame}; retrying the rest with swangle: ${error.message}`);
      activeGl = "swangle";
      file = await renderOne(frame, activeGl);
    } else {
      throw error;
    }
  }

  const stats = await sharp(file).stats();
  const stdev = Math.max(...stats.channels.map((channel) => channel.stdev));
  const bytes = fs.statSync(file).size;
  if (requireVariance && stdev < 3) {
    throw new Error(`Frame ${frame} looks blank (stdev ${stdev.toFixed(2)}): ${file}`);
  }
  console.log(`  frame ${String(frame).padStart(4, "0")} -> ${path.basename(file)} (${formatBytes(bytes)}, stdev ${stdev.toFixed(2)})`);
  images.push({ path: file, label: `frame ${frame}  |  stdev ${stdev.toFixed(1)}` });
}

const sheet = await makeContactSheet({
  images,
  out: contactPath,
  columns: Math.min(4, images.length),
  cellWidth: 360,
  title: `${composition.id} — ${images.length} stills @ scale ${scale} (${activeGl})`,
});

const manifest = {
  compositionId: composition.id,
  durationInFrames: composition.durationInFrames,
  fps: composition.fps,
  width: composition.width,
  height: composition.height,
  scale,
  gl: activeGl,
  frames,
  images: images.map((image) => path.basename(image.path)),
  contactSheet: contactPath,
  contactSheetBytes: sheet.bytes,
};

writeJson(path.join(outDir, "stills-manifest.json"), manifest);
setGithubOutput({
  contact_sheet: contactPath,
  still_count: images.length,
  stills_dir: outDir,
  gl: activeGl,
});

console.log("");
console.log(`Contact sheet: ${contactPath} (${formatBytes(sheet.bytes)})`);
console.log(`Manifest     : ${path.join(outDir, "stills-manifest.json")}`);
