import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function Chat({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const msgRef = useRef(null);
  const pollRef = useRef(null);

  async function load() {
    try {
      const m = await api.get('/team_messages?limit=200');
      setMessages(m);
      setTimeout(() => { if (msgRef.current) msgRef.current.scrollTop = msgRef.current.scrollHeight; }, 30);
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setSending(true);
    try {
      await api.post('/team_messages', { text });
      await load();
    } catch (e) { alert(e.message); setInput(text); }
    finally { setSending(false); }
  }

  async function del(id) {
    await api.del(`/team_messages/${id}`);
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <div className="page-header">
        <div>
          <h1>Chat interno</h1>
          <div className="subtitle">Mensagens visíveis para toda a equipe</div>
        </div>
      </div>

      <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div ref={msgRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {messages.length === 0 && (
            <div className="empty-state" style={{ padding: 32 }}>
              <h3>Nenhuma mensagem ainda</h3>
              <p>Seja o primeiro a enviar uma mensagem para a equipe.</p>
            </div>
          )}
          {messages.map((m, i) => {
            const isMe = m.user_id === user?.id;
            const prevSameSender = i > 0 && messages[i - 1].user_id === m.user_id;
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginTop: prevSameSender ? 2 : 12 }}>
                {!prevSameSender && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                    {isMe ? 'Você' : m.user_name} · {fmtTime(m.created_at)}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  <div style={{
                    maxWidth: 520, padding: '8px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMe ? '#6d71f0' : 'rgba(255,255,255,0.07)',
                    color: '#e8e7ec', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word'
                  }}>
                    {m.text}
                  </div>
                  {isMe && (
                    <button onClick={() => del(m.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }} title="Apagar">×</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10 }}>
          <textarea
            className="textarea"
            style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: 'vertical' }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Mensagem... (Enter para enviar, Shift+Enter nova linha)"
            disabled={sending}
          />
          <button className="btn accent" onClick={send} disabled={sending || !input.trim()} style={{ alignSelf: 'flex-end' }}>
            {sending ? '...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
