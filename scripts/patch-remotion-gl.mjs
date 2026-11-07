/**
 * Chrome 158 (bundled with Remotion 4.0.540+) requires
 * `--enable-unsafe-swiftshader` before it will create a software WebGL
 * context. Remotion 4.0.541's `swangle` backend only passes
 * `--use-gl=angle --use-angle=swiftshader`, so headless GitHub runners fail
 * with "WebGL context could not be created / GL_VENDOR = Disabled".
 *
 * This postinstall patch adds the missing flag. It is intentionally loud if
 * Remotion changes the code: update the needle, then remove this patch once
 * Remotion ships the flag by default.
 */
import fs from "node:fs";
import path from "node:path";

const file = path.resolve("node_modules/@remotion/renderer/dist/open-browser.js");
const needle = "return ['--use-gl=angle', '--use-angle=swiftshader'];";
const patched = "return ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];";

if (!fs.existsSync(file)) {
  console.warn(`[patch-remotion-gl] ${file} not found; nothing to patch.`);
  process.exit(0);
}

let source = fs.readFileSync(file, "utf8");
if (source.includes(patched)) {
  console.log("[patch-remotion-gl] already patched.");
  process.exit(0);
}
if (!source.includes(needle)) {
  throw new Error(
    "[patch-remotion-gl] Could not find the swangle branch. Remotion changed; update scripts/patch-remotion-gl.mjs.",
  );
}

source = source.replace(needle, patched);
fs.writeFileSync(file, source);
console.log("[patch-remotion-gl] added --enable-unsafe-swiftshader to swangle.");
