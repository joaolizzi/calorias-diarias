import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AuthGate() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email, password);
      else await signUp(email, password);
    } catch (e) {
      setErr(e?.message || 'Falha ao autenticar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>🍽️ Calorias & Água</h1>
      <div className="sub" style={{ textAlign: 'center' }}>
        {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
      </div>

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {err && <div className="err">{err}</div>}

        <button className="btn primary submit" type="submit" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <div className="toggle">
        {mode === 'login' ? (
          <>
            Ainda não tem conta?{' '}
            <button type="button" onClick={() => setMode('signup')}>Criar</button>
          </>
        ) : (
          <>
            Já tem conta?{' '}
            <button type="button" onClick={() => setMode('login')}>Entrar</button>
          </>
        )}
      </div>

      {mode === 'signup' && (
        <div className="sub" style={{ marginTop: 14, fontSize: 12 }}>
          Se a confirmação por email estiver habilitada no Supabase, verifique sua
          caixa de entrada após o cadastro.
        </div>
      )}
    </div>
  );
}