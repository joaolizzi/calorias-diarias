import { useEffect, useRef, useState } from 'react';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Conta do valor anterior até o novo, no mesmo ritmo das barras (~900 ms, desacelerando).
// Na primeira renderização conta a partir de `initial` (0 por padrão). Só muda o que é exibido: o dado real
// continua sendo o `target`. Com "reduzir movimento" ligado mostra o valor direto.
export default function useCountUp(target, duration = 900, initial = 0) {
  const goal = Number(target) || 0;
  const [value, setValue] = useState(prefersReduced() ? goal : initial);
  const current = useRef(value);

  useEffect(() => {
    if (prefersReduced()) { current.current = goal; setValue(goal); return undefined; }
    const from = current.current;
    if (from === goal) return undefined;
    let raf;
    let start;
    const tick = (now) => {
      if (start === undefined) start = now;
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      const next = from + (goal - from) * eased;
      current.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [goal, duration]);

  return value;
}
