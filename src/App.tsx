import { useState, useEffect } from 'react';
import LiquidCanvas from './components/LiquidCanvas';
import Panel from './components/Panel';

export interface GradientParams {
  seed: number;
  speed: number;
  scale: number;
  amplitude: number;
  frequency: number;
  definition: number;
  bands: number;
}

export type ColorRgb = [number, number, number];

const DEFAULT_COLORS: ColorRgb[] = [
  [10, 0, 20],
  [107, 0, 194],
  [255, 45, 107],
  [255, 149, 0],
];

function App() {
  const [params, setParams] = useState<GradientParams>({
    seed: 6484,
    speed: 0.8,
    scale: 0.76,
    amplitude: 0.99,
    frequency: 1.19,
    definition: 2,
    bands: 15
  });

  const [colors, setColors] = useState<ColorRgb[]>(DEFAULT_COLORS);
  const [uiVisible, setUiVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') setUiVisible(v => !v);
      if (e.key.toLowerCase() === 'f') toggleFullscreen();
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(p => !p);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <LiquidCanvas params={params} colors={colors} paused={paused} />
      
      <div id="panel" className={uiVisible ? '' : 'hidden'}>
        <div className="panel-header">
          <span className="panel-title">Liquid Gradient</span>
        </div>
        
        <Panel 
          params={params} 
          setParams={setParams} 
          colors={colors} 
          setColors={setColors} 
          paused={paused}
          setPaused={setPaused}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          hideUI={() => setUiVisible(false)}
        />
      </div>

      <button 
        id="toggle-ui" 
        className={uiVisible ? 'ui-visible' : ''} 
        onClick={() => setUiVisible(true)} 
        title="Show controls"
      >
        ⊞
      </button>

      <div id="hint" className={hintVisible ? '' : 'fade'}>
        Press H to hide UI · F for fullscreen
      </div>
    </>
  );
}

export default App;
