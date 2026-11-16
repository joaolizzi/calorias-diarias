import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import NutrixLogo from './NutrixLogo.jsx';

export default function AuthGate() {
  const { signIn, signUp, signInAnonymously } = useAuth();
  const [mode, setMode] = useState('login');
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
    <main className="auth-shell">
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-brand">
          <NutrixLogo className="brand-mark" size={36} decorative />
          <span className="brand-name">Nutrix<span className="brand-dot">.</span></span>
        </div>

        <div className="auth-copy">
          <h1 id="auth-title">{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h1>
          <p>Acompanhe calorias, água, refeições e treinos em um só lugar.</p>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="seu@email.com" />
          </div>

          <div className="field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Mínimo de 6 caracteres" />
          </div>

          {err && <div className="err" role="alert">{err}</div>}

          <button className="btn primary auth-submit" type="submit" disabled={busy || guestBusy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === 'login' ? (
            <>Ainda não tem conta? <button type="button" onClick={() => setMode('signup')}>Criar conta</button></>
          ) : (
            <>Já tem conta? <button type="button" onClick={() => setMode('login')}>Entrar</button></>
          )}
        </p>

        <div className="auth-divider" role="separator"><span>ou</span></div>

        <button className="btn auth-submit" type="button" onClick={enterAsGuest} disabled={busy || guestBusy}>
          {guestBusy ? 'Entrando…' : 'Testar sem criar conta'}
        </button>
        <p className="auth-footnote">Entre como visitante para explorar o app sem informar email ou senha.</p>

        {mode === 'signup' && (
          <p className="auth-footnote">Se a confirmação por email estiver habilitada, verifique sua caixa de entrada após o cadastro.</p>
        )}
      </section>

      <aside className="auth-aside" aria-label="Como o Nutrix mostra seus números">
        <h2>Cada número mostra de onde veio.</h2>
        <p>Alimentos de tabelas e rótulos têm contorno sólido. Quando a IA estima uma quantidade ou um valor, o contorno é tracejado e você pode ajustar antes de registrar.</p>
        <ul className="auth-legend">
          <li><span className="source-chip">TBCA</span><span>Valor de tabela de composição de alimentos</span></li>
          <li><span className="source-chip estimate">Estimativa IA</span><span>Valor estimado, revise antes de salvar</span></li>
        </ul>
      </aside>
    </main>
  );
}
