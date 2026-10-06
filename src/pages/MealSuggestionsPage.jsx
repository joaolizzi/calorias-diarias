import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { toast } from '../components/Toast.jsx';
import { addFood, getFoodForDay, getProfile, getRecentFoodEntries } from '../lib/supabase.js';
import { getIngredientSwaps, getMealSuggestions } from '../lib/gemini.js';
import { lastNDays, today } from '../lib/dates.js';
import './MealSuggestions.css';

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

export default function MealSuggestionsPage({ theme, accent, preset, setTheme, setAccent, setPreset }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [targetKcal, setTargetKcal] = useState(500);
  const [meal, setMeal] = useState(currentMeal);
  const [style, setStyle] = useState('balanced');
  const [mode, setMode] = useState('mixed');
  const [notes, setNotes] = useState('');
  const [pantryInput, setPantryInput] = useState('');
  const [pantryMode, setPantryMode] = useState('prefer');
  const [preferences, setPreferences] = useState(emptyPreferences);
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
    try {
      setPantryInput(localStorage.getItem(pantryKey) || '');
      setPantryMode(localStorage.getItem(pantryModeKey) === 'only' ? 'only' : 'prefer');
      const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
      if (saved && Array.isArray(saved.liked) && Array.isArray(saved.disliked)) setPreferences(saved);
    } catch {
      setPreferences(emptyPreferences());
    }
  }, [pantryKey, pantryModeKey, preferenceKey]);

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

  return (
    <div className="app meal-suggestions-page">
      <ProfessionalHeader
        subtitle="Sugestões de refeição"
        theme={theme}
        accent={accent}
        preset={preset}
        setTheme={setTheme}
        setAccent={setAccent}
        setPreset={setPreset}
      />

      <main className="meal-suggestions-shell">
        <header className="meal-suggestions-hero">
          <div>
            <span className="product-section-label">Planejamento</span>
            <h1>O que comer agora?</h1>
            <p>Escolha quantas calorias quer comer. O Nutrix combina seu histórico, suas preferências e o que você tem em casa.</p>
          </div>
          <div className="meal-budget-card">
            <span>Restante hoje</span>
            <strong>{remainingToday.toLocaleString('pt-BR')} kcal</strong>
            <small>{Math.round(consumedToday).toLocaleString('pt-BR')} de {dailyGoal.toLocaleString('pt-BR')} kcal consumidas</small>
            <button type="button" onClick={useRemaining}>Usar esse valor</button>
          </div>
        </header>

        <section className="meal-suggestion-builder">
          <div className="meal-builder-main">
            <div className="meal-builder-head">
              <div><span className="product-section-label">Sua refeição</span><h2>Monte a busca</h2></div>
              <span className="meal-history-pill">{loading ? 'Lendo histórico…' : `${history.length} alimentos frequentes`}</span>
            </div>

            <div className="meal-kcal-field">
              <label htmlFor="meal-target-kcal">Quero comer aproximadamente</label>
              <div className="meal-kcal-input-wrap">
                <input id="meal-target-kcal" type="number" min="100" max="2000" step="25" value={targetKcal} onChange={(event) => setTargetKcal(event.target.value)} />
                <span>kcal</span>
              </div>
              <div className="meal-kcal-presets">
                {[300, 400, 500, 600, 700, 800].map((value) => (
                  <button type="button" key={value} className={Number(targetKcal) === value ? 'active' : ''} onClick={() => setTargetKcal(value)}>{value}</button>
                ))}
              </div>
            </div>

            <div className="meal-builder-grid">
              <label className="meal-builder-field">
                <span>Refeição</span>
                <select value={meal} onChange={(event) => setMeal(event.target.value)}>
                  {MEALS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </select>
              </label>

              <label className="meal-builder-field">
                <span>Prioridade</span>
                <select value={style} onChange={(event) => setStyle(event.target.value)}>
                  {STYLES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>

            <div className="meal-mode-section">
              <span>Tipo de sugestão</span>
              <div className="meal-mode-grid">
                {MODES.map((item) => (
                  <button type="button" key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="meal-pantry-section">
              <div className="meal-pantry-head">
                <div><span>O que tenho em casa</span><small>Separe por vírgula. O Nutrix salva esta lista.</small></div>
                <div className="meal-pantry-policy">
                  <button type="button" className={pantryMode === 'prefer' ? 'active' : ''} onClick={() => setPantryMode('prefer')}>Priorizar</button>
                  <button type="button" className={pantryMode === 'only' ? 'active' : ''} onClick={() => setPantryMode('only')}>Só usar isso</button>
                </div>
              </div>
              <textarea
                rows="2"
                value={pantryInput}
                onChange={(event) => setPantryInput(event.target.value)}
                placeholder="Ex.: arroz, frango, ovos, banana, aveia, queijo..."
              />
              {pantry.length > 0 && (
                <div className="meal-pantry-chips">
                  {pantry.map((item) => <button type="button" key={normalizeName(item)} onClick={() => removePantryItem(item)} title="Remover">{item}<b>×</b></button>)}
                </div>
              )}
              {history.length > 0 && (
                <div className="meal-pantry-frequent">
                  <span>Adicionar dos frequentes:</span>
                  {history.slice(0, 6).map((item) => (
                    <button type="button" key={normalizeName(item.name)} onClick={() => addPantryItem(item.name)}>+ {item.name}</button>
                  ))}
                </div>
              )}
            </div>

            <label className="meal-notes-field">
              <span>Algo que você quer hoje? <small>opcional</small></span>
              <textarea rows="3" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: quero algo com frango, sem muita louça, algo doce..." />
            </label>

            <button type="button" className="meal-generate-btn" onClick={generate} disabled={generating || loading}>
              <span>{generating ? 'Gerando sugestões…' : 'Encontrar o que comer'}</span>
              {!generating && <b>→</b>}
            </button>
          </div>

          <aside className="meal-history-context">
            <span className="product-section-label">Personalização</span>
            <h3>O Nutrix está aprendendo</h3>
            <p>Seu histórico, o que você tem em casa e seus 👍/👎 entram nas próximas sugestões.</p>
            <div className="meal-learning-stats">
              <div><strong>{preferences.liked.length}</strong><span>curtidas</span></div>
              <div><strong>{preferences.disliked.length}</strong><span>evitadas</span></div>
              <div><strong>{pantry.length}</strong><span>em casa</span></div>
            </div>
            <div className="meal-history-list">
              {history.slice(0, 6).map((item) => (
                <div key={normalizeName(item.name)}><span>{item.name}</span><small>{item.count}x</small></div>
              ))}
              {!loading && history.length === 0 && <small className="meal-history-empty">Ainda não há histórico suficiente. As sugestões continuam funcionando normalmente.</small>}
            </div>
          </aside>
        </section>

        <section className="meal-results-section">
          <div className="meal-results-head">
            <div>
              <span className="product-section-label">Sugestões</span>
              <h2>{suggestions.length ? `Perto de ${Number(targetKcal).toLocaleString('pt-BR')} kcal` : 'Escolha uma meta e gere sugestões'}</h2>
            </div>
            {suggestions.length > 0 && <button type="button" className="meal-regenerate-btn" onClick={generate} disabled={generating}>Gerar outras</button>}
          </div>

          {generating ? (
            <div className="meal-suggestion-loading">
              {[0, 1, 2, 3].map((item) => <div key={item}><span /><i /><i /><i /></div>)}
            </div>
          ) : suggestions.length > 0 ? (
            <div className="meal-suggestion-grid">
              {suggestions.map((suggestion) => {
                const preferenceStatus = getPreferenceStatus(suggestion);
                return (
                  <article className="meal-suggestion-card" key={suggestion.id}>
                    <div className="meal-suggestion-top">
                      <span className={`meal-suggestion-type type-${suggestion.type}`}>{TYPE_LABELS[suggestion.type] || 'Sugestão'}</span>
                      <span className="meal-suggestion-time">{suggestion.prepMinutes} min</span>
                    </div>
                    <h3>{suggestion.name}</h3>
                    <p>{suggestion.description}</p>

                    <div className="meal-feedback-row">
                      <span>Essa sugestão combina com você?</span>
                      <div>
                        <button type="button" className={preferenceStatus === 'liked' ? 'active' : ''} onClick={() => rememberPreference(suggestion, 'liked')} aria-label="Gostei">👍 <small>Gostei</small></button>
                        <button type="button" className={preferenceStatus === 'disliked' ? 'active dislike' : ''} onClick={() => rememberPreference(suggestion, 'disliked')} aria-label="Não gostei">👎 <small>Não gostei</small></button>
                      </div>
                    </div>

                    <div className="meal-suggestion-kcal">
                      <strong>{Math.round(suggestion.kcal)} <small>kcal</small></strong>
                      <span>{kcalDistance(suggestion.kcal, Number(targetKcal))}</span>
                    </div>

                    <div className="meal-suggestion-macros">
                      <span><b>{Math.round(suggestion.protein)}g</b> proteína</span>
                      <span><b>{Math.round(suggestion.carbs)}g</b> carbo</span>
                      <span><b>{Math.round(suggestion.fat)}g</b> gordura</span>
                    </div>

                    {suggestion.reason && <div className="meal-suggestion-reason">{suggestion.reason}</div>}

                    <details className="meal-suggestion-details">
                      <summary>Ver ingredientes, trocas e preparo</summary>
                      <div className="meal-ingredient-list">
                        {suggestion.ingredients.map((ingredient, index) => {
                          const swapKey = `${suggestion.id}:${index}`;
                          const opened = swapPanel.key === swapKey;
                          return (
                            <div className="meal-ingredient-block" key={`${ingredient.name}-${index}`}>
                              <div className="meal-ingredient-row">
                                <span>{ingredient.name}</span>
                                <div><small>{ingredient.grams}g · {Math.round(ingredient.kcal)} kcal</small><button type="button" onClick={() => requestSwap(suggestion, ingredient, index)}>Trocar</button></div>
                              </div>
                              {opened && (
                                <div className="meal-swap-panel">
                                  {swapPanel.loading ? (
                                    <span>Buscando opções com calorias parecidas…</span>
                                  ) : swapPanel.options.length ? (
                                    swapPanel.options.map((option) => (
                                      <button type="button" key={option.id} onClick={() => applySwap(suggestion.id, index, option)}>
                                        <span><strong>{option.name}</strong><small>{option.grams}g · {option.kcal} kcal</small></span>
                                        <em>{option.reason || 'Calorias semelhantes'}</em>
                                      </button>
                                    ))
                                  ) : <span>Nenhuma troca encontrada.</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {suggestion.steps?.length > 0 && <ol>{suggestion.steps.map((step, index) => <li key={index}>{step}</li>)}</ol>}
                      {suggestion.sourceUrl && <a href={suggestion.sourceUrl} target="_blank" rel="noreferrer">Ver receita que inspirou esta sugestão ↗</a>}
                    </details>

                    <button type="button" className="meal-add-btn" onClick={() => addSuggestion(suggestion)} disabled={addingId === suggestion.id}>
                      {addingId === suggestion.id ? 'Registrando…' : `Adicionar ao ${MEALS.find((item) => item.id === meal)?.label || 'dia'}`}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="meal-results-empty">
              <span>○</span>
              <strong>As sugestões vão aparecer aqui</strong>
              <small>Informe suas calorias, o que tem em casa e deixe o Nutrix aprender seus gostos.</small>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
