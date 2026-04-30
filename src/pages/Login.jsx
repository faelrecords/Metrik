import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const { token, user } = await api.post('/login', { code, password });
      onLogin(user, token);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div className="login-bg">
      <form className="glass login-card" onSubmit={submit}>
        <div className="login-brand">Metrik</div>
        <div className="login-sub">Métricas e indicadores</div>
        {err && <div className="error-msg">{err}</div>}
        <div className="field">
          <label className="label">Código</label>
          <input className="input" value={code} onChange={e => setCode(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="label">Senha</label>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <button className="btn accent" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
