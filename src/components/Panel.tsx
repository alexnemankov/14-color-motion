import React, { useState, useEffect } from 'react';
import { GradientParams, ColorRgb } from '../App';

interface PanelProps {
  params: GradientParams;
  setParams: React.Dispatch<React.SetStateAction<GradientParams>>;
  colors: ColorRgb[];
  setColors: React.Dispatch<React.SetStateAction<ColorRgb[]>>;
  paused: boolean;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
  fullscreen: boolean;
  toggleFullscreen: () => void;
  hideUI: () => void;
}

const hexToRgb = (hex: string): ColorRgb => {
  hex = hex.replace('#', '');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
};

const ColorRow = ({ 
  rgb, 
  update, 
  remove 
}: { 
  rgb: ColorRgb, 
  update: (hex: string) => void, 
  remove: () => void 
}) => {
  const [localHex, setLocalHex] = useState(rgbToHex(rgb[0], rgb[1], rgb[2]));
  const fullHexStr = `#${rgbToHex(rgb[0], rgb[1], rgb[2])}`;
  
  // Sync if prop changes externally (like from color picker)
  useEffect(() => {
    setLocalHex(rgbToHex(rgb[0], rgb[1], rgb[2]));
  }, [rgb[0], rgb[1], rgb[2]]);

  return (
    <div className="color-row">
      <div className="color-swatch" style={{ background: fullHexStr }}>
        <input 
          type="color" 
          value={fullHexStr} 
          onChange={e => update(e.target.value)} 
          className="color-picker" 
        />
      </div>
      <input 
        className="color-hex" 
        type="text" 
        value={localHex} 
        maxLength={6} 
        onChange={e => {
          setLocalHex(e.target.value);
          if (/^[0-9a-fA-F]{6}$/.test(e.target.value)) {
            update(`#${e.target.value}`);
          }
        }}
        onBlur={() => setLocalHex(rgbToHex(rgb[0], rgb[1], rgb[2]))} // reset on blur if invalid
      />
      <button className="btn-remove" onClick={remove} title="Remove">×</button>
    </div>
  );
};

export default function Panel({
  params,
  setParams,
  colors,
  setColors,
  paused,
  setPaused,
  fullscreen,
  toggleFullscreen,
  hideUI
}: PanelProps) {
  
  const updateParam = (name: keyof GradientParams, value: number) => {
    setParams(prev => ({ ...prev, [name]: isNaN(value) ? 0 : value }));
  };

  const stepParam = (name: keyof GradientParams, delta: number) => {
    setParams(prev => {
      const nv = Math.round((prev[name] + delta) * 1000) / 1000;
      return { ...prev, [name]: nv };
    });
  };

  const updateColor = (index: number, hex: string) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setColors(prev => {
        const newColors = [...prev];
        newColors[index] = hexToRgb(hex);
        return newColors;
      });
    }
  };

  const removeColor = (index: number) => {
    if (colors.length > 2) {
      setColors(prev => prev.filter((_, i) => i !== index));
    }
  };

  const addColor = () => {
    if (colors.length < 8) {
      setColors(prev => [...prev, [Math.random()*255|0, Math.random()*255|0, Math.random()*255|0] as ColorRgb]);
    }
  };

  return (
    <>
      <div id="color-list">
        {colors.map((rgb, i) => (
          <ColorRow 
            key={i} 
            rgb={rgb} 
            update={(hex) => updateColor(i, hex)} 
            remove={() => removeColor(i)} 
          />
        ))}
      </div>

      <div className="add-color-row">
        <button className="add-color-btn" onClick={addColor}>+</button>
        <span className="add-color-label">Add color…</span>
      </div>

      <div className="param-row">
        <span className="param-label">Seed</span>
        <input className="param-input" type="number" value={params.seed} onChange={e => updateParam('seed', +e.target.value)} />
        <input className="param-slider" type="range" min="0" max="9999" step="1" value={params.seed} onChange={e => updateParam('seed', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">Speed</span>
        <input className="param-input" type="number" value={params.speed} step="0.1" onChange={e => updateParam('speed', +e.target.value)} />
        <div className="stepper">
          <button onClick={() => stepParam('speed', 0.1)}>▲</button>
          <button onClick={() => stepParam('speed', -0.1)}>▼</button>
        </div>
        <input className="param-slider" type="range" min="0" max="10" step="0.1" value={params.speed} onChange={e => updateParam('speed', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">Scale</span>
        <input className="param-input" type="number" value={params.scale} step="0.01" onChange={e => updateParam('scale', +e.target.value)} />
        <input className="param-slider" type="range" min="0.01" max="2" step="0.01" value={params.scale} onChange={e => updateParam('scale', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">Amplitude</span>
        <input className="param-input" type="number" value={params.amplitude} step="0.01" onChange={e => updateParam('amplitude', +e.target.value)} />
        <input className="param-slider" type="range" min="0" max="2" step="0.01" value={params.amplitude} onChange={e => updateParam('amplitude', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">Frequency</span>
        <input className="param-input" type="number" value={params.frequency} step="0.01" onChange={e => updateParam('frequency', +e.target.value)} />
        <input className="param-slider" type="range" min="0.01" max="4" step="0.01" value={params.frequency} onChange={e => updateParam('frequency', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">Definition</span>
        <input className="param-input" type="number" value={params.definition} step="1" onChange={e => updateParam('definition', +e.target.value)} />
        <div className="stepper">
          <button onClick={() => stepParam('definition', 1)}>▲</button>
          <button onClick={() => stepParam('definition', -1)}>▼</button>
        </div>
        <input className="param-slider" type="range" min="1" max="12" step="1" value={params.definition} onChange={e => updateParam('definition', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">Bands</span>
        <input className="param-input" type="number" value={params.bands} step="1" onChange={e => updateParam('bands', +e.target.value)} />
        <input className="param-slider" type="range" min="1" max="16" step="1" value={params.bands} onChange={e => updateParam('bands', +e.target.value)} />
      </div>

      <div className="bottom-controls">
        <button className={`ctrl-btn ${paused ? 'active' : ''}`} onClick={() => setPaused(p => !p)}>
          {paused ? '▶ Play' : '⏸ Pause'}
        </button>
        <button className={`ctrl-btn ${fullscreen ? 'active' : ''}`} onClick={toggleFullscreen}>
          ⛶ Full
        </button>
        <button className="ctrl-btn" onClick={hideUI}>
          ✕ Hide
        </button>
      </div>
    </>
  );
}
