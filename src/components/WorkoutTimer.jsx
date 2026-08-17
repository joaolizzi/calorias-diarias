import { useEffect, useState } from 'react';

export default function WorkoutTimer({ seconds = 90 }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  useEffect(() => { if (!running) return; const id = setInterval(() => setLeft(v => { if (v <= 1) { setRunning(false); return 0; } return v - 1; }), 1000); return () => clearInterval(id); }, [running]);
  const reset = () => { setLeft(seconds); setRunning(false); };
  return <div className="workout-timer"><strong>{String(Math.floor(left / 60)).padStart(2,'0')}:{String(left % 60).padStart(2,'0')}</strong><button className="btn" onClick={() => setRunning(!running)}>{running ? 'Pausar' : left ? 'Iniciar' : 'Recomeçar'}</button><button className="btn" onClick={reset}>Reset</button></div>;
}
