import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

const PROVIDERS = [
  { v: 'openai', label: 'OpenAI', placeholder: 'sk-...', defaultModel: 'gpt-4o-mini', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { v: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', defaultModel: 'claude-sonnet-4-20250514', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001', 'claude-sonnet-4-20250514'] },
  { v: 'gemini', label: 'Google Gemini', placeholder: 'AIza...', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-flash-latest'] }
];

export default function LLMKeys() {
  const [keys, setKeys] = useState([]);
  const [show, setShow] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [form, setForm] = useState({ provider: 'openai', label: '', model: PROVIDERS[0].defaultModel, api_key: '' });

  async function load() {
    setKeys(await api.get('/llm/keys'));
  }
  useEffect(() => { load(); }, []);

  function setProvider(v) {
    const p = PROVIDERS.find(x => x.v === v);
    setForm({ ...form, provider: v, model: p.defaultModel });
  }

  async function save() {
    try {
      await api.post('/llm/keys', form);
      setShow(false);
      setForm({ provider: 'openai', label: '', model: PROVIDERS[0].defaultModel, api_key: '' });
      load();
    } catch (e) { alert(e.message); }
  }

  async function delNow(id) {
    await api.del(`/llm/keys/${id}`);
    setPendingDelete(null);
    load();
  }

  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover chave?' });
  }

  const provider = PROVIDERS.find(p => p.v === form.provider);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Chaves de LLM</h1>
          <div className="subtitle">Configure chaves de API para usar a IA com seus dados</div>
        </div>
        <button className="btn accent" onClick={() => setShow(true)}>+ Nova chave</button>
      </div>

      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        {keys.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhuma chave configurada</h3>
            <p>Adicione uma chave de OpenAI, Anthropic ou Gemini para conversar com IA sobre suas métricas.</p>
          </div>
        ) : (
          <table className="table">
            <thead><tr><th>Apelido</th><th>Provider</th><th>Modelo</th><th></th></tr></thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id}>
                  <td><strong>{k.label}</strong></td>
                  <td>{PROVIDERS.find(p => p.v === k.provider)?.label || k.provider}</td>
                  <td className="text-tertiary">{k.model || '-'}</td>
                  <td className="actions-cell"><button className="btn sm danger" onClick={() => del(k.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && (
        <div className="modal-backdrop" onClick={() => setShow(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova chave de LLM</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Provider</label>
              <select className="select" value={form.provider} onChange={e => setProvider(e.target.value)}>
                {PROVIDERS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Apelido</label>
              <input className="input" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder={`Ex: ${provider.label} principal`} />
            </div>
            <div className="field">
              <label className="label">Modelo</label>
              <select className="select" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                {provider.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">API key</label>
              <input className="input" type="password" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder={provider.placeholder} />
              <div className="hint">Armazenada no servidor local. Nunca enviada além dele e do provider escolhido.</div>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShow(false)}>Cancelar</button>
              <button className="btn accent" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && (
        <DeleteConfirm
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => delNow(pendingDelete.id)}
        />
      )}
    </div>
  );
}
