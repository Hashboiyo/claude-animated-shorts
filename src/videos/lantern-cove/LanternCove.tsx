import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Scene } from "./Scene";
import { DURATION, FPS } from "./timeline";

export const LANTERN_COVE_DURATION = DURATION;
export const LANTERN_COVE_FPS = FPS;

/**
 * "Lantern Cove" is a self-contained smoke-test production: a painted 3D
 * island town at golden hour, a flat 2D character with plum ink, a gliding
 * camera and a moonlit tilt-up. It exists so the cloud render pipeline can be
 * proven end-to-end before the first real short is written.
 */
export const LanternCove: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0a12" }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows
        dpr={1}
        camera={{ fov: 46, near: 0.1, far: 120, position: [0, 4.2, 14.5] }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
      >
        <Scene frame={frame} />
      </ThreeCanvas>

      <Audio src={staticFile("audio/lantern-cove-music.wav")} volume={0.85} />
    </AbsoluteFill>
  );
};
