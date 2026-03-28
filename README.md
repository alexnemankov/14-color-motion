# Liquid Gradient - React

A customizable, interactive WebGL-based liquid gradient animation rewritten in React.

## Product Requirements Document (PRD)

Liquid Gradient is a high-performance, interactive WebGL-based animation that allows users to create and manipulate a fluid, chromatographic color space.

### 1. Features
- **WebGL Animation Engine**: A custom fragment shader pipeline that renders mesmerizing, Distorted Mesh fluid dynamics at 60fps.
- **Parametric Control Suite**:
  - **Seed**: Change the procedural noise origin for infinite variations.
  - **Speed**: Adjust the flow velocity of the liquid.
  - **Scale**: Zoom in or out of the noise pattern.
  - **Amplitude**: Control the intensity of the "liquify" warping.
  - **Frequency**: Change the density of the fluid waves.
  - **Definition**: Adjust the complexity and layering (FBM) of the movement.
  - **Blend**: A dynamic edge-control slider. Set to 1.0 for smooth organic diffusion; set to 0.0 for sharp, high-contrast hard edges ("posterized" look).
- **Color Palette Management**:
  - Live color picking with real-time feedback.
  - Support for up to 8 colors.
  - Intelligent UI that prevents dropping below the 2-color threshold.
- **Interaction & Workflow**:
  - **Floating UI Panel**: Quick access to all parameters.
  - **Play/Pause**: Freeze the motion at any frame.
  - **Fullscreen (F)**: Enter immersive mode.
  - **Hide UI (H)**: Clear the workspace for a distraction-free view.
  - **Space**: Toggle animation state.

### 3. Tech Stack
- React (Hooks for state management)
- TypeScript (Strict typing for parameters and props)
- Vite (Fast development and build)
- WebGL (Pure Canvas/WebGL overlay, no external 3D libraries needed)
- Vanilla CSS (for sleek, custom UI)

### 4. Architecture for Future Scaling
- **State Management**: As features grow, move param state from generic React Context or `useState` to a library like Zustand.
- **Shader Abstraction**: The WebGL logic can be refactored into a custom hook (`useWebGL`) or a modular shader pipeline, allowing multiple different shaders (e.g. noise-based, fluid sim) to be swapped in seamlessly.
- **Presets & Export**: 
  - Save parameter sets as JSON for presets.
  - Implement a canvas recording feature to export as MP4/GIF.
- **Theming**: The UI variables are CSS properties and can be easily toggled for light/dark themes.

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
