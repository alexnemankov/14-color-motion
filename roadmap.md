# Product Roadmap

This roadmap is designed to move the app from a strong generative-art playground into a more complete creative product.

The roadmap is organized around three product goals:

1. Make the app easier to understand.
2. Make outputs easier to keep and share.
3. Make repeated use feel rewarding.

## Vision

The product should become a visual creation tool for procedural color motion, not just a shader demo.

That means:

- Lowering first-use friction
- Improving the experimentation workflow
- Strengthening export and sharing
- Making the product usable across desktop and mobile
- Creating reasons for users to come back

## Current State

The roadmap is no longer greenfield. The app already includes:

- Scene save, load, delete, session restore, share-link generation, and PNG export
- In-app toast feedback for workflow actions
- In-app preset naming dialog instead of browser `prompt()`
- Reset actions for mode, palette, and full scene
- Reorganized panel sections with mode-specific descriptions
- Responsive panel/mobile modal improvements
- Keyboard and accessibility fixes, including safer hotkey handling
- Graceful renderer status/fallback messaging
- Compact and advanced control modes
- Scene history with undo and redo
- Scene randomization with workflow locks for mode, palette, seed, and motion
- Palette library search, category filters, favorites, recent palettes, and surprise selection
- Saved preset preview strips, mode badges, compact saved dates, search, sorting, and mode filtering
- Recent scenes shelf for quick returns to recently used looks
- Broader product identity in the UI under the `Color Motion Lab` label
- Animated palette interpolation between scene changes
- Higher-resolution PNG export alongside baseline still export
- WebM loop export for short 5s and 10s clips
- Share links with scene names/metadata
- Shared scene/source presentation directly in the panel UI
- Export presets grouped under a dedicated workspace dropdown
- Loop-safe WebM export for supported renderers
- Export status/progress UI for still and video output
- Pointer interaction started in particle mode

What remains is to deepen the workflow, improve content browsing, and expand output and interaction features.

## Phase 1: Product Foundation

Goal: reduce friction and make the current experience feel complete.

Status: complete

### Priorities

- Completed:
  - Improve control clarity with stronger grouping and section hierarchy
  - Add mode-specific helper text so controls are easier to understand
  - Replace browser-style alerts with in-app feedback states
  - Replace remaining browser-default preset naming with in-app UI
  - Improve save/export empty states and confirmation messaging
  - Strengthen mobile behavior and general accessibility baseline
- Remaining:
  - Continue mobile polish where the panel is still dense on smaller screens

### Features

- Completed:
  - Reorganize panel into clearer sections
  - Add short explanatory text for mode-specific controls
  - Add in-app toast notifications
  - Add in-app preset naming dialog
  - Add reset actions for current mode, palette, and full scene
  - Improve mobile control layout
  - Complete keyboard and focus-state polish baseline
  - Improve saved/export empty-state copy
- Remaining:
  - Refine mobile panel hierarchy further if needed

### Outcome

The app feels less like a raw experiment and more like a usable creative tool.

## Phase 2: Creative Workflow

Goal: make experimentation faster, safer, and more satisfying.

Status: in progress

### Priorities

- Completed:
  - Reduce panel overload for new users
  - Make visual exploration reversible
  - Improve controlled randomness
- Remaining:
  - Add side-by-side or slot-based comparison for active scenes
  - Make preset creation and exploration feel less disposable

### Features

- Completed:
  - Add compact and advanced control modes
  - Add undo/redo with scene history
  - Add randomization tools for palette, parameters, mode, and whole scene
  - Add lock controls for palette, mode, seed, and motion parameters
- Remaining:
  - Add A/B compare workflow
  - Improve saved-result browsing so good scenes are easier to revisit from the workflow itself

### Outcome

Users can explore aggressively without losing good results.

## Phase 3: Library and Identity

Goal: strengthen content systems and give the product a clearer identity.

Status: complete

### Priorities

- Completed:
  - Make palette exploration feel more intentional at the library level
  - Make saved content easier to browse at a basic level
  - Extend saved content browsing beyond the original compact list
  - Extend palette browsing beyond a flat grid
  - Clarify what the product is beyond "liquid gradient"
- Remaining:
  - Continue optional branding refinement if the product name or voice changes further

### Features

- Completed:
  - Add palette search
  - Add palette category browsing
  - Add palette favorites
  - Add recent palette browsing
  - Add surprise/random palette selection
  - Improve saved preset library with:
    - preview thumbnails
    - mode badges
    - dates
    - sorting
    - filtering
    - search
  - Add recent scenes
  - Revisit product naming and top-level branding in the shipped UI
- Remaining:
  - Consider deeper palette grouping or editorial collections if the library grows

### Outcome

The app gains stronger personality and supports repeat usage better.

## Phase 4: Shareability and Output

Goal: turn scenes into reusable artifacts.

Status: mostly complete

### Priorities

- Completed:
  - Establish baseline still export and share-link generation
  - Improve the quality of palette transitions
  - Make export more useful beyond a single PNG snapshot
  - Make shared scenes feel more like named creations
- Remaining:
  - Broaden output formats and polish the export surface further

### Features

- Completed:
  - Add baseline PNG export
  - Add higher-resolution still export
  - Add shareable scene URLs
  - Add animated palette interpolation
  - Add short loop recording
  - Add WebM export
  - Improve scene sharing with named states or shared preset metadata
  - Add export presets instead of raw output buttons
  - Add recording options inside the export dropdown
  - Add loop-safe export for supported renderers
  - Add export status and progress UI
- Remaining:
  - Consider GIF export
  - Add more export presets or recording controls

### Outcome

The product becomes useful outside the current browser session.

## Phase 5: Interactivity and Depth

Goal: deepen the experience for advanced users.

Status: started

### Priorities

- Completed:
  - Start making visuals respond directly to user input
- Remaining:
  - Expand direct manipulation beyond the current interactive renderers
- Support long-form ambient or presentation use
- Improve compatibility across devices

### Features

- Completed:
  - Add pointer interaction in particle mode
- Remaining:
  - Add pointer/touch interaction by mode:
    - blobs deform around touch
    - turing injects pigment on click
    - waves distort from pointer
    - more deliberate touch behavior for mobile
- Add presentation mode:
  - auto-hide UI
  - cycle saved presets
  - timed transitions
- Add performance modes:
  - quality
  - balanced
  - performance

### Outcome

The app becomes suitable for ambient visuals, display use, and deeper creative sessions.

## Recommended Milestones

### Milestone 1: Usable Tool

Focus:

- Delivered:
  - Control clarity
  - Toast notifications
  - Reset actions
  - Mobile UX improvements
  - Accessibility polish baseline

### Milestone 2: Creative Workflow

Focus:

- Delivered:
  - Compact vs advanced controls
  - Undo/history
  - Randomization with locks
- Remaining:
  - A/B compare
  - Richer saved preset browsing controls

### Milestone 3: Shareable Product

Focus:

- Animated transitions
- Higher-resolution export
- Loop/video export
- Better scene sharing

### Milestone 4: Signature Experience

Focus:

- Presentation mode
- Pointer interaction
- Performance presets
- Product identity refinement

## Suggested Build Order

Recommended next order from the current state:

1. Add A/B compare workflow
2. Add saved preset sorting, filtering, or search
3. Add richer palette library grouping and browse flows
4. Consider GIF export or richer recording presets
5. Refine shared-scene presentation in the UI where it adds value
6. Add presentation mode
7. Add pointer/touch interactivity

## Success Criteria

The roadmap is working if:

- New users understand the product within the first minute
- Users can recover from experimentation without frustration
- Saved scenes become a meaningful part of the workflow
- Exported content is good enough to share externally
- The app feels intentional on both desktop and mobile
