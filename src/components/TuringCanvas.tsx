import { useEffect, useRef } from 'react';
import { GradientParams, ColorRgb, RendererStatus } from '../App';
import { cloneParams, stepSmoothedParams } from './rendererMotion';

interface CanvasProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
  onStatusChange?: (status: RendererStatus | null) => void;
  renderScale?: number;
}

const toEvenSize = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

const vsSource = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ 
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0); 
}
`;

// Simulates Gray-Scott Reaction-Diffusion
const simFsSource = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uFeed;
uniform float uKill;
uniform float uDa;
uniform float uDb;
uniform float uSeed;

varying vec2 vUv;

void main() {
    vec2 p = 1.0 / uRes;
    
    vec2 state = texture2D(uTex, vUv).rg;
    float A = state.r;
    float B = state.g;
    
    vec2 lapl = 
      texture2D(uTex, vUv + vec2(-p.x, -p.y)).rg * 0.05 +
      texture2D(uTex, vUv + vec2(0.0,  -p.y)).rg * 0.20 +
      texture2D(uTex, vUv + vec2(p.x,  -p.y)).rg * 0.05 +
      texture2D(uTex, vUv + vec2(-p.x,  0.0)).rg * 0.20 +
      texture2D(uTex, vUv + vec2(0.0,   0.0)).rg * -1.00 +
      texture2D(uTex, vUv + vec2(p.x,   0.0)).rg * 0.20 +
      texture2D(uTex, vUv + vec2(-p.x,  p.y)).rg * 0.05 +
      texture2D(uTex, vUv + vec2(0.0,   p.y)).rg * 0.20 +
      texture2D(uTex, vUv + vec2(p.x,   p.y)).rg * 0.05;
      
    float abb = A * B * B;
    
    // Stable Gray-Scott "Spots" constants
    float feed = mix(0.03, 0.045, clamp(uFeed / 2.0, 0.0, 1.0));
    float kill = mix(0.06, 0.065, clamp(uKill / 4.0, 0.0, 1.0));
    
    // Diffusion constants
    float da = 1.0;
    float db = 0.5;
    float dt = 1.0;
    
    float newA = A + (da * lapl.r - abb + feed * (1.0 - A)) * dt;
    float newB = B + (db * lapl.g + abb - (kill + feed) * B) * dt;
    
    gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), 0.0, 1.0);
}
`;

// Renders the simulation texture using our palette logic
const renderFsSource = `
precision highp float;
uniform sampler2D uTex;
uniform float uBlend;
uniform vec3 uColors[8];
uniform int uColorCount;
uniform float uContrast; // Reusing scale or blend as contrast? No, let's use uBlend for edge and a fixed mult

varying vec2 vUv;

vec3 lerpColor(vec3 a, vec3 b, float t){ return mix(a, b, clamp(t,0.0,1.0)); }

vec3 paletteColor(float t){
  t = clamp(t, 0.0, 1.0);
  float segment = t * float(uColorCount - 1);
  int idx = int(floor(segment));
  float f = fract(segment);
  vec3 c0 = uColors[0], c1 = uColors[0];
  for(int i=0;i<8;i++){
    if(i==idx)   c0 = uColors[i];
    if(i==idx+1) c1 = uColors[i];
  }
  float b = max(0.0001, uBlend * 0.5);
  f = smoothstep(0.5 - b, 0.5 + b, f);
  return lerpColor(c0, c1, f);
}

void main() {
    float B = texture2D(uTex, vUv).g;
    
    // Boost B visibility significantly
    float t = pow(B * 3.5, 1.2); 
    
    vec3 col = paletteColor(t);
    
    // subtle vignette
    vec2 vig = vUv - 0.5;
    float v = 1.0 - dot(vig, vig) * 0.6;
    col *= v;

    gl_FragColor = vec4(col, 1.0);
}
`;

// Direct seed
const initFsSource = `
precision highp float;
varying vec2 vUv;
uniform float uSeed;

void main() {
  float dist = distance(vUv, vec2(0.5));
  // Large initial seed to ensure survival
  float B = dist < 0.1 ? 1.0 : 0.0;
  
  // Scatternoise based on seed
  float r = fract(sin(dot(vUv + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
  if (r > 0.99) B = 1.0;

  gl_FragColor = vec4(1.0, B, 0.0, 1.0);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
  }
  return s;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const vShader = createShader(gl, gl.VERTEX_SHADER, vs);
  const fShader = createShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vShader || !fShader) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vShader);
  gl.attachShader(prog, fShader);
  gl.linkProgram(prog);
  return prog;
}

export default function TuringCanvas({ params, colors, paused, onStatusChange, renderScale = 1 }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ params, displayParams: cloneParams(params), colors, paused, lastSeed: params.seed });
  const glRef = useRef<{
    gl: WebGL2RenderingContext,
    simProg: WebGLProgram,
    renderProg: WebGLProgram,
    initProg: WebGLProgram,
    fbos: WebGLFramebuffer[],
    texs: WebGLTexture[],
    quadBuff: WebGLBuffer,
    width: number,
    height: number,
    flip: boolean
  } | null>(null);

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
    // We MUST use WebGL2 for native floating point texture support (RGBA16F/RGBA32F)
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) {
      onStatusChange?.({
        title: 'WebGL2 required',
        message: 'Reaction-diffusion needs WebGL2. Switch to another mode or use a browser/device with newer graphics support.'
      });
      return;
    }
    onStatusChange?.(null);

    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('EXT_color_buffer_half_float');

    const simProg = createProgram(gl, vsSource, simFsSource);
    const renderProg = createProgram(gl, vsSource, renderFsSource);
    const initProg = createProgram(gl, vsSource, initFsSource);
    if (!simProg || !renderProg || !initProg) return;

    const quadBuff = gl.createBuffer();
    if (!quadBuff) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuff);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    // Create 2 textures and FBOs for ping-pong
    const createFBOAndTexture = (w: number, h: number) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      // RGBA16F allows decimal precision needed for Gray-Scott simulation
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo };
    };

    // Calculate resolution (sim resolution is fixed or scaled down for performance)
    const simW = toEvenSize(Math.max(2, Math.floor((window.innerWidth * renderScale) / 2)));
    const simH = toEvenSize(Math.max(2, Math.floor((window.innerHeight * renderScale) / 2)));

    const objA = createFBOAndTexture(simW, simH);
    const objB = createFBOAndTexture(simW, simH);
    
    if(!objA.tex || !objA.fbo || !objB.tex || !objB.fbo) return;

    glRef.current = {
      gl, simProg, renderProg, initProg,
      fbos: [objA.fbo, objB.fbo],
      texs: [objA.tex, objB.tex],
      quadBuff,
      width: simW,
      height: simH,
      flip: false
    };

    // Initialize the simulation texture with random noise and spots
    const initSim = (seed: number) => {
      gl.useProgram(initProg);
      const posLoc = gl.getAttribLocation(initProg, 'aPos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(initProg, 'uSeed'), seed);
      gl.viewport(0, 0, simW, simH);
      
      // We fill BOTH textures with initial state to be safe
      gl.bindFramebuffer(gl.FRAMEBUFFER, objA.fbo);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, objB.fbo);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      
      if (glRef.current) glRef.current.flip = false;
    };

    initSim(params.seed);
    state.current.lastSeed = params.seed;

    const resize = () => {
      const pixelScale = window.devicePixelRatio * renderScale;
      canvas.width = toEvenSize(window.innerWidth * pixelScale);
      canvas.height = toEvenSize(window.innerHeight * pixelScale);
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      const ctx = glRef.current;
      if (!ctx) return;
      const s = state.current;
      const { params, colors, paused, lastSeed } = s;
      s.displayParams = stepSmoothedParams(s.displayParams, params);
      const displayParams = s.displayParams;

      // If seed changes, user wants to reset the simulation to see new patterns
      if (params.seed !== lastSeed) {
        initSim(params.seed);
        s.lastSeed = params.seed;
      }

      // 1. SIMULATION PASS
      if (!paused) {
        // Run multiple steps per frame string for speed based on user parameter
        const steps = Math.max(1, Math.floor(displayParams.speed * 20)); // 0 -> ~20 steps per frame
        
        gl.useProgram(ctx.simProg);
        const simPosLoc = gl.getAttribLocation(ctx.simProg, 'aPos');
        gl.bindBuffer(gl.ARRAY_BUFFER, ctx.quadBuff);
        gl.enableVertexAttribArray(simPosLoc);
        gl.vertexAttribPointer(simPosLoc, 2, gl.FLOAT, false, 0, 0);
        
        gl.uniform2f(gl.getUniformLocation(ctx.simProg, 'uRes'), ctx.width, ctx.height);
        gl.uniform1f(gl.getUniformLocation(ctx.simProg, 'uFeed'), displayParams.amplitude);
        gl.uniform1f(gl.getUniformLocation(ctx.simProg, 'uKill'), displayParams.frequency);
        gl.uniform1f(gl.getUniformLocation(ctx.simProg, 'uDa'), 1.0); // Da
        gl.uniform1f(gl.getUniformLocation(ctx.simProg, 'uDb'), 0.5); // Db
        gl.uniform1f(gl.getUniformLocation(ctx.simProg, 'uSeed'), params.seed);
        
        gl.viewport(0, 0, ctx.width, ctx.height);

        for (let i = 0; i < steps; i++) {
          const writeFbo = ctx.fbos[ctx.flip ? 1 : 0];
          const readTex  = ctx.texs[ctx.flip ? 0 : 1];
          
          gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, readTex);
          gl.uniform1i(gl.getUniformLocation(ctx.simProg, 'uTex'), 0);
          
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          
          ctx.flip = !ctx.flip;
        }
      }

      // 2. RENDER PASS (to screen)
      gl.useProgram(ctx.renderProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); // screen
      gl.viewport(0, 0, canvas.width, canvas.height);

      const renderPosLoc = gl.getAttribLocation(ctx.renderProg, 'aPos');
      gl.bindBuffer(gl.ARRAY_BUFFER, ctx.quadBuff);
      gl.enableVertexAttribArray(renderPosLoc);
      gl.vertexAttribPointer(renderPosLoc, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ctx.texs[ctx.flip ? 0 : 1]); // Read from last written texture
      gl.uniform1i(gl.getUniformLocation(ctx.renderProg, 'uTex'), 0);
      gl.uniform2f(gl.getUniformLocation(ctx.renderProg, 'uRes'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(ctx.renderProg, 'uBlend'), displayParams.blend);

      const flat: number[] = [];
      colors.forEach(c => { flat.push(c[0]/255, c[1]/255, c[2]/255); });
      while(flat.length < 24) flat.push(0,0,0);
      
      gl.uniform3fv(gl.getUniformLocation(ctx.renderProg, 'uColors'), new Float32Array(flat));
      gl.uniform1i(gl.getUniformLocation(ctx.renderProg, 'uColorCount'), colors.length);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
      // Clean up WebGL resources
      gl.deleteProgram(simProg);
      gl.deleteProgram(renderProg);
      gl.deleteProgram(initProg);
      gl.deleteBuffer(quadBuff);
      gl.deleteTexture(objA.tex);
      gl.deleteFramebuffer(objA.fbo);
      gl.deleteTexture(objB.tex);
      gl.deleteFramebuffer(objB.fbo);
    };
  }, [onStatusChange, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
}
