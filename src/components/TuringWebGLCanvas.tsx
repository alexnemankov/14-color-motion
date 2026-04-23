import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../types';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

const toEvenSize = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

const vsSource = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ 
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0); 
}
`;

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
    
    float feed = mix(0.03, 0.045, clamp(uFeed / 2.0, 0.0, 1.0));
    float kill = mix(0.06, 0.065, clamp(uKill / 4.0, 0.0, 1.0));
    
    float da = 1.0;
    float db = 0.5;
    float dt = 1.0;
    
    float newA = A + (da * lapl.r - abb + feed * (1.0 - A)) * dt;
    float newB = B + (db * lapl.g + abb - (kill + feed) * B) * dt;
    
    gl_FragColor = vec4(clamp(newA, 0.0, 1.0), clamp(newB, 0.0, 1.0), 0.0, 1.0);
}
`;

const renderFsSource = `
precision highp float;
uniform sampler2D uTex;
uniform float uBlend;
uniform vec3 uColors[8];
uniform int uColorCount;

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
    float t = pow(B * 3.5, 1.2); 
    vec3 col = paletteColor(t);
    vec2 vig = vUv - 0.5;
    float v = 1.0 - dot(vig, vig) * 0.6;
    col *= v;
    gl_FragColor = vec4(col, 1.0);
}
`;

const initFsSource = `
precision highp float;
varying vec2 vUv;
uniform float uSeed;

void main() {
  float dist = distance(vUv, vec2(0.5));
  float B = dist < 0.1 ? 1.0 : 0.0;
  float r = fract(sin(dot(vUv + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
  if (r > 0.99) B = 1.0;
  gl_FragColor = vec4(1.0, B, 0.0, 1.0);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vs: string, fs: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vs);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  return program;
}

const TuringWebGLCanvas = forwardRef<RendererHandle, RendererProps>(function TuringWebGLCanvas(
  { params, colors, paused, onStatusChange, renderScale = 1 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<RendererStatus | null>(null);
  const state = useRef({ params, displayParams: cloneParams(params), colors, paused, lastSeed: params.seed });
  const glRef = useRef<{
    gl: WebGL2RenderingContext;
    simProg: WebGLProgram;
    renderProg: WebGLProgram;
    initProg: WebGLProgram;
    fbos: WebGLFramebuffer[];
    texs: WebGLTexture[];
    quadBuff: WebGLBuffer;
    width: number;
    height: number;
    flip: boolean;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    get status() {
      return statusRef.current;
    },
    supportsExternalTime: false,
    supportsLoopSafeExport: false,
    getCanvas: () => canvasRef.current,
    captureFrame: () => captureCanvasImageData(canvasRef.current),
  }), []);

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
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) {
      statusRef.current = {
        title: 'WebGL2 required',
        message: 'Reaction-diffusion needs WebGL2. Switch to another mode or use a browser/device with newer graphics support.',
      };
      onStatusChange?.(statusRef.current);
      return;
    }
    statusRef.current = null;
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
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const createFBOAndTexture = (width: number, height: number) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { tex: texture, fbo };
    };

    const simW = toEvenSize(Math.max(2, Math.floor((window.innerWidth * renderScale) / 2)));
    const simH = toEvenSize(Math.max(2, Math.floor((window.innerHeight * renderScale) / 2)));
    const objA = createFBOAndTexture(simW, simH);
    const objB = createFBOAndTexture(simW, simH);
    if (!objA.tex || !objA.fbo || !objB.tex || !objB.fbo) return;

    glRef.current = {
      gl,
      simProg,
      renderProg,
      initProg,
      fbos: [objA.fbo, objB.fbo],
      texs: [objA.tex, objB.tex],
      quadBuff,
      width: simW,
      height: simH,
      flip: false,
    };

    const initSim = (seed: number) => {
      gl.useProgram(initProg);
      const posLoc = gl.getAttribLocation(initProg, 'aPos');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(initProg, 'uSeed'), seed);
      gl.viewport(0, 0, simW, simH);
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

    let animationFrameId = 0;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      const context = glRef.current;
      if (!context) return;
      const current = state.current;
      current.displayParams = stepSmoothedParams(current.displayParams, current.params);
      const displayParams = current.displayParams;

      if (current.params.seed !== current.lastSeed) {
        initSim(current.params.seed);
        current.lastSeed = current.params.seed;
      }

      if (!current.paused) {
        const steps = Math.max(1, Math.floor(displayParams.speed * 20));
        gl.useProgram(context.simProg);
        const simPosLoc = gl.getAttribLocation(context.simProg, 'aPos');
        gl.bindBuffer(gl.ARRAY_BUFFER, context.quadBuff);
        gl.enableVertexAttribArray(simPosLoc);
        gl.vertexAttribPointer(simPosLoc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(gl.getUniformLocation(context.simProg, 'uRes'), context.width, context.height);
        gl.uniform1f(gl.getUniformLocation(context.simProg, 'uFeed'), displayParams.amplitude);
        gl.uniform1f(gl.getUniformLocation(context.simProg, 'uKill'), displayParams.frequency);
        gl.uniform1f(gl.getUniformLocation(context.simProg, 'uDa'), 1.0);
        gl.uniform1f(gl.getUniformLocation(context.simProg, 'uDb'), 0.5);
        gl.uniform1f(gl.getUniformLocation(context.simProg, 'uSeed'), current.params.seed);
        gl.viewport(0, 0, context.width, context.height);

        for (let i = 0; i < steps; i += 1) {
          const writeFbo = context.fbos[context.flip ? 1 : 0];
          const readTex = context.texs[context.flip ? 0 : 1];
          gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, readTex);
          gl.uniform1i(gl.getUniformLocation(context.simProg, 'uTex'), 0);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          context.flip = !context.flip;
        }
      }

      gl.useProgram(context.renderProg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      const renderPosLoc = gl.getAttribLocation(context.renderProg, 'aPos');
      gl.bindBuffer(gl.ARRAY_BUFFER, context.quadBuff);
      gl.enableVertexAttribArray(renderPosLoc);
      gl.vertexAttribPointer(renderPosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, context.texs[context.flip ? 0 : 1]);
      gl.uniform1i(gl.getUniformLocation(context.renderProg, 'uTex'), 0);
      gl.uniform2f(gl.getUniformLocation(context.renderProg, 'uRes'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(context.renderProg, 'uBlend'), displayParams.blend);

      const flat: number[] = [];
      current.colors.forEach(color => {
        flat.push(color[0] / 255, color[1] / 255, color[2] / 255);
      });
      while (flat.length < 24) flat.push(0, 0, 0);

      gl.uniform3fv(gl.getUniformLocation(context.renderProg, 'uColors'), new Float32Array(flat));
      gl.uniform1i(gl.getUniformLocation(context.renderProg, 'uColorCount'), current.colors.length);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
      gl.deleteProgram(simProg);
      gl.deleteProgram(renderProg);
      gl.deleteProgram(initProg);
      gl.deleteBuffer(quadBuff);
      gl.deleteTexture(objA.tex);
      gl.deleteFramebuffer(objA.fbo);
      gl.deleteTexture(objB.tex);
      gl.deleteFramebuffer(objB.fbo);
    };
  }, [onStatusChange, params.seed, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
});

export default TuringWebGLCanvas;
