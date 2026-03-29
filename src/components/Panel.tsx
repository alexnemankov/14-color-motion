import React, { useState, useEffect } from 'react';
import { 
  Drop, 
  Waves, 
  Hexagon, 
  Atom, 
  ShareNetwork, 
  Pentagon,
  Circle,
  PlayPause,
  CornersOut,
  EyeSlash,
  Plus,
  Trash,
  Palette
} from '@phosphor-icons/react';
import { GradientParams, ColorRgb, AnimationType } from '../App';
import PaletteModal from './PaletteModal';

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
  if (hex.startsWith('#')) hex = hex.slice(1);
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
          if (val && !val.startsWith('#')) val = '#' + val;
          if (!val) val = '#';
          setLocalHex(val.toUpperCase());
          if (/^#[0-9a-fA-F]{6}$/.test(val)) update(val);
        }}
        onBlur={() => setLocalHex(`#${rgbToHex(rgb[0], rgb[1], rgb[2])}`)}
      />
      {showRemove && (
        <button className="btn-remove" onClick={remove} title="Remove Color">
          <Trash size={14} weight="bold" />
        </button>
      )}
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
  
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    },
    turing: {
      seed: 'Reset Sim', speed: 'Sim Speed', scale: 'Zoom', amplitude: 'Feed Factor', frequency: 'Kill Factor', definition: 'Diffusion', blend: 'Contrast'
    },
    particles: {
      seed: 'Reseed', speed: 'Velocity', scale: 'Zoom', amplitude: 'Link Dist', frequency: 'Wander Freq', definition: 'Count', blend: 'Opacity'
    },
    geometry: {
      seed: 'Twist/Rot', speed: 'Draw Speed', scale: 'Size', amplitude: 'Morph Amp', frequency: 'Radius Offset', definition: 'Complexity', blend: 'Smoothness'
    },
    blobs: {
      seed: 'Flux Seed', speed: 'Flow Speed', scale: 'Blob InvScale', amplitude: 'Wander Amp', frequency: 'Blob Count', definition: 'Sharpness', blend: 'Color Blend'
    }
  }[animationType] || { seed: 'Seed', speed: 'Speed', scale: 'Scale', amplitude: 'Amplitude', frequency: 'Frequency', definition: 'Definition', blend: 'Blend' };

  return (
    <>
      <div className="mode-switcher">
        <button className={`mode-btn ${animationType === 'liquid' ? 'active' : ''}`} onClick={() => setAnimationType('liquid')} title="Fluid FBM">
          <Drop size={16} weight={animationType === 'liquid' ? 'fill' : 'bold'} />
        </button>
        <button className={`mode-btn ${animationType === 'waves' ? 'active' : ''}`} onClick={() => setAnimationType('waves')} title="Interference Waves">
          <Waves size={16} weight={animationType === 'waves' ? 'fill' : 'bold'} />
        </button>
        <button className={`mode-btn ${animationType === 'voronoi' ? 'active' : ''}`} onClick={() => setAnimationType('voronoi')} title="Cellular Voronoi">
          <Hexagon size={16} weight={animationType === 'voronoi' ? 'fill' : 'bold'} />
        </button>
        <button className={`mode-btn ${animationType === 'turing' ? 'active' : ''}`} onClick={() => setAnimationType('turing')} title="Reaction-Diffusion">
          <Atom size={16} weight={animationType === 'turing' ? 'fill' : 'bold'} />
        </button>
        <button className={`mode-btn ${animationType === 'particles' ? 'active' : ''}`} onClick={() => setAnimationType('particles')} title="Particle Web">
          <ShareNetwork size={16} weight={animationType === 'particles' ? 'fill' : 'bold'} />
        </button>
        <button className={`mode-btn ${animationType === 'geometry' ? 'active' : ''}`} onClick={() => setAnimationType('geometry')} title="Spirograph">
          <Pentagon size={16} weight={animationType === 'geometry' ? 'fill' : 'bold'} />
        </button>
        <button className={`mode-btn ${animationType === 'blobs' ? 'active' : ''}`} onClick={() => setAnimationType('blobs')} title="Molten Blobs">
          <Circle size={16} weight={animationType === 'blobs' ? 'fill' : 'bold'} />
        </button>
      </div>

      <div className="presets-section">
        <button className="open-library-btn" onClick={() => setIsModalOpen(true)}>
          <Palette size={16} weight="bold" />
          <div className="library-btn-text">
            <span>Palette Library</span>
            <small>60+ Curated Presets</small>
          </div>
        </button>
      </div>

      <PaletteModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSelect={(newColors) => {
          setColors(newColors.map(hexToRgb));
        }}
      />

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
        <button className="add-color-btn" onClick={addColor} title="Add Color">
          <Plus size={16} weight="bold" />
        </button>
        <span className="add-color-label">Add color...</span>
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
        <button 
          className={`ctrl-btn ${paused ? 'active' : ''}`} 
          onClick={() => setPaused(!paused)}
          title={paused ? 'Resume' : 'Pause'}
        >
          <PlayPause size={14} weight="bold" />
          {paused ? 'PLAY' : 'PAUSE'}
        </button>
        <button 
          className={`ctrl-btn ${fullscreen ? 'active' : ''}`} 
          onClick={toggleFullscreen}
          title="Fullscreen"
        >
          <CornersOut size={14} weight="bold" />
          FULL
        </button>
        <button className="ctrl-btn" onClick={hideUI} title="Hide UI (H)">
          <EyeSlash size={14} weight="bold" />
          HIDE
        </button>
      </div>
    </>
  );
}
