import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import TuringWebGLCanvas from './TuringWebGLCanvas';
import TuringWebGPUCanvas from './TuringWebGPUCanvas';
import { RendererHandle, RendererProps } from './rendererTypes';

const TuringCanvas = forwardRef<RendererHandle, RendererProps>(function TuringCanvas(props, ref) {
  const prefersWebGPU = useMemo(() => Boolean((navigator as Navigator & { gpu?: unknown }).gpu), []);
  const [useWebGPU, setUseWebGPU] = useState(prefersWebGPU);
  const innerRef = useRef<RendererHandle | null>(null);

  useImperativeHandle(ref, () => ({
    get status() {
      return innerRef.current?.status ?? null;
    },
    get supportsExternalTime() {
      return innerRef.current?.supportsExternalTime ?? false;
    },
    get supportsLoopSafeExport() {
      return innerRef.current?.supportsLoopSafeExport ?? false;
    },
    getCanvas: () => innerRef.current?.getCanvas() ?? null,
    captureFrame: () => innerRef.current?.captureFrame() ?? null,
  }), []);

  if (useWebGPU) {
    return (
      <TuringWebGPUCanvas
        {...props}
        ref={innerRef}
        onReady={() => props.onStatusChange?.(null)}
        onFallback={() => setUseWebGPU(false)}
      />
    );
  }

  return <TuringWebGLCanvas {...props} ref={innerRef} />;
});

export default TuringCanvas;
