import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtBR } from '../utils/dates.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

export default function Users({ user }) {
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', password: '', role: 'admin' });

  async function load() {
    setUsers(await api.get('/users'));
  }
  useEffect(() => { load(); }, []);

  function open(u) {
    setEditing(u || null);
    setForm(u ? { name: u.name, code: u.code, password: '', role: u.role } : { name: '', code: '', password: '', role: 'admin' });
    setShow(true);
  }

  async function save() {
    try {
      if (editing) await api.put(`/users/${editing.id}`, form);
      else await api.post('/users', form);
      setShow(false); setEditing(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function delNow(id) {
    try { await api.del(`/users/${id}`); setPendingDelete(null); load(); }
    catch (e) { alert(e.message); }
  }

  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover usuário?' });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Usuários</h1>
          <div className="subtitle">Gerenciar acessos ao sistema</div>
        </div>
        <button className="btn accent" onClick={() => open(null)}>+ Novo usuário</button>
      </div>

      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>Código</th><th>Papel</th><th>Criado em</th><th></th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.code}</td>
                <td>
                  {u.role === 'super_admin' && <span className="badge success">super admin</span>}
                  {u.role === 'admin' && <span className="badge pending">admin</span>}
                  {u.role === 'user' && <span className="badge">usuário</span>}
                </td>
                <td className="text-tertiary">{fmtBR((u.created_at || '').slice(0, 10))}</td>
                <td className="actions-cell">
                  <button className="btn sm ghost" onClick={() => open(u)}>Editar</button>
                  {u.role !== 'super_admin' && <button className="btn sm danger" onClick={() => del(u.id)}>×</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar usuário' : 'Novo usuário'}</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Nome</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Código de acesso</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} disabled={!!editing} />
            </div>
            <div className="field">
              <label className="label">Senha {editing && <span className="hint">(deixe vazio para manter)</span>}</label>
              <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            {user.role === 'super_admin' && (
              <div className="field">
                <label className="label">Papel</label>
                <select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="user">Usuário</option>
                  <option value="admin">Administrador</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </div>
            )}
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
