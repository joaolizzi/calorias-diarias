import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AuthGate() {
  const { signIn, signUp, signInAnonymously } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
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

  const enterAsGuest = async () => {
    setErr('');
    setGuestBusy(true);
    try {
      await signInAnonymously();
    } catch (e) {
      setErr(e?.message || 'Não foi possível entrar como visitante');
    } finally {
      setGuestBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1> Nutrix </h1>
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

        <button className="btn primary submit" type="submit" disabled={busy || guestBusy}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0', color: 'var(--muted, #888)', fontSize: 12 }}>
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
        ou
        <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.25 }} />
      </div>

      <button
        className="btn submit"
        type="button"
        onClick={enterAsGuest}
        disabled={busy || guestBusy}
        style={{ width: '100%' }}
      >
        {guestBusy ? 'Entrando…' : '🚀 Testar sem criar conta'}
      </button>

      <div className="sub" style={{ marginTop: 10, fontSize: 12, textAlign: 'center' }}>
        Entre como visitante para testar o app sem informar email ou senha.
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
