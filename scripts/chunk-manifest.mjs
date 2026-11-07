/**
 * Writes a chunk's frame range + SHA256 checksum next to the MP4 so the
 * assembly job can prove exactly what it is concatenating.
 */
import fs from "node:fs";
import path from "node:path";
import { ensureDir, formatBytes, parseArgs, sha256File, writeJson } from "./lib.mjs";

const args = parseArgs();
const file = path.resolve(args.file);
const index = Number(args.index);
const start = Number(args.start);
const end = Number(args.end);

if (!fs.existsSync(file)) throw new Error(`Chunk not found: ${file}`);
if (!Number.isInteger(index) || !Number.isInteger(start) || !Number.isInteger(end) || end < start) {
  throw new Error(`Invalid chunk metadata: index=${args.index} start=${args.start} end=${args.end}`);
}

const sha256 = sha256File(file);
const bytes = fs.statSync(file).size;
const out = path.resolve(args.out ?? `${file}.json`);

const manifest = {
  index,
  start,
  end,
  frames: end - start + 1,
  file: path.basename(file),
  bytes,
  humanSize: formatBytes(bytes),
  sha256,
};
writeJson(out, manifest);
ensureDir(path.dirname(out));
fs.writeFileSync(`${file}.sha256`, `${sha256}  ${path.basename(file)}\n`);

console.log(`${path.basename(file)}: frames ${start}-${end}, ${formatBytes(bytes)}, sha256 ${sha256}`);
