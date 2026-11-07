/**
 * Generates the demo music bed for "Lantern Cove".
 *
 * This is NOT the final production audio pipeline. Real shorts use the
 * templates/audio Python toolkit (voice + SFX + ducked score -> mix.wav).
 * This deterministic 48 kHz stereo bed exists so the cloud render pipeline
 * can be tested with real audio from the first run.
 */
import fs from "node:fs";
import path from "node:path";
import { ensureDir, formatBytes, readWavInfo } from "./lib.mjs";

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const DURATION = 8;
const OUT = path.resolve("public/audio/lantern-cove-music.wav");

const CHORDS = [
  { root: 130.81, notes: [261.63, 329.63, 392.0, 493.88] }, // Cmaj7
  { root: 110.0, notes: [220.0, 261.63, 329.63, 392.0] }, // Am7
  { root: 87.31, notes: [174.61, 220.0, 261.63, 329.63] }, // Fmaj7
  { root: 98.0, notes: [196.0, 246.94, 293.66, 392.0] }, // G
];

const smooth = (x) => {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
};

const totalSamples = SAMPLE_RATE * DURATION;
const data = Buffer.alloc(totalSamples * CHANNELS * 2);

for (let i = 0; i < totalSamples; i++) {
  const t = i / SAMPLE_RATE;
  const chordIndex = Math.floor(t / 2) % CHORDS.length;
  const chord = CHORDS[chordIndex];
  const local = t % 2;

  // pad envelope: each chord breathes in and out, so chord changes are silent
  const padEnv = smooth(local / 0.42) * smooth((2 - local) / 0.5);
  let padL = 0;
  let padR = 0;
  for (let n = 0; n < chord.notes.length; n++) {
    const f = chord.notes[n];
    const amp = 0.075 / (1 + n * 0.18);
    const detune = 1 + (n - 1.5) * 0.0017;
    padL += Math.sin(2 * Math.PI * f * detune * t) * amp;
    padR += Math.sin(2 * Math.PI * f * (2 - detune) * t + 0.35) * amp;
  }
  // sub bass
  const bass = Math.sin(2 * Math.PI * chord.root * t) * 0.11 * padEnv + Math.sin(2 * Math.PI * chord.root * 2 * t) * 0.035 * padEnv;

  // arpeggio: one plucked bell every 250 ms, ping-ponging across the stereo field
  const step = Math.floor(t / 0.25);
  const dt = t - step * 0.25;
  const note = chord.notes[(step + chordIndex) % chord.notes.length] * 2;
  const pluckEnv = Math.exp(-7.5 * dt) * 0.055;
  const pluck = (Math.sin(2 * Math.PI * note * t) + 0.35 * Math.sin(2 * Math.PI * note * 2.01 * t)) * pluckEnv;
  const pan = step % 2 === 0 ? -0.55 : 0.55;

  // high shimmer, slow tremolo
  const shimmerEnv = 0.008 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.17 * t));
  const shimmer = Math.sin(2 * Math.PI * chord.notes[2] * 4 * t) * shimmerEnv;

  const fade = Math.min(smooth(t / 0.4), smooth((DURATION - t) / 0.55));
  let left = (padL + bass + pluck + shimmer) * fade;
  let right = (padR + bass + pluck + shimmer) * fade;
  left += pluck * pan * 0.35;
  right -= pluck * pan * 0.35;

  // gentle glue + soft clip
  left = Math.tanh(left * 1.25) / Math.tanh(1.25);
  right = Math.tanh(right * 1.25) / Math.tanh(1.25);

  const offset = i * CHANNELS * 2;
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left)) * 32767), offset);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right)) * 32767), offset + 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0, "ascii");
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVE", 8, "ascii");
header.write("fmt ", 12, "ascii");
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(CHANNELS, 22);
header.writeUInt32LE(SAMPLE_RATE, 24);
header.writeUInt32LE(SAMPLE_RATE * CHANNELS * 2, 28);
header.writeUInt16LE(CHANNELS * 2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36, "ascii");
header.writeUInt32LE(data.length, 40);

ensureDir(path.dirname(OUT));
fs.writeFileSync(OUT, Buffer.concat([header, data]));

const info = readWavInfo(OUT);
console.log(`Wrote ${OUT}`);
console.log(`  ${info?.sampleRate} Hz, ${info?.channels} ch, ${info?.bitsPerSample}-bit, ${info?.duration.toFixed(2)} s`);
console.log(`  ${formatBytes(fs.statSync(OUT).size)}`);
