import { useEffect, useRef } from 'react';
import { GradientParams, ColorRgb } from '../App';

interface LiquidCanvasProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
}

const vsSource = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const fsSource = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uScale;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uDefinition;
uniform float uBands;
uniform float uSeed;
uniform vec3  uColors[8];
uniform int   uColorCount;

// Smooth noise helpers
vec3 hash3(vec3 p){
  p = vec3(dot(p,vec3(127.1,311.7,74.7)),
           dot(p,vec3(269.5,183.3,246.1)),
           dot(p,vec3(113.5,271.9,124.6)));
  return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

float noise(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(dot(hash3(i+vec3(0,0,0)),f-vec3(0,0,0)),
                     dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),
                 mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)),
                     dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
             mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)),
                     dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),
                 mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)),
                     dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);
}

float fbm(vec3 p, int octaves){
  float val = 0.0, amp = 0.5, freq = 1.0;
  for(int i=0;i<12;i++){
    if(i>=octaves) break;
    val += amp * noise(p * freq);
    freq *= 2.0;
    amp  *= 0.5;
  }
  return val;
}

vec3 lerpColor(vec3 a, vec3 b, float t){ return mix(a, b, clamp(t,0.0,1.0)); }

vec3 paletteColor(float t){
  t = clamp(t, 0.0, 1.0);
  float segment = t * float(uColorCount - 1);
  int idx = int(floor(segment));
  float f = fract(segment);
  // clamp index
  vec3 c0 = uColors[0], c1 = uColors[0];
  for(int i=0;i<8;i++){
    if(i==idx)   c0 = uColors[i];
    if(i==idx+1) c1 = uColors[i];
  }
  // smooth step
  f = f*f*(3.0-2.0*f);
  return lerpColor(c0, c1, f);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;

  // domain warp
  vec3 seed3 = vec3(uSeed * 0.001, uSeed * 0.0013, uSeed * 0.0017);
  float t = uTime;
  vec3 p = vec3(uv * uScale, t * 0.1) + seed3;

  float warp = uAmplitude;
  // two layers of domain warp
  vec3 q = vec3(
    fbm(p + vec3(0.0, 0.0, t*0.05), int(uDefinition)),
    fbm(p + vec3(5.2, 1.3, t*0.05), int(uDefinition)),
    fbm(p + vec3(1.7, 9.2, t*0.05), int(uDefinition))
  );
  vec3 r = vec3(
    fbm(p + warp*q + vec3(1.7, 9.2, t*0.08), int(uDefinition)),
    fbm(p + warp*q + vec3(8.3, 2.8, t*0.08), int(uDefinition)),
    fbm(p + warp*q + vec3(2.8, 4.1, t*0.08), int(uDefinition))
  );

  float f = fbm(p * uFrequency + warp*r + vec3(t*0.03), int(uDefinition));

  // Band quantization
  float banded = floor(f * uBands + 0.5) / uBands;
  float blended = mix(f, banded, 0.5);

  // stretch value gracefully, ensuring extreme colors are reached
  float colorT = smoothstep(-0.5, 0.5, blended);
  vec3 col = paletteColor(colorT);

  // subtle vignette
  vec2 vig = uv - 0.5;
  float v = 1.0 - dot(vig, vig) * 0.6;
  col *= v;

  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export default function LiquidCanvas({ params, colors, paused }: LiquidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mutable state for the animation loop
  const state = useRef({
    animTime: 0,
    lastTimestamp: 0,
    params,
    colors,
    paused,
  });

  // Keep ref state synced with props
  useEffect(() => {
    state.current.params = params;
    state.current.colors = colors;
    state.current.paused = paused;
  }, [params, colors, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) return;

    const vShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vShader || !fShader) return;

    const prog = gl.createProgram();
    if (!prog) return;

    gl.attachShader(prog, vShader);
    gl.attachShader(prog, fShader);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U: Record<string, WebGLUniformLocation | null> = {};
    const uniforms = ['uRes','uTime','uScale','uAmplitude','uFrequency','uDefinition','uBands','uSeed','uColors','uColorCount'];
    uniforms.forEach(n => {
      U[n] = gl.getUniformLocation(prog, n);
    });

    const resize = () => {
      canvas.width  = window.innerWidth  * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;

    const render = (ts: number) => {
      animationFrameId = requestAnimationFrame(render);
      
      const currentState = state.current;
      
      if(!currentState.paused){
        const dt = currentState.lastTimestamp === 0 ? 0 : (ts - currentState.lastTimestamp) / 1000;
        currentState.lastTimestamp = ts;
        currentState.animTime += dt * currentState.params.speed;
      } else {
        currentState.lastTimestamp = ts;
      }

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime,       currentState.animTime);
      gl.uniform1f(U.uScale,      currentState.params.scale);
      gl.uniform1f(U.uAmplitude,  currentState.params.amplitude);
      gl.uniform1f(U.uFrequency,  currentState.params.frequency);
      gl.uniform1f(U.uDefinition, currentState.params.definition);
      gl.uniform1f(U.uBands,      currentState.params.bands);
      gl.uniform1f(U.uSeed,       currentState.params.seed);

      const flat: number[] = [];
      currentState.colors.forEach(c => { flat.push(c[0]/255, c[1]/255, c[2]/255); });
      while(flat.length < 24) flat.push(0,0,0);
      
      gl.uniform3fv(U.uColors, new Float32Array(flat));
      gl.uniform1i(U.uColorCount, currentState.colors.length);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} id="c" />;
}
