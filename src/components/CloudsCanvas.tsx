import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { RendererStatus } from "../App";
import { captureCanvasImageData, RendererHandle, RendererProps } from "./rendererTypes";

// ─────────────────────────────────────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────────────────────────────────────

const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Cloud types:
//  0 = Cumulus      — puffy, flat base (default)
//  1 = Stratus      — thin horizontal sheet
//  2 = Cirrus       — wispy high-altitude streaks
//  3 = Cumulonimbus — massive tall storm tower
//  4 = Mammatus     — bubble pouches below cloud base

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform vec2  iResolution;
uniform float iTime;
uniform vec4  iMouse;

// GradientParams-driven uniforms
uniform vec3  uCloudDrift;  // pre-computed drift vector (JS: vec3(0,0.1,1)*time*speed)
uniform float uCoverage;    // density offset — how much sky is clouded (-0.6 to +0.6)
uniform float uAmplitude;   // FBM amplitude multiplier
uniform float uDefinition;  // raymarch octave budget (2–5)
uniform float uBlend;       // shadow softness
uniform int   uCloudType;   // 0–4 cloud type selector

// Palette-driven color uniforms
uniform vec3      uSkyColor;    // palette[0] — sky + horizon background
uniform vec3      uCloudTint;   // palette[1] — lit cloud surface / top face
uniform vec3      uSunColor;    // palette[2] — diffuse scatter + sun glare
uniform vec3      uShadowColor; // palette[3] — dark underside / shadowed faces

// Blue noise 64×64 tiling texture (REPEAT-wrapped, single channel)
uniform sampler2D uBlueNoise;

out vec4 fragColor;

// ── Camera ──────────────────────────────────────────────────────────────────
mat3 setCamera(vec3 ro, vec3 ta, float cr) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(cr), cos(cr), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

// ── Gradient noise (smoother than value noise, no banding) ───────────────────
vec3 _h3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7,  74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(_h3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                     dot(_h3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(_h3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                     dot(_h3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(_h3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                     dot(_h3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(_h3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                     dot(_h3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}

// ── Cloud type density modifier ──────────────────────────────────────────────
// Returns a clamped density value [0,1] for a given world position p
// and base FBM accumulation f. uCoverage shifts the density threshold.
float cloudDensity(vec3 p, float f) {
  float amp = uAmplitude;  // user-controlled FBM amplitude
  float cov = uCoverage;   // user-controlled coverage

  if (uCloudType == 0) {
    // Cumulus — puffy with flat base
    return clamp(1.5 - p.y - 2.0 + amp * f + cov, 0.0, 1.0);

  } else if (uCloudType == 1) {
    // Stratus — narrow horizontal band (thin flat layer)
    float band = 1.0 - clamp(abs(p.y + 0.5) * 4.0, 0.0, 1.0);
    return clamp((1.5 - 2.0 + amp * f + cov) * band, 0.0, 1.0);

  } else if (uCloudType == 2) {
    // Cirrus — wispy, high altitude. Very sparse density threshold.
    float raw = clamp(1.5 - p.y * 1.5 + 0.8 - 2.0 + amp * f + cov, 0.0, 1.0);
    return raw > 0.003 ? raw * 0.55 : 0.0;

  } else if (uCloudType == 3) {
    // Cumulonimbus — tall storm tower, extended vertical range + stronger FBM
    return clamp(1.5 - p.y * 0.35 - 2.0 + (amp + 0.35) * f + cov, 0.0, 1.0);

  } else {
    // Mammatus — bubble pouches on underside
    return clamp(1.5 - p.y - 2.0 + amp * f + cov - sin(p.x * 4.0) * 0.3, 0.0, 1.0);
  }
}

// ── FBM cloud map ────────────────────────────────────────────────────────────
// uDefinition (1–12 → remapped to 1–5) controls max octave budget for the FBM.
// Each mapN call requests a different count; the actual octaves used are
// min(requested, uMaxOctaves) so quality scales smoothly with the slider.
float mapN(vec3 p, int maxOctaves) {
  vec3 q = p - uCloudDrift;  // drift hoisted to JS uniform — no per-step recalc
  float f = 0.0;
  float weight = 0.5;
  // Hard cap at 5 — loop limit must be a compile-time constant
  for (int i = 0; i < 5; i++) {
    if (i >= maxOctaves) break;
    f += weight * noise3(q);
    q *= 2.02;
    weight *= 0.5;
  }
  return cloudDensity(p, f);
}

// Quality tier driven by uDefinition: maps 1–12 → 1–5 octaves
int qualityOctaves(int tier) {
  // uDefinition 1–12 → octave budget 1–5
  int budget = int(clamp(1.0 + (uDefinition - 1.0) / 11.0 * 4.0, 1.0, 5.0));
  return min(tier, budget);
}

float map5(vec3 p) { return mapN(p, qualityOctaves(5)); }
float map4(vec3 p) { return mapN(p, qualityOctaves(4)); }
float map3(vec3 p) { return mapN(p, qualityOctaves(3)); }
float map2(vec3 p) { return mapN(p, qualityOctaves(2)); }

// ── Per-step compositing ─────────────────────────────────────────────────────
vec4 marchStep(vec3 pos, vec3 bgcol, float t, float den, float denShadow) {
  const vec3 sundir = vec3(-0.7071, 0.0, -0.7071);

  // Shadow softness controlled by uBlend (0–1)
  float shadowSoftness = max(0.3, uBlend * 0.8);
  float dif = clamp((den - denShadow) / shadowSoftness, 0.0, 1.0);

  // Lit surface blends between shadow and cloud tint, scaled by sun
  vec3 lin = uSunColor * dif + vec3(0.88, 0.96, 1.05);
  vec4 col = vec4(mix(uCloudTint, uShadowColor, clamp(den * 1.2, 0.0, 1.0)), den);
  col.xyz *= lin;

  // Depth fog
  col.xyz = mix(col.xyz, bgcol, 1.0 - exp(-0.003 * t * t));
  col.w   *= 0.4;
  col.rgb *= col.a;
  return col;
}

// ── Progressive raymarch ─────────────────────────────────────────────────────
// Four passes always sample — octave quality degrades with distance for perf.
// uDefinition controls FBM detail via qualityOctaves(); t always advances.
vec4 raymarch(vec3 ro, vec3 rd, vec3 bgcol, float dither) {
  const vec3 sundir = vec3(-0.7071, 0.0, -0.7071);
  vec4 sum = vec4(0.0);

  // ── AABB slab early-out ───────────────────────────────────────────────────
  // Intersect the ray with the horizontal cloud slab y ∈ [-3, 2].
  // If rd.y ≈ 0 (ray nearly horizontal) avoid divide-by-zero with a tiny epsilon.
  float tMin, tMax;
  if (abs(rd.y) > 1e-4) {
    float t0 = ( 2.0 - ro.y) / rd.y;   // intersection with y = +2 (slab top)
    float t1 = (-3.0 - ro.y) / rd.y;   // intersection with y = -3 (slab bottom)
    tMin = max(0.0, min(t0, t1));
    tMax =         max(t0, t1);
  } else {
    // Ray is horizontal — check if camera is inside the slab
    tMin = (ro.y >= -3.0 && ro.y <= 2.0) ? 0.0 : 1e9;
    tMax = 1e9;
  }

  // Ray misses the slab entirely — return empty
  if (tMin > tMax || tMax < 0.0) return sum;

  // Start at slab entry + small dither jitter (skips all empty air above)
  float t = tMin + 0.02 * dither;

  // Pass 1 — high-detail near range (40 steps)
  for (int i = 0; i < 40; i++) {
    vec3 pos = ro + t * rd;
    if (pos.y < -3.0 || pos.y > 2.0 || sum.a > 0.99) break;
    float den = map5(pos);
    if (den > 0.01) {
      sum += marchStep(pos, bgcol, t, den, map5(pos + 0.3 * sundir)) * (1.0 - sum.a);
    }
    t += max(0.06, 0.05 * t);
  }

  // Pass 2 — medium detail (40 steps)
  for (int i = 0; i < 40; i++) {
    vec3 pos = ro + t * rd;
    if (pos.y < -3.0 || pos.y > 2.0 || sum.a > 0.99) break;
    float den = map4(pos);
    if (den > 0.01) {
      sum += marchStep(pos, bgcol, t, den, map4(pos + 0.3 * sundir)) * (1.0 - sum.a);
    }
    t += max(0.06, 0.05 * t);
  }

  // Pass 3 — reduced detail (30 steps)
  for (int i = 0; i < 30; i++) {
    vec3 pos = ro + t * rd;
    if (pos.y < -3.0 || pos.y > 2.0 || sum.a > 0.99) break;
    float den = map3(pos);
    if (den > 0.01) {
      sum += marchStep(pos, bgcol, t, den, map3(pos + 0.3 * sundir)) * (1.0 - sum.a);
    }
    t += max(0.06, 0.05 * t);
  }

  // Pass 4 — coarse far range (30 steps)
  for (int i = 0; i < 30; i++) {
    vec3 pos = ro + t * rd;
    if (pos.y < -3.0 || pos.y > 2.0 || sum.a > 0.99) break;
    float den = map2(pos);
    if (den > 0.01) {
      sum += marchStep(pos, bgcol, t, den, map2(pos + 0.3 * sundir)) * (1.0 - sum.a);
    }
    t += max(0.06, 0.05 * t);
  }

  return clamp(sum, 0.0, 1.0);
}

// ── Final composite ──────────────────────────────────────────────────────────
vec4 render(vec3 ro, vec3 rd, float dither) {
  // Sun slightly above horizon, left-forward so it's visible in default view
  const vec3 sundir = normalize(vec3(-0.5, 0.28, -0.82));
  float sun = clamp(dot(sundir, rd), 0.0, 1.0);

  // Sky gradient: uSkyColor fades with altitude
  vec3 col = uSkyColor - rd.y * 0.2 * vec3(1.0, 0.5, 1.0) + 0.075;

  // Wide atmospheric scatter
  col += uSunColor * 0.18 * pow(sun, 4.0);

  // Composite clouds
  vec4 res = raymarch(ro, rd, col, dither);
  col = col * (1.0 - res.w) + res.xyz;

  // Sun corona (medium glow visible through thin cloud edges)
  col += uSunColor * 0.55 * pow(sun, 22.0);
  // Sun disk (bright tight point)
  col += vec3(1.0) * pow(sun, 800.0) * 2.5;

  // Subtle vignette
  vec2 uv = gl_FragCoord.xy / iResolution;
  vec2 vig = uv - 0.5;
  col *= 1.0 - dot(vig, vig) * 0.35;

  return vec4(col, 1.0);
}

void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - iResolution) / iResolution.y;
  vec2 m = iMouse.xy / max(iResolution, vec2(1.0));  // always 0–1 from orbitRef

  vec3 ro = 4.0 * normalize(vec3(sin(3.0 * m.x), 0.8 * m.y, cos(3.0 * m.x)))
           - vec3(0.0, 0.1, 0.0);
  vec3 ta = vec3(0.0, -1.0, 0.0);
  mat3 ca = setCamera(ro, ta, 0.07 * cos(0.25 * iTime));
  vec3 rd = ca * normalize(vec3(p, 1.5));

  // Blue noise dither sampled from a precomputed tiling texture (REPEAT wrap)
  float dither = texture(uBlueNoise, gl_FragCoord.xy / 64.0).r;

  fragColor = render(ro, rd, dither);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Blit (upscale) shaders — draws the half-res FBO texture to the full canvas
// ─────────────────────────────────────────────────────────────────────────────

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
  // Bilinear filtering is provided automatically by LINEAR texture minification
  fragColor = texture(uTex, gl_FragCoord.xy / uResolution);
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// WebGL helpers
// ─────────────────────────────────────────────────────────────────────────────

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile:\n${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vert: WebGLShader,
  frag: WebGLShader,
): WebGLProgram {
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link:\n${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

/**
 * 64×64 single-channel blue noise texture using Interleaved Gradient Noise.
 * IGN has excellent low-frequency spectral properties — far less perceptible
 * grain than white noise, no structured banding of ordered Bayer matrices.
 * REPEAT-wrapped so it tiles seamlessly over any resolution.
 */
function createBlueNoiseTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const SIZE = 64;
  const data = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Interleaved Gradient Noise (Jimenez 2014 / Destiny 2)
      const v = (52.9829189 * (((0.06711056 * x + 0.00583715 * y) % 1.0 + 1.0) % 1.0)) % 1.0;
      data[y * SIZE + x] = Math.floor(v * 255.99);
    }
  }
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, SIZE, SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

/** Create or resize the half-resolution FBO used for the raymarch pass. */
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const toEvenSize = (v: number) => Math.max(2, Math.floor(v / 2) * 2);

const CloudsCanvas = forwardRef<RendererHandle, RendererProps>(function CloudsCanvas(
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

  // Mutable render state — avoids re-creating the GL loop on every prop change
  const state = useRef({
    animTime: 0,
    lastTimestamp: 0,
    params,
    colors,
    paused,
    externalTime,
  });

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
        message: "Clouds mode needs WebGL2. Try another mode or update your browser.",
      };
      onStatusChange?.(statusRef.current);
      return;
    }
    statusRef.current = null;
    onStatusChange?.(null);

    // ── Compile both programs ────────────────────────────────────────────────
    let marchProg: WebGLProgram, blitProg: WebGLProgram;
    try {
      marchProg = linkProgram(gl,
        compileShader(gl, gl.VERTEX_SHADER,   VERT_SRC),
        compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC),
      );
      blitProg = linkProgram(gl,
        compileShader(gl, gl.VERTEX_SHADER,   BLIT_VERT),
        compileShader(gl, gl.FRAGMENT_SHADER, BLIT_FRAG),
      );
    } catch (e) {
      statusRef.current = { title: "Shader error", message: String(e) };
      onStatusChange?.(statusRef.current);
      return;
    }

    // ── Shared fullscreen-quad buffer ────────────────────────────────────────
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    // Bind the quad to the march program's a_pos
    gl.useProgram(marchProg);
    const marchLoc = gl.getAttribLocation(marchProg, "a_pos");
    gl.enableVertexAttribArray(marchLoc);
    gl.vertexAttribPointer(marchLoc, 2, gl.FLOAT, false, 0, 0);

    // ── Cache march uniforms ─────────────────────────────────────────────────
    const M: Record<string, WebGLUniformLocation | null> = {};
    for (const n of [
      "iResolution", "iTime", "iMouse",
      "uCloudDrift", "uCoverage", "uAmplitude", "uDefinition", "uBlend", "uCloudType",
      "uSkyColor", "uCloudTint", "uSunColor", "uShadowColor", "uBlueNoise",
    ]) M[n] = gl.getUniformLocation(marchProg, n);

    // ── Cache blit uniforms ──────────────────────────────────────────────────
    const B: Record<string, WebGLUniformLocation | null> = {};
    for (const n of ["uTex", "uResolution"])
      B[n] = gl.getUniformLocation(blitProg, n);

    // ── Textures ─────────────────────────────────────────────────────────────
    const blueNoiseTex = createBlueNoiseTexture(gl);

    // FBO color texture — resized alongside canvas
    const fboTex = gl.createTexture()!;
    const fbo    = gl.createFramebuffer()!;
    let fboW = 2, fboH = 2;   // will be updated in resize()

    // ── Drag-to-orbit ────────────────────────────────────────────────────────
    const orbitRef = { x: 0.18, y: 0.40 };
    let isDragging = false;
    let dragStartClient = { x: 0, y: 0 };
    let orbitAtDragStart = { x: 0.18, y: 0.40 };

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
    window.addEventListener("mouseup",   onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);

    // ── Resize ───────────────────────────────────────────────────────────────
    const resize = () => {
      const px = window.devicePixelRatio * renderScale;
      canvas.width  = toEvenSize(window.innerWidth  * px);
      canvas.height = toEvenSize(window.innerHeight * px);
      // Half-res FBO — raymarch at 50%, bilinear blit to full canvas (~4x speedup)
      fboW = Math.max(2, Math.floor(canvas.width  / 2));
      fboH = Math.max(2, Math.floor(canvas.height / 2));
      resizeFBO(gl, fbo, fboTex, fboW, fboH);
    };
    window.addEventListener("resize", resize);
    resize();

    let rafId: number;

    const render = (ts: number) => {
      rafId = requestAnimationFrame(render);
      const s = state.current;

      if (s.externalTime !== null) {
        s.animTime = s.externalTime;
        s.lastTimestamp = ts;
      } else if (!s.paused) {
        const dt = s.lastTimestamp === 0 ? 0 : (ts - s.lastTimestamp) / 1000;
        s.lastTimestamp = ts;
        s.animTime += dt;
      } else {
        s.lastTimestamp = ts;
      }

      const p = s.params;
      const c = s.colors;

      // ── Pass 1: Raymarch → half-res FBO ─────────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fboW, fboH);
      gl.useProgram(marchProg);

      gl.uniform2f(M.iResolution, fboW, fboH);
      gl.uniform1f(M.iTime, s.animTime);
      // Orbit passed as FBO-pixel coords; shader divides by iResolution → 0–1
      gl.uniform4f(M.iMouse, orbitRef.x * fboW, orbitRef.y * fboH, 0, 0);

      const driftSpeed = 0.05 + p.speed * 0.55;
      const drift = s.animTime * driftSpeed;
      gl.uniform3f(M.uCloudDrift, 0.0, 0.1 * drift, 1.0 * drift);

      gl.uniform1f(M.uCoverage,   (p.scale - 1.0) * 0.6);
      gl.uniform1f(M.uAmplitude,  1.2 + p.amplitude * 0.45);
      gl.uniform1f(M.uDefinition, 2.0 + (p.definition - 1.0) / 11.0 * 3.0);
      gl.uniform1f(M.uBlend,      p.blend);
      gl.uniform1i(M.uCloudType,  Math.round(Math.max(0, Math.min(4, p.cloudType ?? 0))));

      const sky    = c[0] ? [c[0][0]/255, c[0][1]/255, c[0][2]/255] : [0.6, 0.71, 0.75];
      const cloud  = c[1] ? [c[1][0]/255, c[1][1]/255, c[1][2]/255] : [1.0, 0.95, 0.88];
      const sun    = c[2] ? [c[2][0]/255, c[2][1]/255, c[2][2]/255] : [1.0, 0.6,  0.3 ];
      const shadow = c[3] ? [c[3][0]/255, c[3][1]/255, c[3][2]/255] : [0.25, 0.3, 0.35];
      gl.uniform3fv(M.uSkyColor,    sky);
      gl.uniform3fv(M.uCloudTint,   cloud);
      gl.uniform3fv(M.uSunColor,    sun);
      gl.uniform3fv(M.uShadowColor, shadow);

      // Texture unit 0 — blue noise
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, blueNoiseTex);
      gl.uniform1i(M.uBlueNoise, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 2: Bilinear blit → full canvas ─────────────────────────────
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blitProg);

      // Texture unit 1 — FBO result
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fboTex);
      gl.uniform1i(B.uTex, 1);
      gl.uniform2f(B.uResolution, canvas.width, canvas.height);

      // Re-bind the shared quad to the blit program's a_pos
      const blitLoc = gl.getAttribLocation(blitProg, "a_pos");
      gl.enableVertexAttribArray(blitLoc);
      gl.vertexAttribPointer(blitLoc, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup",   onMouseUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      gl.deleteProgram(marchProg);
      gl.deleteProgram(blitProg);
      gl.deleteBuffer(buf);
      gl.deleteTexture(blueNoiseTex);
      gl.deleteTexture(fboTex);
      gl.deleteFramebuffer(fbo);
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

CloudsCanvas.displayName = "CloudsCanvas";
export default CloudsCanvas;
