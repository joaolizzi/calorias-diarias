import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { getFinanceSettings, saveFinanceSettings, getFinanceTransactions, addFinanceTransaction, deleteFinanceTransaction } from '../lib/supabase.js';
import './FinancePage.css';

const CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Contas', 'Lazer', 'Compras', 'Saúde', 'Educação', 'Assinaturas', 'Salário', 'Investimentos', 'Outros'];
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (date) => String(date).slice(0, 7);
const monthLabel = (value) => { const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`)); return label.charAt(0).toUpperCase() + label.slice(1); };

export default function FinancePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({ current_balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(monthKey(today()));
  const [view, setView] = useState('resumo');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [form, setForm] = useState({ type: 'expense', description: '', category: 'Outros', amount: '', transaction_date: today() });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [s, tx] = await Promise.all([getFinanceSettings(user.id), getFinanceTransactions(user.id)]);
      setSettings(s || { current_balance: 0 });
      setTransactions(tx || []);
    } catch (e) { console.error('Falha ao carregar finanças:', e); }
    finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { reload(); }, [reload]);

  const currentMonthTransactions = useMemo(() => transactions.filter((t) => monthKey(t.transaction_date) === month), [transactions, month]);
  const totals = useMemo(() => currentMonthTransactions.reduce((acc, t) => { const amount = Number(t.amount || 0); if (t.type === 'income') acc.income += amount; else acc.expense += amount; return acc; }, { income: 0, expense: 0 }), [currentMonthTransactions]);
  const balance = Number(settings?.current_balance || 0) + transactions.reduce((sum, t) => sum + (t.type === 'income' ? 1 : -1) * Number(t.amount || 0), 0);
  const filteredTransactions = useMemo(() => currentMonthTransactions.filter((t) => { const text = `${t.description || ''} ${t.category || ''}`.toLowerCase(); return (!search || text.includes(search.toLowerCase())) && (categoryFilter === 'Todas' || t.category === categoryFilter); }), [currentMonthTransactions, search, categoryFilter]);
  const monthlyHistory = useMemo(() => {
    if (!transactions.length) return [{ month, income: 0, expense: 0, finalBalance: balance }];
    const keys = new Set(transactions.map((t) => monthKey(t.transaction_date))); keys.add(month); const ordered = [...keys].sort(); let running = Number(settings?.current_balance || 0);
    return ordered.map((key) => { const rows = transactions.filter((t) => monthKey(t.transaction_date) === key); const income = rows.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0); const expense = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0); running += income - expense; return { month: key, income, expense, finalBalance: running }; });
  }, [transactions, settings, month, balance]);

  const saveBalance = async (e) => { e.preventDefault(); const amount = Number(String(balanceInput).replace(',', '.')); if (!Number.isFinite(amount) || amount < 0) return; setSaving(true); try { await saveFinanceSettings(user.id, amount); setShowBalance(false); await reload(); } finally { setSaving(false); } };
  const addTransaction = async (e) => { e.preventDefault(); const amount = Number(String(form.amount).replace(',', '.')); if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0) return; setSaving(true); try { await addFinanceTransaction(user.id, { ...form, amount }); setForm({ ...form, description: '', amount: '', transaction_date: today() }); await reload(); } finally { setSaving(false); } };
  const deleteTransaction = async (id) => { if (!window.confirm('Excluir este lançamento?')) return; await deleteFinanceTransaction(id); await reload(); };
  const moveMonth = (delta) => { const d = new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth() + delta); setMonth(d.toISOString().slice(0, 7)); };

  return <div className="finance-app">
    <header className="finance-header"><div><div className="finance-brand">Finanças</div><div className="finance-subtitle">Seu dinheiro, organizado de forma simples.</div></div><div className="finance-actions"><button className="finance-ghost" onClick={() => navigate('/calorias')}>Calorias</button><button className="finance-ghost" onClick={() => { setBalanceInput(String(settings?.current_balance || 0)); setShowBalance(true); }}>Definir saldo</button><button className="finance-ghost" onClick={signOut}>Sair</button></div></header>
    <section className="finance-cards"><article className="finance-card finance-card-main"><span>Saldo disponível</span><strong>{BRL.format(balance)}</strong><small>Base: {BRL.format(Number(settings?.current_balance || 0))}</small></article><article className="finance-card"><span>Entradas em {monthLabel(month)}</span><strong>{BRL.format(totals.income)}</strong></article><article className="finance-card"><span>Gastos em {monthLabel(month)}</span><strong>{BRL.format(totals.expense)}</strong></article><article className="finance-card"><span>Resultado do mês</span><strong>{BRL.format(totals.income - totals.expense)}</strong></article></section>
    <section className="finance-panel"><div className="finance-panel-head"><div><h2>Adicionar lançamento</h2><p>Registre entradas e gastos para construir seu histórico.</p></div></div><form className="finance-form" onSubmit={addTransaction}><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="expense">Gasto</option><option value="income">Entrada</option></select><input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select><input inputMode="decimal" placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} /><button className="finance-primary" disabled={saving}>Adicionar</button></form></section>
    <section className="finance-panel"><div className="finance-panel-head history-head"><div><h2>Histórico mensal</h2><p>Uma visão tipo planilha para acompanhar cada mês.</p></div><div className="month-nav"><button onClick={() => moveMonth(-1)}>‹</button><strong>{monthLabel(month)}</strong><button onClick={() => moveMonth(1)}>›</button></div></div><div className="view-switch"><button className={view === 'resumo' ? 'active' : ''} onClick={() => setView('resumo')}>Resumo</button><button className={view === 'tabela' ? 'active' : ''} onClick={() => setView('tabela')}>Tabela</button></div>
      {view === 'resumo' ? <div className="month-table-wrap"><table className="month-table"><thead><tr><th>Mês</th><th>Entradas</th><th>Gastos</th><th>Resultado</th><th>Saldo final</th></tr></thead><tbody>{monthlyHistory.map((row) => <tr key={row.month} className={row.month === month ? 'selected-row' : ''} onClick={() => setMonth(row.month)}><td>{monthLabel(row.month)}</td><td className="income">+ {BRL.format(row.income)}</td><td className="expense">− {BRL.format(row.expense)}</td><td>{BRL.format(row.income - row.expense)}</td><td><strong>{BRL.format(row.finalBalance)}</strong></td></tr>)}</tbody></table></div> : <><div className="table-tools"><input placeholder="Pesquisar lançamento..." value={search} onChange={(e) => setSearch(e.target.value)} /><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option>Todas</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div><div className="month-table-wrap"><table className="month-table ledger"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Valor</th><th></th></tr></thead><tbody>{filteredTransactions.map((t) => <tr key={t.id}><td>{new Date(`${t.transaction_date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td>{t.description}</td><td>{t.category || 'Outros'}</td><td>{t.type === 'income' ? 'Entrada' : 'Gasto'}</td><td className={t.type === 'income' ? 'income' : 'expense'}>{t.type === 'income' ? '+' : '−'} {BRL.format(Number(t.amount))}</td><td><button className="delete-btn" onClick={() => deleteTransaction(t.id)}>Excluir</button></td></tr>)}{!filteredTransactions.length && <tr><td colSpan="6" className="empty">Nenhum lançamento neste mês.</td></tr>}</tbody></table></div></>}
    </section>
    {showBalance && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowBalance(false)}><form className="finance-modal" onSubmit={saveBalance}><h2>Quanto dinheiro você tem?</h2><p>Defina o saldo-base que o Finanças usará para calcular sua evolução.</p><input autoFocus inputMode="decimal" placeholder="Ex.: 2500" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} /><div><button type="button" className="finance-ghost" onClick={() => setShowBalance(false)}>Cancelar</button><button className="finance-primary" disabled={saving}>Salvar saldo</button></div></form></div>}
    {loading && <div className="finance-loading">Carregando seus dados…</div>}
  </div>;
}
