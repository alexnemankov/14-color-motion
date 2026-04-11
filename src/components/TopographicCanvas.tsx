import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { ColorRgb, RendererStatus } from '../App';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

// ─── Simplex Noise ────────────────────────────────────────────────────────────
const F3 = 1 / 3;
const G3 = 1 / 6;

const grad3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

class SimplexNoise {
  perm: Uint8Array;
  permMod12: Uint8Array;

  constructor(seed: number) {
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    const p = new Uint8Array(256);
    let s = seed || Math.random() * 65536;
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647;
      const j = s % (i + 1);
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise3D(xin: number, yin: number, zin: number): number {
    const { perm, permMod12 } = this;
    let n0, n1, n2, n3;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
      else               { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
      else if (x0 < z0)  { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
      else               { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
    const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; const gi = permMod12[ii+perm[jj+perm[kk]]]; n0 = t0*t0*(grad3[gi][0]*x0+grad3[gi][1]*y0+grad3[gi][2]*z0); }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; const gi = permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]]; n1 = t1*t1*(grad3[gi][0]*x1+grad3[gi][1]*y1+grad3[gi][2]*z1); }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; const gi = permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]]; n2 = t2*t2*(grad3[gi][0]*x2+grad3[gi][1]*y2+grad3[gi][2]*z2); }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3;
    if (t3 < 0) n3 = 0; else { t3 *= t3; const gi = permMod12[ii+1+perm[jj+1+perm[kk+1]]]; n3 = t3*t3*(grad3[gi][0]*x3+grad3[gi][1]*y3+grad3[gi][2]*z3); }
    return 32 * (n0 + n1 + n2 + n3);
  }
}

// ─── Marching squares edge table ─────────────────────────────────────────────
const EDGE_TABLE: number[][][] = [
  [],         // 0000
  [[3,2]],    // 0001
  [[2,1]],    // 0010
  [[3,1]],    // 0011
  [[1,0]],    // 0100
  [[1,0],[3,2]], // 0101 saddle
  [[2,0]],    // 0110
  [[3,0]],    // 0111
  [[0,3]],    // 1000
  [[0,2]],    // 1001
  [[0,3],[2,1]], // 1010 saddle
  [[0,1]],    // 1011
  [[1,3]],    // 1100
  [[1,2]],    // 1101
  [[2,3]],    // 1110
  [],         // 1111
];

function interp(v1: number, v2: number, threshold: number): number {
  if (Math.abs(v2 - v1) < 0.0001) return 0.5;
  return (threshold - v1) / (v2 - v1);
}

function edgePoint(
  edge: number, cx: number, cy: number, cw: number, ch: number,
  tl: number, tr: number, br: number, bl: number, threshold: number
): [number, number] {
  let t: number;
  switch (edge) {
    case 0: t = interp(tl, tr, threshold); return [cx + t * cw, cy];
    case 1: t = interp(tr, br, threshold); return [cx + cw, cy + t * ch];
    case 2: t = interp(bl, br, threshold); return [cx + t * cw, cy + ch];
    case 3: t = interp(tl, bl, threshold); return [cx, cy + t * ch];
  }
  return [cx, cy];
}

// ─── Palette helpers ──────────────────────────────────────────────────────────
function paletteColor(t: number, colors: ColorRgb[]): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  const n = colors.length;
  if (n === 1) return colors[0];
  const segment = t * (n - 1);
  const idx = Math.min(Math.floor(segment), n - 2);
  const f = segment - idx;
  const a = colors[idx];
  const b = colors[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

const toEvenSize = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

// ─── Component ────────────────────────────────────────────────────────────────
const TopographicCanvas = forwardRef<RendererHandle, RendererProps>(function TopographicCanvas(
  { params, colors, paused, onStatusChange, renderScale = 1, externalTime = null },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<RendererStatus | null>(null);

  useImperativeHandle(ref, () => ({
    get status() { return statusRef.current; },
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    getCanvas: () => canvasRef.current,
    captureFrame: () => captureCanvasImageData(canvasRef.current),
  }), []);

  const state = useRef({
    animTime: 0,
    lastTimestamp: 0,
    params,
    displayParams: cloneParams(params),
    colors,
    paused,
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

    statusRef.current = null;
    onStatusChange?.(null);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio * renderScale;

    const resize = () => {
      canvas.width  = toEvenSize(window.innerWidth  * dpr);
      canvas.height = toEvenSize(window.innerHeight * dpr);
      canvas.style.width  = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', resize);
    resize();

    // One noise instance per mount (seed-independent — params.seed handled via offset)
    const noise = new SimplexNoise(42);

    // Reusable field buffer
    let field = new Float32Array(0);
    let fieldCols = 0, fieldRows = 0;

    function ensureField(cols: number, rows: number) {
      if (cols !== fieldCols || rows !== fieldRows) {
        fieldCols = cols; fieldRows = rows;
        field = new Float32Array(cols * rows);
      }
    }

    function fbm(x: number, y: number, z: number, octaves: number, freqMul: number): number {
      let val = 0, amp = 1, freq = 1, sum = 0;
      for (let o = 0; o < octaves; o++) {
        val += noise.noise3D(x * freq * freqMul, y * freq * freqMul, z) * amp;
        sum += amp;
        amp  *= 0.5;
        freq *= 2;
      }
      return val / sum;
    }

    let animationFrameId: number;

    const render = (ts: number) => {
      animationFrameId = requestAnimationFrame(render);

      const s = state.current;

      if (externalTime !== null) {
        s.animTime = externalTime;
        s.lastTimestamp = ts;
      } else if (!s.paused) {
        const dt = s.lastTimestamp === 0 ? 0 : (ts - s.lastTimestamp) / 1000;
        s.lastTimestamp = ts;
        s.animTime += dt * s.params.speed;
      } else {
        s.lastTimestamp = ts;
      }

      s.displayParams = stepSmoothedParams(s.displayParams, s.params);
      const dp = s.displayParams;

      // Map GradientParams → topographic config
      const CELL_SIZE    = Math.round(20 - Math.min(dp.scale, 0.5) * 28); // scale → grid resolution: 0=20px coarse, 0.5=6px fine
      const NUM_CONTOURS = Math.min(3, Math.max(1, Math.round(dp.definition))); // definition → contour count (1–3)
      const NOISE_SCALE  = 0.0004 + Math.min(dp.scale, 0.5) * 0.005;    // scale also affects noise zoom
      const BASE_FREQ    = 0.5 + Math.min(dp.frequency, 0.3) * 5;       // frequency → FBM base frequency
      const WARP_STR     = dp.amplitude * 0.5;                           // amplitude → domain warp strength
      const seedOffset   = s.params.seed * 0.01;                         // seed shifts the noise field

      const W = window.innerWidth;
      const H = window.innerHeight;

      // Background: darkest palette color
      const bg = s.colors[0];
      ctx.fillStyle = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
      ctx.fillRect(0, 0, W, H);

      const cols = Math.ceil(W / CELL_SIZE) + 1;
      const rows = Math.ceil(H / CELL_SIZE) + 1;
      ensureField(cols, rows);

      // Sample noise field with optional domain warping
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * CELL_SIZE * NOISE_SCALE + seedOffset;
          const y = j * CELL_SIZE * NOISE_SCALE + seedOffset * 0.7;
          // Domain warping: offset sample coords by a secondary noise pass
          const wx = WARP_STR > 0.01 ? noise.noise3D(x * BASE_FREQ * 0.5, y * BASE_FREQ * 0.5, s.animTime + 100) * WARP_STR : 0;
          const wy = WARP_STR > 0.01 ? noise.noise3D(x * BASE_FREQ * 0.5 + 5.2, y * BASE_FREQ * 0.5 + 1.3, s.animTime + 100) * WARP_STR : 0;
          field[j * cols + i] = fbm(x + wx, y + wy, s.animTime, 4, BASE_FREQ);
        }
      }

      // Normalize to [0, 1]
      let minVal = Infinity, maxVal = -Infinity;
      for (let k = 0; k < field.length; k++) {
        if (field[k] < minVal) minVal = field[k];
        if (field[k] > maxVal) maxVal = field[k];
      }
      const range = maxVal - minVal || 1;
      for (let k = 0; k < field.length; k++) {
        field[k] = (field[k] - minVal) / range;
      }

      // Draw contours
      for (let c = 0; c < NUM_CONTOURS; c++) {
        const threshold = (c + 1) / (NUM_CONTOURS + 1);

        // Map threshold through palette
        // Skip first color (used as bg) — remap 0..1 to 1/(n-1)..1
        const n = s.colors.length;
        const palT = n > 1 ? (1 / (n - 1)) + threshold * ((n - 2) / (n - 1)) : threshold;
        const [r, g, b] = paletteColor(palT, s.colors);

        const distFromCenter = Math.abs(threshold - 0.5) * 2;
        const baseAlpha = dp.blend * (0.25 + (1 - distFromCenter) * 0.5);

        const isMajor = (c % 5 === 0);
        const lw = Math.max(0.1, dp.topoLineWidth);
        const glowWidth  = (isMajor ? 5 : 2.5) * lw;
        const sharpWidth = (isMajor ? 1.3 : 0.65) * lw;
        const glowAlpha  = baseAlpha * 0.22;
        const sharpAlpha = baseAlpha * (isMajor ? 1.0 : 0.75);

        const segments: number[] = [];

        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const tl = field[j * cols + i];
            const tr = field[j * cols + i + 1];
            const br = field[(j+1) * cols + i + 1];
            const bl = field[(j+1) * cols + i];

            const caseIdx =
              (tl >= threshold ? 8 : 0) |
              (tr >= threshold ? 4 : 0) |
              (br >= threshold ? 2 : 0) |
              (bl >= threshold ? 1 : 0);

            const edges = EDGE_TABLE[caseIdx];
            if (!edges || edges.length === 0) continue;

            const cx = i * CELL_SIZE;
            const cy = j * CELL_SIZE;

            for (let e = 0; e < edges.length; e++) {
              const p1 = edgePoint(edges[e][0], cx, cy, CELL_SIZE, CELL_SIZE, tl, tr, br, bl, threshold);
              const p2 = edgePoint(edges[e][1], cx, cy, CELL_SIZE, CELL_SIZE, tl, tr, br, bl, threshold);
              segments.push(p1[0], p1[1], p2[0], p2[1]);
            }
          }
        }

        if (segments.length === 0) continue;

        // Glow pass
        ctx.beginPath();
        for (let s = 0; s < segments.length; s += 4) {
          ctx.moveTo(segments[s],   segments[s+1]);
          ctx.lineTo(segments[s+2], segments[s+3]);
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${glowAlpha})`;
        ctx.lineWidth = glowWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Sharp pass
        ctx.beginPath();
        for (let s = 0; s < segments.length; s += 4) {
          ctx.moveTo(segments[s],   segments[s+1]);
          ctx.lineTo(segments[s+2], segments[s+3]);
        }
        ctx.strokeStyle = `rgba(${r},${g},${b},${sharpAlpha})`;
        ctx.lineWidth = sharpWidth;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Vignette: blend from transparent center to bg color at edges
      const vGrad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.25, W/2, H/2, Math.max(W,H)*0.75);
      vGrad.addColorStop(0, `rgba(${bg[0]},${bg[1]},${bg[2]},0)`);
      vGrad.addColorStop(1, `rgba(${bg[0]},${bg[1]},${bg[2]},0.45)`);
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, W, H);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [externalTime, onStatusChange, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
});

export default TopographicCanvas;
