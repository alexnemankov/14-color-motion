import type { Icon } from '@phosphor-icons/react';
import type { AnimationType, ColorRgb, GradientParams } from '../types';
import {
  Atom, Boat, Cloud, Cube, Diamond, Drop, Flame, Gradient,
  Hexagon, Octagon, ShareNetwork, Waves, CirclesFourIcon, ChartLineIcon,
} from '@phosphor-icons/react';

export interface ModePreset {
  name: string;
  sub?: string;
  colors: ColorRgb[];
  params?: Partial<GradientParams>;
}

export interface ModeDefinition {
  label: string;
  name: string;
  description: string;
  icon: Icon;
  supportsExternalTime: boolean;
  supportsLoopSafeExport: boolean;
  entryColors?: ColorRgb[];
  paramLabels: Partial<Record<keyof GradientParams, string>>;
  presetsLabel?: string;
  presetsDescription?: string;
  presets?: ModePreset[];
}

export const MODES: Record<AnimationType, ModeDefinition> = {
  liquid: {
    label: "Fluid",
    name: "Fluid FBM",
    description: "Organic flow with soft warped noise.",
    icon: Drop,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Seed", speed: "Speed", scale: "Scale",
      amplitude: "Amplitude", frequency: "Frequency", definition: "Definition", blend: "Blend",
    },
  },
  waves: {
    label: "Waves",
    name: "Interference Waves",
    description: "Layered wave bands with shifting interference.",
    icon: Waves,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Seed", speed: "Phase Speed", scale: "Zoom",
      amplitude: "Phase Velocity", frequency: "Base Freq", definition: "Sources", blend: "Sharpness",
    },
  },
  voronoi: {
    label: "Voronoi",
    name: "Cellular Voronoi",
    description: "Drifting cells that break into crisp structures.",
    icon: Hexagon,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Seed", speed: "Global Speed", scale: "Zoom",
      amplitude: "Drift Rate", frequency: "Cell Density", definition: "Morph", blend: "Contrast",
    },
  },
  turing: {
    label: "Turing",
    name: "Reaction-Diffusion",
    description: "Living spots and stripes from reaction-diffusion.",
    icon: Atom,
    supportsExternalTime: false,
    supportsLoopSafeExport: false,
    paramLabels: {
      seed: "Reset Sim", speed: "Sim Speed", scale: "Zoom",
      amplitude: "Feed Factor", frequency: "Kill Factor", definition: "Diffusion", blend: "Contrast",
    },
  },
  particles: {
    label: "Particles",
    name: "Particle Web",
    description: "Moving nodes that form a reactive network.",
    icon: ShareNetwork,
    supportsExternalTime: false,
    supportsLoopSafeExport: false,
    paramLabels: {
      seed: "Reseed", speed: "Velocity", scale: "Zoom",
      amplitude: "Link Dist", frequency: "Wander Freq", definition: "Count", blend: "Opacity",
    },
  },
  blobs: {
    label: "Blobs",
    name: "Molten Blobs",
    description: "Soft overlapping masses with molten depth.",
    icon: Gradient,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Flux Seed", speed: "Flow Speed", scale: "Blob InvScale",
      amplitude: "Wander Amp", frequency: "Blob Count", definition: "Sharpness", blend: "Color Blend",
    },
  },
  three: {
    label: "3D Mesh",
    name: "3D Mesh",
    description: "Volumetric 3D surface with soft camera orbit and shader palette.",
    icon: Cube,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Seed", speed: "Orbit Speed", scale: "Mesh Scale",
      amplitude: "Height Amp", frequency: "Noise Freq", definition: "Detail", blend: "Blend Edge",
      morphSpeed: "Shift Speed", morphAmount: "Shift Height",
      focusDistance: "Focus Dist", aperture: "Aperture", maxBlur: "Max Blur",
    },
  },
  topographic: {
    label: "Topo",
    name: "Topographic",
    description: "Animated contour lines from a flowing noise field.",
    icon: ChartLineIcon,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Seed", speed: "Anim Speed", scale: "Cell Size",
      amplitude: "Detail", frequency: "Noise Density", definition: "Contour Count",
      blend: "Line Opacity", topoLineWidth: "Line Width",
    },
  },
  neondrip: {
    label: "Neon Drip",
    name: "Neon Drip",
    description: "Metaball blobs rising upward through neon-lit liquid.",
    icon: Flame,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    paramLabels: {
      seed: "Seed", speed: "Drip Speed", scale: "Zoom",
      amplitude: "Wobble", frequency: "Tendrils", definition: "Blob Count", blend: "Glow",
    },
  },
  clouds: {
    label: "Clouds",
    name: "Clouds",
    description: "Volumetric ray-marched sky with five switchable cloud types.",
    icon: Cloud,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    entryColors: [[100, 168, 210], [245, 240, 232], [255, 195, 100], [160, 172, 185]],
    paramLabels: {
      seed: "Seed", speed: "Drift Speed", scale: "Coverage",
      amplitude: "Detail Amp", frequency: "Frequency", definition: "Octaves", blend: "Shadow Soft",
    },
    presetsLabel: "Sky Mood",
    presetsDescription: "Load a palette tuned for this lighting condition.",
    presets: [
      { name: "Noon",  sub: "clear blue sky",   colors: [[100,168,210],[245,240,232],[255,195,100],[160,172,185]] },
      { name: "Dusk",  sub: "golden hour",       colors: [[80,100,160],[255,200,160],[255,110,50],[55,45,80]] },
      { name: "Dawn",  sub: "soft morning glow", colors: [[230,140,110],[255,225,205],[255,190,130],[170,105,90]] },
      { name: "Storm", sub: "overcast, heavy",   colors: [[55,65,78],[110,118,128],[90,105,115],[35,40,48]] },
    ],
  },
  sea: {
    label: "Sea",
    name: "Sea",
    description: "Procedural height-field ocean with realistic wave shading.",
    icon: Boat,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    entryColors: [[0, 23, 46], [122, 138, 92], [100, 168, 210], [255, 195, 100]],
    paramLabels: {
      seed: "Seed", speed: "Wave Speed", scale: "Scale",
      amplitude: "Wave Height", frequency: "Frequency", definition: "Wave Detail", blend: "Choppiness",
    },
    presetsLabel: "Sea Mood",
    presetsDescription: "Load a palette tuned for this lighting condition.",
    presets: [
      { name: "Midday",  sub: "bright tropical",        colors: [[0,23,46],[122,138,92],[100,168,210],[255,195,100]] },
      { name: "Sunset",  sub: "violet sky, copper sea", colors: [[8,10,35],[180,90,30],[52,28,90],[255,115,25]] },
      { name: "Tropic",  sub: "clear shallow water",    colors: [[0,45,65],[80,190,160],[75,170,220],[255,230,120]] },
      { name: "Storm",   sub: "overcast, rough",        colors: [[15,22,32],[55,68,75],[50,60,75],[90,105,120]] },
    ],
  },
  prism: {
    label: "Prism",
    name: "Prism",
    description: "UV-displacement light prism with chromatic RGB channel separation.",
    icon: Diamond,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    entryColors: [[255, 30, 30], [30, 255, 30], [30, 30, 255], [0, 0, 0]],
    paramLabels: {
      seed: "Seed", speed: "Speed", scale: "UV Scale",
      amplitude: "Warp Strength", frequency: "Ripple Freq", definition: "Chroma Spread", blend: "Saturation",
    },
    presetsLabel: "Prism Mood",
    presetsDescription: "Load a color harmony for this light-dispersion aesthetic.",
    presets: [
      { name: "Spectral", sub: "pure RGB prism",     colors: [[255,30,30],[30,255,30],[30,30,255],[0,0,0]] },
      { name: "Neon",     sub: "cyberpunk glow",     colors: [[255,0,110],[0,230,255],[80,255,120],[15,0,30]] },
      { name: "Plasma",   sub: "fire & electric",    colors: [[255,100,0],[255,0,200],[0,80,255],[5,0,15]] },
      { name: "Void",     sub: "gold & ultraviolet", colors: [[255,180,30],[180,0,255],[220,220,255],[5,0,20]] },
    ],
  },
  octagrams: {
    label: "Octagrams",
    name: "Octagrams",
    description: "Ray-marched tiled star fields with chromatic glow and shape variants.",
    icon: Octagon,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    entryColors: [[30, 200, 255], [180, 0, 255], [255, 200, 50], [5, 0, 20]],
    paramLabels: {
      seed: "Seed", speed: "Speed", scale: "Perspective",
      amplitude: "Oscillation", frequency: "Spin Speed", definition: "March Quality", blend: "Glow",
      octagramAltitude: "Altitude", octagramDensity: "Tile Scale",
    },
    presetsLabel: "Octagram Presets",
    presetsDescription: "Load a shape and color combination for this star-field aesthetic.",
    presets: [
      { name: "Orbital", sub: "cosmic, classic",  params: { octagramType: 0 }, colors: [[30,200,255],[180,0,255],[255,200,50],[5,0,20]] },
      { name: "Inferno", sub: "8-arm star, fire", params: { octagramType: 1 }, colors: [[255,30,0],[255,120,0],[255,255,100],[20,5,0]] },
      { name: "Quantum", sub: "compact portal",   params: { octagramType: 2 }, colors: [[0,255,180],[0,120,255],[180,0,255],[0,5,20]] },
      { name: "Ghost",   sub: "crystal, no pulse", params: { octagramType: 3 }, colors: [[220,230,255],[140,160,200],[60,80,120],[5,8,15]] },
    ],
  },
  metaballs: {
    label: "Metaballs",
    name: "Raymarched Metaballs",
    description: "Organic blobs sculpted from smooth-union sphere fields.",
    icon: CirclesFourIcon,
    supportsExternalTime: true,
    supportsLoopSafeExport: true,
    entryColors: [[180, 0, 255], [0, 200, 255], [255, 255, 255], [5, 0, 20]],
    paramLabels: {
      seed: "Seed", speed: "Speed", scale: "View Zoom",
      amplitude: "Blob Spread", frequency: "Motion Rate", definition: "Merge Radius", blend: "Specular",
    },
    presetsLabel: "Metaball Presets",
    presetsDescription: "Load a color scheme for these organic blobs.",
    presets: [
      { name: "Plasma", sub: "magenta, cyan",   colors: [[180,0,255],[0,200,255],[255,255,255],[5,0,20]] },
      { name: "Magma",  sub: "red, orange",      colors: [[200,30,0],[255,100,0],[255,240,100],[15,5,0]] },
      { name: "Abyss",  sub: "deep blue, teal",  colors: [[0,20,100],[60,0,180],[0,220,200],[0,0,10]] },
      { name: "Pearl",  sub: "warm ivory, gold", colors: [[180,130,80],[230,190,130],[255,250,220],[20,15,35]] },
    ],
  },
};
