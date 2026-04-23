import type { AnimationType, ColorRgb, GradientParams } from '../types';

export const DEFAULT_COLORS: ColorRgb[] = [
  [10, 0, 20],
  [107, 0, 194],
  [255, 45, 107],
  [255, 149, 0],
];

export const DEFAULT_PARAMS: GradientParams = {
  seed: 6484,
  speed: 0.8,
  scale: 0.76,
  amplitude: 0.99,
  frequency: 1.19,
  definition: 2,
  blend: 1.0,
  morphSpeed: 0.2,
  morphAmount: 0.35,
  focusDistance: 32,
  aperture: 0.0125,
  maxBlur: 0.35,
  dofEnabled: false,
  topoLineWidth: 1,
  cloudType: 0,
  godRays: false,
  octagramType: 0,
  octagramAltitude: 0.4,
  octagramDensity: 0.3,
  octagramTrails: false,
  octagramColorCycle: false,
};

export const VALID_ANIMATION_TYPES: AnimationType[] = [
  "liquid",
  "waves",
  "voronoi",
  "turing",
  "particles",
  "blobs",
  "three",
  "topographic",
  "neondrip",
  "clouds",
  "sea",
  "prism",
  "octagrams",
  "metaballs",
  "phantomstar",
];


export const SESSION_STORAGE_KEY = "color-motion-session";
export const PRESETS_STORAGE_KEY = "color-motion-presets";
export const RECENT_SCENES_STORAGE_KEY = "color-motion-recent-scenes";
export const ONBOARDING_STORAGE_KEY = "color-motion-onboarding-dismissed";
export const SHARE_PARAM_KEY = "scene";
export const SHARE_NAME_PARAM_KEY = "name";
export const SHARE_SCENE_VERSION = "v1";

export const HISTORY_LIMIT = 40;
export const PALETTE_TRANSITION_MS = 1500;
export const LOOP_SAFE_DURATION_SECONDS = 6;
export const RECENT_SCENES_LIMIT = 8;
export const APP_TITLE = "Color Motion Lab";
export const WEBGL_COMPATIBILITY_URL = "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API";

export const ONBOARDING_STEPS = [
  {
    targetId: "panel",
    eyebrow: "Controls",
    title: "This is the main studio panel",
    message:
      "Use it to switch renderers, explore palettes, tune motion, save scenes, and export output.",
  },
  {
    targetId: "onboarding-mode-section",
    eyebrow: "Modes",
    title: "Each mode is a different visual engine",
    message:
      "Switch between liquid, waves, voronoi, turing, particles, and blobs to explore different motion systems.",
  },
  {
    targetId: "onboarding-workspace-section",
    eyebrow: "Workspace",
    title: "Save, share, and export when a scene feels right",
    message:
      "Store presets locally, copy a share link, or export still and video output from here.",
  },
];
