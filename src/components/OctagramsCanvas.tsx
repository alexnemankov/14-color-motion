import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../App';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

const toEvenSize = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

// ── scene shader ────────────────────────────────────────────────────────────

const vsScene = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fsScene = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uSeed;
uniform float uScale;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uDefinition;
uniform float uBlend;
uniform int   uType;
uniform float uAltitude;
uniform float uRepeat;
uniform float uColorCycle;
uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float box(vec3 pos, float sc, float angle) {
  pos *= sc;
  float base = sdBox(pos, vec3(0.4, 0.4, 0.1)) / 1.5;
  pos.xy *= 5.0;
  pos.y -= 3.5;
  pos.xy *= rot(angle);
  return -base;
}

float boxSet(vec3 pos, float gt) {
  vec3 po = pos;
  float phase = gt * 0.4;
  float s = sin(phase);
  float st = 0.0, absSin = 0.0, dyn = 1.5;
  float baseAngle = 0.75;

  if (uType == 3) {
    st = uAmplitude;
    absSin = 0.5;
    dyn = 1.5;
  } else {
    st = s * uAmplitude;
    absSin = abs(s);
    dyn = 2.0 - absSin * 1.5;
  }
  if (uType == 1) { baseAngle = 0.4; dyn *= 1.3; }
  if (uType == 2) { dyn *= 0.7; }

  vec3 p = vec3(0.0);
  p = po; p.y += st;  p.xy *= rot(baseAngle); float b1 = box(p, dyn, 0.75);
  p = po; p.y -= st;  p.xy *= rot(baseAngle); float b2 = box(p, dyn, 0.75);
  p = po; p.x += st;  p.xy *= rot(baseAngle); float b3 = box(p, dyn, 0.75);
  p = po; p.x -= st;  p.xy *= rot(baseAngle); float b4 = box(p, dyn, 0.75);
  p = po;              p.xy *= rot(baseAngle); float b5 = box(p, 0.5, 0.75) * 6.0;
  float b6 = box(po, 0.5, 0.75) * 6.0;
  float result = max(max(max(max(max(b1, b2), b3), b4), b5), b6);

  if (uType == 1) {
    float dia = st * 0.707;
    p = po; p.xy += vec2( dia,  dia); p.xy *= rot(baseAngle); float d1 = box(p, dyn * 0.8, 0.75);
    p = po; p.xy += vec2(-dia,  dia); p.xy *= rot(baseAngle); float d2 = box(p, dyn * 0.8, 0.75);
    p = po; p.xy += vec2( dia, -dia); p.xy *= rot(baseAngle); float d3 = box(p, dyn * 0.8, 0.75);
    p = po; p.xy += vec2(-dia, -dia); p.xy *= rot(baseAngle); float d4 = box(p, dyn * 0.8, 0.75);
    result = max(max(max(max(result, d1), d2), d3), d4);
  }

  return result;
}

void main() {
  vec2 p = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  float t = uTime + uSeed * 0.1;

  vec3 ro = vec3(0.0, uAltitude, t * 4.0);
  vec3 ray = normalize(vec3(p, uScale));
  ray.xy *= rot(sin(t * 0.03 * uFrequency) * 5.0);
  ray.yz *= rot(sin(t * 0.05 * uFrequency) * 0.2);

  float rayT = 0.1;
  float ac = 0.0;
  float stepMult = 0.4 + uDefinition * 0.3;
  float halfR = uRepeat * 0.5;

  for (int i = 0; i < 99; i++) {
    vec3 pos = ro + ray * rayT;
    pos = mod(pos - halfR, uRepeat) - halfR;
    float gt = t - float(i) * 0.01;
    float d = boxSet(pos, gt);
    d = max(abs(d), 0.01);
    ac += exp(-d * 23.0);
    rayT += d * stepMult;
  }

  float glow = clamp(ac * uBlend, 0.0, 1.0);

  vec3 c0 = uColor0;
  vec3 c1 = uColor1;
  vec3 c2 = uColor2;
  vec3 bg = uColor3;

  if (uColorCycle > 0.5) {
    float ph = t * 0.15;
    vec3 x0 = c0, x1 = c1, x2 = c2;
    c0 = mix(x0, x1, 0.5 + 0.5 * sin(ph));
    c1 = mix(x1, x2, 0.5 + 0.5 * sin(ph + 2.094));
    c2 = mix(x2, x0, 0.5 + 0.5 * sin(ph + 4.189));
  }

  vec3 col = mix(bg, mix(c0, mix(c1, c2, glow), glow), glow);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ── blit / accumulation shaders ─────────────────────────────────────────────

const vsBlit = `
attribute vec2 aPos;
varying vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fsAccum = `
precision mediump float;
uniform sampler2D uCurrent;
uniform sampler2D uPrev;
uniform float uAlpha;
varying vec2 vUV;
void main() {
  gl_FragColor = mix(texture2D(uPrev, vUV), texture2D(uCurrent, vUV), uAlpha);
}
`;

const fsBlit = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUV;
void main() { gl_FragColor = texture2D(uTex, vUV); }
`;

// ── WebGL helpers ────────────────────────────────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Octagrams shader error:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

function linkProgram(gl: WebGLRenderingContext, vs: string, fs: string) {
  const v = compileShader(gl, gl.VERTEX_SHADER, vs);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, v);
  gl.attachShader(prog, f);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Octagrams link error:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

function makeFBO(gl: WebGLRenderingContext, w: number, h: number) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { fbo, tex };
}

function deleteFBO(gl: WebGLRenderingContext, f: { fbo: WebGLFramebuffer; tex: WebGLTexture }) {
  gl.deleteFramebuffer(f.fbo);
  gl.deleteTexture(f.tex);
}

// ── component ────────────────────────────────────────────────────────────────

const OctagramsCanvas = forwardRef<RendererHandle, RendererProps>(function OctagramsCanvas(
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
        message: 'Octagrams needs WebGL. Try another mode or enable graphics acceleration.',
      };
      onStatusChange?.(statusRef.current);
      return;
    }
    statusRef.current = null;
    onStatusChange?.(null);

    const sceneProg = linkProgram(gl, vsScene, fsScene);
    const accumProg = linkProgram(gl, vsBlit, fsAccum);
    const blitProg  = linkProgram(gl, vsBlit, fsBlit);
    if (!sceneProg || !accumProg || !blitProg) return;

    const US: Record<string, WebGLUniformLocation | null> = {};
    ['uRes','uTime','uSeed','uScale','uAmplitude','uFrequency','uDefinition','uBlend',
     'uType','uAltitude','uRepeat','uColorCycle',
     'uColor0','uColor1','uColor2','uColor3']
      .forEach(n => { US[n] = gl.getUniformLocation(sceneProg, n); });

    const UA: Record<string, WebGLUniformLocation | null> = {};
    ['uCurrent','uPrev','uAlpha'].forEach(n => { UA[n] = gl.getUniformLocation(accumProg, n); });

    const UB: Record<string, WebGLUniformLocation | null> = {};
    UB.uTex = gl.getUniformLocation(blitProg, 'uTex');

    // Full-screen triangle, shared by all passes
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    function bindQuad(prog: WebGLProgram) {
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
      const loc = gl!.getAttribLocation(prog, 'aPos');
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0);
    }

    // FBO state for temporal accumulation
    let marchFBO = makeFBO(gl, 2, 2);
    let accumFBO  = [makeFBO(gl, 2, 2), makeFBO(gl, 2, 2)];
    let accumIdx  = 0;
    let accumIsFirst = true;

    const resize = () => {
      const dpr = window.devicePixelRatio * renderScale;
      const w = toEvenSize(window.innerWidth  * dpr);
      const h = toEvenSize(window.innerHeight * dpr);
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);

      deleteFBO(gl, marchFBO);
      accumFBO.forEach(f => deleteFBO(gl, f));
      marchFBO = makeFBO(gl, w, h);
      accumFBO = [makeFBO(gl, w, h), makeFBO(gl, w, h)];
      accumIsFirst = true;
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
      const toF  = (c: number[] | undefined, i: number) => (c?.[i] ?? 0) / 255;

      const write = accumIdx;
      const read  = 1 - accumIdx;

      // ── pass 1: render scene to marchFBO ────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, marchFBO.fbo);
      gl.useProgram(sceneProg);
      bindQuad(sceneProg);

      gl.uniform2f(US.uRes,        canvas.width, canvas.height);
      gl.uniform1f(US.uTime,       s.animTime);
      gl.uniform1f(US.uSeed,       dp.seed);
      gl.uniform1f(US.uScale,      0.8 + dp.scale * 1.7);
      gl.uniform1f(US.uAmplitude,  0.5 + dp.amplitude * 3.5);
      gl.uniform1f(US.uFrequency,  0.3 + dp.frequency * 2.7);
      gl.uniform1f(US.uDefinition, (dp.definition - 1) / 11);
      gl.uniform1f(US.uBlend,      0.005 + dp.blend * 0.035);
      gl.uniform1i(US.uType,       Math.round(dp.octagramType ?? 0));
      gl.uniform1f(US.uAltitude,   (dp.octagramAltitude ?? 0.4) * 2.0 - 1.0);
      gl.uniform1f(US.uRepeat,     2.0 + (dp.octagramDensity ?? 0.3) * 6.0);
      gl.uniform1f(US.uColorCycle, (dp.octagramColorCycle ?? false) ? 1.0 : 0.0);
      gl.uniform3f(US.uColor0, toF(cols[0], 0), toF(cols[0], 1), toF(cols[0], 2));
      gl.uniform3f(US.uColor1, toF(cols[1], 0), toF(cols[1], 1), toF(cols[1], 2));
      gl.uniform3f(US.uColor2, toF(cols[2], 0), toF(cols[2], 1), toF(cols[2], 2));
      gl.uniform3f(US.uColor3, toF(cols[3], 0), toF(cols[3], 1), toF(cols[3], 2));
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ── pass 2: blend current frame with accumulated history ─────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, accumFBO[write].fbo);
      gl.useProgram(accumProg);
      bindQuad(accumProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, marchFBO.tex);
      gl.uniform1i(UA.uCurrent, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, accumFBO[read].tex);
      gl.uniform1i(UA.uPrev, 1);

      const trails = dp.octagramTrails ?? false;
      gl.uniform1f(UA.uAlpha, accumIsFirst ? 1.0 : (trails ? 0.12 : 1.0));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      accumIsFirst = false;

      // ── pass 3: blit accumulated result to canvas ────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(blitProg);
      bindQuad(blitProg);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accumFBO[write].tex);
      gl.uniform1i(UB.uTex, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      accumIdx = read;
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      deleteFBO(gl, marchFBO);
      accumFBO.forEach(f => deleteFBO(gl, f));
      gl.deleteBuffer(buf);
      gl.deleteProgram(sceneProg);
      gl.deleteProgram(accumProg);
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

export default OctagramsCanvas;
