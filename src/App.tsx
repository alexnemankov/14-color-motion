import { FormEvent, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import LiquidCanvas from "./components/LiquidCanvas";
import WavesCanvas from "./components/WavesCanvas";
import VoronoiCanvas from "./components/VoronoiCanvas";
import TuringCanvas from "./components/TuringCanvas";
import ParticlesCanvas from "./components/ParticlesCanvas";
import BlobsCanvas from "./components/BlobsCanvas";
import ThreeJSCanvas from "./components/ThreeJSCanvas";
import TopographicCanvas from "./components/TopographicCanvas";
import NeonDripCanvas from "./components/NeonDripCanvas";
import CloudsCanvas from "./components/CloudsCanvas";
import SeaCanvas from "./components/SeaCanvas";
import PrismCanvas from "./components/PrismCanvas";
import OctagramsCanvas from "./components/OctagramsCanvas";
import Panel from "./components/Panel";
import RendererBoundary from "./components/RendererBoundary";
import { RendererHandle } from "./components/rendererTypes";
import {
  migratePersistedScene,
  serializeSceneForPersistence,
  CURRENT_SCENE_VERSION,
} from "./migrations/sceneMigrations";
import { PALETTES } from "./data/palettes";

export type AnimationType =
  | "liquid"
  | "waves"
  | "voronoi"
  | "turing"
  | "particles"
  | "blobs"
  | "three"
  | "topographic"
  | "neondrip"
  | "clouds"
  | "sea"
  | "prism"
  | "octagrams";

export interface GradientParams {
  seed: number;
  speed: number;
  scale: number;
  amplitude: number;
  frequency: number;
  definition: number;
  blend: number;
  morphSpeed: number;
  morphAmount: number;
  focusDistance: number;
  aperture: number;
  maxBlur: number;
  dofEnabled: boolean;
  topoLineWidth: number;
  cloudType: number;
  godRays: boolean;
  octagramType: number;
  octagramAltitude: number;
  octagramDensity: number;
  octagramTrails: boolean;
  octagramColorCycle: boolean;
}

export type ColorRgb = [number, number, number];

export interface SceneState {
  animationType: AnimationType;
  params: GradientParams;
  colors: ColorRgb[];
}

export interface SavedPreset extends SceneState {
  id: string;
  name: string;
  createdAt: string;
}

export interface RecentScene extends SceneState {
  id: string;
  name: string;
  seenAt: string;
  source: "preset" | "shared" | "live";
}

export interface RendererStatus {
  title: string;
  message: string;
}

interface ToastState {
  id: number;
  title: string;
  message?: string;
}

interface ExportStatusState {
  phase:
    | "idle"
    | "preparing"
    | "capturing"
    | "recording"
    | "encoding"
    | "complete"
    | "error";
  label: string;
  detail?: string;
  progress: number;
  frameCount?: number;
  frameTotal?: number;
}

interface ModeTransitionState {
  id: number;
  imageUrl: string;
}

export interface WorkflowLocks {
  mode: boolean;
  palette: boolean;
  seed: boolean;
  motion: boolean;
}

const DEFAULT_COLORS: ColorRgb[] = [
  [10, 0, 20],
  [107, 0, 194],
  [255, 45, 107],
  [255, 149, 0],
];

const DEFAULT_PARAMS: GradientParams = {
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

const SESSION_STORAGE_KEY = "color-motion-session";
const PRESETS_STORAGE_KEY = "color-motion-presets";
const RECENT_SCENES_STORAGE_KEY = "color-motion-recent-scenes";
const ONBOARDING_STORAGE_KEY = "color-motion-onboarding-dismissed";
const SHARE_PARAM_KEY = "scene";
const SHARE_NAME_PARAM_KEY = "name";
const SHARE_SCENE_VERSION = "v1";
const VALID_ANIMATION_TYPES: AnimationType[] = [
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
];
const HISTORY_LIMIT = 40;
const PALETTE_TRANSITION_MS = 1500;
const LOOP_SAFE_DURATION_SECONDS = 6;
const RECENT_SCENES_LIMIT = 8;
const APP_TITLE = "Color Motion Lab";
const WEBGL_COMPATIBILITY_URL =
  "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API";
const ONBOARDING_STEPS = [
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

function cloneScene(scene: SceneState): SceneState {
  return {
    animationType: scene.animationType,
    params: { ...scene.params },
    colors: scene.colors.map((color) => [...color] as ColorRgb),
  };
}

function sceneKey(scene: SceneState): string {
  return JSON.stringify({
    animationType: scene.animationType,
    params: scene.params,
    colors: scene.colors,
  });
}

function randomBetween(min: number, max: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((min + Math.random() * (max - min)) * factor) / factor;
}

function randomInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randomAnimationType(): AnimationType {
  return VALID_ANIMATION_TYPES[randomInt(0, VALID_ANIMATION_TYPES.length - 1)];
}

function randomPaletteColors(): ColorRgb[] {
  const palette = PALETTES[randomInt(0, PALETTES.length - 1)];
  return palette.colors.map((color) => {
    const value = parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as ColorRgb;
  });
}

function randomParams(
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

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function palettesEqual(a: ColorRgb[], b: ColorRgb[]) {
  return (
    sceneKey({ animationType: "liquid", params: DEFAULT_PARAMS, colors: a }) ===
    sceneKey({ animationType: "liquid", params: DEFAULT_PARAMS, colors: b })
  );
}

function samplePaletteColor(palette: ColorRgb[], t: number): ColorRgb {
  if (palette.length === 0) return [0, 0, 0];
  if (palette.length === 1) return [...palette[0]] as ColorRgb;

  const clamped = Math.max(0, Math.min(1, t));
  const segment = clamped * (palette.length - 1);
  const index = Math.floor(segment);
  const localT = segment - index;
  const from = palette[Math.min(index, palette.length - 1)];
  const to = palette[Math.min(index + 1, palette.length - 1)];

  return [
    clampChannel(from[0] + (to[0] - from[0]) * localT),
    clampChannel(from[1] + (to[1] - from[1]) * localT),
    clampChannel(from[2] + (to[2] - from[2]) * localT),
  ];
}

function resamplePalette(palette: ColorRgb[], count: number): ColorRgb[] {
  if (count <= 0) return [];
  if (count === 1) return [samplePaletteColor(palette, 0.5)];

  return Array.from({ length: count }, (_, index) =>
    samplePaletteColor(palette, index / (count - 1)),
  );
}

function animationTypeLabel(type: AnimationType) {
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
  }[type];
}

function encodeBase64Url(value: string) {
  const utf8 = new TextEncoder().encode(value);
  let binary = "";
  utf8.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function rgbToShareHex(color: ColorRgb) {
  return color.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

function shareHexToRgb(value: string): ColorRgb | null {
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  const parsed = parseInt(value, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function toShareNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}

function serializeShareScene(scene: SceneState, name?: string | null) {
  const payload = {
    v: SHARE_SCENE_VERSION,
    sv: CURRENT_SCENE_VERSION,
    a: VALID_ANIMATION_TYPES.indexOf(scene.animationType),
    p: [
      scene.params.seed,
      toShareNumber(scene.params.speed),
      toShareNumber(scene.params.scale),
      toShareNumber(scene.params.amplitude),
      toShareNumber(scene.params.frequency),
      scene.params.definition,
      toShareNumber(scene.params.blend),
      toShareNumber(scene.params.morphSpeed),
      toShareNumber(scene.params.morphAmount),
      toShareNumber(scene.params.focusDistance),
      toShareNumber(scene.params.aperture),
      toShareNumber(scene.params.maxBlur),
      scene.params.dofEnabled ? 1 : 0,
    ],
    c: scene.colors.map(rgbToShareHex),
    ...(name ? { n: name.slice(0, 80) } : {}),
  };

  return encodeBase64Url(JSON.stringify(payload));
}

function parseCompactSharedScene(
  raw: string,
): { scene: SceneState; name: string | null } | null {
  try {
    const decoded = JSON.parse(decodeBase64Url(raw)) as {
      v?: string;
      sv?: number;
      a?: number;
      p?: unknown[];
      c?: unknown[];
      n?: string;
    };

    if (decoded.v !== SHARE_SCENE_VERSION) return null;
    if (typeof decoded.a !== "number" || !VALID_ANIMATION_TYPES[decoded.a])
      return null;
    if (!Array.isArray(decoded.p) || decoded.p.length < 10) return null;
    if (!Array.isArray(decoded.c)) return null;

    const colors = decoded.c
      .map((value) => (typeof value === "string" ? shareHexToRgb(value) : null))
      .filter((color): color is ColorRgb => color !== null)
      .slice(0, 8);

    if (colors.length < 2) return null;

    const scene = normalizeSceneState({
      version: typeof decoded.sv === "number" ? decoded.sv : 0,
      animationType: VALID_ANIMATION_TYPES[decoded.a],
      params: {
        seed: decoded.p[0],
        speed: decoded.p[1],
        scale: decoded.p[2],
        amplitude: decoded.p[3],
        frequency: decoded.p[4],
        definition: decoded.p[5],
        blend: decoded.p[6],
        morphSpeed: decoded.p[7] ?? DEFAULT_PARAMS.morphSpeed,
        morphAmount: decoded.p[8] ?? DEFAULT_PARAMS.morphAmount,
        focusDistance: decoded.p[9] ?? DEFAULT_PARAMS.focusDistance,
        aperture: decoded.p[10] ?? DEFAULT_PARAMS.aperture,
        maxBlur: decoded.p[11] ?? DEFAULT_PARAMS.maxBlur,
        dofEnabled:
          decoded.p[12] === 0
            ? false
            : decoded.p[12] === 1
              ? true
              : DEFAULT_PARAMS.dofEnabled,
      },
      colors,
    });

    if (!scene) return null;

    const name =
      typeof decoded.n === "string" && decoded.n.trim()
        ? decoded.n.trim().slice(0, 80)
        : null;

    return { scene, name };
  } catch {
    return null;
  }
}

function supportsLoopSafeExport(type: AnimationType) {
  return (
    type === "liquid" ||
    type === "waves" ||
    type === "voronoi" ||
    type === "blobs" ||
    type === "three" ||
    type === "clouds"
  );
}

function interpolatePalettes(
  from: ColorRgb[],
  to: ColorRgb[],
  t: number,
): ColorRgb[] {
  const count = Math.max(2, to.length);
  const start = resamplePalette(from, count);
  const end = resamplePalette(to, count);

  return end.map((targetColor, index) => {
    const sourceColor = start[index] ?? start[start.length - 1] ?? [0, 0, 0];
    return [
      clampChannel(sourceColor[0] + (targetColor[0] - sourceColor[0]) * t),
      clampChannel(sourceColor[1] + (targetColor[1] - sourceColor[1]) * t),
      clampChannel(sourceColor[2] + (targetColor[2] - sourceColor[2]) * t),
    ] as ColorRgb;
  });
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function isColorRgb(value: unknown): value is ColorRgb {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (channel) =>
        typeof channel === "number" && channel >= 0 && channel <= 255,
    )
  );
}

function normalizeSceneState(value: unknown): SceneState | null {
  const candidate = migratePersistedScene(value, {
    defaultParams: DEFAULT_PARAMS,
    validAnimationTypes: VALID_ANIMATION_TYPES,
  });
  if (!candidate) return null;

  const params = candidate.params as Partial<GradientParams>;

  const normalizedParams: GradientParams = {
    seed: typeof params.seed === "number" ? params.seed : DEFAULT_PARAMS.seed,
    speed:
      typeof params.speed === "number" ? params.speed : DEFAULT_PARAMS.speed,
    scale:
      typeof params.scale === "number" ? params.scale : DEFAULT_PARAMS.scale,
    amplitude:
      typeof params.amplitude === "number"
        ? params.amplitude
        : DEFAULT_PARAMS.amplitude,
    frequency:
      typeof params.frequency === "number"
        ? params.frequency
        : DEFAULT_PARAMS.frequency,
    definition:
      typeof params.definition === "number"
        ? params.definition
        : DEFAULT_PARAMS.definition,
    blend:
      typeof params.blend === "number" ? params.blend : DEFAULT_PARAMS.blend,
    morphSpeed:
      typeof params.morphSpeed === "number"
        ? params.morphSpeed
        : DEFAULT_PARAMS.morphSpeed,
    morphAmount:
      typeof params.morphAmount === "number"
        ? params.morphAmount
        : DEFAULT_PARAMS.morphAmount,
    focusDistance:
      typeof params.focusDistance === "number"
        ? params.focusDistance
        : DEFAULT_PARAMS.focusDistance,
    aperture:
      typeof params.aperture === "number"
        ? params.aperture
        : DEFAULT_PARAMS.aperture,
    maxBlur:
      typeof params.maxBlur === "number"
        ? params.maxBlur
        : DEFAULT_PARAMS.maxBlur,
    dofEnabled:
      typeof params.dofEnabled === "boolean"
        ? params.dofEnabled
        : DEFAULT_PARAMS.dofEnabled,
    topoLineWidth:
      typeof params.topoLineWidth === "number"
        ? params.topoLineWidth
        : DEFAULT_PARAMS.topoLineWidth,
    cloudType:
      typeof params.cloudType === "number"
        ? params.cloudType
        : DEFAULT_PARAMS.cloudType,
    godRays:
      typeof params.godRays === "boolean"
        ? params.godRays
        : DEFAULT_PARAMS.godRays,
    octagramType:
      typeof params.octagramType === "number"
        ? params.octagramType
        : DEFAULT_PARAMS.octagramType,
    octagramAltitude:
      typeof params.octagramAltitude === "number"
        ? params.octagramAltitude
        : DEFAULT_PARAMS.octagramAltitude,
    octagramDensity:
      typeof params.octagramDensity === "number"
        ? params.octagramDensity
        : DEFAULT_PARAMS.octagramDensity,
    octagramTrails:
      typeof params.octagramTrails === "boolean"
        ? params.octagramTrails
        : DEFAULT_PARAMS.octagramTrails,
    octagramColorCycle:
      typeof params.octagramColorCycle === "boolean"
        ? params.octagramColorCycle
        : DEFAULT_PARAMS.octagramColorCycle,
  };

  const colors = Array.isArray(candidate.colors)
    ? candidate.colors.filter(isColorRgb).slice(0, 8)
    : [];
  if (colors.length < 2) return null;

  return {
    animationType: candidate.animationType,
    params: normalizedParams,
    colors,
  };
}

function readSharedSceneBundle(): {
  scene: SceneState;
  name: string | null;
} | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(SHARE_PARAM_KEY);
    if (!raw) return null;

    const compact = parseCompactSharedScene(raw);
    if (compact) return compact;

    const scene = normalizeSceneState(JSON.parse(decodeURIComponent(raw)));
    if (!scene) return null;

    const legacyNameRaw = url.searchParams.get(SHARE_NAME_PARAM_KEY);
    const legacyName = legacyNameRaw
      ? decodeURIComponent(legacyNameRaw).trim().slice(0, 80)
      : "";

    return {
      scene,
      name: legacyName || null,
    };
  } catch {
    return null;
  }
}

function readSharedSceneName(): string | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(SHARE_NAME_PARAM_KEY);
    if (!raw) return null;
    const name = decodeURIComponent(raw).trim();
    return name ? name.slice(0, 80) : null;
  } catch {
    return null;
  }
}

function readSessionScene(): SceneState | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? normalizeSceneState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function readSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): SavedPreset | null => {
        const scene = normalizeSceneState(item);
        if (
          !scene ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.createdAt !== "string"
        ) {
          return null;
        }

        return {
          ...scene,
          id: item.id,
          name: item.name,
          createdAt: item.createdAt,
        };
      })
      .filter((item): item is SavedPreset => item !== null);
  } catch {
    return [];
  }
}

function readRecentScenes(): RecentScene[] {
  try {
    const raw = localStorage.getItem(RECENT_SCENES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): RecentScene | null => {
        const scene = normalizeSceneState(item);
        if (
          !scene ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.seenAt !== "string"
        ) {
          return null;
        }

        const source =
          item.source === "preset" ||
          item.source === "shared" ||
          item.source === "live"
            ? item.source
            : "live";

        return {
          ...scene,
          id: item.id,
          name: item.name,
          seenAt: item.seenAt,
          source,
        };
      })
      .filter((item): item is RecentScene => item !== null);
  } catch {
    return [];
  }
}

function readOnboardingDismissed() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function App() {
  const sharedSceneBundle = readSharedSceneBundle();
  const sharedSceneName = sharedSceneBundle?.name ?? readSharedSceneName();
  const initialScene = sharedSceneBundle?.scene ??
    readSessionScene() ?? {
      animationType: "liquid" as AnimationType,
      params: DEFAULT_PARAMS,
      colors: DEFAULT_COLORS,
    };

  const [params, setParams] = useState<GradientParams>(initialScene.params);
  const [colors, setColors] = useState<ColorRgb[]>(initialScene.colors);
  const [renderColors, setRenderColors] = useState<ColorRgb[]>(
    initialScene.colors,
  );
  const [animationType, setAnimationType] = useState<AnimationType>(
    initialScene.animationType,
  );
  const [uiVisible, setUiVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [savedPresets, setSavedPresets] =
    useState<SavedPreset[]>(readSavedPresets);
  const [recentScenes, setRecentScenes] =
    useState<RecentScene[]>(readRecentScenes);
  const [rendererStatus, setRendererStatus] = useState<RendererStatus | null>(
    null,
  );
  const [toast, setToast] = useState<ToastState | null>(null);
  const [viewMode, setViewMode] = useState<"compact" | "advanced">("compact");
  const [workflowLocks, setWorkflowLocks] = useState<WorkflowLocks>({
    mode: false,
    palette: false,
    seed: false,
    motion: false,
  });
  const [pastScenes, setPastScenes] = useState<SceneState[]>([]);
  const [futureScenes, setFutureScenes] = useState<SceneState[]>([]);
  const [renderScale, setRenderScale] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [activeSceneName, setActiveSceneName] = useState<string | null>(
    sharedSceneName,
  );
  const [loopSafePreview, setLoopSafePreview] = useState<{
    durationSeconds: number;
    startedAt: number;
  } | null>(null);
  const [externalRenderTime, setExternalRenderTime] = useState<number | null>(
    null,
  );
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [modeTransition, setModeTransition] =
    useState<ModeTransitionState | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(() =>
    readOnboardingDismissed() ? null : 0,
  );
  const [exportStatus, setExportStatus] = useState<ExportStatusState>({
    phase: "idle",
    label: "Ready",
    progress: 0,
  });
  const previousSceneRef = useRef<SceneState>(cloneScene(initialScene));
  const suppressHistoryRef = useRef(false);
  const renderColorsRef = useRef<ColorRgb[]>(initialScene.colors);
  const paletteTransitionFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const loopPreviewFrameRef = useRef<number | null>(null);
  const exportProgressFrameRef = useRef<number | null>(null);
  const exportResetTimeoutRef = useRef<number | null>(null);
  const savePresetInputRef = useRef<HTMLInputElement | null>(null);
  const modeTransitionTimeoutRef = useRef<number | null>(null);
  const storageErrorToastRef = useRef<string | null>(null);
  const previousExportPhaseRef = useRef<ExportStatusState["phase"]>("idle");
  const rendererRef = useRef<RendererHandle | null>(null);

  const currentScene: SceneState = {
    animationType,
    params,
    colors,
  };

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (
      exportStatus.phase === "complete" &&
      previousExportPhaseRef.current !== "complete"
    ) {
      void confetti({
        particleCount: 90,
        spread: 70,
        startVelocity: 28,
        origin: { x: 0.85, y: 0.18 },
        colors: ["#F2622F", "#FF9B5C", "#FFE3D2", "#FFFFFF"],
      });
    }

    previousExportPhaseRef.current = exportStatus.phase;
  }, [exportStatus.phase]);

  useEffect(() => {
    if (onboardingStep === null || onboardingStep === 0) return;

    const step = ONBOARDING_STEPS[onboardingStep];
    const target = document.getElementById(step.targetId);
    const panel = document.getElementById("panel");
    if (!target || !panel) return;

    const targetRect = target.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const currentScroll = panel.scrollTop;
    const targetOffset = targetRect.top - panelRect.top + currentScroll;
    const desiredTop = Math.max(0, targetOffset - 120);

    panel.scrollTo({
      top: desiredTop,
      behavior: "smooth",
    });
  }, [onboardingStep]);

  useEffect(() => {
    if (!sharedSceneName) return;
    recordRecentScene(initialScene, sharedSceneName, "shared");
    showToast("Shared scene loaded", sharedSceneName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSavePresetOpen) return;
    const focusTimer = window.setTimeout(() => {
      savePresetInputRef.current?.focus();
      savePresetInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isSavePresetOpen]);

  useEffect(() => {
    renderColorsRef.current = renderColors;
  }, [renderColors]);

  useEffect(() => {
    if (palettesEqual(renderColorsRef.current, colors)) {
      setRenderColors(colors);
      renderColorsRef.current = colors;
      return;
    }

    if (paletteTransitionFrameRef.current !== null) {
      cancelAnimationFrame(paletteTransitionFrameRef.current);
    }

    const startPalette = renderColorsRef.current;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const linearProgress = Math.min(
        1,
        (now - startedAt) / PALETTE_TRANSITION_MS,
      );
      const easedProgress = easeInOutCubic(linearProgress);
      const nextPalette = interpolatePalettes(
        startPalette,
        colors,
        easedProgress,
      );
      renderColorsRef.current = nextPalette;
      setRenderColors(nextPalette);

      if (linearProgress < 1) {
        paletteTransitionFrameRef.current = requestAnimationFrame(animate);
      } else {
        renderColorsRef.current = colors;
        setRenderColors(colors);
        paletteTransitionFrameRef.current = null;
      }
    };

    paletteTransitionFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (paletteTransitionFrameRef.current !== null) {
        cancelAnimationFrame(paletteTransitionFrameRef.current);
        paletteTransitionFrameRef.current = null;
      }
    };
  }, [colors]);

  useEffect(() => {
    return () => {
      if (paletteTransitionFrameRef.current !== null) {
        cancelAnimationFrame(paletteTransitionFrameRef.current);
      }
      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
      }
      if (loopPreviewFrameRef.current !== null) {
        cancelAnimationFrame(loopPreviewFrameRef.current);
      }
      if (exportProgressFrameRef.current !== null) {
        cancelAnimationFrame(exportProgressFrameRef.current);
      }
      if (exportResetTimeoutRef.current !== null) {
        window.clearTimeout(exportResetTimeoutRef.current);
      }
      if (modeTransitionTimeoutRef.current !== null) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!loopSafePreview) {
      setExternalRenderTime(null);
      if (loopPreviewFrameRef.current !== null) {
        cancelAnimationFrame(loopPreviewFrameRef.current);
        loopPreviewFrameRef.current = null;
      }
      return;
    }

    const durationMs = loopSafePreview.durationSeconds * 1000;
    const halfDurationMs = durationMs / 2;

    const tick = (now: number) => {
      const elapsed = Math.min(durationMs, now - loopSafePreview.startedAt);
      const mirroredElapsed =
        elapsed <= halfDurationMs ? elapsed : durationMs - elapsed;
      const seconds = (mirroredElapsed / 1000) * params.speed;
      setExternalRenderTime(seconds);

      if (elapsed < durationMs) {
        loopPreviewFrameRef.current = requestAnimationFrame(tick);
      } else {
        loopPreviewFrameRef.current = null;
      }
    };

    loopPreviewFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (loopPreviewFrameRef.current !== null) {
        cancelAnimationFrame(loopPreviewFrameRef.current);
        loopPreviewFrameRef.current = null;
      }
    };
  }, [loopSafePreview, params.speed]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(serializeSceneForPersistence(currentScene)),
      );
    } catch (error) {
      if (storageErrorToastRef.current !== "session") {
        storageErrorToastRef.current = "session";
        showToast(
          "Storage unavailable",
          "Session changes could not be saved locally.",
        );
      }
    }
  }, [animationType, params, colors]);

  useEffect(() => {
    try {
      localStorage.setItem(
        PRESETS_STORAGE_KEY,
        JSON.stringify(
          savedPresets.map((preset) => ({
            ...serializeSceneForPersistence(preset),
            id: preset.id,
            name: preset.name,
            createdAt: preset.createdAt,
          })),
        ),
      );
      if (storageErrorToastRef.current === "presets") {
        storageErrorToastRef.current = null;
      }
    } catch {
      if (storageErrorToastRef.current !== "presets") {
        storageErrorToastRef.current = "presets";
        showToast(
          "Preset save failed",
          "Local storage is full or unavailable. Delete old presets and try again.",
        );
      }
    }
  }, [savedPresets]);

  useEffect(() => {
    try {
      localStorage.setItem(
        RECENT_SCENES_STORAGE_KEY,
        JSON.stringify(
          recentScenes.map((scene) => ({
            ...serializeSceneForPersistence(scene),
            id: scene.id,
            name: scene.name,
            seenAt: scene.seenAt,
            source: scene.source,
          })),
        ),
      );
    } catch {
      if (storageErrorToastRef.current !== "recent-scenes") {
        storageErrorToastRef.current = "recent-scenes";
        showToast(
          "Storage unavailable",
          "Recent scenes could not be stored locally.",
        );
      }
    }
  }, [recentScenes]);

  useEffect(() => {
    const previousScene = previousSceneRef.current;
    if (sceneKey(previousScene) === sceneKey(currentScene)) {
      return;
    }

    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
      previousSceneRef.current = cloneScene(currentScene);
      return;
    }

    setPastScenes((prev) => [
      ...prev.slice(-(HISTORY_LIMIT - 1)),
      cloneScene(previousScene),
    ]);
    setFutureScenes([]);
    previousSceneRef.current = cloneScene(currentScene);
  }, [currentScene]);

  const applyScene = (scene: SceneState) => {
    suppressHistoryRef.current = true;
    startModeTransition(scene.animationType);
    setParams(scene.params);
    setColors(scene.colors);
  };

  function startModeTransition(nextType: AnimationType) {
    if (nextType === animationType) return;

    const activeCanvas = rendererRef.current?.getCanvas();
    if (activeCanvas) {
      try {
        const imageUrl = activeCanvas.toDataURL("image/png");
        setModeTransition({
          id: Date.now(),
          imageUrl,
        });
        if (modeTransitionTimeoutRef.current !== null) {
          window.clearTimeout(modeTransitionTimeoutRef.current);
        }
        modeTransitionTimeoutRef.current = window.setTimeout(() => {
          setModeTransition(null);
          modeTransitionTimeoutRef.current = null;
        }, 620);
      } catch {
        setModeTransition(null);
      }
    } else {
      setModeTransition(null);
    }

    setAnimationType(nextType);

    if (nextType === "clouds") {
      // Noon sky defaults: blue sky, warm white clouds, golden sun, cool shadow
      setColors([
        [100, 168, 210],
        [245, 240, 232],
        [255, 195, 100],
        [160, 172, 185],
      ]);
    }
    if (nextType === "sea") {
      // Ocean defaults: deep blue, sea-foam green, sky blue, golden sun
      setColors([
        [0, 23, 46],
        [122, 138, 92],
        [100, 168, 210],
        [255, 195, 100],
      ]);
    }
    if (nextType === "prism") {
      // Spectral defaults: red, green, blue channels with dark ambient
      setColors([
        [255, 30, 30],
        [30, 255, 30],
        [30, 30, 255],
        [0, 0, 0],
      ]);
    }
    if (nextType === "octagrams") {
      // Orbital defaults: cyan primary, violet mid, gold highlight, near-black bg
      setColors([
        [30, 200, 255],
        [180, 0, 255],
        [255, 200, 50],
        [5, 0, 20],
      ]);
    }
  }

  const showToast = (title: string, message?: string) => {
    setToast({
      id: Date.now(),
      title,
      message,
    });
  };

  const handleRendererBoundaryError = (status: RendererStatus) => {
    setRendererStatus(status);
    showToast(status.title, status.message);
  };

  const dismissOnboarding = () => {
    setOnboardingStep(null);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // Ignore storage failures and keep onboarding dismissible for the session.
    }
  };

  const advanceOnboarding = () => {
    setOnboardingStep((current) => {
      if (current === null) return null;
      if (current >= ONBOARDING_STEPS.length - 1) {
        try {
          localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
        } catch {
          // Ignore storage failures and keep onboarding dismissible for the session.
        }
        return null;
      }
      return current + 1;
    });
  };

  const scheduleExportReset = () => {
    if (exportResetTimeoutRef.current !== null) {
      window.clearTimeout(exportResetTimeoutRef.current);
    }

    exportResetTimeoutRef.current = window.setTimeout(() => {
      setExportStatus({
        phase: "idle",
        label: "Ready",
        progress: 0,
      });
      exportResetTimeoutRef.current = null;
    }, 2200);
  };

  const getSceneName = (scene: SceneState) => {
    const matchingPreset = savedPresets.find(
      (preset) => sceneKey(cloneScene(preset)) === sceneKey(scene),
    );
    if (matchingPreset) {
      return matchingPreset.name;
    }

    return `${animationTypeLabel(scene.animationType)} Scene`;
  };

  const recordRecentScene = (
    scene: SceneState,
    name: string,
    source: RecentScene["source"],
  ) => {
    const sceneSignature = sceneKey(scene);
    setRecentScenes((prev) => {
      const nextEntry: RecentScene = {
        ...cloneScene(scene),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        source,
        seenAt: new Date().toISOString(),
      };

      return [
        nextEntry,
        ...prev
          .filter((entry) => sceneKey(entry) !== sceneSignature)
          .slice(0, RECENT_SCENES_LIMIT - 1),
      ];
    });
  };

  const handleDeleteRecentScene = (id: string) => {
    const deletedScene = recentScenes.find((scene) => scene.id === id);
    setRecentScenes((prev) => prev.filter((scene) => scene.id !== id));
    showToast("Recent scene removed", deletedScene?.name);
  };

  const handleSavePreset = () => {
    const suggestedName =
      activeSceneName ??
      `${animationTypeLabel(animationType)} ${new Date().toLocaleDateString()}`;
    setSavePresetName(suggestedName);
    setIsSavePresetOpen(true);
  };

  const closeSavePresetDialog = () => {
    setIsSavePresetOpen(false);
    setSavePresetName("");
  };

  const submitSavePreset = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const name = savePresetName.trim();
    if (!name) return;

    const duplicateCount = savedPresets.filter(
      (preset) => preset.name.toLowerCase() === name.toLowerCase(),
    ).length;
    const finalName =
      duplicateCount > 0 ? `${name} ${duplicateCount + 1}` : name;
    setSavedPresets((prev) => [
      {
        ...currentScene,
        id: `${Date.now()}`,
        name: finalName,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setActiveSceneName(finalName);
    recordRecentScene(currentScene, finalName, "preset");
    closeSavePresetDialog();
    showToast("Preset saved", finalName);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    applyScene(preset);
    setActiveSceneName(preset.name);
    recordRecentScene(preset, preset.name, "preset");
    showToast("Preset loaded", preset.name);
  };

  const handleLoadRecentScene = (scene: RecentScene) => {
    applyScene(scene);
    setActiveSceneName(scene.name);
    recordRecentScene(scene, scene.name, scene.source);
    showToast("Recent scene loaded", scene.name);
  };

  const handleDeletePreset = (id: string) => {
    const deletedPreset = savedPresets.find((preset) => preset.id === id);
    setSavedPresets((prev) => prev.filter((preset) => preset.id !== id));
    if (deletedPreset && deletedPreset.name === activeSceneName) {
      setActiveSceneName(null);
    }
    showToast("Preset deleted", deletedPreset?.name);
  };

  const handleShareScene = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set(
      SHARE_PARAM_KEY,
      serializeShareScene(
        currentScene,
        activeSceneName ?? getSceneName(currentScene),
      ),
    );
    url.searchParams.delete(SHARE_NAME_PARAM_KEY);

    try {
      await navigator.clipboard.writeText(url.toString());
      recordRecentScene(
        currentScene,
        activeSceneName ?? getSceneName(currentScene),
        "shared",
      );
      showToast(
        "Share link copied",
        activeSceneName ?? getSceneName(currentScene),
      );
    } catch {
      window.prompt("Copy this share link", url.toString());
    }
  };

  const captureCanvasBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve);
    });

  const waitForPaint = async (frames = 2) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    }
  };

  const handleExportImage = async (scale = 1) => {
    const canvas = rendererRef.current?.getCanvas();
    if (!canvas) {
      setExportStatus({
        phase: "error",
        label: "Export failed",
        detail: "No active canvas found.",
        progress: 0,
      });
      scheduleExportReset();
      showToast("Export failed", "No active canvas found to export.");
      return;
    }

    try {
      setExportStatus({
        phase: "preparing",
        label: scale > 1 ? `Preparing ${scale}x PNG` : "Preparing PNG",
        detail: "Configuring canvas for capture.",
        progress: 15,
      });

      if (scale > 1) {
        setRenderScale(scale);
        await waitForPaint(3);
      }

      setExportStatus({
        phase: "capturing",
        label: scale > 1 ? `Capturing ${scale}x PNG` : "Capturing PNG",
        detail: "Rendering the current frame.",
        progress: 62,
        frameCount: 1,
        frameTotal: 1,
      });

      const exportCanvas = rendererRef.current?.getCanvas() ?? canvas;
      const blob = await captureCanvasBlob(exportCanvas);
      if (!blob) {
        setExportStatus({
          phase: "error",
          label: "Export failed",
          detail: "The browser could not encode the image.",
          progress: 0,
        });
        scheduleExportReset();
        showToast("Export failed", "Image export failed.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `color-motion-${animationType}-${scale}x-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus({
        phase: "complete",
        label: scale > 1 ? `${scale}x PNG ready` : "PNG ready",
        detail: "Download started.",
        progress: 100,
      });
      scheduleExportReset();
      showToast(scale > 1 ? `${scale}x PNG exported` : "PNG exported");
    } finally {
      if (scale > 1) {
        setRenderScale(1);
      }
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRecordVideo = async (
    durationSeconds: number,
    loopSafe = false,
  ) => {
    if (isRecording) {
      showToast("Recording in progress");
      return;
    }

    if (
      loopSafe &&
      !(
        rendererRef.current?.supportsLoopSafeExport ??
        supportsLoopSafeExport(animationType)
      )
    ) {
      setExportStatus({
        phase: "error",
        label: "Loop-safe export unavailable",
        detail: "Choose liquid, waves, voronoi, or blobs.",
        progress: 0,
      });
      scheduleExportReset();
      showToast(
        "Loop-safe export unavailable",
        "Use liquid, waves, voronoi, or blobs for seamless loop export.",
      );
      return;
    }

    const canvas = rendererRef.current?.getCanvas();
    if (
      !canvas ||
      typeof canvas.captureStream !== "function" ||
      typeof MediaRecorder === "undefined"
    ) {
      setExportStatus({
        phase: "error",
        label: "Recording unavailable",
        detail: "This browser cannot record canvas output.",
        progress: 0,
      });
      scheduleExportReset();
      showToast(
        "Recording unavailable",
        "This browser cannot record canvas output.",
      );
      return;
    }

    const preferredTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType =
      preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";

    try {
      setIsRecording(true);
      setExportStatus({
        phase: "preparing",
        label: loopSafe ? "Preparing loop-safe WebM" : "Preparing WebM",
        detail: "Setting up recorder.",
        progress: 8,
      });
      if (loopSafe) {
        setLoopSafePreview({
          durationSeconds,
          startedAt: performance.now(),
        });
      }
      await waitForPaint(2);

      const stream = canvas.captureStream(60);
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setLoopSafePreview(null);
        stream.getTracks().forEach((track) => track.stop());
        setExportStatus({
          phase: "error",
          label: "Recording failed",
          detail: "The browser stopped the video export.",
          progress: 0,
        });
        scheduleExportReset();
        showToast("Recording failed", "The browser stopped the video export.");
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        if (recordingTimeoutRef.current !== null) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        if (chunks.length > 0) {
          setExportStatus({
            phase: "encoding",
            label: "Encoding WebM",
            detail: "Finalizing video file.",
            progress: 96,
          });
          downloadBlob(
            new Blob(chunks, { type: mimeType || "video/webm" }),
            `color-motion-${animationType}-${loopSafe ? "loop-" : ""}${durationSeconds}s-${Date.now()}.webm`,
          );
          setExportStatus({
            phase: "complete",
            label: "WebM ready",
            detail: loopSafe
              ? "Loop-safe clip downloaded."
              : `${durationSeconds}s clip downloaded.`,
            progress: 100,
          });
          scheduleExportReset();
          showToast(
            "WebM exported",
            loopSafe
              ? "Loop-safe clip ready"
              : `${durationSeconds}s clip ready`,
          );
        } else {
          setExportStatus({
            phase: "error",
            label: "Recording failed",
            detail: "No video frames were captured.",
            progress: 0,
          });
          scheduleExportReset();
          showToast("Recording failed", "No video frames were captured.");
        }

        setLoopSafePreview(null);
        setIsRecording(false);
      };

      recorder.start();
      const startedAt = performance.now();
      const updateProgress = (now: number) => {
        const elapsed = Math.min(durationSeconds * 1000, now - startedAt);
        const progress =
          18 + Math.round((elapsed / (durationSeconds * 1000)) * 72);
        const frameCount = Math.min(
          Math.round((elapsed / 1000) * 60),
          durationSeconds * 60,
        );
        setExportStatus({
          phase: "recording",
          label: loopSafe ? "Recording loop-safe WebM" : "Recording WebM",
          detail: `${Math.ceil((durationSeconds * 1000 - elapsed) / 1000)}s remaining`,
          progress,
          frameCount,
          frameTotal: durationSeconds * 60,
        });

        if (elapsed < durationSeconds * 1000) {
          exportProgressFrameRef.current =
            requestAnimationFrame(updateProgress);
        } else {
          exportProgressFrameRef.current = null;
        }
      };
      if (exportProgressFrameRef.current !== null) {
        cancelAnimationFrame(exportProgressFrameRef.current);
      }
      exportProgressFrameRef.current = requestAnimationFrame(updateProgress);
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      }, durationSeconds * 1000);
      showToast(
        "Recording started",
        loopSafe ? "Loop-safe WebM clip" : `${durationSeconds}s WebM clip`,
      );
    } catch {
      setIsRecording(false);
      setLoopSafePreview(null);
      setExportStatus({
        phase: "error",
        label: "Recording failed",
        detail: "Unable to start video export.",
        progress: 0,
      });
      scheduleExportReset();
      showToast("Recording failed", "Unable to start video export.");
    }
  };

  const handleResetMode = () => {
    setParams(DEFAULT_PARAMS);
    setPaused(false);
    setActiveSceneName(null);
    showToast("Mode reset", `Reset ${animationType} controls`);
  };

  const handleResetPalette = () => {
    setColors(DEFAULT_COLORS);
    setActiveSceneName(null);
    showToast("Palette reset");
  };

  const handleResetScene = () => {
    startModeTransition("liquid");
    setParams(DEFAULT_PARAMS);
    setColors(DEFAULT_COLORS);
    setPaused(false);
    setActiveSceneName(null);
    showToast("Scene reset", "Restored the default scene");
  };

  const handleUndo = () => {
    const previousScene = pastScenes[pastScenes.length - 1];
    if (!previousScene) return;

    setPastScenes((prev) => prev.slice(0, -1));
    setFutureScenes((prev) => [cloneScene(currentScene), ...prev]);
    applyScene(previousScene);
    showToast("Undid last change");
  };

  const handleRedo = () => {
    const nextScene = futureScenes[0];
    if (!nextScene) return;

    setFutureScenes((prev) => prev.slice(1));
    setPastScenes((prev) => [
      ...prev.slice(-(HISTORY_LIMIT - 1)),
      cloneScene(currentScene),
    ]);
    applyScene(nextScene);
    showToast("Redid change");
  };

  const toggleWorkflowLock = (key: keyof WorkflowLocks) => {
    setWorkflowLocks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRandomizeMode = () => {
    if (workflowLocks.mode) {
      showToast("Mode lock enabled", "Unlock mode to randomize it.");
      return;
    }

    const nextMode = randomAnimationType();
    startModeTransition(nextMode);
    showToast("Mode randomized");
  };

  const handleRandomizePalette = () => {
    if (workflowLocks.palette) {
      showToast("Palette lock enabled", "Unlock palette to randomize it.");
      return;
    }

    setColors(randomPaletteColors());
    showToast("Palette randomized");
  };

  const handleRandomizeParams = () => {
    if (workflowLocks.motion && workflowLocks.seed) {
      showToast(
        "Parameter locks enabled",
        "Unlock seed or motion controls to randomize them.",
      );
      return;
    }

    setParams((prev) => randomParams(prev, workflowLocks, animationType));
    showToast("Parameters randomized");
  };

  const handleRandomizeScene = () => {
    if (!workflowLocks.mode) {
      startModeTransition(randomAnimationType());
    }
    if (!workflowLocks.palette) {
      setColors(randomPaletteColors());
    }
    if (!(workflowLocks.motion && workflowLocks.seed)) {
      setParams((prev) => randomParams(prev, workflowLocks, animationType));
    }
    showToast("Scene randomized");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSavePresetOpen && e.key === "Escape") {
        e.preventDefault();
        closeSavePresetDialog();
        return;
      }

      if (isShortcutsOpen && e.key === "Escape") {
        e.preventDefault();
        setIsShortcutsOpen(false);
        return;
      }

      if (onboardingStep !== null && e.key === "Escape") {
        e.preventDefault();
        dismissOnboarding();
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditableTarget =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isEditableTarget) {
        return;
      }

      const modifierKey = e.ctrlKey || e.metaKey;
      const lowerKey = e.key.toLowerCase();

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsOpen((open) => !open);
        return;
      }

      if (modifierKey && !e.shiftKey && lowerKey === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (
        modifierKey &&
        (lowerKey === "y" || (e.shiftKey && lowerKey === "z"))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (lowerKey === "r") {
        e.preventDefault();
        handleRandomizeScene();
        return;
      }

      if (lowerKey === "s") {
        e.preventDefault();
        handleSavePreset();
        return;
      }

      if (lowerKey === "h") setUiVisible((v) => !v);
      if (lowerKey === "f") toggleFullscreen();
      if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isSavePresetOpen,
    isShortcutsOpen,
    onboardingStep,
    handleRedo,
    handleRandomizeScene,
    handleSavePreset,
    handleUndo,
  ]);

  return (
    <>
      <RendererBoundary
        resetKey={animationType}
        onError={handleRendererBoundaryError}
      >
        {animationType === "liquid" && (
          <LiquidCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "waves" && (
          <WavesCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "voronoi" && (
          <VoronoiCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "three" && (
          <ThreeJSCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "turing" && (
          <TuringCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
          />
        )}
        {animationType === "particles" && (
          <ParticlesCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
          />
        )}
        {animationType === "blobs" && (
          <BlobsCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "topographic" && (
          <TopographicCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "neondrip" && (
          <NeonDripCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "clouds" && (
          <CloudsCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "sea" && (
          <SeaCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "prism" && (
          <PrismCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
        {animationType === "octagrams" && (
          <OctagramsCanvas
            ref={rendererRef}
            params={params}
            colors={renderColors}
            paused={paused}
            onStatusChange={setRendererStatus}
            renderScale={renderScale}
            externalTime={externalRenderTime}
          />
        )}
      </RendererBoundary>

      {modeTransition && (
        <div
          key={modeTransition.id}
          className="renderer-transition-overlay"
          style={{ backgroundImage: `url(${modeTransition.imageUrl})` }}
          aria-hidden="true"
        />
      )}

      {rendererStatus && (
        <div
          className="renderer-fallback"
          role="dialog"
          aria-modal="false"
          aria-labelledby="renderer-fallback-title"
        >
          <span className="section-label">Renderer Status</span>
          <strong id="renderer-fallback-title">{rendererStatus.title}</strong>
          <p>{rendererStatus.message}</p>
          <div className="renderer-fallback-actions">
            <a
              className="workspace-btn renderer-fallback-link"
              href={WEBGL_COMPATIBILITY_URL}
              target="_blank"
              rel="noreferrer"
            >
              Compatibility
            </a>
            <button
              type="button"
              className="workspace-btn"
              onClick={() => startModeTransition("particles")}
            >
              Use Particles
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          key={toast.id}
          className="app-toast"
          role="status"
          aria-live="polite"
        >
          <strong>{toast.title}</strong>
          {toast.message && <p>{toast.message}</p>}
        </div>
      )}

      {isSavePresetOpen && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={closeSavePresetDialog}
        >
          <div
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-preset-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-header">
              <span className="section-label">Save Preset</span>
              <button
                className="dialog-close"
                onClick={closeSavePresetDialog}
                aria-label="Close save preset dialog"
              >
                +
              </button>
            </div>
            <form className="dialog-form" onSubmit={submitSavePreset}>
              <div className="dialog-copy">
                <strong id="save-preset-title">Name This Scene</strong>
                <p>
                  Save the current look into your preset library with a reusable
                  title.
                </p>
              </div>
              <label className="dialog-field">
                <span>Preset name</span>
                <input
                  ref={savePresetInputRef}
                  type="text"
                  value={savePresetName}
                  onChange={(event) => setSavePresetName(event.target.value)}
                  maxLength={80}
                  placeholder="Scene name"
                />
              </label>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="workspace-btn"
                  onClick={closeSavePresetDialog}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="workspace-btn"
                  disabled={!savePresetName.trim()}
                >
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isShortcutsOpen && (
        <div
          className="dialog-overlay"
          role="presentation"
          onClick={() => setIsShortcutsOpen(false)}
        >
          <div
            className="dialog-card shortcuts-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dialog-header">
              <span className="section-label">Shortcuts</span>
              <button
                className="dialog-close"
                onClick={() => setIsShortcutsOpen(false)}
                aria-label="Close shortcuts dialog"
              >
                +
              </button>
            </div>
            <div className="dialog-copy">
              <strong id="shortcuts-title">Keyboard Shortcuts</strong>
              <p>
                Shortcuts only run when a text field or search input is not
                focused.
              </p>
            </div>
            <div className="shortcuts-list">
              <div className="shortcut-row">
                <kbd>?</kbd>
                <span>Open or close this shortcuts panel</span>
              </div>
              <div className="shortcut-row">
                <kbd>Space</kbd>
                <span>Pause or resume animation</span>
              </div>
              <div className="shortcut-row">
                <kbd>H</kbd>
                <span>Hide or show the panel</span>
              </div>
              <div className="shortcut-row">
                <kbd>F</kbd>
                <span>Toggle fullscreen</span>
              </div>
              <div className="shortcut-row">
                <kbd>R</kbd>
                <span>Randomize the current scene</span>
              </div>
              <div className="shortcut-row">
                <kbd>S</kbd>
                <span>Save the current scene as a preset</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl/⌘ + Z</kbd>
                <span>Undo the last scene change</span>
              </div>
              <div className="shortcut-row">
                <kbd>Ctrl/⌘ + Y</kbd>
                <span>Redo the next scene change</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="panel" className={uiVisible ? "" : "hidden"}>
        <div className="panel-header">
          <span className="panel-title">{APP_TITLE}</span>
        </div>

        <Panel
          params={params}
          setParams={setParams}
          colors={colors}
          setColors={setColors}
          paused={paused}
          setPaused={setPaused}
          animationType={animationType}
          setAnimationType={startModeTransition}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          hideUI={() => setUiVisible(false)}
          savedPresets={savedPresets}
          recentScenes={recentScenes}
          savePreset={handleSavePreset}
          loadPreset={handleLoadPreset}
          loadRecentScene={handleLoadRecentScene}
          deletePreset={handleDeletePreset}
          deleteRecentScene={handleDeleteRecentScene}
          shareScene={handleShareScene}
          exportImage={handleExportImage}
          recordVideo={handleRecordVideo}
          isRecording={isRecording}
          exportStatus={exportStatus}
          canLoopSafeExport={
            rendererRef.current?.supportsLoopSafeExport ??
            supportsLoopSafeExport(animationType)
          }
          loopSafeDurationSeconds={LOOP_SAFE_DURATION_SECONDS}
          resetMode={handleResetMode}
          resetPalette={handleResetPalette}
          resetScene={handleResetScene}
          viewMode={viewMode}
          setViewMode={setViewMode}
          canUndo={pastScenes.length > 0}
          canRedo={futureScenes.length > 0}
          undo={handleUndo}
          redo={handleRedo}
          randomizeMode={handleRandomizeMode}
          randomizePalette={handleRandomizePalette}
          randomizeParams={handleRandomizeParams}
          randomizeScene={handleRandomizeScene}
          workflowLocks={workflowLocks}
          toggleWorkflowLock={toggleWorkflowLock}
          onboardingStep={onboardingStep}
          onboardingSteps={ONBOARDING_STEPS}
          dismissOnboarding={dismissOnboarding}
          advanceOnboarding={advanceOnboarding}
          openShortcuts={() => setIsShortcutsOpen(true)}
        />
      </div>

      <button
        id="toggle-ui"
        className={uiVisible ? "ui-visible" : ""}
        onClick={() => setUiVisible(true)}
        title="Show controls"
        aria-label="Show controls"
      >
        +
      </button>

      <div id="hint" className={hintVisible ? "" : "fade"}>
        Press H to hide UI | F for fullscreen
      </div>
    </>
  );
}

export default App;
