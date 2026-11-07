import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { PALETTE } from "./palette";
import { cameraAt } from "./timeline";
import { World } from "./World";
import { Character } from "./Character";

const CameraRig: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const state = cameraAt(frame);

  useLayoutEffect(() => {
    camera.position.set(state.position[0], state.position[1], state.position[2]);
    camera.lookAt(state.look[0], state.look[1], state.look[2]);
    camera.rotation.z += state.roll;
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.fov = state.fov;
      perspective.updateProjectionMatrix();
    }
  }, [camera, frame]);

  return null;
};

export const Scene: React.FC<{ frame: number }> = ({ frame }) => {
  const cam = cameraAt(frame);
  return (
    <>
      <color attach="background" args={[PALETTE.skyHorizon]} />
      <fog attach="fog" args={[PALETTE.fog, 17, 48]} />
      <CameraRig frame={frame} />

      <World frame={frame} />
      <Character frame={frame} cameraPos={cam.position} />

      {/* Ink lives in the painted textures; bloom only catches the HDR
          lanterns, windows, fireflies and moon, then the neutral tone map
          and vignette finish the grade. */}
      <EffectComposer multisampling={4} enableNormalPass={false}>
        <Bloom intensity={0.62} luminanceThreshold={0.88} luminanceSmoothing={0.22} mipmapBlur />
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette eskil={false} offset={0.18} darkness={0.56} />
      </EffectComposer>
    </>
  );
};
