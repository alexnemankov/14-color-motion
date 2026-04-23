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
uniform float uSeed;
uniform float uScale;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uDefinition;
uniform float uBlend;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;

mat2 rot(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, s, -s, c);
}

const float PI  = acos(-1.0);
const float PI2 = PI * 2.0;

vec2 pmod(vec2 p, float r) {
    float a = atan(p.x, p.y) + PI / r;
    float n = PI2 / r;
    a = floor(a / n) * n;
    return p * rot(-a);
}

float box(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float ifsBox(vec3 p) {
    float ph = uSeed * 0.001;
    for (int i = 0; i < 5; i++) {
        p = abs(p) - 1.0;
        p.xy *= rot(uTime * 0.3 + ph);
        p.xz *= rot(uTime * 0.1 + ph * 0.5);
    }
    p.xz *= rot(uTime + ph * 2.0);
    // amplitude 0–1.5 → box scale 0.3–1.8× original dims
    vec3 b = vec3(0.4, 0.8, 0.3) * (0.3 + uAmplitude * 0.7);
    return box(p, b);
}

float mapScene(vec3 p) {
    vec3 q = p;
    q.x = mod(q.x - 5.0, 10.0) - 5.0;
    q.y = mod(q.y - 5.0, 10.0) - 5.0;
    q.z = mod(q.z, 16.0) - 8.0;
    // frequency 0.5–2.0 → radial symmetry 2.25–7.0
    float sym = 2.0 + uFrequency * 2.5;
    q.xy = pmod(q.xy, sym);
    return ifsBox(q);
}

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);

    vec3 cPos  = vec3(0.0, 0.0, -3.0 * uTime);
    vec3 cDir  = normalize(vec3(0.0, 0.0, -1.0));
    // scale controls camera roll amplitude
    vec3 cUp   = vec3(sin(uTime * 0.4) * uScale * 0.6, 1.0, 0.0);
    vec3 cSide = cross(cDir, cUp);
    vec3 ray   = normalize(cSide * p.x + cUp * p.y + cDir);

    float acc  = 0.0;
    float acc2 = 0.0;
    float t    = 0.0;

    // definition 1–12 → falloff sharpness 2.0–6.8
    float falloff = 2.0 + uDefinition * 0.4;
    // blend 0–1 → pulse ring brightness multiplier 1.5–3.5
    float pulseMul   = 1.5 + uBlend * 2.0;
    float pulsePhase = uTime * (20.0 + uBlend * 12.0);

    for (int i = 0; i < 99; i++) {
        vec3 pos  = cPos + ray * t;
        float dist = mapScene(pos);
        dist = max(abs(dist), 0.02);
        float a = exp(-dist * falloff);
        if (mod(length(pos) + pulsePhase, 30.0) < 3.0) {
            a    *= pulseMul;
            acc2 += a;
        }
        acc += a;
        t += dist * 0.5;
    }

    float base = acc  * 0.008;
    float ring = acc2 * 0.006;

    // uColor0: primary structure glow
    // uColor1: pulse ring color
    // uColor2: hot-core highlight (brightest density)
    // uColor3: ambient background tint
    vec3 col = uColor0 * base + uColor1 * ring;
    col += uColor2 * (base * base * 5.0);
    col += uColor3 * 0.012;

    gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('PhantomStar shader error:', gl.getShaderInfoLog(s));
  }
  return s;
}

const PhantomStarCanvas = forwardRef<RendererHandle, RendererProps>(function PhantomStarCanvas(
  { params, colors, paused, onStatusChange, renderScale = 1, externalTime = null },
  ref,
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
        message: 'Phantom Star needs WebGL. Try another mode or enable graphics acceleration.',
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
      console.error('PhantomStar link error:', gl.getProgramInfoLog(prog));
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
    ['uRes', 'uTime', 'uSeed', 'uScale', 'uAmplitude', 'uFrequency', 'uDefinition', 'uBlend',
     'uColor0', 'uColor1', 'uColor2', 'uColor3']
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
      const dp   = s.displayParams;
      const cols = s.colors;

      const toF = (c: number[] | undefined, idx: number) => (c?.[idx] ?? 0) / 255;

      gl.uniform2f(U.uRes,        canvas.width, canvas.height);
      gl.uniform1f(U.uTime,       s.animTime);
      gl.uniform1f(U.uSeed,       dp.seed);
      gl.uniform1f(U.uScale,      dp.scale);
      gl.uniform1f(U.uAmplitude,  dp.amplitude);
      gl.uniform1f(U.uFrequency,  dp.frequency);
      gl.uniform1f(U.uDefinition, dp.definition);
      gl.uniform1f(U.uBlend,      dp.blend);

      gl.uniform3f(U.uColor0, toF(cols[0], 0), toF(cols[0], 1), toF(cols[0], 2));
      gl.uniform3f(U.uColor1, toF(cols[1], 0), toF(cols[1], 1), toF(cols[1], 2));
      gl.uniform3f(U.uColor2, toF(cols[2], 0), toF(cols[2], 1), toF(cols[2], 2));
      gl.uniform3f(U.uColor3, toF(cols[3], 0), toF(cols[3], 1), toF(cols[3], 2));

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vShader);
      gl.deleteShader(fShader);
      gl.deleteBuffer(buf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderScale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
});

export default PhantomStarCanvas;
