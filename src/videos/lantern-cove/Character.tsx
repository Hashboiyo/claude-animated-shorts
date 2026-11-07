import React, { useMemo } from "react";
import * as THREE from "three";
import { PALETTE } from "./palette";
import { blinkAt, breathAt, type Vec3 } from "./timeline";

const W = 512;
const H = 1024;
const INK = PALETTE.ink;

const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const paint = (ctx: CanvasRenderingContext2D, fill: string, lw = 9) => {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = INK;
  ctx.stroke();
};

/**
 * Draws the character into a CanvasTexture. The face is deliberately simple:
 * bean head, ink-dot eyes with no highlights, plum variable-width outline,
 * flat coat colours, one warm rim along the moon side.
 */
const drawCharacter = (blink: boolean) => {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // ---- legs / boots -------------------------------------------------------
  for (const legX of [218, 294]) {
    ctx.beginPath();
    rounded(ctx, legX - 20, 650, 40, 250, 18);
    paint(ctx, PALETTE.coatShade);
  }
  for (const [i, legX] of [218, 294].entries()) {
    ctx.beginPath();
    rounded(ctx, legX - 28, 886, 56, 86, 18);
    paint(ctx, PALETTE.boot);
    // boot sole edge, slightly lighter
    ctx.beginPath();
    ctx.moveTo(legX - 28, 946);
    ctx.lineTo(legX + 28, 946);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 8;
    ctx.stroke();
    if (i === 0) {
      ctx.beginPath();
      ctx.ellipse(legX + 12, 964, 34, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20,14,22,0.28)";
      ctx.fill();
    }
  }

  // ---- scarf tail (behind the body) --------------------------------------
  ctx.beginPath();
  ctx.moveTo(232, 318);
  ctx.bezierCurveTo(150, 340, 92, 420, 112, 512);
  ctx.bezierCurveTo(128, 578, 186, 560, 176, 502);
  ctx.bezierCurveTo(168, 456, 206, 390, 258, 356);
  ctx.closePath();
  paint(ctx, PALETTE.scarf);

  // ---- coat / torso ------------------------------------------------------
  ctx.beginPath();
  ctx.moveTo(174, 318);
  ctx.bezierCurveTo(142, 340, 132, 500, 142, 664);
  ctx.lineTo(370, 664);
  ctx.bezierCurveTo(380, 500, 370, 340, 338, 318);
  ctx.closePath();
  paint(ctx, PALETTE.coat);

  // coat shade on the shadow side
  ctx.beginPath();
  ctx.moveTo(174, 330);
  ctx.bezierCurveTo(150, 380, 148, 560, 154, 656);
  ctx.lineTo(206, 656);
  ctx.bezierCurveTo(198, 520, 202, 390, 218, 330);
  ctx.closePath();
  ctx.fillStyle = "rgba(20,32,48,0.20)";
  ctx.fill();

  // coat opening
  ctx.beginPath();
  ctx.moveTo(262, 336);
  ctx.bezierCurveTo(250, 430, 252, 540, 260, 660);
  ctx.strokeStyle = "rgba(15,20,28,0.55)";
  ctx.lineWidth = 6;
  ctx.stroke();

  // buttons
  for (const by of [420, 480, 540]) {
    ctx.beginPath();
    ctx.arc(268, by, 7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.fill();
  }

  // ---- arms --------------------------------------------------------------
  // resting arm (screen left), drawn with a soft bend
  ctx.beginPath();
  ctx.moveTo(174, 352);
  ctx.bezierCurveTo(128, 400, 116, 500, 132, 592);
  ctx.lineWidth = 54;
  ctx.strokeStyle = PALETTE.coat;
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // hand
  ctx.beginPath();
  ctx.arc(134, 604, 20, 0, Math.PI * 2);
  paint(ctx, PALETTE.skin);

  // raised arm pointing at the moon
  ctx.beginPath();
  ctx.moveTo(336, 352);
  ctx.bezierCurveTo(390, 330, 428, 258, 438, 190);
  ctx.lineWidth = 52;
  ctx.strokeStyle = PALETTE.coatShade;
  ctx.stroke();
  ctx.lineWidth = 10;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(440, 174, 21, 0, Math.PI * 2);
  paint(ctx, PALETTE.skin);
  // pointing finger
  ctx.beginPath();
  ctx.moveTo(448, 162);
  ctx.lineTo(478, 136);
  ctx.lineWidth = 13;
  ctx.strokeStyle = PALETTE.skin;
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // ---- scarf around the neck --------------------------------------------
  ctx.beginPath();
  ctx.moveTo(180, 300);
  ctx.bezierCurveTo(210, 330, 300, 336, 342, 302);
  ctx.lineTo(348, 342);
  ctx.bezierCurveTo(300, 380, 212, 372, 174, 338);
  ctx.closePath();
  paint(ctx, PALETTE.scarf);

  // ---- head --------------------------------------------------------------
  ctx.beginPath();
  ctx.moveTo(256 - 116, 154);
  ctx.bezierCurveTo(256 - 122, 52, 256 + 122, 52, 256 + 116, 154);
  ctx.bezierCurveTo(256 + 111, 238, 256 + 58, 296, 256, 296);
  ctx.bezierCurveTo(256 - 58, 296, 256 - 111, 238, 256 - 116, 154);
  ctx.closePath();
  paint(ctx, PALETTE.skin, 10);

  // warm rim on the moon side
  ctx.beginPath();
  ctx.moveTo(342, 92);
  ctx.bezierCurveTo(370, 128, 368, 206, 336, 258);
  ctx.strokeStyle = "rgba(255,207,158,0.55)";
  ctx.lineWidth = 9;
  ctx.stroke();

  // ears
  for (const ex of [140, 372]) {
    ctx.beginPath();
    ctx.ellipse(ex, 188, 17, 27, 0, 0, Math.PI * 2);
    paint(ctx, PALETTE.skinShade, 8);
  }

  // hair cap + fringe
  ctx.beginPath();
  ctx.moveTo(144, 140);
  ctx.bezierCurveTo(142, 64, 190, 34, 256, 34);
  ctx.bezierCurveTo(330, 34, 374, 70, 370, 144);
  ctx.bezierCurveTo(350, 116, 330, 108, 306, 112);
  ctx.bezierCurveTo(278, 78, 236, 78, 208, 112);
  ctx.bezierCurveTo(184, 108, 162, 116, 144, 140);
  ctx.closePath();
  paint(ctx, PALETTE.hair, 9);

  // ---- face --------------------------------------------------------------
  ctx.translate(7, 0); // looking slightly toward the moon
  const eyeY = 176;
  for (const ex of [214, 300]) {
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(ex - 15, eyeY);
      ctx.quadraticCurveTo(ex, eyeY + 7, ex + 15, eyeY);
      ctx.lineWidth = 8;
      ctx.strokeStyle = INK;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 10, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    // brow
    ctx.beginPath();
    ctx.moveTo(ex - 17, eyeY - 34);
    ctx.quadraticCurveTo(ex, eyeY - 43, ex + 17, eyeY - 34);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(36,23,38,0.85)";
    ctx.stroke();
  }

  // nose
  ctx.beginPath();
  ctx.moveTo(264, 196);
  ctx.quadraticCurveTo(272, 214, 260, 220);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(120,72,54,0.75)";
  ctx.stroke();

  // mouth: small, calm smile
  ctx.beginPath();
  ctx.moveTo(236, 240);
  ctx.quadraticCurveTo(260, 258, 286, 238);
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.translate(-7, 0);

  // ---- coat rim light ----------------------------------------------------
  ctx.beginPath();
  ctx.moveTo(338, 330);
  ctx.bezierCurveTo(362, 380, 370, 520, 364, 650);
  ctx.strokeStyle = "rgba(255,207,158,0.42)";
  ctx.lineWidth = 8;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
};

const CHAR_POS: Vec3 = [1.7, 0, 1.4];

export const Character: React.FC<{ frame: number; cameraPos: Vec3 }> = ({ frame, cameraPos }) => {
  const open = useMemo(() => drawCharacter(false), []);
  const closed = useMemo(() => drawCharacter(true), []);
  const blinking = blinkAt(frame) === 1;
  const breath = breathAt(frame);

  const yaw = Math.atan2(cameraPos[0] - CHAR_POS[0], cameraPos[2] - CHAR_POS[2]);
  const lean = Math.sin(frame / 58) * 0.008;

  return (
    <group position={CHAR_POS} rotation={[0, yaw, lean]}>
      {/* contact shadow, tight under the feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.58, 28]} />
        <meshBasicMaterial color="#1a1218" transparent opacity={0.34} depthWrite={false} />
      </mesh>

      {/* breathing is applied around the feet so they stay planted */}
      <group scale={[1 - breath * 0.002, 1 + breath * 0.006, 1]}>
        <mesh position={[0, 2.0, 0]}>
          <planeGeometry args={[2.0, 4.0]} />
          <meshLambertMaterial
            map={blinking ? closed : open}
            transparent
            alphaTest={0.06}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
};
