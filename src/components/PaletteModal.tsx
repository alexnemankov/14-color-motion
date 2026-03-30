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

type LibraryCategory = 'All' | 'Favorites' | 'Recent' | PaletteTag;

const FAVORITES_STORAGE_KEY = 'liquid-favorites';
const RECENT_PALETTES_STORAGE_KEY = 'liquid-recent-palettes';
const RECENT_LIMIT = 8;

const CATEGORIES: { id: LibraryCategory; label: string; Icon: any }[] = [
  { id: 'All', label: 'All', Icon: Sparkle },
  { id: 'Favorites', label: 'Favorites', Icon: Heart },
  { id: 'Recent', label: 'Recent', Icon: ArrowsClockwise },
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
  const [activeCategory, setActiveCategory] = useState<LibraryCategory>('All');
  const [activePaletteName, setActivePaletteName] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentPaletteNames, setRecentPaletteNames] = useState<string[]>([]);
  
  // Load favorites from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to parse favorites', e);
    }
  }, []);

  // Save favorites to local storage
  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_PALETTES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentPaletteNames(parsed.filter((name): name is string => typeof name === 'string'));
        }
      }
    } catch (e) {
      console.error('Failed to parse recent palettes', e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RECENT_PALETTES_STORAGE_KEY, JSON.stringify(recentPaletteNames));
  }, [recentPaletteNames]);

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

  const pushRecentPalette = (name: string) => {
    setRecentPaletteNames(prev => [name, ...prev.filter(entry => entry !== name)].slice(0, RECENT_LIMIT));
  };

  const handleSelect = (p: PaletteDescriptor) => {
    setActivePaletteName(p.name);
    pushRecentPalette(p.name);
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
    pushRecentPalette(random.name);
    onSelect(random.colors);
    
    // Auto-close immediately
    onClose();
  };

  const filteredPalettes = useMemo(() => {
    const recentIndex = new Map(recentPaletteNames.map((name, index) => [name, index]));

    return PALETTES
      .filter((p: PaletteDescriptor) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === 'All'
        || (activeCategory === 'Favorites' && favorites.includes(p.name))
        || (activeCategory === 'Recent' && recentIndex.has(p.name))
        || (activeCategory !== 'Favorites' && activeCategory !== 'Recent' && p.tags.includes(activeCategory as PaletteTag));
      return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (activeCategory === 'Recent') {
          return (recentIndex.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (recentIndex.get(b.name) ?? Number.MAX_SAFE_INTEGER);
        }

        if (activeCategory === 'Favorites') {
          return a.name.localeCompare(b.name);
        }

        return 0;
      });
  }, [searchQuery, activeCategory, favorites, recentPaletteNames]);

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
          {activePalette && (
            <motion.div
              className="active-palette-section"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
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
              {searchQuery ? 'Search results' : activeCategory}
            </span>
            <span className="results-count">{filteredPalettes.length} total</span>
          </div>

          <div className="palette-grid">
            {filteredPalettes.length > 0 ? (
              filteredPalettes.map((p: PaletteDescriptor) => (
                <div
                  key={p.name}
                  className={`palette-card ${activePaletteName === p.name ? 'active' : ''}`}
                  onClick={() => handleSelect(p)}
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
                </div>
              ))
            ) : (
              <div className="no-results-state">
                <Tray size={48} weight="thin" />
                <h3>No palettes found</h3>
                <p>
                  {activeCategory === 'Favorites'
                    ? 'Start saving favorites to build your own palette shelf.'
                    : activeCategory === 'Recent'
                      ? 'Pick a few palettes and they will appear here for quick return visits.'
                      : 'Try searching for a different color or vibe.'}
                </p>
                <button className="reset-search-btn" onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}>
                  <ArrowsClockwise size={14} />
                  Reset library view
                </button>
              </div>
            )}
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
