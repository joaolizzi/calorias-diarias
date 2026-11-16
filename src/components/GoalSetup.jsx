import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { getProfile, saveGoalProfile } from '../lib/supabase.js';
import { ACTIVITY_LEVELS, GOALS, calculateGoals } from '../lib/calculations.js';
import { toast } from './Toast.jsx';

const defaults = {
  displayName: '',
  weightKg: '',
  heightCm: '',
  age: '',
  sex: 'male',
  activity: 'moderate',
  goal: 'maintain',
};

export default function GoalSetup({ onComplete, compact = false }) {
  const { user } = useAuth();
  const [form, setForm] = useState(defaults);
  const [manual, setManual] = useState({ kcal: '', water: '' });
  const [useManual, setUseManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getProfile(user.id).then((profile) => {
      if (!active || !profile) return;
      setForm({
        displayName: profile.display_name || '',
        weightKg: profile.weight_kg ?? '',
        heightCm: profile.height_cm ?? '',
        age: profile.age ?? '',
        sex: profile.sex || 'male',
        activity: profile.activity_level || 'moderate',
        goal: profile.goal || 'maintain',
      });
      setManual({
        kcal: profile.daily_kcal_goal ?? '',
        water: profile.daily_water_goal_ml ?? '',
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [user.id]);

  const result = useMemo(() => calculateGoals(form), [form]);
  const kcal = useManual ? Number(manual.kcal) || result.kcal : result.kcal;
  const water = useManual ? Number(manual.water) || result.water : result.water;
  const goalLabel = GOALS.find((item) => item.value === form.goal)?.label || 'Seu objetivo';

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (Number(form.weightKg) < 25 || Number(form.weightKg) > 350) {
      return toast('Informe um peso entre 25 e 350 kg', { type: 'error' });
    }
    if (Number(form.heightCm) < 100 || Number(form.heightCm) > 230) {
      return toast('Informe uma altura entre 100 e 230 cm', { type: 'error' });
    }
    if (Number(form.age) < 13 || Number(form.age) > 100) {
      return toast('Informe uma idade entre 13 e 100 anos', { type: 'error' });
    }
    if (useManual && (kcal < 1200 || kcal > 10000 || water < 1000 || water > 10000)) {
      return toast('Confira as metas personalizadas', { type: 'error' });
    }

    setBusy(true);
    try {
      await saveGoalProfile(user.id, { ...form, kcalGoal: kcal, waterGoal: water });
      toast('Objetivo salvo com sucesso');
      onComplete?.();
    } catch (e) {
      toast(e.message || 'Não foi possível salvar seu objetivo', { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const activityHint = { sedentary: 'Pouco ou nenhum exercício', light: '1–3 treinos por semana', moderate: '3–5 treinos por semana', active: '6–7 treinos por semana' };
  const goalHint = { lose: 'Déficit moderado', gain: 'Superávit moderado', maintain: 'Equilíbrio energético' };

  return (
    <div className="goal-setup">
      <header className="goal-intro">
        <h1>{compact ? 'Ajuste seu objetivo' : 'Monte seu plano em 1 minuto'}</h1>
        <p>Informe seus dados e o app estima suas calorias e hidratação. Você pode ajustar tudo depois.</p>
      </header>

      <form onSubmit={submit} className="goal-form">
        <section className="goal-section" aria-labelledby="gs-dados">
          <div className="goal-section-head"><h2 id="gs-dados">Seus dados</h2><p>Precisamos de informações básicas para a estimativa.</p></div>
          <div className="goal-grid">
            <label className="field-modern"><span>Nome</span><input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Como podemos te chamar?" /></label>
            <label className="field-modern"><span>Idade</span><input type="number" min="13" max="100" value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="Por exemplo: 28" required /></label>
            <label className="field-modern"><span>Peso <small>(kg)</small></span><input type="number" min="25" max="350" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="Por exemplo: 70" required /></label>
            <label className="field-modern"><span>Altura <small>(cm)</small></span><input type="number" min="100" max="230" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} placeholder="Por exemplo: 175" required /></label>
          </div>
          <div className="choice-row">
            <span className="choice-label" id="gs-sexo">Sexo biológico</span>
            <div className="segmented" role="group" aria-labelledby="gs-sexo">
              <button type="button" aria-pressed={form.sex === 'male'} className={form.sex === 'male' ? 'active' : ''} onClick={() => set('sex', 'male')}>Masculino</button>
              <button type="button" aria-pressed={form.sex === 'female'} className={form.sex === 'female' ? 'active' : ''} onClick={() => set('sex', 'female')}>Feminino</button>
            </div>
          </div>
        </section>

        <section className="goal-section" aria-labelledby="gs-obj">
          <div className="goal-section-head"><h2 id="gs-obj">Seu objetivo</h2><p>Escolha o resultado que quer priorizar.</p></div>
          <div className="option-grid three" role="group" aria-labelledby="gs-obj">
            {GOALS.map((item) => (
              <button type="button" key={item.value} aria-pressed={form.goal === item.value} className={`option-card ${form.goal === item.value ? 'active' : ''}`} onClick={() => set('goal', item.value)}>
                <strong>{item.label}</strong>
                <span>{goalHint[item.value]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="goal-section" aria-labelledby="gs-ativ">
          <div className="goal-section-head"><h2 id="gs-ativ">Nível de atividade</h2><p>Isso influencia sua necessidade diária.</p></div>
          <div className="option-grid four" role="group" aria-labelledby="gs-ativ">
            {ACTIVITY_LEVELS.map((item) => (
              <button type="button" key={item.value} aria-pressed={form.activity === item.value} className={`option-card ${form.activity === item.value ? 'active' : ''}`} onClick={() => set('activity', item.value)}>
                <strong>{item.label}</strong>
                <span>{activityHint[item.value] || activityHint.active}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card goal-result" aria-labelledby="gs-plano">
          <div>
            <h2 id="gs-plano">Seu plano diário</h2>
            <p className="muted">Estimativa para {goalLabel.toLowerCase()}, baseada nos dados informados. Não substitui orientação médica ou nutricional.</p>
          </div>
          <div className="result-grid">
            <div className="result-cell"><span>Calorias</span><strong className="num">{kcal.toLocaleString('pt-BR')}</strong><small>kcal por dia</small></div>
            <div className="result-cell"><span>Água</span><strong className="num">{water.toLocaleString('pt-BR')}</strong><small>ml por dia</small></div>
          </div>
        </section>

        <div className="manual-toggle-row">
          <div><strong>Quer personalizar?</strong><span>Você pode substituir as metas calculadas.</span></div>
          <button type="button" className={useManual ? 'switch on' : 'switch'} onClick={() => setUseManual((value) => !value)} aria-pressed={useManual} aria-label="Personalizar metas"><span /></button>
        </div>

        {useManual && (
          <div className="goal-grid">
            <label className="field-modern"><span>Meta de calorias <small>(kcal por dia)</small></span><input type="number" min="1200" max="10000" step="50" value={manual.kcal || kcal} onChange={(e) => setManual((p) => ({ ...p, kcal: e.target.value }))} /></label>
            <label className="field-modern"><span>Meta de água <small>(ml por dia)</small></span><input type="number" min="1000" max="10000" step="50" value={manual.water || water} onChange={(e) => setManual((p) => ({ ...p, water: e.target.value }))} /></label>
          </div>
        )}

        <button className="btn primary goal-submit" type="submit" disabled={busy}>{busy ? 'Salvando seu plano…' : compact ? 'Salvar alterações' : 'Criar meu plano'}</button>
      </form>
    </div>
  );
}
