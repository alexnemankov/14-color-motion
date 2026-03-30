import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  X, MagnifyingGlass, Heart, Sparkle, Lightning, Leaf, Moon, Sun, Scroll, Flame, 
  Palette as PaletteIcon, ThermometerHot, Snowflake, Tray, ArrowsClockwise 
} from '@phosphor-icons/react';
import { PALETTES, PaletteTag, PaletteDescriptor } from '../data/palettes';

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
  { id: 'Light', label: 'Light', Icon: Sun },
  { id: 'Monochrome', label: 'Monochrome', Icon: PaletteIcon },
  { id: 'Warm', label: 'Warm', Icon: ThermometerHot },
  { id: 'Cool', label: 'Cool', Icon: Snowflake },
];

export default function PaletteModal({ isOpen, onClose, onSelect }: PaletteModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | PaletteTag>('All');
  const [activePaletteName, setActivePaletteName] = useState<string | null>(null);
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFavorite = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    setFavorites((prev: string[]) => 
      prev.includes(name) ? prev.filter((n: string) => n !== name) : [...prev, name]
    );
  };

  const handleSelect = (p: PaletteDescriptor) => {
    setActivePaletteName(p.name);
    onSelect(p.colors);
    setTimeout(onClose, 250);
  };

  const handleSurprise = () => {
    const random = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: random.colors
    });

    setActivePaletteName(random.name);
    onSelect(random.colors);
    
    // Auto-close immediately
    onClose();
  };

  const filteredPalettes = useMemo(() => {
    return PALETTES.filter((p: PaletteDescriptor) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || p.tags.includes(activeCategory as PaletteTag);
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const activePalette = useMemo(() => {
    return PALETTES.find((p: PaletteDescriptor) => p.name === activePaletteName);
  }, [activePaletteName]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="palette-modal-overlay" 
          onClick={onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="palette-modal" 
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Palette library"
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="modal-header">
          <div className="header-title-group">
            <h2>Liquid Gradient</h2>
            <p className="header-subtitle">Pick a vibe or create your own</p>
          </div>
          <div className="modal-actions">
            <button className="surprise-btn" onClick={handleSurprise} title="Surprise Me" aria-label="Surprise me with a random palette">
              <Sparkle size={16} weight="bold" />
              Surprise Me
            </button>
            <button className="close-btn" onClick={onClose} aria-label="Close palette library">
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
              <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear palette search">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>

        <div className="modal-categories">
          {CATEGORIES.map(({ id, label, Icon }, i) => (
            <motion.button 
              key={id}
              className={`category-chip ${activeCategory === id ? 'active' : ''}`}
              onClick={() => setActiveCategory(id)}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon size={14} weight={activeCategory === id ? 'fill' : 'bold'} />
              {label}
            </motion.button>
          ))}
        </div>

        <div className="modal-content">
          <AnimatePresence mode="popLayout">
            {activePalette && (
              <motion.div 
                key="active-bar"
                className="active-palette-section"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <span className="results-label">ACTIVE SELECTION</span>
                <div 
                  className="active-palette-row"
                  style={{ background: `linear-gradient(to right, ${activePalette.colors.join(', ')})` }}
                >
                  <div className="active-info">
                    <span className="active-name">{activePalette.name}</span>
                    <div className="active-dots">
                      {activePalette.colors.map((c: string, i: number) => (
                        <div key={i} className="color-dot" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="results-info">
              <span className="results-label">
                {searchQuery ? 'SEARCH RESULTS' : 'LIBRARY'}
              </span>
              <span className="results-count">{filteredPalettes.length} total</span>
            </div>

            <motion.div 
              className="palette-grid"
              layout
            >
              <AnimatePresence mode="popLayout">
                {filteredPalettes.length > 0 ? (
                  filteredPalettes.map((p: PaletteDescriptor, i: number) => (
                    <motion.div 
                      key={p.name} 
                      layout
                      layoutId={`card-${p.name}`}
                      className={`palette-card ${activePaletteName === p.name ? 'active' : ''}`}
                      onClick={() => handleSelect(p)}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ 
                        type: 'spring', 
                        damping: 15, 
                        stiffness: 150,
                        delay: Math.min(i * 0.01, 0.2) 
                      }}
                      whileHover={{ y: -5, scale: 1.02 }}
                    >
                      <div className="card-preview" style={{ background: `linear-gradient(135deg, ${p.colors.join(', ')})` }}>
                        <button 
                          className={`fav-btn ${favorites.includes(p.name) ? 'active' : ''}`}
                          onClick={(e) => toggleFavorite(e, p.name)}
                          aria-label={favorites.includes(p.name) ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
                        >
                          <Heart size={18} weight={favorites.includes(p.name) ? 'fill' : 'bold'} />
                        </button>
                      </div>
                      <div className="card-info">
                        <span className="card-name">{p.name}</span>
                        <div className="card-dots">
                          {p.colors.slice(0, 4).map((c: string, i: number) => (
                            <div key={i} className="color-dot" style={{ background: c }} />
                          ))}
                          {p.colors.length > 4 && <span className="dot-plus">+{p.colors.length - 4}</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : searchQuery && (
                  <motion.div 
                    key="empty"
                    className="no-results-state"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Tray size={48} weight="thin" />
                    <h3>No palettes found</h3>
                    <p>Try searching for a different color or vibe.</p>
                    <button className="reset-search-btn" onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>
                      <ArrowsClockwise size={14} />
                      View all palettes
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
