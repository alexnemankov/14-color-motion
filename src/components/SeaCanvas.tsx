import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { RendererStatus } from '../types';
import { captureCanvasImageData, RendererHandle, RendererProps } from "./rendererTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  iResolution;
uniform float iTime;
uniform vec4  iMouse;

// GradientParams-driven uniforms
uniform float uSeaHeight;  // wave amplitude
uniform float uSeaChoppy;  // wave choppiness
uniform float uSeaFreq;    // base frequency
uniform float uSeaSpeed;   // animation speed
uniform int   uIterDetail; // fragment octave count (3–7)
uniform float uCameraY;    // camera altitude (from scale param)
uniform vec2  uSeedOffset; // world-space XZ start position (from seed param)

// Palette-driven color uniforms
uniform vec3 uSeaBase;    // palette[0] — deep water color
uniform vec3 uWaterColor; // palette[1] — surface / foam tint
uniform vec3 uSkyTop;     // palette[2] — sky zenith
uniform vec3 uSunColor;   // palette[3] — sun / horizon glow

out vec4 fragColor;

const int   NUM_STEPS     = 32;
const float PI            = 3.141592;
const float EPSILON       = 1e-3;
const int   ITER_GEOMETRY = 3;
const mat2  octave_m      = mat2(1.6, 1.2, -1.2, 1.6);

// ── Math helpers ─────────────────────────────────────────────────────────────
mat3 fromEuler(vec3 ang) {
  vec2 a1 = vec2(sin(ang.x), cos(ang.x));
  vec2 a2 = vec2(sin(ang.y), cos(ang.y));
  vec2 a3 = vec2(sin(ang.z), cos(ang.z));
  mat3 m;
  m[0] = vec3(a1.y*a3.y + a1.x*a2.x*a3.x, a1.y*a2.x*a3.x + a3.y*a1.x, -a2.y*a3.x);
  m[1] = vec3(-a2.y*a1.x, a1.y*a2.y, a2.x);
  m[2] = vec3(a3.y*a1.x*a2.x + a1.y*a3.x, a1.x*a3.x - a1.y*a3.y*a2.x, a2.y*a3.y);
  return m;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(in vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return -1.0 + 2.0 * mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y);
}

// ── Lighting ─────────────────────────────────────────────────────────────────
float diffuse(vec3 n, vec3 l, float p) {
  return pow(dot(n, l) * 0.4 + 0.6, p);
}

float specular(vec3 n, vec3 l, vec3 e, float s) {
  float nrm = (s + 8.0) / (PI * 8.0);
  return pow(max(dot(reflect(e, n), l), 0.0), s) * nrm;
}

// ── Sky ──────────────────────────────────────────────────────────────────────
vec3 getSkyColor(vec3 e) {
  e.y = (max(e.y, 0.0) * 0.8 + 0.2) * 0.8;
  float t = 1.0 - e.y;          // 0 = zenith, 1 = horizon
  return mix(uSkyTop, uSunColor, t * t) * 1.1;
}

// ── Wave octave ──────────────────────────────────────────────────────────────
float sea_octave(vec2 uv, float choppy) {
  uv += noise(uv);
  vec2 wv  = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

// ── Height map — fast (geometry) ─────────────────────────────────────────────
float map(vec3 p, float seaTime) {
  float freq   = uSeaFreq;
  float amp    = uSeaHeight;
  float choppy = uSeaChoppy;
  vec2  uv     = p.xz; uv.x *= 0.75;
  float h = 0.0;
  for (int i = 0; i < ITER_GEOMETRY; i++) {
    float d  = sea_octave((uv + seaTime) * freq, choppy);
    d       += sea_octave((uv - seaTime) * freq, choppy);
    h       += d * amp;
    uv      *= octave_m; freq *= 1.9; amp *= 0.22;
    choppy   = mix(choppy, 1.0, 0.2);
  }
  return p.y - h;
}

// ── Height map — detailed (fragment shading) ─────────────────────────────────
float map_detailed(vec3 p, float seaTime) {
  float freq   = uSeaFreq;
  float amp    = uSeaHeight;
  float choppy = uSeaChoppy;
  vec2  uv     = p.xz; uv.x *= 0.75;
  float h = 0.0;
  // Hard cap at 7 — break early based on uIterDetail
  for (int i = 0; i < 7; i++) {
    if (i >= uIterDetail) break;
    float d  = sea_octave((uv + seaTime) * freq, choppy);
    d       += sea_octave((uv - seaTime) * freq, choppy);
    h       += d * amp;
    uv      *= octave_m; freq *= 1.9; amp *= 0.22;
    choppy   = mix(choppy, 1.0, 0.2);
  }
  return p.y - h;
}

// ── Sea shading ──────────────────────────────────────────────────────────────
vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {
  float fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
  fresnel = min(fresnel * fresnel * fresnel, 0.5);

  vec3 reflected = getSkyColor(reflect(eye, n));
  vec3 refracted = uSeaBase + diffuse(n, l, 80.0) * uWaterColor * 0.12;

  vec3 color = mix(refracted, reflected, fresnel);

  float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
  color += uWaterColor * (p.y - uSeaHeight * 0.5) * 0.18 * atten;

  color += specular(n, l, eye, 600.0 * inversesqrt(dot(dist, dist)));

  return color;
}

// ── Normal from height map ───────────────────────────────────────────────────
vec3 getNormal(vec3 p, float eps, float seaTime) {
  vec3 n;
  n.y = map_detailed(p, seaTime);
  n.x = map_detailed(vec3(p.x + eps, p.y, p.z), seaTime) - n.y;
  n.z = map_detailed(vec3(p.x, p.y, p.z + eps), seaTime) - n.y;
  n.y = eps;
  return normalize(n);
}

// ── Height-field tracing ─────────────────────────────────────────────────────
float heightMapTracing(vec3 ori, vec3 dir, out vec3 p, float seaTime) {
  float tm = 0.0;
  float tx = 1000.0;
  float hx = map(ori + dir * tx, seaTime);
  if (hx > 0.0) { p = ori + dir * tx; return tx; }
  float hm = map(ori, seaTime);
  for (int i = 0; i < NUM_STEPS; i++) {
    float tmid = mix(tm, tx, hm / (hm - hx));
    p = ori + dir * tmid;
    float hmid = map(p, seaTime);
    if (hmid < 0.0) { tx = tmid; hx = hmid; }
    else            { tm = tmid; hm = hmid; }
    if (abs(hmid) < EPSILON) break;
  }
  return mix(tm, tx, hm / (hm - hx));
}

// ── Main ─────────────────────────────────────────────────────────────────────
void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 m = iMouse.xy / max(iResolution, vec2(1.0));  // 0–1 from orbitRef

  float seaTime = 1.0 + iTime * uSeaSpeed;

  vec2 uv = fragCoord / iResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y;

  // ang.z = heading (left/right): forward = (sin(z), 0, cos(z))
  // ang.y = elevation (up/down): positive values tilt camera downward
  float heading   = (m.x - 0.5) * 2.5;
  float elevation = 0.3 - (m.y - 0.5) * 0.8;  // default 0.3; drag up → smaller → look up
  vec3 ang = vec3(0.0, elevation, heading);
  float safeY = max(uCameraY, uSeaHeight * 3.5 + 0.5);
  vec3 ori = vec3(uSeedOffset.x, safeY, uSeedOffset.y + iTime * uSeaSpeed * 5.0);
  vec3 dir = normalize(vec3(uv.xy, -2.0));
  dir.z += length(uv) * 0.14;
  dir = normalize(dir) * fromEuler(ang);

  vec3 p;
  heightMapTracing(ori, dir, p, seaTime);
  vec3 dist = p - ori;
  float eps = dot(dist, dist) * (0.1 / iResolution.x);
  vec3 n   = getNormal(p, eps, seaTime);
  vec3 light = normalize(vec3(0.0, 1.0, 0.8));

  vec3 color = mix(
    getSkyColor(dir),
    getSeaColor(p, n, light, dir, dist),
    pow(smoothstep(0.0, -0.02, dir.y), 0.2)
  );

  // Subtle vignette
  vec2 vig = fragCoord / iResolution - 0.5;
  color *= 1.0 - dot(vig, vig) * 0.3;

  fragColor = vec4(pow(color, vec3(0.65)), 1.0);
}
`;

const BLIT_VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const BLIT_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D uTex;
uniform vec2      uResolution;
out vec4 fragColor;
void main() {
  fragColor = texture(uTex, gl_FragCoord.xy / uResolution);
}
`;

const ACCUM_FRAG = /* glsl */ `#version 300 es
precision mediump float;
uniform sampler2D uCurrent;
uniform sampler2D uHistory;
uniform vec2      uResolution;
uniform float     uAlpha;
out vec4 fragColor;
void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  fragColor = mix(texture(uHistory, uv), texture(uCurrent, uv), uAlpha);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// WebGL helpers
// ─────────────────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(`Shader compile:\n${gl.getShaderInfoLog(s)}`);
  return s;
}

function linkProgram(gl: WebGL2RenderingContext, vert: WebGLShader, frag: WebGLShader): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(`Program link:\n${gl.getProgramInfoLog(prog)}`);
  return prog;
}

function resizeFBO(
  gl: WebGL2RenderingContext,
  fbo: WebGLFramebuffer,
  tex: WebGLTexture,
  w: number,
  h: number,
) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

const toEvenSize = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const SeaCanvas = forwardRef<RendererHandle, RendererProps>(function SeaCanvas(
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

  const state = useRef({ animTime: 0, lastTimestamp: 0, params, colors, paused, externalTime });

  useEffect(() => { state.current.params = params; }, [params]);
  useEffect(() => { state.current.colors = colors; }, [colors]);
  useEffect(() => { state.current.paused = paused; }, [paused]);
  useEffect(() => { state.current.externalTime = externalTime; }, [externalTime]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!gl) {
      statusRef.current = {
        title: "Renderer unavailable",
        message: "Sea mode needs WebGL2. Try another mode or update your browser.",
      };
      onStatusChange?.(statusRef.current);
      return;
    }
    statusRef.current = null;
    onStatusChange?.(null);

    let marchProg: WebGLProgram, accumProg: WebGLProgram, blitProg: WebGLProgram;
    try {
      marchProg = linkProgram(gl,
        compileShader(gl, gl.VERTEX_SHADER, VERT_SRC),
        compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC),
      );
      accumProg = linkProgram(gl,
        compileShader(gl, gl.VERTEX_SHADER, VERT_SRC),
        compileShader(gl, gl.FRAGMENT_SHADER, ACCUM_FRAG),
      );
      blitProg = linkProgram(gl,
        compileShader(gl, gl.VERTEX_SHADER, BLIT_VERT),
        compileShader(gl, gl.FRAGMENT_SHADER, BLIT_FRAG),
      );
    } catch (e) {
      statusRef.current = { title: "Shader error", message: String(e) };
      onStatusChange?.(statusRef.current);
      return;
    }

    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const M: Record<string, WebGLUniformLocation | null> = {};
    for (const n of [
      "iResolution", "iTime", "iMouse",
      "uSeaHeight", "uSeaChoppy", "uSeaFreq", "uSeaSpeed", "uIterDetail",
      "uCameraY", "uSeedOffset",
      "uSeaBase", "uWaterColor", "uSkyTop", "uSunColor",
    ]) M[n] = gl.getUniformLocation(marchProg, n);

    const A: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ["uCurrent", "uHistory", "uResolution", "uAlpha"])
      A[n] = gl.getUniformLocation(accumProg, n);

    const B: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ["uTex", "uResolution"])
      B[n] = gl.getUniformLocation(blitProg, n);

    const marchTex = gl.createTexture()!;
    const marchFbo = gl.createFramebuffer()!;
    const accumTex = [gl.createTexture()!, gl.createTexture()!];
    const accumFbo = [gl.createFramebuffer()!, gl.createFramebuffer()!];

    let fboW = 2, fboH = 2;
    let pingIdx = 0;
    let needsReset = true;

    // ── Drag-to-orbit ─────────────────────────────────────────────────────────
    const orbitRef = { x: 0.5, y: 0.5 };
    let isDragging = false;
    let dragStartClient = { x: 0, y: 0 };
    let orbitAtDragStart = { x: 0.5, y: 0.5 };
    let prevOrbitX = orbitRef.x, prevOrbitY = orbitRef.y;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragStartClient = { x: e.clientX, y: e.clientY };
      orbitAtDragStart = { ...orbitRef };
      canvas.style.cursor = "grabbing";
    };
    const onMouseUp = () => { isDragging = false; canvas.style.cursor = "grab"; };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const r = canvas.getBoundingClientRect();
      const dx =  (e.clientX - dragStartClient.x) / r.width;
      const dy = -(e.clientY - dragStartClient.y) / r.height;
      orbitRef.x = Math.max(0.001, Math.min(0.999, orbitAtDragStart.x + dx));
      orbitRef.y = Math.max(0.001, Math.min(0.999, orbitAtDragStart.y + dy));
    };
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);

    // ── Resize ────────────────────────────────────────────────────────────────
    const resize = () => {
      const px = window.devicePixelRatio * renderScale;
      canvas.width  = toEvenSize(window.innerWidth  * px);
      canvas.height = toEvenSize(window.innerHeight * px);
      fboW = Math.max(2, Math.floor(canvas.width  / 2));
      fboH = Math.max(2, Math.floor(canvas.height / 2));
      resizeFBO(gl, marchFbo, marchTex, fboW, fboH);
      resizeFBO(gl, accumFbo[0], accumTex[0], fboW, fboH);
      resizeFBO(gl, accumFbo[1], accumTex[1], fboW, fboH);
      needsReset = true;
    };
    window.addEventListener("resize", resize);
    resize();

    let rafId: number;

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      const s = state.current;

      const rawDt = s.lastTimestamp === 0 ? 0 : Math.min((ts - s.lastTimestamp) / 1000, 0.1);

      if (s.externalTime !== null) {
        s.animTime = s.externalTime;
        s.lastTimestamp = ts;
      } else if (!s.paused) {
        s.lastTimestamp = ts;
        s.animTime += rawDt;
      } else {
        s.lastTimestamp = ts;
      }

      const p = s.params;
      const c = s.colors;

      const isMoving = orbitRef.x !== prevOrbitX || orbitRef.y !== prevOrbitY;
      prevOrbitX = orbitRef.x;
      prevOrbitY = orbitRef.y;
      // Waves are always in motion — use a moderate history weight even when static
      const alpha = needsReset ? 1.0 : (isMoving ? 0.9 : 0.5);
      needsReset = false;

      const currIdx = pingIdx;
      const prevIdx = 1 - pingIdx;

      // ── Pass 1: March → marchFbo ────────────────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, marchFbo);
      gl.viewport(0, 0, fboW, fboH);
      gl.useProgram(marchProg);

      const marchLoc = gl.getAttribLocation(marchProg, "a_pos");
      gl.enableVertexAttribArray(marchLoc);
      gl.vertexAttribPointer(marchLoc, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(M.iResolution, fboW, fboH);
      gl.uniform1f(M.iTime, s.animTime);
      gl.uniform4f(M.iMouse, orbitRef.x * fboW, orbitRef.y * fboH, 0, 0);

      gl.uniform1f(M.uSeaHeight, 0.2 + p.amplitude * 0.22);
      gl.uniform1f(M.uSeaChoppy, 1.0 + p.blend * 5.0);
      gl.uniform1f(M.uSeaFreq,   0.08 + p.frequency * 0.12);
      gl.uniform1f(M.uSeaSpeed,  0.2 + p.speed * 0.8);
      gl.uniform1i(M.uIterDetail, 3 + Math.min(4, Math.floor(p.definition / 3)));
      gl.uniform1f(M.uCameraY,   1.5 + p.scale * 2.5);
      const sa = p.seed * 0.73137;
      gl.uniform2f(M.uSeedOffset, Math.sin(sa) * 50.0, Math.cos(sa) * 50.0);

      const seaBase  = c[0] ? [c[0][0]/255, c[0][1]/255, c[0][2]/255] : [0.0, 0.09, 0.18];
      const water    = c[1] ? [c[1][0]/255, c[1][1]/255, c[1][2]/255] : [0.48, 0.54, 0.36];
      const skyTop   = c[2] ? [c[2][0]/255, c[2][1]/255, c[2][2]/255] : [0.39, 0.66, 0.82];
      const sunColor = c[3] ? [c[3][0]/255, c[3][1]/255, c[3][2]/255] : [1.0,  0.76, 0.39];

      gl.uniform3fv(M.uSeaBase,    seaBase);
      gl.uniform3fv(M.uWaterColor, water);
      gl.uniform3fv(M.uSkyTop,     skyTop);
      gl.uniform3fv(M.uSunColor,   sunColor);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 2: Temporal accumulation ───────────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, accumFbo[currIdx]);
      gl.viewport(0, 0, fboW, fboH);
      gl.useProgram(accumProg);

      const accumLoc = gl.getAttribLocation(accumProg, "a_pos");
      gl.enableVertexAttribArray(accumLoc);
      gl.vertexAttribPointer(accumLoc, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, marchTex);
      gl.uniform1i(A.uCurrent, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, accumTex[prevIdx]);
      gl.uniform1i(A.uHistory, 1);

      gl.uniform2f(A.uResolution, fboW, fboH);
      gl.uniform1f(A.uAlpha, alpha);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 3: Blit → canvas ────────────────────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blitProg);

      const blitLoc = gl.getAttribLocation(blitProg, "a_pos");
      gl.enableVertexAttribArray(blitLoc);
      gl.vertexAttribPointer(blitLoc, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accumTex[currIdx]);
      gl.uniform1i(B.uTex, 0);
      gl.uniform2f(B.uResolution, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      pingIdx = 1 - pingIdx;
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      gl.deleteProgram(marchProg);
      gl.deleteProgram(accumProg);
      gl.deleteProgram(blitProg);
      gl.deleteBuffer(buf);
      gl.deleteTexture(marchTex);
      gl.deleteTexture(accumTex[0]);
      gl.deleteTexture(accumTex[1]);
      gl.deleteFramebuffer(marchFbo);
      gl.deleteFramebuffer(accumFbo[0]);
      gl.deleteFramebuffer(accumFbo[1]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStatusChange, renderScale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
    />
  );
});

SeaCanvas.displayName = "SeaCanvas";
export default SeaCanvas;
