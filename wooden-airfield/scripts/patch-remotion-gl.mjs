// Remotion 4.0.540's swangle backend needs this flag in current Chrome.
import {readFileSync, writeFileSync} from "node:fs";
const file = new URL("../node_modules/@remotion/renderer/dist/open-browser.js", import.meta.url);
const original = "return ['--use-gl=angle', '--use-angle=swiftshader'];";
const fixed = "return ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];";
const source = readFileSync(file, "utf8");
if (!source.includes(fixed)) {
  if (!source.includes(original)) throw new Error("Remotion's WebGL launcher changed; review the SwiftShader patch.");
  writeFileSync(file, source.replace(original, fixed));
}
