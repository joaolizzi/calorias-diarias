import './theme.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { getProfile } from './lib/supabase.js';
import AuthGate from './components/AuthGate.jsx';
import Toast from './components/Toast.jsx';
import Dashboard from './pages/Dashboard.jsx';
import GoalPage from './pages/GoalPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import WorkoutsPage from './pages/WorkoutsPage.jsx';

const THEME_KEY = 'nutrix-theme';
const ACCENT_KEY = 'nutrix-accent';
const PRESET_KEY = 'nutrix-preset';

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem(ACCENT_KEY) || 'green');
  const [preset, setPreset] = useState(() => localStorage.getItem(PRESET_KEY) || 'graphite');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.preset = preset;
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(ACCENT_KEY, accent);
    localStorage.setItem(PRESET_KEY, preset);
  }, [theme, accent, preset]);

  return children({ theme, accent, preset, setTheme, setAccent, setPreset });
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
    getProfile(user.id)
      .then((profile) => { if (active) setComplete(Boolean(profile?.onboarding_complete)); })
      .catch(() => { if (active) setComplete(false); })
      .finally(() => { if (active) setLoading(false); });
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
          {({ theme, accent, preset, setTheme, setAccent, setPreset }) => {
            const appearanceProps = { theme, accent, preset, setTheme, setAccent, setPreset };
            return (
              <>
                <Toast />
                <Routes>
                  <Route path="/" element={<ProtectedRoute><ProfileGate><Dashboard {...appearanceProps} /></ProfileGate></ProtectedRoute>} />
                  <Route path="/goal" element={<ProtectedRoute><ProfileGate><GoalPage {...appearanceProps} /></ProfileGate></ProtectedRoute>} />
                  <Route path="/treinos" element={<ProtectedRoute><ProfileGate><WorkoutsPage {...appearanceProps} /></ProfileGate></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><ProfileGate><AdminPage {...appearanceProps} /></ProfileGate></ProtectedRoute>} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </>
            );
          }}
        </ThemeProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
