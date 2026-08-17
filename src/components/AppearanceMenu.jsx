import { useEffect, useRef, useState } from 'react';

const THEMES = [
  { id: 'dark', label: 'Escuro', icon: '☾', description: 'Visual elegante e confortável' },
  { id: 'light', label: 'Claro', icon: '☀', description: 'Mais brilho e contraste' },
  { id: 'system', label: 'Sistema', icon: '◐', description: 'Segue o tema do dispositivo' },
];

const ACCENTS = [
  { id: 'green', label: 'Verde', value: '#34d399' },
  { id: 'blue', label: 'Azul', value: '#60a5fa' },
  { id: 'purple', label: 'Roxo', value: '#a78bfa' },
  { id: 'orange', label: 'Laranja', value: '#fb923c' },
];

export default function AppearanceMenu({ theme, accent, setTheme, setAccent }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return (
    <div className="appearance-menu" ref={ref}>
      <button className="appearance-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Personalizar aparência">
        <span className="appearance-trigger-icon">◐</span>
        <span className="appearance-trigger-label">Aparência</span>
        <span className="appearance-chevron">⌄</span>
      </button>

      {open && (
        <div className="appearance-popover">
          <div className="appearance-popover-head">
            <div>
              <strong>Personalizar aplicativo</strong>
              <span>Escolha como o Nutrix aparece para você.</span>
            </div>
            <button className="appearance-x" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
          </div>

          <div className="appearance-section">
            <div className="appearance-label">Tema</div>
            <div className="theme-options">
              {THEMES.map((item) => (
                <button key={item.id} className={`theme-option ${theme === item.id ? 'active' : ''}`} onClick={() => setTheme(item.id)}>
                  <span className="theme-option-icon">{item.icon}</span>
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  {theme === item.id && <span className="theme-check">✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-section">
            <div className="appearance-label">Cor de destaque</div>
            <div className="accent-options">
              {ACCENTS.map((item) => (
                <button key={item.id} className={`accent-option ${accent === item.id ? 'active' : ''}`} onClick={() => setAccent(item.id)} title={item.label} aria-label={`Cor ${item.label}`}>
                  <span style={{ '--accent-preview': item.value }} />
                  {accent === item.id && <b>✓</b>}
                </button>
              ))}
            </div>
          </div>

          <div className="appearance-footer">Preferências salvas automaticamente neste dispositivo.</div>
        </div>
      )}
    </div>
  );
}
