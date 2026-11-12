import {Config} from "@remotion/cli/config";

// Software WebGL works on GitHub's CPU-only runners.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(1);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDelayRenderTimeoutInMilliseconds(180_000);

// Local Linux testing can use an already installed Chromium.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
