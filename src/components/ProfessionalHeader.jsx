import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import AppearanceMenu from './AppearanceMenu.jsx';
import NutrixLogo from './NutrixLogo.jsx';

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

const navigationGroups = [
  {
    label: 'Principal',
    items: [
      ['/', '⌂', 'Dashboard', 'Visão geral'],
      ['/?panel=meals&focus=register', '+', 'Registrar', 'Adicionar refeição'],
      ['/?panel=meals', '◫', 'Rotina', 'Refeições do dia'],
    ],
  },
  {
    label: 'Progresso',
    items: [
      ['/?panel=insights', '◎', 'Metas', 'Objetivos e análise'],
      ['/?panel=history', '◷', 'Histórico', 'Evolução recente'],
    ],
  },
  {
    label: 'Planejamento',
    items: [
      ['/treinos', '◇', 'Treinos', 'Plano semanal'],
      ['/goal', '◉', 'Objetivo', 'Cálculo e ajustes'],
    ],
  },
];

export default function ProfessionalHeader({ subtitle, theme, accent, preset, setTheme, setAccent, setPreset }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = Boolean(
    user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL,
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', mobileOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [mobileOpen]);

  if (!user) return null;

  const emailInitial = String(user.email || 'N').charAt(0).toUpperCase();
  const currentUrl = `${location.pathname}${location.search}`;

  const isShortcutActive = (to) => {
    if (to === '/') return location.pathname === '/' && !location.search;
    if (to.startsWith('/?')) return currentUrl === to || (to === '/?panel=meals' && currentUrl === '/?panel=meals&focus=register');
    return location.pathname === to;
  };

  return (
    <>
      <div className="mobile-appbar">
        <NavLink to="/" className="mobile-brand" aria-label="Nutrix dashboard">
          <NutrixLogo className="brand-logo-mark" size={34} decorative />
          <span>Nutrix<span className="brand-accent">.</span></span>
        </NavLink>
        <button type="button" className="sidebar-mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" aria-expanded={mobileOpen}>
          <span /><span /><span />
        </button>
      </div>

      <button type="button" className={`sidebar-backdrop ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <NavLink to="/" className="sidebar-brand">
            <NutrixLogo className="brand-logo-mark" size={42} decorative />
            <span className="sidebar-brand-copy">
              <strong>Nutrix<span className="brand-accent">.</span></strong>
              <small>Painel pessoal</small>
            </span>
          </NavLink>
          <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">×</button>
        </div>

        <div className="sidebar-context">
          <span>Hoje</span>
          <strong>{subtitle || 'Seu painel pessoal'}</strong>
        </div>

        <div className="sidebar-tools sidebar-tools-top">
          <AppearanceMenu theme={theme} accent={accent} preset={preset} setTheme={setTheme} setAccent={setAccent} setPreset={setPreset} />
        </div>

        <nav className="sidebar-nav sidebar-nav-expanded" aria-label="Navegação principal">
          {navigationGroups.map((group) => (
            <div className="sidebar-nav-group" key={group.label}>
              <span className="sidebar-nav-label">{group.label}</span>
              {group.items.map(([to, icon, label, description]) => (
                <NavLink key={to} to={to} className={`sidebar-link ${isShortcutActive(to) ? 'active' : ''}`}>
                  <span className="sidebar-link-icon">{icon}</span>
                  <span className="sidebar-link-copy"><strong>{label}</strong><small>{description}</small></span>
                  <span className="sidebar-link-arrow">›</span>
                </NavLink>
              ))}
            </div>
          ))}

          {isAdmin && (
            <div className="sidebar-nav-group">
              <span className="sidebar-nav-label">Sistema</span>
              <NavLink to="/admin" className={`sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`}>
                <span className="sidebar-link-icon">⚙</span>
                <span className="sidebar-link-copy"><strong>Admin</strong><small>Painel interno</small></span>
                <span className="sidebar-link-arrow">›</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="sidebar-account">
          <div className="sidebar-avatar">{emailInitial}</div>
          <div className="sidebar-account-copy"><strong>Minha conta</strong><small title={user.email}>{user.email}</small></div>
          <button type="button" className="sidebar-logout" onClick={() => signOut()} title="Sair" aria-label="Sair">↗</button>
        </div>
      </aside>
    </>
  );
}
