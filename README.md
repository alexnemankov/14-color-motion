# Liquid Gradient & Generative Playground

A high-performance, interactive generative art engine built with React, TypeScript, and modern web technologies. Create, manipulate, and explore infinite fluid dynamics and mathematical geometries.


## Features

### The Palette Library
Our flagship feature for color exploration:
- **60+ Curated Presets**: From "Neon Sunset" to "Boreal Forest," explore professional-grade color schemes.
- **Categorization**: Filter by vibe (Neon, Nature, Dark, Pastel, Historical, Vibrant, Monochrome, Warm, Cool).
- **Intelligent Search**: Real-time filtering with a sleek, interactive "No Results" state.
- **Active Selection**: A persistent, smooth-transitioning bar showing your current workspace colors.
- **Surprise Me**: A one-click randomization feature with a playful particle burst (Confetti).
- **Favorites**: Save your most-loved palettes to local storage.

### Generative Modes
Explore six distinct mathematical and physical simulation models:
1. **Fluid FBM**: Classic distorted mesh noise for a "liquid" feel.
2. **Interference Waves**: Overlapping sine waves creating complex interference patterns.
3. **Cellular Voronoi**: Procedural cellular structures with smooth morphing.
4. **Reaction-Diffusion**: A Turing-pattern biological simulation (Gray-Scott model).
5. **Particle Web**: A 2D physics-based node network with interactive link distances.
6. **Spirograph**: Mathematical geometric curves (hypotrochoids) with dynamic complexity.

### Parametric Control Suite
Fine-tune every aspect of the simulation in real-time:
- **Seed**: Change the procedural origin for infinite variations.
- **Speed**: Adjust flow velocity or simulation frequency.
- **Scale**: Zoom in/out of the mathematical noise or geometry.
- **Amplitude**: Control the intensity of displacements and warping.
- **Frequency**: Change the density of waves or link link-strengths.
- **Definition**: Adjust complexity (octaves, sources, or link link-counts).
- **Blend**: A global contrast and diffusion control for organic or "hard-edge" looks.

### UX & Interaction
- **Framer Motion Integration**: Smooth, spring-based physics for all UI transitions.
- **Immersive Mode**: Fullscreen support and "Hide UI" (H) for distraction-free viewing.
- **Keyboard Shortcuts**:
  - `Space`: Pause/Resume animation.
  - `H`: Toggle UI visibility.
  - `F`: Toggle Fullscreen.

---

## Tech Stack

- **Core**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Phosphor Icons](https://phosphoricons.com/)
- **Generative**: [HTML5 Canvas 2D](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) & custom Fragment Shaders.
- **Feedback**: [Canvas Confetti](https://www.npmjs.com/package/canvas-confetti)

---

## Getting Started

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

---

## License
MIT License. Created with by the Liquid Gradient team.
