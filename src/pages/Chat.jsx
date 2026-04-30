import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [keys, setKeys] = useState([]);
  const [keyId, setKeyId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const msgRef = useRef(null);

  async function loadSessions() {
    const [s, k] = await Promise.all([api.get('/chat/sessions'), api.get('/llm/keys')]);
    setSessions(s);
    setKeys(k);
    if (k.length && !keyId) setKeyId(k[0].id);
  }
  useEffect(() => { loadSessions(); }, []);

  async function loadMessages(sid) {
    const m = await api.get(`/chat/sessions/${sid}/messages`);
    setMessages(m);
    setTimeout(() => { if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight; }, 50);
  }

  async function pickSession(s) {
    setActive(s);
    if (s.key_id) setKeyId(s.key_id);
    await loadMessages(s.id);
  }

  async function newSession() {
    const s = await api.post('/chat/sessions', { key_id: keyId });
    await loadSessions();
    setActive(s);
    setMessages([]);
  }

  async function delSessionNow(s) {
    await api.del(`/chat/sessions/${s.id}`);
    setPendingDelete(null);
    if (active?.id === s.id) { setActive(null); setMessages([]); }
    loadSessions();
  }

  function delSession(s) {
    if (canSkipDeleteConfirm()) delSessionNow(s);
    else setPendingDelete({ item: s, message: 'Apagar conversa?' });
  }

  async function send() {
    if (!input.trim()) return;
    if (keys.length === 0) { alert('Adicione uma chave de LLM em "LLMs" primeiro.'); return; }
    let s = active;
    if (!s) {
      s = await api.post('/chat/sessions', { key_id: keyId });
      setActive(s);
      await loadSessions();
    }
    const text = input;
    setInput('');
    setLoading(true);
    setMessages([...messages, { id: 'temp_u', role: 'user', content: text }, { id: 'temp_a', role: 'assistant', content: '...' }]);
    try {
      await api.post(`/chat/sessions/${s.id}/messages`, { content: text, key_id: keyId });
      await loadMessages(s.id);
      loadSessions();
    } catch (e) {
      alert(e.message);
      setMessages(prev => prev.filter(m => m.id !== 'temp_a'));
    } finally { setLoading(false); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>IA · Insights</h1>
          <div className="subtitle">Converse com IA usando os dados do sistema como contexto</div>
        </div>
        <div className="row-flex">
          {keys.length > 0 && (
            <select className="select" style={{ width: 'auto' }} value={keyId || ''} onChange={e => setKeyId(Number(e.target.value))}>
              {keys.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          )}
          <button className="btn accent" onClick={newSession}>+ Nova conversa</button>
        </div>
      </div>

      <div className="chat-layout">
        <div className="glass chat-sidebar">
          {sessions.length === 0 && <div className="text-tertiary" style={{ fontSize: 12 }}>Sem conversas.</div>}
          {sessions.map(s => (
            <div key={s.id} className={`session-item ${active?.id === s.id ? 'active' : ''}`} onClick={() => pickSession(s)}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
              <button className="sx" onClick={(e) => { e.stopPropagation(); delSession(s); }}>×</button>
            </div>
          ))}
        </div>

        <div className="glass chat-main">
          <div className="chat-messages" ref={msgRef}>
            {messages.length === 0 && (
              <div className="empty-state" style={{ padding: 32 }}>
                <h3>Pergunte algo sobre seus dados</h3>
                <p>Ex: "qual campanha trouxe mais leads?", "qual landing tem maior conversão?", "compare os últimos 7 dias com a semana anterior"</p>
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} className={`chat-msg ${m.role}`}>{m.content}</div>
            ))}
          </div>
          <div className="chat-input-row">
            <textarea
              className="textarea"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={keys.length === 0 ? 'Adicione uma chave em LLMs primeiro...' : 'Pergunte algo...'}
              disabled={loading || keys.length === 0}
            />
            <button className="btn accent" onClick={send} disabled={loading || keys.length === 0}>
              {loading ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
      {pendingDelete && (
        <DeleteConfirm
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => delSessionNow(pendingDelete.item)}
        />
      )}
    </div>
  );
}
