import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, MagnifyingGlass, Heart, Sparkle, Lightning, Leaf, Moon, Sun, Scroll, Flame, Palette as PaletteIcon, ThermometerHot, Snowflake } from '@phosphor-icons/react';
import { PALETTES, PaletteTag } from '../data/palettes';

interface PaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (colors: string[]) => void;
}

const CATEGORIES: { id: 'All' | PaletteTag; label: string; Icon: any }[] = [
  { id: 'All', label: 'All', Icon: Sparkle },
  { id: 'Neon', label: 'Neon', Icon: Lightning },
  { id: 'Nature', label: 'Nature', Icon: Leaf },
  { id: 'Dark', label: 'Dark', Icon: Moon },
  { id: 'Pastel', label: 'Pastel', Icon: Sun },
  { id: 'Historical', label: 'Historical', Icon: Scroll },
  { id: 'Vibrant', label: 'Vibrant', Icon: Flame },
  { id: 'Monochrome', label: 'Monochrome', Icon: PaletteIcon },
  { id: 'Warm', label: 'Warm', Icon: ThermometerHot },
  { id: 'Cool', label: 'Cool', Icon: Snowflake },
];

export default function PaletteModal({ isOpen, onClose, onSelect }: PaletteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | PaletteTag>('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Load favorites from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('liquid-favorites');
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse favorites', e);
    }
  }, []);

  // Save favorites to local storage
  useEffect(() => {
    localStorage.setItem('liquid-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleSelect = (colors: string[]) => {
    onSelect(colors);
    onClose();
  };

  const handleSurprise = () => {
    const random = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    handleSelect(random.colors);
  };

  const filteredPalettes = useMemo(() => {
    return PALETTES.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || p.tags.includes(activeCategory as PaletteTag);
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const favoritePalettes = useMemo(() => {
    return filteredPalettes.filter(p => favorites.includes(p.name));
  }, [filteredPalettes, favorites]);

  const nonFavoritePalettes = useMemo(() => {
    return filteredPalettes.filter(p => !favorites.includes(p.name));
  }, [filteredPalettes, favorites]);

  if (!isOpen) return null;

  return createPortal(
    <div className="palette-modal-overlay" onClick={onClose}>
      <div className="palette-modal" onClick={e => e.stopPropagation()}>
        
        <div className="modal-header">
          <div className="header-title-group">
            <h2>Liquid Gradient</h2>
            <p className="header-subtitle">Pick a vibe or create your own</p>
          </div>
          <div className="modal-actions">
            <button className="surprise-btn" onClick={handleSurprise} title="Surprise Me">
              <Sparkle size={16} weight="bold" />
              Surprise Me
            </button>
            <button className="close-btn" onClick={onClose}>
              <X size={20} weight="bold" />
            </button>
          </div>
        </div>

        <div className="modal-search-wrapper">
          <div className="modal-search">
            <MagnifyingGlass size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search 60+ palettes..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>

        <div className="modal-categories">
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button 
              key={id}
              className={`category-chip ${activeCategory === id ? 'active' : ''}`}
              onClick={() => setActiveCategory(id)}
            >
              <Icon size={14} weight={activeCategory === id ? 'fill' : 'bold'} />
              {label}
            </button>
          ))}
        </div>

        <div className="modal-content">
          <div className="results-info">
            <span className="results-label">
              {searchQuery ? 'SEARCH RESULTS' : 'LIBRARY'}
            </span>
            <span className="results-count">{filteredPalettes.length} total</span>
          </div>

          <div className="palette-grid">
            {/* Favorites first if not searching or if explicitly found */}
            {favoritePalettes.map(p => (
              <div 
                key={p.name} 
                className="palette-card"
                onClick={() => handleSelect(p.colors)}
              >
                <div className="card-preview" style={{ background: `linear-gradient(135deg, ${p.colors.join(', ')})` }}>
                  <button 
                    className="fav-btn active"
                    onClick={(e) => toggleFavorite(e, p.name)}
                  >
                    <Heart size={18} weight="fill" />
                  </button>
                </div>
                <div className="card-info">
                  <span className="card-name">{p.name}</span>
                  <div className="card-dots">
                    {p.colors.slice(0, 4).map((c, i) => (
                      <div key={i} className="color-dot" style={{ background: c }} />
                    ))}
                    {p.colors.length > 4 && <span className="dot-plus">+{p.colors.length - 4}</span>}
                  </div>
                </div>
              </div>
            ))}

            {nonFavoritePalettes.map(p => (
              <div 
                key={p.name} 
                className="palette-card"
                onClick={() => handleSelect(p.colors)}
              >
                <div className="card-preview" style={{ background: `linear-gradient(135deg, ${p.colors.join(', ')})` }}>
                  <button 
                    className="fav-btn"
                    onClick={(e) => toggleFavorite(e, p.name)}
                  >
                    <Heart size={18} weight="bold" />
                  </button>
                </div>
                <div className="card-info">
                  <span className="card-name">{p.name}</span>
                  <div className="card-dots">
                    {p.colors.slice(0, 4).map((c, i) => (
                      <div key={i} className="color-dot" style={{ background: c }} />
                    ))}
                    {p.colors.length > 4 && <span className="dot-plus">+{p.colors.length - 4}</span>}
                  </div>
                </div>
              </div>
            ))}
            
            {filteredPalettes.length === 0 && (
              <div className="empty-state">No palettes found matching your criteria.</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
