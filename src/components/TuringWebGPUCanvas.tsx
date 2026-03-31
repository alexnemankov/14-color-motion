import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RendererStatus } from '../App';
import { cloneParams, stepSmoothedParams } from './rendererMotion';
import { RendererHandle, RendererProps, captureCanvasImageData } from './rendererTypes';

interface CanvasProps extends RendererProps {
  onReady?: () => void;
  onFallback: () => void;
}

const toEvenSize = (value: number) => Math.max(2, Math.floor(value / 2) * 2);
const GPUTextureUsageFlags = (window as any).GPUTextureUsage as {
  TEXTURE_BINDING: number;
  STORAGE_BINDING: number;
  COPY_DST: number;
  RENDER_ATTACHMENT: number;
};
const GPUBufferUsageFlags = (window as any).GPUBufferUsage as {
  UNIFORM: number;
  COPY_DST: number;
};

const computeShaderSource = `
struct SimUniforms {
  width: f32,
  height: f32,
  feed: f32,
  kill: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var<uniform> uniforms: SimUniforms;

fn sampleState(x: i32, y: i32) -> vec2<f32> {
  let maxX = i32(uniforms.width) - 1;
  let maxY = i32(uniforms.height) - 1;
  let coord = vec2<i32>(clamp(x, 0, maxX), clamp(y, 0, maxY));
  return textureLoad(srcTex, coord, 0).rg;
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u32(uniforms.width) || gid.y >= u32(uniforms.height)) {
    return;
  }

  let x = i32(gid.x);
  let y = i32(gid.y);

  let state = sampleState(x, y);
  let center = state;
  let lapl =
    sampleState(x - 1, y - 1) * 0.05 +
    sampleState(x, y - 1) * 0.20 +
    sampleState(x + 1, y - 1) * 0.05 +
    sampleState(x - 1, y) * 0.20 +
    center * -1.0 +
    sampleState(x + 1, y) * 0.20 +
    sampleState(x - 1, y + 1) * 0.05 +
    sampleState(x, y + 1) * 0.20 +
    sampleState(x + 1, y + 1) * 0.05;

  let A = center.x;
  let B = center.y;
  let abb = A * B * B;
  let da = 1.0;
  let db = 0.5;
  let dt = 1.0;
  let feed = mix(0.03, 0.045, clamp(uniforms.feed / 2.0, 0.0, 1.0));
  let kill = mix(0.06, 0.065, clamp(uniforms.kill / 4.0, 0.0, 1.0));
  let newA = clamp(A + (da * lapl.x - abb + feed * (1.0 - A)) * dt, 0.0, 1.0);
  let newB = clamp(B + (db * lapl.y + abb - (kill + feed) * B) * dt, 0.0, 1.0);

  textureStore(dstTex, vec2<i32>(x, y), vec4<f32>(newA, newB, 0.0, 1.0));
}
`;

const renderShaderSource = `
struct RenderUniforms {
  blend: f32,
  colorCount: f32,
  _pad0: vec2<f32>,
  colors: array<vec4<f32>, 8>,
};

@group(0) @binding(0) var simTex: texture_2d<f32>;
@group(0) @binding(1) var simSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: RenderUniforms;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(3.0, 1.0)
  );

  var output: VertexOut;
  let position = positions[vertexIndex];
  output.position = vec4<f32>(position, 0.0, 1.0);
  output.uv = position * 0.5 + vec2<f32>(0.5, 0.5);
  return output;
}

fn paletteColor(tInput: f32) -> vec3<f32> {
  let count = max(i32(uniforms.colorCount), 1);
  if (count == 1) {
    return uniforms.colors[0].xyz;
  }

  let t = clamp(tInput, 0.0, 1.0);
  let scaled = t * f32(count - 1);
  let index = i32(floor(scaled));
  let nextIndex = min(index + 1, count - 1);
  var localT = fract(scaled);
  let width = max(0.0001, uniforms.blend * 0.5);
  localT = smoothstep(0.5 - width, 0.5 + width, localT);

  let fromColor = uniforms.colors[index].xyz;
  let toColor = uniforms.colors[nextIndex].xyz;
  return mix(fromColor, toColor, localT);
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4<f32> {
  let b = textureSample(simTex, simSampler, input.uv).g;
  let t = pow(b * 3.5, 1.2);
  var color = paletteColor(t);
  let vig = input.uv - vec2<f32>(0.5, 0.5);
  let vignette = 1.0 - dot(vig, vig) * 0.6;
  color *= vignette;
  return vec4<f32>(color, 1.0);
}
`;

function createSeedData(width: number, height: number, seed: number) {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const u = x / width;
      const v = y / height;
      const dx = u - 0.5;
      const dy = v - 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let b = dist < 0.1 ? 1 : 0;
      const noise = Math.sin((u + seed) * 12.9898 + (v + seed) * 78.233) * 43758.5453;
      if ((noise - Math.floor(noise)) > 0.99) b = 1;
      data[index] = 1;
      data[index + 1] = b;
      data[index + 2] = 0;
      data[index + 3] = 1;
    }
  }
  return data;
}

function createShaderModule(device: any, code: string) {
  return device.createShaderModule({ code });
}

const TuringWebGPUCanvas = forwardRef<RendererHandle, CanvasProps>(function TuringWebGPUCanvas(
  { params, colors, paused, renderScale = 1, onReady, onFallback },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<RendererStatus | null>(null);
  const state = useRef({ params, displayParams: cloneParams(params), colors, paused, lastSeed: params.seed });

  useImperativeHandle(ref, () => ({
    get status() {
      return statusRef.current;
    },
    supportsExternalTime: false,
    supportsLoopSafeExport: false,
    getCanvas: () => canvasRef.current,
    captureFrame: () => captureCanvasImageData(canvasRef.current),
  }), []);

  useEffect(() => {
    state.current.params = params;
    state.current.paused = paused;
  }, [params, paused]);

  useEffect(() => {
    state.current.colors = colors;
  }, [colors]);

  useEffect(() => {
    const gpu = (navigator as Navigator & { gpu?: any }).gpu;
    const canvas = canvasRef.current;
    if (!gpu || !canvas) {
      statusRef.current = null;
      onFallback();
      return;
    }

    let disposed = false;
    let animationFrameId = 0;

    const boot = async () => {
      try {
        const adapter = await gpu.requestAdapter();
        if (!adapter || disposed) {
          onFallback();
          return;
        }

        const device = await adapter.requestDevice();
        if (disposed) return;

        const context = canvas.getContext('webgpu') as any;
        if (!context) {
          onFallback();
          return;
        }

        const presentationFormat = gpu.getPreferredCanvasFormat();
        const sampler = device.createSampler({
          magFilter: 'linear',
          minFilter: 'linear',
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        });

        const simUniformBuffer = device.createBuffer({
          size: 16,
          usage: GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
        });

        const renderUniformBuffer = device.createBuffer({
          size: 16 + 8 * 16,
          usage: GPUBufferUsageFlags.UNIFORM | GPUBufferUsageFlags.COPY_DST,
        });

        const computeModule = createShaderModule(device, computeShaderSource);
        const renderModule = createShaderModule(device, renderShaderSource);

        const computePipeline = device.createComputePipeline({
          layout: 'auto',
          compute: {
            module: computeModule,
            entryPoint: 'main',
          },
        });

        const renderPipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: renderModule,
            entryPoint: 'vsMain',
          },
          fragment: {
            module: renderModule,
            entryPoint: 'fsMain',
            targets: [{ format: presentationFormat }],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });

        let simWidth = 0;
        let simHeight = 0;
        let textures: any[] = [];
        let computeBindGroups: any[] = [];
        let renderBindGroups: any[] = [];
        let flip = 0;

        const rebuildTextures = (seed: number) => {
          textures.forEach(texture => texture.destroy());
          const pixelScale = window.devicePixelRatio * renderScale;
          canvas.width = toEvenSize(window.innerWidth * pixelScale);
          canvas.height = toEvenSize(window.innerHeight * pixelScale);
          context.configure({
            device,
            format: presentationFormat,
            alphaMode: 'premultiplied',
          });

          simWidth = toEvenSize(Math.max(2, Math.floor((window.innerWidth * renderScale) / 2)));
          simHeight = toEvenSize(Math.max(2, Math.floor((window.innerHeight * renderScale) / 2)));
          const usage = GPUTextureUsageFlags.TEXTURE_BINDING | GPUTextureUsageFlags.STORAGE_BINDING | GPUTextureUsageFlags.COPY_DST;
          textures = [
            device.createTexture({ size: [simWidth, simHeight], format: 'rgba16float', usage }),
            device.createTexture({ size: [simWidth, simHeight], format: 'rgba16float', usage }),
          ];

          const seedData = createSeedData(simWidth, simHeight, seed);
          const bytesPerRow = simWidth * 8;
          textures.forEach(texture => {
            device.queue.writeTexture(
              { texture },
              seedData,
              { bytesPerRow, rowsPerImage: simHeight },
              { width: simWidth, height: simHeight, depthOrArrayLayers: 1 }
            );
          });

          computeBindGroups = [
            device.createBindGroup({
              layout: computePipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: textures[0].createView() },
                { binding: 1, resource: textures[1].createView() },
                { binding: 2, resource: { buffer: simUniformBuffer } },
              ],
            }),
            device.createBindGroup({
              layout: computePipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: textures[1].createView() },
                { binding: 1, resource: textures[0].createView() },
                { binding: 2, resource: { buffer: simUniformBuffer } },
              ],
            }),
          ];

          renderBindGroups = [
            device.createBindGroup({
              layout: renderPipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: textures[0].createView() },
                { binding: 1, resource: sampler },
                { binding: 2, resource: { buffer: renderUniformBuffer } },
              ],
            }),
            device.createBindGroup({
              layout: renderPipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: textures[1].createView() },
                { binding: 1, resource: sampler },
                { binding: 2, resource: { buffer: renderUniformBuffer } },
              ],
            }),
          ];

          flip = 0;
        };

        rebuildTextures(params.seed);
        statusRef.current = null;
        onReady?.();

        const resize = () => {
          rebuildTextures(state.current.params.seed);
        };

        window.addEventListener('resize', resize);

        const render = () => {
          animationFrameId = requestAnimationFrame(render);
          const current = state.current;
          current.displayParams = stepSmoothedParams(current.displayParams, current.params);
          const displayParams = current.displayParams;

          if (current.params.seed !== current.lastSeed) {
            rebuildTextures(current.params.seed);
            current.lastSeed = current.params.seed;
          }

          device.queue.writeBuffer(
            simUniformBuffer,
            0,
            new Float32Array([simWidth, simHeight, displayParams.amplitude, displayParams.frequency])
          );

          const renderUniformData = new Float32Array(4 + 8 * 4);
          renderUniformData[0] = displayParams.blend;
          renderUniformData[1] = current.colors.length;
          current.colors.forEach((color, index) => {
            const offset = 4 + index * 4;
            renderUniformData[offset] = color[0] / 255;
            renderUniformData[offset + 1] = color[1] / 255;
            renderUniformData[offset + 2] = color[2] / 255;
            renderUniformData[offset + 3] = 1;
          });
          device.queue.writeBuffer(renderUniformBuffer, 0, renderUniformData);

          const encoder = device.createCommandEncoder();
          if (!current.paused) {
            const steps = Math.max(1, Math.floor(displayParams.speed * 20));
            for (let i = 0; i < steps; i += 1) {
              const pass = encoder.beginComputePass();
              pass.setPipeline(computePipeline);
              pass.setBindGroup(0, computeBindGroups[flip]);
              pass.dispatchWorkgroups(Math.ceil(simWidth / 8), Math.ceil(simHeight / 8));
              pass.end();
              flip = 1 - flip;
            }
          }

          const view = context.getCurrentTexture().createView();
          const renderPass = encoder.beginRenderPass({
            colorAttachments: [
              {
                view,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          });
          renderPass.setPipeline(renderPipeline);
          renderPass.setBindGroup(0, renderBindGroups[flip]);
          renderPass.draw(3, 1, 0, 0);
          renderPass.end();
          device.queue.submit([encoder.finish()]);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
          window.removeEventListener('resize', resize);
          textures.forEach(texture => texture.destroy());
        };
      } catch {
        if (!disposed) {
          statusRef.current = null;
          onFallback();
        }
      }
      return undefined;
    };

    let cleanup: (() => void) | undefined;
    void boot().then(result => {
      cleanup = result;
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      cleanup?.();
    };
  }, [onFallback, onReady, params.seed, renderScale]);

  return <canvas ref={canvasRef} id="c" />;
});

export default TuringWebGPUCanvas;
