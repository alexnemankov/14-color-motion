import { useEffect, useRef } from 'react';
import { GradientParams, ColorRgb } from '../App';

interface CanvasProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
}

const lerpColor = (c1: ColorRgb, c2: ColorRgb, t: number): ColorRgb => [
  Math.round(c1[0] + (c2[0] - c1[0]) * t),
  Math.round(c1[1] + (c2[1] - c1[1]) * t),
  Math.round(c1[2] + (c2[2] - c1[2]) * t)
];

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const paletteColor = (t: number, colors: ColorRgb[], blend: number): ColorRgb => {
  t = Math.max(0, Math.min(1, t));
  const len = colors.length;
  if (len === 0) return [0,0,0];
  if (len === 1) return colors[0];
  
  const segment = t * (len - 1);
  const idx = Math.floor(segment);
  let f = segment - idx;
  
  const c0 = colors[Math.min(idx, len-1)];
  const c1 = colors[Math.min(idx + 1, len-1)];
  
  const b = Math.max(0.0001, blend * 0.5);
  f = smoothstep(0.5 - b, 0.5 + b, f);
  
  return lerpColor(c0, c1, f);
};

export default function GeometryCanvas({ params, colors, paused }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const state = useRef({
    params,
    colors,
    paused,
    animTime: 0,
    lastTime: performance.now(),
    width: 0,
    height: 0
  });

  useEffect(() => {
    state.current.params = params;
    state.current.colors = colors;
    state.current.paused = paused;
  }, [params, colors, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      state.current.width = canvas.width;
      state.current.height = canvas.height;
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;

    const render = (ts: number) => {
      animationFrameId = requestAnimationFrame(render);
      const s = state.current;
      
      const dt = s.paused ? 0 : (ts - s.lastTime) / 1000;
      s.lastTime = ts;
      s.animTime += dt * s.params.speed;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, s.width, s.height);

      // Hypotrochoid math
      // x(theta) = (R-r)cos(theta) + d*cos(((R-r)/r)*theta)
      // y(theta) = (R-r)sin(theta) - d*sin(((R-r)/r)*theta)
      
      // Let's creatively map parameters
      const cx = s.width / 2;
      const cy = s.height / 2;
      const baseSize = Math.min(s.width, s.height) * 0.4 * s.params.scale;
      
      const R = 1.0; 
      const r = s.params.frequency * 0.5; // (0 -> 2)
      const d = s.params.definition * 0.5; // (1 -> ~6)
      const amp = s.params.amplitude;

      // Number of rendering steps to complete the cycle.
      // E.g. 500 lines for smoothness.
      const resolution = 600; 

      // Morphing time factor
      const timeOffset = Math.sin(s.animTime * 0.5) * amp;
      const rMorph = Math.max(0.1, r + timeOffset * 0.2);
      
      const k = (R - rMorph) / rMorph;

      ctx.lineWidth = 2 * window.devicePixelRatio * Math.max(0.2, s.params.scale);

      // We draw segments because we want to color them based on palette
      let prevX = cx + (R - rMorph) * baseSize + d * baseSize * 1;
      let prevY = cy; // theta = 0; y = 0
      
      // Sweep a full mathematical phase bounds
      // the higher the 'speed' or 'seed', maybe rotate it
      const globalRot = s.animTime + (s.params.seed * 0.1);
      
      // T is how "much" of the entire spirograph to draw (0 to 100 * Pi)
      const maxTheta = Math.PI * 2 * Math.floor(10 + s.params.definition * 5);

      for (let i = 1; i <= resolution; i++) {
        const theta = (i / resolution) * maxTheta;
        
        let tx = (R - rMorph) * Math.cos(theta) + d * Math.cos(k * theta);
        let ty = (R - rMorph) * Math.sin(theta) - d * Math.sin(k * theta);
        
        // Rotate the point by globalRot
        const cosR = Math.cos(globalRot);
        const sinR = Math.sin(globalRot);
        const ox = tx * cosR - ty * sinR;
        const oy = tx * sinR + ty * cosR;

        const x = cx + ox * baseSize;
        const y = cy + oy * baseSize;

        const colorT = i / resolution;
        const col = paletteColor(colorT, s.colors, s.params.blend);

        ctx.strokeStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();

        prevX = x;
        prevY = y;
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} id="c" />;
}
