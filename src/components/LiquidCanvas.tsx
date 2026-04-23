import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../types';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

const toEvenSize = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

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
uniform float uSeed;
uniform float uBlend;
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
  // smooth step with adjustable edge hardness
  float b = max(0.0001, uBlend * 0.5);
  f = smoothstep(0.5 - b, 0.5 + b, f);
  
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

  // Pure fluid separation without quantization steps
  // A steeper smoothstep (-0.25 to 0.25) creates the narrow bridge colors
  // and high-contrast boundaries the user requested (like chromatography).
  float colorT = smoothstep(-0.25, 0.25, f);
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

const LiquidCanvas = forwardRef<RendererHandle, RendererProps>(function LiquidCanvas(
  { params, colors, paused, onStatusChange, renderScale = 1, externalTime = null },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<RendererStatus | null>(null);

  useImperativeHandle(ref, () => ({
    get status() {
      return statusRef.current;
    },
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    getCanvas: () => canvasRef.current,
    captureFrame: () => captureCanvasImageData(canvasRef.current),
  }), []);

  // Mutable state for the animation loop
  const state = useRef({
    animTime: 0,
    lastTimestamp: 0,
    params,
    displayParams: cloneParams(params),
    colors,
    paused,
  });

  // Keep ref state synced with props
  useEffect(() => {
    state.current.params = params;
    state.current.paused = paused;
  }, [params, colors, paused]);

  useEffect(() => {
    state.current.colors = colors;
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const gl = (
      canvas.getContext('webgl2', { preserveDrawingBuffer: true })
      || canvas.getContext('webgl', { preserveDrawingBuffer: true })
    ) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) {
      statusRef.current = {
        title: 'Renderer unavailable',
        message: 'This mode needs WebGL support. Try the particle mode or use a browser/device with graphics acceleration enabled.'
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
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U: Record<string, WebGLUniformLocation | null> = {};
    const uniforms = ['uRes','uTime','uScale','uAmplitude','uFrequency','uDefinition','uSeed','uColors','uColorCount','uBlend'];
    uniforms.forEach(n => {
      U[n] = gl.getUniformLocation(prog, n);
    });

    const resize = () => {
      const pixelScale = window.devicePixelRatio * renderScale;
      canvas.width  = toEvenSize(window.innerWidth  * pixelScale);
      canvas.height = toEvenSize(window.innerHeight * pixelScale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;

    const render = (ts: number) => {
      animationFrameId = requestAnimationFrame(render);
      
      const currentState = state.current;
      
      if (externalTime !== null) {
        currentState.animTime = externalTime;
        currentState.lastTimestamp = ts;
      } else if(!currentState.paused){
        const dt = currentState.lastTimestamp === 0 ? 0 : (ts - currentState.lastTimestamp) / 1000;
        currentState.lastTimestamp = ts;
        currentState.animTime += dt * currentState.params.speed;
      } else {
        currentState.lastTimestamp = ts;
      }

      currentState.displayParams = stepSmoothedParams(currentState.displayParams, currentState.params);
      const displayParams = currentState.displayParams;

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime,       currentState.animTime);
      gl.uniform1f(U.uScale,      displayParams.scale);
      gl.uniform1f(U.uAmplitude,  displayParams.amplitude);
      gl.uniform1f(U.uFrequency,  displayParams.frequency);
      gl.uniform1f(U.uDefinition, displayParams.definition);
      gl.uniform1f(U.uSeed,       currentState.params.seed);
      gl.uniform1f(U.uBlend,      displayParams.blend);

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
  }, [externalTime, onStatusChange, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
});

export default LiquidCanvas;
