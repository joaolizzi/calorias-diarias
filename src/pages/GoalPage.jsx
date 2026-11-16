import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import GoalSetup from '../components/GoalSetup.jsx';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';

export default function GoalPage({ theme, setTheme }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="app-shell">
      <ProfessionalHeader theme={theme} setTheme={setTheme} />
      <main className="page" id="conteudo">
        <div className="page-inner narrow">
          <GoalSetup onComplete={() => navigate('/', { replace: true })} />
          <p className="goal-disclaimer muted">
            As estimativas servem como ponto de partida e podem variar de pessoa para pessoa.
          </p>
        </div>
      </main>
    </div>
  );
}
