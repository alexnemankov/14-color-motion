import type { ColorRgb } from '../types';

export function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function samplePaletteColor(palette: ColorRgb[], t: number): ColorRgb {
  if (palette.length === 0) return [0, 0, 0];
  if (palette.length === 1) return [...palette[0]] as ColorRgb;

  const clamped = Math.max(0, Math.min(1, t));
  const segment = clamped * (palette.length - 1);
  const index = Math.floor(segment);
  const localT = segment - index;
  const from = palette[Math.min(index, palette.length - 1)];
  const to = palette[Math.min(index + 1, palette.length - 1)];

  return [
    clampChannel(from[0] + (to[0] - from[0]) * localT),
    clampChannel(from[1] + (to[1] - from[1]) * localT),
    clampChannel(from[2] + (to[2] - from[2]) * localT),
  ];
}

export function resamplePalette(palette: ColorRgb[], count: number): ColorRgb[] {
  if (count <= 0) return [];
  if (count === 1) return [samplePaletteColor(palette, 0.5)];
  return Array.from({ length: count }, (_, i) =>
    samplePaletteColor(palette, i / (count - 1)),
  );
}

export function interpolatePalettes(from: ColorRgb[], to: ColorRgb[], t: number): ColorRgb[] {
  const count = Math.max(2, to.length);
  const start = resamplePalette(from, count);
  const end = resamplePalette(to, count);
  return end.map((targetColor, index) => {
    const sourceColor = start[index] ?? start[start.length - 1] ?? [0, 0, 0];
    return [
      clampChannel(sourceColor[0] + (targetColor[0] - sourceColor[0]) * t),
      clampChannel(sourceColor[1] + (targetColor[1] - sourceColor[1]) * t),
      clampChannel(sourceColor[2] + (targetColor[2] - sourceColor[2]) * t),
    ] as ColorRgb;
  });
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function palettesEqual(a: ColorRgb[], b: ColorRgb[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((color, i) =>
    color[0] === b[i][0] && color[1] === b[i][1] && color[2] === b[i][2],
  );
}

export function rgbToShareHex(color: ColorRgb): string {
  return color.map((ch) => ch.toString(16).padStart(2, "0")).join("");
}

export function shareHexToRgb(value: string): ColorRgb | null {
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const parsed = parseInt(value, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}
