export default function NutrixLogo({ className = '', size = 42, decorative = false }) {
  return (
    <span
      className={`nutrix-logo ${className}`.trim()}
      style={{ '--nutrix-logo-size': `${size}px` }}
      aria-hidden={decorative ? 'true' : undefined}
    >
      <svg viewBox="0 0 64 64" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Nutrix'}>
        <defs>
          <linearGradient id="nutrixLeafA" x1="10" y1="10" x2="50" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity="1" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".28" />
          </linearGradient>
          <linearGradient id="nutrixLeafB" x1="52" y1="14" x2="17" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="currentColor" stopOpacity=".9" />
            <stop offset="1" stopColor="currentColor" stopOpacity=".2" />
          </linearGradient>
        </defs>
        <path d="M31 7c-10.8 4.8-17.1 13.2-17.1 22.6 0 7.8 4.4 13.8 12.2 16.9 1.3-7.9 4.8-16.4 10.5-25.4-2.4 9.7-3.6 19.3-3.1 28.7 9.5-3 15.4-10.2 15.4-19.7C48.9 19.3 42.1 11.5 31 7Z" fill="url(#nutrixLeafA)" />
        <path d="M21 44.4c-4.9 1.4-8.8 4.4-11.7 9 6.5.9 12.6-.5 18.4-4.2" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity=".65" />
        <path d="M35.2 43.7c5.9-1.5 11.4-4.6 16.5-9.3-1.7 8.2-6.7 13.8-14.8 16.6" fill="none" stroke="url(#nutrixLeafB)" strokeWidth="3" strokeLinecap="round" />
        <path d="M20.5 33.7C25.2 29.5 30.7 26 37 23.3" fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
