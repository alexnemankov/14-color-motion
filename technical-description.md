# Color Motion Lab: Technical Description

This document describes the current technical state of the project and is meant to help future contributors understand how the app is structured, what it already supports, and where the main integration points live.

## 1. Product Shape

Color Motion Lab is a single-page generative art application. It combines:

- a fullscreen rendering surface
- a floating control panel
- a fullscreen palette library modal
- local scene/preset persistence
- still and video export
- multiple rendering backends under one shared parameter model

The root `App.tsx` owns the scene state and routes that state into both the active renderer and the UI controls.

## 2. Stack

- Framework: React 18
- Language: TypeScript
- Build tool: Vite
- Styling: plain CSS with CSS variables
- UI animation: Framer Motion
- Icons: `@phosphor-icons/react`
- Extra visual feedback: `canvas-confetti`
- Deployment: GitHub Pages via `gh-pages`

Rendering uses a mix of:

- Canvas 2D
- WebGL
- WebGL2

depending on the active visual mode.

## 3. Directory Structure

```text
src/
  App.tsx                    Root state, scene orchestration, export/share logic
  main.tsx                   React entry point
  index.css                  Global styles and component styling
  components/
    Panel.tsx                Floating control panel and workflow UI
    PaletteModal.tsx         Fullscreen palette browser
    LiquidCanvas.tsx         Fluid FBM renderer
    WavesCanvas.tsx          Interference wave renderer
    VoronoiCanvas.tsx        Cellular/Voronoi renderer
    TuringCanvas.tsx         Reaction-diffusion renderer
    ParticlesCanvas.tsx      Particle network renderer
    BlobsCanvas.tsx          Blob-based gradient renderer
  data/
    palettes.ts              Curated palette library and tag definitions
```

## 4. Core State Model

`App.tsx` is the main coordinator. It stores the active scene plus workflow, export, and persistence state.

### Scene State

`SceneState`

- `animationType`
- `params`
- `colors`

`GradientParams`

- `seed`
- `speed`
- `scale`
- `amplitude`
- `frequency`
- `definition`
- `blend`

These parameters are shared across all renderers. Each renderer interprets them differently, but the UI remains consistent.

### Persistence State

The app stores the following in local storage:

- current session scene
- saved presets
- recent scenes
- palette favorites
- recent palettes

### Workflow State

The app also tracks:

- compact vs advanced panel density
- undo/redo history
- workflow locks for mode/palette/seed/motion
- active scene name
- toast notifications
- save-dialog visibility

### Export State

Export/recording is managed through:

- `renderScale`
- `isRecording`
- loop-safe preview timing
- external render time overrides for supported renderers
- structured export status (`idle`, `preparing`, `capturing`, `recording`, `encoding`, `complete`, `error`)

## 5. UI Architecture

### Floating Panel

`Panel.tsx` is responsible for:

- mode switching
- palette editing
- param controls
- workflow tools
- export controls
- saved preset browsing
- recent scene browsing

The panel includes richer saved-library browsing:

- preset search
- mode filtering
- sort controls
- recent scenes

### Palette Library

`PaletteModal.tsx` provides:

- search
- category browsing
- favorites
- recent palettes
- surprise/random selection
- active palette preview

The modal uses Framer Motion for shell-level transitions, while the palette list itself is intentionally lightweight to avoid heavy layout animation cost during search and filtering.

### Responsive Behavior

Desktop uses a right-side floating panel. Smaller screens switch to a bottom-sheet style panel, while the palette library becomes a mobile-friendly fullscreen view.

## 6. Renderer Model

Each renderer is its own component. `App.tsx` mounts exactly one at a time based on `animationType`.

Current renderer set:

- `LiquidCanvas`
- `WavesCanvas`
- `VoronoiCanvas`
- `TuringCanvas`
- `ParticlesCanvas`
- `BlobsCanvas`

Shared renderer conventions include:

- full-viewport canvas rendering
- resize handling
- pause support
- shared parameter inputs
- shared color palette input
- renderer status reporting back to `App.tsx`
- even-dimension sizing during export/recording to reduce codec artifacts

Some renderers also support `externalTime`, which is used for deterministic export timing and loop-safe video recording.

## 7. Export and Sharing

The current output system supports:

- standard PNG export
- higher-resolution PNG export
- WebM recording
- loop-safe WebM export for supported renderers
- shareable URLs with encoded scene state and scene name

The panel exposes export presets through a dedicated dropdown, and the app displays inline export progress/status instead of relying only on toasts.

Loop-safe export is only available for renderers that can be driven predictably by external time:

- liquid
- waves
- voronoi
- blobs

Simulation-heavy modes are intentionally excluded.

## 8. Workflow Features

The app already supports a deeper workflow layer than a simple shader demo:

- save/load/delete presets
- in-app preset naming
- undo/redo scene history
- randomization by scene, mode, palette, and params
- workflow locks
- recent scenes
- keyboard shortcuts

Current keyboard shortcuts:

- `Space`: pause/resume
- `H`: toggle UI
- `F`: fullscreen

Global hotkeys ignore editable inputs so typing in search or text fields does not trigger panel actions.

## 9. Styling System

`index.css` defines the full visual system.

Key design characteristics:

- matte dark surfaces
- orange accent color
- `Space Grotesk` for display text
- `JetBrains Mono` for controls and technical labels
- strong border-based structure rather than soft glassmorphism

The CSS file also owns:

- panel layout
- modal layout
- custom range slider styling
- toast/dialog styling
- export progress styling
- palette card and category-chip styling

## 10. Build and Deployment

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

GitHub Pages deploy:

```bash
npm run deploy
```

## 11. Known Future Work Areas

The current roadmap is focused on a few remaining areas:

- A/B compare workflow
- richer output formats such as GIF if justified
- presentation mode
- broader pointer/touch interaction across more renderers
- performance modes
