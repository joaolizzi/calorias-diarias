import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import GoalSetup from '../components/GoalSetup.jsx';

export default function GoalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="goal-page">
      <GoalSetup onComplete={() => navigate('/', { replace: true })} />
      <p className="goal-disclaimer">As estimativas servem como ponto de partida e podem variar de pessoa para pessoa.</p>
    </div>
  );
}
