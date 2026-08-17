import { statusFor } from '../lib/dates.js';

export default function ProgressCard({
  title,
  unit,
  consumed,
  goal,
  variant = 'water',
  children,
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
  const over = goal > 0 && consumed > goal;
  const status = statusFor(consumed, goal);
  const fillClass = `progress-fill ${over ? 'over' : variant === 'food' ? 'food' : ''}`;
  const isWater = variant === 'water';

  return (
    <div className={`card progress-card progress-card-${variant}`}>
      <div className="row">
        <div>
          <div className={`big num ${variant === 'food' ? 'food' : 'water'}`}>
            {consumed} <span style={{ fontSize: 18, opacity: 0.7 }}>{unit}</span>
          </div>
          <div className="muted">
            de <span className="num">{goal}</span> {unit}
            {title ? ` · ${title}` : ''}
          </div>
        </div>
        <span className={`pill ${status.cls}`}>{status.label}</span>
      </div>

      <div className={`progress progress-gradient ${isWater ? 'water-gradient' : 'kcal-gradient'}`}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
        <div className="progress-label num">
          {over ? '🎉 ' : ''}
          {pct}%{over ? ' (meta batida!)' : ''}
        </div>
      </div>

      {children}
    </div>
  );
}
