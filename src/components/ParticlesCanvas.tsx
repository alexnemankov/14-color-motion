import { useEffect, useRef } from 'react';
import { GradientParams, ColorRgb } from '../App';

interface CanvasProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const lerpColor = (c1: ColorRgb, c2: ColorRgb, t: number): ColorRgb => [
  Math.round(c1[0] + (c2[0] - c1[0]) * t),
  Math.round(c1[1] + (c2[1] - c1[1]) * t),
  Math.round(c1[2] + (c2[2] - c1[2]) * t)
];

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const paletteColor = (t: number, colors: ColorRgb[], blend: number): ColorRgb => {
  t = Math.max(0, Math.min(1, t));
  const len = colors.length;
  if (len === 0) return [0,0,0];
  if (len === 1) return colors[0];
  
  const segment = t * (len - 1);
  const idx = Math.floor(segment);
  let f = segment - idx;
  
  const c0 = colors[Math.min(idx, len-1)];
  const c1 = colors[Math.min(idx + 1, len-1)];
  
  const b = Math.max(0.0001, blend * 0.5);
  f = smoothstep(0.5 - b, 0.5 + b, f);
  
  return lerpColor(c0, c1, f);
};

// Deterministic pseudo-random number generator
function xmur3(str: string) {
    for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    } return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}
function sfc32(a: number, b: number, c: number, d: number) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

export default function ParticlesCanvas({ params, colors, paused }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const state = useRef({
    particles: [] as Particle[],
    params,
    colors,
    paused,
    seed: -1,
    width: 0,
    height: 0
  });

  // Sync props to ref to avoid dependency cycles in requestAnimationFrame
  useEffect(() => {
    state.current.params = params;
    state.current.colors = colors;
    state.current.paused = paused;
  }, [params, colors, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      state.current.width = canvas.width;
      state.current.height = canvas.height;
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      animationFrameId = requestAnimationFrame(render);
      const s = state.current;
      
      const dt = s.paused ? 0 : (time - lastTime) / 1000;
      lastTime = time;

      // Re-seed and re-generate particles if the user seed or particle count (definition) changes drastically
      const targetCount = Math.floor(Math.min(500, Math.max(10, s.params.definition * 25))); // 10 to ~300 max
      if (s.seed !== s.params.seed || s.particles.length === 0) {
        s.seed = s.params.seed;
        const _seed = xmur3(s.seed.toString());
        const rand = sfc32(_seed(), _seed(), _seed(), _seed());
        s.particles = [];
        for (let i = 0; i < targetCount; i++) {
          s.particles.push({
            x: rand() * s.width,
            y: rand() * s.height,
            vx: (rand() - 0.5) * 100,
            vy: (rand() - 0.5) * 100
          });
        }
      } else if (s.particles.length !== targetCount) {
        // adjust count dynamically without full reset
        while (s.particles.length < targetCount) {
          s.particles.push({
            x: Math.random() * s.width, y: Math.random() * s.height,
            vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100
          });
        }
        s.particles.length = targetCount;
      }

      // Logic overrides based on params
      const baseVel = s.params.speed * 2.0;
      const linkDist = s.params.amplitude * 200 * s.params.scale; // Amplitude controls connection reach
      const linkDistSq = linkDist * linkDist;
      const turnSpeed = s.params.frequency * 0.5;

      // Update positions
      if (dt > 0) {
        for (let i = 0; i < s.particles.length; i++) {
          const p = s.particles[i];
          
          // Add some wavy drift (frequency defines the wave, Scale scales space)
          const angle = Math.sin(p.x * 0.005 * s.params.scale) + Math.cos(p.y * 0.005 * s.params.scale);
          p.vx += Math.cos(angle) * turnSpeed;
          p.vy += Math.sin(angle) * turnSpeed;
          
          // Normalize pseudo-velocity and apply global speed
          const curV = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
          if (curV > 0) {
            p.vx = (p.vx / curV) * 100 * baseVel;
            p.vy = (p.vy / curV) * 100 * baseVel;
          }

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Wrap boundaries
          if (p.x < 0) p.x += s.width;
          if (p.x > s.width) p.x -= s.width;
          if (p.y < 0) p.y += s.height;
          if (p.y > s.height) p.y -= s.height;
        }
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, s.width, s.height);

      ctx.lineWidth = 1.5 * window.devicePixelRatio;

      // Draw connections O(N^2)
      for (let i = 0; i < s.particles.length; i++) {
        const p1 = s.particles[i];
        
        for (let j = i + 1; j < s.particles.length; j++) {
          const p2 = s.particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx*dx + dy*dy;
          
          if (distSq < linkDistSq) {
            const pct = 1.0 - (Math.sqrt(distSq) / linkDist);
            
            // Map the screen Y coordinate to a color 
            const avgY = (p1.y + p2.y) / 2;
            const yNormal = avgY / s.height;
            const col = paletteColor(yNormal, s.colors, s.params.blend);
            
            ctx.strokeStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${pct * pct})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      
      // Draw nodes
      for (let i = 0; i < s.particles.length; i++) {
        const p = s.particles[i];
        const yNormal = p.y / s.height;
        const col = paletteColor(yNormal, s.colors, s.params.blend);
        ctx.fillStyle = `rgb(${col[0]}, ${col[1]}, ${col[2]})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.5, 3 * s.params.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} id="c" />;
}
