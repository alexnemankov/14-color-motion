import { FormEvent, useEffect, useRef, useState } from 'react';
import LiquidCanvas from './components/LiquidCanvas';
import WavesCanvas from './components/WavesCanvas';
import VoronoiCanvas from './components/VoronoiCanvas';
import TuringCanvas from './components/TuringCanvas';
import ParticlesCanvas from './components/ParticlesCanvas';
import BlobsCanvas from './components/BlobsCanvas';
import Panel from './components/Panel';
import { PALETTES } from './data/palettes';

export type AnimationType = 'liquid' | 'waves' | 'voronoi' | 'turing' | 'particles' | 'blobs';

export interface GradientParams {
  seed: number;
  speed: number;
  scale: number;
  amplitude: number;
  frequency: number;
  definition: number;
  blend: number;
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
  phase: 'idle' | 'preparing' | 'capturing' | 'recording' | 'encoding' | 'complete' | 'error';
  label: string;
  detail?: string;
  progress: number;
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
  blend: 1.0
};

const SESSION_STORAGE_KEY = 'color-motion-session';
const PRESETS_STORAGE_KEY = 'color-motion-presets';
const SHARE_PARAM_KEY = 'scene';
const SHARE_NAME_PARAM_KEY = 'name';
const VALID_ANIMATION_TYPES: AnimationType[] = ['liquid', 'waves', 'voronoi', 'turing', 'particles', 'blobs'];
const HISTORY_LIMIT = 40;
const PALETTE_TRANSITION_MS = 480;
const LOOP_SAFE_DURATION_SECONDS = 6;

function cloneScene(scene: SceneState): SceneState {
  return {
    animationType: scene.animationType,
    params: { ...scene.params },
    colors: scene.colors.map(color => [...color] as ColorRgb),
  };
}

function sceneKey(scene: SceneState): string {
  return JSON.stringify(scene);
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
  return palette.colors.map(color => {
    const value = parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as ColorRgb;
  });
}

function randomParams(base: GradientParams, locks: Pick<WorkflowLocks, 'seed' | 'motion'>): GradientParams {
  return {
    seed: locks.seed ? base.seed : randomInt(0, 9999),
    speed: locks.motion ? base.speed : randomBetween(0.2, 2.4),
    scale: locks.motion ? base.scale : randomBetween(0.2, 1.4),
    amplitude: locks.motion ? base.amplitude : randomBetween(0.2, 1.6),
    frequency: locks.motion ? base.frequency : randomBetween(0.3, 2.6),
    definition: locks.motion ? base.definition : randomInt(1, 8),
    blend: locks.motion ? base.blend : randomBetween(0.15, 1, 2),
  };
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function palettesEqual(a: ColorRgb[], b: ColorRgb[]) {
  return sceneKey({ animationType: 'liquid', params: DEFAULT_PARAMS, colors: a }) === sceneKey({ animationType: 'liquid', params: DEFAULT_PARAMS, colors: b });
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

  return Array.from({ length: count }, (_, index) => samplePaletteColor(palette, index / (count - 1)));
}

function animationTypeLabel(type: AnimationType) {
  return {
    liquid: 'Liquid',
    waves: 'Waves',
    voronoi: 'Voronoi',
    turing: 'Turing',
    particles: 'Particles',
    blobs: 'Blobs',
  }[type];
}

function supportsLoopSafeExport(type: AnimationType) {
  return type === 'liquid' || type === 'waves' || type === 'voronoi' || type === 'blobs';
}

function interpolatePalettes(from: ColorRgb[], to: ColorRgb[], t: number): ColorRgb[] {
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

function isColorRgb(value: unknown): value is ColorRgb {
  return Array.isArray(value)
    && value.length === 3
    && value.every(channel => typeof channel === 'number' && channel >= 0 && channel <= 255);
}

function normalizeSceneState(value: unknown): SceneState | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<SceneState>;
  const params = candidate.params as Partial<GradientParams> | undefined;

  if (!candidate.animationType || !VALID_ANIMATION_TYPES.includes(candidate.animationType)) return null;
  if (!params) return null;

  const normalizedParams: GradientParams = {
    seed: typeof params.seed === 'number' ? params.seed : DEFAULT_PARAMS.seed,
    speed: typeof params.speed === 'number' ? params.speed : DEFAULT_PARAMS.speed,
    scale: typeof params.scale === 'number' ? params.scale : DEFAULT_PARAMS.scale,
    amplitude: typeof params.amplitude === 'number' ? params.amplitude : DEFAULT_PARAMS.amplitude,
    frequency: typeof params.frequency === 'number' ? params.frequency : DEFAULT_PARAMS.frequency,
    definition: typeof params.definition === 'number' ? params.definition : DEFAULT_PARAMS.definition,
    blend: typeof params.blend === 'number' ? params.blend : DEFAULT_PARAMS.blend,
  };

  const colors = Array.isArray(candidate.colors) ? candidate.colors.filter(isColorRgb).slice(0, 8) : [];
  if (colors.length < 2) return null;

  return {
    animationType: candidate.animationType,
    params: normalizedParams,
    colors,
  };
}

function readSharedScene(): SceneState | null {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(SHARE_PARAM_KEY);
    if (!raw) return null;
    return normalizeSceneState(JSON.parse(decodeURIComponent(raw)));
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
        if (!scene || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.createdAt !== 'string') {
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

function App() {
  const sharedSceneName = readSharedSceneName();
  const initialScene = readSharedScene() ?? readSessionScene() ?? {
    animationType: 'liquid' as AnimationType,
    params: DEFAULT_PARAMS,
    colors: DEFAULT_COLORS,
  };

  const [params, setParams] = useState<GradientParams>(initialScene.params);
  const [colors, setColors] = useState<ColorRgb[]>(initialScene.colors);
  const [renderColors, setRenderColors] = useState<ColorRgb[]>(initialScene.colors);
  const [animationType, setAnimationType] = useState<AnimationType>(initialScene.animationType);
  const [uiVisible, setUiVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(readSavedPresets);
  const [rendererStatus, setRendererStatus] = useState<RendererStatus | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'advanced'>('compact');
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
  const [activeSceneName, setActiveSceneName] = useState<string | null>(sharedSceneName);
  const [loopSafePreview, setLoopSafePreview] = useState<{ durationSeconds: number; startedAt: number } | null>(null);
  const [externalRenderTime, setExternalRenderTime] = useState<number | null>(null);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState('');
  const [exportStatus, setExportStatus] = useState<ExportStatusState>({
    phase: 'idle',
    label: 'Ready',
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
    if (!sharedSceneName) return;
    showToast('Shared scene loaded', sharedSceneName);
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
      const progress = Math.min(1, (now - startedAt) / PALETTE_TRANSITION_MS);
      const nextPalette = interpolatePalettes(startPalette, colors, progress);
      renderColorsRef.current = nextPalette;
      setRenderColors(nextPalette);

      if (progress < 1) {
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
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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
      const mirroredElapsed = elapsed <= halfDurationMs ? elapsed : durationMs - elapsed;
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSavePresetOpen && e.key === 'Escape') {
        e.preventDefault();
        closeSavePresetDialog();
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditableTarget = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT'
        || target.isContentEditable
      );

      if (isEditableTarget) {
        return;
      }

      if (e.key.toLowerCase() === 'h') setUiVisible(v => !v);
      if (e.key.toLowerCase() === 'f') toggleFullscreen();
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(p => !p);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSavePresetOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentScene));
    } catch {
      // Ignore storage failures and keep the live session usable.
    }
  }, [animationType, params, colors]);

  useEffect(() => {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(savedPresets));
    } catch {
      // Ignore storage failures and keep the live session usable.
    }
  }, [savedPresets]);

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

    setPastScenes(prev => [...prev.slice(-(HISTORY_LIMIT - 1)), cloneScene(previousScene)]);
    setFutureScenes([]);
    previousSceneRef.current = cloneScene(currentScene);
  }, [currentScene]);

  const applyScene = (scene: SceneState) => {
    suppressHistoryRef.current = true;
    setAnimationType(scene.animationType);
    setParams(scene.params);
    setColors(scene.colors);
  };

  const showToast = (title: string, message?: string) => {
    setToast({
      id: Date.now(),
      title,
      message,
    });
  };

  const scheduleExportReset = () => {
    if (exportResetTimeoutRef.current !== null) {
      window.clearTimeout(exportResetTimeoutRef.current);
    }

    exportResetTimeoutRef.current = window.setTimeout(() => {
      setExportStatus({
        phase: 'idle',
        label: 'Ready',
        progress: 0,
      });
      exportResetTimeoutRef.current = null;
    }, 2200);
  };

  const getSceneName = (scene: SceneState) => {
    const matchingPreset = savedPresets.find(preset => sceneKey(cloneScene(preset)) === sceneKey(scene));
    if (matchingPreset) {
      return matchingPreset.name;
    }

    return `${animationTypeLabel(scene.animationType)} Scene`;
  };

  const handleSavePreset = () => {
    const suggestedName = activeSceneName ?? `${animationTypeLabel(animationType)} ${new Date().toLocaleDateString()}`;
    setSavePresetName(suggestedName);
    setIsSavePresetOpen(true);
  };

  const closeSavePresetDialog = () => {
    setIsSavePresetOpen(false);
    setSavePresetName('');
  };

  const submitSavePreset = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const name = savePresetName.trim();
    if (!name) return;

    const duplicateCount = savedPresets.filter(preset => preset.name.toLowerCase() === name.toLowerCase()).length;
    const finalName = duplicateCount > 0 ? `${name} ${duplicateCount + 1}` : name;
    setSavedPresets(prev => [
      {
        ...currentScene,
        id: `${Date.now()}`,
        name: finalName,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setActiveSceneName(finalName);
    closeSavePresetDialog();
    showToast('Preset saved', finalName);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    applyScene(preset);
    setActiveSceneName(preset.name);
    showToast('Preset loaded', preset.name);
  };

  const handleDeletePreset = (id: string) => {
    const deletedPreset = savedPresets.find(preset => preset.id === id);
    setSavedPresets(prev => prev.filter(preset => preset.id !== id));
    if (deletedPreset && deletedPreset.name === activeSceneName) {
      setActiveSceneName(null);
    }
    showToast('Preset deleted', deletedPreset?.name);
  };

  const handleShareScene = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM_KEY, encodeURIComponent(JSON.stringify(currentScene)));
    url.searchParams.set(SHARE_NAME_PARAM_KEY, encodeURIComponent(activeSceneName ?? getSceneName(currentScene)));

    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('Share link copied', activeSceneName ?? getSceneName(currentScene));
    } catch {
      window.prompt('Copy this share link', url.toString());
    }
  };

  const captureCanvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>(resolve => {
    canvas.toBlob(resolve);
  });

  const waitForPaint = async (frames = 2) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    }
  };

  const handleExportImage = async (scale = 1) => {
    const canvas = document.getElementById('c') as HTMLCanvasElement | null;
    if (!canvas) {
      setExportStatus({
        phase: 'error',
        label: 'Export failed',
        detail: 'No active canvas found.',
        progress: 0,
      });
      scheduleExportReset();
      showToast('Export failed', 'No active canvas found to export.');
      return;
    }

    try {
      setExportStatus({
        phase: 'preparing',
        label: scale > 1 ? `Preparing ${scale}x PNG` : 'Preparing PNG',
        detail: 'Configuring canvas for capture.',
        progress: 15,
      });

      if (scale > 1) {
        setRenderScale(scale);
        await waitForPaint(3);
      }

      setExportStatus({
        phase: 'capturing',
        label: scale > 1 ? `Capturing ${scale}x PNG` : 'Capturing PNG',
        detail: 'Rendering the current frame.',
        progress: 62,
      });

      const exportCanvas = (document.getElementById('c') as HTMLCanvasElement | null) ?? canvas;
      const blob = await captureCanvasBlob(exportCanvas);
      if (!blob) {
        setExportStatus({
          phase: 'error',
          label: 'Export failed',
          detail: 'The browser could not encode the image.',
          progress: 0,
        });
        scheduleExportReset();
        showToast('Export failed', 'Image export failed.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `color-motion-${animationType}-${scale}x-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus({
        phase: 'complete',
        label: scale > 1 ? `${scale}x PNG ready` : 'PNG ready',
        detail: 'Download started.',
        progress: 100,
      });
      scheduleExportReset();
      showToast(scale > 1 ? `${scale}x PNG exported` : 'PNG exported');
    } finally {
      if (scale > 1) {
        setRenderScale(1);
      }
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRecordVideo = async (durationSeconds: number, loopSafe = false) => {
    if (isRecording) {
      showToast('Recording in progress');
      return;
    }

    if (loopSafe && !supportsLoopSafeExport(animationType)) {
      setExportStatus({
        phase: 'error',
        label: 'Loop-safe export unavailable',
        detail: 'Choose liquid, waves, voronoi, or blobs.',
        progress: 0,
      });
      scheduleExportReset();
      showToast('Loop-safe export unavailable', 'Use liquid, waves, voronoi, or blobs for seamless loop export.');
      return;
    }

    const canvas = document.getElementById('c') as HTMLCanvasElement | null;
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      setExportStatus({
        phase: 'error',
        label: 'Recording unavailable',
        detail: 'This browser cannot record canvas output.',
        progress: 0,
      });
      scheduleExportReset();
      showToast('Recording unavailable', 'This browser cannot record canvas output.');
      return;
    }

    const preferredTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = preferredTypes.find(type => MediaRecorder.isTypeSupported(type)) ?? '';

    try {
      setIsRecording(true);
      setExportStatus({
        phase: 'preparing',
        label: loopSafe ? 'Preparing loop-safe WebM' : 'Preparing WebM',
        detail: 'Setting up recorder.',
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
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onerror = () => {
        setIsRecording(false);
        setLoopSafePreview(null);
        stream.getTracks().forEach(track => track.stop());
        setExportStatus({
          phase: 'error',
          label: 'Recording failed',
          detail: 'The browser stopped the video export.',
          progress: 0,
        });
        scheduleExportReset();
        showToast('Recording failed', 'The browser stopped the video export.');
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
        if (recordingTimeoutRef.current !== null) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        if (chunks.length > 0) {
          setExportStatus({
            phase: 'encoding',
            label: 'Encoding WebM',
            detail: 'Finalizing video file.',
            progress: 96,
          });
          downloadBlob(
            new Blob(chunks, { type: mimeType || 'video/webm' }),
            `color-motion-${animationType}-${loopSafe ? 'loop-' : ''}${durationSeconds}s-${Date.now()}.webm`
          );
          setExportStatus({
            phase: 'complete',
            label: 'WebM ready',
            detail: loopSafe ? 'Loop-safe clip downloaded.' : `${durationSeconds}s clip downloaded.`,
            progress: 100,
          });
          scheduleExportReset();
          showToast('WebM exported', loopSafe ? 'Loop-safe clip ready' : `${durationSeconds}s clip ready`);
        } else {
          setExportStatus({
            phase: 'error',
            label: 'Recording failed',
            detail: 'No video frames were captured.',
            progress: 0,
          });
          scheduleExportReset();
          showToast('Recording failed', 'No video frames were captured.');
        }

        setLoopSafePreview(null);
        setIsRecording(false);
      };

      recorder.start();
      const startedAt = performance.now();
      const updateProgress = (now: number) => {
        const elapsed = Math.min(durationSeconds * 1000, now - startedAt);
        const progress = 18 + Math.round((elapsed / (durationSeconds * 1000)) * 72);
        setExportStatus({
          phase: 'recording',
          label: loopSafe ? 'Recording loop-safe WebM' : 'Recording WebM',
          detail: `${Math.ceil((durationSeconds * 1000 - elapsed) / 1000)}s remaining`,
          progress,
        });

        if (elapsed < durationSeconds * 1000) {
          exportProgressFrameRef.current = requestAnimationFrame(updateProgress);
        } else {
          exportProgressFrameRef.current = null;
        }
      };
      if (exportProgressFrameRef.current !== null) {
        cancelAnimationFrame(exportProgressFrameRef.current);
      }
      exportProgressFrameRef.current = requestAnimationFrame(updateProgress);
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, durationSeconds * 1000);
      showToast('Recording started', loopSafe ? 'Loop-safe WebM clip' : `${durationSeconds}s WebM clip`);
    } catch {
      setIsRecording(false);
      setLoopSafePreview(null);
      setExportStatus({
        phase: 'error',
        label: 'Recording failed',
        detail: 'Unable to start video export.',
        progress: 0,
      });
      scheduleExportReset();
      showToast('Recording failed', 'Unable to start video export.');
    }
  };

  const handleResetMode = () => {
    setParams(DEFAULT_PARAMS);
    setPaused(false);
    setActiveSceneName(null);
    showToast('Mode reset', `Reset ${animationType} controls`);
  };

  const handleResetPalette = () => {
    setColors(DEFAULT_COLORS);
    setActiveSceneName(null);
    showToast('Palette reset');
  };

  const handleResetScene = () => {
    setAnimationType('liquid');
    setParams(DEFAULT_PARAMS);
    setColors(DEFAULT_COLORS);
    setPaused(false);
    setActiveSceneName(null);
    showToast('Scene reset', 'Restored the default scene');
  };

  const handleUndo = () => {
    const previousScene = pastScenes[pastScenes.length - 1];
    if (!previousScene) return;

    setPastScenes(prev => prev.slice(0, -1));
    setFutureScenes(prev => [cloneScene(currentScene), ...prev]);
    applyScene(previousScene);
    showToast('Undid last change');
  };

  const handleRedo = () => {
    const nextScene = futureScenes[0];
    if (!nextScene) return;

    setFutureScenes(prev => prev.slice(1));
    setPastScenes(prev => [...prev.slice(-(HISTORY_LIMIT - 1)), cloneScene(currentScene)]);
    applyScene(nextScene);
    showToast('Redid change');
  };

  const toggleWorkflowLock = (key: keyof WorkflowLocks) => {
    setWorkflowLocks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRandomizeMode = () => {
    if (workflowLocks.mode) {
      showToast('Mode lock enabled', 'Unlock mode to randomize it.');
      return;
    }

    const nextMode = randomAnimationType();
    setAnimationType(nextMode);
    showToast('Mode randomized');
  };

  const handleRandomizePalette = () => {
    if (workflowLocks.palette) {
      showToast('Palette lock enabled', 'Unlock palette to randomize it.');
      return;
    }

    setColors(randomPaletteColors());
    showToast('Palette randomized');
  };

  const handleRandomizeParams = () => {
    if (workflowLocks.motion && workflowLocks.seed) {
      showToast('Parameter locks enabled', 'Unlock seed or motion controls to randomize them.');
      return;
    }

    setParams(prev => randomParams(prev, workflowLocks));
    showToast('Parameters randomized');
  };

  const handleRandomizeScene = () => {
    if (!workflowLocks.mode) {
      setAnimationType(randomAnimationType());
    }
    if (!workflowLocks.palette) {
      setColors(randomPaletteColors());
    }
    if (!(workflowLocks.motion && workflowLocks.seed)) {
      setParams(prev => randomParams(prev, workflowLocks));
    }
    showToast('Scene randomized');
  };

  return (
    <>
      {animationType === 'liquid' && <LiquidCanvas params={params} colors={renderColors} paused={paused} onStatusChange={setRendererStatus} renderScale={renderScale} externalTime={externalRenderTime} />}
      {animationType === 'waves' && <WavesCanvas params={params} colors={renderColors} paused={paused} onStatusChange={setRendererStatus} renderScale={renderScale} externalTime={externalRenderTime} />}
      {animationType === 'voronoi' && <VoronoiCanvas params={params} colors={renderColors} paused={paused} onStatusChange={setRendererStatus} renderScale={renderScale} externalTime={externalRenderTime} />}
      {animationType === 'turing' && <TuringCanvas params={params} colors={renderColors} paused={paused} onStatusChange={setRendererStatus} renderScale={renderScale} />}
      {animationType === 'particles' && <ParticlesCanvas params={params} colors={renderColors} paused={paused} onStatusChange={setRendererStatus} renderScale={renderScale} />}
      {animationType === 'blobs' && <BlobsCanvas params={params} colors={renderColors} paused={paused} onStatusChange={setRendererStatus} renderScale={renderScale} externalTime={externalRenderTime} />}

      {rendererStatus && (
        <div className="renderer-status" role="status" aria-live="polite">
          <strong>{rendererStatus.title}</strong>
          <p>{rendererStatus.message}</p>
        </div>
      )}

      {toast && (
        <div key={toast.id} className="app-toast" role="status" aria-live="polite">
          <strong>{toast.title}</strong>
          {toast.message && <p>{toast.message}</p>}
        </div>
      )}

      {isSavePresetOpen && (
        <div className="dialog-overlay" role="presentation" onClick={closeSavePresetDialog}>
          <div
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-preset-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="dialog-header">
              <span className="section-label">Save Preset</span>
              <button className="dialog-close" onClick={closeSavePresetDialog} aria-label="Close save preset dialog">
                +
              </button>
            </div>
            <form className="dialog-form" onSubmit={submitSavePreset}>
              <div className="dialog-copy">
                <strong id="save-preset-title">Name This Scene</strong>
                <p>Save the current look into your preset library with a reusable title.</p>
              </div>
              <label className="dialog-field">
                <span>Preset name</span>
                <input
                  ref={savePresetInputRef}
                  type="text"
                  value={savePresetName}
                  onChange={event => setSavePresetName(event.target.value)}
                  maxLength={80}
                  placeholder="Scene name"
                />
              </label>
              <div className="dialog-actions">
                <button type="button" className="workspace-btn" onClick={closeSavePresetDialog}>
                  Cancel
                </button>
                <button type="submit" className="workspace-btn" disabled={!savePresetName.trim()}>
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div id="panel" className={uiVisible ? '' : 'hidden'}>
        <div className="panel-header">
          <span className="panel-title">Liquid Gradient</span>
        </div>

        <Panel
          params={params}
          setParams={setParams}
          colors={colors}
          setColors={setColors}
          paused={paused}
          setPaused={setPaused}
          animationType={animationType}
          setAnimationType={setAnimationType}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          hideUI={() => setUiVisible(false)}
          savedPresets={savedPresets}
          savePreset={handleSavePreset}
          loadPreset={handleLoadPreset}
          deletePreset={handleDeletePreset}
          shareScene={handleShareScene}
          exportImage={handleExportImage}
          recordVideo={handleRecordVideo}
          isRecording={isRecording}
          exportStatus={exportStatus}
          canLoopSafeExport={supportsLoopSafeExport(animationType)}
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
        />
      </div>

      <button
        id="toggle-ui"
        className={uiVisible ? 'ui-visible' : ''}
        onClick={() => setUiVisible(true)}
        title="Show controls"
        aria-label="Show controls"
      >
        +
      </button>

      <div id="hint" className={hintVisible ? '' : 'fade'}>
        Press H to hide UI | F for fullscreen
      </div>
    </>
  );
}

export default App;
