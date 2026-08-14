import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();

export default function Header({ subtitle }) {
  const { user, signOut } = useAuth();
  const isAdmin = Boolean(user?.email && ADMIN_EMAIL && user.email.toLowerCase() === ADMIN_EMAIL);

  return (
    <header className="app-header">
      <div className="brand-block">
        <NavLink to="/" className="brand-link"><span className="brand-mark">C</span><span>Calorias<span className="brand-accent">.</span></span></NavLink>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {user && (
        <div className="header-right">
          <nav className="main-nav" aria-label="Navegação principal">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
            <NavLink to="/goal" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Meu Goal</NavLink>
            {isAdmin && <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link admin-link active' : 'nav-link admin-link'}>Admin</NavLink>}
          </nav>
          <div className="header-account"><div className="user">{user.email}</div><button className="btn header-logout" onClick={() => signOut()} title="Sair">Sair</button></div>
        </div>
      )}
    </header>
  );
}
