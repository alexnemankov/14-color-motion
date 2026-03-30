import React, { useEffect, useRef } from 'react';
import { GradientParams, ColorRgb, RendererStatus } from '../App';

interface CanvasProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
  onStatusChange?: (status: RendererStatus | null) => void;
  renderScale?: number;
  externalTime?: number | null;
}

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

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  uv.x *= aspect; // Correct stretching for non-square screens

  // Calculate active blobs
  float numBlobsF = clamp(uFrequency * 3.0, 2.0, 8.0);
  int numBlobs = int(numBlobsF);

  // Volumetric Depth compositing: Background is Color 0.
  vec3 outColor = uColors[0];

  // Perspective Shift: Slow camera drift across the entire liquid space
  vec2 dUv = uv;
  dUv += vec2(sin(uTime * 0.05), cos(uTime * 0.08)) * 0.15;

  // Fluid Distortion: Domain Warping to create organic silhouettes and folds
  float warpStr = uBlend * 0.4;
  float warpFreq = max(0.5, uDefinition * 1.5);
  
  // Viscous and rhythmic motion: Slow-in, slow-out cadence
  float t = uTime * 0.2 + sin(uTime * 0.3) * 0.4;

  for(int w = 0; w < 3; w++) {
    float fw = float(w);
    float layerTime = t + uSeed + fw * 1.33;
    float nx = sin(dUv.y * warpFreq + layerTime) * warpStr;
    float ny = cos(dUv.x * warpFreq - layerTime) * warpStr;
    dUv += vec2(nx, ny);
    warpFreq *= 1.5;
    warpStr *= 0.6;
  }

  // Blob radius & softness
  float radius = max(0.1, uScale * 1.2);
  float blendFactor = max(0.1, uBlend * 1.5);

  for(int i = 1; i < 8; i++){
    if(i >= numBlobs) break;
    float fi = float(i);

    vec2 center = vec2(0.5 * aspect, 0.5);
    float amp = uAmplitude * 0.45;

    // Organic "blooming" layout and undulating paths
    float blobTime = t * 0.8 + sin(t * 0.4 + fi) * 0.5;
    
    center.x += sin(blobTime * 0.8 + fi * 2.13 + uSeed) * amp * aspect;
    center.y += cos(blobTime * 0.6 + fi * 1.74 + uSeed) * amp;
    center.x += cos(blobTime * 0.4 + fi * 3.81) * amp * 0.5 * aspect;

    float dist = distance(dUv, center);
    
    // The "Fold": Soft overlapping compositing yields explicit depth/tucking
    float edge0 = radius + blendFactor;
    float edge1 = max(0.001, radius - blendFactor);
    float w = smoothstep(edge0, edge1, dist);

    // Retrieve active color
    int cIdx = i;
    for(int j=0; j<8; j++) {
      if(cIdx >= uColorCount) cIdx -= uColorCount;
    }
    
    vec3 col = uColors[1];
    for(int k = 0; k < 8; k++){
      if(k == cIdx) {
        col = uColors[k];
      }
    }

    // Blend new blooming layer over the existing depth mass
    outColor = mix(outColor, col, w);
  }

  // Soft vignette
  vec2 vigVec = (gl_FragCoord.xy / uRes) - 0.5;
  float v = 1.0 - dot(vigVec, vigVec) * 0.5;
  outColor *= v;

  gl_FragColor = vec4(outColor, 1.0);
}
`;

function createShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

const BlobsCanvas: React.FC<CanvasProps> = ({ params, colors, paused, onStatusChange, renderScale = 1, externalTime = null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const state = useRef({
    animTime: 0,
    lastTimestamp: 0,
    params,
    colors,
    paused,
  });

  useEffect(() => {
    state.current.params = params;
    state.current.colors = colors;
    state.current.paused = paused;
  }, [params, colors, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (
      canvas.getContext('webgl2', { preserveDrawingBuffer: true })
      || canvas.getContext('webgl', { preserveDrawingBuffer: true })
    ) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) {
      onStatusChange?.({
        title: 'Renderer unavailable',
        message: 'This mode needs WebGL support. Try the particle mode or use a browser/device with graphics acceleration enabled.'
      });
      return;
    }
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
    const uniforms = ['uRes','uTime','uScale','uAmplitude','uFrequency','uDefinition','uSeed','uBlend','uColors','uColorCount'];
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
      const st = state.current;

      if (externalTime !== null) {
        st.animTime = externalTime;
        st.lastTimestamp = ts;
      } else if (!st.paused) {
        const dt = st.lastTimestamp === 0 ? 0 : (ts - st.lastTimestamp) / 1000;
        st.lastTimestamp = ts;
        st.animTime += dt * st.params.speed;
      } else {
        st.lastTimestamp = ts;
      }

      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime,       st.animTime);
      gl.uniform1f(U.uScale,      st.params.scale);
      gl.uniform1f(U.uAmplitude,  st.params.amplitude);
      gl.uniform1f(U.uFrequency,  st.params.frequency);
      gl.uniform1f(U.uDefinition, st.params.definition);
      gl.uniform1f(U.uSeed,       st.params.seed);
      gl.uniform1f(U.uBlend,      st.params.blend);

      // Map 0-255 colors to 0.0-1.0 floats logic for hardware
      const flat: number[] = [];
      st.colors.forEach(c => { flat.push(c[0]/255, c[1]/255, c[2]/255); });
      while(flat.length < 24) flat.push(0,0,0);
      
      gl.uniform3fv(U.uColors, new Float32Array(flat));
      gl.uniform1i(U.uColorCount, st.colors.length);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [externalTime, onStatusChange, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
};

export default BlobsCanvas;
