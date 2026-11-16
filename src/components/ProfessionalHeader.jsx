import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import AppearanceMenu from './AppearanceMenu.jsx';
import NutrixLogo from './NutrixLogo.jsx';
import Icon from './Icon.jsx';

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

const NAV_ITEMS = [
  { id: 'today', to: '/', icon: 'home', label: 'Hoje' },
  { id: 'history', to: '/?panel=history', icon: 'history', label: 'Histórico' },
  { id: 'ai', to: '/?panel=meals&focus=ai', icon: 'sparkles', label: 'Nutrix IA' },
  { id: 'eat', to: '/sugestoes', icon: 'meal', label: 'O que comer' },
  { id: 'goals', to: '/?panel=insights', icon: 'target', label: 'Metas' },
  { id: 'workouts', to: '/treinos', icon: 'dumbbell', label: 'Treinos' },
  { id: 'plan', to: '/goal', icon: 'goal', label: 'Objetivo' },
];

const TAB_ITEMS = ['today', 'history', 'ai'];

export default function ProfessionalHeader({ theme, setTheme }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = Boolean(user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL);

  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', mobileOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [mobileOpen]);
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  if (!user) return null;

  const emailInitial = String(user.email || 'N').charAt(0).toUpperCase();
  const params = new URLSearchParams(location.search);
  const panel = params.get('panel');
  const focus = params.get('focus');

  const isActive = (id) => {
    if (location.pathname === '/') {
      if (id === 'today') return (!panel || panel === 'meals') && focus !== 'ai';
      if (id === 'ai') return panel === 'meals' && focus === 'ai';
      if (id === 'history') return panel === 'history';
      if (id === 'goals') return panel === 'insights';
      return false;
    }
    if (id === 'eat') return location.pathname === '/sugestoes';
    if (id === 'workouts') return location.pathname === '/treinos';
    if (id === 'plan') return location.pathname === '/goal';
    return false;
  };

  const linkClass = (id) => `nav-link ${isActive(id) ? 'active' : ''}`;
  const tabItems = NAV_ITEMS.filter((item) => TAB_ITEMS.includes(item.id));
  const moreActive = !TAB_ITEMS.some(isActive) && location.pathname !== '/admin';

  return (
    <>
      <header className="mobile-appbar">
        <Link to="/" className="brand" aria-label="Nutrix, ir para Hoje">
          <NutrixLogo className="brand-mark" size={28} decorative />
          <span className="brand-name">Nutrix<span className="brand-dot">.</span></span>
        </Link>
        <button type="button" className="avatar-btn" onClick={() => setMobileOpen(true)} aria-label="Abrir conta e aparência" aria-expanded={mobileOpen}>
          {emailInitial}
        </button>
      </header>

      <button type="button" className={`sidebar-backdrop ${mobileOpen ? 'show' : ''}`} onClick={() => setMobileOpen(false)} aria-label="Fechar menu" tabIndex={mobileOpen ? 0 : -1} />

      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Menu">
        <div className="sidebar-top">
          <Link to="/" className="brand" aria-label="Nutrix, ir para Hoje">
            <NutrixLogo className="brand-mark" size={30} decorative />
            <span className="brand-name">Nutrix<span className="brand-dot">.</span></span>
          </Link>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="sidebar-actions">
          <Link to="/?panel=meals&focus=register" className="btn primary sidebar-register">
            <Icon name="plus" size={18} />
            <span>Registrar refeição</span>
          </Link>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <Link key={item.id} to={item.to} className={linkClass(item.id)} aria-current={isActive(item.id) ? 'page' : undefined}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`} aria-current={location.pathname === '/admin' ? 'page' : undefined}>
              <Icon name="admin" size={19} />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        <div className="sidebar-foot">
          <AppearanceMenu theme={theme} setTheme={setTheme} />
          <div className="sidebar-account">
            <span className="avatar" aria-hidden="true">{emailInitial}</span>
            <span className="sidebar-account-copy"><strong>Minha conta</strong><small title={user.email}>{user.email}</small></span>
            <button type="button" className="icon-btn" onClick={() => signOut()} title="Sair" aria-label="Sair">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>

      <nav className="tabbar" aria-label="Navegação principal">
        {tabItems.slice(0, 2).map((item) => (
          <Link key={item.id} to={item.to} className={`tab ${isActive(item.id) ? 'active' : ''}`} aria-current={isActive(item.id) ? 'page' : undefined}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </Link>
        ))}
        <Link to="/?panel=meals&focus=register" className="tab-register" aria-label="Registrar refeição">
          <Icon name="plus" size={26} />
        </Link>
        {tabItems.slice(2).map((item) => (
          <Link key={item.id} to={item.to} className={`tab ${isActive(item.id) ? 'active' : ''}`} aria-current={isActive(item.id) ? 'page' : undefined}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" className={`tab ${moreActive ? 'active' : ''}`} onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen}>
          <Icon name="more" size={22} />
          <span>Mais</span>
        </button>
      </nav>
    </>
  );
}
