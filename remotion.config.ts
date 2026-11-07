import { Config } from "@remotion/cli/config";

// Three.js needs WebGL. GitHub's runners have no GPU, so CI uses the
// swangle (SwiftShader-on-ANGLE) backend. scripts/patch-remotion-gl.mjs adds
// the --enable-unsafe-swiftshader flag that Chrome 158 requires.
Config.setChromiumOpenGlRenderer("swangle");

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);

// One browser tab per render process. The matrix workflow runs one process
// per runner, so "1" keeps memory flat and matches the AGENTS.md policy.
Config.setConcurrency(1);

Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setX264Preset("veryfast");

// Three.js + procedural Canvas2D textures can take a moment on a cold runner.
Config.setDelayRenderTimeoutInMilliseconds(180_000);
Config.setTimeoutInMilliseconds(180_000);

// Keep Remotion's temporary bundles out of the system drive on Windows.
if (!process.env.REMOTION_TMP && process.env.TEMP) {
  process.env.REMOTION_TMP = `${process.env.TEMP}\\remotion-tmp`;
}
