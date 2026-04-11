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

- **[App.tsx](src/App.tsx)** — Main orchestrator (~550 lines). Manages scene state, localStorage persistence, URL share encoding, undo/redo history, randomization, and export workflows. The `GradientParams` object (defined in [rendererTypes.ts](src/components/rendererTypes.ts)) is the single unified parameter set passed to all renderers.

- **[Panel.tsx](src/components/Panel.tsx)** — Control panel (~1,315 lines). All parameter controls, palette selection, preset management, recording/export UI, and compact vs. advanced view modes.

- **[PaletteModal.tsx](src/components/PaletteModal.tsx)** — Palette browser with 67 curated palettes (defined in [palettes.ts](src/data/palettes.ts)), search, tag filters, and localStorage-backed favorites.

### Renderer Layer

Eight renderers each implement the `RendererHandle` interface from [rendererTypes.ts](src/components/rendererTypes.ts):

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

The `RendererHandle` interface requires: `status`, `supportsExternalTime`, `supportsLoopSafeExport`, `getCanvas()`, `captureFrame()`. Renderers are wrapped in `RendererBoundary` for error isolation.

**Parameter smoothing**: `rendererMotion.ts` applies spring interpolation (SPRING_ALPHA = 0.08) to all `GradientParams` before passing them to renderers, preventing jarring jumps on parameter changes.

### State & Persistence

- Scene state is persisted to localStorage (`color-motion-session`) as versioned JSON payloads.
- Schema migrations live in [sceneMigrations.ts](src/migrations/sceneMigrations.ts) — add a new migration entry there whenever `GradientParams` or the scene shape changes.
- URL sharing encodes the full scene as compact Base64.
- Presets: `color-motion-presets`; recent scenes: `color-motion-recent-scenes`; onboarding: `color-motion-onboarding-dismissed`.

### Export System

Exports go through phases tracked in App.tsx: `idle → preparing → capturing → recording → encoding → complete/error`.

- **PNG**: 1× and 2× resolution.
- **WebM video**: 5s or 10s real-time recording, OR loop-safe deterministic export (for renderers where `supportsLoopSafeExport` is true, driven by external time steps).
- `ParticlesCanvas` uses a Web Worker ([particlesWorker.ts](src/workers/particlesWorker.ts)) for simulation; coordinate with the worker protocol when touching particle logic.

### Key Dependencies

- **Three.js 0.162** + `three-stdlib` for 3D rendering.
- **Framer Motion 12** for UI animations.
- **@phosphor-icons/react** + **lucide-react** for icons.
- **react-colorful** for color pickers.
