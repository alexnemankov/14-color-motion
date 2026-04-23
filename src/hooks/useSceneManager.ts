import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AnimationType, ColorRgb, GradientParams, SceneState } from '../types';
import {
  DEFAULT_PARAMS,
  DEFAULT_COLORS,
  HISTORY_LIMIT,
} from '../constants';
import { MODES } from '../config/modes';
import { cloneScene, sceneKey } from '../utils/sceneUtils';
import type { RendererHandle } from '../components/rendererTypes';

interface ModeTransitionState {
  id: number;
  imageUrl: string;
}

export function useSceneManager(
  initialScene: SceneState,
  rendererRef: RefObject<RendererHandle | null>,
) {
  const [params, setParams] = useState<GradientParams>(initialScene.params);
  const [colors, setColors] = useState<ColorRgb[]>(initialScene.colors);
  const [animationType, setAnimationType] = useState<AnimationType>(initialScene.animationType);
  const [modeTransition, setModeTransition] = useState<ModeTransitionState | null>(null);
  const [pastScenes, setPastScenes] = useState<SceneState[]>([]);
  const [futureScenes, setFutureScenes] = useState<SceneState[]>([]);

  const previousSceneRef = useRef<SceneState>(cloneScene(initialScene));
  const suppressHistoryRef = useRef(false);
  const modeTransitionTimeoutRef = useRef<number | null>(null);

  const currentScene: SceneState = { animationType, params, colors };

  useEffect(() => {
    const previous = previousSceneRef.current;
    if (sceneKey(previous) === sceneKey(currentScene)) return;

    if (suppressHistoryRef.current) {
      suppressHistoryRef.current = false;
      previousSceneRef.current = cloneScene(currentScene);
      return;
    }

    setPastScenes((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), cloneScene(previous)]);
    setFutureScenes([]);
    previousSceneRef.current = cloneScene(currentScene);
  }, [currentScene]); // eslint-disable-line react-hooks/exhaustive-deps

  const startModeTransition = useCallback((nextType: AnimationType) => {
    if (nextType === animationType) return;

    const activeCanvas = rendererRef.current?.getCanvas();
    if (activeCanvas) {
      try {
        const imageUrl = activeCanvas.toDataURL("image/png");
        setModeTransition({ id: Date.now(), imageUrl });
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

    const entryColors = MODES[nextType].entryColors;
    if (entryColors) setColors(entryColors);
  }, [animationType, rendererRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyScene = useCallback((scene: SceneState) => {
    suppressHistoryRef.current = true;
    startModeTransition(scene.animationType);
    setParams(scene.params);
    setColors(scene.colors);
  }, [startModeTransition]);

  const undo = useCallback(() => {
    const previous = pastScenes[pastScenes.length - 1];
    if (!previous) return;
    setPastScenes((prev) => prev.slice(0, -1));
    setFutureScenes((prev) => [cloneScene(currentScene), ...prev]);
    applyScene(previous);
  }, [pastScenes, currentScene, applyScene]); // eslint-disable-line react-hooks/exhaustive-deps

  const redo = useCallback(() => {
    const next = futureScenes[0];
    if (!next) return;
    setFutureScenes((prev) => prev.slice(1));
    setPastScenes((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), cloneScene(currentScene)]);
    applyScene(next);
  }, [futureScenes, currentScene, applyScene]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetScene = useCallback(() => {
    startModeTransition("liquid");
    setParams(DEFAULT_PARAMS);
    setColors(DEFAULT_COLORS);
  }, [startModeTransition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (modeTransitionTimeoutRef.current !== null) {
        window.clearTimeout(modeTransitionTimeoutRef.current);
      }
    };
  }, []);

  return {
    params,
    setParams,
    colors,
    setColors,
    animationType,
    startModeTransition,
    currentScene,
    applyScene,
    modeTransition,
    canUndo: pastScenes.length > 0,
    canRedo: futureScenes.length > 0,
    undo,
    redo,
    resetScene,
  };
}
