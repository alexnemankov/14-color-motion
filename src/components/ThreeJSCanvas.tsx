import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { RendererStatus } from "../App";
import { cloneParams, stepSmoothedParams } from "./rendererMotion";
import {
  RendererHandle,
  RendererProps,
  captureCanvasImageData,
} from "./rendererTypes";

// Simple Gaussian DOF shader for smooth bokeh
const GaussianDofShader = {
  uniforms: {
    tDiffuse: { value: null },
    focus: { value: 1.0 },
    aperture: { value: 0.02 },
    maxBlur: { value: 0.25 },
    width: { value: 1024 },
    height: { value: 1024 },
    dofEnabled: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float focus;
    uniform float aperture;
    uniform float maxBlur;
    uniform float width;
    uniform float height;
    uniform float dofEnabled;
    
    varying vec2 vUv;
    
    void main() {
      vec2 aspectRatio = vec2(width / height, 1.0);
      vec2 texCoord = vUv;
      vec4 color = texture2D(tDiffuse, texCoord);
      
      if (dofEnabled < 0.5) {
        gl_FragColor = color;
        return;
      }
      
      // Simple depth-based blur using repeated samples
      float blurAmount = maxBlur * aperture;
      vec4 blurred = color;
      float totalWeight = 1.0;
      
      // Gaussian-like blur with multiple samples
      float sampleDist = blurAmount * 0.01;
      for (int i = 1; i <= 8; i++) {
        float angle = float(i) * 0.785398; // ~45° increments
        float dist = float(i) * sampleDist;
        
        vec2 offset = vec2(cos(angle), sin(angle)) * dist / aspectRatio;
        blurred += texture2D(tDiffuse, texCoord + offset);
        blurred += texture2D(tDiffuse, texCoord - offset);
        totalWeight += 2.0;
      }
      
      gl_FragColor = blurred / totalWeight;
    }
  `,
};

void GaussianDofShader;

const MIN_UI_FOCUS_DISTANCE = 10;
const MAX_UI_FOCUS_DISTANCE = 80;
const MIN_UI_APERTURE = 0.001;
const MAX_UI_APERTURE = 0.06;
const MIN_UI_MAX_BLUR = 0.01;
const MAX_UI_MAX_BLUR = 0.35;

function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) {
  return THREE.MathUtils.mapLinear(
    THREE.MathUtils.clamp(value, inMin, inMax),
    inMin,
    inMax,
    outMin,
    outMax,
  );
}

function syncDofPass(
  dofPass: BokehPass,
  camera: THREE.PerspectiveCamera,
  params: RendererProps["params"],
  focusDistance: number,
) {
  const uniforms = dofPass.uniforms as Record<string, { value: number }>;
  dofPass.enabled = params.dofEnabled;
  uniforms.focus.value = THREE.MathUtils.clamp(
    focusDistance,
    camera.near + 0.001,
    camera.far - 1,
  );
  uniforms.aperture.value = mapRange(
    params.aperture,
    MIN_UI_APERTURE,
    MAX_UI_APERTURE,
    0.00002,
    0.00035,
  );
  uniforms.maxblur.value = mapRange(
    params.maxBlur,
    MIN_UI_MAX_BLUR,
    MAX_UI_MAX_BLUR,
    0.002,
    0.03,
  );
  uniforms.nearClip.value = camera.near;
  uniforms.farClip.value = camera.far;
}

const ThreeJSCanvas = forwardRef<RendererHandle, RendererProps>(
  function ThreeJSCanvas(
    {
      params,
      colors,
      paused,
      onStatusChange,
      renderScale = 1,
      externalTime = null,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef<RendererStatus | null>(null);
    const state = useRef({
      animTime: 0,
      lastTimestamp: 0,
      params,
      displayParams: cloneParams(params),
      colors,
      paused,
    });

    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const cameraRotationRef = useRef({ x: 0.5, y: 0 });
    const composerRef = useRef<EffectComposer | null>(null);
    const dofPassRef = useRef<BokehPass | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        get status() {
          return statusRef.current;
        },
        supportsExternalTime: true,
        supportsLoopSafeExport: true,
        getCanvas: () => rendererRef.current?.domElement ?? null,
        captureFrame: () =>
          captureCanvasImageData(rendererRef.current?.domElement ?? null),
      }),
      [],
    );

    useEffect(() => {
      state.current.params = params;
      state.current.paused = paused;
    }, [params, paused]);

    useEffect(() => {
      state.current.colors = colors;
    }, [colors]);

    useEffect(() => {
      if (dofPassRef.current && cameraRef.current) {
        syncDofPass(
          dofPassRef.current,
          cameraRef.current,
          params,
          params.focusDistance,
        );
      }
    }, [
      params.focusDistance,
      params.aperture,
      params.maxBlur,
      params.dofEnabled,
    ]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const testCanvas = document.createElement("canvas");
      const hasWebGL = !!(
        testCanvas.getContext("webgl2") ||
        testCanvas.getContext("webgl") ||
        testCanvas.getContext("experimental-webgl")
      );
      if (!hasWebGL) {
        const message =
          "This mode needs WebGL support. Try a different mode or enable graphics acceleration.";
        statusRef.current = { title: "Renderer unavailable", message };
        onStatusChange?.(statusRef.current);
        return;
      }

      statusRef.current = null;
      onStatusChange?.(null);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
      rendererRef.current = renderer;
      renderer.setPixelRatio(window.devicePixelRatio * renderScale);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000);

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create gradient background canvas
      const bgCanvas = document.createElement("canvas");
      bgCanvas.width = 512;
      bgCanvas.height = 512;
      const bgCtx = bgCanvas.getContext("2d");
      if (bgCtx) {
        const bgTexture = new THREE.CanvasTexture(bgCanvas);
        scene.background = bgTexture;
      }

      const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.set(28, 18, 0);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      const light = new THREE.DirectionalLight(0xffffff, 1.1);
      light.position.set(5, 10, 7);
      scene.add(light);

      const ambient = new THREE.AmbientLight(0x888888);
      scene.add(ambient);

      const geometry = new THREE.PlaneGeometry(80, 80, 320, 320);

      const shaderMaterial = new THREE.ShaderMaterial({
        vertexShader: `
        varying vec2 vUv;
        varying float vHeight;
        uniform float uTime;
        uniform float uScale;
        uniform float uAmplitude;
        uniform float uFrequency;
        uniform float uSeed;

        float smoothNoise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          
          float n0 = fract(sin(dot(i, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float n1 = fract(sin(dot(i + vec3(1.0, 0.0, 0.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float nx = mix(n0, n1, f.x);
          
          float n2 = fract(sin(dot(i + vec3(0.0, 1.0, 0.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float n3 = fract(sin(dot(i + vec3(1.0, 1.0, 0.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          float ny = mix(n2, n3, f.x);
          
          return mix(nx, ny, f.y);
        }

        void main() {
          vUv = uv;
          vec3 pos = position;
          float t = uTime * 0.12;
          float seed = uSeed * 0.001;

          // Strong wave patterns
          float wave1 = sin((pos.x * uScale + t) * uFrequency) * 0.6;
          float wave2 = cos((pos.y * uScale + t * 0.7) * uFrequency * 0.8) * 0.6;
          float wave3 = sin((pos.x * 0.3 + pos.y * 0.3 + t * 0.5) * uFrequency * 1.2) * 0.4;
          
          // Organic noise overlay
          float noiseVal = smoothNoise(vec3(pos.x * uScale * 0.5 + t * 0.4, pos.y * uScale * 0.5 + t * 0.4, seed)) * 0.6;

          float totalDisplacement = (wave1 + wave2 + wave3 + noiseVal * 0.5) * uAmplitude * 1.8;
          pos.z += totalDisplacement;
          vHeight = pos.z;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
        fragmentShader: `
        varying vec2 vUv;
        varying float vHeight;
        uniform vec3 uColors[8];
        uniform int uColorCount;
        uniform float uBlend;

        vec3 paletteColor(float t) {
          t = clamp(t, 0.0, 1.0);
          float segment = t * float(max(uColorCount - 1, 1));
          int idx = int(floor(segment));
          float f = fract(segment);

          vec3 c0 = uColors[0];
          vec3 c1 = uColors[0];
          for (int i = 0; i < 8; i++) {
            if (i == idx) c0 = uColors[i];
            if (i == idx + 1) c1 = uColors[i];
          }

          float b = max(0.001, uBlend * 0.5);
          f = smoothstep(0.5 - b, 0.5 + b, f);
          return mix(c0, c1, f);
        }

        void main() {
          float h = (vHeight + 3.2) / 6.4;
          vec3 col = paletteColor(h);
          float glow = 1.0 - length(vUv - 0.5) * 0.8;
          col *= mix(0.6, 1.0, glow);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: params.scale },
          uAmplitude: { value: params.amplitude },
          uFrequency: { value: params.frequency },
          uSeed: { value: params.seed },
          uBlend: { value: params.blend },
          uColors: { value: new Array(8).fill(new THREE.Color(0, 0, 0)) },
          uColorCount: { value: Math.max(2, colors.length) },
        },
        side: THREE.DoubleSide,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(geometry, shaderMaterial);
      mesh.rotation.x = -Math.PI / 2;
      scene.add(mesh);
      meshRef.current = mesh;

      container.appendChild(renderer.domElement);

      // Set up post-processing with depth-aware DOF
      const composer = new EffectComposer(renderer);
      composerRef.current = composer;

      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const dofPass = new BokehPass(scene, camera, {
        focus: params.focusDistance,
        aperture: params.aperture,
        maxblur: params.maxBlur,
      });
      syncDofPass(dofPass, camera, params, params.focusDistance);
      dofPassRef.current = dofPass;
      composer.addPass(dofPass);

      // Mouse tracking for camera rotation via drag
      let isMouseDown = false;
      let previousMousePosition = { x: 0, y: 0 };
      let targetRotX = cameraRotationRef.current.x;
      let targetRotY = cameraRotationRef.current.y;
      let cameraDistance = 32;
      let focusPoint = new THREE.Vector3(0, 2, 0);

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onMouseDown = (e: MouseEvent) => {
        isMouseDown = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
      };

      const onMouseUp = () => {
        isMouseDown = false;
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!isMouseDown) return;

        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        targetRotY += deltaX * 0.005;
        targetRotX += deltaY * 0.005;

        // Clamp vertical rotation
        targetRotX = Math.max(
          -Math.PI * 0.4,
          Math.min(Math.PI * 0.4, targetRotX),
        );

        previousMousePosition = { x: e.clientX, y: e.clientY };
      };

      const onMouseClick = (e: MouseEvent) => {
        // Only process click if not dragging and Ctrl is held
        if (
          Math.abs(e.clientX - previousMousePosition.x) > 5 ||
          Math.abs(e.clientY - previousMousePosition.y) > 5 ||
          !e.ctrlKey
        ) {
          return;
        }

        // Calculate mouse position in normalized device coordinates
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        // Update raycaster with camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Check for intersection with the mesh
        const intersects = raycaster.intersectObject(mesh);

        if (intersects.length > 0) {
          // Set focus to the intersection point
          focusPoint.copy(intersects[0].point);
        }
      };

      const onMouseWheel = (e: WheelEvent) => {
        e.preventDefault();
        cameraDistance += e.deltaY * 0.08;
        cameraDistance = Math.max(12, Math.min(80, cameraDistance));
      };

      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          isMouseDown = true;
          previousMousePosition = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        }
      };

      const onTouchEnd = () => {
        isMouseDown = false;
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!isMouseDown || e.touches.length === 0) return;

        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        targetRotY += deltaX * 0.005;
        targetRotX += deltaY * 0.005;

        targetRotX = Math.max(
          -Math.PI * 0.4,
          Math.min(Math.PI * 0.4, targetRotX),
        );

        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      };

      renderer.domElement.addEventListener("mousedown", onMouseDown);
      renderer.domElement.addEventListener("mouseup", onMouseUp);
      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("click", onMouseClick);
      renderer.domElement.addEventListener("wheel", onMouseWheel, {
        passive: false,
      });
      renderer.domElement.addEventListener("touchstart", onTouchStart);
      renderer.domElement.addEventListener("touchend", onTouchEnd);
      renderer.domElement.addEventListener("touchmove", onTouchMove, {
        passive: false,
      });

      const resize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio * renderScale);
        if (composerRef.current) {
          composerRef.current.setSize(width, height);
        }
      };

      window.addEventListener("resize", resize);
      resize();

      let rafId: number;

      const renderLoop = (ts: number) => {
        rafId = requestAnimationFrame(renderLoop);

        const cur = state.current;
        if (externalTime !== null) {
          cur.animTime = externalTime;
        } else if (!cur.paused) {
          const dt =
            cur.lastTimestamp === 0 ? 0 : (ts - cur.lastTimestamp) / 1000;
          cur.animTime += dt * cur.params.speed;
        }
        cur.lastTimestamp = ts;

        // Update background gradient
        if (bgCtx) {
          const gradient = bgCtx.createLinearGradient(0, 0, 0, bgCanvas.height);
          const palette = cur.colors.slice(0, 4);
          palette.forEach((c, i) => {
            const t = i / Math.max(1, palette.length - 1);
            const hex = `#${((c[0] << 16) | (c[1] << 8) | c[2]).toString(16).padStart(6, "0")}`;
            gradient.addColorStop(t, hex);
          });
          bgCtx.fillStyle = gradient;
          bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
          if (scene.background instanceof THREE.CanvasTexture) {
            scene.background.needsUpdate = true;
          }
        }

        cur.displayParams = stepSmoothedParams(cur.displayParams, cur.params);
        const displayParams = cur.displayParams;

        if (shaderMaterial.uniforms) {
          shaderMaterial.uniforms.uTime.value = cur.animTime;
          shaderMaterial.uniforms.uScale.value = displayParams.scale;
          shaderMaterial.uniforms.uAmplitude.value = displayParams.amplitude;
          shaderMaterial.uniforms.uFrequency.value = displayParams.frequency;
          shaderMaterial.uniforms.uSeed.value = displayParams.seed;
          shaderMaterial.uniforms.uBlend.value = displayParams.blend;

          const colorValues = cur.colors.map(
            (c) => new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255),
          );
          while (colorValues.length < 8)
            colorValues.push(new THREE.Color(0, 0, 0));
          shaderMaterial.uniforms.uColors.value = colorValues;
          shaderMaterial.uniforms.uColorCount.value = Math.max(
            2,
            cur.colors.length,
          );
        }

        // Smooth camera rotation based on mouse drag input
        cameraRotationRef.current.x +=
          (targetRotX - cameraRotationRef.current.x) * 0.1;
        cameraRotationRef.current.y +=
          (targetRotY - cameraRotationRef.current.y) * 0.1;

        const rotX = cameraRotationRef.current.x;
        const rotY = cameraRotationRef.current.y;

        if (cameraRef.current) {
          cameraRef.current.position.x =
            focusPoint.x + Math.cos(rotY) * Math.cos(rotX) * cameraDistance;
          cameraRef.current.position.y =
            focusPoint.y + Math.sin(rotX) * cameraDistance + 8;
          cameraRef.current.position.z =
            focusPoint.z + Math.sin(rotY) * Math.cos(rotX) * cameraDistance;
          cameraRef.current.lookAt(focusPoint);
        }

        if (cameraRef.current && dofPassRef.current) {
          const focusBaseDistance =
            cameraRef.current.position.distanceTo(focusPoint);
          const focusOffset = mapRange(
            displayParams.focusDistance,
            MIN_UI_FOCUS_DISTANCE,
            MAX_UI_FOCUS_DISTANCE,
            -12,
            18,
          );
          syncDofPass(
            dofPassRef.current,
            cameraRef.current,
            displayParams,
            focusBaseDistance + focusOffset,
          );
        }

        composer.render();
      };

      renderLoop(0);

      return () => {
        window.removeEventListener("resize", resize);
        renderer.domElement.removeEventListener("mousedown", onMouseDown);
        renderer.domElement.removeEventListener("mouseup", onMouseUp);
        renderer.domElement.removeEventListener("mousemove", onMouseMove);
        renderer.domElement.removeEventListener("click", onMouseClick);
        renderer.domElement.removeEventListener("wheel", onMouseWheel);
        renderer.domElement.removeEventListener("touchstart", onTouchStart);
        renderer.domElement.removeEventListener("touchend", onTouchEnd);
        renderer.domElement.removeEventListener("touchmove", onTouchMove);
        cancelAnimationFrame(rafId);
        container.removeChild(renderer.domElement);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        renderer.dispose();
        if (composerRef.current) {
          composerRef.current.dispose();
          composerRef.current = null;
        }
        if (dofPassRef.current) {
          dofPassRef.current.dispose();
          dofPassRef.current = null;
        }
        rendererRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        meshRef.current = null;
      };
    }, [externalTime, onStatusChange, renderScale]);

    return <div ref={containerRef} className="threejs-container" />;
  },
);

export default ThreeJSCanvas;
