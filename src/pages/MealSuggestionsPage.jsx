import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import Icon from '../components/Icon.jsx';
import { toast } from '../components/Toast.jsx';
import { addFood, getFoodForDay, getProfile, getRecentFoodEntries } from '../lib/supabase.js';
import { getIngredientSwaps, getMealSuggestions } from '../lib/gemini.js';
import { lastNDays, today } from '../lib/dates.js';

const MEALS = [
  { id: 'breakfast', label: 'Café da manhã' },
  { id: 'lunch', label: 'Almoço' },
  { id: 'snack', label: 'Lanche' },
  { id: 'dinner', label: 'Jantar' },
];

const STYLES = [
  { id: 'balanced', label: 'Equilibrada' },
  { id: 'protein', label: 'Mais proteína' },
  { id: 'quick', label: 'Rápida' },
  { id: 'budget', label: 'Econômica' },
];

const MODES = [
  { id: 'mixed', label: 'Misturar', description: 'Hábitos + receitas novas' },
  { id: 'familiar', label: 'O que eu já como', description: 'Mais próximo da sua rotina' },
  { id: 'recipes', label: 'Receitas novas', description: 'Mais ideias diferentes' },
];

const TYPE_LABELS = {
  familiar: 'Sua rotina',
  variation: 'Variação',
  recipe: 'Receita',
  new: 'Nova ideia',
};

const emptyPreferences = () => ({ liked: [], disliked: [] });

function loadStoredPreferences(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`nutrix-meal-preferences:${userId}`) || 'null');
    if (saved && Array.isArray(saved.liked) && Array.isArray(saved.disliked)) return saved;
  } catch {}
  return emptyPreferences();
}
const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

function currentMeal() {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 19) return 'snack';
  return 'dinner';
}

function normalizeName(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function parsePantry(value) {
  const seen = new Set();
  return String(value || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => {
      const key = normalizeName(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
}

function buildHistoryProfile(entries) {
  const map = new Map();

  for (const entry of entries || []) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    const key = normalizeName(name);
    const current = map.get(key) || {
      name,
      count: 0,
      kcal: 0,
      grams: 0,
      gramsCount: 0,
      meals: {},
    };

    current.count += 1;
    current.kcal += Number(entry?.kcal || 0);
    if (Number(entry?.grams || 0) > 0) {
      current.grams += Number(entry.grams);
      current.gramsCount += 1;
    }
    if (entry?.meal) current.meals[entry.meal] = (current.meals[entry.meal] || 0) + 1;
    map.set(key, current);
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((item) => {
      const meal = Object.entries(item.meals).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      return {
        name: item.name,
        count: item.count,
        avgKcal: Math.round(item.kcal / Math.max(1, item.count)),
        avgGrams: item.gramsCount ? Math.round(item.grams / item.gramsCount) : 0,
        meal,
      };
    });
}

function kcalDistance(kcal, target) {
  const difference = Math.round(Number(kcal || 0) - Number(target || 0));
  if (Math.abs(difference) <= 20) return 'quase exato';
  return difference > 0 ? `+${difference} kcal` : `${difference} kcal`;
}

function recalculateSuggestion(suggestion, ingredients) {
  const totals = ingredients.reduce((sum, item) => ({
    kcal: sum.kcal + Number(item.kcal || 0),
    protein: sum.protein + Number(item.protein || 0),
    carbs: sum.carbs + Number(item.carbs || 0),
    fat: sum.fat + Number(item.fat || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    ...suggestion,
    ingredients,
    kcal: Math.round(totals.kcal),
    protein: round1(totals.protein),
    carbs: round1(totals.carbs),
    fat: round1(totals.fat),
  };
}

export default function MealSuggestionsPage({ theme, setTheme }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [targetKcal, setTargetKcal] = useState(500);
  const [meal, setMeal] = useState(currentMeal);
  const [style, setStyle] = useState('balanced');
  const [mode, setMode] = useState('mixed');
  const [notes, setNotes] = useState('');
  const [pantryInput, setPantryInput] = useState(() => localStorage.getItem(`nutrix-pantry:${user.id}`) || '');
  const [pantryMode, setPantryMode] = useState(() => localStorage.getItem(`nutrix-pantry-mode:${user.id}`) === 'only' ? 'only' : 'prefer');
  const [preferences, setPreferences] = useState(() => loadStoredPreferences(user.id));
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [swapPanel, setSwapPanel] = useState({ key: null, loading: false, options: [] });

  const pantry = useMemo(() => parsePantry(pantryInput), [pantryInput]);
  const preferenceKey = `nutrix-meal-preferences:${user.id}`;
  const pantryKey = `nutrix-pantry:${user.id}`;
  const pantryModeKey = `nutrix-pantry-mode:${user.id}`;

  useEffect(() => {
    localStorage.setItem(pantryKey, pantryInput);
  }, [pantryInput, pantryKey]);

  useEffect(() => {
    localStorage.setItem(pantryModeKey, pantryMode);
  }, [pantryMode, pantryModeKey]);

  useEffect(() => {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
  }, [preferences, preferenceKey]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const days = lastNDays(30);
        const day = today();
        const [profileData, currentFood, recentFood] = await Promise.all([
          getProfile(user.id),
          getFoodForDay(user.id, day),
          getRecentFoodEntries(user.id, days[0], day),
        ]);
        if (!active) return;
        setProfile(profileData);
        setTodayEntries(currentFood);
        setHistoryEntries(recentFood);
      } catch (error) {
        toast(error?.message || 'Não foi possível carregar seu histórico', { type: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user.id]);

  const history = useMemo(() => buildHistoryProfile(historyEntries), [historyEntries]);
  const consumedToday = useMemo(
    () => todayEntries.reduce((sum, entry) => sum + Number(entry?.kcal || 0), 0),
    [todayEntries],
  );
  const dailyGoal = Number(profile?.daily_kcal_goal || 2000);
  const remainingToday = Math.max(0, Math.round(dailyGoal - consumedToday));

  const preferencePayload = useMemo(() => ({
    liked: preferences.liked.map(({ name, ingredients }) => ({ name, ingredients })),
    disliked: preferences.disliked.map(({ name, ingredients }) => ({ name, ingredients })),
  }), [preferences]);

  const addPantryItem = (name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const current = parsePantry(pantryInput);
    if (current.some((item) => normalizeName(item) === normalizeName(clean))) return;
    setPantryInput([...current, clean].join(', '));
  };

  const removePantryItem = (name) => {
    setPantryInput(pantry.filter((item) => normalizeName(item) !== normalizeName(name)).join(', '));
  };

  const getPreferenceStatus = (suggestion) => {
    const key = normalizeName(suggestion?.name);
    if (preferences.liked.some((item) => normalizeName(item.name) === key)) return 'liked';
    if (preferences.disliked.some((item) => normalizeName(item.name) === key)) return 'disliked';
    return null;
  };

  const rememberPreference = (suggestion, value) => {
    const key = normalizeName(suggestion?.name);
    const summary = {
      name: suggestion.name,
      ingredients: (suggestion.ingredients || []).map((item) => item.name).filter(Boolean).slice(0, 12),
      at: new Date().toISOString(),
    };

    setPreferences((current) => {
      const alreadyActive = current[value].some((item) => normalizeName(item.name) === key);
      const opposite = value === 'liked' ? 'disliked' : 'liked';
      return {
        ...current,
        [value]: alreadyActive
          ? current[value].filter((item) => normalizeName(item.name) !== key)
          : [summary, ...current[value].filter((item) => normalizeName(item.name) !== key)].slice(0, 25),
        [opposite]: current[opposite].filter((item) => normalizeName(item.name) !== key),
      };
    });
  };

  const generate = async () => {
    const kcal = Math.round(Number(targetKcal));
    if (!Number.isFinite(kcal) || kcal < 100 || kcal > 2000) {
      toast('Escolha entre 100 e 2.000 kcal para a refeição', { type: 'error' });
      return;
    }
    if (pantryMode === 'only' && pantry.length === 0) {
      toast('Adicione pelo menos um ingrediente em "O que tenho em casa"', { type: 'error' });
      return;
    }

    setGenerating(true);
    setSwapPanel({ key: null, loading: false, options: [] });
    try {
      const data = await getMealSuggestions({
        targetKcal: kcal,
        meal,
        style,
        mode,
        notes: notes.trim(),
        history,
        pantry,
        pantryMode,
        feedback: preferencePayload,
      });
      setSuggestions(data);
      if (!data.length) toast('Não encontrei sugestões agora. Tente novamente.', { type: 'error' });
    } catch (error) {
      toast(error?.message || 'Falha ao buscar sugestões', { type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const requestSwap = async (suggestion, ingredient, ingredientIndex) => {
    const key = `${suggestion.id}:${ingredientIndex}`;
    if (swapPanel.key === key && !swapPanel.loading) {
      setSwapPanel({ key: null, loading: false, options: [] });
      return;
    }

    setSwapPanel({ key, loading: true, options: [] });
    try {
      const options = await getIngredientSwaps({
        ingredient,
        suggestionName: suggestion.name,
        otherIngredients: suggestion.ingredients.filter((_, index) => index !== ingredientIndex).map((item) => item.name),
        pantry,
        pantryMode,
        history: history.map((item) => item.name),
        feedback: preferencePayload,
      });
      setSwapPanel({ key, loading: false, options });
    } catch (error) {
      setSwapPanel({ key: null, loading: false, options: [] });
      toast(error?.message || 'Não foi possível buscar substituições', { type: 'error' });
    }
  };

  const applySwap = (suggestionId, ingredientIndex, replacement) => {
    setSuggestions((current) => current.map((suggestion) => {
      if (suggestion.id !== suggestionId) return suggestion;
      const ingredients = suggestion.ingredients.map((item, index) => index === ingredientIndex ? replacement : item);
      return recalculateSuggestion(suggestion, ingredients);
    }));
    setSwapPanel({ key: null, loading: false, options: [] });
    toast(`Troquei por ${replacement.name} mantendo as calorias próximas`);
  };

  const addSuggestion = async (suggestion) => {
    if (!suggestion?.ingredients?.length) return;
    setAddingId(suggestion.id);
    try {
      const day = today();
      for (const ingredient of suggestion.ingredients) {
        await addFood(user.id, day, {
          meal,
          name: ingredient.name,
          grams: ingredient.grams,
          kcal: ingredient.kcal,
          protein: ingredient.protein,
          carbs: ingredient.carbs,
          fat: ingredient.fat,
          source: 'meal-suggestion',
          confidence: 'medium',
        });
      }
      const refreshed = await getFoodForDay(user.id, day);
      setTodayEntries(refreshed);
      toast(`${suggestion.name} adicionada ao seu dia`);
    } catch (error) {
      toast(error?.message || 'Não foi possível registrar a sugestão', { type: 'error' });
    } finally {
      setAddingId(null);
    }
  };

  const useRemaining = () => {
    const value = Math.max(100, Math.min(1200, remainingToday || 500));
    setTargetKcal(value);
  };

  const mealLabel = MEALS.find((item) => item.id === meal)?.label || 'dia';

  return (
    <div className="app-shell">
      <ProfessionalHeader theme={theme} setTheme={setTheme} />

      <main className="page" id="conteudo">
        <div className="page-inner">
          <header className="page-head">
            <div>
              <p className="page-date">Planejamento</p>
              <h1>O que comer agora?</h1>
              <p className="page-lead">Escolha quantas calorias quer comer. O Nutrix combina seu histórico, suas preferências e o que você tem em casa.</p>
            </div>
          </header>

          <div className="suggest-layout">
            <section className="card suggest-form" aria-labelledby="h-busca">
              <div className="card-head">
                <h2 id="h-busca">Monte a busca</h2>
                <span className="muted suggest-history-note">{loading ? 'Lendo histórico…' : `${history.length} alimentos frequentes`}</span>
              </div>

              <div className="suggest-budget">
                <div>
                  <span className="muted">Restante hoje</span>
                  <strong className="num">{remainingToday.toLocaleString('pt-BR')} kcal</strong>
                  <small className="muted num">{Math.round(consumedToday).toLocaleString('pt-BR')} de {dailyGoal.toLocaleString('pt-BR')} kcal consumidas</small>
                </div>
                <button type="button" className="btn" onClick={useRemaining}>Usar esse valor</button>
              </div>

              <div className="field">
                <label htmlFor="meal-target-kcal">Quero comer aproximadamente</label>
                <div className="goal-field-row">
                  <input id="meal-target-kcal" type="number" min="100" max="2000" step="25" value={targetKcal} onChange={(event) => setTargetKcal(event.target.value)} />
                  <span className="goal-field-unit muted">kcal</span>
                </div>
                <div className="chip-row" role="group" aria-label="Valores sugeridos">
                  {[300, 400, 500, 600, 700, 800].map((value) => (
                    <button type="button" key={value} className={`chip-btn ${Number(targetKcal) === value ? 'selected' : ''}`} aria-pressed={Number(targetKcal) === value} onClick={() => setTargetKcal(value)}>{value}</button>
                  ))}
                </div>
              </div>

              <div className="suggest-grid-2">
                <div className="field">
                  <label htmlFor="meal-meal">Refeição</label>
                  <select id="meal-meal" value={meal} onChange={(event) => setMeal(event.target.value)}>
                    {MEALS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="meal-style">Prioridade</label>
                  <select id="meal-style" value={style} onChange={(event) => setStyle(event.target.value)}>
                    {STYLES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                  </select>
                </div>
              </div>

              <fieldset className="suggest-fieldset">
                <legend>Tipo de sugestão</legend>
                <div className="option-grid three">
                  {MODES.map((item) => (
                    <button type="button" key={item.id} aria-pressed={mode === item.id} className={`option-card ${mode === item.id ? 'active' : ''}`} onClick={() => setMode(item.id)}>
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="suggest-pantry">
                <div className="suggest-pantry-head">
                  <div className="field-title"><label htmlFor="pantry">O que tenho em casa</label><small className="muted">Separe por vírgula. O Nutrix salva esta lista.</small></div>
                  <div className="segmented" role="group" aria-label="Como usar a lista">
                    <button type="button" aria-pressed={pantryMode === 'prefer'} className={pantryMode === 'prefer' ? 'active' : ''} onClick={() => setPantryMode('prefer')}>Priorizar</button>
                    <button type="button" aria-pressed={pantryMode === 'only'} className={pantryMode === 'only' ? 'active' : ''} onClick={() => setPantryMode('only')}>Só usar isso</button>
                  </div>
                </div>
                <textarea id="pantry" rows="2" value={pantryInput} onChange={(event) => setPantryInput(event.target.value)} placeholder="Por exemplo: arroz, frango, ovos, banana, aveia, queijo" />
                {pantry.length > 0 && (
                  <ul className="tag-list" aria-label="Ingredientes em casa">
                    {pantry.map((item) => (
                      <li key={normalizeName(item)}>
                        <button type="button" className="tag" onClick={() => removePantryItem(item)} aria-label={`Remover ${item}`}>{item}<Icon name="close" size={14} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                {history.length > 0 && (
                  <div className="tag-list frequent">
                    <span className="muted">Adicionar dos frequentes:</span>
                    {history.slice(0, 6).map((item) => (
                      <button type="button" className="tag" key={normalizeName(item.name)} onClick={() => addPantryItem(item.name)}><Icon name="plus" size={14} />{item.name}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="meal-notes">Algo que você quer hoje? <small className="muted">(opcional)</small></label>
                <textarea id="meal-notes" rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Por exemplo: algo com frango, sem muita louça, algo doce" />
              </div>

              <button type="button" className="btn primary suggest-generate" onClick={generate} disabled={generating || loading}>
                {generating ? 'Gerando sugestões…' : 'Encontrar o que comer'}
              </button>
            </section>

            <aside className="card suggest-aside" aria-labelledby="h-aprende">
              <h2 id="h-aprende">O que o Nutrix já sabe</h2>
              <p className="muted">Seu histórico, o que você tem em casa e suas avaliações entram nas próximas sugestões.</p>
              <dl className="suggest-stats">
                <div><dd className="num">{preferences.liked.length}</dd><dt>curtidas</dt></div>
                <div><dd className="num">{preferences.disliked.length}</dd><dt>evitadas</dt></div>
                <div><dd className="num">{pantry.length}</dd><dt>em casa</dt></div>
              </dl>
              <ul className="suggest-history">
                {history.slice(0, 6).map((item) => (
                  <li key={normalizeName(item.name)}><span>{item.name}</span><small className="muted num">{item.count}x</small></li>
                ))}
              </ul>
              {!loading && history.length === 0 && <p className="muted suggest-history-empty">Ainda não há histórico suficiente. As sugestões continuam funcionando normalmente.</p>}
            </aside>
          </div>

          <section className="suggest-results" aria-labelledby="h-sugestoes" aria-live="polite">
            <div className="section-head">
              <h2 id="h-sugestoes">{suggestions.length ? `Perto de ${Number(targetKcal).toLocaleString('pt-BR')} kcal` : 'Sugestões'}</h2>
              {suggestions.length > 0 && <button type="button" className="btn" onClick={generate} disabled={generating}><Icon name="refresh" size={17} /> Gerar outras</button>}
            </div>

            {generating ? (
              <div className="suggest-loading" aria-hidden="true">{[0, 1, 2, 3].map((item) => <div key={item}><span /><i /><i /><i /></div>)}</div>
            ) : suggestions.length > 0 ? (
              <div className="suggest-cards">
                {suggestions.map((suggestion) => {
                  const preferenceStatus = getPreferenceStatus(suggestion);
                  return (
                    <article className="card suggest-card" key={suggestion.id}>
                      <div className="suggest-card-top">
                        <span className="pill">{TYPE_LABELS[suggestion.type] || 'Sugestão'}</span>
                        <span className="muted num">{suggestion.prepMinutes} min</span>
                      </div>
                      <h3>{suggestion.name}</h3>
                      <p className="muted">{suggestion.description}</p>

                      <div className="suggest-kcal">
                        <strong className="num">{Math.round(suggestion.kcal)} <small>kcal</small></strong>
                        <span className="muted num">{kcalDistance(suggestion.kcal, Number(targetKcal))}</span>
                      </div>
                      <div className="suggest-macros num">
                        <span><b>{Math.round(suggestion.protein)} g</b> proteína</span>
                        <span><b>{Math.round(suggestion.carbs)} g</b> carboidratos</span>
                        <span><b>{Math.round(suggestion.fat)} g</b> gorduras</span>
                      </div>

                      {suggestion.reason && <p className="suggest-reason">{suggestion.reason}</p>}

                      <div className="feedback-row">
                        <span className="muted">Combina com você?</span>
                        <div>
                          <button type="button" className={`icon-btn ${preferenceStatus === 'liked' ? 'on' : ''}`} aria-pressed={preferenceStatus === 'liked'} onClick={() => rememberPreference(suggestion, 'liked')} aria-label={`Gostei de ${suggestion.name}`} title="Gostei"><Icon name="thumb-up" size={18} /></button>
                          <button type="button" className={`icon-btn ${preferenceStatus === 'disliked' ? 'on' : ''}`} aria-pressed={preferenceStatus === 'disliked'} onClick={() => rememberPreference(suggestion, 'disliked')} aria-label={`Não gostei de ${suggestion.name}`} title="Não gostei"><Icon name="thumb-down" size={18} /></button>
                        </div>
                      </div>

                      <details className="suggest-details">
                        <summary>Ver ingredientes, trocas e preparo</summary>
                        <ul className="ingredient-list">
                          {suggestion.ingredients.map((ingredient, index) => {
                            const swapKey = `${suggestion.id}:${index}`;
                            const opened = swapPanel.key === swapKey;
                            return (
                              <li key={`${ingredient.name}-${index}`}>
                                <div className="ingredient-row">
                                  <span>{ingredient.name}</span>
                                  <span className="muted num">{ingredient.grams} g · {Math.round(ingredient.kcal)} kcal</span>
                                  <button type="button" className="btn-link" onClick={() => requestSwap(suggestion, ingredient, index)} aria-expanded={opened}>Trocar</button>
                                </div>
                                {opened && (
                                  <div className="swap-panel">
                                    {swapPanel.loading ? (
                                      <span className="muted">Buscando opções com calorias parecidas…</span>
                                    ) : swapPanel.options.length ? (
                                      swapPanel.options.map((option) => (
                                        <button type="button" key={option.id} onClick={() => applySwap(suggestion.id, index, option)}>
                                          <span><strong>{option.name}</strong><small className="num">{option.grams} g · {option.kcal} kcal</small></span>
                                          <em>{option.reason || 'Calorias semelhantes'}</em>
                                        </button>
                                      ))
                                    ) : <span className="muted">Nenhuma troca encontrada.</span>}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        {suggestion.steps?.length > 0 && <ol className="steps">{suggestion.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}
                        {suggestion.sourceUrl && <a className="source-link" href={suggestion.sourceUrl} target="_blank" rel="noreferrer">Ver receita que inspirou esta sugestão <Icon name="external" size={14} /></a>}
                      </details>

                      <button type="button" className="btn primary" onClick={() => addSuggestion(suggestion)} disabled={addingId === suggestion.id}>
                        {addingId === suggestion.id ? 'Registrando…' : `Adicionar ao ${mealLabel.toLowerCase()}`}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="card empty-state">
                <strong>As sugestões vão aparecer aqui</strong>
                <small>Informe suas calorias e o que tem em casa. O Nutrix aprende seus gostos conforme você avalia.</small>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
