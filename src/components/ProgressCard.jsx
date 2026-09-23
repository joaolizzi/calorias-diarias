import { statusFor } from '../lib/dates.js';
import './ProgressCard3D.css';

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
  const remaining = Math.max(0, Number(goal || 0) - Number(consumed || 0));

  if (variant === 'food') {
    return (
      <div className="card progress-card progress-card-food calorie-3d-card">
        <div className="progress-card-head calorie-3d-head">
          <div>
            <span className="progress-card-label">{title}</span>
            <small>Energia do dia</small>
          </div>
          <span className={`pill ${status.cls}`}>{status.label}</span>
        </div>

        <div className="calorie-3d-layout">
          <div
            className={`calorie-3d-stage ${over ? 'is-over' : ''}`}
            style={{ '--calorie-angle': `${pct * 3.6}deg`, '--calorie-pct': `${pct}%` }}
            aria-label={`${pct}% da meta de calorias`}
          >
            <div className="calorie-3d-shadow" />
            <div className="calorie-3d-ring"><span /></div>
            <div className="calorie-3d-core">
              <span>consumido</span>
              <strong>{Number(consumed || 0).toLocaleString('pt-BR')}</strong>
              <small>{unit}</small>
            </div>
            <div className="calorie-3d-orbit orbit-a" />
            <div className="calorie-3d-orbit orbit-b" />
          </div>

          <div className="calorie-3d-stats">
            <div className="calorie-stat calorie-stat-main">
              <span>Restante</span>
              <strong>{Math.round(remaining).toLocaleString('pt-BR')}</strong>
              <small>kcal</small>
            </div>
            <div className="calorie-stat">
              <span>Meta</span>
              <strong>{Number(goal || 0).toLocaleString('pt-BR')}</strong>
              <small>kcal</small>
            </div>
            <div className="calorie-stat">
              <span>Progresso</span>
              <strong>{pct}%</strong>
              <small>{over ? 'meta atingida' : 'do objetivo'}</small>
            </div>
          </div>
        </div>

        <div className="calorie-3d-footer">
          <span><i /> Consumido</span>
          <span><i /> Restante</span>
          <b>{over ? 'Meta diária atingida' : `${Math.round(remaining).toLocaleString('pt-BR')} kcal para a meta`}</b>
        </div>
      </div>
    );
  }

  return (
    <div className={`card progress-card progress-card-${variant}`}>
      <div className="progress-card-head">
        <span className="progress-card-label">{title}</span>
        <span className={`pill ${status.cls}`}>{status.label}</span>
      </div>

      <div className={`big num ${isWater ? 'water' : ''}`}>
        {consumed.toLocaleString('pt-BR')}
        <span className="unit">{unit}</span>
      </div>

      <div className="progress-card-meta">
        Meta diária: <span className="num">{goal.toLocaleString('pt-BR')}</span> {unit}
      </div>

      <div className={`progress progress-gradient ${isWater ? 'water-gradient' : 'kcal-gradient'}`}>
        <div className={fillClass} style={{ width: `${pct}%` }} />
        <div className="progress-label num">{over ? '🎉 ' : ''}{pct}%{over ? ' — meta atingida' : ''}</div>
      </div>

      {children}
    </div>
  );
}
