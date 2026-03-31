# Color Motion Lab

Color Motion Lab is a browser-based motion design playground for building animated color studies with curated palettes and multiple rendering systems. It runs as a React + TypeScript single-page app and combines fullscreen rendering, a compact control panel, local scene persistence, share links, and in-browser export.

## Current Feature Set

- Six renderers:
  - Fluid FBM
  - Interference Waves
  - Cellular Voronoi
  - Reaction-Diffusion
  - Particle Web
  - Molten Blobs
- Shared scene controls:
  - `seed`
  - `speed`
  - `scale`
  - `amplitude`
  - `frequency`
  - `definition`
  - `blend`
- Palette workflow:
  - 67 curated palettes
  - search and category filters
  - favorites and recent palettes
  - surprise/random palette selection
  - manual color editing with 2-8 colors
  - animated palette interpolation on palette changes
- Scene workflow:
  - local preset saving
  - recent scenes
  - undo/redo history
  - scene, mode, palette, and parameter randomization
  - workflow locks for mode, palette, seed, and motion
  - compact and advanced control density modes
- Export and sharing:
  - PNG export
  - 2x PNG export
  - 5s and 10s WebM recording
  - loop-safe WebM export for deterministic renderers
  - compact shareable URLs with encoded scene state
- UX:
  - first-run onboarding
  - keyboard shortcut dialog
  - renderer error fallback UI
  - mode-switch crossfade
  - export progress UI with status phases
  - desktop floating panel and mobile bottom-sheet layout

## Keyboard Shortcuts

- `?`: open shortcuts
- `Space`: pause/resume
- `H`: hide/show UI
- `F`: toggle fullscreen
- `R`: randomize scene
- `S`: save preset
- `Ctrl/Cmd + Z`: undo
- `Ctrl/Cmd + Y`: redo
- `Ctrl/Cmd + Shift + Z`: redo

Shortcuts are ignored while typing in editable fields.

## Renderer Notes

- `liquid`, `waves`, `voronoi`, and `blobs` support deterministic `externalTime` playback and loop-safe export.
- `particles` runs its simulation in a Web Worker.
- `turing` prefers WebGPU when available and falls back to WebGL2.
- A renderer boundary and status overlay handle unsupported or failed rendering paths.

## Tech Stack

- React 18
- TypeScript
- Vite
- Framer Motion
- Phosphor Icons
- Canvas Confetti
- Canvas 2D, WebGL2, and WebGPU

## Development

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run preview
npm run deploy
```

## Persistence

The app stores the current session, saved presets, recent scenes, palette favorites, recent palettes, and onboarding dismissal state in `localStorage`. Persisted scene payloads are versioned and migrated on load.

## Status

This repository already includes several items that were previously roadmap ideas, including onboarding, keyboard shortcut discovery, renderer transition crossfades, palette interpolation, typed renderer handles, persistence migrations, a worker-backed particles renderer, and WebGPU enhancement for Turing mode.
