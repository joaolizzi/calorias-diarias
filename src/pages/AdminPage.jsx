import { useEffect, useState } from 'react';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { toast } from '../components/Toast.jsx';

const labels = { lose: 'Perder peso', maintain: 'Manter peso', gain: 'Ganhar massa', not_set: 'Sem objetivo' };
function formatDate(value) { if (!value) return '—'; return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }

export default function AdminPage({ theme, setTheme }) {
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { const { data: sessionData } = await supabase.auth.getSession(); const token = sessionData.session?.access_token; if (!token) throw new Error('Sessão expirada'); const response = await fetch('/api/admin', { headers: { Authorization: `Bearer ${token}` } }); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error || 'Acesso negado'); setData(payload.data); } catch (error) { setData(null); toast(error.message || 'Não foi possível carregar o painel admin', { type: 'error' }); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const shell = (content) => (
    <div className="app-shell">
      <ProfessionalHeader theme={theme} setTheme={setTheme} />
      <main className="page" id="conteudo"><div className="page-inner">{content}</div></main>
    </div>
  );

  if (loading) return shell(<div className="route-loading" role="status">Carregando visão geral…</div>);
  if (!data) return shell(<div className="card"><h2>Área administrativa</h2><p className="muted">Você não tem acesso a esta área.</p></div>);

  return shell(
    <>
      <header className="page-head">
        <div>
          <p className="page-date">Administração</p>
          <h1>Visão geral</h1>
          <p className="page-lead">Panorama dos usuários cadastrados e das metas configuradas.</p>
        </div>
        <div className="page-head-actions"><button type="button" className="btn" onClick={load}><Icon name="refresh" size={17} /> Atualizar</button></div>
      </header>

      <dl className="admin-stats">
        <div><dt>Usuários</dt><dd className="num">{data.totalUsers}</dd><small>Total cadastrado</small></div>
        <div><dt>Onboarding</dt><dd className="num">{data.onboardedUsers}</dd><small>{data.pendingSetup} pendente(s)</small></div>
        <div><dt>Média de calorias</dt><dd className="num">{data.averageKcalGoal.toLocaleString('pt-BR')}</dd><small>Meta diária, kcal</small></div>
        <div><dt>Média de água</dt><dd className="num">{data.averageWaterGoal.toLocaleString('pt-BR')}</dd><small>Meta diária, ml</small></div>
      </dl>

      <div className="admin-grid">
        <section className="card" aria-labelledby="h-obj">
          <div className="card-head"><div><h2 id="h-obj">Objetivos</h2><p className="muted">Distribuição dos planos atuais</p></div></div>
          <ul className="distribution">
            {Object.entries(data.goalCounts).map(([goal, count]) => (
              <li className="distribution-row" key={goal}>
                <span>{labels[goal] || goal}</span>
                <div className="distribution-track" role="img" aria-label={`${count} de ${data.totalUsers}`}><i style={{ width: `${data.totalUsers ? Math.max(5, count / data.totalUsers * 100) : 0}%` }} /></div>
                <strong className="num">{count}</strong>
              </li>
            ))}
          </ul>
          <div className="admin-average"><span className="muted">Peso médio</span><strong className="num">{data.averageWeightKg || '—'} kg</strong></div>
        </section>

        <section className="card table-card" aria-labelledby="h-rec">
          <div className="card-head table-card-head"><div><h2 id="h-rec">Usuários recentes</h2><p className="muted">Últimos cadastrados</p></div></div>
          <div className="table-scroll">
            <table className="data-table user-table">
              <thead><tr><th scope="col">Usuário</th><th scope="col">Objetivo</th><th scope="col">Meta</th><th scope="col">Cadastro</th></tr></thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id}>
                    <th scope="row"><strong>{user.display_name || 'Sem nome'}</strong><span>{user.email}</span></th>
                    <td><span className={`pill ${user.onboarding_complete ? 'good' : ''}`}>{labels[user.goal] || 'Pendente'}</span></td>
                    <td className="num">{user.daily_kcal_goal ? `${user.daily_kcal_goal} kcal` : '—'}</td>
                    <td className="num">{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
