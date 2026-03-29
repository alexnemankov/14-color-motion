# Color Motion: Technical Documentation

This document provides a comprehensive technical overview of the "Color Motion" generative art project, designed to serve as a guide for either recreating or independently understanding the codebase.

## 1. Project Architecture & Tech Stack

The project is built as a single-page frontend application utilizing modern web standards and minimal dependencies.

**Core Technologies:**
*   **Framework:** React 18
*   **Language:** TypeScript
*   **Build Tool:** Vite
*   **Rendering:** Native HTML `<canvas>` API (vanilla 2D context)
*   **Styling:** Pure CSS (CSS Variables) with zero styling frameworks
*   **Icons:** `@phosphor-icons/react` and `lucide-react`
*   **Animations:** `framer-motion` (for modal transitions)
*   **Deployment:** GitHub Pages (via `gh-pages`)

## 2. Directory Structure

```text
/src
├── index.css                // Global styles, theme variables, and UI component styling
├── App.tsx                  // Root component, global state manager, and layout wrapper
├── main.tsx                 // React DOM entry point
├── components/              // All UI and Rendering components
│   ├── LiquidCanvas.tsx     // Generative Art Module: Organic liquid noise
│   ├── WavesCanvas.tsx      // Generative Art Module: Sine wave interference
│   ├── VoronoiCanvas.tsx    // Generative Art Module: Cell growth logic
│   ├── TuringCanvas.tsx     // Generative Art Module: Reaction-diffusion patterns
│   ├── ParticlesCanvas.tsx  // Generative Art Module: Physics-based particles
│   ├── GeometryCanvas.tsx   // Generative Art Module: Mathematics and shapes
│   ├── Panel.tsx            // The floating UI control panel (sliders/buttons)
│   └── PaletteModal.tsx     // The fullscreen palette library modal
└── data/
    └── palettes.ts          // Curated list of 60+ pre-defined gradient palettes
```

## 3. Core State Management

State is managed via React Context/Props originating at the root `<App />` level. The primary state pieces are passed simultaneously to both the active "Canvas" module (which renders them) and the "Panel" module (which mutates them).

### Key State Objects (`App.tsx`):
1.  **`params: GradientParams`**: The mathematical coefficients driving the art generation.
    *   *Includes:* `seed` (math random offset), `speed` (time delta multiplier), `scale` (zoom factor), `amplitude` (intensity), `frequency` (density), `definition` (sharpness), `blend` (color mixing ratio).
2.  **`colors: ColorRgb[]`**: An array of `[R, G, B]` arrays defining the current generative palette to mix between.
3.  **`animationType: AnimationType`**: String enum controlling which specific internal Canvas component mounts (e.g., `'liquid'`, `'waves'`).
4.  **UI State**: `uiVisible` (hidden UI "zen" mode), `paused` (animation loop pause), `fullscreen` (browser fullscreen API).

## 4. UI/UX Design System (`index.css`)

The interface follows a strict "Dark Minimalist Editorial" design philosophy designed to fade into the background while remaining highly functional.

*   **Typography:**
    *   Display/Headers: `Space Grotesk` (geometric, architectural vibe)
    *   Labels/Data: `JetBrains Mono` (technical, monospaced readability)
*   **Color Theme System:**
    *   Backgrounds: Deep blacks (`#000000`, `#0C0C0C`, `#111111`)
    *   Text: Bright whites (`#FFFFFF`, `rgba(255,255,255,0.6)`)
    *   Accent: High-contrast orange (`#f2622f`), globally applied to active states, sliders, and primary buttons.
*   **Key CSS Techniques:**
    *   CSS Variables are heavily relied upon at the `:root` level for theme adherence.
    *   Glassmorphism has been explicitly rejected in favor of solid matte backgrounds with sharp flat borders (`border: 1px solid var(--panel-border)`).
    *   Custom `input[type="range"]` styling creates the signature "technical tracking" look (e.g., repeating `|` characters in an absolute `::before` pseudo-element underlying a custom 2px thumb).

## 5. Rendering Implementations

All visual generation occurs inside the `components/*Canvas.tsx` files. 

### Common Canvas Lifecycle:
1.  **Mounting:** A generic HTML `<canvas>` element spans the entire browser viewport (fixed `top: 0`, `left: 0`, `z-index: -1`).
2.  **Initialization:** A `ref` attaches the context (`ctx.getContext('2d')`).
3.  **Animation Loop:** An internal `requestAnimationFrame` (RAF) loop constantly cycles. A `time` variable increments on each frame, multiplied by `props.params.speed`.
4.  **Generative Logic:** Within the RAF loop, specific logic executes.
    *   *(e.g., For `LiquidCanvas`, mathematical noise functions (like Simplex/Perlin, usually implemented as sin/cos maps) calculate pixel offsets, looping over the available `props.colors` based on the X/Y coordinates and time.)*
5.  **Resize Handling:** A `ResizeObserver` or `window.addEventListener('resize')` ensures the canvas resolution continuously scales to the client's screen size without stretching.

## 6. Setup & Build Instructions

To recreate or run the environment, standard Node/Vite procedures apply:

1.  **Installation**: Run `npm install` (resolving React, Vite, Framer Motion, and Phosphor Icons).
2.  **Running Locally**: Run `npm run dev`. The Vite server will launch instantaneously at `http://localhost:5173`.
3.  **Building for Production**: 
    *   `npm run build` runs TypeScript validation `tsc` followed by `vite build` to package the optimized static site into `/dist`.
4.  **Deployment**: 
    *   `npm run deploy` pushes the `/dist` output automatically to the project's active GitHub Pages branch.
