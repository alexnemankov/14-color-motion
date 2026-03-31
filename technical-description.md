# Color Motion Lab: Technical Description

This document describes the current implementation of Color Motion Lab as it exists in the repository today.

## 1. Product Overview

Color Motion Lab is a fullscreen generative motion app with a single active renderer at a time and a shared scene model across all modes. The root app coordinates renderer selection, parameter editing, persistence, sharing, onboarding, and export.

The shipped product currently includes:

- six rendering modes
- a floating desktop panel and mobile bottom-sheet UI
- palette library browsing with favorites and recents
- local preset storage and recent scene tracking
- undo/redo scene history
- share links
- PNG and WebM export
- renderer fallback handling and onboarding UX

## 2. Stack

- Framework: React 18
- Language: TypeScript
- Build tool: Vite
- Styling: plain CSS in `src/index.css`
- UI motion: Framer Motion
- Icons: `@phosphor-icons/react`
- Micro-interactions: `canvas-confetti`
- Deployment target: GitHub Pages via `gh-pages`

Rendering backends currently used in the codebase:

- Canvas 2D
- WebGL2
- WebGPU

## 3. Project Structure

```text
src/
  App.tsx                       App state, orchestration, persistence, sharing, export
  main.tsx                      React entry point
  index.css                     Full visual system and responsive layout
  data/
    palettes.ts                 Curated palette library
  migrations/
    sceneMigrations.ts          Versioned scene persistence migration
  workers/
    particlesWorker.ts          Background particle simulation
  components/
    Panel.tsx                   Main control surface
    PaletteModal.tsx            Palette library modal
    RendererBoundary.tsx        Renderer error boundary
    rendererTypes.ts            Shared renderer interfaces
    rendererMotion.ts           Shared parameter smoothing helpers
    LiquidCanvas.tsx            Canvas renderer with external time support
    WavesCanvas.tsx             Canvas renderer with external time support
    VoronoiCanvas.tsx           Canvas renderer with external time support
    BlobsCanvas.tsx             Canvas renderer with external time support
    ParticlesCanvas.tsx         Canvas renderer with worker-backed simulation
    TuringCanvas.tsx            Wrapper choosing WebGPU or WebGL2 implementation
    TuringWebGLCanvas.tsx       WebGL2 reaction-diffusion implementation
    TuringWebGPUCanvas.tsx      WebGPU reaction-diffusion implementation
```

## 4. Core Domain Model

`App.tsx` defines the shared scene types used across renderers and persistence.

### Scene types

`AnimationType`

- `liquid`
- `waves`
- `voronoi`
- `turing`
- `particles`
- `blobs`

`GradientParams`

- `seed`
- `speed`
- `scale`
- `amplitude`
- `frequency`
- `definition`
- `blend`

`SceneState`

- `animationType`
- `params`
- `colors`

Additional persisted scene-shaped records:

- `SavedPreset`
- `RecentScene`

The application keeps one normalized scene model and lets each renderer interpret the same parameter set differently.

## 5. App Responsibilities

`src/App.tsx` is the system coordinator. Its responsibilities include:

- loading the initial scene from a share link or session storage
- validating and migrating persisted scene data
- maintaining active scene state and scene history
- driving palette interpolation during palette changes
- handling mode transition crossfades
- saving presets and recent scenes
- copying share links to the clipboard
- coordinating PNG and WebM export
- driving deterministic loop-safe playback through `externalRenderTime`
- showing toast, onboarding, dialog, and export status UI

Important constants in the current implementation:

- history limit: `40`
- palette transition duration: `1500ms`
- loop-safe export duration: `6s`
- recent scenes limit: `8`
- share payload version: `v1`

## 6. Persistence and Migration

Scene persistence is versioned through `src/migrations/sceneMigrations.ts`.

Current behavior:

- `CURRENT_SCENE_VERSION` is `1`
- legacy payloads without a version are treated as version `0`
- `migratePersistedScene()` normalizes older payloads before use
- `serializeSceneForPersistence()` writes versioned scene payloads back to storage

`localStorage` keys currently used:

- session scene
- saved presets
- recent scenes
- onboarding dismissed state
- palette favorites
- recent palettes

Storage failures are handled with non-fatal toasts. Preset and recent-scene writes are not assumed to always succeed.

## 7. Sharing Model

Share links are generated entirely client-side.

Current format:

- scene data is compacted into a small payload
- the payload is base64url-encoded
- the encoded value is stored in the `scene` query parameter
- scene names may be embedded directly in the compact payload
- legacy URL parsing is still supported

The share format is compact, but it is not compressed with gzip or an external library.

## 8. Renderer Contract

`src/components/rendererTypes.ts` defines the shared renderer interface:

- `supportsExternalTime`
- `supportsLoopSafeExport`
- `getCanvas()`
- `captureFrame()`
- status reporting through `onStatusChange`

This is the formalized renderer contract the roadmap previously called for.

`src/components/rendererMotion.ts` provides shared param smoothing:

- `cloneParams()`
- `stepSmoothedParams()`

This smoothing is used inside render loops so parameter edits feel continuous instead of snapping instantly.

## 9. Rendering Architecture

### Deterministic Canvas renderers

`LiquidCanvas`, `WavesCanvas`, `VoronoiCanvas`, and `BlobsCanvas`:

- render to fullscreen canvas elements
- support parameter smoothing
- support even-dimension sizing during export
- implement `externalTime`
- expose `supportsLoopSafeExport: true`

These modes can be driven by `externalRenderTime` during loop-safe export.

### Particle renderer

`ParticlesCanvas` renders with Canvas 2D, but its simulation step runs in `src/workers/particlesWorker.ts`.

Current worker design:

- worker owns particle positions and velocities
- main thread sends `init`, `resize`, and `step` messages
- worker returns typed-array frame payloads for nodes and links
- link and node drawing remains on the main thread canvas
- pointer interaction is forwarded into the worker simulation

This is already the worker migration that earlier planning documents identified as future work.

### Turing renderer

`TuringCanvas` is a wrapper that prefers WebGPU when `navigator.gpu` exists and otherwise falls back to WebGL2.

`TuringWebGPUCanvas`:

- uses a compute shader for the simulation step
- uses a render pipeline for final palette mapping
- rebuilds textures on resize and reseed
- falls back silently if initialization fails

`TuringWebGLCanvas`:

- runs the simulation in WebGL2 framebuffers
- uses ping-pong textures for reaction-diffusion state
- handles palette mapping in a render shader

Turing does not currently support `externalTime` or loop-safe export because it is simulation-driven.

## 10. UI Architecture

### Panel

`src/components/Panel.tsx` is the main workspace surface. It contains:

- workflow tools
- mode selection
- palette editing
- motion and structure controls
- workspace actions
- export controls
- reset actions
- saved preset browsing
- recent scene browsing
- transport controls

Current workflow features exposed in the panel:

- compact and advanced density modes
- undo/redo
- scene shuffle
- randomize mode, palette, or params independently
- workflow locks for mode, palette, seed, and motion

### Palette modal

`src/components/PaletteModal.tsx` is a full-screen portal modal with:

- search
- category filters
- favorites
- recent palettes
- active selection preview
- surprise/random selection

The palette library currently ships with 67 palette descriptors from `src/data/palettes.ts`.

### Onboarding and dialogs

The app now includes:

- a three-step onboarding flow persisted in local storage
- a save-preset dialog
- a keyboard shortcuts dialog
- transient toast notifications
- renderer fallback overlays

## 11. Export Pipeline

The export system is entirely browser-side.

### Image export

- standard PNG export
- `2x` PNG export through temporary render scaling
- progress state transitions through `preparing`, `capturing`, and `complete`

### Video export

- `MediaRecorder`-based WebM capture
- standard `5s` and `10s` recordings
- loop-safe recording for deterministic renderers
- progress state transitions through `preparing`, `recording`, `encoding`, and `complete`
- progress arc and frame counter UI in the panel

Loop-safe export currently works by mirroring time across the clip duration and assigning the result to `externalRenderTime`.

## 12. Error Handling and Fallbacks

Current defensive layers include:

- `RendererBoundary` for renderer crashes
- renderer-level status reporting for unsupported APIs
- a visible renderer fallback card with compatibility link
- storage error toasts
- recording/export error states in the export panel

The current fallback recommendation in the UI is to switch to `particles` if another renderer fails.

## 13. Styling and Responsive Behavior

`src/index.css` owns the full visual language.

Current design characteristics:

- black and charcoal surfaces
- orange accent color
- `Space Grotesk` display typography
- `JetBrains Mono` technical typography
- border-led industrial panel styling
- animated export states
- animated palette cards

Responsive behavior:

- desktop uses a fixed right-side panel
- smaller screens switch to a bottom-sheet style panel
- the palette modal adapts to a mobile fullscreen layout

## 14. What Is Already Implemented vs. Still Roadmap

Several features previously listed as future improvements are already implemented in this repository:

- onboarding
- shortcut discoverability with `?`
- renderer transition crossfade
- parameter smoothing
- palette interpolation
- typed renderer handle contract
- persistence migrations
- worker-backed particle simulation
- WebGPU progressive enhancement for Turing

Not implemented in the current codebase:

- keyframe timeline editor
- layered renderer compositing
- audio reactivity
- GIF export
- thumbnail-based saved preset previews
- compressed or server-backed share URLs

## 15. Development Commands

```bash
npm install
npm run dev
npm run build
npm run preview
npm run deploy
```
