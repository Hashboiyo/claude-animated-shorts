import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ensureDir } from "./lib.mjs";

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Builds a labelled contact sheet from rendered stills. This is QA tooling,
 * not a substitute for the Remotion/Three.js renderer.
 */
export const makeContactSheet = async ({ images, out, columns = 4, cellWidth = 360, title = "" }) => {
  if (!images.length) throw new Error("No images supplied to the contact sheet");

  const cols = Math.max(1, Math.min(columns, images.length));
  const rows = Math.ceil(images.length / cols);
  const cellHeight = Math.round((cellWidth * 16) / 9);
  const gap = 16;
  const pad = 20;
  const labelHeight = 26;
  const titleHeight = title ? 44 : 0;
  const width = pad * 2 + cols * cellWidth + (cols - 1) * gap;
  const height = pad * 2 + titleHeight + rows * (cellHeight + labelHeight) + (rows - 1) * gap;

  const composites = [];
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = pad + col * (cellWidth + gap);
    const top = pad + titleHeight + row * (cellHeight + labelHeight + gap);

    const buffer = await sharp(item.path)
      .resize(cellWidth, cellHeight, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    composites.push({ input: buffer, left, top });

    const label = item.label ?? path.basename(item.path);
    const svg = Buffer.from(
      `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">` +
        `<rect width="100%" height="100%" fill="#14131a"/>` +
        `<text x="8" y="18" fill="#b9c0cc" font-family="Arial, Helvetica, sans-serif" font-size="14">${esc(label)}</text>` +
        `</svg>`,
    );
    composites.push({ input: svg, left, top: top + cellHeight });
  }

  if (title) {
    const svg = Buffer.from(
      `<svg width="${width}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg">` +
        `<text x="${pad}" y="30" fill="#f5efe6" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold">${esc(title)}</text>` +
        `</svg>`,
    );
    composites.push({ input: svg, left: 0, top: pad });
  }

  ensureDir(path.dirname(out));
  await sharp({
    create: { width, height, channels: 3, background: "#0e0d12" },
  })
    .composite(composites)
    .png()
    .toFile(out);

  return { out, width, height, count: images.length, bytes: fs.statSync(out).size };
};
