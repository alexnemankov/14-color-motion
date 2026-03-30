import { useEffect, useRef } from 'react';
import { GradientParams, ColorRgb } from '../App';

interface CanvasProps {
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
uniform float uSeed;
uniform float uBlend;
uniform vec3  uColors[8];
uniform int   uColorCount;

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

vec2 random2( vec2 p ) {
  // Deterministic random offset using seed
  return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*(43758.5453 + uSeed));
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;

  vec3 seed3 = vec3(uSeed * 0.001, uSeed * 0.0013, uSeed * 0.0017);
  
  // Use scale and frequency to size the cells
  // frequency increases the number of cells across the screen
  vec2 p = (uv - 0.5) * (uScale * uFrequency * 10.0) + seed3.xy;

  vec2 n = floor(p);
  vec2 f = fract(p);

  float minDist = 1.0;
  float secondMinDist = 1.0;

  float t = uTime * uAmplitude; // amplitude controls drift speed of cells

  // Voronoi search
  for( int j=-1; j<=1; j++ ) {
    for( int i=-1; i<=1; i++ ) {
        vec2 g = vec2( float(i), float(j) );
        vec2 o = random2( n + g );
        
        // Animate the cell origin
        o = 0.5 + 0.5 * sin( t + 6.2831 * o );
        
        vec2 r = g + o - f;
        
        float d = dot(r,r); // distance squared

        if( d < minDist ) {
            secondMinDist = minDist;
            minDist = d;
        } else if( d < secondMinDist ) {
            secondMinDist = d;
        }
    }
  }

  // Definition parameter blends between "spot" mode and "crystal/faceted" mode
  // Using linear blend based on uDefinition normalized from 1..12 to 0..1
  float defBlend = clamp((uDefinition - 1.0) / 11.0, 0.0, 1.0);
  
  // minDist creates spots, secondMinDist - minDist creates web/crystals
  float c = mix(sqrt(minDist), sqrt(secondMinDist) - sqrt(minDist), defBlend);
  
  // map to color
  // A typical voronoi value fits within roughly [0, 1]
  float colorT = c * 1.5; 
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

export default function VoronoiCanvas({ params, colors, paused }: CanvasProps) {
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
    const uniforms = ['uRes','uTime','uScale','uAmplitude','uFrequency','uDefinition','uSeed','uColors','uColorCount','uBlend'];
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
      gl.uniform1f(U.uSeed,       currentState.params.seed);
      gl.uniform1f(U.uBlend,      currentState.params.blend);

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
