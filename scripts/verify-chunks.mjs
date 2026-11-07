/**
 * Verifies every downloaded chunk: checksum, frame range, ordering and
 * gap-free coverage of [0, durationInFrames). Writes the FFmpeg concat list.
 */
import fs from "node:fs";
import path from "node:path";
import { ensureDir, formatBytes, parseArgs, sha256File, writeJson } from "./lib.mjs";

const args = parseArgs();
const dir = path.resolve(args.dir ?? "artifacts");
const duration = Number(args.duration);
const expectedChunks = Number(args.chunks);
const outDir = path.resolve(args.out ?? "out/assembly");

if (!Number.isInteger(duration) || duration <= 0) throw new Error(`--duration must be a positive integer, got ${args.duration}`);
if (!Number.isInteger(expectedChunks) || expectedChunks < 8) throw new Error(`--chunks must be >= 8, got ${args.chunks}`);
if (!fs.existsSync(dir)) throw new Error(`Artifact directory not found: ${dir}`);

const walk = (root) => {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
};

const allFiles = walk(dir);
const mp4s = allFiles.filter((file) => /chunk-.*\.mp4$/i.test(path.basename(file)));
const jsonFiles = allFiles.filter((file) => /chunk-.*\.json$/i.test(path.basename(file)));

if (mp4s.length !== expectedChunks) {
  throw new Error(`Expected ${expectedChunks} chunk MP4s, found ${mp4s.length} in ${dir}`);
}
if (jsonFiles.length !== expectedChunks) {
  throw new Error(`Expected ${expectedChunks} chunk manifests, found ${jsonFiles.length} in ${dir}`);
}

const manifests = jsonFiles.map((file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const mp4 = path.join(path.dirname(file), data.file);
  if (!fs.existsSync(mp4)) throw new Error(`Chunk manifest points at a missing file: ${mp4}`);

  const actual = sha256File(mp4);
  if (actual !== data.sha256) {
    throw new Error(`Checksum mismatch for ${path.basename(mp4)}: manifest ${data.sha256}, actual ${actual}`);
  }
  const bytes = fs.statSync(mp4).size;
  if (bytes !== data.bytes) {
    throw new Error(`Size mismatch for ${path.basename(mp4)}: manifest ${data.bytes}, actual ${bytes}`);
  }
  return { ...data, path: mp4 };
});

manifests.sort((a, b) => a.start - b.start || a.index - b.index);

const seen = new Set();
let previousEnd = -1;
for (let i = 0; i < manifests.length; i++) {
  const chunk = manifests[i];
  if (chunk.index < 0 || chunk.index >= expectedChunks || seen.has(chunk.index)) {
    throw new Error(`Invalid or duplicate chunk index ${chunk.index}`);
  }
  seen.add(chunk.index);
  if (chunk.start !== chunk.end + 1 - chunk.frames) throw new Error(`Chunk ${chunk.index} has inconsistent frame count`);
  if (i === 0 && chunk.start !== 0) throw new Error(`First chunk starts at ${chunk.start}, expected 0`);
  if (i > 0 && chunk.start !== previousEnd + 1) {
    throw new Error(`Gap/overlap before chunk ${chunk.index}: previous ended at ${previousEnd}, this starts at ${chunk.start}`);
  }
  previousEnd = chunk.end;
}

if (previousEnd !== duration - 1) {
  throw new Error(`Coverage ends at frame ${previousEnd}, expected ${duration - 1}`);
}

ensureDir(outDir);
const concatPath = path.join(outDir, "concat.txt");
const lines = manifests.map((chunk) => `file '${chunk.path.replaceAll("'", "'\\''")}'`);
fs.writeFileSync(concatPath, `${lines.join("\n")}\n`);

const report = {
  durationInFrames: duration,
  chunkCount: manifests.length,
  totalFrames: manifests.reduce((sum, chunk) => sum + chunk.frames, 0),
  totalBytes: manifests.reduce((sum, chunk) => sum + chunk.bytes, 0),
  chunks: manifests.map((chunk) => ({
    index: chunk.index,
    start: chunk.start,
    end: chunk.end,
    frames: chunk.frames,
    file: chunk.file,
    bytes: chunk.bytes,
    sha256: chunk.sha256,
  })),
  concatList: concatPath,
};
writeJson(path.join(outDir, "chunk-verification.json"), report);

console.log(`Verified ${manifests.length} chunks, ${report.totalFrames} frames, ${formatBytes(report.totalBytes)}`);
console.log(`Coverage: 0-${duration - 1} with no gaps or overlaps`);
console.log(`Concat list: ${concatPath}`);
for (const chunk of manifests) {
  console.log(`  ${String(chunk.index).padStart(2, "0")}: ${chunk.start}-${chunk.end}  ${chunk.sha256.slice(0, 16)}...`);
}
