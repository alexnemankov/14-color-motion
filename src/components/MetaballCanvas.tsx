import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../types';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

const toEvenSize = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

const vsSource = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const vsBlitSource = `#version 300 es
in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const fsBlitSource = `#version 300 es
precision mediump float;
uniform sampler2D uTex;
in vec2 vUV;
out vec4 fragColor;
void main() {
  fragColor = texture(uTex, vUV);
}
`;

const fsSource = `#version 300 es
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uSeed;
uniform float uScale;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uSmoothK;
uniform float uBlend;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;

out vec4 fragColor;

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}

float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5*(d2-d1)/k, 0.0, 1.0);
  return mix(d2, d1, h) - k*h*(1.0-h);
}

float mapScene(vec3 p) {
  float d = 2.0;
  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float t = uTime * uFrequency * (fract(fi * 412.531 + 0.513 + uSeed * 0.01) - 0.5) * 2.0;
    float sz = mix(0.5, 1.0, fract(fi * 412.531 + 0.5124 + uSeed * 0.007));
    vec3 offset = sin(t + fi * vec3(52.5126, 64.62744, 632.25)) * vec3(uAmplitude, uAmplitude, uAmplitude * 0.4);
    d = opSmoothUnion(sdSphere(p + offset, sz), d, uSmoothK);
  }
  return d;
}

vec3 calcNormal(vec3 p) {
  float h = 1e-5;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * mapScene(p + k.xyy * h) +
    k.yyx * mapScene(p + k.yyx * h) +
    k.yxy * mapScene(p + k.yxy * h) +
    k.xxx * mapScene(p + k.xxx * h)
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 rayOri = vec3((uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * uScale, uScale * 0.5);
  vec3 rayDir = vec3(0.0, 0.0, -1.0);

  float depth = 0.0;
  vec3 p = rayOri;

  for (int i = 0; i < 64; i++) {
    p = rayOri + rayDir * depth;
    float dist = mapScene(p);
    depth += dist;
    if (dist < 1e-6) break;
  }

  depth = min(uScale, depth);
  vec3 n = calcNormal(p);
  float b = max(0.0, dot(n, vec3(0.577)));

  vec3 surfaceCol = mix(uColor0, uColor1, b);
  surfaceCol += uColor2 * pow(b, 4.0) * (0.5 + uBlend * 1.5);
  float hitFactor = exp(-depth * 3.0 / uScale);
  vec3 col = mix(uColor3, surfaceCol, hitFactor);

  fragColor = vec4(col, 1.0);
}
`;

function makeShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Metaball shader error:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function makeProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const prog = gl.createProgram();
  if (!prog) return null;
  const vShader = makeShader(gl, gl.VERTEX_SHADER, vs);
  const fShader = makeShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vShader || !fShader) return null;
  gl.attachShader(prog, vShader);
  gl.attachShader(prog, fShader);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Metaball link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  gl.deleteShader(vShader);
  gl.deleteShader(fShader);
  return prog;
}

const MetaballCanvas = forwardRef<RendererHandle, RendererProps>(function MetaballCanvas(
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

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });

    if (!gl) {
      statusRef.current = {
        title: 'Renderer unavailable',
        message: 'Metaballs needs WebGL2. Try another mode or enable graphics acceleration.',
      };
      onStatusChange?.(statusRef.current);
      return;
    }
    statusRef.current = null;
    onStatusChange?.(null);

    const marchProg = makeProgram(gl, vsSource, fsSource);
    const blitProg = makeProgram(gl, vsBlitSource, fsBlitSource);
    if (!marchProg || !blitProg) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const aPosMarch = gl.getAttribLocation(marchProg, 'aPos');
    const aPosBlit = gl.getAttribLocation(blitProg, 'aPos');

    gl.useProgram(marchProg);
    gl.enableVertexAttribArray(aPosMarch);

    gl.useProgram(blitProg);
    gl.enableVertexAttribArray(aPosBlit);
    gl.uniform1i(gl.getUniformLocation(blitProg, 'uTex'), 0);

    const UM: Record<string, WebGLUniformLocation | null> = {};
    ['uRes', 'uTime', 'uSeed', 'uScale', 'uAmplitude', 'uFrequency', 'uSmoothK', 'uBlend',
     'uColor0', 'uColor1', 'uColor2', 'uColor3']
      .forEach(n => { UM[n] = gl.getUniformLocation(marchProg, n); });

    let marchFbo: WebGLFramebuffer | null = null;
    let marchTex: WebGLTexture | null = null;
    let halfW = 2;
    let halfH = 2;

    const buildFbo = (w: number, h: number) => {
      if (marchTex) gl.deleteTexture(marchTex);
      if (marchFbo) gl.deleteFramebuffer(marchFbo);
      marchTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, marchTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      marchFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, marchFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, marchTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    const resize = () => {
      const dpr = window.devicePixelRatio * renderScale;
      canvas.width  = toEvenSize(window.innerWidth  * dpr);
      canvas.height = toEvenSize(window.innerHeight * dpr);
      halfW = Math.max(1, Math.floor(canvas.width  / 2));
      halfH = Math.max(1, Math.floor(canvas.height / 2));
      buildFbo(halfW, halfH);
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
      const toF = (c: number[] | undefined, idx: number) => (c?.[idx] ?? 0) / 255;

      // definition 1–12 → smoothK 0.15–1.5
      const smoothK = 0.15 + ((dp.definition - 1) / 11) * 1.35;
      // scale 0–1.4 → view extent 3–12
      const viewScale = 3.0 + dp.scale * 6.43;

      // Pass 1: march into half-res FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, marchFbo);
      gl.viewport(0, 0, halfW, halfH);
      gl.useProgram(marchProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(aPosMarch, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(UM.uRes,       halfW, halfH);
      gl.uniform1f(UM.uTime,      s.animTime);
      gl.uniform1f(UM.uSeed,      dp.seed);
      gl.uniform1f(UM.uScale,     viewScale);
      gl.uniform1f(UM.uAmplitude, dp.amplitude * 2.0);
      gl.uniform1f(UM.uFrequency, dp.frequency * 1.5);
      gl.uniform1f(UM.uSmoothK,   smoothK);
      gl.uniform1f(UM.uBlend,     dp.blend);
      gl.uniform3f(UM.uColor0, toF(cols[0], 0), toF(cols[0], 1), toF(cols[0], 2));
      gl.uniform3f(UM.uColor1, toF(cols[1], 0), toF(cols[1], 1), toF(cols[1], 2));
      gl.uniform3f(UM.uColor2, toF(cols[2], 0), toF(cols[2], 1), toF(cols[2], 2));
      gl.uniform3f(UM.uColor3, toF(cols[3], 0), toF(cols[3], 1), toF(cols[3], 2));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Pass 2: blit to canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blitProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(aPosBlit, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, marchTex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      if (marchTex) gl.deleteTexture(marchTex);
      if (marchFbo) gl.deleteFramebuffer(marchFbo);
      gl.deleteBuffer(buf);
      gl.deleteProgram(marchProg);
      gl.deleteProgram(blitProg);
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

export default MetaballCanvas;
