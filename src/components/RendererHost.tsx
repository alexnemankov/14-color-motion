import { forwardRef } from 'react';
import type { AnimationType, GradientParams, ColorRgb, RendererStatus } from '../types';
import type { RendererHandle } from './rendererTypes';
import LiquidCanvas from './LiquidCanvas';
import WavesCanvas from './WavesCanvas';
import VoronoiCanvas from './VoronoiCanvas';
import TuringCanvas from './TuringCanvas';
import ParticlesCanvas from './ParticlesCanvas';
import BlobsCanvas from './BlobsCanvas';
import ThreeJSCanvas from './ThreeJSCanvas';
import TopographicCanvas from './TopographicCanvas';
import NeonDripCanvas from './NeonDripCanvas';
import CloudsCanvas from './CloudsCanvas';
import SeaCanvas from './SeaCanvas';
import PrismCanvas from './PrismCanvas';
import OctagramsCanvas from './OctagramsCanvas';
import MetaballCanvas from './MetaballCanvas';
import PhantomStarCanvas from './PhantomStarCanvas';

interface RendererHostProps {
  animationType: AnimationType;
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
  onStatusChange?: (status: RendererStatus | null) => void;
  renderScale?: number;
  externalTime?: number | null;
}

const RendererHost = forwardRef<RendererHandle, RendererHostProps>(
  function RendererHost({ animationType, params, colors, paused, onStatusChange, renderScale = 1, externalTime = null }, ref) {
    const common = { ref, params, colors, paused, onStatusChange, renderScale };
    const withTime = { ...common, externalTime };

    switch (animationType) {
      case "liquid":      return <LiquidCanvas      {...withTime} />;
      case "waves":       return <WavesCanvas        {...withTime} />;
      case "voronoi":     return <VoronoiCanvas       {...withTime} />;
      case "blobs":       return <BlobsCanvas         {...withTime} />;
      case "three":       return <ThreeJSCanvas       {...withTime} />;
      case "topographic": return <TopographicCanvas   {...withTime} />;
      case "neondrip":    return <NeonDripCanvas      {...withTime} />;
      case "clouds":      return <CloudsCanvas        {...withTime} />;
      case "sea":         return <SeaCanvas           {...withTime} />;
      case "prism":       return <PrismCanvas         {...withTime} />;
      case "octagrams":   return <OctagramsCanvas     {...withTime} />;
      case "metaballs":   return <MetaballCanvas      {...withTime} />;
      case "phantomstar": return <PhantomStarCanvas   {...withTime} />;
      case "turing":      return <TuringCanvas        {...common} />;
      case "particles":   return <ParticlesCanvas     {...common} />;
    }
  }
);

export default RendererHost;
