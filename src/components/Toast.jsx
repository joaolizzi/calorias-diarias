import { useEffect, useRef } from 'react';

export function toast(message, { type = 'ok', duration = 1600 } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('show', 'error');
  if (type === 'error') el.classList.add('error');
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), duration);
}

export default function Toast() {
  const ref = useRef(null);
  useEffect(() => {
    if (!document.getElementById('toast')) {
      const el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
  }, []);
  return null;
}