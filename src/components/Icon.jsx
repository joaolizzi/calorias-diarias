// Ícones em SVG: renderizam igual em qualquer aparelho (glifos como ☀ ou ☾
// viram emoji colorido em alguns celulares e mudam de tamanho conforme a fonte).
const PATHS = {
  sunrise: <><path d="M12 3v3" /><path d="m5.6 7.6 2 2" /><path d="m18.4 7.6-2 2" /><path d="M3 17h18" /><path d="M7 17a5 5 0 0 1 10 0" /><path d="M6 21h12" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  apple: <><path d="M12 7.5c-1.4-1.3-3.6-1.7-5.2-.6C4.6 8.4 4.5 12 5.8 15c1 2.3 2.5 4.5 4.2 4.5.8 0 1.3-.5 2-.5s1.2.5 2 .5c1.7 0 3.2-2.2 4.2-4.5 1.3-3 1.2-6.6-1-8.1-1.6-1.1-3.8-.7-5.2.6Z" /><path d="M12 7.5c0-1.8.8-3.2 2.5-4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
  camera: <><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.4-2h5.2L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" /><circle cx="12" cy="13" r="3.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  text: <><path d="M4 6h16" /><path d="M4 11h16" /><path d="M4 16h9" /><path d="m17.5 14 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" /></>,
  sparkles: <><path d="m12 3 1.2 3.3 3.3 1.2-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z" /><path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /><path d="m5.5 14 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5 4.5-4.5" /><path d="M5 20h14" /></>,
  palette: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" /></>,
  monitor: <><rect x="3" y="4.5" width="18" height="12" rx="1.8" /><path d="M9 20h6M12 16.5V20" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  paperclip: <path d="m20 11.5-8.2 8.2a5 5 0 0 1-7.1-7.1L13 4.3a3.3 3.3 0 0 1 4.7 4.7l-8.2 8.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7.5" />,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
};

export default function Icon({ name, size = 18, strokeWidth = 1.8, className }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {path}
    </svg>
  );
}
