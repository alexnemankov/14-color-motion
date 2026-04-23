import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  ClockCounterClockwise,
  CornersOut,
  EyeSlash,
  Lock,
  LockOpen,
  Palette,
  PlayPause,
  Plus,
  Question,
  Shuffle,
  Trash,
  X,
} from "@phosphor-icons/react";
import { MODES } from "../config/modes";
import { HexColorPicker } from "react-colorful";
import {
  AnimationType,
  ColorRgb,
  GradientParams,
  RecentScene,
  SavedPreset,
  WorkflowLocks,
} from "../types";
import { VALID_ANIMATION_TYPES } from "../constants";
import PaletteModal from "./PaletteModal";

interface PanelProps {
  params: GradientParams;
  setParams: React.Dispatch<React.SetStateAction<GradientParams>>;
  colors: ColorRgb[];
  setColors: React.Dispatch<React.SetStateAction<ColorRgb[]>>;
  paused: boolean;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
  animationType: AnimationType;
  setAnimationType: (type: AnimationType) => void;
  fullscreen: boolean;
  toggleFullscreen: () => void;
  hideUI: () => void;
  savedPresets: SavedPreset[];
  recentScenes: RecentScene[];
  savePreset: () => void;
  loadPreset: (preset: SavedPreset) => void;
  loadRecentScene: (scene: RecentScene) => void;
  deletePreset: (id: string) => void;
  deleteRecentScene: (id: string) => void;
  shareScene: () => void;
  exportImage: (scale?: number) => void;
  recordVideo: (durationSeconds: number, loopSafe?: boolean) => void;
  isRecording: boolean;
  exportStatus: {
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
  };
  canLoopSafeExport: boolean;
  loopSafeDurationSeconds: number;
  resetMode: () => void;
  resetPalette: () => void;
  resetScene: () => void;
  viewMode: "compact" | "advanced";
  setViewMode: React.Dispatch<React.SetStateAction<"compact" | "advanced">>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  randomizeMode: () => void;
  randomizePalette: () => void;
  randomizeParams: () => void;
  randomizeScene: () => void;
  workflowLocks: WorkflowLocks;
  toggleWorkflowLock: (key: keyof WorkflowLocks) => void;
  onboardingStep: number | null;
  onboardingSteps: Array<{
    targetId: string;
    eyebrow: string;
    title: string;
    message: string;
  }>;
  dismissOnboarding: () => void;
  advanceOnboarding: () => void;
  openShortcuts: () => void;
}

const hexToRgb = (hex: string): ColorRgb => {
  if (hex.startsWith("#")) hex = hex.slice(1);
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return [r, g, b]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

const LOCK_LABELS: Record<keyof WorkflowLocks, string> = {
  mode: "Lock mode",
  palette: "Lock palette",
  seed: "Lock seed",
  motion: "Lock motion",
};


const ColorRow = ({
  rgb,
  update,
  remove,
  showRemove,
}: {
  rgb: ColorRgb;
  update: (hex: string) => void;
  remove: () => void;
  showRemove: boolean;
}) => {
  const [localHex, setLocalHex] = useState(
    `#${rgbToHex(rgb[0], rgb[1], rgb[2])}`,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const fullHexStr = `#${rgbToHex(rgb[0], rgb[1], rgb[2])}`;

  useEffect(() => {
    setLocalHex(`#${rgbToHex(rgb[0], rgb[1], rgb[2])}`);
  }, [rgb]);

  useEffect(() => {
    if (!pickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pickerOpen]);

  return (
    <div ref={rowRef} className={`color-row ${pickerOpen ? "open" : ""}`}>
      <button
        type="button"
        className="color-swatch"
        style={{ background: fullHexStr }}
        onClick={() => setPickerOpen((open) => !open)}
        aria-label={`Open color picker for ${fullHexStr}`}
        aria-expanded={pickerOpen}
      />
      <input
        className="color-hex"
        type="text"
        value={localHex}
        maxLength={7}
        onChange={(e) => {
          let value = e.target.value;
          if (value && !value.startsWith("#")) value = `#${value}`;
          if (!value) value = "#";
          setLocalHex(value.toUpperCase());
          if (/^#[0-9a-fA-F]{6}$/.test(value)) update(value);
        }}
        onBlur={() => setLocalHex(`#${rgbToHex(rgb[0], rgb[1], rgb[2])}`)}
      />
      {showRemove && (
        <button className="btn-remove" onClick={remove} title="Remove Color">
          <Trash size={14} weight="bold" />
        </button>
      )}
      {pickerOpen && (
        <div className="color-popover">
          <HexColorPicker color={fullHexStr} onChange={update} />
          <div className="color-popover-footer">
            <span>Pick a color</span>
            <button
              type="button"
              className="color-popover-close"
              onClick={() => setPickerOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const InlineSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = () => setOpen(false);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const activeOption =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className={`inline-select ${open ? "open" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span>{label}</span>
      <button
        type="button"
        className="inline-select-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {activeOption.label}
        <CaretDown size={12} weight="bold" />
      </button>
      {open && (
        <div className="inline-select-menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`inline-select-option ${option.value === value ? "active" : ""}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Panel({
  params,
  setParams,
  colors,
  setColors,
  paused,
  setPaused,
  animationType,
  setAnimationType,
  fullscreen,
  toggleFullscreen,
  hideUI,
  savedPresets,
  recentScenes,
  savePreset,
  loadPreset,
  loadRecentScene,
  deletePreset,
  deleteRecentScene,
  shareScene,
  exportImage,
  recordVideo,
  isRecording,
  exportStatus,
  canLoopSafeExport,
  loopSafeDurationSeconds,
  resetMode,
  resetPalette,
  resetScene,
  viewMode,
  setViewMode,
  canUndo,
  canRedo,
  undo,
  redo,
  randomizeMode,
  randomizePalette,
  randomizeParams,
  randomizeScene,
  workflowLocks,
  toggleWorkflowLock,
  onboardingStep,
  onboardingSteps,
  dismissOnboarding,
  advanceOnboarding,
  openShortcuts,
}: PanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModeModalOpen, setIsModeModalOpen] = useState(false);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);
  const [exportExpanded, setExportExpanded] = useState(false);
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [resetExpanded, setResetExpanded] = useState(false);
  const [savedSearch, setSavedSearch] = useState("");
  const [savedSort, setSavedSort] = useState<"newest" | "oldest" | "name">(
    "newest",
  );
  const [savedMode, setSavedMode] = useState<"all" | AnimationType>("all");

  const formatPresetDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(new Date(value));
    } catch {
      return "";
    }
  };

  const updateParam = (
    name: keyof Omit<GradientParams, "dofEnabled" | "godRays">,
    value: number,
  ) => {
    setParams((prev) => ({ ...prev, [name]: Number.isNaN(value) ? 0 : value }));
  };

  const renderParamRow = (
    key: keyof Omit<GradientParams, "dofEnabled" | "godRays" | "octagramTrails" | "octagramColorCycle" | "octagramType">,
    min: number,
    max: number,
    step: number,
    disabled: boolean = false,
  ) => (
    <div className="param-row">
      <span className="param-label">{(labels as unknown as Record<string, string>)[key]}</span>
      <input
        className="param-input"
        type="number"
        value={params[key]}
        step={step}
        disabled={disabled}
        onChange={(e) => updateParam(key, +e.target.value)}
      />
      <input
        className="param-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        disabled={disabled}
        onChange={(e) => updateParam(key, +e.target.value)}
      />
    </div>
  );

  const formatAnimationType = (type: AnimationType) => MODES[type].name;

  const filteredSavedPresets = useMemo(() => {
    const normalizedSearch = savedSearch.trim().toLowerCase();

    return [...savedPresets]
      .filter((preset) => {
        const matchesSearch =
          !normalizedSearch ||
          preset.name.toLowerCase().includes(normalizedSearch);
        const matchesMode =
          savedMode === "all" || preset.animationType === savedMode;
        return matchesSearch && matchesMode;
      })
      .sort((left, right) => {
        if (savedSort === "name") {
          return left.name.localeCompare(right.name);
        }

        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        return savedSort === "oldest"
          ? leftTime - rightTime
          : rightTime - leftTime;
      });
  }, [savedMode, savedSearch, savedSort, savedPresets]);

  const labels = MODES[animationType].paramLabels;

  const renderOnboardingCard = (stepIndex: number) => {
    if (onboardingStep !== stepIndex) return null;
    const step = onboardingSteps[stepIndex];

    return (
      <div
        className="onboarding-inline"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`onboarding-title-${stepIndex}`}
      >
        <span className="section-label">{step.eyebrow}</span>
        <strong id={`onboarding-title-${stepIndex}`}>{step.title}</strong>
        <p>{step.message}</p>
        <div className="onboarding-progress" aria-hidden="true">
          {onboardingSteps.map((_, index) => (
            <span
              key={index}
              className={`onboarding-dot ${index === stepIndex ? "active" : ""}`}
            />
          ))}
        </div>
        <div className="onboarding-actions">
          <button
            type="button"
            className="workspace-btn"
            onClick={dismissOnboarding}
          >
            Skip
          </button>
          <button
            type="button"
            className="workspace-btn"
            onClick={advanceOnboarding}
          >
            {stepIndex === onboardingSteps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderOnboardingCard(0)}
      <div
        className={`panel-section ${onboardingStep === 0 ? "onboarding-target" : ""}`}
      >
        <div className="section-heading">
          <span className="section-label">Workflow</span>
          <button
            className={`section-toggle ${workflowExpanded ? "active" : ""}`}
            onClick={() => setWorkflowExpanded((expanded) => !expanded)}
            aria-expanded={workflowExpanded}
            aria-controls="workflow-tools"
          >
            {workflowExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            Tools
          </button>
        </div>
        <div
          className="view-toggle"
          role="tablist"
          aria-label="Control density"
        >
          <button
            className={`view-toggle-btn ${viewMode === "compact" ? "active" : ""}`}
            onClick={() => setViewMode("compact")}
          >
            Compact
          </button>
          <button
            className={`view-toggle-btn ${viewMode === "advanced" ? "active" : ""}`}
            onClick={() => setViewMode("advanced")}
          >
            Advanced
          </button>
        </div>
        <div
          id="workflow-tools"
          className={`workflow-details ${workflowExpanded ? "expanded" : ""}`}
        >
          <div className="workflow-actions">
            <button className="workflow-btn" onClick={undo} disabled={!canUndo}>
              <ClockCounterClockwise size={14} weight="bold" />
              Undo
            </button>
            <button className="workflow-btn" onClick={redo} disabled={!canRedo}>
              <ArrowCounterClockwise size={14} weight="bold" />
              Redo
            </button>
            <button
              className="workflow-btn workflow-btn-accent"
              onClick={randomizeScene}
            >
              <Shuffle size={14} weight="bold" />
              Shuffle
            </button>
          </div>
          <div className="workflow-actions compact-grid">
            <button className="workflow-btn" onClick={randomizeMode}>
              Mode
            </button>
            <button className="workflow-btn" onClick={randomizePalette}>
              Palette
            </button>
            <button className="workflow-btn" onClick={randomizeParams}>
              Params
            </button>
          </div>
          <div className="lock-grid">
            {(Object.keys(LOCK_LABELS) as Array<keyof WorkflowLocks>).map(
              (key) => {
                const locked = workflowLocks[key];
                return (
                  <button
                    key={key}
                    className={`lock-chip ${locked ? "active" : ""}`}
                    onClick={() => toggleWorkflowLock(key)}
                  >
                    {locked ? (
                      <Lock size={12} weight="bold" />
                    ) : (
                      <LockOpen size={12} weight="bold" />
                    )}
                    {LOCK_LABELS[key]}
                  </button>
                );
              },
            )}
          </div>
        </div>
      </div>

      <div
        id="onboarding-mode-section"
        className={`panel-section ${onboardingStep === 1 ? "onboarding-target" : ""}`}
      >
        {renderOnboardingCard(1)}
        <div className="section-heading section-heading-stack">
          <span className="section-label">Mode</span>
          <div className="section-copy section-copy-tight">
            Pick the visual engine first.
          </div>
        </div>
        <button
          className="open-library-btn"
          onClick={() => setIsModeModalOpen(true)}
        >
          {(() => { const Icon = MODES[animationType].icon; return <Icon size={16} weight="fill" />; })()}
          <div className="library-btn-text">
            <span>{MODES[animationType].name}</span>
            <small>{MODES[animationType].description}</small>
          </div>
        </button>

        {isModeModalOpen && createPortal(
          <div className="mode-modal-overlay" onClick={() => setIsModeModalOpen(false)}>
            <motion.div
              className="mode-modal-box"
              onClick={e => e.stopPropagation()}
              initial={{ y: 32, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
            >
              <div className="mode-modal-header">
                <div>
                  <span className="modal-kicker">Visual Engine</span>
                  <h2>Choose a renderer</h2>
                </div>
                <button className="close-btn" onClick={() => setIsModeModalOpen(false)} aria-label="Close">
                  <X size={20} weight="bold" />
                </button>
              </div>
              <div className="mode-modal-grid">
                {VALID_ANIMATION_TYPES.map((id) => {
                  const mode = MODES[id];
                  const Icon = mode.icon;
                  return (
                    <button
                      key={id}
                      className={`mode-modal-card ${animationType === id ? "active" : ""}`}
                      onClick={() => { setAnimationType(id); setIsModeModalOpen(false); }}
                    >
                      <Icon size={20} weight={animationType === id ? "fill" : "bold"} />
                      <strong>{mode.label}</strong>
                      <span>{mode.description}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>,
          document.body,
        )}
      </div>

      <div className="panel-section">
        <div className="section-heading section-heading-stack">
          <span className="section-label">Palette</span>
          <div className="section-copy section-copy-tight">
            Choose a library preset or fine-tune the current colors.
          </div>
        </div>
        <button
          className="open-library-btn"
          onClick={() => setIsModalOpen(true)}
        >
          <Palette size={16} weight="bold" />
          <div className="library-btn-text">
            <span>Palette Library</span>
            <small>60+ Curated Presets</small>
          </div>
        </button>

        <div id="color-list">
          {colors.map((rgb, index) => (
            <ColorRow
              key={index}
              rgb={rgb}
              update={(hex) => {
                setColors((prev) => {
                  const next = [...prev];
                  next[index] = hexToRgb(hex);
                  return next;
                });
              }}
              remove={() => {
                if (colors.length > 2) {
                  setColors((prev) =>
                    prev.filter((_, itemIndex) => itemIndex !== index),
                  );
                }
              }}
              showRemove={colors.length > 2}
            />
          ))}
        </div>

        <div
          className="add-color-row"
          role="button"
          tabIndex={0}
          onClick={() => {
            if (colors.length < 8) {
              setColors((prev) => [
                ...prev,
                [
                  (Math.random() * 255) | 0,
                  (Math.random() * 255) | 0,
                  (Math.random() * 255) | 0,
                ] as ColorRgb,
              ]);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (colors.length < 8) {
                setColors((prev) => [
                  ...prev,
                  [
                    (Math.random() * 255) | 0,
                    (Math.random() * 255) | 0,
                    (Math.random() * 255) | 0,
                  ] as ColorRgb,
                ]);
              }
            }
          }}
          title="Add Color"
          aria-label="Add color"
        >
          <div className="add-color-btn">
            <Plus size={11} weight="bold" />
          </div>
          <span className="add-color-label">Add color...</span>
        </div>
      </div>

      <PaletteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={(newColors) => setColors(newColors.map(hexToRgb))}
      />

      <div className="panel-section">
        <span className="section-label">Motion</span>
        <div className="section-copy">
          Tune time, zoom, and movement feel for the active renderer.
        </div>
        {viewMode === "advanced" && renderParamRow("seed", 0, 9999, 1)}
        {renderParamRow("speed", 0, animationType === "topographic" ? 0.2 : animationType === "neondrip" ? 1 : (animationType === "clouds" || animationType === "sea") ? 1 : 10, animationType === "topographic" || animationType === "neondrip" || animationType === "clouds" || animationType === "sea" ? 0.01 : 0.1)}
        {renderParamRow("scale", 0.01, animationType === "topographic" ? 0.5 : 2, 0.01)}
        {viewMode === "advanced" && renderParamRow("amplitude", 0, 2, 0.01)}
      </div>

      {viewMode === "advanced" && animationType === "three" && (
        <div className="panel-section">
          <span className="section-label">Terrain Drift</span>
          <div className="section-copy">
            Slowly reshape the mesh with random height drift over time.
          </div>
          {renderParamRow("morphSpeed", 0, 2, 0.01)}
          {renderParamRow("morphAmount", 0, 1.5, 0.01)}
        </div>
      )}

      {viewMode === "advanced" && animationType === "three" && (
        <div className="panel-section">
          <span className="section-label">Camera Lens</span>
          <div className="section-copy">
            Adjust depth-of-field focus and blur for the 3D scene.
          </div>
          <div className="param-row">
            <span className="param-label">DOF Enabled</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={params.dofEnabled}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    dofEnabled: e.target.checked,
                  }))
                }
              />
              <span className="slider" />
            </label>
          </div>
          {params.dofEnabled && (
            <>
              {renderParamRow("focusDistance", 10, 80, 1)}
              {renderParamRow("aperture", 0.001, 0.06, 0.001)}
              {renderParamRow("maxBlur", 0.01, 0.35, 0.01)}
            </>
          )}
        </div>
      )}

      {viewMode === "advanced" && (
        <div className="panel-section">
          <span className="section-label">Structure</span>
          <div className="section-copy">
            Adjust density, complexity, and edge behavior of the current visual
            system.
          </div>
          {renderParamRow("frequency", 0.01, animationType === "topographic" ? 0.3 : 4, 0.01)}
          {renderParamRow("definition", 1, animationType === "topographic" ? 3 : 12, 1)}
          {renderParamRow("blend", 0, 1, 0.01)}
          {animationType === "topographic" && renderParamRow("topoLineWidth", 0.2, 4, 0.1)}
        </div>
      )}

      {MODES[animationType].presets && (
        <div className="panel-section">
          <span className="section-label">{MODES[animationType].presetsLabel}</span>
          <div className="section-copy">{MODES[animationType].presetsDescription}</div>
          <div className="cloud-mood-selector">
            {MODES[animationType].presets!.map(({ name, sub, colors: c, params: p }) => (
              <button
                key={name}
                type="button"
                className="cloud-mood-btn"
                onClick={() => {
                  setColors(c);
                  if (p) setParams((prev) => ({ ...prev, ...p }));
                }}
              >
                <div
                  className="cloud-mood-swatch"
                  style={{
                    background: `linear-gradient(135deg,
                      rgb(${c[0].join(",")}) 0%,
                      rgb(${c[1].join(",")}) 50%,
                      rgb(${c[2].join(",")}) 100%)`,
                  }}
                />
                <div className="cloud-mood-text">
                  <strong>{name}</strong>
                  <span>{sub}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {animationType === "octagrams" && (
        <div className="panel-section">
          <span className="section-label">Octagram Options</span>
          <div className="section-copy">
            Camera altitude, tile scale, and optional effects.
          </div>
          {renderParamRow("octagramAltitude", 0, 1, 0.01)}
          {renderParamRow("octagramDensity", 0, 1, 0.01)}
          <div className="param-row">
            <span className="param-label">Trails</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={params.octagramTrails ?? false}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, octagramTrails: e.target.checked }))
                }
              />
              <span className="slider" />
            </label>
          </div>
          <div className="param-row">
            <span className="param-label">Color Cycle</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={params.octagramColorCycle ?? false}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, octagramColorCycle: e.target.checked }))
                }
              />
              <span className="slider" />
            </label>
          </div>
        </div>
      )}

      {animationType === "clouds" && (
        <div className="panel-section">
          <span className="section-label">Cloud Type</span>
          <div className="section-copy">
            Switch between five distinct cloud formations.
          </div>
          <div className="cloud-type-selector">
            {(
              [
                { id: 0, label: "Cumulus",       sub: "puffy, flat base" },
                { id: 1, label: "Stratus",        sub: "flat layer" },
                { id: 2, label: "Cirrus",         sub: "wispy, high alt." },
                { id: 3, label: "Cumulonimbus",   sub: "storm tower" },
                { id: 4, label: "Mammatus",       sub: "bumpy underside" },
              ] as const
            ).map(({ id, label, sub }) => (
              <button
                key={id}
                type="button"
                className={`cloud-type-btn ${(params.cloudType ?? 0) === id ? "active" : ""}`}
                onClick={() => setParams((prev) => ({ ...prev, cloudType: id }))}
              >
                <strong>{label}</strong>
                <span>{sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {animationType === "clouds" && (
        <div className="panel-section">
          <div className="section-heading">
            <span className="section-label">God Rays</span>
            <button
              type="button"
              className={`section-toggle ${params.godRays ? "active" : ""}`}
              onClick={() => setParams((prev) => ({ ...prev, godRays: !prev.godRays }))}
              aria-pressed={params.godRays}
            >
              {params.godRays ? "On" : "Off"}
            </button>
          </div>
          <div className="section-copy">
            Volumetric light shafts radiating from the sun through cloud gaps.
          </div>
        </div>
      )}

      <div
        id="onboarding-workspace-section"
        className={`workspace-section panel-section ${onboardingStep === 2 ? "onboarding-target" : ""}`}
      >
        {renderOnboardingCard(2)}
        <div className="section-heading">
          <span className="section-label">Workspace</span>
          <button
            className={`section-toggle ${exportExpanded ? "active" : ""}`}
            onClick={() => setExportExpanded((expanded) => !expanded)}
            aria-expanded={exportExpanded}
            aria-controls="export-presets"
          >
            {exportExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            Export Presets
          </button>
        </div>
        <div className="section-copy">
          Save or share the current scene, then open export presets when you
          need output files.
        </div>
        <div className="workspace-actions workspace-actions-primary">
          <button className="workspace-btn" onClick={savePreset}>
            Save
          </button>
          <button className="workspace-btn" onClick={shareScene}>
            Share
          </button>
        </div>
        <div
          id="export-presets"
          className={`export-details ${exportExpanded ? "expanded" : ""}`}
        >
          <div className="workspace-actions workspace-actions-secondary">
            <button
              className="workspace-btn workspace-btn-wide"
              onClick={() => exportImage(1)}
            >
              Still PNG
            </button>
            <button
              className="workspace-btn workspace-btn-wide"
              onClick={() => exportImage(2)}
            >
              HD PNG
            </button>
            <button
              className="workspace-btn workspace-btn-wide"
              onClick={() => recordVideo(5)}
              disabled={isRecording}
            >
              {isRecording ? "Recording" : "5s WebM"}
            </button>
          </div>
          <div className="workspace-actions workspace-actions-secondary">
            <button
              className="workspace-btn workspace-btn-wide"
              onClick={() => recordVideo(10)}
              disabled={isRecording}
            >
              {isRecording ? "Recording" : "10s WebM"}
            </button>
            <button
              className="workspace-btn workspace-btn-wide"
              onClick={() => recordVideo(loopSafeDurationSeconds, true)}
              disabled={isRecording || !canLoopSafeExport}
              title={
                canLoopSafeExport
                  ? "Export a seamless boomerang WebM loop"
                  : "Loop-safe export is available for liquid, waves, voronoi, and blobs"
              }
            >
              {isRecording ? "Recording" : "Loop-safe WebM"}
            </button>
          </div>
          <div className="export-note">
            <span>
              {canLoopSafeExport
                ? `Loop-safe export records a ${loopSafeDurationSeconds}s boomerang clip.`
                : "Loop-safe export is available for liquid, waves, voronoi, and blobs."}
            </span>
          </div>
        </div>
        {exportStatus.phase === "idle" && (
          <p className="workspace-empty">
            Export still PNGs or short WebM clips when the current scene is
            ready to keep.
          </p>
        )}
        {exportStatus.phase !== "idle" && (
          <div className={`export-status export-status-${exportStatus.phase}`}>
            <div className="export-status-shell">
              <div className="export-progress-arc" aria-hidden="true">
                <svg viewBox="0 0 48 48" className="export-progress-arc-svg">
                  <circle
                    className="export-progress-arc-track"
                    cx="24"
                    cy="24"
                    r="18"
                  />
                  <circle
                    className="export-progress-arc-fill"
                    cx="24"
                    cy="24"
                    r="18"
                    pathLength="100"
                    style={{
                      strokeDashoffset: `${100 - exportStatus.progress}`,
                    }}
                  />
                </svg>
                <span>{exportStatus.progress}%</span>
              </div>
              <div className="export-status-main">
                <div className="export-status-header">
                  <strong>{exportStatus.label}</strong>
                </div>
                {exportStatus.detail && <p>{exportStatus.detail}</p>}
                {typeof exportStatus.frameCount === "number" &&
                  typeof exportStatus.frameTotal === "number" && (
                    <div className="export-frame-counter">
                      <span>Frames</span>
                      <strong>
                        {exportStatus.frameCount}
                        <small> / {exportStatus.frameTotal}</small>
                      </strong>
                    </div>
                  )}
              </div>
            </div>
            <div className="export-progress-track">
              <span
                className="export-progress-bar"
                style={{ width: `${exportStatus.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="panel-section panel-section-secondary">
        <div className="section-heading">
          <div className="section-heading-inline">
            <span className="section-label">Library</span>
            {savedPresets.length > 0 && (
              <span className="section-count">
                {filteredSavedPresets.length} shown
              </span>
            )}
          </div>
          <button
            className={`section-toggle ${savedExpanded ? "active" : ""}`}
            onClick={() => setSavedExpanded((expanded) => !expanded)}
            aria-expanded={savedExpanded}
            aria-controls="saved-library"
          >
            {savedExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            Saved
          </button>
        </div>
        <div
          id="saved-library"
          className={`saved-library-shell ${savedExpanded ? "expanded" : ""}`}
        >
          {savedPresets.length > 0 ? (
            <>
              <div className="saved-tools">
                <input
                  className="saved-search"
                  type="text"
                  value={savedSearch}
                  onChange={(event) => setSavedSearch(event.target.value)}
                  placeholder="Search saved scenes..."
                />
                <div className="saved-select-row">
                  <InlineSelect
                    label="Mode"
                    value={savedMode}
                    onChange={setSavedMode}
                    options={[
                      { value: "all", label: "All modes" },
                      ...VALID_ANIMATION_TYPES.map((type) => ({
                        value: type,
                        label: MODES[type].name,
                      })),
                    ]}
                  />
                  <InlineSelect
                    label="Sort"
                    value={savedSort}
                    onChange={setSavedSort}
                    options={[
                      { value: "newest", label: "Newest" },
                      { value: "oldest", label: "Oldest" },
                      { value: "name", label: "Name" },
                    ]}
                  />
                </div>
              </div>
              {filteredSavedPresets.length > 0 ? (
                <div className="saved-list">
                  {filteredSavedPresets.map((preset) => (
                    <div key={preset.id} className="saved-item">
                      <button
                        className="saved-load-btn"
                        onClick={() => loadPreset(preset)}
                        title={preset.name}
                      >
                        <div
                          className="saved-preview"
                          style={{
                            background: `linear-gradient(90deg, ${preset.colors.map((color) => `rgb(${color.join(",")})`).join(", ")})`,
                          }}
                        />
                        <span>{preset.name}</span>
                        <div className="saved-meta">
                          <small>
                            {formatAnimationType(preset.animationType)}
                          </small>
                          <small>{formatPresetDate(preset.createdAt)}</small>
                        </div>
                      </button>
                      <button
                        className="saved-delete-btn"
                        onClick={() => deletePreset(preset.id)}
                        title="Delete preset"
                        aria-label={`Delete preset ${preset.name}`}
                      >
                        <Trash size={12} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="saved-empty">
                  No saved presets match the current search or mode filter.
                </p>
              )}
            </>
          ) : (
            <p className="saved-empty">
              No saved presets yet. Save the current scene to start building
              your library.
            </p>
          )}
        </div>
      </div>

      <div className="panel-section panel-section-secondary">
        <div className="section-heading">
          <div className="section-heading-inline">
            <span className="section-label">History</span>
            {recentScenes.length > 0 && (
              <span className="section-count">
                {Math.min(recentScenes.length, 4)} recent
              </span>
            )}
          </div>
          <button
            className={`section-toggle ${recentExpanded ? "active" : ""}`}
            onClick={() => setRecentExpanded((expanded) => !expanded)}
            aria-expanded={recentExpanded}
            aria-controls="recent-scenes"
          >
            {recentExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            Recent
          </button>
        </div>
        <div
          id="recent-scenes"
          className={`saved-library-shell ${recentExpanded ? "expanded" : ""}`}
        >
          {recentScenes.length > 0 ? (
            <div className="saved-list">
              {recentScenes.slice(0, 4).map((scene) => (
                <div key={scene.id} className="saved-item">
                  <button
                    className="saved-load-btn"
                    onClick={() => loadRecentScene(scene)}
                    title={scene.name}
                  >
                    <div
                      className="saved-preview"
                      style={{
                        background: `linear-gradient(90deg, ${scene.colors.map((color) => `rgb(${color.join(",")})`).join(", ")})`,
                      }}
                    />
                    <span>{scene.name}</span>
                    <div className="saved-meta">
                      <small>{scene.source}</small>
                      <small>{formatPresetDate(scene.seenAt)}</small>
                    </div>
                  </button>
                  <button
                    className="saved-delete-btn"
                    onClick={() => deleteRecentScene(scene.id)}
                    aria-label={`Remove ${scene.name} from recent scenes`}
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="saved-empty">
              Recent scenes will appear here after you load, save, or share a
              scene.
            </p>
          )}
        </div>
      </div>

      <div className="panel-section panel-section-secondary">
        <div className="section-heading">
          <span className="section-label">Utilities</span>
          <button
            className={`section-toggle ${resetExpanded ? "active" : ""}`}
            onClick={() => setResetExpanded((expanded) => !expanded)}
            aria-expanded={resetExpanded}
            aria-controls="reset-tools"
          >
            {resetExpanded ? (
              <CaretDown size={12} weight="bold" />
            ) : (
              <CaretRight size={12} weight="bold" />
            )}
            Reset
          </button>
        </div>
        <div
          id="reset-tools"
          className={`saved-library-shell ${resetExpanded ? "expanded" : ""}`}
        >
          <div className="reset-actions">
            <button className="workspace-btn" onClick={resetMode}>
              Mode
            </button>
            <button className="workspace-btn" onClick={resetPalette}>
              Palette
            </button>
            <button className="workspace-btn" onClick={resetScene}>
              All
            </button>
          </div>
        </div>
      </div>

      <div className="bottom-controls">
        <button
          className={`ctrl-btn ${paused ? "active" : ""}`}
          onClick={() => setPaused(!paused)}
          title={paused ? "Resume" : "Pause"}
        >
          <PlayPause size={14} weight="bold" />
          {paused ? "PLAY" : "PAUSE"}
        </button>
        <button
          className={`ctrl-btn ${fullscreen ? "active" : ""}`}
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          <CornersOut size={14} weight="bold" />
          FULL
        </button>
        <button className="ctrl-btn" onClick={hideUI} title="Hide UI (H)">
          <EyeSlash size={14} weight="bold" />
          HIDE
        </button>
        <button
          className="ctrl-btn"
          onClick={openShortcuts}
          title="Shortcuts (?)"
          aria-label="Open keyboard shortcuts"
        >
          <Question size={14} weight="bold" />
          Help
        </button>
      </div>
    </>
  );
}
