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
uniform float uSpeed;       // cloud drift velocity
uniform float uCoverage;    // density offset — how much sky is clouded (-0.6 to +0.6)
uniform float uAmplitude;   // FBM amplitude multiplier
uniform float uDefinition;  // raymarch octave budget (2–5)
uniform float uBlend;       // shadow softness
uniform int   uCloudType;   // 0–4 cloud type selector

// Palette-driven color uniforms
uniform vec3  uSkyColor;     // palette[0] — sky + horizon background
uniform vec3  uCloudTint;    // palette[1] — lit cloud surface / top face
uniform vec3  uSunColor;     // palette[2] — diffuse scatter + sun glare
uniform vec3  uShadowColor;  // palette[3] — dark underside / shadowed faces

out vec4 fragColor;

// ── Camera ──────────────────────────────────────────────────────────────────
mat3 setCamera(vec3 ro, vec3 ta, float cr) {
  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(cr), cos(cr), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));
  return mat3(cu, cv, cw);
}

// ── Value noise (procedural, no texture needed) ──────────────────────────────
float hash(float n) { return fract(sin(n) * 43758.5453123); }

float noise3(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + p.z * 113.0;
  return mix(
    mix(mix(hash(n +   0.0), hash(n +   1.0), f.x),
        mix(hash(n +  57.0), hash(n +  58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
    f.z) * 2.0 - 1.0;
}

// ── Cloud drift offset ───────────────────────────────────────────────────────
vec3 cloudOffset() {
  return vec3(0.0, 0.1, 1.0) * iTime * uSpeed;
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
  vec3 q = p - cloudOffset();
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
  float t = 0.05 * dither;

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
  const vec3 sundir = vec3(-0.7071, 0.0, -0.7071);
  float sun = clamp(dot(sundir, rd), 0.0, 1.0);

  // Sky gradient: uSkyColor fades with altitude
  vec3 col = uSkyColor - rd.y * 0.2 * vec3(1.0, 0.5, 1.0) + 0.075;
  col += 0.2 * uSunColor * pow(sun, 8.0);

  // Composite clouds
  vec4 res = raymarch(ro, rd, col, dither);
  col = col * (1.0 - res.w) + res.xyz;

  // Sun glare disk
  col += uSunColor * 0.06 * pow(sun, 3.0);

  // Subtle vignette
  vec2 uv = gl_FragCoord.xy / iResolution;
  vec2 vig = uv - 0.5;
  col *= 1.0 - dot(vig, vig) * 0.35;

  return vec4(col, 1.0);
}

void main() {
  vec2 p = (2.0 * gl_FragCoord.xy - iResolution) / iResolution.y;
  vec2 m = iMouse.xy / max(iResolution, vec2(1.0));

  float mx = (m.x < 0.001 && m.y < 0.001) ? 0.18 : m.x;
  float my = (m.x < 0.001 && m.y < 0.001) ? 0.40 : m.y;

  vec3 ro = 4.0 * normalize(vec3(sin(3.0 * mx), 0.8 * my, cos(3.0 * mx)))
           - vec3(0.0, 0.1, 0.0);
  vec3 ta = vec3(0.0, -1.0, 0.0);
  mat3 ca = setCamera(ro, ta, 0.07 * cos(0.25 * iTime));
  vec3 rd = ca * normalize(vec3(p, 1.5));

  // Per-pixel hash dither for banding reduction
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);

  fragColor = render(ro, rd, dither);
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

    // Compile shaders
    let vert: WebGLShader, frag: WebGLShader, prog: WebGLProgram;
    try {
      vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
      frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      prog = linkProgram(gl, vert, frag);
    } catch (e) {
      statusRef.current = { title: "Shader error", message: String(e) };
      onStatusChange?.(statusRef.current);
      return;
    }

    gl.useProgram(prog);

    // Fullscreen quad
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    const U: Record<string, WebGLUniformLocation | null> = {};
    for (const n of [
      "iResolution", "iTime", "iMouse",
      "uSpeed", "uCoverage", "uAmplitude", "uDefinition", "uBlend", "uCloudType",
      "uSkyColor", "uCloudTint", "uSunColor", "uShadowColor",
    ]) {
      U[n] = gl.getUniformLocation(prog, n);
    }

    // Mouse tracking
    const mouseRef = { x: 0, y: 0 };
    const onMouse = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.x = e.clientX - r.left;
      mouseRef.y = r.height - (e.clientY - r.top);
    };
    canvas.addEventListener("mousemove", onMouse);

    const resize = () => {
      const px = window.devicePixelRatio * renderScale;
      canvas.width  = toEvenSize(window.innerWidth  * px);
      canvas.height = toEvenSize(window.innerHeight * px);
      gl.viewport(0, 0, canvas.width, canvas.height);
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

      gl.useProgram(prog);
      gl.uniform2f(U.iResolution, canvas.width, canvas.height);
      gl.uniform1f(U.iTime, s.animTime);
      gl.uniform4f(U.iMouse, mouseRef.x, mouseRef.y, 0, 0);

      // speed: 0–1 → 0.05–0.6 (slow drift feel)
      gl.uniform1f(U.uSpeed, 0.05 + p.speed * 0.55);

      // coverage: scale 0.01–2 → -0.6 to +0.6 density offset
      gl.uniform1f(U.uCoverage, (p.scale - 1.0) * 0.6);

      // amplitude: 0–2 → 1.2–2.1 FBM multiplier
      gl.uniform1f(U.uAmplitude, 1.2 + p.amplitude * 0.45);

      // definition: 1–12 → 2–5 octave budget for raymarch
      gl.uniform1f(U.uDefinition, 2.0 + (p.definition - 1.0) / 11.0 * 3.0);

      // blend: 0–1 → shadow softness
      gl.uniform1f(U.uBlend, p.blend);

      // cloud type from params
      gl.uniform1i(U.uCloudType, Math.round(Math.max(0, Math.min(4, p.cloudType ?? 0))));

      // Colors — palette[0..3] — fall back gracefully if fewer colors
      const sky    = c[0] ? [c[0][0]/255, c[0][1]/255, c[0][2]/255] : [0.6, 0.71, 0.75];
      const cloud  = c[1] ? [c[1][0]/255, c[1][1]/255, c[1][2]/255] : [1.0, 0.95, 0.88];
      const sun    = c[2] ? [c[2][0]/255, c[2][1]/255, c[2][2]/255] : [1.0, 0.6,  0.3 ];
      const shadow = c[3] ? [c[3][0]/255, c[3][1]/255, c[3][2]/255] : [0.25, 0.3, 0.35];

      gl.uniform3fv(U.uSkyColor,    sky);
      gl.uniform3fv(U.uCloudTint,   cloud);
      gl.uniform3fv(U.uSunColor,    sun);
      gl.uniform3fv(U.uShadowColor, shadow);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouse);
      gl.deleteProgram(prog);
      gl.deleteBuffer(buf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStatusChange, renderScale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
});

CloudsCanvas.displayName = "CloudsCanvas";
export default CloudsCanvas;
