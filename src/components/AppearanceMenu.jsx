import { useEffect, useMemo, useRef, useState } from 'react';

const MODES = [
  { id: 'dark', label: 'Escuro', icon: '☾' },
  { id: 'light', label: 'Claro', icon: '☀' },
  { id: 'system', label: 'Sistema', icon: '◐' },
];

const PRESETS = [
  { id: 'graphite', label: 'Obsidian', description: 'Grafite + índigo', bg: '#080b12', panel: '#101722', accent: '#7c8cff' },
  { id: 'midnight', label: 'Midnight', description: 'Azul profundo + ciano', bg: '#07101c', panel: '#0f1b2b', accent: '#4cc9f0' },
  { id: 'forest', label: 'Forest', description: 'Verde mineral', bg: '#07110d', panel: '#0f1c17', accent: '#6ee7b7' },
  { id: 'stone', label: 'Stone', description: 'Grafite quente + dourado', bg: '#100f0d', panel: '#1a1815', accent: '#d8b56a' },
  { id: 'plum', label: 'Plum', description: 'Ameixa + lavanda', bg: '#0f0b14', panel: '#1b1422', accent: '#c4a7e7' },
  { id: 'paper', label: 'Paper', description: 'Claro + índigo', bg: '#f5f6fa', panel: '#ffffff', accent: '#6577f3' },
];

const ACCENTS = [
  { id: 'green', label: 'Índigo', value: '#7c8cff' },
  { id: 'blue', label: 'Ciano', value: '#38bdf8' },
  { id: 'purple', label: 'Violeta', value: '#b59cff' },
  { id: 'orange', label: 'Coral', value: '#ff8a65' },
];

export default function AppearanceMenu({ theme, accent, preset, setTheme, setAccent, setPreset }) {
  const [open, setOpen] = useState(false);
  const [localPreset, setLocalPreset] = useState(() => preset || localStorage.getItem('nutrix-preset') || 'graphite');
  const ref = useRef(null);

  useEffect(() => {
    if (preset) setLocalPreset(preset);
  }, [preset]);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const currentPreset = useMemo(() => preset || localPreset, [preset, localPreset]);

  const applyPreset = (id) => {
    setLocalPreset(id);
    localStorage.setItem('nutrix-preset', id);
    document.documentElement.dataset.preset = id;
    if (typeof setPreset === 'function') setPreset(id);
  };

  return (
    <div className="appearance-menu" ref={ref}>
      <button className="appearance-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Personalizar aparência">
        <span className="appearance-trigger-icon">◐</span>
        <span className="appearance-trigger-label">Aparência</span>
        <span className="appearance-chevron">⌄</span>
      </button>

      {open && (
        <div className="appearance-popover appearance-popover-v2">
          <div className="appearance-popover-head">
            <div>
              <strong>Aparência</strong>
              <span>Escolha uma identidade visual para o Nutrix.</span>
            </div>
            <button className="appearance-x" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
          </div>

          <div className="appearance-section">
            <div className="appearance-label">Tema</div>
            <div className="appearance-presets">
              {PRESETS.map((item) => (
                <button key={item.id} className={`appearance-preset ${currentPreset === item.id ? 'active' : ''}`} onClick={() => applyPreset(item.id)}>
                  <span className="appearance-preset-preview" style={{ '--preview-bg': item.bg, '--preview-panel': item.panel, '--preview-accent': item.accent }}>
                    <i /><b /><em />
                  </span>
                  <span className="appearance-preset-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  {currentPreset === item.id && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section appearance-compact-section">
            <div className="appearance-label">Modo</div>
            <div className="appearance-mode-row">
              {MODES.map((item) => (
                <button key={item.id} className={`appearance-mode-option ${theme === item.id ? 'active' : ''}`} onClick={() => setTheme?.(item.id)}>
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section appearance-compact-section">
            <div className="appearance-label">Cor de ação</div>
            <div className="accent-options">
              {ACCENTS.map((item) => (
                <button key={item.id} className={`accent-option ${accent === item.id ? 'active' : ''}`} onClick={() => setAccent?.(item.id)} title={item.label} aria-label={`Cor ${item.label}`}>
                  <span style={{ '--accent-preview': item.value }} />
                  {accent === item.id && <b>✓</b>}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-footer">As preferências ficam salvas neste dispositivo.</div>
        </div>
      )}
    </div>
  );
}
