import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const parseArgs = (argv = process.argv.slice(2)) => {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      out[raw.slice(0, eq)] = raw.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[raw] = next;
        i++;
      } else {
        out[raw] = "true";
      }
    }
  }
  return out;
};

export const writeJson = (file, value) => {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
};

export const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

export const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  }
  return result;
};

export const runCapture = (command, args, options = {}) =>
  spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, ...options });

export const setGithubOutput = (pairs) => {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  const lines = Object.entries(pairs).map(([key, value]) => {
    const text = String(value);
    if (text.includes("\n")) {
      const marker = `EOF_${crypto.randomBytes(8).toString("hex")}`;
      return `${key}<<${marker}\n${text}\n${marker}`;
    }
    return `${key}=${text}`;
  });
  fs.appendFileSync(file, `${lines.join("\n")}\n`);
};

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return "unknown";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

/** Reads a PCM WAV header without external tools. */
export const readWavInfo = (file) => {
  if (!fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let fmt = null;
  let dataSize = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= buf.length) {
      fmt = {
        audioFormat: buf.readUInt16LE(body),
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        byteRate: buf.readUInt32LE(body + 8),
        bitsPerSample: buf.readUInt16LE(body + 14),
      };
    }
    if (id === "data") {
      dataSize = Math.min(size, buf.length - body);
      break;
    }
    offset = body + size + (size % 2);
  }

  if (!fmt || dataSize == null) return null;
  const blockAlign = Math.max(1, fmt.channels * (fmt.bitsPerSample / 8));
  return {
    ...fmt,
    dataSize,
    duration: dataSize / Math.max(1, fmt.sampleRate * blockAlign),
    size: buf.length,
  };
};

export const parseRate = (value) => {
  if (!value || !value.includes("/")) return Number(value) || 0;
  const [a, b] = value.split("/").map(Number);
  return b ? a / b : 0;
};

export const seconds = (frames, fps) => frames / fps;
