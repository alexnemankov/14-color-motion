import type { AnimationType, ColorRgb, GradientParams, SceneState, WorkflowLocks } from '../types';
import { DEFAULT_PARAMS, VALID_ANIMATION_TYPES } from '../constants';
import { PALETTES } from '../data/palettes';
import {
  migratePersistedScene,
} from '../migrations/sceneMigrations';

export function cloneScene(scene: SceneState): SceneState {
  return {
    animationType: scene.animationType,
    params: { ...scene.params },
    colors: scene.colors.map((c) => [...c] as ColorRgb),
  };
}

export function sceneKey(scene: SceneState): string {
  return JSON.stringify({
    animationType: scene.animationType,
    params: scene.params,
    colors: scene.colors,
  });
}

export function animationTypeLabel(type: AnimationType): string {
  return {
    liquid: "Liquid",
    waves: "Waves",
    voronoi: "Voronoi",
    turing: "Turing",
    particles: "Particles",
    blobs: "Blobs",
    three: "3D Mesh",
    topographic: "Topographic",
    neondrip: "Neon Drip",
    clouds: "Clouds",
    sea: "Sea",
    prism: "Prism",
    octagrams: "Octagrams",
    metaballs: "Metaballs",
  }[type];
}

export function supportsLoopSafeExport(type: AnimationType): boolean {
  return (
    type === "liquid" ||
    type === "waves" ||
    type === "voronoi" ||
    type === "blobs" ||
    type === "three" ||
    type === "clouds" ||
    type === "metaballs"
  );
}

export function randomBetween(min: number, max: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((min + Math.random() * (max - min)) * factor) / factor;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function randomAnimationType(): AnimationType {
  return VALID_ANIMATION_TYPES[randomInt(0, VALID_ANIMATION_TYPES.length - 1)];
}

export function randomPaletteColors(): ColorRgb[] {
  const palette = PALETTES[randomInt(0, PALETTES.length - 1)];
  return palette.colors.map((color) => {
    const value = parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as ColorRgb;
  });
}

export function randomParams(
  base: GradientParams,
  locks: Pick<WorkflowLocks, "seed" | "motion">,
  animationType: AnimationType,
): GradientParams {
  const isTopo = animationType === "topographic";
  const isDrip = animationType === "neondrip";
  const isClouds = animationType === "clouds" || animationType === "sea";
  return {
    seed: locks.seed ? base.seed : randomInt(0, 9999),
    speed: locks.motion ? base.speed
      : isTopo ? randomBetween(0.01, 0.2, 2)
      : isDrip ? randomBetween(0.05, 1.0, 2)
      : isClouds ? randomBetween(0.05, 0.8, 2)
      : randomBetween(0.2, 2.4),
    scale: locks.motion ? base.scale
      : isTopo ? randomBetween(0.01, 0.5, 2)
      : randomBetween(0.2, 1.4),
    amplitude: locks.motion ? base.amplitude : randomBetween(0.2, 1.6),
    frequency: locks.motion ? base.frequency
      : isTopo ? randomBetween(0.01, 0.3, 2)
      : randomBetween(0.3, 2.6),
    definition: locks.motion ? base.definition
      : isTopo ? randomInt(1, 3)
      : randomInt(1, 8),
    blend: locks.motion ? base.blend : randomBetween(0.15, 1, 2),
    morphSpeed: locks.motion ? base.morphSpeed : randomBetween(0.05, 1.2),
    morphAmount: locks.motion ? base.morphAmount : randomBetween(0, 1.2),
    focusDistance: locks.motion ? base.focusDistance : randomBetween(20, 60),
    aperture: locks.motion ? base.aperture : randomBetween(0.005, 0.04),
    maxBlur: locks.motion ? base.maxBlur : randomBetween(0.1, 0.45),
    dofEnabled: locks.motion ? base.dofEnabled : true,
    topoLineWidth: base.topoLineWidth,
    cloudType: base.cloudType,
    godRays: base.godRays,
    octagramType: base.octagramType,
    octagramAltitude: locks.motion ? base.octagramAltitude : randomBetween(0, 1),
    octagramDensity: locks.motion ? base.octagramDensity : randomBetween(0, 1),
    octagramTrails: base.octagramTrails,
    octagramColorCycle: base.octagramColorCycle,
  };
}

export function isColorRgb(value: unknown): value is ColorRgb {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((ch) => typeof ch === "number" && ch >= 0 && ch <= 255)
  );
}

export function normalizeSceneState(value: unknown): SceneState | null {
  const candidate = migratePersistedScene(value, {
    defaultParams: DEFAULT_PARAMS,
    validAnimationTypes: VALID_ANIMATION_TYPES,
  });
  if (!candidate) return null;

  const p = candidate.params as Partial<GradientParams>;

  const normalizedParams: GradientParams = {
    seed: typeof p.seed === "number" ? p.seed : DEFAULT_PARAMS.seed,
    speed: typeof p.speed === "number" ? p.speed : DEFAULT_PARAMS.speed,
    scale: typeof p.scale === "number" ? p.scale : DEFAULT_PARAMS.scale,
    amplitude: typeof p.amplitude === "number" ? p.amplitude : DEFAULT_PARAMS.amplitude,
    frequency: typeof p.frequency === "number" ? p.frequency : DEFAULT_PARAMS.frequency,
    definition: typeof p.definition === "number" ? p.definition : DEFAULT_PARAMS.definition,
    blend: typeof p.blend === "number" ? p.blend : DEFAULT_PARAMS.blend,
    morphSpeed: typeof p.morphSpeed === "number" ? p.morphSpeed : DEFAULT_PARAMS.morphSpeed,
    morphAmount: typeof p.morphAmount === "number" ? p.morphAmount : DEFAULT_PARAMS.morphAmount,
    focusDistance: typeof p.focusDistance === "number" ? p.focusDistance : DEFAULT_PARAMS.focusDistance,
    aperture: typeof p.aperture === "number" ? p.aperture : DEFAULT_PARAMS.aperture,
    maxBlur: typeof p.maxBlur === "number" ? p.maxBlur : DEFAULT_PARAMS.maxBlur,
    dofEnabled: typeof p.dofEnabled === "boolean" ? p.dofEnabled : DEFAULT_PARAMS.dofEnabled,
    topoLineWidth: typeof p.topoLineWidth === "number" ? p.topoLineWidth : DEFAULT_PARAMS.topoLineWidth,
    cloudType: typeof p.cloudType === "number" ? p.cloudType : DEFAULT_PARAMS.cloudType,
    godRays: typeof p.godRays === "boolean" ? p.godRays : DEFAULT_PARAMS.godRays,
    octagramType: typeof p.octagramType === "number" ? p.octagramType : DEFAULT_PARAMS.octagramType,
    octagramAltitude: typeof p.octagramAltitude === "number" ? p.octagramAltitude : DEFAULT_PARAMS.octagramAltitude,
    octagramDensity: typeof p.octagramDensity === "number" ? p.octagramDensity : DEFAULT_PARAMS.octagramDensity,
    octagramTrails: typeof p.octagramTrails === "boolean" ? p.octagramTrails : DEFAULT_PARAMS.octagramTrails,
    octagramColorCycle: typeof p.octagramColorCycle === "boolean" ? p.octagramColorCycle : DEFAULT_PARAMS.octagramColorCycle,
  };

  const colors = Array.isArray(candidate.colors)
    ? (candidate.colors as unknown[]).filter(isColorRgb).slice(0, 8)
    : [];
  if (colors.length < 2) return null;

  return {
    animationType: candidate.animationType,
    params: normalizedParams,
    colors,
  };
}
