import type { ColorRgb, GradientParams, RendererStatus } from '../types';

export interface RendererProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
  onStatusChange?: (status: RendererStatus | null) => void;
  renderScale?: number;
  externalTime?: number | null;
}

export interface RendererHandle {
  readonly status: RendererStatus | null;
  readonly supportsExternalTime: boolean;
  readonly supportsLoopSafeExport: boolean;
  getCanvas(): HTMLCanvasElement | null;
  captureFrame(): ImageData | null;
}

export function captureCanvasImageData(canvas: HTMLCanvasElement | null): ImageData | null {
  if (!canvas) return null;

  const context = document.createElement('canvas');
  context.width = canvas.width;
  context.height = canvas.height;
  const ctx = context.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(canvas, 0, 0);
  return ctx.getImageData(0, 0, context.width, context.height);
}
