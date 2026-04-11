# CloudsCanvas.tsx Improvements

Based on an analysis of the current `CloudsCanvas.tsx` implementation, here are several avenues for improving performance and visual quality. The volumetric raymarching is quite heavy because it evaluates 3D gradient noise up to 140 times per pixel in the most detailed areas.

## 1. Cloud Slab Early-Out (AABB Intersection)
**Impact:** ~1.5x faster | **Effort:** Trivial
**Current state:** The raymarch loop starts at the camera and steps forward blindly, checking `if (pos.y < -3.0 || pos.y > 2.0)` each step to break early.
**Implementation:** Ray vs y-band AABB test. Compute the intersection distance of the camera ray `rd` with the horizontal slab defined by `y = -3.0` and `y = 2.0`. Advance the starting distance `t` immediately to the near intersection point so the shader skips the empty air.
```glsl
// In raymarch() before the loop:
float tMin = (2.0 - ro.y) / rd.y;
float tMax = (-3.0 - ro.y) / rd.y;
float tNear = max(0.0, min(tMin, tMax));
t = max(t, tNear); // skip empty space to the slab
```

## 2. Hoist Drift to Uniform
**Impact:** Free performance | **Effort:** Trivial
**Current state:** `cloudOffset()` is calculated inside `mapN()` which is called repeatedly per ray step: `return vec3(0.0, 0.1, 1.0) * iTime * uSpeed;`.
**Implementation:** Compute `cloudDrift()` once in JS. Calculate this vector once in JavaScript per frame and pass it as a new uniform `uniform vec3 uCloudDrift;`. This removes redundant vector math from the innermost FBM loop.

## 3. Half-res + Upscale
**Impact:** ~4x faster | **Effort:** Easy
**Current state:** The raymarching runs natively at the rendered pixel resolution, which is expensive on retina screens.
**Implementation:** FBO + bilinear blit shader. Render the raymarching pass at 50% resolution (e.g., `canvas.width / 2`, `canvas.height / 2`) into a Framebuffer Object (FBO) backed by a texture. Pass that texture to a very simple fullscreen blit shader that draws to the canvas with bilinear filtering. Clouds are intrinsically soft, so the resolution drop is often unnoticeable.

## 4. Empty-Space Skipping (Adaptive Step Size)
**Impact:** ~1.5x faster | **Effort:** Medium
**Current state:** The raymarch step size `t` increases quite linearly `t += max(0.06, 0.05 * t)`. It does not adapt to the density of the clouds along the ray.
**Implementation:** Adaptive dt in march loop. Use a cheaper, lower-octave noise function to test density. If density is zero (clear air), increase the step size significantly. Only take fine steps when entering the boundary of a cloud.

## 5. Temporal Accumulation
**Impact:** ~2-3x faster | **Effort:** Medium
**Current state:** The whole screen is rendered from scratch every frame.
**Implementation:** Ping-pong FBO setup. Combine 80% of the previous frame with 20% of the newly rendered frame. This smooths out noise, meaning you can severely reduce the number of raymarching steps or add heavy jitter, while the temporal accumulation will blend out the grain over a few frames.

## 6. Checkerboard Render
**Impact:** ~2x faster | **Effort:** Medium
**Current state:** All pixels inside the viewport execute the heavy fragment shader.
**Implementation:** Alternate pixels each frame. Using `gl_FragCoord`, discard rendering on even pixels for frame N, and odd pixels for frame N+1. Reconstruct the missing pixels by blending with the previous frame's result.

## 7. WebGPU Compute Shader
**Impact:** ~3-5x faster | **Effort:** Hard
**Current state:** The logic is fully contained in a WebGL2 fragment shader.
**Implementation:** Port the march loop to a compute pipeline. Compute shaders can share noise evaluations in local workgroups (Shared Memory) and bypass rasterizer overhead.

# Next Feature Additions

In addition to the performance optimizations above, the following features can be added across four main categories to enhance the visual richness, interactivity, and export/quality options.

## 8. Visual / Atmosphere
* **Sun Position & Day-Night Arc:** Currently `sundir` is hardcoded. Turn it into a uniform (`uSunPos`) driven by a time-of-day parameter to smoothly animate the sunlight across the sky.
* **Procedural Stars + Moon at Night:** Add a high-frequency hash function (e.g., `fract(sin(dot(uv, ...)))`) triggered when `sundir.y` dips below zero to render stars, alongside a procedural glowing moon circle.
* **God Rays (Volumetric Light Shafts):** Introduce radial blur emanating from the sun's position in screen space, masked by the cloud alpha, to simulate light scattering.
* **Rain Streaks & Lightning Flashes:** Rain can be implemented as a fast-panning screen-space directional noise. Lightning is a sudden intensity spike to `uSunColor` coupled with a repositioned light source.
* **Ground Fog:** Render a secondary low-altitude volume layer (e.g., `y < -2.0`). Because fog is generally featureless, it can use a much cheaper noise evaluation and ray-plane intersector.

## 9. Animation / Time
* **Time-of-day Slider:** Map a single 0–24h cycle slider to interpolate smoothly across distinct color palettes (sky, cloud, sun, shadow).
* **Auto Mood Interpolation:** When switching presets, `lerp` the `colors` arrays and `params` inside `requestAnimationFrame` over a defined duration instead of cutting instantly.
* **Wind Direction Vector (`uWindDir`):** Replace the scalar float `uSpeed` with a `vec2` uniform, allowing clouds to travel dynamically along both X and Z axes.
* **Weather Cycle Automation:** Introduce a slow, 1D Perlin noise generator in JS that automatically drifts values like `coverage` and `amplitude` over minutes, simulating realistically changing weather.
* **Animate Cloud Type Transitions:** Instead of using discrete integer jumps for `uCloudType`, refactor the density equations to continuously blend using a float parameter, letting stratus morph into cumulus organically.

## 10. Interaction
* **Touch & Pinch Gesture Orbit:** Supplement the existing mouse listeners with `touchstart` / `touchmove`. Use the distance between two simultaneous touch points to drive FOV or camera zoom.
* **Mobile Gyroscope Camera Look:** Hook into the `DeviceOrientation` API, mapping `alpha`, `beta`, and `gamma` to `orbitRef`, turning the user's phone into a direct viewing window.
* **Keyboard Preset Shortcuts (1-5):** Bind standard numeric keys to instantly trigger different atmospheric presets.
* **Double-tap to Reset Orbit:** Listen for `dblclick` on the canvas to revert the orbital camera parameters back to default (`{x: 0.18, y: 0.40}`).
* **Pointer-driven Cloud Distortion:** Unproject the canvas pointer to a 3D ray. Pass a `uMouseWorld` uniform and push cloud density away within `mapN()` to let users physically "part" the clouds.

## 11. Quality / Export
* **Blue Noise Dither (Less Temporal Flicker):** Replace the `fract(dot(...))` white noise with a pre-computed 2D Blue Noise texture lookup. This maintains banding-prevention while dramatically reducing perceptive grain.
* **High-Res Still at Max Octaves:** Register a callback method on `RendererHandle` that renders a single frame synchronously with `canvas.width` scaling multiplied and max `uDefinition`, then exports a `dataURL`.
* **Animated GIF Loop via Loop-Safe Export:** To loop gracefully, modify the FBM offset calculation to incorporate 4D domain warping so the noise wraps mathematically over a specific period.
* **FPS & Step Counter Debug Overlay:** Mount a small React DOM overlay querying timestamps (`dt`) to show performance, and optionally render a heatmap of raymarch step-counts to visualize bottlenecks.
* **Mip-Mapped Noise Texture Option:** Instead of computing procedural noise step-by-step mathematically, precalculate a 3D noise texture and bind it as a `sampler3D`. Hardware trilinear filtering and mipmapping vastly cuts down compute cycles.
