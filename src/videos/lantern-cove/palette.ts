// Palette measured against references/STYLE_BIBLE.md and references/reports/.
// Saturated golden-hour world, warm key light, violet-blue shade, near-black ink.
export const PALETTE = {
  ink: "#241726",
  worldInk: "#171018",

  skyTop: "#4f6fb8",
  skyMid: "#c98f9a",
  skyHorizon: "#ffc47c",
  sun: "#ffcf9e",
  fog: "#e8a97a",

  grass: "#6fae4f",
  grassDark: "#4f8b3f",
  grassLight: "#86c45f",
  rock: "#7a5b45",
  rockDark: "#5d4334",
  dirt: "#8a6a4a",

  water: "#3f9fb5",
  waterLight: "#8fd6d9",

  cream: "#f0d7a8",
  ochre: "#d9a04f",
  terracotta: "#b85c45",
  brick: "#a94f3f",
  slate: "#5b6f7a",
  moss: "#4f7a4a",
  wood: "#8a5a3c",
  woodDark: "#5f3d2a",

  window: "#ffd27a",
  lantern: "#ffb45e",
  moon: "#ffe9c4",
  star: "#fff0d0",

  skin: "#f2c9a0",
  skinShade: "#d9a87c",
  coat: "#3f6f8f",
  coatShade: "#2f5570",
  scarf: "#d9543f",
  hair: "#3a2a25",
  boot: "#4a3230",
} as const;

export type PaletteKey = keyof typeof PALETTE;
