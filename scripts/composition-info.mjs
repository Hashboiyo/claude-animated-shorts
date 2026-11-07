/**
 * Bundles the Remotion project and validates one composition's metadata
 * before any matrix runner is started. Also validates the master audio.
 */
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { selectComposition } from "@remotion/renderer";
import { ensureDir, formatBytes, parseArgs, readWavInfo, setGithubOutput, writeJson } from "./lib.mjs";

const args = parseArgs();
const entry = path.resolve(args.entry ?? "src/index.ts");
const comp = args.comp ?? args.composition ?? "LanternCove";
const audio = path.resolve(args.audio ?? "public/audio/lantern-cove-music.wav");
const gl = args.gl ?? process.env.REMOTION_GL ?? "angle";
const jsonOut = path.resolve(args["json-out"] ?? "out/composition.json");

if (!fs.existsSync(entry)) throw new Error(`Entry point not found: ${entry}`);
if (!fs.existsSync(audio)) throw new Error(`Master audio not found: ${audio}`);

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

let usedGl = gl;
let composition;
try {
  composition = await readComposition(gl);
} catch (error) {
  if (gl === "angle") {
    console.warn(`angle failed while reading composition; retrying with swangle: ${error.message}`);
    usedGl = "swangle";
    composition = await readComposition("swangle");
  } else {
    throw error;
  }
}

const fps = composition.fps;
const frames = composition.durationInFrames;
const seconds = frames / fps;
const audioInfo = readWavInfo(audio);

if (!audioInfo) throw new Error(`Master audio is not a readable PCM WAV: ${audio}`);
if (audioInfo.sampleRate !== 48000) throw new Error(`Master audio must be 48 kHz, got ${audioInfo.sampleRate} Hz`);
if (audioInfo.channels !== 2) throw new Error(`Master audio must be stereo, got ${audioInfo.channels} channel(s)`);
if (audioInfo.duration + 0.05 < seconds) {
  throw new Error(`Master audio is ${audioInfo.duration.toFixed(2)} s but the composition is ${seconds.toFixed(2)} s`);
}

const report = {
  entry,
  compositionId: composition.id,
  durationInFrames: frames,
  fps,
  durationSeconds: Number(seconds.toFixed(3)),
  width: composition.width,
  height: composition.height,
  gl: usedGl,
  audio: {
    path: audio,
    bytes: audioInfo.size,
    humanSize: formatBytes(audioInfo.size),
    sampleRate: audioInfo.sampleRate,
    channels: audioInfo.channels,
    bitsPerSample: audioInfo.bitsPerSample,
    durationSeconds: Number(audioInfo.duration.toFixed(3)),
  },
};

ensureDir(path.dirname(jsonOut));
writeJson(jsonOut, report);

setGithubOutput({
  composition_id: composition.id,
  duration_frames: frames,
  duration_seconds: report.durationSeconds,
  fps,
  width: composition.width,
  height: composition.height,
  audio_file: audio,
  composition_json: jsonOut,
});

console.log("");
console.log(`Composition : ${composition.id}`);
console.log(`Frames      : ${frames} (${seconds.toFixed(2)} s @ ${fps} fps)`);
console.log(`Size        : ${composition.width}x${composition.height}`);
console.log(`Audio       : ${audio} (${formatBytes(audioInfo.size)})`);
console.log(`Report      : ${jsonOut}`);
