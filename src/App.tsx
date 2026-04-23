import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Panel from "./components/Panel";
import RendererBoundary from "./components/RendererBoundary";
import RendererHost from "./components/RendererHost";
import { RendererHandle } from "./components/rendererTypes";
import { serializeSceneForPersistence } from "./services/storageService";
import { readSessionScene, readSavedPresets, readRecentScenes, readOnboardingDismissed } from "./services/storageService";
import { serializeShareScene, readSharedSceneBundle, readSharedSceneName } from "./services/sharingService";
import { animationTypeLabel, randomAnimationType, randomPaletteColors, randomParams, cloneScene, sceneKey } from "./utils/sceneUtils";
import { usePaletteTransition } from "./hooks/usePaletteTransition";
import { useSceneManager } from "./hooks/useSceneManager";
import { useExport } from "./hooks/useExport";
import {
  DEFAULT_PARAMS,
  DEFAULT_COLORS,
  SESSION_STORAGE_KEY,
  PRESETS_STORAGE_KEY,
  RECENT_SCENES_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  SHARE_PARAM_KEY,
  SHARE_NAME_PARAM_KEY,
  LOOP_SAFE_DURATION_SECONDS,
  RECENT_SCENES_LIMIT,
  APP_TITLE,
  WEBGL_COMPATIBILITY_URL,
  ONBOARDING_STEPS,
} from "./constants";

// Re-export types so existing imports from "./App" remain valid during migration
export type { AnimationType, GradientParams, ColorRgb, SceneState, SavedPreset, RecentScene, WorkflowLocks, RendererStatus } from "./types";
export type { ExportStatusState } from "./hooks/useExport";

import type { SavedPreset, RecentScene, SceneState, WorkflowLocks, RendererStatus } from "./types";

interface ToastState { id: number; title: string; message?: string; }

const sharedSceneBundle = readSharedSceneBundle();
const initialScene: SceneState = sharedSceneBundle?.scene ?? readSessionScene() ?? {
  animationType: "liquid" as const,
  params: DEFAULT_PARAMS,
  colors: DEFAULT_COLORS,
};

function App() {
  const rendererRef = useRef<RendererHandle | null>(null);
  const savePresetInputRef = useRef<HTMLInputElement | null>(null);
  const storageErrorToastRef = useRef<string | null>(null);

  const scene = useSceneManager(initialScene, rendererRef);
  const renderColors = usePaletteTransition(scene.colors);
  const exporter = useExport({
    animationType: scene.animationType,
    rendererRef,
    params: scene.params,
    onToast: showToastCallback,
  });

  const [uiVisible, setUiVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(readSavedPresets);
  const [recentScenes, setRecentScenes] = useState<RecentScene[]>(readRecentScenes);
  const [rendererStatus, setRendererStatus] = useState<RendererStatus | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [viewMode, setViewMode] = useState<"compact" | "advanced">("compact");
  const [workflowLocks, setWorkflowLocks] = useState<WorkflowLocks>({ mode: false, palette: false, seed: false, motion: false });
  const [activeSceneName, setActiveSceneName] = useState<string | null>(sharedSceneBundle?.name ?? readSharedSceneName());
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [onboardingStep, setOnboardingStep] = useState<number | null>(() =>
    readOnboardingDismissed() ? null : 0,
  );

  // showToast must be stable enough to pass as callback before hooks run — use a ref trampoline
  const toastRef = useRef((title: string, message?: string) => {
    setToast({ id: Date.now(), title, message });
  });
  function showToastCallback(title: string, message?: string) { toastRef.current(title, message); }
  const showToast = useCallback((title: string, message?: string) => {
    setToast({ id: Date.now(), title, message });
  }, []);

  // Hint auto-hide
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Onboarding scroll-to-target
  useEffect(() => {
    if (onboardingStep === null || onboardingStep === 0) return;
    const step = ONBOARDING_STEPS[onboardingStep];
    const target = document.getElementById(step.targetId);
    const panel = document.getElementById("panel");
    if (!target || !panel) return;
    const targetOffset = target.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop;
    panel.scrollTo({ top: Math.max(0, targetOffset - 120), behavior: "smooth" });
  }, [onboardingStep]);

  // Shared scene toast on first load
  useEffect(() => {
    const name = sharedSceneBundle?.name ?? null;
    if (!name) return;
    recordRecentScene(initialScene, name, "shared");
    showToast("Shared scene loaded", name);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus save-preset input when dialog opens
  useEffect(() => {
    if (!isSavePresetOpen) return;
    const t = window.setTimeout(() => {
      savePresetInputRef.current?.focus();
      savePresetInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isSavePresetOpen]);

  // Persist session scene
  useEffect(() => {
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializeSceneForPersistence(scene.currentScene)));
    } catch {
      if (storageErrorToastRef.current !== "session") {
        storageErrorToastRef.current = "session";
        showToast("Storage unavailable", "Session changes could not be saved locally.");
      }
    }
  }, [scene.animationType, scene.params, scene.colors]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist saved presets
  useEffect(() => {
    try {
      localStorage.setItem(
        PRESETS_STORAGE_KEY,
        JSON.stringify(savedPresets.map((p) => ({ ...serializeSceneForPersistence(p), id: p.id, name: p.name, createdAt: p.createdAt }))),
      );
      if (storageErrorToastRef.current === "presets") storageErrorToastRef.current = null;
    } catch {
      if (storageErrorToastRef.current !== "presets") {
        storageErrorToastRef.current = "presets";
        showToast("Preset save failed", "Local storage is full or unavailable.");
      }
    }
  }, [savedPresets]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist recent scenes
  useEffect(() => {
    try {
      localStorage.setItem(
        RECENT_SCENES_STORAGE_KEY,
        JSON.stringify(recentScenes.map((s) => ({ ...serializeSceneForPersistence(s), id: s.id, name: s.name, seenAt: s.seenAt, source: s.source }))),
      );
    } catch {
      if (storageErrorToastRef.current !== "recent-scenes") {
        storageErrorToastRef.current = "recent-scenes";
        showToast("Storage unavailable", "Recent scenes could not be stored locally.");
      }
    }
  }, [recentScenes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSavePresetOpen && e.key === "Escape") { e.preventDefault(); closeSavePresetDialog(); return; }
      if (isShortcutsOpen && e.key === "Escape") { e.preventDefault(); setIsShortcutsOpen(false); return; }
      if (onboardingStep !== null && e.key === "Escape") { e.preventDefault(); dismissOnboarding(); return; }

      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); setIsShortcutsOpen((o) => !o); return; }
      if (mod && !e.shiftKey && key === "z") { e.preventDefault(); handleUndo(); return; }
      if (mod && (key === "y" || (e.shiftKey && key === "z"))) { e.preventDefault(); handleRedo(); return; }
      if (key === "r") { e.preventDefault(); handleRandomizeScene(); return; }
      if (key === "s") { e.preventDefault(); handleSavePreset(); return; }
      if (key === "h") setUiVisible((v) => !v);
      if (key === "f") toggleFullscreen();
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSavePresetOpen, isShortcutsOpen, onboardingStep]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setFullscreen(true); }
    else { document.exitFullscreen(); setFullscreen(false); }
  };

  const recordRecentScene = (s: SceneState, name: string, source: RecentScene["source"]) => {
    const sig = sceneKey(s);
    setRecentScenes((prev) => [
      { ...cloneScene(s), id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, source, seenAt: new Date().toISOString() },
      ...prev.filter((e) => sceneKey(e) !== sig).slice(0, RECENT_SCENES_LIMIT - 1),
    ]);
  };

  const getSceneName = (s: SceneState) =>
    savedPresets.find((p) => sceneKey(cloneScene(p)) === sceneKey(s))?.name ??
    `${animationTypeLabel(s.animationType)} Scene`;

  const dismissOnboarding = () => {
    setOnboardingStep(null);
    try { localStorage.setItem(ONBOARDING_STORAGE_KEY, "true"); } catch { /* ignore */ }
  };

  const advanceOnboarding = () => {
    setOnboardingStep((cur) => {
      if (cur === null) return null;
      if (cur >= ONBOARDING_STEPS.length - 1) {
        try { localStorage.setItem(ONBOARDING_STORAGE_KEY, "true"); } catch { /* ignore */ }
        return null;
      }
      return cur + 1;
    });
  };

  // ─── Scene actions ────────────────────────────────────────────────────────────

  const handleUndo = () => { scene.undo(); showToast("Undid last change"); };
  const handleRedo = () => { scene.redo(); showToast("Redid change"); };

  const handleSavePreset = () => {
    setSavePresetName(activeSceneName ?? `${animationTypeLabel(scene.animationType)} ${new Date().toLocaleDateString()}`);
    setIsSavePresetOpen(true);
  };

  const closeSavePresetDialog = () => { setIsSavePresetOpen(false); setSavePresetName(""); };

  const submitSavePreset = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const name = savePresetName.trim();
    if (!name) return;
    const dupes = savedPresets.filter((p) => p.name.toLowerCase() === name.toLowerCase()).length;
    const finalName = dupes > 0 ? `${name} ${dupes + 1}` : name;
    setSavedPresets((prev) => [{ ...scene.currentScene, id: `${Date.now()}`, name: finalName, createdAt: new Date().toISOString() }, ...prev]);
    setActiveSceneName(finalName);
    recordRecentScene(scene.currentScene, finalName, "preset");
    closeSavePresetDialog();
    showToast("Preset saved", finalName);
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    scene.applyScene(preset);
    setActiveSceneName(preset.name);
    recordRecentScene(preset, preset.name, "preset");
    showToast("Preset loaded", preset.name);
  };

  const handleLoadRecentScene = (s: RecentScene) => {
    scene.applyScene(s);
    setActiveSceneName(s.name);
    recordRecentScene(s, s.name, s.source);
    showToast("Recent scene loaded", s.name);
  };

  const handleDeletePreset = (id: string) => {
    const deleted = savedPresets.find((p) => p.id === id);
    setSavedPresets((prev) => prev.filter((p) => p.id !== id));
    if (deleted?.name === activeSceneName) setActiveSceneName(null);
    showToast("Preset deleted", deleted?.name);
  };

  const handleDeleteRecentScene = (id: string) => {
    const deleted = recentScenes.find((s) => s.id === id);
    setRecentScenes((prev) => prev.filter((s) => s.id !== id));
    showToast("Recent scene removed", deleted?.name);
  };

  const handleShareScene = async () => {
    const url = new URL(window.location.href);
    const name = activeSceneName ?? getSceneName(scene.currentScene);
    url.searchParams.set(SHARE_PARAM_KEY, serializeShareScene(scene.currentScene, name));
    url.searchParams.delete(SHARE_NAME_PARAM_KEY);
    try {
      await navigator.clipboard.writeText(url.toString());
      recordRecentScene(scene.currentScene, name, "shared");
      showToast("Share link copied", name);
    } catch {
      window.prompt("Copy this share link", url.toString());
    }
  };

  const handleResetMode = () => {
    scene.setParams(DEFAULT_PARAMS);
    setPaused(false);
    setActiveSceneName(null);
    showToast("Mode reset", `Reset ${scene.animationType} controls`);
  };

  const handleResetPalette = () => {
    scene.setColors(DEFAULT_COLORS);
    setActiveSceneName(null);
    showToast("Palette reset");
  };

  const handleResetScene = () => {
    scene.resetScene();
    setPaused(false);
    setActiveSceneName(null);
    showToast("Scene reset", "Restored the default scene");
  };

  const toggleWorkflowLock = (key: keyof WorkflowLocks) =>
    setWorkflowLocks((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleRandomizeMode = () => {
    if (workflowLocks.mode) { showToast("Mode lock enabled", "Unlock mode to randomize it."); return; }
    scene.startModeTransition(randomAnimationType());
    showToast("Mode randomized");
  };

  const handleRandomizePalette = () => {
    if (workflowLocks.palette) { showToast("Palette lock enabled", "Unlock palette to randomize it."); return; }
    scene.setColors(randomPaletteColors());
    showToast("Palette randomized");
  };

  const handleRandomizeParams = () => {
    if (workflowLocks.motion && workflowLocks.seed) { showToast("Parameter locks enabled", "Unlock seed or motion controls to randomize them."); return; }
    scene.setParams((prev) => randomParams(prev, workflowLocks, scene.animationType));
    showToast("Parameters randomized");
  };

  const handleRandomizeScene = () => {
    if (!workflowLocks.mode) scene.startModeTransition(randomAnimationType());
    if (!workflowLocks.palette) scene.setColors(randomPaletteColors());
    if (!(workflowLocks.motion && workflowLocks.seed)) scene.setParams((prev) => randomParams(prev, workflowLocks, scene.animationType));
    showToast("Scene randomized");
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <RendererBoundary
        resetKey={scene.animationType}
        onError={(status) => { setRendererStatus(status); showToast(status.title, status.message); }}
      >
        <RendererHost
          ref={rendererRef}
          animationType={scene.animationType}
          params={scene.params}
          colors={renderColors}
          paused={paused}
          onStatusChange={setRendererStatus}
          renderScale={exporter.renderScale}
          externalTime={exporter.externalRenderTime}
        />
      </RendererBoundary>

      {scene.modeTransition && (
        <div
          key={scene.modeTransition.id}
          className="renderer-transition-overlay"
          style={{ backgroundImage: `url(${scene.modeTransition.imageUrl})` }}
          aria-hidden="true"
        />
      )}

      {rendererStatus && (
        <div className="renderer-fallback" role="dialog" aria-modal="false" aria-labelledby="renderer-fallback-title">
          <span className="section-label">Renderer Status</span>
          <strong id="renderer-fallback-title">{rendererStatus.title}</strong>
          <p>{rendererStatus.message}</p>
          <div className="renderer-fallback-actions">
            <a className="workspace-btn renderer-fallback-link" href={WEBGL_COMPATIBILITY_URL} target="_blank" rel="noreferrer">Compatibility</a>
            <button type="button" className="workspace-btn" onClick={() => scene.startModeTransition("particles")}>Use Particles</button>
          </div>
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
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="save-preset-title" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <span className="section-label">Save Preset</span>
              <button className="dialog-close" onClick={closeSavePresetDialog} aria-label="Close save preset dialog">+</button>
            </div>
            <form className="dialog-form" onSubmit={submitSavePreset}>
              <div className="dialog-copy">
                <strong id="save-preset-title">Name This Scene</strong>
                <p>Save the current look into your preset library with a reusable title.</p>
              </div>
              <label className="dialog-field">
                <span>Preset name</span>
                <input ref={savePresetInputRef} type="text" value={savePresetName} onChange={(e) => setSavePresetName(e.target.value)} maxLength={80} placeholder="Scene name" />
              </label>
              <div className="dialog-actions">
                <button type="button" className="workspace-btn" onClick={closeSavePresetDialog}>Cancel</button>
                <button type="submit" className="workspace-btn" disabled={!savePresetName.trim()}>Save Preset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isShortcutsOpen && (
        <div className="dialog-overlay" role="presentation" onClick={() => setIsShortcutsOpen(false)}>
          <div className="dialog-card shortcuts-card" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <span className="section-label">Shortcuts</span>
              <button className="dialog-close" onClick={() => setIsShortcutsOpen(false)} aria-label="Close shortcuts dialog">+</button>
            </div>
            <div className="dialog-copy">
              <strong id="shortcuts-title">Keyboard Shortcuts</strong>
              <p>Shortcuts only run when a text field or search input is not focused.</p>
            </div>
            <div className="shortcuts-list">
              {[
                ["?", "Open or close this shortcuts panel"],
                ["Space", "Pause or resume animation"],
                ["H", "Hide or show the panel"],
                ["F", "Toggle fullscreen"],
                ["R", "Randomize the current scene"],
                ["S", "Save the current scene as a preset"],
                ["Ctrl/⌘ + Z", "Undo the last scene change"],
                ["Ctrl/⌘ + Y", "Redo the next scene change"],
              ].map(([key, desc]) => (
                <div key={key} className="shortcut-row"><kbd>{key}</kbd><span>{desc}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div id="panel" className={uiVisible ? "" : "hidden"}>
        <div className="panel-header">
          <span className="panel-title">{APP_TITLE}</span>
        </div>
        <Panel
          params={scene.params}
          setParams={scene.setParams}
          colors={scene.colors}
          setColors={scene.setColors}
          paused={paused}
          setPaused={setPaused}
          animationType={scene.animationType}
          setAnimationType={scene.startModeTransition}
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
          exportImage={exporter.handleExportImage}
          recordVideo={exporter.handleRecordVideo}
          isRecording={exporter.isRecording}
          exportStatus={exporter.exportStatus}
          canLoopSafeExport={exporter.canLoopSafeExport}
          loopSafeDurationSeconds={LOOP_SAFE_DURATION_SECONDS}
          resetMode={handleResetMode}
          resetPalette={handleResetPalette}
          resetScene={handleResetScene}
          viewMode={viewMode}
          setViewMode={setViewMode}
          canUndo={scene.canUndo}
          canRedo={scene.canRedo}
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

      <button id="toggle-ui" className={uiVisible ? "ui-visible" : ""} onClick={() => setUiVisible(true)} title="Show controls" aria-label="Show controls">+</button>
      <div id="hint" className={hintVisible ? "" : "fade"}>Press H to hide UI | F for fullscreen</div>
    </>
  );
}

export default App;
