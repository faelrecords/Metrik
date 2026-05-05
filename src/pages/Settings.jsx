import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

const PALETTE = ['#6d71f0', '#8a8ef5', '#c4c6ff', '#30d173', '#ffb84d', '#ff8078', '#a5a1b3', '#ff453a'];

// ─── Tags ────────────────────────────────────────────────────────────────────
function TagsSection() {
  const [tags, setTags] = useState([]);
  const [show, setShow] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [form, setForm] = useState({ name: '', color: PALETTE[0] });
  const [bulkText, setBulkText] = useState('');

  async function load() { setTags(await api.get('/tags')); }
  useEffect(() => { load(); }, []);

  function open(t) {
    setEditing(t || null);
    setForm(t ? { name: t.name, color: t.color } : { name: '', color: PALETTE[0] });
    setShow(true);
  }

  async function save() {
    try {
      if (editing) await api.put(`/tags/${editing.id}`, form);
      else await api.post('/tags', form);
      setShow(false); setEditing(null); load();
    } catch (e) { alert(e.message); }
  }

  async function saveBulk() {
    const names = bulkText.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
    const unique = [...new Set(names.map(x => x.toLowerCase()))].map(lower => names.find(x => x.toLowerCase() === lower));
    const existing = new Set(tags.map(t => t.name.toLowerCase()));
    let ok = 0, fail = 0;
    for (const name of unique) {
      if (existing.has(name.toLowerCase())) continue;
      try { await api.post('/tags', { name, color: PALETTE[ok % PALETTE.length] }); ok++; } catch { fail++; }
    }
    setShowBulk(false); setBulkText('');
    await load();
    alert(`Tags criadas: ${ok}${fail ? ` · Falhas: ${fail}` : ''}`);
  }

  async function delNow(id) { await api.del(`/tags/${id}`); setPendingDelete(null); load(); }
  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover tag? Ela será removida de todos os registros.' });
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>Tags</h2>
          <div className="subtitle">Organize registros por tags personalizadas</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setShowBulk(true)}>+ Em massa</button>
          <button className="btn accent" onClick={() => open(null)}>+ Nova tag</button>
        </div>
      </div>
      <div className="glass">
        {tags.length === 0 ? (
          <div className="empty-state"><h3>Nenhuma tag criada</h3></div>
        ) : (
          <div className="row-flex" style={{ flexWrap: 'wrap' }}>
            {tags.map(t => (
              <div key={t.id} className="tag-chip" style={{ borderColor: t.color, background: t.color + '22', color: t.color, fontSize: 13, padding: '8px 14px' }}>
                <span className="dot" style={{ background: t.color, width: 10, height: 10 }} />
                {t.name}
                <button className="x" onClick={() => open(t)} style={{ marginLeft: 4 }}>✎</button>
                <button className="x" onClick={() => del(t.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {show && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar tag' : 'Nova tag'}</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label className="label">Cor</label>
              <div className="color-picker">
                {PALETTE.map(c => (
                  <div key={c} className={`color-dot ${form.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
                ))}
              </div>
              <input className="input mt-1" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ height: 40 }} />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShow(false)}>Cancelar</button>
              <button className="btn accent" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {showBulk && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tags em massa</h2>
              <button className="modal-close" onClick={() => setShowBulk(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Nomes (uma por linha ou separados por vírgula)</label>
              <textarea className="textarea" value={bulkText} onChange={e => setBulkText(e.target.value)} placeholder={'Meta Ads\nGoogle Ads\nTikTok Ads'} style={{ minHeight: 160 }} />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowBulk(false)}>Cancelar</button>
              <button className="btn accent" onClick={saveBulk}>Criar tags</button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && (
        <DeleteConfirm message={pendingDelete.message} onCancel={() => setPendingDelete(null)} onConfirm={() => delNow(pendingDelete.id)} />
      )}
    </div>
  );
}

// ─── Campaign Names ───────────────────────────────────────────────────────────
function CampaignsSection() {
  const [campaigns, setCampaigns] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [form, setForm] = useState({ name: '', active: true });

  async function load() { setCampaigns(await api.get('/campaign_names')); }
  useEffect(() => { load(); }, []);

  function open(c) {
    setEditing(c || null);
    setForm(c ? { name: c.name, active: c.active } : { name: '', active: true });
    setShow(true);
  }

  async function save() {
    try {
      if (editing) await api.put(`/campaign_names/${editing.id}`, form);
      else await api.post('/campaign_names', form);
      setShow(false); setEditing(null); load();
    } catch (e) { alert(e.message); }
  }

  async function toggleActive(c) {
    await api.put(`/campaign_names/${c.id}`, { active: !c.active });
    load();
  }

  async function delNow(id) { await api.del(`/campaign_names/${id}`); setPendingDelete(null); load(); }
  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover campanha?' });
  }

  const active = campaigns.filter(c => c.active);
  const inactive = campaigns.filter(c => !c.active);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>Campanhas</h2>
          <div className="subtitle">Nomes reutilizáveis para selecionar nos relatórios de leads</div>
        </div>
        <button className="btn accent" onClick={() => open(null)}>+ Nova campanha</button>
      </div>

      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        {campaigns.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhuma campanha cadastrada</h3>
            <p>Cadastre nomes de campanhas para usar como seletor nos relatórios de leads.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <div
                        onClick={() => toggleActive(c)}
                        style={{
                          width: 40, height: 22, borderRadius: 11,
                          background: c.active ? '#30d173' : 'rgba(255,255,255,0.12)',
                          position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 3, left: c.active ? 21 : 3,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#fff', transition: 'left 0.2s'
                        }} />
                      </div>
                      <span className="text-tertiary" style={{ fontSize: 13 }}>{c.active ? 'Ativa' : 'Inativa'}</span>
                    </label>
                  </td>
                  <td className="actions-cell">
                    <button className="btn sm ghost" onClick={() => open(c)}>Editar</button>
                    <button className="btn sm danger" onClick={() => del(c.id)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {show && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar campanha' : 'Nova campanha'}</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus placeholder="Ex: [CBO] Meta Ads — Conversão" />
            </div>
            <div className="field">
              <label className="label">Status</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div
                  onClick={() => setForm({ ...form, active: !form.active })}
                  style={{
                    width: 40, height: 22, borderRadius: 11,
                    background: form.active ? '#30d173' : 'rgba(255,255,255,0.12)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: form.active ? 21 : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s'
                  }} />
                </div>
                <span>{form.active ? 'Ativa' : 'Inativa'}</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShow(false)}>Cancelar</button>
              <button className="btn accent" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {pendingDelete && (
        <DeleteConfirm message={pendingDelete.message} onCancel={() => setPendingDelete(null)} onConfirm={() => delNow(pendingDelete.id)} />
      )}
    </div>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <div className="subtitle">Campanhas e tags do workspace</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <CampaignsSection />
        <TagsSection />
      </div>
    </div>
  );
}
