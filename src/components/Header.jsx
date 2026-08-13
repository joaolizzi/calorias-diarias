import { useAuth } from '../contexts/AuthContext.jsx';

export default function Header({ subtitle }) {
  const { user, signOut } = useAuth();

  return (
    <header className="app-header">
      <div>
        <h1>🍽️ Calorias & Água</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="user">{user.email}</div>
          <button className="btn" onClick={() => signOut()} title="Sair">
            Sair
          </button>
        </div>
      )}
    </header>
  );
}