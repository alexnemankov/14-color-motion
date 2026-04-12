# CloudsCanvas.tsx Improvements

Based on an analysis of the current `CloudsCanvas.tsx` implementation, here are several avenues for improving performance and visual quality. The volumetric raymarching is quite heavy because it evaluates 3D gradient noise up to 140 times per pixel in the most detailed areas.

## Execution Priority Plan

### 1. The "Free" Wins ✅ DONE

- ✅ **Hoist the Drift Math:** `uCloudDrift` uniform computed once in JS per frame; no per-step vector math inside the FBM loop.
- ✅ **AABB Early-Out:** Ray-slab intersection (`y ∈ [-3, 2]`) computed before the march loop; `t` starts at `tMin` skipping all empty air.

### 2. The High-Impact structural changes ✅ DONE

- ✅ **Half-res + Upscale:** Raymarch renders to a half-res FBO (`marchFbo`); bilinear blit shader upscales to full canvas (~4x speedup).
- ✅ **Blue Noise Dithering:** 64×64 IGN texture (`createBlueNoiseTexture`) replaces `fract(dot(...))` white noise; REPEAT-wrapped, sampled via `texture(uBlueNoise, gl_FragCoord.xy / 64.0).r`.

### 3. Advanced Volumetric Rendering ✅ DONE

- ✅ **Temporal Accumulation:** Ping-pong FBO pair (`accumFbo[0/1]`) blends 80% history + 20% new frame each tick (ACCUM_FRAG shader). Adaptive alpha: 1.0 on first frame/resize, 0.7 while dragging (fast ghost clear), 0.2 when still (smooth noise reduction). Three-pass pipeline: march → accumulate → blit.

---

## 1. Cloud Slab Early-Out (AABB Intersection) ✅ DONE

**Impact:** ~1.5x faster | **Effort:** Trivial
**Current state:** ✅ Implemented. Ray-slab intersection against `y ∈ [-3, 2]` computed before the loop; `t` starts at `tMin + 0.02 * dither`, skipping all empty air. Horizontal-ray epsilon guard prevents divide-by-zero.
**Implementation:** Ray vs y-band AABB test. Compute the intersection distance of the camera ray `rd` with the horizontal slab defined by `y = -3.0` and `y = 2.0`. Advance the starting distance `t` immediately to the near intersection point so the shader skips the empty air.

```glsl
// In raymarch() before the loop:
float tMin = (2.0 - ro.y) / rd.y;
float tMax = (-3.0 - ro.y) / rd.y;
float tNear = max(0.0, min(tMin, tMax));
t = max(t, tNear); // skip empty space to the slab
```

## 2. Hoist Drift to Uniform ✅ DONE

**Impact:** Free performance | **Effort:** Trivial
**Current state:** ✅ Implemented. `uCloudDrift` is computed once per frame in JS (`animTime * driftSpeed * vec3(0, 0.1, 1.0)`) and passed as a uniform. `mapN()` subtracts it with `vec3 q = p - uCloudDrift`.
**Implementation:** Compute `cloudDrift()` once in JS. Calculate this vector once in JavaScript per frame and pass it as a new uniform `uniform vec3 uCloudDrift;`. This removes redundant vector math from the innermost FBM loop.

## 3. Half-res + Upscale ✅ DONE

**Impact:** ~4x faster | **Effort:** Easy
**Current state:** ✅ Implemented. Raymarch renders to `marchFbo` at `canvas.width/2 × canvas.height/2`. `BLIT_FRAG` upscales to the full canvas using `LINEAR`-filtered texture sampling (bilinear).
**Implementation:** FBO + bilinear blit shader. Render the raymarching pass at 50% resolution (e.g., `canvas.width / 2`, `canvas.height / 2`) into a Framebuffer Object (FBO) backed by a texture. Pass that texture to a very simple fullscreen blit shader that draws to the canvas with bilinear filtering. Clouds are intrinsically soft, so the resolution drop is often unnoticeable.

## 4. Empty-Space Skipping (Adaptive Step Size) ❌ NOT DONE

**Impact:** ~1.5x faster | **Effort:** Medium
**Current state:** Step size is `t += max(0.06, 0.05 * t)` — mildly progressive but not density-adaptive. Does not use a cheap probe to detect clear air and skip ahead.
**Implementation:** Adaptive dt in march loop. Use a cheaper, lower-octave noise function to test density. If density is zero (clear air), increase the step size significantly. Only take fine steps when entering the boundary of a cloud.

## 5. Temporal Accumulation ✅ DONE

**Impact:** ~2-3x faster | **Effort:** Medium
**Current state:** ✅ Implemented. Ping-pong `accumFbo[0/1]` pair in `ACCUM_FRAG` blends 80% history + 20% new frame each tick. Adaptive alpha: 1.0 on reset/resize, 0.7 while dragging, 0.2 when still. Three-pass pipeline: march → accumulate → blit.
**Implementation:** Ping-pong FBO setup. Combine 80% of the previous frame with 20% of the newly rendered frame. This smooths out noise, meaning you can severely reduce the number of raymarching steps or add heavy jitter, while the temporal accumulation will blend out the grain over a few frames.

## 6. Checkerboard Render ❌ NOT DONE

**Impact:** ~2x faster | **Effort:** Medium
**Current state:** All pixels inside the viewport execute the heavy fragment shader every frame. No alternating discard pattern.
**Implementation:** Alternate pixels each frame. Using `gl_FragCoord`, discard rendering on even pixels for frame N, and odd pixels for frame N+1. Reconstruct the missing pixels by blending with the previous frame's result.

## 7. WebGPU Compute Shader ❌ NOT DONE

**Impact:** ~3-5x faster | **Effort:** Hard
**Current state:** The logic is fully contained in a WebGL2 fragment shader. No compute pipeline exists for Clouds (Turing mode has a WebGPU path, but Clouds does not).
**Implementation:** Port the march loop to a compute pipeline. Compute shaders can share noise evaluations in local workgroups (Shared Memory) and bypass rasterizer overhead.

# Next Feature Additions

In addition to the performance optimizations above, the following features can be added across four main categories to enhance the visual richness, interactivity, and export/quality options.

## 8. Visual / Atmosphere

- **Sun Position & Day-Night Arc:** Currently `sundir` is hardcoded. Turn it into a uniform (`uSunPos`) driven by a time-of-day parameter to smoothly animate the sunlight across the sky.
- **Procedural Stars + Moon at Night:** Add a high-frequency hash function (e.g., `fract(sin(dot(uv, ...)))`) triggered when `sundir.y` dips below zero to render stars, alongside a procedural glowing moon circle.
- **God Rays (Volumetric Light Shafts):** Introduce radial blur emanating from the sun's position in screen space, masked by the cloud alpha, to simulate light scattering.
- **Rain Streaks & Lightning Flashes:** Rain can be implemented as a fast-panning screen-space directional noise. Lightning is a sudden intensity spike to `uSunColor` coupled with a repositioned light source.
- **Ground Fog:** Render a secondary low-altitude volume layer (e.g., `y < -2.0`). Because fog is generally featureless, it can use a much cheaper noise evaluation and ray-plane intersector.

## 9. Animation / Time

- **Time-of-day Slider:** Map a single 0–24h cycle slider to interpolate smoothly across distinct color palettes (sky, cloud, sun, shadow).
- **Auto Mood Interpolation:** When switching presets, `lerp` the `colors` arrays and `params` inside `requestAnimationFrame` over a defined duration instead of cutting instantly.
- **Wind Direction Vector (`uWindDir`):** Replace the scalar float `uSpeed` with a `vec2` uniform, allowing clouds to travel dynamically along both X and Z axes.
- **Weather Cycle Automation:** Introduce a slow, 1D Perlin noise generator in JS that automatically drifts values like `coverage` and `amplitude` over minutes, simulating realistically changing weather.
- ✅ **Animate Cloud Type Transitions:** Instead of using discrete integer jumps for `uCloudType`, refactor the density equations to continuously blend using a float parameter, letting stratus morph into cumulus organically.

## 10. Interaction

- **Touch & Pinch Gesture Orbit:** Supplement the existing mouse listeners with `touchstart` / `touchmove`. Use the distance between two simultaneous touch points to drive FOV or camera zoom.
- **Mobile Gyroscope Camera Look:** Hook into the `DeviceOrientation` API, mapping `alpha`, `beta`, and `gamma` to `orbitRef`, turning the user's phone into a direct viewing window.
- **Keyboard Preset Shortcuts (1-5):** Bind standard numeric keys to instantly trigger different atmospheric presets.
- **Double-tap to Reset Orbit:** Listen for `dblclick` on the canvas to revert the orbital camera parameters back to default (`{x: 0.18, y: 0.40}`).
- **Pointer-driven Cloud Distortion:** Unproject the canvas pointer to a 3D ray. Pass a `uMouseWorld` uniform and push cloud density away within `mapN()` to let users physically "part" the clouds.

## 11. Quality / Export

- **High-Res Still at Max Octaves:** Register a callback method on `RendererHandle` that renders a single frame synchronously with `canvas.width` scaling multiplied and max `uDefinition`, then exports a `dataURL`.
- **Animated GIF Loop via Loop-Safe Export:** To loop gracefully, modify the FBM offset calculation to incorporate 4D domain warping so the noise wraps mathematically over a specific period.
- **FPS & Step Counter Debug Overlay:** Mount a small React DOM overlay querying timestamps (`dt`) to show performance, and optionally render a heatmap of raymarch step-counts to visualize bottlenecks.
- **Mip-Mapped Noise Texture Option:** Instead of computing procedural noise step-by-step mathematically, precalculate a 3D noise texture and bind it as a `sampler3D`. Hardware trilinear filtering and mipmapping vastly cuts down compute cycles.

# Deep / Advanced Brainstorming

If you significantly refactor the shader going forward, here are advanced theoretical improvements.

## 12. Advanced Performance Techniques

- **Proxy Geometry (Macro-Density Map):** Instead of marching fixed steps through empty space, pre-generate a low-resolution 3D bounding volume or a 2D heightmap mathematically representing the macro-structure of the clouds. Send rays only into this proxy geometry to entirely bypass noise evaluations in clear air.
- **Cone Tracing & Distance-Based LOD:** As the ray travels further from the camera, physically widen its sampling footprint. Use fewer noise octaves for distant clouds, combining Cone Tracing principles with procedural noise to massively reduce horizon aliasing and required ray steps.
- **Interleaved Gradient Noise (IGN):** Overlap IGN for per-pixel ray jittering. A 2x2 block of pixels systematically staggers its ray start offsets. Paired with Temporal Accumulation, each pixel only does 25% of the work, but the reconstructed image is perfectly dense and completely smooth.
- **Pre-baked Transmittance (Removing Shadow Rays):** Currently, the shader blindly marches secondary rays towards the sun `map(...sundir)` to calculate shadows. Utilizing a 1-tap directional derivative for localized self-shadowing, or adopting Deep Shadow Maps, would eliminate the innermost secondary loop.
- **Cheaper Phase Functions:** Substitute the linear interpolation (`mix` and `dif`) with a fast Schlick phase function. It realistically simulates forward and backward light scattering (that classic silver lining effect around clouds) at a fraction of the computational footprint.

## 13. Advanced Visual Variations

- **Multi-Layer Atmosphere:** Implement distinct stratified layers—e.g., fast-moving stringy stratus clouds at `y = -2.0` and slow, dense cumulus towers at `y = 1.0`. Intersecting specific vertical bands independently fakes incredible depth and scale.
- ✅ **Cellular / Voronoi Clouds:** Migrate away from pure Gradient noise (Perlin/Simplex), and introduce Cellular noise with inverted distance checks. This produces distinct "cauliflower" billows and heavily cratered, bubbly cumulus structures instead of wispy smoke-like gradients.
- **Aurora Borealis & Bioluminescence:** Include a secondary emissive pass that willfully ignores the sun direction. By injecting saturated localized colors parameterized to a low-frequency noise curve, you can forge glowing auroras or magical, self-illuminating nebula dust.
- **Morphological Modifiers (Anvils & Shelves):** Apply height-dependent density clamping. Crushing the top Y-values while increasing noise frequency laterally flattens storm clouds into classic Cumulonimbus "anvils", or twists them into terrifying rolling shelf-clouds.
- **Stylized / Ghibli-Toon Clouds:** Siphon the final `den` and `shadow` values through a hard `step()` threshold or a 1D color texture ramp instead of a soft blend. This translates the volumetric data into cel-shaded, Anime-style fluffy clouds with solid edges.
- **Vortex & Tornado Distortion:** Before dropping the 3D coordinate `p` into `mapN`, apply a severe radial twist or curl noise parameterized around a central axis. This seamlessly curls the clouds into a massive swirling hurricane eye or a localized tornado spout.

## 14. Extreme Rendering Architectures

- **SDF (Signed Distance Field) Sphere Tracing:** Instead of marching at fixed intervals, mathematically enclose the scattered noise domains within primitive SDF bounds (like invisible spheres or toruses). You can use sphere tracing to take massive, mathematically perfect leaps forward, only falling back to tiny raymarch steps when breaching the invisible SDF boundary.
- **Joint-Bilateral Upsampling:** Instead of a generic bilinear upscale (which blurs details), render the clouds at 1/4th resolution and upscale them using a depth-aware or luminance-aware bilateral filter. This preserves pixel-perfect, razor sharp silhouettes along the cloud edges while aggressively slashing the fragment workload.
- **Tile-Based Frustum Culling:** Divide the screen into a 16x16 grid. Pre-dispatch a microscopic compute pass to determine the min/max cloud height visible within that specific tile frustum. The heavy raymarching shader is completely aborted for tiles containing only clear sky.
- **Frame Generation (Motion Vectors):** Output the exact camera velocity and calculated cloud drift into a 2D Motion Vector buffer. Render the complex physics at 30fps and execute a lightweight reprojection pass (conceptually similar to DLSS Frame Gen) to synthesize in-between frames for buttery smooth 60fps/120fps motion.
- **Pre-computed Atmospheric Textures:** The sky backdrop currently relies on a linear gradient approximation based on ray height. Full, biologically accurate Rayleigh and Mie scattering equations can be pre-calculated into Look-Up Textures (Transmittance and In-scatter LUTs) granting physically perfect, hyper-realistic sunsets at virtually zero runtime cost.

## 15. Extreme Environmental Variations

- **Global Flow Fields:** Forget moving in a uniform straight line—drop in a massive, sprawling 2D vector field texture. Clouds will organically orbit, curl, spread out, and collide across the sky based on literal high/low atmospheric pressure systems.
- **Solid Geometry Intersection:** Pass a depth buffer corresponding to real 3D objects (mountains, floating islands, or airplanes) into the shader. The clouds will not only softly fog out the geometry as it passes through, but the geometry itself can cast gigantic volumetric God-ray shadows _into_ the storms.
- **Time-lapse (Long Exposure) Mode:** Intentionally bypass clearing the Framebuffer Object and blend opacities continuously. Fast moving clouds will smear across the sky into beautiful, silky continuous streaks, perfectly simulating a camera's long-exposure shutter.
- **Planetary Horizon Curvature:** Replace the currently infinite, perfectly flat `-3.0 to 2.0` Cartesian slab with spherical mathematics. By calculating intersections against two gigantic spheres (an inner and outer atmospheric radius), the cloud layer will visibly dip away into darkness over the planet's horizon.
- **Voxelized "Minecraft" Filter:** Apply a harsh `floor()` quantization to the world ray position just before it gets evaluated by the noise functions (e.g., `pos = floor(pos * 5.0) / 5.0`). The fluffy procedural smoke will instantly compress into enormous, rigid, solid floating blocks.
- **Internal Subsurface Bleed:** Thick clouds glow internally when the harsh sun is positioned directly behind them. Add a blurred secondary density lookup strictly reserved for the shadow calculation `denShadow`. This explicitly bleeds warm sunlight through the dense core of storm fronts, giving visceral volume to the clouds.

# Creative Moods & Application Settings

Looking at the broader application ecosystem around out rendering logic, here are conceptual additions to colors, settings, and stylized render modes.

## 16. Color & Mood Variations

- **Vaporwave / Synthwave:** Extremely unnatural, vibrant palettes mapping the sky to hot magenta and deep purple space. Introduce a faint neon grid or wireframe that traces the clouds' contours.
- **Cinematic "Golden Hour":** Force the sun angle very low to the horizon. Over-expose the highlights with burning oranges and sharp reds, while shadows sink into pitch-black blues, maximizing contrast and scattering effects.
- **Toxic / Alien Atmosphere:** Poisonous green or violent yellow skies with dense, oppressive purple clouds. Invert the light scattering rules so shadow faces glow instead of the lit faces.
- **Monochromatic Noir:** Disable the color arrays and render in pure luminance (grayscale). Introduce heavy artificial film grain and a severe vignette to mimic gritty vintage photography.
- **Cotton Candy Dream:** Zero out the harsh sun factors and use wide, soft lighting. Map the clouds completely to baby blues, pinks, and soft yellows. Increase the `uCoverage` and drop the `amplitude` to create a fluffy, non-threatening pastel world.

## 17. Settings & App Opportunities

- **Audio-Reactive Mode:** Bind the `Wind Speed`, `Cloud Amplitude`, or `Lightning Flashes` directly to frequency bands exposed via the Web Audio API. When a bass drop hits, the clouds literally erupt and storm.
- **Dynamic Camera Paths (Flight Systems):** Instead of pivoting statically around `orbitRef`, define non-linear Bézier curves in JS. The camera can 'fly' like an airplane banking through narrow canyons of clouds on autopilot.
- **Weather Scenario Creator UI:** An advanced, standalone sub-menu allowing users to finely tune all sliders, assign them a specific URL hash parameter, and send links to friends that perfectly recreate their exact sky layout.
- **Meditation / Focus Breathing:** Introduce an automated ultra-slow pulsing oscillation in the cloud coverage logic and the camera field-of-view, perfectly synchronized to a 4-second inhale, 6-second exhale breathing timing.
- **Dual-View / Satellite Splitscreen:** Render a locked, orthographic top-down 'satellite' map of the weather system in a small 2D canvas at the corner of the screen while rendering the rich 3D flight perspective normally.
- **Time-Scaling (Fast-Forward Mode):** Add a UI multiplier (e.g. `x100`) that accelerates the logical passage of time (`iTime`), allowing users to watch majestic storms form, boil, and dissipate in seconds rather than real-time.
- **Real-World Weather Hook:** Establish an integration with an API (like OpenWeatherMap). Read the user's local IP data and automatically force the cloud density, rain overlays, and exact time-of-day math (sun angle) to precisely mirror the sky sitting directly outside their physical window.
- **WebRTC Live Sync:** Create a network mode using WebRTC where one person acts as the "Weather Deity" altering settings on their phone, and an entire room/website of attached viewers sees the atmosphere morph perfectly in sync.
- **Interactive Wind Particles:** Mount a compute-shader or logic loop running millions of tiny, glowing GPU particles surfing through the "empty" spaces of the noise function, acting as a visualizer for wind and turbulence.
- **WebXR (VR/AR) Integration:** Introduce a stereoscopic rendering loop where users can physically stand inside the clouds in a VR headset, using physical hand controllers to sweep away volumetric density like wiping away fog.
- **Image-to-Cloud (Custom Masking):** Allow an image upload (black and white mask) that acts as a localized density multiplier. You can mathematically force the drifting clouds to naturally clump together into a specific logo, text shape, or silhouette.
- **Procedural Audio Generation:** Instead of just reacting to audio, generate it. Use the raw FBM cloud coverage data to drive a Web Audio frequency synthesizer, generating generative synth hums, deep rumbles, and ambient wind soundscapes exactly matching the visuals on screen.

## 18. Aesthetic Style Filters

- **8-bit / EGA Dithered Retro:** Skip bilinear scaling altogether, down-res heavily, and use Bayer matrix dithering in the post-process shader to restrict the entire palette to just 8 or 16 rigid retro colors (Gameboy or DOS aesthetic).
- **Kuwahara (Watercolor) Painting:** Run a post-process step that applies a Kuwahara filter to the final rendered image. It mathematically groups and smudges low-contrast areas, making the mathematical raymarching look exactly like hand-painted wet canvas.
- **ASCII / Terminal Glitch:** Map the luminance data of the volume not to pixels, but to screen-space UV rectangles pulling from a texture atlas of characters `(.,-,+,*,%,#,@)`, creating a matrix-style terminal rendering of clouds.
- **Thermal Heatmap / Infrared:** Apply a false-color lookup where cloud distance corresponds to deep blues, and structural thickness translates rapidly to reds and blinding hot whites, mimicking a military FLIR infrared camera tracking a storm.
- **Pencil Sketch / Edge Hatching:** Derive the distance buffer differential to detect edges, then overlay a harsh pencil / paper noise pattern constrained strictly by the directional gradients. The clouds look like hand-drawn notebook illustrations.
- **VHS Degraded Playback:** Filter the final output with massive chromatic aberration, rolling tracking noise bands at the bottom edge of the canvas, scanlines, and slight RGB channel separation to simulate watching the clouds recorded on an old 90s camcorder.
- **Pointillism (Seurat / Stippling):** Distill the volumetric brightness thresholds into a pattern of uniformly placed, tiny colored circles intersecting on a raw canvas background. The cloud formations become visible only as a painting made entirely of dots.
- **Holographic / Iridescent Prisms:** Swap the diffuse calculation `dif` fundamentally. Instead of returning shadow values, map normal approximations across a sweeping rainbow spectrum, rendering the clouds as shimmering, oily soap bubbles or solid Bismuth crystals.
- **Stained Glass Window / Voronoi Fracture:** Drop a post-processing cellular fracture that divides the canvas into irregular geometric polygons. Fill each randomly generated chunk with the localized average cloud tint, and trace thick, black "lead lines" along the cell borders.
- **Origami / Low-Poly Shading:** Aggressively quantize the raymarch distances and derive faceted flat-shaded normals. Instead of soft vapor, the clouds look like they are folded from thousands of rigid, geometric pieces of colored paper.
- **Cyberpunk Overload:** Combine rain streaks with an electric palette—deep black shadows combined with violent neon greens, cyan highlights, and harsh lens flares piercing out from the localized storm centers.
- **Blueprint / CAD Rendering:** Ignore volumetric light entirely. Use edge detection and concentric contour math to map the topography of the cloud layer, rendering it entirely via thin, geometric white lines floating over a dark architectural blue grid background.
- **Microscopic Biological Membrane:** Shift the visual cues to replicate an electron microscope. The clouds act as translucent, glowing amoeba or cellular membranes with dense, brightly lit organic nuclei scattered deep inside the volume.

# Crafting Picturesque Sunsets

To execute those truly breathtaking, hyper-realistic "Golden Hour" skies, the core math underlying light interaction and volumetric shapes must change.

## 19. Light / Bouncing Dynamics

- **The "Powder Effect" (Internal Light Bounce):** Strict algorithms using Beer's Law (`exp(-density)`) make thick clouds turn completely pitch-black extremely fast. By inverting an exponential curve on the density (e.g., `(1.0 - exp(-density * 2.0)) * exp(-density)`), we successfully spoof secondary un-directed photon bounces. This creates the breathtaking phenomenon where low sunlights make the 'bellies' of massive storm clouds glow with deep, soft, inner-illuminated orange.
- **Henyey-Greenstein (Phase Functions):** Real clouds glow viciously around their rim when the sun is right behind them ("Silver Linings"). Swapping static shadow calculations for a Dual-lobe Phase Function evaluates light scattered intensely towards the viewer vs. bouncing backward. This makes sunsets piercingly bright at the edges without bloating the colors elsewhere.
- **Vertical Penumbra Gradients:** Because the earth casts a shadow upward as the sun sets, sunset clouds are never one color. Mapping a manual gradient directly against the ray's vertical height (`p.y`) forces the belly of the clouds into cold, dark purples while leaving the fluffy high-altitude caps saturated with bright pink and molten gold.

## 20. Sculpting Cloud Forms

- **Ridged "Cauliflower" Noise:** Wispy FBM smoke doesn't trap light beautifully. Switching the standard gradient noise to Ridged Multifractal Noise (`1.0 - abs(noise)`) mathematically erodes the volume. It builds sharp, bubbly, cauliflower-like storm cells. These hard ridges are the exact shapes necessary to catch and trap long-angle sunset rays.
- **Altimetry Profiling:** Using an altitude bell curve (`smoothstep` based on `p.y`), flatten out the bottom layer of the cloud perfectly horizontally while letting the tops billow upward. A flat base is critical for sunrises/sunsets as it presents a continuous ceiling for the warm light to blanket.
- **Wind Shearing (Anvils):** Sunsets look incredibly majestic passing through heavy storm fronts. By mathematically shearing the volume matrix coordinates—skewing the clouds horizontally the higher they go (`p.x += p.y * shearFactor`)—you build dramatic, leaning cumulus "anvil" shapes that lean directly into the sunset to catch maximum light.
