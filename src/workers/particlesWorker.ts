import type { GradientParams } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface PointerState {
  x: number;
  y: number;
}

type InitMessage = {
  type: 'init';
  width: number;
  height: number;
};

type ResizeMessage = {
  type: 'resize';
  width: number;
  height: number;
};

type StepMessage = {
  type: 'step';
  dt: number;
  params: GradientParams;
  seed: number;
  paused: boolean;
  pointer: PointerState | null;
};

type WorkerMessage = InitMessage | ResizeMessage | StepMessage;

type FrameMessage = {
  type: 'frame';
  nodes: Float32Array;
  links: Float32Array;
};

const state = {
  particles: [] as Particle[],
  width: 0,
  height: 0,
  seed: -1,
};

function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return function hash() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number) {
  return function random() {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function reseedParticles(seed: number, targetCount: number) {
  state.seed = seed;
  state.particles = [];

  const seedFactory = xmur3(seed.toString());
  const rand = sfc32(seedFactory(), seedFactory(), seedFactory(), seedFactory());

  for (let i = 0; i < targetCount; i += 1) {
    state.particles.push({
      x: rand() * state.width,
      y: rand() * state.height,
      vx: (rand() - 0.5) * 100,
      vy: (rand() - 0.5) * 100,
    });
  }
}

function syncParticleCount(targetCount: number) {
  while (state.particles.length < targetCount) {
    state.particles.push({
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      vx: (Math.random() - 0.5) * 100,
      vy: (Math.random() - 0.5) * 100,
    });
  }

  state.particles.length = targetCount;
}

function buildFrame(params: GradientParams) {
  const linkDist = params.amplitude * 200 * params.scale;
  const linkDistSq = linkDist * linkDist;
  const linkValues: number[] = [];
  const nodeValues = new Float32Array(state.particles.length * 3);

  for (let i = 0; i < state.particles.length; i += 1) {
    const p1 = state.particles[i];
    const nodeOffset = i * 3;
    nodeValues[nodeOffset] = p1.x;
    nodeValues[nodeOffset + 1] = p1.y;
    nodeValues[nodeOffset + 2] = state.height > 0 ? p1.y / state.height : 0;

    for (let j = i + 1; j < state.particles.length; j += 1) {
      const p2 = state.particles[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < linkDistSq) {
        const pct = 1 - Math.sqrt(distSq) / linkDist;
        linkValues.push(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          pct * pct,
          state.height > 0 ? ((p1.y + p2.y) * 0.5) / state.height : 0
        );
      }
    }
  }

  const links = new Float32Array(linkValues);
  const payload: FrameMessage = {
    type: 'frame',
    nodes: nodeValues,
    links,
  };

  (self as unknown as { postMessage: (message: FrameMessage, transfer: Transferable[]) => void }).postMessage(payload, [nodeValues.buffer, links.buffer]);
}

function stepSimulation(message: StepMessage) {
  const { dt, params, seed, paused, pointer } = message;
  const targetCount = Math.floor(Math.min(500, Math.max(10, params.definition * 25)));

  if (state.seed !== seed || state.particles.length === 0) {
    reseedParticles(seed, targetCount);
  } else if (state.particles.length !== targetCount) {
    syncParticleCount(targetCount);
  }

  const baseVel = params.speed * 2;
  const turnSpeed = params.frequency * 0.5;
  const pointerRadius = Math.max(80, params.amplitude * 140);
  const pointerRadiusSq = pointerRadius * pointerRadius;

  if (!paused && dt > 0) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const particle = state.particles[i];
      const angle = Math.sin(particle.x * 0.005 * params.scale) + Math.cos(particle.y * 0.005 * params.scale);
      particle.vx += Math.cos(angle) * turnSpeed;
      particle.vy += Math.sin(angle) * turnSpeed;

      if (pointer) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < pointerRadiusSq && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const strength = (1 - dist / pointerRadius) * 180;
          particle.vx += (dx / dist) * strength;
          particle.vy += (dy / dist) * strength;
        }
      }

      const velocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (velocity > 0) {
        particle.vx = (particle.vx / velocity) * 100 * baseVel;
        particle.vy = (particle.vy / velocity) * 100 * baseVel;
      }

      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      if (particle.x < 0) particle.x += state.width;
      if (particle.x > state.width) particle.x -= state.width;
      if (particle.y < 0) particle.y += state.height;
      if (particle.y > state.height) particle.y -= state.height;
    }
  }

  buildFrame(params);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'init' || message.type === 'resize') {
    state.width = message.width;
    state.height = message.height;
    return;
  }

  stepSimulation(message);
};
