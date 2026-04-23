import { useEffect, useRef, useState } from 'react';
import type { ColorRgb } from '../types';
import { PALETTE_TRANSITION_MS } from '../constants';
import { interpolatePalettes, easeInOutCubic, palettesEqual } from '../utils/colorUtils';

export function usePaletteTransition(colors: ColorRgb[]): ColorRgb[] {
  const [renderColors, setRenderColors] = useState<ColorRgb[]>(colors);
  const renderColorsRef = useRef<ColorRgb[]>(colors);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    renderColorsRef.current = renderColors;
  }, [renderColors]);

  useEffect(() => {
    if (palettesEqual(renderColorsRef.current, colors)) {
      setRenderColors(colors);
      renderColorsRef.current = colors;
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const startPalette = renderColorsRef.current;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const linear = Math.min(1, (now - startedAt) / PALETTE_TRANSITION_MS);
      const eased = easeInOutCubic(linear);
      const next = interpolatePalettes(startPalette, colors, eased);
      renderColorsRef.current = next;
      setRenderColors(next);

      if (linear < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        renderColorsRef.current = colors;
        setRenderColors(colors);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [colors]); // eslint-disable-line react-hooks/exhaustive-deps

  return renderColors;
}
