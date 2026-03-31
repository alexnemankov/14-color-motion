import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ColorRgb, RendererStatus } from '../App';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

interface RenderFrame {
  nodes: Float32Array;
  links: Float32Array;
}

const toEvenSize = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

const lerpColor = (c1: ColorRgb, c2: ColorRgb, t: number): ColorRgb => [
  Math.round(c1[0] + (c2[0] - c1[0]) * t),
  Math.round(c1[1] + (c2[1] - c1[1]) * t),
  Math.round(c1[2] + (c2[2] - c1[2]) * t),
];

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const paletteColor = (t: number, colors: ColorRgb[], blend: number): ColorRgb => {
  t = Math.max(0, Math.min(1, t));
  if (colors.length === 0) return [0, 0, 0];
  if (colors.length === 1) return colors[0];

  const segment = t * (colors.length - 1);
  const index = Math.floor(segment);
  let localT = segment - index;
  const from = colors[Math.min(index, colors.length - 1)];
  const to = colors[Math.min(index + 1, colors.length - 1)];
  const blendWindow = Math.max(0.0001, blend * 0.5);
  localT = smoothstep(0.5 - blendWindow, 0.5 + blendWindow, localT);

  return lerpColor(from, to, localT);
};

const ParticlesCanvas = forwardRef<RendererHandle, RendererProps>(function ParticlesCanvas(
  { params, colors, paused, onStatusChange, renderScale = 1 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameRef = useRef<RenderFrame | null>(null);
  const frameInFlightRef = useRef(false);
  const statusRef = useRef<RendererStatus | null>(null);

  useImperativeHandle(ref, () => ({
    get status() {
      return statusRef.current;
    },
    supportsExternalTime: false,
    supportsLoopSafeExport: false,
    getCanvas: () => canvasRef.current,
    captureFrame: () => captureCanvasImageData(canvasRef.current),
  }), []);

  const state = useRef({
    params,
    displayParams: cloneParams(params),
    colors,
    paused,
    width: 0,
    height: 0,
    pointer: null as { x: number; y: number; active: boolean } | null,
  });

  useEffect(() => {
    state.current.params = params;
    state.current.paused = paused;
  }, [params, paused]);

  useEffect(() => {
    state.current.colors = colors;
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      statusRef.current = {
        title: 'Renderer unavailable',
        message: 'This browser could not start the 2D canvas renderer.',
      };
      onStatusChange?.(statusRef.current);
      return;
    }

    if (typeof Worker === 'undefined') {
      statusRef.current = {
        title: 'Worker support required',
        message: 'Particle mode needs Web Worker support in this browser.',
      };
      onStatusChange?.(statusRef.current);
      return;
    }

    const worker = new Worker(new URL('../workers/particlesWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    statusRef.current = null;
    onStatusChange?.(null);

    worker.onmessage = (event: MessageEvent<RenderFrame & { type: 'frame' }>) => {
      if (event.data.type !== 'frame') return;
      frameRef.current = {
        nodes: event.data.nodes,
        links: event.data.links,
      };
      frameInFlightRef.current = false;
    };

    worker.onerror = () => {
      frameInFlightRef.current = false;
      statusRef.current = {
        title: 'Particle worker failed',
        message: 'Particle simulation could not continue in the background worker.',
      };
      onStatusChange?.(statusRef.current);
    };

    const resize = () => {
      const pixelScale = window.devicePixelRatio * renderScale;
      canvas.width = toEvenSize(window.innerWidth * pixelScale);
      canvas.height = toEvenSize(window.innerHeight * pixelScale);
      state.current.width = canvas.width;
      state.current.height = canvas.height;
      worker.postMessage({
        type: 'resize',
        width: canvas.width,
        height: canvas.height,
      });
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      state.current.pointer = {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
        active: true,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      updatePointer(event.clientX, event.clientY);
    };

    const handlePointerLeave = () => {
      if (state.current.pointer) {
        state.current.pointer.active = false;
      }
    };

    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    resize();
    worker.postMessage({
      type: 'init',
      width: canvas.width,
      height: canvas.height,
    });

    let animationFrameId = 0;
    let lastTime = performance.now();

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);
      const current = state.current;
      const dt = current.paused ? 0 : (time - lastTime) / 1000;
      lastTime = time;
      current.displayParams = stepSmoothedParams(current.displayParams, current.params);

      if (!frameInFlightRef.current) {
        frameInFlightRef.current = true;
        worker.postMessage({
          type: 'step',
          dt,
          params: { ...current.displayParams, seed: current.params.seed },
          seed: current.params.seed,
          paused: current.paused,
          pointer: current.pointer?.active ? { x: current.pointer.x, y: current.pointer.y } : null,
        });
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, current.width, current.height);
      ctx.lineWidth = 1.5 * window.devicePixelRatio;

      const frame = frameRef.current;
      if (!frame) return;

      for (let index = 0; index < frame.links.length; index += 6) {
        const col = paletteColor(frame.links[index + 5], current.colors, current.displayParams.blend);
        ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${frame.links[index + 4]})`;
        ctx.beginPath();
        ctx.moveTo(frame.links[index], frame.links[index + 1]);
        ctx.lineTo(frame.links[index + 2], frame.links[index + 3]);
        ctx.stroke();
      }

      const nodeRadius = Math.max(1.5, 3 * current.displayParams.scale);
      for (let index = 0; index < frame.nodes.length; index += 3) {
        const col = paletteColor(frame.nodes[index + 2], current.colors, current.displayParams.blend);
        ctx.fillStyle = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
        ctx.beginPath();
        ctx.arc(frame.nodes[index], frame.nodes[index + 1], nodeRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      cancelAnimationFrame(animationFrameId);
      worker.terminate();
      workerRef.current = null;
      frameRef.current = null;
      frameInFlightRef.current = false;
    };
  }, [onStatusChange, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
});

export default ParticlesCanvas;
