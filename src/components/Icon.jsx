// Conjunto único de ícones do Nutrix: traço de 1.8px, cantos arredondados, herdam a cor do texto.
const PATHS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
  sparkles: <><path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z" /><path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3" /></>,
  meal: <><path d="M4 11h16" /><path d="M6 11a6 6 0 0 1 12 0" /><path d="M12 5V3" /><path d="M5 15h14" /><path d="M7 19h10" /></>,
  dumbbell: <path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12M2 12h1.5M20.5 12H22" />,
  goal: <><path d="M6 3h12v18H6z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  water: <><path d="M12 3s5 5.5 5 10a5 5 0 0 1-10 0c0-4.5 5-10 5-10Z" /><path d="M9.5 14.5c.6 1.1 1.5 1.6 2.5 1.6" /></>,
  admin: <><path d="M12 3 4.5 6v5.5c0 4.5 3 7.6 7.5 9.5 4.5-1.9 7.5-5 7.5-9.5V6L12 3Z" /><path d="M9.5 12 11 13.5l3.5-3.5" /></>,
  logout: <><path d="M10 5H5v14h5" /><path d="m14 8 4 4-4 4M8 12h10" /></>,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  download: <path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14" />,
  camera: <><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5" />,
  pencil: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  refresh: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></>,
  'thumb-up': <><path d="M7 11v9H4v-9h3Z" /><path d="M7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a1.8 1.8 0 0 1 1.8 2.1l-1.2 6A2 2 0 0 1 17.6 20H7" /></>,
  'thumb-down': <><path d="M7 13V4H4v9h3Z" /><path d="m7 13 4 7c1.5 0 2.5-1 2.2-2.6L12.6 14H19a1.8 1.8 0 0 0 1.8-2.1l-1.2-6A2 2 0 0 0 17.6 4H7" /></>,
  upload: <><path d="M12 15V4M7.5 8 12 3.5 16.5 8" /><path d="M5 15v5h14v-5" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
};

export default function Icon({ name, size = 18, className = '' }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      className={className || undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}
