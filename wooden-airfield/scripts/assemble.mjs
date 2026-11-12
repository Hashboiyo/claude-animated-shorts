import {readFileSync, writeFileSync, existsSync, mkdirSync} from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const {totalFrames, fps} = JSON.parse(readFileSync("src/timing.json", "utf8"));
mkdirSync("out", {recursive: true});
const files = Array.from({length: 8}, (_, i) => `out/chunk-${String(i).padStart(2, "0")}.mp4`);
for (const file of files) {
  if (!existsSync(file)) throw new Error(`Missing render chunk: ${file}`);
}
writeFileSync("out/concat.txt", files.map(f => `file '${path.basename(f)}'`).join("\n") + "\n");
// Video-only chunks avoid AAC priming gaps at the joins. Add the original
// continuous narration once, after concatenating the rendered video.
execFileSync("ffmpeg", ["-hide_banner", "-y", "-f", "concat", "-safe", "0",
  "-i", "out/concat.txt", "-i", "public/audio/narration.mp3",
  "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
  "-b:a", "192k", "-af", "apad", "-t", String(totalFrames / fps),
  "-movflags", "+faststart", "out/wooden-airfield.mp4"], {stdio: "inherit"});
const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", "out/wooden-airfield.mp4"], {encoding: "utf8"}));
const video = probe.streams.find(s => s.codec_type === "video");
if (Number(video?.nb_frames) !== totalFrames || !probe.streams.some(s => s.codec_type === "audio")) {
  throw new Error("Output must contain every expected video frame and the narration.");
}
if (Math.abs(Number(probe.format.duration) - totalFrames / fps) > 1 / fps) {
  throw new Error("Output duration does not match the narration timeline.");
}
console.log(`Verified ${video.nb_frames} frames with audio (${probe.format.duration}s).`);
