import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Daily from './pages/Daily.jsx';
import Leads from './pages/Leads.jsx';
import Landing from './pages/Landing.jsx';
import Chat from './pages/Chat.jsx';
import Tags from './pages/Tags.jsx';
import Users from './pages/Users.jsx';
import LLMKeys from './pages/LLMKeys.jsx';

const NAV = [
  { to: '/', label: 'Dashboards' },
  { to: '/diario', label: 'Diário' },
  { to: '/leads', label: 'Leads' },
  { to: '/landing', label: 'Landing Pages' },
  { to: '/chat', label: 'IA', writeOnly: true },
  { to: '/tags', label: 'Tags', writeOnly: true },
  { to: '/llm', label: 'LLMs', writeOnly: true },
  { to: '/usuarios', label: 'Usuários', adminOnly: true }
];

function Navbar({ user, onLogout }) {
  const nav = useNavigate();
  const loc = useLocation();
  const canWrite = ['admin', 'super_admin'].includes(user.role);
  const links = NAV.filter(n => (!n.adminOnly || canWrite) && (!n.writeOnly || canWrite));
  return (
    <nav className="navbar">
      <div className="brand" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon"><span /><span /><span /></div>
        Metrik
      </div>
      <div className="nav-links">
        {links.map(l => (
          <button
            key={l.to}
            className={`nav-link ${loc.pathname === l.to ? 'active' : ''}`}
            onClick={() => nav(l.to)}
          >{l.label}</button>
        ))}
      </div>
      <div className="nav-user">
        <span className="nav-user-name">{user.name}</span>
        <button onClick={onLogout}>Sair</button>
      </div>
    </nav>
  );
}

export default function App() {
  const [user, setUser] = useState(api.getUser());
  const nav = useNavigate();
  const readOnly = user?.role === 'user';

  useEffect(() => {
    if (user) {
      api.get('/me').catch(() => logout());
    }
  }, []);

  function login(u, t) {
    api.setToken(t);
    api.setUser(u);
    setUser(u);
    nav('/');
  }
  function logout() {
    api.setToken(null);
    api.setUser(null);
    setUser(null);
    nav('/login');
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={login} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <>
      <Navbar user={user} onLogout={logout} />
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/diario" element={<Daily readOnly={readOnly} />} />
          <Route path="/leads" element={<Leads readOnly={readOnly} />} />
          <Route path="/landing" element={<Landing readOnly={readOnly} />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/llm" element={<LLMKeys />} />
          <Route path="/usuarios" element={<Users user={user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}
