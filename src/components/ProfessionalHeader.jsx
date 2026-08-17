import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import AppearanceMenu from './AppearanceMenu.jsx';

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

export default function ProfessionalHeader({ subtitle, theme, accent, setTheme, setAccent }) {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const isAdmin = Boolean(
    user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL,
  );

  const items = [
    ['/', '🏠', 'Dashboard'],
    ['/treinos', '🏋️', 'Treinos'],
    ['/goal', '🎯', 'Objetivo'],
    ...(isAdmin ? [['/admin', '⚙️', 'Admin']] : []),
  ];

  return (
    <header className="app-header professional-header">
      <div className="brand-block">
        <NavLink to="/" className="brand-link">
          <span className="brand-mark">N</span>
          <span>
            Nutrix<span className="brand-accent">.</span>
          </span>
        </NavLink>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>

      {user && (
        <div className="header-right">
          <div className="main-menu-wrap">
            <button
              className="main-menu-button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              ☰ <span>Menu</span> ⌄
            </button>
            {open && (
              <div className="main-menu-dropdown">
                {items.map(([to, icon, label]) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `main-menu-item ${isActive ? 'active' : ''}`
                    }
                  >
                    <span>{icon}</span>
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <AppearanceMenu
            theme={theme}
            accent={accent}
            setTheme={setTheme}
            setAccent={setAccent}
          />

          <div className="header-account">
            <div className="user header-user">{user.email}</div>
            <button
              className="btn header-logout"
              onClick={() => signOut()}
              title="Sair"
            >
              Sair
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
