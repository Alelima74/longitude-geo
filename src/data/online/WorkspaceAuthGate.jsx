import React, { useEffect, useState } from 'react';
import { apiFetch, clearSession, getSession, signIn } from '../../cloud/cloudApi.js';
import { cloudWorkspaceConfigured, cloudWorkspaceEnabled } from './workspaceCloud.js';
import './workspace-cloud.css';

export default function WorkspaceAuthGate({ children }) {
  const online = cloudWorkspaceEnabled();
  const [user, setUser] = useState(null), [checking, setChecking] = useState(online);
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [reauth, setReauth] = useState(false);
  useEffect(() => {
    if (!online) return;
    let active = true;
    if (!getSession()) setChecking(false);
    else apiFetch('/auth/v1/user', {}, true).then(value => { if (active) setUser(value); })
      .catch(() => { if (active) setMessage('Entre novamente para acessar seus projetos.'); })
      .finally(() => { if (active) setChecking(false); });
    const changed = () => { if (!getSession()) setUser(null); };
    const expired = () => setReauth(true);
    window.addEventListener('storage', changed);
    window.addEventListener('longitude:session', changed);
    window.addEventListener('longitude:session-expired', expired);
    return () => { active = false; window.removeEventListener('storage', changed); window.removeEventListener('longitude:session', changed); window.removeEventListener('longitude:session-expired', expired); };
  }, [online]);
  if (!online) return children;
  if (!cloudWorkspaceConfigured()) return <main className="workspace-login"><h1>Longitude Geo Intelligence</h1><p role="alert">Ambiente online sem configuração do Supabase. Configure URL e chave publicável na hospedagem e gere um novo build.</p></main>;
  if (checking) return <main className="workspace-login" role="status">Conferindo sua sessão...</main>;
  const login = async event => {
    event.preventDefault(); setBusy(true); setMessage('');
    try { const next = await signIn(user?.email || email, password); if (user && next.user.id !== user.id) { clearSession({ notify: false }); throw new Error('Conta diferente.'); } setPassword(''); setUser(next.user); setReauth(false); }
    catch { setMessage('Não foi possível entrar. Confira e-mail, senha e conexão.'); }
    finally { setBusy(false); }
  };
  const loginForm = <main className={`workspace-login ${user ? 'workspace-reauth' : ''}`}><form onSubmit={login}>
    <h1>Longitude Geo Intelligence</h1><p>Acesse seus projetos no computador, tablet ou celular com a mesma conta.</p>
    <label>E-mail<input type="email" autoComplete="username" required readOnly={Boolean(user)} value={user?.email || email} onChange={e => setEmail(e.target.value)}/></label>
    <label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
    {message && <p role="alert">{message}</p>}<button disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button>
  </form></main>;
  if (!user) return loginForm;
  return <>{reauth && loginForm}<div inert={reauth ? '' : undefined}><div className="workspace-session"><span>{user.email} · Conta pessoal na nuvem</span><button onClick={() => { if (window.confirm('Salve seus projetos antes de sair. Deseja encerrar a sessão?')) { clearSession(); setUser(null); } }}>Sair</button></div><React.Fragment key={user.id}>{children}</React.Fragment></div></>;
}
