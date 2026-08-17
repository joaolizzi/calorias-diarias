import { useEffect, useState } from 'react';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import { supabase } from '../lib/supabase.js';
import { toast } from '../components/Toast.jsx';

const labels = { lose: 'Perder peso', maintain: 'Manter peso', gain: 'Ganhar massa', not_set: 'Sem objetivo' };
function formatDate(value) { if (!value) return '—'; return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function AdminPage({ theme, accent, setTheme, setAccent }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const { data: sessionData } = await supabase.auth.getSession(); const token = sessionData.session?.access_token; if (!token) throw new Error('Sessão expirada'); const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } }); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || 'Acesso negado'); setData(payload.data); } catch (error) { setData(null); toast(error.message || 'Não foi possível carregar o painel admin', { type: 'error' }); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  return <div className="admin-page"><div className="admin-page-header"><ProfessionalHeader subtitle="Controle administrativo" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent}/></div>
    {loading && <div className="admin-shell"><div className="admin-loading">Carregando visão geral…</div></div>}
    {!loading && !data && <div className="admin-shell"><div className="card"><h2>Área administrativa</h2><p className="muted">Você não tem acesso a esta área.</p></div></div>}
    {!loading && data && <div className="admin-shell"><div className="admin-heading"><div><div className="eyebrow">ADMIN CONTROL</div><h1>Visão geral</h1><p>Panorama dos usuários cadastrados e das metas configuradas.</p></div><button className="btn" onClick={load}>Atualizar</button></div>
      <div className="admin-stats"><div className="admin-stat"><span>Usuários</span><strong>{data.totalUsers}</strong><small>Total cadastrado</small></div><div className="admin-stat"><span>Onboarding</span><strong>{data.onboardedUsers}</strong><small>{data.pendingSetup} pendente(s)</small></div><div className="admin-stat"><span>Média kcal</span><strong>{data.averageKcalGoal.toLocaleString('pt-BR')}</strong><small>Meta diária</small></div><div className="admin-stat"><span>Média água</span><strong>{data.averageWaterGoal.toLocaleString('pt-BR')} ml</strong><small>Meta diária</small></div></div>
      <div className="admin-grid"><section className="card admin-panel"><div className="admin-panel-title"><div><h2>Objetivos</h2><span>Distribuição dos planos atuais</span></div></div><div className="goal-distribution">{Object.entries(data.goalCounts).map(([goal, count]) => <div className="distribution-row" key={goal}><span>{labels[goal] || goal}</span><div className="distribution-track"><i style={{ width: `${data.totalUsers ? Math.max(5, count / data.totalUsers * 100) : 0}%` }}/></div><strong>{count}</strong></div>)}</div><div className="admin-average"><span>Peso médio</span><strong>{data.averageWeightKg || '—'} kg</strong></div></section>
        <section className="card admin-panel"><div className="admin-panel-title"><div><h2>Usuários recentes</h2><span>Últimos cadastrados</span></div></div><div className="user-table-wrap"><table className="user-table"><thead><tr><th>Usuário</th><th>Objetivo</th><th>Meta</th><th>Cadastro</th></tr></thead><tbody>{data.users.map(user => <tr key={user.id}><td><strong>{user.display_name || 'Sem nome'}</strong><span>{user.email}</span></td><td><span className={user.onboarding_complete ? 'status-pill good' : 'status-pill'}>{labels[user.goal] || 'Pendente'}</span></td><td>{user.daily_kcal_goal ? `${user.daily_kcal_goal} kcal` : '—'}</td><td>{formatDate(user.created_at)}</td></tr>)}</tbody></table></div></section></div>
    </div>}
  </div>;
}
