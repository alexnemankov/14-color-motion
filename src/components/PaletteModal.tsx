import React, { CSSProperties, useState, useEffect, useMemo } from 'react';
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

  const favoritePalettes = useMemo(() => {
    return favorites
      .map(name => PALETTES.find(palette => palette.name === name))
      .filter((palette): palette is PaletteDescriptor => Boolean(palette));
  }, [favorites]);

  const recentPalettes = useMemo(() => {
    return recentPaletteNames
      .map(name => PALETTES.find(palette => palette.name === name))
      .filter((palette): palette is PaletteDescriptor => Boolean(palette));
  }, [recentPaletteNames]);

  const featuredPalettes = useMemo(() => {
    return PALETTES.filter(palette =>
      palette.tags.includes('Vibrant')
      || palette.tags.includes('Neon')
      || palette.tags.includes('Pastel')
    ).slice(0, 6);
  }, []);

  const showLibraryShelves = activeCategory === 'All' && !searchQuery.trim();

  const getGradientStyle = (colors: string[]): CSSProperties => ({
    ['--palette-gradient' as any]: `linear-gradient(135deg, ${colors.join(', ')})`,
  } as CSSProperties);

  const renderPaletteCard = (palette: PaletteDescriptor, compact = false) => (
    <div
      key={palette.name}
      className={`palette-card-shell ${activePaletteName === palette.name ? 'active' : ''} ${compact ? 'palette-card-compact' : ''}`}
    >
      <button
        type="button"
        className="palette-card"
        onClick={() => handleSelect(palette)}
        aria-pressed={activePaletteName === palette.name}
      >
        <div className="card-preview" style={getGradientStyle(palette.colors)} />
        <div className="card-info">
          <div className="card-heading">
            <span className="card-name">{palette.name}</span>
          </div>
          <div className="card-dots">
            {palette.colors.slice(0, 4).map((color, index) => (
              <div key={index} className="color-dot" style={{ background: color }} />
            ))}
            {palette.colors.length > 4 && <span className="dot-plus">+{palette.colors.length - 4}</span>}
          </div>
        </div>
      </button>
      <button
        type="button"
        className={`fav-btn fav-btn-floating ${favorites.includes(palette.name) ? 'active' : ''}`}
        onClick={event => toggleFavorite(event, palette.name)}
        aria-label={favorites.includes(palette.name) ? `Remove ${palette.name} from favorites` : `Add ${palette.name} to favorites`}
      >
        <Heart size={18} weight={favorites.includes(palette.name) ? 'fill' : 'bold'} />
      </button>
    </div>
  );

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
            aria-labelledby="palette-library-title"
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="modal-header">
              <div className="header-title-group">
                <span className="modal-kicker">Palette Library</span>
                <h2 id="palette-library-title">Curated color systems for motion studies</h2>
                <p className="header-subtitle">Start with featured picks, jump to recents, or search the full library.</p>
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
                  <span className="results-label">Selected palette</span>
                  <div
                    className="active-palette-row"
                    style={getGradientStyle(activePalette.colors)}
                  >
                    <div className="active-info">
                      <div className="active-copy">
                        <span className="active-name">{activePalette.name}</span>
                        <span className="active-meta">{activePalette.colors.length} colors</span>
                      </div>
                      <div className="active-dots">
                        {activePalette.colors.map((color, index) => (
                          <div key={index} className="color-dot" style={{ background: color }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {showLibraryShelves && (
                <div className="library-shelves">
                  <section className="library-shelf" aria-labelledby="featured-palettes-title">
                    <div className="results-info">
                      <span id="featured-palettes-title" className="results-label">Featured picks</span>
                      <span className="results-count">{featuredPalettes.length} ready to try</span>
                    </div>
                    <div className="palette-shelf-grid">
                      {featuredPalettes.map(palette => renderPaletteCard(palette, true))}
                    </div>
                  </section>

                  {recentPalettes.length > 0 && (
                    <section className="library-shelf" aria-labelledby="recent-palettes-title">
                      <div className="results-info">
                        <span id="recent-palettes-title" className="results-label">Recent</span>
                        <span className="results-count">{recentPalettes.length} recent</span>
                      </div>
                      <div className="palette-shelf-grid">
                        {recentPalettes.slice(0, 4).map(palette => renderPaletteCard(palette, true))}
                      </div>
                    </section>
                  )}

                  {favoritePalettes.length > 0 && (
                    <section className="library-shelf" aria-labelledby="favorite-palettes-title">
                      <div className="results-info">
                        <span id="favorite-palettes-title" className="results-label">Favorites</span>
                        <span className="results-count">{favoritePalettes.length} saved</span>
                      </div>
                      <div className="palette-shelf-grid">
                        {favoritePalettes.slice(0, 4).map(palette => renderPaletteCard(palette, true))}
                      </div>
                    </section>
                  )}
                </div>
              )}

              <div className="results-info">
                <span className="results-label">
                  {searchQuery ? 'Search results' : activeCategory === 'All' ? 'Browse all palettes' : activeCategory}
                </span>
                <span className="results-count">{filteredPalettes.length} total</span>
              </div>

              <div className="palette-grid">
                {filteredPalettes.length > 0 ? (
                  filteredPalettes.map((palette: PaletteDescriptor) => renderPaletteCard(palette))
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
