# Color Motion Lab

Color Motion Lab is a browser-based motion design playground for building animated color studies with curated palettes and multiple rendering systems. It runs as a React + TypeScript single-page app and combines fullscreen rendering, a compact control panel, local scene persistence, share links, and in-browser export.

## Current Feature Set

- Twelve renderers:
  - Fluid FBM
  - Interference Waves
  - Cellular Voronoi
  - Reaction-Diffusion
  - Particle Web
  - Molten Blobs
  - 3D Mesh
  - Topographic
  - Neon Drip
  - Clouds
  - Sea
  - Prism
- Shared scene controls:
  - `seed`
  - `speed`
  - `scale`
  - `amplitude`
  - `frequency`
  - `definition`
  - `blend`
- Mode-specific controls:
  - `topoLineWidth` — contour line width (Topographic)
  - `cloudType` — cloud formation selector 0–4 (Clouds)
  - DOF controls: `focusDistance`, `aperture`, `maxBlur`, `dofEnabled` (3D Mesh)
  - Terrain drift: `morphSpeed`, `morphAmount` (3D Mesh)
- Clouds mode extras:
  - 5 cloud formations: Cumulus, Stratus, Cirrus, Cumulonimbus, Mammatus
  - Sky Mood presets: Noon, Dusk, Dawn, Storm (sets full 4-color palette)
  - Drag-to-orbit camera — angle persists across drags, never jumps
  - Auto-applies Noon palette on mode entry
- Sea mode extras:
  - Height-field ocean with procedural wave octaves
  - Sea Mood presets: Midday, Sunset, Tropic, Storm (sets full 4-color palette)
  - Drag-to-orbit camera — mouse X = heading, mouse Y = elevation
  - Auto-applies Midday palette on mode entry
- Prism mode extras:
  - UV-displacement prism with chromatic RGB channel separation
  - Prism Mood presets: Spectral, Neon, Plasma, Void (sets full 4-color palette)
  - Auto-applies Spectral palette on mode entry
- Mode switcher:
  - Compact trigger button (same style as Palette Library) showing the current mode name and description
  - Opens a modal with a 3-column card grid for all 12 modes (icon + name + description per card)
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
  - loop-safe WebM export for deterministic renderers (liquid, waves, voronoi, blobs, three, clouds, sea, prism)
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

- `liquid`, `waves`, `voronoi`, `blobs`, `three`, `clouds`, `sea`, and `prism` support deterministic `externalTime` playback and loop-safe export.
- `particles` runs its simulation in a Web Worker.
- `turing` prefers WebGPU when available and falls back to WebGL2.
- `clouds` uses a WebGL2 volumetric ray-marcher with procedural gradient noise and a drag-to-orbit camera.
- `sea` uses a WebGL2 height-field ocean renderer with a mouse-driven orbit camera (X = heading, Y = elevation).
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

This repository already includes several items that were previously roadmap ideas, including onboarding, keyboard shortcut discovery, renderer transition crossfades, palette interpolation, typed renderer handles, persistence migrations, a worker-backed particles renderer, WebGPU enhancement for Turing mode, topographic contour rendering, neon drip blobs, volumetric cloud rendering with cloud type switching and sky mood presets, and a WebGL2 height-field sea renderer with sea mood presets.
