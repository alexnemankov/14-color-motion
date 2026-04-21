# Color Motion Lab: Technical Description

This document describes the current implementation of Color Motion Lab as it exists in the repository today.

## 1. Product Overview

Color Motion Lab is a fullscreen generative motion app with a single active renderer at a time and a shared scene model across all modes. The root app coordinates renderer selection, parameter editing, persistence, sharing, onboarding, and export.

The shipped product currently includes:

- twelve rendering modes
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
    SeaCanvas.tsx               WebGL2 height-field ocean, external time support
    PrismCanvas.tsx             WebGL2 UV-displacement prism, external time support
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
- `sea`
- `prism`

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
- `godRays` — volumetric light shafts toggle (Clouds only)

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
- injecting mode-specific default colors on mode switch (Noon palette for Clouds; Midday palette for Sea)
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

`LiquidCanvas`, `WavesCanvas`, `VoronoiCanvas`, `BlobsCanvas`, `ThreeJSCanvas`, `CloudsCanvas`, `SeaCanvas`, `PrismCanvas`:

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
- God Rays toggle: screen-space radial blur toward the dominant light source (Crytek technique, 16 samples, luminance-threshold)
- Entering Clouds mode via `startModeTransition` auto-applies the Noon palette

### Sea renderer

`SeaCanvas` is a WebGL2 height-field ocean renderer. Key design points:

**Shader:**
- Procedural wave octaves via `sea_octave()`: noise-displaced sine waves, mixed with absolute cosine for sharp crests
- Two passes per octave (forward + backward wave travel) summed for standing-wave interference
- `ITER_GEOMETRY = 3` octaves in the fast `map()` function used during height-field tracing; `uIterDetail` (3–7, driven by `uDefinition`) in the detailed `map_detailed()` used for normals and shading
- Height-field tracing via bisection: 32 steps of regula-falsi (Illinois method) converging to `EPSILON = 1e-3`
- Shading: Fresnel blend between refracted deep water and sky reflection; specular highlight `pow(max(dot(reflect(eye,n),l), 0), 600)`; foam/shallow tint from `(p.y - uSeaHeight) * atten`
- Sky gradient: `mix(uSkyTop, uSunColor, t²)` from zenith to horizon
- Gamma correction: `pow(color, vec3(0.65))` applied in `main()`

**Palette mapping (colors[0..3]):**
- `colors[0]` → `uSeaBase` (deep water base color)
- `colors[1]` → `uWaterColor` (surface tint / foam highlights)
- `colors[2]` → `uSkyTop` (sky zenith color)
- `colors[3]` → `uSunColor` (horizon glow / sun scatter)

**GradientParams mapping:**
- `amplitude` → `uSeaHeight` (wave amplitude, 0.35–0.80)
- `blend` → `uSeaChoppy` (wave choppiness, 1–6)
- `frequency` → `uSeaFreq` (base wave frequency, 0.08–0.20)
- `speed` → `uSeaSpeed` (animation speed, 0.2–1.0)
- `definition` → `uIterDetail` (fragment octave count, 3–7)

**Camera / interaction:**
- The `fromEuler(ang)` convention used: `ang.z` controls horizontal heading (forward = `(sin(z), 0, cos(z))`), `ang.y` controls elevation (positive = tilt downward)
- Drag-to-orbit: `orbitRef` initialized to `(0.5, 0.5)`
- Mouse X → `heading = (m.x - 0.5) * 2.5` → `ang.z` — drag right turns camera right
- Mouse Y → `elevation = 0.3 - (m.y - 0.5) * 0.8` → `ang.y` — drag up shows more sky (default `0.3` = slight downward tilt toward ocean)
- Camera position flies forward continuously: `ori.z = seaTime * 5.0`

**Panel integration:**
- Sea Mood section: 4 preset buttons (Midday, Sunset, Tropic, Storm) each calling `setColors([...])` with a full 4-color palette
- Entering Sea mode via `startModeTransition` auto-applies the Midday palette

### Volumetric renderer performance architecture

Both `CloudsCanvas` and `SeaCanvas` share the same four-pass architecture applied to all new WebGL2 volumetric renderers. Each optimisation is independent and additive.

---

#### 1. AABB slab intersection (cloud layer early-out)

**What:** Before entering the march loop, the ray is tested against the horizontal cloud slab `y ∈ [-3, 2]` using a ray-slab intersection. The march start `t` is advanced to `tNear` immediately, skipping all empty air below the slab.

```glsl
float tMin = (2.0 - ro.y) / rd.y;
float tMax = (-3.0 - ro.y) / rd.y;
float tNear = max(0.0, min(tMin, tMax));
t = max(t, tNear);
```

A horizontal-ray epsilon guard (`abs(rd.y) < 1e-4`) prevents divide-by-zero when the camera looks perfectly sideways.

**Why:** Downward-facing rays from above the slab waste all their early steps marching through guaranteed empty air. Skipping to `tNear` eliminates those wasted evaluations for free — no shader quality change, no extra pass, pure math.

**Cost:** Two divisions, two min/max calls per ray. Essentially zero.

**Impact:** ~1.5× speedup on rays that enter the slab at a steep angle, which covers most non-horizon viewing angles.

---

#### 2. Hoisted drift uniform

**What:** Cloud drift (`animTime * driftSpeed * vec3(0, 0.1, 1.0)`) is computed once per frame in JavaScript and uploaded as `uniform vec3 uCloudDrift`. Inside `mapN()`, the drift is subtracted with a single `vec3 q = p - uCloudDrift` before entering the FBM loop.

**Why:** Without hoisting, the same `animTime * speed * vec3(...)` multiplication executes inside every FBM octave of every sample of every march step — hundreds of thousands of times per frame. Moving it to the CPU costs one multiplication per frame instead.

**Cost:** One `gl.uniform3f` call per frame.

**Impact:** Free on the GPU. Removes vector math from the innermost loop.

---

#### 3. Half-resolution render + bilinear upscale

**What:** The entire raymarch/trace pass renders into a Framebuffer Object (`marchFbo`) at `canvas.width/2 × canvas.height/2`. A minimal blit shader upscales the result to full canvas resolution using `LINEAR`-filtered texture sampling.

**Why:** Fragment shader cost scales with pixel count. Halving each dimension reduces invocations by 4×. Volumetric effects are intrinsically soft — bilinear blur from the upscale is indistinguishable from full-res at normal viewing distance.

**Cost:** One extra FBO, one blit draw call. FBO allocation happens at init and on resize.

**Impact:** ~4× fewer fragment shader invocations. The single largest performance gain.

---

#### 4. Temporal accumulation (ping-pong FBO)

**What:** A second pair of framebuffers (`accumFbo[0/1]`) blends the current frame output with the previous accumulated result. The blend factor (`uAlpha`) adapts to interaction state:

| State | Clouds `uAlpha` | Sea `uAlpha` | Effect |
|-------|-----------------|--------------|--------|
| First frame / resize | `1.0` | `1.0` | Full reset — no history bleed |
| Camera dragging | `0.7` | `0.9` | Fast ghost clear during motion |
| Idle | `0.2` | `0.5` | History smoothing |

Sea uses a higher idle alpha (`0.5`) than clouds (`0.2`) because wave surfaces move rapidly each frame — heavier history blending would blur moving crests.

The three-pass pipeline is: march/trace → accumulate → blit.

**Why:** Per-frame noise averages out over accumulated frames without adding shader complexity.

**Cost:** Two additional FBOs (accumulate pair), one extra draw call per frame for the accumulate pass.

**Impact:** ~2–3× perceived quality improvement at fixed GPU budget.

---

#### Combined speedup budget

| Optimisation | GPU cost | Speedup |
|---|---|---|
| AABB slab early-out | ~0 (pure math) | ~1.5× |
| Hoisted drift uniform | ~0 (1 CPU mul) | free |
| Half-res + upscale | 1 FBO + 1 blit | ~4× |
| Temporal accumulation | 2 FBOs + 1 blit | ~2–3× perceived |

Applied together: the renderer runs roughly **6–8× cheaper** than a naïve full-res single-pass implementation at equivalent visual quality.

---

#### Boilerplate pattern for new volumetric projects

When starting a new WebGL2 volumetric renderer, apply these four in order — each is independent and additive:

1. **Always add an AABB or SDF early-out** before the march loop. Identify your volume's bounding geometry, compute the ray-slab (or ray-sphere) intersection, and advance `t` to the near hit. Cost is zero.

2. **Hoist all per-frame constants to uniforms.** Anything that doesn't change per-sample (time, direction vectors, palette colors) should be computed in JS and uploaded as uniforms. Never compute `animTime * speed * direction` inside FBM loops.

3. **Render at half resolution into an FBO and blit.** Do this first, before adding octaves or quality. Volumetric effects are soft enough that users won't notice on typical screens, and it buys back 4× fragment budget.

4. **Add temporal accumulation as the final pass.** A ping-pong FBO pair with an 80/20 history blend is ~30 lines of code and delivers 2–3× perceived quality for free. Use adaptive alpha: `1.0` on reset, a higher value during fast motion (drag), and a lower value when idle. Tune the idle alpha to the scene's motion rate — slower-moving visuals tolerate heavier history blending.

### Prism renderer

`PrismCanvas` is a WebGL2 UV-displacement prism effect. Key design points:

**Shader:**
- Loops 3 times (one pass per RGB channel), each pass computing UV displacement from a radial field
- Per-pass z-offset controlled by `uDefinition` (0–1 → `zStep` 0.01–0.55) — low values produce near-monochrome output; high values produce heavy chromatic separation across channels
- Displacement: `uv += p/l * (sin(z)+1) * abs(sin(l*uFrequency - z*2)) * uAmplitude`
- Each raw channel tinted by palette color: `col = (c[0]*uColor0 + c[1]*uColor1 + c[2]*uColor2) / l`
- `uBlend` desaturates toward luminance at low values (controls color purity)
- `uColor3` tints dark ambient regions
- Reinhard tone map + gamma correction

**Palette mapping (colors[0..3]):**
- `colors[0]` → first channel tint (maps to the R displacement pass)
- `colors[1]` → second channel tint (maps to the G displacement pass)
- `colors[2]` → third channel tint (maps to the B displacement pass)
- `colors[3]` → ambient/shadow tint for dark regions

**GradientParams mapping:**
- `speed` → animation speed (time multiplier)
- `scale` → UV scale (zoom / tiling density)
- `amplitude` → warp displacement strength
- `frequency` → ripple frequency (×9)
- `definition` → chromatic spread (z-step between channel passes, 0.01–0.55)
- `blend` → color saturation / desaturation toward luminance
- `seed` → initial phase offset (`z = time + seed * 0.1`)

**Panel integration:**
- Prism Mood section: 4 preset buttons (Spectral, Neon, Plasma, Void) each calling `setColors([...])` with a full 4-color palette
- Entering Prism mode via `startModeTransition` auto-applies the Spectral palette

## 10. UI Architecture

### Panel

`src/components/Panel.tsx` is the main workspace surface. It contains:

- workflow tools
- mode selection via a compact trigger button (same style as the Palette Library button) that opens a modal with a 3-column card grid of all 12 modes (icon + name + description per card)
- palette editing
- motion and structure controls
- mode-specific sections:
  - Topographic: line width slider
  - Clouds: cloud type selector (5 formations) and Sky Mood presets (Noon, Dusk, Dawn, Storm)
  - Sea: Sea Mood presets (Midday, Sunset, Tropic, Storm)
  - Prism: Prism Mood presets (Spectral, Neon, Plasma, Void)
- workspace actions
- export controls
- reset actions
- saved preset browsing
- recent scene browsing
- transport controls

The mode switcher is a single trigger button (identical style to the Palette Library button) that displays the current mode's name and description. Clicking it opens a portal modal with a 3-column card grid of all 12 modes. Each card shows an icon, short name, and one-line description. The active mode is highlighted with the accent color. Clicking a card selects the mode and closes the modal; clicking the overlay or the × button dismisses it without a selection change.

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
- loop-safe recording for deterministic renderers (liquid, waves, voronoi, blobs, three, clouds, sea, prism)
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
- volumetric cloud renderer with 5 cloud types, sky mood presets, god rays, and drag-to-orbit camera
- WebGL2 height-field sea renderer with sea mood presets and drag-to-orbit camera
- WebGL2 UV-displacement prism renderer with chromatic channel separation and prism mood presets
- modal-based mode switcher (trigger button + 3-column card grid) for all 12 modes

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
