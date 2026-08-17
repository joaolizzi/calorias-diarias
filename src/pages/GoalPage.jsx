import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import GoalSetup from '../components/GoalSetup.jsx';
import ProfessionalHeader from '../components/ProfessionalHeader.jsx';
export default function GoalPage({theme,accent,setTheme,setAccent}){const{user}=useAuth();const navigate=useNavigate();if(!user)return null;return <div className="app goal-screen"><ProfessionalHeader subtitle="Seu plano personalizado" theme={theme} accent={accent} setTheme={setTheme} setAccent={setAccent}/><main className="goal-page"><GoalSetup onComplete={()=>navigate('/',{replace:true})}/><p className="goal-disclaimer">As estimativas servem como ponto de partida e podem variar de pessoa para pessoa.</p></main></div>}
