# Liquid Gradient - React

A customizable, interactive WebGL-based liquid gradient animation rewritten in React.

## Product Requirements Document (PRD)

### 1. Overview
The goal of this project is to rewrite a vanilla HTML/JS/WebGL liquid gradient animation into a modern, scalable React application using Vite and TypeScript.

### 2. Features
- **WebGL Animation rendering**: A smooth, mesmerizing liquid gradient animation using a custom fragment shader.
- **Customizable Parameters**:
  - Seed, Speed, Scale, Amplitude, Frequency, Definition, Bands.
- **Color Palette Management**:
  - Add, remove, and modify colors within the gradient.
- **UI Controls**:
  - A responsive floating panel to manage variables.
  - Controls to Pause/Play and enter Fullscreen.
  - Ability to hide/show the UI via a button or keyboard shortcuts (H for UI, F for fullscreen, Space for pause).

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
