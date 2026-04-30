import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

const PALETTE = ['#6d71f0', '#8a8ef5', '#c4c6ff', '#30d173', '#ffb84d', '#ff8078', '#a5a1b3', '#ff453a'];

export default function Tags() {
  const [tags, setTags] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [form, setForm] = useState({ name: '', color: PALETTE[0] });

  async function load() {
    setTags(await api.get('/tags'));
  }
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
      setShow(false); setEditing(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function delNow(id) {
    await api.del(`/tags/${id}`);
    setPendingDelete(null);
    load();
  }

  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover tag? Ela será removida de todos os registros.' });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tags</h1>
          <div className="subtitle">Organize registros por tags personalizadas</div>
        </div>
        <button className="btn accent" onClick={() => open(null)}>+ Nova tag</button>
      </div>

      <div className="glass">
        {tags.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhuma tag criada</h3>
            <p>Tags ajudam a filtrar registros no dashboard, leads e landing pages.</p>
          </div>
        ) : (
          <div className="row-flex">
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
        <div className="modal-backdrop" onClick={() => setShow(false)}>
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
