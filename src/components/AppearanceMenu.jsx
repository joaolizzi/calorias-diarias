const MODES = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'system', label: 'Sistema' },
];

// Aparência: apenas o modo (claro, escuro ou sistema). A preferência continua
// salva em localStorage pelo ThemeProvider, com as mesmas chaves de antes.
export default function AppearanceMenu({ theme, setTheme }) {
  return (
    <div className="segmented appearance-modes" role="group" aria-label="Aparência">
      {MODES.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={theme === item.id}
          className={theme === item.id ? 'active' : ''}
          onClick={() => setTheme?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
