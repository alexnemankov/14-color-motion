import { useMemo, useState } from 'react';
import { GradientParams, ColorRgb, RendererStatus } from '../App';
import TuringWebGLCanvas from './TuringWebGLCanvas';
import TuringWebGPUCanvas from './TuringWebGPUCanvas';

interface CanvasProps {
  params: GradientParams;
  colors: ColorRgb[];
  paused: boolean;
  onStatusChange?: (status: RendererStatus | null) => void;
  renderScale?: number;
}

export default function TuringCanvas(props: CanvasProps) {
  const prefersWebGPU = useMemo(() => Boolean((navigator as Navigator & { gpu?: unknown }).gpu), []);
  const [useWebGPU, setUseWebGPU] = useState(prefersWebGPU);

  if (useWebGPU) {
    return (
      <TuringWebGPUCanvas
        {...props}
        onReady={() => props.onStatusChange?.(null)}
        onFallback={() => setUseWebGPU(false)}
      />
    );
  }

  return <TuringWebGLCanvas {...props} />;
}
