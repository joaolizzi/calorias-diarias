import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import AppearanceMenu from './AppearanceMenu.jsx';
import NutrixLogo from './NutrixLogo.jsx';

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

const baseItems = [
  ['/', '⌂', 'Dashboard', 'Visão do dia'],
  ['/treinos', '◇', 'Treinos', 'Plano semanal'],
  ['/goal', '◎', 'Objetivo', 'Metas e cálculo'],
];

export default function ProfessionalHeader({ subtitle, theme, accent, setTheme, setAccent }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = Boolean(
    user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL,
  );

  const items = [
    ...baseItems,
    ...(isAdmin ? [['/admin', '⚙', 'Admin', 'Painel interno']] : []),
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', mobileOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [mobileOpen]);

  if (!user) return null;

  const emailInitial = String(user.email || 'N').charAt(0).toUpperCase();

  return (
    <>
      <div className="mobile-appbar">
        <NavLink to="/" className="mobile-brand" aria-label="Nutrix dashboard">
          <NutrixLogo className="brand-logo-mark" size={34} decorative />
          <span>Nutrix<span className="brand-accent">.</span></span>
        </NavLink>
        <button
          type="button"
          className="sidebar-mobile-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <button
        type="button"
        className={`sidebar-backdrop ${mobileOpen ? 'show' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-label="Fechar menu"
      />

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <NavLink to="/" className="sidebar-brand">
            <NutrixLogo className="brand-logo-mark" size={42} decorative />
            <span className="sidebar-brand-copy">
              <strong>Nutrix<span className="brand-accent">.</span></strong>
              <small>Nutrition OS</small>
            </span>
          </NavLink>

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >×</button>
        </div>

        <div className="sidebar-context">
          <span>Hoje</span>
          <strong>{subtitle || 'Seu painel pessoal'}</strong>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          <span className="sidebar-nav-label">Navegação</span>
          {items.map(([to, icon, label, description]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-link-icon">{icon}</span>
              <span className="sidebar-link-copy">
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
              <span className="sidebar-link-arrow">›</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-premium-card">
          <span className="sidebar-premium-dot" />
          <div>
            <strong>Nutrix Intelligence</strong>
            <small>IA, histórico e metas em um só lugar.</small>
          </div>
        </div>

        <div className="sidebar-tools">
          <AppearanceMenu
            theme={theme}
            accent={accent}
            setTheme={setTheme}
            setAccent={setAccent}
          />
        </div>

        <div className="sidebar-account">
          <div className="sidebar-avatar">{emailInitial}</div>
          <div className="sidebar-account-copy">
            <strong>Minha conta</strong>
            <small title={user.email}>{user.email}</small>
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => signOut()}
            title="Sair"
            aria-label="Sair"
          >↗</button>
        </div>
      </aside>
    </>
  );
}
