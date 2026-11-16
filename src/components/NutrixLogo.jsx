export default function NutrixLogo({ className = '', size = 42, decorative = false }) {
  return (
    <span
      className={`nutrix-logo ${className}`.trim()}
      style={{ '--nutrix-logo-size': `${size}px` }}
      aria-hidden={decorative ? 'true' : undefined}
    >
      <svg viewBox="0 0 64 64" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Nutrix'}>
        <path d="M31 7c-10.8 4.8-17.1 13.2-17.1 22.6 0 7.8 4.4 13.8 12.2 16.9 1.3-7.9 4.8-16.4 10.5-25.4-2.4 9.7-3.6 19.3-3.1 28.7 9.5-3 15.4-10.2 15.4-19.7C48.9 19.3 42.1 11.5 31 7Z" fill="currentColor" />
        <path d="M21 44.4c-4.9 1.4-8.8 4.4-11.7 9 6.5.9 12.6-.5 18.4-4.2" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity=".6" />
      </svg>
    </span>
  );
}
