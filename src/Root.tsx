import React from "react";
import { Composition } from "remotion";
import { LanternCove, LANTERN_COVE_DURATION, LANTERN_COVE_FPS } from "./videos/lantern-cove/LanternCove";
import { WoodenBomb, WOODEN_FRAMES } from "./videos/wooden-bomb/WoodenBomb";

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
      <Composition
        id="WoodenBomb"
        component={WoodenBomb}
        durationInFrames={WOODEN_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
