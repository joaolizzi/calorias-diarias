import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import AppearanceMenu from './AppearanceMenu.jsx';
import NutrixLogo from './NutrixLogo.jsx';

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

const navigationGroups = [
  {
    label: 'Visão geral',
    items: [
      { to: '/', icon: 'home', label: 'Hoje', description: 'Resumo do seu dia' },
      { to: '/?panel=history', icon: 'history', label: 'Histórico', description: 'Evolução e registros' },
    ],
  },
  {
    label: 'Nutrição',
    items: [
      { to: '/?panel=meals&focus=ai', icon: 'sparkles', label: 'Nutrix IA', description: 'Descrever uma refeição', badge: 'IA' },
      { to: '/?panel=insights', icon: 'target', label: 'Metas', description: 'Objetivos e análise' },
    ],
  },
  {
    label: 'Planejamento',
    items: [
      { to: '/treinos', icon: 'dumbbell', label: 'Treinos', description: 'Plano semanal' },
      { to: '/goal', icon: 'goal', label: 'Objetivo', description: 'Calorias e ajustes' },
    ],
  },
];

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

  if (name === 'home') return <svg {...common}><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg>;
  if (name === 'history') return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>;
  if (name === 'sparkles') return <svg {...common}><path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z"/><path d="m18.5 13 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/><path d="m5.5 14 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/></svg>;
  if (name === 'target') return <svg {...common}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/></svg>;
  if (name === 'dumbbell') return <svg {...common}><path d="M6 7v10M3.5 9v6M18 7v10M20.5 9v6M6 12h12M2 12h1.5M20.5 12H22"/></svg>;
  if (name === 'goal') return <svg {...common}><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>;
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
  if (name === 'water') return <svg {...common}><path d="M12 3s5 5.5 5 10a5 5 0 0 1-10 0c0-4.5 5-10 5-10Z"/><path d="M9.5 14.5c.6 1.1 1.5 1.6 2.5 1.6"/></svg>;
  if (name === 'admin') return <svg {...common}><path d="M12 3 4.5 6v5.5c0 4.5 3 7.6 7.5 9.5 4.5-1.9 7.5-5 7.5-9.5V6L12 3Z"/><path d="M9.5 12 11 13.5l3.5-3.5"/></svg>;
  if (name === 'logout') return <svg {...common}><path d="M10 5H5v14h5"/><path d="m14 8 4 4-4 4M8 12h10"/></svg>;
  return null;
}

export default function ProfessionalHeader({ subtitle, theme, accent, preset, setTheme, setAccent, setPreset }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = Boolean(user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL);

  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', mobileOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [mobileOpen]);

  if (!user) return null;

  const emailInitial = String(user.email || 'N').charAt(0).toUpperCase();
  const currentUrl = `${location.pathname}${location.search}`;
  const isActive = (to) => {
    if (to === '/') return location.pathname === '/' && !location.search;
    if (to.startsWith('/?')) return currentUrl === to;
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
            <NutrixLogo className="brand-logo-mark" size={40} decorative />
            <span className="sidebar-brand-copy">
              <strong>Nutrix<span className="brand-accent">.</span></strong>
              <small>Nutrição pessoal</small>
            </span>
          </NavLink>
          <button type="button" className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">×</button>
        </div>

        <div className="sidebar-day-card">
          <div><span>Hoje</span><strong>{subtitle || 'Seu painel pessoal'}</strong></div>
          <span className="sidebar-day-dot" />
        </div>

        <div className="sidebar-quick-actions">
          <NavLink to="/?panel=meals&focus=register" className="sidebar-primary-action">
            <Icon name="plus" size={17} />
            <span>Registrar refeição</span>
          </NavLink>
          <NavLink to="/?focus=water" className="sidebar-water-action" title="Registrar água" aria-label="Registrar água">
            <Icon name="water" size={17} />
          </NavLink>
        </div>

        <nav className="sidebar-nav sidebar-nav-expanded" aria-label="Navegação principal">
          {navigationGroups.map((group) => (
            <div className="sidebar-nav-group" key={group.label}>
              <span className="sidebar-nav-label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={`sidebar-link ${isActive(item.to) ? 'active' : ''}`}>
                  <span className="sidebar-link-icon"><Icon name={item.icon} /></span>
                  <span className="sidebar-link-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  {item.badge ? <span className="sidebar-link-badge">{item.badge}</span> : <span className="sidebar-link-arrow">›</span>}
                </NavLink>
              ))}
            </div>
          ))}

          {isAdmin && (
            <div className="sidebar-nav-group">
              <span className="sidebar-nav-label">Sistema</span>
              <NavLink to="/admin" className={`sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`}>
                <span className="sidebar-link-icon"><Icon name="admin" /></span>
                <span className="sidebar-link-copy"><strong>Admin</strong><small>Painel interno</small></span>
                <span className="sidebar-link-arrow">›</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="sidebar-tools sidebar-tools-top">
          <AppearanceMenu theme={theme} accent={accent} preset={preset} setTheme={setTheme} setAccent={setAccent} setPreset={setPreset} />
        </div>

        <div className="sidebar-account">
          <div className="sidebar-avatar">{emailInitial}</div>
          <div className="sidebar-account-copy"><strong>Minha conta</strong><small title={user.email}>{user.email}</small></div>
          <button type="button" className="sidebar-logout" onClick={() => signOut()} title="Sair" aria-label="Sair"><Icon name="logout" size={16} /></button>
        </div>
      </aside>
    </>
  );
}
