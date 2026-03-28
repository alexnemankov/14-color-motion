import React, { useState, useEffect } from 'react';
import { GradientParams, ColorRgb, AnimationType } from '../App';

interface PanelProps {
  params: GradientParams;
  setParams: React.Dispatch<React.SetStateAction<GradientParams>>;
  colors: ColorRgb[];
  setColors: React.Dispatch<React.SetStateAction<ColorRgb[]>>;
  paused: boolean;
  setPaused: React.Dispatch<React.SetStateAction<boolean>>;
  animationType: AnimationType;
  setAnimationType: React.Dispatch<React.SetStateAction<AnimationType>>;
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
  remove,
  showRemove
}: { 
  rgb: ColorRgb, 
  update: (hex: string) => void, 
  remove: () => void,
  showRemove: boolean
}) => {
  const [localHex, setLocalHex] = useState(`#${rgbToHex(rgb[0], rgb[1], rgb[2])}`);
  const fullHexStr = `#${rgbToHex(rgb[0], rgb[1], rgb[2])}`;
  
  // Sync if prop changes externally (like from color picker)
  useEffect(() => {
    setLocalHex(`#${rgbToHex(rgb[0], rgb[1], rgb[2])}`);
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
        maxLength={7} 
        onChange={e => {
          let val = e.target.value;
          // Ensure it starts with #
          if (val && !val.startsWith('#')) val = '#' + val;
          if (!val) val = '#';
          
          setLocalHex(val.toUpperCase());
          
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            update(val);
          }
        }}
        onBlur={() => setLocalHex(`#${rgbToHex(rgb[0], rgb[1], rgb[2])}`)} // reset on blur if invalid
      />
      {showRemove && <button className="btn-remove" onClick={remove} title="Remove">×</button>}
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
  animationType,
  setAnimationType,
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

  const labels = {
    liquid: {
      seed: 'Seed', speed: 'Speed', scale: 'Scale', amplitude: 'Amplitude', frequency: 'Frequency', definition: 'Definition', blend: 'Blend'
    },
    waves: {
      seed: 'Seed', speed: 'Phase Speed', scale: 'Zoom', amplitude: 'Phase Velocity', frequency: 'Base Freq', definition: 'Sources', blend: 'Sharpness'
    },
    voronoi: {
      seed: 'Seed', speed: 'Global Speed', scale: 'Zoom', amplitude: 'Drift Rate', frequency: 'Cell Density', definition: 'Morph', blend: 'Contrast'
    }
  }[animationType];

  return (
    <>
      <div className="mode-switcher">
        <button className={`mode-btn ${animationType === 'liquid' ? 'active' : ''}`} onClick={() => setAnimationType('liquid')}>Fluid</button>
        <button className={`mode-btn ${animationType === 'waves' ? 'active' : ''}`} onClick={() => setAnimationType('waves')}>Waves</button>
        <button className={`mode-btn ${animationType === 'voronoi' ? 'active' : ''}`} onClick={() => setAnimationType('voronoi')}>Voronoi</button>
      </div>

      <div id="color-list">
        {colors.map((rgb, i) => (
          <ColorRow 
            key={i} 
            rgb={rgb} 
            update={(hex) => updateColor(i, hex)} 
            remove={() => removeColor(i)} 
            showRemove={colors.length > 2}
          />
        ))}
      </div>

      <div className="add-color-row">
        <button className="add-color-btn" onClick={addColor}>+</button>
        <span className="add-color-label">Add color…</span>
      </div>

      <div className="param-row">
        <span className="param-label">{labels.seed}</span>
        <input className="param-input" type="number" value={params.seed} onChange={e => updateParam('seed', +e.target.value)} />
        <input className="param-slider" type="range" min="0" max="9999" step="1" value={params.seed} onChange={e => updateParam('seed', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">{labels.speed}</span>
        <input className="param-input" type="number" value={params.speed} step="0.1" onChange={e => updateParam('speed', +e.target.value)} />
        <div className="stepper">
          <button onClick={() => stepParam('speed', 0.1)}>▲</button>
          <button onClick={() => stepParam('speed', -0.1)}>▼</button>
        </div>
        <input className="param-slider" type="range" min="0" max="10" step="0.1" value={params.speed} onChange={e => updateParam('speed', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">{labels.scale}</span>
        <input className="param-input" type="number" value={params.scale} step="0.01" onChange={e => updateParam('scale', +e.target.value)} />
        <input className="param-slider" type="range" min="0.01" max="2" step="0.01" value={params.scale} onChange={e => updateParam('scale', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">{labels.amplitude}</span>
        <input className="param-input" type="number" value={params.amplitude} step="0.01" onChange={e => updateParam('amplitude', +e.target.value)} />
        <input className="param-slider" type="range" min="0" max="2" step="0.01" value={params.amplitude} onChange={e => updateParam('amplitude', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">{labels.frequency}</span>
        <input className="param-input" type="number" value={params.frequency} step="0.01" onChange={e => updateParam('frequency', +e.target.value)} />
        <input className="param-slider" type="range" min="0.01" max="4" step="0.01" value={params.frequency} onChange={e => updateParam('frequency', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">{labels.definition}</span>
        <input className="param-input" type="number" value={params.definition} step="1" onChange={e => updateParam('definition', +e.target.value)} />
        <div className="stepper">
          <button onClick={() => stepParam('definition', 1)}>▲</button>
          <button onClick={() => stepParam('definition', -1)}>▼</button>
        </div>
        <input className="param-slider" type="range" min="1" max="12" step="1" value={params.definition} onChange={e => updateParam('definition', +e.target.value)} />
      </div>

      <div className="param-row">
        <span className="param-label">{labels.blend}</span>
        <input className="param-input" type="number" value={params.blend} step="0.01" onChange={e => updateParam('blend', +e.target.value)} />
        <input className="param-slider" type="range" min="0" max="1" step="0.01" value={params.blend} onChange={e => updateParam('blend', +e.target.value)} />
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
