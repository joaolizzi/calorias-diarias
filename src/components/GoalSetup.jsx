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

  return (
    <div className={compact ? 'goal-setup goal-setup-compact' : 'goal-setup'}>
      <div className="goal-hero">
        <div className="eyebrow">SEU PLANO</div>
        <h1>{compact ? 'Ajuste seu objetivo' : 'Monte seu plano em 1 minuto'}</h1>
        <p>Informe seus dados e o app estima suas calorias e hidratação. Você pode ajustar tudo depois.</p>
      </div>

      <form onSubmit={submit} className="goal-form">
        <section className="goal-section">
          <div className="section-heading">
            <span className="section-icon">01</span>
            <div><strong>Seus dados</strong><span>Precisamos de informações básicas para a estimativa.</span></div>
          </div>
          <div className="goal-grid two">
            <label className="field-modern"><span>Nome</span><input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Como podemos te chamar?" /></label>
            <label className="field-modern"><span>Idade</span><input type="number" min="13" max="100" value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="18" required /></label>
            <label className="field-modern"><span>Peso <small>kg</small></span><input type="number" min="25" max="350" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="70" required /></label>
            <label className="field-modern"><span>Altura <small>cm</small></span><input type="number" min="100" max="230" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} placeholder="175" required /></label>
          </div>
          <div className="choice-row">
            <span className="choice-label">Sexo biológico</span>
            <div className="choice-group">
              <button type="button" className={form.sex === 'male' ? 'choice active' : 'choice'} onClick={() => set('sex', 'male')}>Masculino</button>
              <button type="button" className={form.sex === 'female' ? 'choice active' : 'choice'} onClick={() => set('sex', 'female')}>Feminino</button>
            </div>
          </div>
        </section>

        <section className="goal-section">
          <div className="section-heading"><span className="section-icon">02</span><div><strong>Seu objetivo</strong><span>Escolha o resultado que quer priorizar.</span></div></div>
          <div className="goal-cards">
            {GOALS.map((item) => (
              <button type="button" key={item.value} className={form.goal === item.value ? 'goal-card active' : 'goal-card'} onClick={() => set('goal', item.value)}>
                <span className="goal-card-title">{item.label}</span>
                <span>{item.value === 'lose' ? 'Déficit moderado' : item.value === 'gain' ? 'Superávit moderado' : 'Equilíbrio energético'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="goal-section">
          <div className="section-heading"><span className="section-icon">03</span><div><strong>Nível de atividade</strong><span>Isso influencia sua necessidade diária.</span></div></div>
          <div className="activity-grid">
            {ACTIVITY_LEVELS.map((item) => (
              <button type="button" key={item.value} className={form.activity === item.value ? 'activity-card active' : 'activity-card'} onClick={() => set('activity', item.value)}>
                <strong>{item.label}</strong>
                <span>{item.value === 'sedentary' ? 'Pouco ou nenhum exercício' : item.value === 'light' ? '1–3 treinos/semana' : item.value === 'moderate' ? '3–5 treinos/semana' : '6–7 treinos/semana'}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="goal-result">
          <div><span className="eyebrow">ESTIMATIVA PARA {goalLabel.toUpperCase()}</span><h2>Seu plano diário</h2><p>Baseado nos dados informados. Não é uma recomendação médica.</p></div>
          <div className="result-grid">
            <div className="result-card"><span>Calorias</span><strong>{kcal.toLocaleString('pt-BR')}</strong><small>kcal / dia</small></div>
            <div className="result-card water-result"><span>Água</span><strong>{water.toLocaleString('pt-BR')}</strong><small>ml / dia</small></div>
          </div>
        </section>

        <div className="manual-toggle-row">
          <div><strong>Quer personalizar?</strong><span>Você pode substituir as metas calculadas.</span></div>
          <button type="button" className={useManual ? 'switch on' : 'switch'} onClick={() => setUseManual((value) => !value)} aria-pressed={useManual}><span /></button>
        </div>

        {useManual && (
          <div className="goal-grid two manual-goals">
            <label className="field-modern"><span>Meta de calorias <small>kcal/dia</small></span><input type="number" min="1200" max="10000" step="50" value={manual.kcal || kcal} onChange={(e) => setManual((p) => ({ ...p, kcal: e.target.value }))} /></label>
            <label className="field-modern"><span>Meta de água <small>ml/dia</small></span><input type="number" min="1000" max="10000" step="50" value={manual.water || water} onChange={(e) => setManual((p) => ({ ...p, water: e.target.value }))} /></label>
          </div>
        )}

        <button className="btn primary goal-submit" type="submit" disabled={busy}>{busy ? 'Salvando seu plano…' : compact ? 'Salvar alterações' : 'Criar meu plano'}</button>
      </form>
    </div>
  );
}
