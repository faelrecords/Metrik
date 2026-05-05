import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { today, fmtBR, addDays, ranges } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import TagSelector, { TagFilter, TagChip } from '../components/TagSelector.jsx';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';
import Pagination from '../components/Pagination.jsx';

export default function Landing({ readOnly = false }) {
  const [pages, setPages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagFilter, setTagFilter] = useState(null);
  const [range, setRange] = useState({ ...ranges['30d'](), preset: '30d' });
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entry, setEntry] = useState(null);
  const [form, setForm] = useState({ title: '', url: '', tags: [] });
  const [entryForm, setEntryForm] = useState({ date: today(), visits: '', leads: '' });
  const [editEntry, setEditEntry] = useState(null);
  const [editEntryForm, setEditEntryForm] = useState({ date: '', visits: '', leads: '' });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkTags, setBulkTags] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [page, setPage] = useState(1);
  const [groupModal, setGroupModal] = useState(null);
  const [bulkTagModal, setBulkTagModal] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lbModal, setLbModal] = useState(null);
  const [groups, setGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('metrik_landing_groups') || '["Geral"]'); }
    catch { return ['Geral']; }
  });
  const [activeGroup, setActiveGroup] = useState(() => localStorage.getItem('metrik_landing_active_group') || 'Todas');
  async function load() {
    const [p, t] = await Promise.all([api.get('/landing'), api.get('/tags')]);
    setPages(p);
    setTags(t);
    setActivePageId(current => current && p.find(x => x.id === current) ? current : p[0]?.id || null);
  }
  useEffect(() => { load(); }, []);

  function open(row) {
    setEditing(row || null);
    setForm(row ? { title: row.title, url: row.url, tags: row.tags || [] } : { title: '', url: '', tags: [] });
    setShowNew(true);
  }

  async function save() {
    try {
      if (editing) await api.put(`/landing/${editing.id}`, form);
      else await api.post('/landing', form);
      setShowNew(false); setEditing(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function delNow(id) {
    await api.del(`/landing/${id}`);
    setPendingDelete(null);
    load();
  }

  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ type: 'page', id, message: 'Remover landing page e todos os registros?' });
  }

  function openEntry(p) {
    setEntry(p);
    setEntryForm({ date: today(), visits: '', leads: '' });
  }

  async function saveEntry() {
    try {
      await api.post(`/landing/${entry.id}/entries`, {
        period_start: entryForm.date,
        period_end: entryForm.date,
        visits: entryForm.visits,
        leads: entryForm.leads
      });
      setEntry(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function delEntryNow(pid, eid) {
    await api.del(`/landing/${pid}/entries/${eid}`);
    setPendingDelete(null);
    load();
  }

  function delEntry(pid, eid) {
    if (canSkipDeleteConfirm()) delEntryNow(pid, eid);
    else setPendingDelete({ type: 'entry', pid, eid, message: 'Remover registro?' });
  }

  function openEditEntry(pid, e) {
    setEditEntry({ pid, eid: e.id });
    setEditEntryForm({ date: e.period_start, visits: String(e.visits), leads: String(e.leads) });
  }

  async function saveEditEntry() {
    try {
      await api.put(`/landing/${editEntry.pid}/entries/${editEntry.eid}`, {
        period_start: editEntryForm.date,
        period_end: editEntryForm.date,
        visits: editEntryForm.visits,
        leads: editEntryForm.leads
      });
      setEditEntry(null);
      load();
    } catch (e) { alert(e.message); }
  }

  const filtered = (tagFilter ? pages.filter(p => (p.tags || []).includes(tagFilter)) : pages).map(p => {
    const entries = (p.entries || []).filter(e => {
      if (range.from && e.period_end < range.from) return false;
      if (range.to && e.period_start > range.to) return false;
      return true;
    });
    const totalVisits = entries.reduce((s, e) => s + Number(e.visits || 0), 0);
    const totalLeads = entries.reduce((s, e) => s + Number(e.leads || 0), 0);
    return { ...p, entries, totalVisits, totalLeads, conversion: totalVisits > 0 ? (totalLeads / totalVisits) * 100 : 0 };
  }).filter(p => activeGroup === 'Todas' || (p.group || 'Geral') === activeGroup);
  const pageSize = 31;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const activePage = filtered.find(p => p.id === activePageId) || filtered[0] || null;
  useEffect(() => { setPage(1); }, [tagFilter, range.from, range.to]);

  function saveGroups(next) {
    setGroups(next);
    localStorage.setItem('metrik_landing_groups', JSON.stringify(next));
  }

  function pickGroup(group) {
    setActiveGroup(group);
    localStorage.setItem('metrik_landing_active_group', group);
    setActivePageId(null);
  }

  async function createGroup() {
    setGroupModal({ mode: 'create', name: '' });
  }

  async function setPageGroup(page) {
    setGroupModal({ mode: 'assign', page, selected: page.group || 'Geral', name: '' });
  }

  async function createGroupFromModal() {
    const name = groupModal?.name?.trim();
    if (!name) return;
    const next = [...new Set([...groups, name])];
    saveGroups(next);
    setGroupModal(null);
    pickGroup(name);
  }

  async function assignGroupFromModal(group) {
    const page = groupModal?.page;
    if (!page || !group) return;
    await api.put(`/landing/${page.id}`, { title: page.title, url: page.url, tags: page.tags || [], group });
    await load();
    setGroupModal(null);
    pickGroup(group);
  }

  function toggleSelected(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function applyBulkTags() {
    for (const id of selected) {
      const page = pages.find(p => p.id === id);
      if (!page) continue;
      await api.put(`/landing/${id}`, { title: page.title, url: page.url, tags: [...new Set([...(page.tags || []), ...bulkTags])] });
    }
    setSelected([]);
    setBulkTags([]);
    load();
  }

  function openBulkTagModal() {
    setSelected(pageItems.map(p => p.id));
    setBulkTags([]);
    setBulkTagModal(true);
  }

  async function exportXLS() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const exportPages = activePage ? [activePage] : filtered;
    const rows = [];
    exportPages.forEach(p => {
      p.entries.forEach(e => {
        rows.push({
          Data: fmtBR(e.period_start),
          Visitas: e.visits,
          Leads: e.leads
        });
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Registros');
    const safeName = (activePage?.title || 'landing_pages').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${safeName}.xlsx`);
  }

  function openLandingBulk() {
    const defaultPage = activePage || pages[0] || null;
    setLbModal({ phase: 'config', pageId: defaultPage?.id ?? '', dateFrom: today(), dateTo: today(), currentDate: null, visits: '', leads: '' });
  }

  async function landingBulkNext() {
    const { pageId, dateFrom, dateTo, currentDate, visits, leads } = lbModal;
    const date = currentDate || dateFrom;
    await api.post(`/landing/${pageId}/entries`, {
      period_start: date,
      period_end: date,
      visits: Number(visits) || 0,
      leads: Number(leads) || 0
    });
    const nextDate = addDays(date, 1);
    if (nextDate > dateTo) {
      setLbModal(null);
      load();
    } else {
      setLbModal(prev => ({ ...prev, phase: 'entry', currentDate: nextDate, visits: '', leads: '' }));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Landing pages</h1>
          <div className="subtitle">Cadastro, registros de visitas/leads e taxa de conversão</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setFiltersOpen(true)}>Filtros</button>
          {!readOnly && <button className="btn" onClick={openLandingBulk}>+ Em massa</button>}
          <button className="btn" onClick={exportXLS}>↓ Excel</button>
          {!readOnly && <button className="btn accent" onClick={() => open(null)}>+ Nova landing</button>}
        </div>
      </div>

      <div className="landing-control-row">
        <span className="label">Grupos</span>
        <button className={`range-pill ${activeGroup === 'Todas' ? 'active' : ''}`} onClick={() => pickGroup('Todas')}>Todas</button>
        {groups.map(g => (
          <button key={g} className={`range-pill ${activeGroup === g ? 'active' : ''}`} onClick={() => pickGroup(g)}>{g}</button>
        ))}
        {!readOnly && <button className="range-pill add" onClick={createGroup}>+ Grupo</button>}
      </div>

      {filtered.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <h3>Nenhuma landing cadastrada</h3>
            {!readOnly && <p>Adicione título e URL para começar.</p>}
          </div>
        </div>
      ) : (
        <>
          <div className="dash-pages">
            {filtered.map(p => (
              <button
                key={p.id}
                className={`range-pill ${activePage?.id === p.id ? 'active' : ''}`}
                onClick={() => setActivePageId(p.id)}
              >{p.title}</button>
            ))}
          </div>
          {activePage && (
            <div className="glass">
              <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-flex">
                    {!readOnly && <input type="checkbox" checked={selected.includes(activePage.id)} onChange={() => toggleSelected(activePage.id)} />}
                    <h3 style={{ marginBottom: 4 }}>{activePage.title}</h3>
                  </div>
                  <a href={activePage.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, wordBreak: 'break-all' }}>{activePage.url}</a>
                  <div className="row-flex mt-1">
                    {(activePage.tags || []).map(id => {
                      const t = tags.find(x => x.id === id);
                      return t ? <TagChip key={id} tag={t} /> : null;
                    })}
                  </div>
                </div>
                <div className="row-flex">
                  {!readOnly && <button className="btn sm ghost" onClick={() => open(activePage)}>Editar</button>}
                  {!readOnly && <button className="btn sm ghost" onClick={() => setPageGroup(activePage)}>Grupo</button>}
                  {!readOnly && <button className="btn sm danger" onClick={() => del(activePage.id)}>×</button>}
                </div>
              </div>
              <div className="grid-3 mt-2">
                <div className="glass-sm" style={{ textAlign: 'center', padding: 14 }}>
                  <div className="text-tertiary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Visitas</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{activePage.totalVisits.toLocaleString('pt-BR')}</div>
                </div>
                <div className="glass-sm" style={{ textAlign: 'center', padding: 14 }}>
                  <div className="text-tertiary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Leads</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{activePage.totalLeads.toLocaleString('pt-BR')}</div>
                </div>
                <div className="glass-sm" style={{ textAlign: 'center', padding: 14 }}>
                  <div className="text-tertiary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Conversão</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-text)' }}>{Number(activePage.conversion).toFixed(2)}%</div>
                </div>
              </div>

              <div className="mt-2">
                <div className="row-flex" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong className="text-secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Registros</strong>
                  {!readOnly && (
                    <button className="btn sm" onClick={() => openEntry(activePage)}>+ Registro</button>
                  )}
                </div>
                {activePage.entries.length === 0 ? (
                  <div className="text-tertiary" style={{ fontSize: 12, padding: 8 }}>Sem registros ainda.</div>
                ) : (
                  <table className="table">
                    <thead><tr><th>Período</th><th>Visitas</th><th>Leads</th><th>Conv.</th>{!readOnly && <th></th>}</tr></thead>
                    <tbody>
                      {activePage.entries.slice().reverse().map(e => (
                        <tr key={e.id}>
                          <td style={{ fontSize: 12 }}>{fmtBR(e.period_start)}→{fmtBR(e.period_end)}</td>
                          <td>{e.visits}</td>
                          <td>{e.leads}</td>
                          <td>{Number(e.conversion).toFixed(2)}%</td>
                          {!readOnly && <td className="actions-cell">
                            <button className="btn sm ghost" onClick={() => openEditEntry(activePage.id, e)}>✎</button>
                            <button className="btn sm danger" onClick={() => delEntry(activePage.id, e.id)}>×</button>
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showNew && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar landing' : 'Nova landing'}</h2>
              <button className="modal-close" onClick={() => setShowNew(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Título</label>
              <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">URL</label>
              <input className="input" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="field">
              <label className="label">Tags</label>
              <TagSelector value={form.tags} onChange={v => setForm({ ...form, tags: v })} />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="btn accent" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {entry && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo registro · {entry.title}</h2>
              <button className="modal-close" onClick={() => setEntry(null)}>×</button>
            </div>
            <div className="field">
              <label className="label">Data</label>
              <input className="input" type="date" value={entryForm.date} onChange={e => setEntryForm({ ...entryForm, date: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Total de visitas</label>
                <input className="input" type="number" value={entryForm.visits} onChange={e => setEntryForm({ ...entryForm, visits: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Leads gerados</label>
                <input className="input" type="number" value={entryForm.leads} onChange={e => setEntryForm({ ...entryForm, leads: e.target.value })} />
              </div>
            </div>
            <div className="hint">
              Conversão calculada automaticamente: {Number(entryForm.visits) > 0 ? ((Number(entryForm.leads) / Number(entryForm.visits)) * 100).toFixed(2) : '0.00'}%
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEntry(null)}>Cancelar</button>
              <button className="btn accent" onClick={saveEntry}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {filtersOpen && (
        <div className="drawer-backdrop" onClick={() => setFiltersOpen(false)}>
          <aside className="filter-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <h2>Filtros</h2>
              <button className="modal-close" onClick={() => setFiltersOpen(false)}>×</button>
            </div>
            <div className="drawer-section">
              <div className="label">Período</div>
              <DateRangePicker value={range} onChange={setRange} />
            </div>
            <div className="drawer-section">
              <div className="label">Tags</div>
              <TagFilter value={tagFilter} onChange={setTagFilter} />
            </div>
            {!readOnly && filtered.length > 0 && (
              <div className="drawer-section">
                <div className="label">Ações em massa</div>
                <button className="btn" onClick={openBulkTagModal}>Selecionar visíveis</button>
              </div>
            )}
          </aside>
        </div>
      )}
      {groupModal && (
        <div className="modal-backdrop">
          <div className="modal small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{groupModal.mode === 'create' ? 'Novo grupo' : 'Escolher grupo'}</h2>
              <button className="modal-close" onClick={() => setGroupModal(null)}>×</button>
            </div>
            {groupModal.mode === 'assign' ? (
              <>
                <div className="dash-toolbar" style={{ marginTop: 0 }}>
                  {groups.map(g => (
                    <button
                      key={g}
                      className={`range-pill ${groupModal.selected === g ? 'active' : ''}`}
                      onClick={() => setGroupModal({ ...groupModal, selected: g })}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setGroupModal({ mode: 'create', name: '', assignPage: groupModal.page })}>Novo grupo</button>
                  <button className="btn accent" onClick={() => assignGroupFromModal(groupModal.selected)}>Salvar</button>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label className="label">Nome</label>
                  <input className="input" autoFocus value={groupModal.name} onChange={e => setGroupModal({ ...groupModal, name: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setGroupModal(null)}>Cancelar</button>
                  <button className="btn accent" onClick={async () => {
                    const name = groupModal.name.trim();
                    if (!name) return;
                    const next = [...new Set([...groups, name])];
                    saveGroups(next);
                    if (groupModal.assignPage) {
                      setGroupModal({ mode: 'assign', page: groupModal.assignPage, selected: name, name: '' });
                    } else {
                      setGroupModal(null);
                      pickGroup(name);
                    }
                  }}>Criar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {bulkTagModal && (
        <div className="modal-backdrop">
          <div className="modal small" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Aplicar tags</h2>
              <button className="modal-close" onClick={() => setBulkTagModal(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">{selected.length} landing pages selecionadas</label>
              <TagSelector value={bulkTags} onChange={setBulkTags} />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => { setBulkTagModal(false); setSelected([]); setBulkTags([]); }}>Cancelar</button>
              <button className="btn accent" disabled={bulkTags.length === 0} onClick={async () => { await applyBulkTags(); setBulkTagModal(false); }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
      {lbModal && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            {lbModal.phase === 'config' ? (
              <>
                <div className="modal-header">
                  <h2>Adição em massa · Landing Pages</h2>
                  <button className="modal-close" onClick={() => setLbModal(null)}>×</button>
                </div>
                <div className="field">
                  <label className="label">Landing page</label>
                  <select className="select" value={lbModal.pageId} onChange={e => setLbModal(p => ({ ...p, pageId: Number(e.target.value) }))} autoFocus>
                    <option value="">Selecione uma página</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label className="label">Data inicial</label>
                    <input className="input" type="date" value={lbModal.dateFrom} onChange={e => setLbModal(p => ({ ...p, dateFrom: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="label">Data final</label>
                    <input className="input" type="date" value={lbModal.dateTo} onChange={e => setLbModal(p => ({ ...p, dateTo: e.target.value }))} />
                  </div>
                </div>
                {lbModal.pageId && lbModal.dateFrom && lbModal.dateTo && lbModal.dateFrom <= lbModal.dateTo && (
                  <div className="text-tertiary" style={{ fontSize: 12, marginBottom: 4 }}>
                    {(() => { let n = 0, c = lbModal.dateFrom; while (c <= lbModal.dateTo) { n++; c = addDays(c, 1); } return `${n} dia${n !== 1 ? 's' : ''}`; })()}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setLbModal(null)}>Cancelar</button>
                  <button className="btn accent"
                    disabled={!lbModal.pageId || !lbModal.dateFrom || !lbModal.dateTo || lbModal.dateFrom > lbModal.dateTo}
                    onClick={() => setLbModal(p => ({ ...p, phase: 'entry', currentDate: p.dateFrom }))}>
                    Iniciar →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h2>{pages.find(p => p.id === Number(lbModal.pageId))?.title} · {(() => { const d = new Date(lbModal.currentDate + 'T12:00:00'); return d.toLocaleDateString('pt-BR'); })()}</h2>
                  <button className="modal-close" onClick={() => setLbModal(null)}>×</button>
                </div>
                <div className="text-tertiary" style={{ fontSize: 12, marginBottom: 12 }}>
                  {lbModal.currentDate < lbModal.dateTo ? `Até ${new Date(lbModal.dateTo + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Último dia'}
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label className="label">Visitas</label>
                    <input className="input" type="number" value={lbModal.visits} autoFocus
                      onChange={e => setLbModal(p => ({ ...p, visits: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') landingBulkNext(); }} />
                  </div>
                  <div className="field">
                    <label className="label">Leads</label>
                    <input className="input" type="number" value={lbModal.leads}
                      onChange={e => setLbModal(p => ({ ...p, leads: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') landingBulkNext(); }} />
                  </div>
                </div>
                {Number(lbModal.visits) > 0 && Number(lbModal.leads) > 0 && (
                  <div className="hint" style={{ marginBottom: 8 }}>
                    Conversão: <strong>{((Number(lbModal.leads) / Number(lbModal.visits)) * 100).toFixed(1)}%</strong>
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setLbModal(null)}>Cancelar</button>
                  <button className="btn accent" onClick={landingBulkNext}>
                    {lbModal.currentDate >= lbModal.dateTo ? 'Finalizar ✓' : 'Próximo →'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {editEntry && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar registro</h2>
              <button className="modal-close" onClick={() => setEditEntry(null)}>×</button>
            </div>
            <div className="field">
              <label className="label">Data</label>
              <input className="input" type="date" value={editEntryForm.date} onChange={e => setEditEntryForm({ ...editEntryForm, date: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Total de visitas</label>
                <input className="input" type="number" value={editEntryForm.visits} onChange={e => setEditEntryForm({ ...editEntryForm, visits: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Leads gerados</label>
                <input className="input" type="number" value={editEntryForm.leads} onChange={e => setEditEntryForm({ ...editEntryForm, leads: e.target.value })} />
              </div>
            </div>
            <div className="hint">
              Conversão: {Number(editEntryForm.visits) > 0 ? ((Number(editEntryForm.leads) / Number(editEntryForm.visits)) * 100).toFixed(2) : '0.00'}%
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setEditEntry(null)}>Cancelar</button>
              <button className="btn accent" onClick={saveEditEntry}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {pendingDelete && (
        <DeleteConfirm
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => pendingDelete.type === 'entry'
            ? delEntryNow(pendingDelete.pid, pendingDelete.eid)
            : delNow(pendingDelete.id)}
        />
      )}
    </div>
  );
}
