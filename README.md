# Color Motion Lab

Color Motion Lab is a browser-based generative art playground built with React, TypeScript, Vite, Canvas 2D, and WebGL. It combines curated palette exploration with multiple motion/rendering systems so users can build, save, export, and share animated color scenes.

## What It Does

- Explore six visual modes:
  - Fluid FBM
  - Interference Waves
  - Cellular Voronoi
  - Reaction-Diffusion
  - Particle Web
  - Molten Blobs
- Edit a shared parameter set in real time:
  - seed
  - speed
  - scale
  - amplitude
  - frequency
  - definition
  - blend
- Browse a curated palette library with:
  - search
  - category filters
  - favorites
  - recent palettes
  - surprise/random selection
- Save scenes locally and revisit them through:
  - preset search
  - mode filtering
  - sort controls
  - recent scenes
- Share and export scenes through:
  - shareable URLs with scene metadata
  - PNG export
  - higher-resolution PNG export
  - WebM recording
  - loop-safe WebM export for supported renderers

## Workflow Features

- Compact and advanced control density modes
- Undo and redo scene history
- Randomization for full scenes, palettes, parameters, and mode
- Workflow locks for mode, palette, seed, and motion
- In-app preset naming and toast feedback
- Export status/progress UI
- Fullscreen and hide-UI shortcuts

## Keyboard Shortcuts

- `Space`: pause/resume animation
- `H`: toggle panel visibility
- `F`: toggle fullscreen

Hotkeys are disabled while typing in editable inputs.

## Tech Stack

- React 18
- TypeScript
- Vite
- Framer Motion
- Phosphor Icons
- Canvas Confetti
- Canvas 2D, WebGL, and WebGL2 rendering

## Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Deploy to GitHub Pages:

```bash
npm run deploy
```

## Project Notes

- Scene state, presets, palette favorites, recent palettes, and recent scenes are stored in local storage.
- Some renderers support loop-safe export timing; simulation-heavy modes do not.
- The UI is designed around a floating control panel on desktop and a bottom-sheet panel on smaller screens.

## License

MIT
