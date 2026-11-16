import { fmtInt, fmtLitres, fmtLitresNum, pctOf } from './format.js';

// Cartão de progresso no formato "rótulo nutricional": número grande, régua e,
// para as calorias, a tabela de macronutrientes logo abaixo (children).
export default function ProgressCard({ title, unit, consumed, goal, variant = 'water', children }) {
  const safeConsumed = Number(consumed) || 0;
  const safeGoal = Number(goal) || 0;
  const pct = pctOf(safeConsumed, safeGoal);
  const over = safeGoal > 0 && safeConsumed > safeGoal;

  if (variant === 'food') {
    const remaining = Math.max(0, safeGoal - safeConsumed);
    const headingId = 'h-calorias';
    return (
      <section className="card label-card progress-card progress-card-food" aria-labelledby={headingId}>
        <div className="label-card-head">
          <h2 id={headingId}>{title}</h2>
          <span className="muted">Meta de {fmtInt(safeGoal)} {unit}</span>
        </div>
        <div className="label-hero">
          <span className="label-hero-num">{fmtInt(over ? safeConsumed - safeGoal : remaining)}</span>
          <span className="label-hero-unit">{over ? `${unit} acima da meta` : `${unit} restantes`}</span>
        </div>
        <div
          className="meter"
          role="img"
          aria-label={`${fmtInt(safeConsumed)} de ${fmtInt(safeGoal)} quilocalorias consumidas, ${pct}% da meta`}
        >
          <div className="meter-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="meter-legend">
          <span>{fmtInt(safeConsumed)} {unit} consumidas</span>
          <span>{pct}% da meta</span>
        </div>
        {children}
      </section>
    );
  }

  const headingId = 'h-agua';
  const BLOCK = safeGoal / 250 > 16 ? 500 : 250;
  const blocks = Math.max(4, Math.min(24, Math.ceil(safeGoal / BLOCK) || 8));
  const filled = Math.min(blocks, Math.floor(safeConsumed / BLOCK));
  const remaining = Math.max(0, safeGoal - safeConsumed);

  return (
    <section className="card label-card progress-card progress-card-water" aria-labelledby={headingId}>
      <div className="label-card-head">
        <h2 id={headingId}>{title}</h2>
        <span className="muted">Meta de {fmtLitres(safeGoal)}</span>
      </div>
      <div className="label-hero label-hero-sm">
        <span className="label-hero-num">{fmtLitresNum(safeConsumed)}</span>
        <span className="label-hero-unit">litros</span>
      </div>
      <div>
        <div
          className="ruler"
          role="img"
          aria-label={`${filled} de ${blocks} blocos de ${BLOCK} mililitros, ${pct}% da meta de água`}
        >
          {Array.from({ length: blocks }, (_, i) => (
            <span key={i} className={i < filled ? 'on' : ''} />
          ))}
        </div>
        <div className="meter-legend small">
          <span>Cada bloco equivale a {BLOCK} ml</span>
          <span>{over ? 'meta atingida' : `${fmtInt(remaining)} ml restantes`}</span>
        </div>
      </div>
      {children}
    </section>
  );
}
