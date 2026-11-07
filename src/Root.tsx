import React from "react";
import { Composition } from "remotion";
import { LanternCove, LANTERN_COVE_DURATION, LANTERN_COVE_FPS } from "./videos/lantern-cove/LanternCove";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LanternCove"
        component={LanternCove}
        durationInFrames={LANTERN_COVE_DURATION}
        fps={LANTERN_COVE_FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
