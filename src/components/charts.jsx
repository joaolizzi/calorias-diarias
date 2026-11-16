import { useEffect, useRef, useState } from 'react';
import { shortDay } from '../lib/dates.js';
import { fmtNum } from './format.js';

// Gráficos em SVG puro, sem biblioteca externa. Um único eixo vertical por gráfico,
// linha de meta tracejada, cores vindas dos tokens do tema e dica ao passar o mouse
// ou tocar. Cada gráfico tem uma versão em tabela para leitores de tela.

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.round(el.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function niceMax(value) {
  const max = Math.max(1, Number(value) || 1);
  const pow = 10 ** Math.floor(Math.log10(max));
  const base = max / pow;
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((n) => base <= n) || 10;
  return step * pow;
}

const longDay = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * series: [{ name, color, values: number[], unit }]
 * type: 'bar' agrupa as séries lado a lado; 'line' liga os pontos.
 */
export function DayChart({ days, series, goal, goalLabel, type = 'bar', height = 220, label }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);

  const pad = { top: 12, right: 12, bottom: 28, left: 44 };
  const w = Math.max(width, 240);
  const innerW = w - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.values), Number(goal) || 0);
  const yMax = niceMax(dataMax * 1.05);
  const y = (v) => pad.top + innerH - (Math.max(0, v) / yMax) * innerH;
  const slot = innerW / Math.max(1, days.length);
  const x = (i) => pad.left + slot * i + slot / 2;
  const ticks = [0, 0.5, 1].map((t) => t * yMax);
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(innerW / 54))));

  const groupW = Math.min(slot * 0.72, 40 * series.length);
  const barW = Math.max(2, (groupW - (series.length - 1) * 2) / series.length);

  const hoverX = hover == null ? 0 : x(hover);
  const tipLeft = Math.min(Math.max(hoverX - 70, 0), Math.max(0, w - 150));

  return (
    <div className="dchart" ref={wrapRef} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={w} height={height} role="img" aria-label={label}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} className="dchart-grid" />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="dchart-axis">{fmtNum(t, 0)}</text>
            </g>
          ))}

          {days.map((d, i) => (i % labelEvery === 0 || i === days.length - 1) && (
            <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="dchart-axis">{shortDay(d)}</text>
          ))}

          {type === 'bar' && days.map((d, i) => series.map((s, k) => {
            const v = s.values[i] || 0;
            if (v <= 0) return null;
            const bx = x(i) - groupW / 2 + k * (barW + 2);
            const top = y(v);
            const h = pad.top + innerH - top;
            const r = Math.min(4, barW / 2, h);
            return (
              <path
                key={`${d}-${s.name}`}
                d={`M${bx},${top + h} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + barW - r} Q${bx + barW},${top} ${bx + barW},${top + r} V${top + h} Z`}
                fill={s.color}
                opacity={hover == null || hover === i ? 1 : 0.45}
              />
            );
          }))}

          {type === 'line' && series.map((s) => (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              />
              {hover != null && <circle cx={x(hover)} cy={y(s.values[hover] || 0)} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />}
            </g>
          ))}

          {goal > 0 && (
            <g>
              <line x1={pad.left} x2={w - pad.right} y1={y(goal)} y2={y(goal)} className="dchart-goal" />
              <text x={w - pad.right} y={y(goal) - 6} textAnchor="end" className="dchart-goal-label">{goalLabel}</text>
            </g>
          )}

          {days.map((d, i) => (
            <rect
              key={`hit-${d}`}
              x={pad.left + slot * i}
              y={pad.top}
              width={slot}
              height={innerH}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerDown={() => setHover(i)}
            />
          ))}
        </svg>
      )}

      {hover != null && (
        <div className="dchart-tip" style={{ left: tipLeft }} role="status">
          <strong>{longDay(days[hover])}</strong>
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} />{s.name}: {fmtNum(s.values[hover] || 0, 1)} {s.unit}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items }) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.name}><i style={{ background: item.color }} />{item.name}</li>
      ))}
    </ul>
  );
}

// Faixa de consistência: um quadrado por dia. Cheio = dentro da meta; vazado = sem registro.
export function ConsistencyStrip({ days, states }) {
  return (
    <ul className="consistency" aria-label="Dias dentro da meta de calorias">
      {days.map((d, i) => (
        <li key={d} className={`c-${states[i]}`} title={`${longDay(d)}: ${states[i] === 'hit' ? 'dentro da meta' : states[i] === 'miss' ? 'fora da meta' : 'sem registro'}`} />
      ))}
    </ul>
  );
}
