import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../App';
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

void main() {
  vec3 c;
  float l, z = uTime + uSeed * 0.1;
  // definition 0–1 → zStep 0.01–0.55 (wide chromatic spread range)
  float zStep = 0.01 + uDefinition * 0.54;

  for (int i = 0; i < 3; i++) {
    vec2 p = gl_FragCoord.xy / uRes;
    vec2 uv = p * uScale;
    p -= 0.5;
    p.x *= uRes.x / uRes.y;
    z += zStep;
    l = length(p);
    uv += p / l * (sin(z) + 1.0) * abs(sin(l * uFrequency - z * 2.0)) * uAmplitude;
    c[i] = 0.01 / length(mod(uv, 1.0) - 0.5);
  }

  // Map raw channels through palette colors
  vec3 col = (c[0] * uColor0 + c[1] * uColor1 + c[2] * uColor2) / l;

  // blend: desaturate toward luminance at low values (color purity control)
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, 0.2 + uBlend * 0.8);

  // color3 tints the dark ambient regions
  col += uColor3 * (1.0 - clamp(lum * 0.6, 0.0, 1.0)) * 0.4;

  // Reinhard tone map + gamma
  col = col / (1.0 + col);
  col = pow(max(col, vec3(0.0)), vec3(0.9));

  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Prism shader error:', gl.getShaderInfoLog(s));
  }
  return s;
}

const PrismCanvas = forwardRef<RendererHandle, RendererProps>(function PrismCanvas(
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
        message: 'Prism needs WebGL. Try another mode or enable graphics acceleration.',
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
      console.error('Prism link error:', gl.getProgramInfoLog(prog));
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
      const dp = s.displayParams;
      const cols = s.colors;

      const toF = (c: number[] | undefined, idx: number) =>
        (c?.[idx] ?? 0) / 255;

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime,       s.animTime);
      gl.uniform1f(U.uSeed,       dp.seed);
      gl.uniform1f(U.uScale,      dp.scale);
      gl.uniform1f(U.uAmplitude,  dp.amplitude);
      gl.uniform1f(U.uFrequency,  dp.frequency * 9.0);
      gl.uniform1f(U.uDefinition, (dp.definition - 1) / 11);
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

export default PrismCanvas;
