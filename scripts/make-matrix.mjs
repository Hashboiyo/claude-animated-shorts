/**
 * Splits [0, durationInFrames) into 8+ non-overlapping, gap-free ranges.
 * Output is a GitHub Actions matrix: {"include":[{index,start,end,frames}, ...]}
 */
import path from "node:path";
import { parseArgs, setGithubOutput, writeJson } from "./lib.mjs";

const args = parseArgs();
const duration = Number(args.duration);
const chunks = Number(args.chunks ?? 8);
const out = path.resolve(args.out ?? "out/matrix.json");

if (!Number.isInteger(duration) || duration <= 0) throw new Error(`--duration must be a positive integer, got ${args.duration}`);
if (!Number.isInteger(chunks) || chunks < 8) throw new Error(`--chunks must be an integer >= 8, got ${args.chunks}`);
if (chunks > 32) throw new Error(`--chunks must be <= 32, got ${args.chunks}`);
if (chunks > duration) throw new Error(`Cannot split ${duration} frames into ${chunks} non-empty chunks`);

const base = Math.floor(duration / chunks);
const remainder = duration % chunks;
const include = [];
let cursor = 0;
for (let i = 0; i < chunks; i++) {
  const frames = base + (i < remainder ? 1 : 0);
  const start = cursor;
  const end = start + frames - 1;
  include.push({ index: i, start, end, frames });
  cursor = end + 1;
}

if (cursor !== duration) throw new Error(`Internal error: coverage ended at ${cursor}, expected ${duration}`);

const matrix = { include };
writeJson(out, { durationInFrames: duration, chunkCount: chunks, matrix });
setGithubOutput({ matrix: JSON.stringify(matrix), chunk_count: chunks, matrix_json: out });

console.log(`Matrix: ${chunks} chunks over ${duration} frames`);
for (const c of include) {
  console.log(`  chunk ${String(c.index).padStart(2, "0")}: ${String(c.start).padStart(5, "0")}-${String(c.end).padStart(5, "0")} (${c.frames} frames)`);
}
console.log(`Wrote ${out}`);
