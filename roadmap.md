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
- Reset actions for mode, palette, and full scene
- Reorganized panel sections with mode-specific descriptions
- Responsive panel/mobile modal improvements
- Keyboard and accessibility fixes, including safer hotkey handling
- Graceful renderer status/fallback messaging
- Compact and advanced control modes
- Scene history with undo and redo
- Scene randomization with workflow locks for mode, palette, seed, and motion
- Palette library search, category filters, favorites, recent palettes, and surprise selection
- Saved preset preview strips, mode badges, and compact saved dates
- Animated palette interpolation between scene changes
- Higher-resolution PNG export alongside baseline still export
- WebM loop export for short 5s and 10s clips
- Share links with scene names/metadata
- Shared scene/source presentation directly in the panel UI

What remains is to deepen the workflow, improve content browsing, and expand output and interaction features.

## Phase 1: Product Foundation

Goal: reduce friction and make the current experience feel complete.

Status: mostly complete

### Priorities

- Completed:
  - Improve control clarity with stronger grouping and section hierarchy
  - Add mode-specific helper text so controls are easier to understand
  - Replace browser-style alerts with in-app feedback states
  - Strengthen mobile behavior and general accessibility baseline
- Remaining:
  - Improve empty states and confirmation states for save/share/export
  - Replace remaining browser-default interactions such as preset naming `prompt()`
  - Continue mobile polish where the panel is still dense on smaller screens

### Features

- Completed:
  - Reorganize panel into clearer sections
  - Add short explanatory text for mode-specific controls
  - Add in-app toast notifications
  - Add reset actions for current mode, palette, and full scene
  - Improve mobile control layout
  - Complete keyboard and focus-state polish baseline
- Remaining:
  - Improve empty states and success messaging in saved/export flows
  - Replace `prompt()`-based preset naming with inline or modal UI
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

Status: partially started

### Priorities

- Completed:
  - Make palette exploration feel more intentional at the library level
  - Make saved content easier to browse at a basic level
- Remaining:
  - Extend saved content browsing beyond the current compact list
  - Extend palette browsing beyond the current filters, favorites, and recents
  - Clarify what the product is beyond "liquid gradient"

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
- Remaining:
  - Improve saved preset library with:
    - sorting
    - filtering
    - search
  - Expand palette browsing with:
    - richer light/dark/vibrant browsing flows
    - better library sorting or grouping
  - Add recent scenes
  - Revisit product naming and top-level branding

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
- Remaining:
  - Consider GIF export
  - Add more export presets or recording controls

### Outcome

The product becomes useful outside the current browser session.

## Phase 5: Interactivity and Depth

Goal: deepen the experience for advanced users.

Status: not started

### Priorities

- Make visuals respond directly to user input
- Support long-form ambient or presentation use
- Improve compatibility across devices

### Features

- Add pointer/touch interaction by mode:
  - particles repel/follow cursor
  - blobs deform around touch
  - turing injects pigment on click
  - waves distort from pointer
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

1. Replace preset naming `prompt()` with proper UI
2. Add A/B compare workflow
3. Add saved preset sorting, filtering, or search
4. Add richer palette library grouping and browse flows
5. Consider GIF export or richer recording presets
6. Refine shared-scene presentation in the UI
7. Add presentation mode
8. Add pointer/touch interactivity

## Success Criteria

The roadmap is working if:

- New users understand the product within the first minute
- Users can recover from experimentation without frustration
- Saved scenes become a meaningful part of the workflow
- Exported content is good enough to share externally
- The app feels intentional on both desktop and mobile
