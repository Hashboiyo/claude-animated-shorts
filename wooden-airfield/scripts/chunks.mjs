import {readFileSync} from "node:fs";
const {totalFrames} = JSON.parse(readFileSync(new URL("../src/timing.json", import.meta.url), "utf8"));
const count = 8;
const chunks = Array.from({length: count}, (_, index) => ({
  index: String(index).padStart(2, "0"),
  from: Math.floor(index * totalFrames / count),
  to: Math.floor((index + 1) * totalFrames / count) - 1,
}));
console.log(`matrix=${JSON.stringify({chunk: chunks})}`);
