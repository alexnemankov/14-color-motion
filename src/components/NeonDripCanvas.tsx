import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../types';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

const toEvenSize = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

const vsSource = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fsSource = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uSpeed;
uniform float uBlobCount;   // 0..1  →  4..12 blobs
uniform float uBlend;       // glow intensity multiplier
uniform float uZoom;        // UV zoom
uniform float uWarp;        // lateral wobble strength
uniform float uTendril;     // tendril base-frequency multiplier
uniform float uSeed;        // noise offset
uniform vec3  uColors[8];
uniform int   uColorCount;

#define PI        3.14159265359
#define MAX_BLOBS 12

// ── Hash / value-noise ─────────────────────────────────────────────────────────
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),              hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// ── Palette interpolation ──────────────────────────────────────────────────────
vec3 palColor(float t) {
  t = clamp(t, 0.0, 1.0);
  float seg = t * float(uColorCount - 1);
  int   idx = int(floor(seg));
  float f   = fract(seg);
  vec3 c0 = uColors[0], c1 = uColors[0];
  for (int i = 0; i < 8; i++) {
    if (i == idx)     c0 = uColors[i];
    if (i == idx + 1) c1 = uColors[i];
  }
  return mix(c0, c1, f);
}

// ── Metaball field ─────────────────────────────────────────────────────────────
float metaballField(vec2 p, float t) {
  float energy    = 0.0;
  float numBlobs  = 4.0 + uBlobCount * 8.0;   // 4–12
  float seedOff   = uSeed * 0.001;

  for (int i = 0; i < MAX_BLOBS; i++) {
    if (float(i) >= numBlobs) break;
    float fi    = float(i);
    float phase = fi * 1.618 + fi * fi * 0.13 + seedOff;

    float riseSpeed = (0.3 + 0.4 * fract(fi * 0.618));
    float riseCycle = mod(t * riseSpeed + phase * 0.7, 3.5) - 1.0;

    float xBase   = sin(phase * 2.39996) * 0.45;
    float xWobble = sin(t * 0.8 + phase * 3.1) * (0.12 * uWarp);
    float xDrift  = sin(riseCycle * 2.0 + phase) * (0.08 * uWarp);
    float bx      = (xBase + xWobble + xDrift) * uZoom;

    float by = (-0.7 + riseCycle * 0.9) * uZoom;

    float baseSize = (0.04 + 0.03 * fract(phase * 0.317)) * uZoom;
    float pulse    = 1.0 + 0.15 * sin(t * 1.5 + phase * 4.7);
    float radius   = baseSize * pulse;

    float d = length(p - vec2(bx, by));
    energy += (radius * radius) / (d * d + 0.0001);
  }
  return energy;
}

// ── Tendril field ──────────────────────────────────────────────────────────────
float tendrilField(vec2 p, float t) {
  float freq = uTendril;
  float n1 = vnoise(vec2(p.x * 6.0 * freq, p.y * 2.0 - t * 0.6));
  float n2 = vnoise(vec2(p.x * 12.0 * freq + 3.7, p.y * 4.0 - t * 0.8) + 20.0);
  float n3 = vnoise(vec2(p.x * 3.0  * freq + 7.1, p.y * 1.5 - t * 0.4));
  float tendrils = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  tendrils = smoothstep(0.35, 0.65, tendrils);
  tendrils *= smoothstep(0.6, -0.3, p.y);
  tendrils *= 0.6 + 0.4 * smoothstep(0.0, -0.5, p.y);
  return tendrils;
}

// ── Vignette ───────────────────────────────────────────────────────────────────
float vignette(vec2 uv) {
  float d = length(uv * vec2(0.9, 1.0));
  return smoothstep(1.3, 0.4, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uRes * 0.5) / uRes.y;
  float t  = uTime;

  // ── Background ─────────────────────────────────────────────────────────────
  vec3 bg  = uColors[0];
  float bgDist = length(uv * vec2(0.8, 1.0));
  vec3 col = bg * (1.0 - bgDist * 0.35);
  col = max(col, vec3(0.0));

  // ── HDR palette layers ─────────────────────────────────────────────────────
  // Palette is sampled at increasing positions; values > 1.0 give neon punch,
  // which ACES tone-mapping compresses to a vivid final result.
  vec3 glowColor  = palColor(0.30) * (1.8 * uBlend);
  vec3 surfColor  = palColor(0.55) * (3.2 * uBlend);
  vec3 innerColor = palColor(0.75) * (4.8 * uBlend);
  vec3 coreColor  = mix(palColor(1.0), vec3(1.5), 0.35) * (7.0 * uBlend);
  vec3 tendrilColor = palColor(0.40) * (1.2 * uBlend);

  // ── Fields ─────────────────────────────────────────────────────────────────
  float field    = metaballField(uv, t);
  float tendrils = tendrilField(uv, t);
  float combined = field + tendrils * 0.6;

  // ── Isosurface layers ──────────────────────────────────────────────────────
  float thr        = 1.0;
  float outerGlow  = smoothstep(thr * 0.15, thr * 0.50, combined);
  float surface    = smoothstep(thr * 0.40, thr * 0.70, combined);
  float inner      = smoothstep(thr * 0.80, thr * 1.80, combined);
  float core       = smoothstep(thr * 2.00, thr * 4.00, combined);

  // ── Compose blob color ─────────────────────────────────────────────────────
  vec3 blobCol = glowColor * outerGlow;
  blobCol = mix(blobCol, surfColor,  surface * 0.95);
  blobCol = mix(blobCol, innerColor, inner   * 0.95);
  blobCol = mix(blobCol, coreColor,  core    * 1.00);

  // Rim edge highlight
  float edgeBand = surface * (1.0 - inner);
  blobCol += palColor(0.65) * 2.0 * uBlend * edgeBand * 0.8;

  // Tendril tinting
  float tendrilVis = tendrils * (1.0 - surface * 0.5);
  blobCol += tendrilColor * tendrilVis * 0.7;

  col += blobCol;

  // ── Micro blobs: small rising sparks ──────────────────────────────────────
  float microField = 0.0;
  float seedOff    = uSeed * 0.001;
  for (int i = 0; i < 5; i++) {
    float fi   = float(i);
    float phase = fi * 2.39996 + 100.0 + seedOff;
    float mCycle = mod(t * (0.5 + 0.3 * fract(phase * 0.618)) + phase, 2.8) - 0.8;
    float mx = (sin(phase * 1.7) * 0.5 + sin(t + phase * 2.3) * 0.1) * uZoom;
    float my = (-0.6 + mCycle * 0.8) * uZoom;
    float mr = (0.015 + 0.01 * sin(t * 2.0 + phase)) * uZoom;
    float md = length(uv - vec2(mx, my));
    microField += (mr * mr) / (md * md + 0.0001);
  }
  float microSurface = smoothstep(0.8, 1.5, microField);
  float microCore    = smoothstep(1.5, 3.0, microField);
  col += palColor(0.6) * 2.5 * uBlend * microSurface * 0.7;
  col += palColor(0.9) * 5.0 * uBlend * microCore    * 0.8;

  // ── Ambient upward flow ────────────────────────────────────────────────────
  float ambFlow = vnoise(vec2(uv.x * 3.0, uv.y * 1.5 - t * 0.2) + 50.0);
  ambFlow = smoothstep(0.4, 0.6, ambFlow) * 0.06;
  col += palColor(0.2) * ambFlow;

  // ── Film grain ─────────────────────────────────────────────────────────────
  float grain = (hash(gl_FragCoord.xy + fract(t * 43.758) * 1000.0) - 0.5) * 0.025;
  col += grain;

  // ── Vignette ───────────────────────────────────────────────────────────────
  col *= vignette(uv);

  // ── ACES filmic tone mapping ───────────────────────────────────────────────
  col = max(col, vec3(0.0));
  col = col * (2.51 * col + 0.03) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(col, vec3(0.90));

  // ── Warm shadow push ───────────────────────────────────────────────────────
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * vec3(1.06, 0.97, 0.90), smoothstep(0.05, 0.0, lum) * 0.3);

  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('NeonDrip shader error:', gl.getShaderInfoLog(s));
  }
  return s;
}

const NeonDripCanvas = forwardRef<RendererHandle, RendererProps>(function NeonDripCanvas(
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

    const gl = (
      canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: false }) ||
      canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, alpha: false })
    ) as WebGLRenderingContext | null;

    if (!gl) {
      statusRef.current = {
        title: 'Renderer unavailable',
        message: 'Neon Drip needs WebGL. Try another mode or enable graphics acceleration.',
      };
      onStatusChange?.(statusRef.current);
      return;
    }
    statusRef.current = null;
    onStatusChange?.(null);

    const vShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vShader || !fShader) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('NeonDrip link error:', gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const U: Record<string, WebGLUniformLocation | null> = {};
    ['uRes','uTime','uSpeed','uBlobCount','uBlend','uZoom','uWarp','uTendril','uSeed','uColors','uColorCount']
      .forEach(n => { U[n] = gl.getUniformLocation(prog, n); });

    const resize = () => {
      const dpr = window.devicePixelRatio * renderScale;
      canvas.width  = toEvenSize(window.innerWidth  * dpr);
      canvas.height = toEvenSize(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

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

      // Map GradientParams → shader uniforms
      const blobCount = Math.max(0, Math.min(1, (dp.definition - 1) / 11)); // definition 1–12 → 0–1

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime,      s.animTime);
      gl.uniform1f(U.uSpeed,     dp.speed);
      gl.uniform1f(U.uBlobCount, blobCount);
      gl.uniform1f(U.uBlend,     dp.blend);
      gl.uniform1f(U.uZoom,      0.5 + dp.scale * 0.8);          // scale: 0.5–1.3 zoom factor
      gl.uniform1f(U.uWarp,      dp.amplitude);                   // amplitude → lateral wobble
      gl.uniform1f(U.uTendril,   0.5 + dp.frequency * 1.5);      // frequency → tendril density
      gl.uniform1f(U.uSeed,      s.params.seed);

      const flat: number[] = [];
      s.colors.forEach(c => flat.push(c[0] / 255, c[1] / 255, c[2] / 255));
      while (flat.length < 24) flat.push(0, 0, 0);
      gl.uniform3fv(U.uColors,     new Float32Array(flat));
      gl.uniform1i( U.uColorCount, s.colors.length);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [externalTime, onStatusChange, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
});

export default NeonDripCanvas;
