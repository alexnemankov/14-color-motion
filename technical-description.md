# Color Motion Lab: Technical Description

This document describes the current implementation of Color Motion Lab as it exists in the repository today.

## 1. Product Overview

Color Motion Lab is a fullscreen generative motion app with a single active renderer at a time and a shared scene model across all modes. The root app coordinates renderer selection, parameter editing, persistence, sharing, onboarding, and export.

The shipped product currently includes:

- ten rendering modes
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
    LiquidCanvas.tsx            WebGL2 renderer, external time support
    WavesCanvas.tsx             WebGL2 renderer, external time support
    VoronoiCanvas.tsx           WebGL2 renderer, external time support
    BlobsCanvas.tsx             Canvas 2D renderer, external time support
    ParticlesCanvas.tsx         Canvas 2D renderer, worker-backed simulation
    TuringCanvas.tsx            Wrapper choosing WebGPU or WebGL2
    TuringWebGLCanvas.tsx       WebGL2 reaction-diffusion implementation
    TuringWebGPUCanvas.tsx      WebGPU reaction-diffusion implementation
    ThreeJSCanvas.tsx           Three.js 3D mesh, external time support
    TopographicCanvas.tsx       Canvas 2D topographic contours, external time support
    NeonDripCanvas.tsx          Canvas 2D metaball drip blobs, external time support
    CloudsCanvas.tsx            WebGL2 volumetric ray-marched clouds, external time support
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
- `three`
- `topographic`
- `neondrip`
- `clouds`

`GradientParams`

Universal fields (all renderers):

- `seed` — random seed / reseed trigger
- `speed` — animation speed
- `scale` — zoom / density
- `amplitude` — FBM amplitude or wander strength
- `frequency` — noise / cell frequency
- `definition` — octave count / detail level
- `blend` — color blend, contrast, or softness

3D Mesh specific:

- `morphSpeed` — terrain drift speed
- `morphAmount` — terrain drift height
- `focusDistance` — depth-of-field focus
- `aperture` — depth-of-field aperture
- `maxBlur` — depth-of-field max blur
- `dofEnabled` — depth-of-field toggle

Mode-specific:

- `topoLineWidth` — contour line width (Topographic only)
- `cloudType` — cloud formation 0–4 (Clouds only)

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
- injecting mode-specific default colors on mode switch (e.g. Noon palette when entering Clouds)
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
- `migratePersistedScene()` normalizes older payloads before use, filling missing fields from `DEFAULT_PARAMS`
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

`src/components/rendererMotion.ts` provides shared param smoothing:

- `cloneParams()`
- `stepSmoothedParams()`

This smoothing is used inside render loops so parameter edits feel continuous instead of snapping instantly.

## 9. Rendering Architecture

### Deterministic renderers (support loop-safe export)

`LiquidCanvas`, `WavesCanvas`, `VoronoiCanvas`, `BlobsCanvas`, `ThreeJSCanvas`, `CloudsCanvas`:

- render to fullscreen canvas elements
- support parameter smoothing via `rendererMotion`
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

Turing does not support `externalTime` or loop-safe export because it is simulation-driven.

### Clouds renderer

`CloudsCanvas` is a WebGL2 volumetric ray-marcher. Key design points:

**Shader:**
- Procedural gradient noise (no textures; 3D → float via vec3 hash + trilinear interpolation)
- `qualityOctaves(tier)` maps `uDefinition` (1–12) to an octave budget (1–5) and clamps each pass's FBM call to `min(tier, budget)` — definition slider scales quality without toggling passes on/off
- Four progressive raymarch passes (tiers 5→4→3→2 octaves), all always sampling; t advances alongside sampling so no cloud layer is skipped at low definition values
- Five cloud density functions via `uniform int uCloudType`: Cumulus, Stratus, Cirrus, Cumulonimbus, Mammatus — each modifies the density field shape (y-banding, amplitude, threshold, sine subtraction)
- Three-layer sun: wide haze (`pow(sun,4)`), corona (`pow(sun,22)`), sharp disk (`pow(sun,800)`)
- Low-intensity golden-ratio dither (`dot(coord, vec2(0.755, 0.570))`) for banding reduction without visible grain
- Raymarch start jitter `0.02 * dither` (small enough to avoid grain)

**Palette mapping (colors[0..3]):**
- `colors[0]` → `uSkyColor` (sky gradient, horizon fog)
- `colors[1]` → `uCloudTint` (lit cloud surface)
- `colors[2]` → `uSunColor` (scatter, corona, glare)
- `colors[3]` → `uShadowColor` (dark underside, shadowed faces)

**Camera / interaction:**
- Drag-to-orbit: `orbitRef` holds normalized (0–1) orbit angles, initialized to `(0.18, 0.40)`
- `mousedown` saves `dragStartClient` and `orbitAtDragStart`; `mousemove` computes client-pixel delta / display size and adds to `orbitAtDragStart` — angle never jumps on new drag start
- `mouseup` on `window` so releasing outside canvas still ends drag
- Orbit values passed to shader as canvas-pixel coords; shader normalizes with `/iResolution`

**Panel integration:**
- Cloud Type section: 5 buttons setting `params.cloudType`
- Sky Mood section: 4 preset buttons (Noon, Dusk, Dawn, Storm) each calling `setColors([...])` with a full 4-color palette
- Entering Clouds mode via `startModeTransition` auto-applies the Noon palette

## 10. UI Architecture

### Panel

`src/components/Panel.tsx` is the main workspace surface. It contains:

- workflow tools
- mode selection (10 modes with icons)
- palette editing
- motion and structure controls
- mode-specific sections (Topographic line width; Clouds type selector and sky mood presets)
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

The palette library ships with 67 palette descriptors from `src/data/palettes.ts`.

### Onboarding and dialogs

The app includes:

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
- loop-safe recording for deterministic renderers (liquid, waves, voronoi, blobs, three, clouds)
- progress state transitions through `preparing`, `recording`, `encoding`, and `complete`
- progress arc and frame counter UI in the panel

Loop-safe export works by mirroring time across the clip duration and assigning the result to `externalRenderTime`.

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
- topographic contour renderer
- neon drip metaball renderer
- volumetric cloud renderer with 5 cloud types, sky mood presets, and drag-to-orbit camera

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
