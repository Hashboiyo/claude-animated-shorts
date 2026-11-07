/**
 * Final technical + visual QA for the assembled MP4.
 * Checks frame count, duration, dimensions, fps, codec, audio, clean decode,
 * then extracts sample frames and a contact sheet for human review.
 */
import fs from "node:fs";
import path from "node:path";
import { ensureDir, formatBytes, parseArgs, parseRate, runCapture, writeJson } from "./lib.mjs";
import { makeContactSheet } from "./contact-sheet.mjs";

const args = parseArgs();
const file = path.resolve(args.file ?? "out/final.mp4");
const durationInFrames = Number(args.duration);
const fps = Number(args.fps);
const width = Number(args.width);
const height = Number(args.height);
const outDir = path.resolve(args.out ?? "out/qa");

if (!fs.existsSync(file)) throw new Error(`Final video not found: ${file}`);
if (!Number.isInteger(durationInFrames) || durationInFrames <= 0) throw new Error(`--duration must be a positive frame count`);
if (!(fps > 0) || !(width > 0) || !(height > 0)) throw new Error(`Invalid fps/width/height`);

ensureDir(outDir);
const expectedSeconds = durationInFrames / fps;
const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
};

const probeResult = runCapture("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
if (probeResult.status !== 0) throw new Error(`ffprobe failed: ${probeResult.stderr}`);
const probe = JSON.parse(probeResult.stdout);

const video = probe.streams?.find((stream) => stream.codec_type === "video");
const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
check("video stream exists", Boolean(video), video ? `${video.codec_name} ${video.width}x${video.height}` : "missing");
check("audio stream exists", Boolean(audio), audio ? `${audio.codec_name} ${audio.sample_rate} Hz / ${audio.channels} ch` : "missing");

if (video) {
  check("video codec", video.codec_name === "h264", `expected h264, got ${video.codec_name}`);
  check("dimensions", Number(video.width) === width && Number(video.height) === height, `expected ${width}x${height}, got ${video.width}x${video.height}`);
  const actualFps = parseRate(video.avg_frame_rate);
  check("frame rate", Math.abs(actualFps - fps) < 0.01, `expected ${fps}, got ${actualFps.toFixed(3)}`);
}

if (audio) {
  check("audio codec", audio.codec_name === "aac", `expected aac, got ${audio.codec_name}`);
  check("audio sample rate", Number(audio.sample_rate) === 48000, `expected 48000, got ${audio.sample_rate}`);
  check("audio channels", Number(audio.channels) === 2, `expected 2, got ${audio.channels}`);
}

const formatDuration = Number(probe.format?.duration ?? 0);
check(
  "duration",
  Math.abs(formatDuration - expectedSeconds) <= 0.08,
  `expected ${expectedSeconds.toFixed(3)} s, got ${formatDuration.toFixed(3)} s`,
);

const countResult = runCapture("ffprobe", [
  "-v",
  "error",
  "-count_frames",
  "-select_streams",
  "v:0",
  "-show_entries",
  "stream=nb_read_frames",
  "-of",
  "default=nokey=1:noprint_wrappers=1",
  file,
]);
const countedFrames = Number.parseInt(countResult.stdout.trim(), 10);
check(
  "frame count",
  Number.isFinite(countedFrames) && countedFrames === durationInFrames,
  `expected ${durationInFrames}, got ${Number.isFinite(countedFrames) ? countedFrames : countResult.stdout.trim()}`,
);

const decodeResult = runCapture("ffmpeg", ["-v", "error", "-i", file, "-f", "null", "-"]);
const decodeErrors = `${decodeResult.stderr ?? ""}`.trim();
check("clean full decode", decodeResult.status === 0 && decodeErrors === "", decodeErrors || "zero decode errors");

// Sample frames for visual QA / contact sheet.
const sampleDir = path.join(outDir, "samples");
ensureDir(sampleDir);
const sampleTimes = [0, 0.25, 0.5, 0.75, 0.995].map((p) => Math.min(Math.max(0, expectedSeconds - 0.04), p * expectedSeconds));
const images = [];
for (let i = 0; i < sampleTimes.length; i++) {
  const output = path.join(sampleDir, `sample-${i}.jpg`);
  const result = runCapture("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-ss",
    sampleTimes[i].toFixed(3),
    "-i",
    file,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    output,
  ]);
  if (result.status !== 0 || !fs.existsSync(output)) throw new Error(`Could not extract sample at ${sampleTimes[i]}s: ${result.stderr}`);
  images.push({ path: output, label: `${sampleTimes[i].toFixed(2)} s` });
}

const sheet = await makeContactSheet({
  images,
  out: path.join(outDir, "qa-contact-sheet.png"),
  columns: images.length,
  cellWidth: 300,
  title: `Final QA — ${path.basename(file)} — ${formatDuration.toFixed(2)} s`,
});

const bytes = fs.statSync(file).size;
const report = {
  file,
  bytes,
  humanSize: formatBytes(bytes),
  expected: { durationInFrames, fps, width, height, durationSeconds: Number(expectedSeconds.toFixed(3)) },
  actual: {
    durationSeconds: formatDuration,
    videoFrames: countedFrames,
    videoCodec: video?.codec_name ?? null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: video ? parseRate(video.avg_frame_rate) : null,
    audioCodec: audio?.codec_name ?? null,
    audioSampleRate: audio?.sample_rate ?? null,
    audioChannels: audio?.channels ?? null,
  },
  checks,
  contactSheet: sheet.out,
  samples: images.map((image) => image.path),
  passed: checks.every((item) => item.pass),
};
writeJson(path.join(outDir, "qa-report.json"), report);

const lines = [
  `# Final QA — ${path.basename(file)}`,
  "",
  `- File: \`${file}\``,
  `- Size: ${report.humanSize} (${bytes} bytes)`,
  `- Expected: ${durationInFrames} frames, ${expectedSeconds.toFixed(3)} s @ ${fps} fps, ${width}x${height}`,
  `- Actual: ${countedFrames} frames, ${formatDuration.toFixed(3)} s, ${video?.width}x${video?.height}`,
  `- Video: ${video?.codec_name}`,
  `- Audio: ${audio?.codec_name} ${audio?.sample_rate} Hz, ${audio?.channels} ch`,
  `- Result: **${report.passed ? "PASS" : "FAIL"}**`,
  "",
  "## Checks",
  "",
  ...checks.map((item) => `- [${item.pass ? "x" : " "}] ${item.name}: ${item.detail}`),
  "",
  `Contact sheet: \`${sheet.out}\``,
  "",
];
fs.writeFileSync(path.join(outDir, "qa-report.md"), lines.join("\n"));

console.log("");
console.log(`QA ${report.passed ? "PASSED" : "FAILED"}; report: ${path.join(outDir, "qa-report.md")}`);
if (!report.passed) {
  const failed = checks.filter((item) => !item.pass).map((item) => item.name).join(", ");
  throw new Error(`QA failed: ${failed}`);
}
