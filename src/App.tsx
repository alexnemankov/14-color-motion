import { useState, useEffect } from 'react';
import LiquidCanvas from './components/LiquidCanvas';
import WavesCanvas from './components/WavesCanvas';
import VoronoiCanvas from './components/VoronoiCanvas';
import TuringCanvas from './components/TuringCanvas';
import ParticlesCanvas from './components/ParticlesCanvas';
import BlobsCanvas from './components/BlobsCanvas';
import Panel from './components/Panel';

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
const VALID_ANIMATION_TYPES: AnimationType[] = ['liquid', 'waves', 'voronoi', 'turing', 'particles', 'blobs'];

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
  const initialScene = readSharedScene() ?? readSessionScene() ?? {
    animationType: 'liquid' as AnimationType,
    params: DEFAULT_PARAMS,
    colors: DEFAULT_COLORS,
  };

  const [params, setParams] = useState<GradientParams>(initialScene.params);
  const [colors, setColors] = useState<ColorRgb[]>(initialScene.colors);
  const [animationType, setAnimationType] = useState<AnimationType>(initialScene.animationType);
  const [uiVisible, setUiVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(readSavedPresets);
  const [rendererStatus, setRendererStatus] = useState<RendererStatus | null>(null);

  const currentScene: SceneState = {
    animationType,
    params,
    colors,
  };

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

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
  }, []);

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

  const applyScene = (scene: SceneState) => {
    setAnimationType(scene.animationType);
    setParams(scene.params);
    setColors(scene.colors);
  };

  const handleSavePreset = () => {
    const suggestedName = `${animationType} ${new Date().toLocaleDateString()}`;
    const name = window.prompt('Preset name', suggestedName)?.trim();
    if (!name) return;

    setSavedPresets(prev => [
      {
        ...currentScene,
        id: `${Date.now()}`,
        name,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    applyScene(preset);
  };

  const handleDeletePreset = (id: string) => {
    setSavedPresets(prev => prev.filter(preset => preset.id !== id));
  };

  const handleShareScene = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set(SHARE_PARAM_KEY, encodeURIComponent(JSON.stringify(currentScene)));

    try {
      await navigator.clipboard.writeText(url.toString());
      window.alert('Share link copied to clipboard.');
    } catch {
      window.prompt('Copy this share link', url.toString());
    }
  };

  const handleExportImage = () => {
    const canvas = document.getElementById('c') as HTMLCanvasElement | null;
    if (!canvas) {
      window.alert('No active canvas found to export.');
      return;
    }

    canvas.toBlob(blob => {
      if (!blob) {
        window.alert('Image export failed.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `color-motion-${animationType}-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <>
      {animationType === 'liquid' && <LiquidCanvas params={params} colors={colors} paused={paused} onStatusChange={setRendererStatus} />}
      {animationType === 'waves' && <WavesCanvas params={params} colors={colors} paused={paused} onStatusChange={setRendererStatus} />}
      {animationType === 'voronoi' && <VoronoiCanvas params={params} colors={colors} paused={paused} onStatusChange={setRendererStatus} />}
      {animationType === 'turing' && <TuringCanvas params={params} colors={colors} paused={paused} onStatusChange={setRendererStatus} />}
      {animationType === 'particles' && <ParticlesCanvas params={params} colors={colors} paused={paused} onStatusChange={setRendererStatus} />}
      {animationType === 'blobs' && <BlobsCanvas params={params} colors={colors} paused={paused} onStatusChange={setRendererStatus} />}

      {rendererStatus && (
        <div className="renderer-status" role="status" aria-live="polite">
          <strong>{rendererStatus.title}</strong>
          <p>{rendererStatus.message}</p>
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
