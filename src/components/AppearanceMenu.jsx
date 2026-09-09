import { useEffect, useRef, useState } from 'react';

const THEMES = [
  { id: 'dark', label: 'Escuro', icon: '☾', description: 'Interface escura' },
  { id: 'light', label: 'Claro', icon: '☀', description: 'Interface clara' },
  { id: 'system', label: 'Sistema', icon: '◐', description: 'Segue o dispositivo' },
];

const PRESETS = [
  { id: 'graphite', label: 'Graphite', description: 'Sóbrio e profissional', colors: ['#0b0f14', '#151c24', '#52c58f'] },
  { id: 'midnight', label: 'Midnight', description: 'Azul executivo', colors: ['#09111f', '#111d31', '#4f8cff'] },
  { id: 'forest', label: 'Forest', description: 'Verde profundo', colors: ['#09120f', '#12231b', '#57c58b'] },
  { id: 'stone', label: 'Stone', description: 'Neutro sofisticado', colors: ['#11110f', '#1c1b18', '#c7a96b'] },
  { id: 'plum', label: 'Plum', description: 'Roxo discreto', colors: ['#120e17', '#211827', '#b48ad6'] },
  { id: 'paper', label: 'Paper', description: 'Claro editorial', colors: ['#f4f1ea', '#ffffff', '#237a57'], forceLight: true },
];

const ACCENTS = [
  { id: 'green', label: 'Verde', value: '#52c58f' },
  { id: 'blue', label: 'Azul', value: '#5b8def' },
  { id: 'purple', label: 'Roxo', value: '#a78bfa' },
  { id: 'orange', label: 'Âmbar', value: '#d99a52' },
];

export default function AppearanceMenu({ theme, accent, setTheme, setAccent }) {
  const [open, setOpen] = useState(false);
  const [preset, setPresetState] = useState(() => localStorage.getItem('nutrix-preset') || 'graphite');
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const choosePreset = (item) => {
    setPresetState(item.id);
    document.documentElement.dataset.preset = item.id;
    localStorage.setItem('nutrix-preset', item.id);
    if (item.forceLight && theme !== 'light') setTheme('light');
    if (!item.forceLight && item.id !== 'graphite' && theme === 'light') setTheme('dark');
  };

  return (
    <div className="appearance-menu" ref={ref}>
      <button className="appearance-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Personalizar aparência">
        <span className="appearance-trigger-icon">◐</span>
        <span className="appearance-trigger-label">Aparência</span>
        <span className="appearance-chevron">⌄</span>
      </button>

      {open && (
        <div className="appearance-popover appearance-popover-themes">
          <div className="appearance-popover-head">
            <div>
              <strong>Aparência</strong>
              <span>Escolha uma identidade visual para o Nutrix.</span>
            </div>
            <button className="appearance-x" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
          </div>

          <div className="appearance-section">
            <div className="appearance-label">Temas do Nutrix</div>
            <div className="preset-options">
              {PRESETS.map((item) => (
                <button key={item.id} className={`preset-option ${preset === item.id ? 'active' : ''}`} onClick={() => choosePreset(item)}>
                  <span className="preset-preview" aria-hidden="true">
                    {item.colors.map((color) => <i key={color} style={{ background: color }} />)}
                  </span>
                  <span className="preset-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  {preset === item.id && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section appearance-compact-section">
            <div className="appearance-label">Modo</div>
            <div className="mode-options">
              {THEMES.map((item) => (
                <button key={item.id} className={`mode-option ${theme === item.id ? 'active' : ''}`} onClick={() => setTheme(item.id)} title={item.description}>
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section appearance-compact-section">
            <div className="appearance-label">Cor de ação</div>
            <div className="accent-options">
              {ACCENTS.map((item) => (
                <button key={item.id} className={`accent-option ${accent === item.id ? 'active' : ''}`} onClick={() => setAccent(item.id)} title={item.label} aria-label={`Cor ${item.label}`}>
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
