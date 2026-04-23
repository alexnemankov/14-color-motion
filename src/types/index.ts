export type AnimationType =
  | "liquid"
  | "waves"
  | "voronoi"
  | "turing"
  | "particles"
  | "blobs"
  | "three"
  | "topographic"
  | "neondrip"
  | "clouds"
  | "sea"
  | "prism"
  | "octagrams"
  | "metaballs";

export interface GradientParams {
  seed: number;
  speed: number;
  scale: number;
  amplitude: number;
  frequency: number;
  definition: number;
  blend: number;
  morphSpeed: number;
  morphAmount: number;
  focusDistance: number;
  aperture: number;
  maxBlur: number;
  dofEnabled: boolean;
  topoLineWidth: number;
  cloudType: number;
  godRays: boolean;
  octagramType: number;
  octagramAltitude: number;
  octagramDensity: number;
  octagramTrails: boolean;
  octagramColorCycle: boolean;
}

export type ColorRgb = [number, number, number];

export interface SceneState {
  animationType: AnimationType;
  params: GradientParams;
  colors: ColorRgb[];
}

export interface SavedPreset extends SceneState {
  id: string;
  name: string;
  createdAt: string;
}

export interface RecentScene extends SceneState {
  id: string;
  name: string;
  seenAt: string;
  source: "preset" | "shared" | "live";
}

export interface RendererStatus {
  title: string;
  message: string;
}

export interface WorkflowLocks {
  mode: boolean;
  palette: boolean;
  seed: boolean;
  motion: boolean;
}
