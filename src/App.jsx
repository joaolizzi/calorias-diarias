import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { getProfile } from './lib/supabase.js';
import AuthGate from './components/AuthGate.jsx';
import Dashboard from './pages/Dashboard.jsx';
import GoalPage from './pages/GoalPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

const THEME_KEY = 'nutrix-theme';
const ACCENT_KEY = 'nutrix-accent';

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem(ACCENT_KEY) || 'green');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [theme, accent]);

  return children({ theme, accent, setTheme, setAccent });
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading">Carregando…</div>;
  if (!user) return <AuthGate />;
  return children;
}

function ProfileGate({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    if (location.pathname === '/admin') {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    getProfile(user.id).then((profile) => {
      if (!active) return;
      setComplete(Boolean(profile?.onboarding_complete));
    }).catch(() => {
      if (active) setComplete(false);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user.id, location.pathname]);

  if (location.pathname === '/admin') return children;
  if (loading) return <div className="route-loading">Preparando seu plano…</div>;
  if (!complete && location.pathname !== '/goal') return <Navigate to="/goal" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ThemeProvider>
          {({ theme, accent, setTheme, setAccent }) => (
            <Routes>
              <Route path="/" element={<ProtectedRoute><ProfileGate><Dashboard theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent} /></ProfileGate></ProtectedRoute>} />
              <Route path="/goal" element={<ProtectedRoute><ProfileGate><GoalPage /></ProfileGate></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><ProfileGate><AdminPage /></ProfileGate></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </ThemeProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
