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
    <main className="auth-premium-shell">
      <section className="auth-premium-panel">
        <div className="auth-brand-row">
          <NutrixLogo className="auth-logo-mark" size={46} decorative />
          <div>
            <div className="auth-brand-name">Nutrix<span>.</span></div>
            <div className="auth-brand-tagline">Nutrição simples. Progresso visível.</div>
          </div>
        </div>

        <div className="auth-premium-copy">
          <span className="auth-eyebrow">BEM-VINDO</span>
          <h1>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h1>
          <p>Acompanhe calorias, água, refeições e treinos em um só lugar.</p>
        </div>

        <form className="auth-premium-form" onSubmit={submit}>
          <div className="field auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="seu@email.com" />
          </div>

          <div className="field auth-field">
            <label htmlFor="password">Senha</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" />
          </div>

          {err && <div className="err auth-error">{err}</div>}

          <button className="btn primary submit auth-primary-action" type="submit" disabled={busy || guestBusy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar no Nutrix' : 'Criar minha conta'}
          </button>
        </form>

        <div className="toggle auth-mode-toggle">
          {mode === 'login' ? (
            <>Ainda não tem conta? <button type="button" onClick={() => setMode('signup')}>Criar conta</button></>
          ) : (
            <>Já tem conta? <button type="button" onClick={() => setMode('login')}>Entrar</button></>
          )}
        </div>

        <div className="auth-divider"><span />ou<span /></div>

        <button className="btn submit auth-guest-action" type="button" onClick={enterAsGuest} disabled={busy || guestBusy}>
          {guestBusy ? 'Entrando…' : 'Testar sem criar conta'}
        </button>

        <p className="auth-footnote">Entre como visitante para explorar o app sem informar email ou senha.</p>

        {mode === 'signup' && (
          <p className="auth-footnote auth-signup-note">Se a confirmação por email estiver habilitada, verifique sua caixa de entrada após o cadastro.</p>
        )}
      </section>

      <aside className="auth-premium-visual" aria-hidden="true">
        <div className="auth-visual-orb auth-orb-one" />
        <div className="auth-visual-orb auth-orb-two" />
        <div className="auth-preview-card auth-preview-main">
          <span>Seu dia</span>
          <strong>1.842 kcal</strong>
          <small>de 2.400 kcal</small>
          <div className="auth-preview-progress"><i /></div>
        </div>
        <div className="auth-preview-card auth-preview-small auth-preview-water">
          <span>Água</span>
          <strong>2,1 L</strong>
          <small>meta 3,0 L</small>
        </div>
        <div className="auth-preview-card auth-preview-small auth-preview-streak">
          <span>Consistência</span>
          <strong>7 dias</strong>
          <small>sequência atual</small>
        </div>
      </aside>
    </main>
  );
}
