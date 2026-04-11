# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript compilation + Vite production build
npm run preview   # Preview the production build locally
```

No test or lint scripts are configured.

## Architecture Overview

**Color Motion Lab** is a React 18 + TypeScript SPA (bundled with Vite 5) for creating and sharing animated color visualizations. It deploys to GitHub Pages at base path `/14-color-motion/`.

### Core Components

- **[App.tsx](src/App.tsx)** — Main orchestrator. Manages scene state, localStorage persistence, URL share encoding, undo/redo history, randomization, and export workflows. The `GradientParams` object is the single unified parameter set passed to all renderers. When switching to `"clouds"` mode, `startModeTransition` automatically applies a noon sky palette.

- **[Panel.tsx](src/components/Panel.tsx)** — Control panel. All parameter controls, palette selection, preset management, recording/export UI, and compact vs. advanced view modes. Contains mode-specific sections: `topoLineWidth` slider for Topographic, **Cloud Type** selector (5 formations) and **Sky Mood** presets (Noon/Dusk/Dawn/Storm) for Clouds.

- **[PaletteModal.tsx](src/components/PaletteModal.tsx)** — Palette browser with 67 curated palettes (defined in [palettes.ts](src/data/palettes.ts)), search, tag filters, and localStorage-backed favorites.

### Renderer Layer

Ten renderers each implement the `RendererHandle` interface from [rendererTypes.ts](src/components/rendererTypes.ts):

| Component | Technique | Backend |
|-----------|-----------|---------|
| `LiquidCanvas` | Fluid FBM | WebGL2 |
| `WavesCanvas` | Interference waves | WebGL2 |
| `VoronoiCanvas` | Cellular Voronoi | WebGL2 |
| `TuringCanvas` | Reaction-Diffusion (dispatches to sub-renderers) | WebGPU → WebGL2 fallback |
| `BlobsCanvas` | Molten blobs | Canvas 2D |
| `ThreeJSCanvas` | 3D scene | Three.js 0.162 |
| `TopographicCanvas` | Topographic contours | Canvas 2D |
| `ParticlesCanvas` | Particle web | Web Worker + Canvas 2D |
| `NeonDripCanvas` | Metaball drip blobs | Canvas 2D |
| `CloudsCanvas` | Volumetric ray-marched sky | WebGL2 |

The `RendererHandle` interface requires: `status`, `supportsExternalTime`, `supportsLoopSafeExport`, `getCanvas()`, `captureFrame()`. Renderers are wrapped in `RendererBoundary` for error isolation.

**Parameter smoothing**: `rendererMotion.ts` applies spring interpolation (SPRING_ALPHA = 0.08) to all `GradientParams` before passing them to renderers, preventing jarring jumps on parameter changes.

### GradientParams Fields

All renderers share a single `GradientParams` object. Most fields are universal; some are mode-specific:

| Field | Type | Notes |
|-------|------|-------|
| `seed` | number | Random seed / reseed trigger |
| `speed` | number | Animation speed |
| `scale` | number | Zoom / scale |
| `amplitude` | number | FBM amplitude or wander strength |
| `frequency` | number | Noise / cell frequency |
| `definition` | number | Octave count / detail level |
| `blend` | number | Color blend / contrast / softness |
| `morphSpeed` | number | 3D mesh drift speed (Three only) |
| `morphAmount` | number | 3D mesh drift height (Three only) |
| `focusDistance` | number | DOF focus distance (Three only) |
| `aperture` | number | DOF aperture (Three only) |
| `maxBlur` | number | DOF max blur (Three only) |
| `dofEnabled` | boolean | DOF toggle (Three only) |
| `topoLineWidth` | number | Contour line width (Topographic only) |
| `cloudType` | number | 0–4 cloud formation (Clouds only) |

### CloudsCanvas Details

`CloudsCanvas` is a WebGL2 volumetric ray-marcher with:
- **Procedural gradient noise** (no textures required)
- **5 cloud types** via `uniform int uCloudType`: Cumulus (0), Stratus (1), Cirrus (2), Cumulonimbus (3), Mammatus (4)
- **4-pass progressive raymarch** with quality degrading by distance; all passes always sample — octave count is controlled via `uDefinition` (maps 1–12 → 1–5 octaves via `qualityOctaves()`)
- **Drag-to-orbit camera**: mousedown captures drag origin, mousemove accumulates delta, mouseup releases — angle never jumps on new drag
- **Palette mapping**: `colors[0]` → sky, `colors[1]` → cloud tint, `colors[2]` → sun/scatter, `colors[3]` → shadow
- **Sky Mood presets** in Panel set all 4 colors at once (Noon, Dusk, Dawn, Storm)
- Entering Clouds mode auto-applies Noon palette

### State & Persistence

- Scene state is persisted to localStorage (`color-motion-session`) as versioned JSON payloads.
- Schema migrations live in [sceneMigrations.ts](src/migrations/sceneMigrations.ts) — add a new migration entry there whenever `GradientParams` or the scene shape changes.
- URL sharing encodes the full scene as compact Base64.
- Presets: `color-motion-presets`; recent scenes: `color-motion-recent-scenes`; onboarding: `color-motion-onboarding-dismissed`.

### Export System

Exports go through phases tracked in App.tsx: `idle → preparing → capturing → recording → encoding → complete/error`.

- **PNG**: 1× and 2× resolution.
- **WebM video**: 5s or 10s real-time recording, OR loop-safe deterministic export (for renderers where `supportsLoopSafeExport` is true, driven by external time steps).
- Loop-safe export is supported by: `liquid`, `waves`, `voronoi`, `blobs`, `three`, `clouds`.
- `ParticlesCanvas` uses a Web Worker ([particlesWorker.ts](src/workers/particlesWorker.ts)) for simulation; coordinate with the worker protocol when touching particle logic.

### Key Dependencies

- **Three.js 0.162** + `three-stdlib` for 3D rendering.
- **Framer Motion 12** for UI animations.
- **@phosphor-icons/react** + **lucide-react** for icons.
- **react-colorful** for color pickers.
