import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { today, addDays, fmtBR } from '../utils/dates.js';
import TagSelector, { TagFilter, TagChip } from '../components/TagSelector.jsx';
import { ensureTagIds, firstSheetRows, num, parseDate, readWorkbook, splitTags, writeTemplate } from '../utils/spreadsheet.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

export default function Landing() {
  const [pages, setPages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagFilter, setTagFilter] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);
  const [entry, setEntry] = useState(null);
  const [form, setForm] = useState({ title: '', url: '', tags: [] });
  const [entryForm, setEntryForm] = useState({ period_start: addDays(today(), -6), period_end: today(), visits: '', leads: '' });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkTags, setBulkTags] = useState([]);
  const importRef = useRef(null);

  async function load() {
    const [p, t] = await Promise.all([api.get('/landing'), api.get('/tags')]);
    setPages(p);
    setTags(t);
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
    setEntryForm({ period_start: addDays(today(), -6), period_end: today(), visits: '', leads: '' });
  }

  async function saveEntry() {
    try {
      await api.post(`/landing/${entry.id}/entries`, entryForm);
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

  const filtered = tagFilter ? pages.filter(p => (p.tags || []).includes(tagFilter)) : pages;

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

  async function exportXLS() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const summary = filtered.map(p => ({
      Título: p.title,
      URL: p.url,
      'Visitas (total)': p.totalVisits,
      'Leads (total)': p.totalLeads,
      'Conversão %': Number(p.conversion).toFixed(2)
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Resumo');
    const detail = [];
    filtered.forEach(p => {
      p.entries.forEach(e => {
        detail.push({
          Página: p.title,
          'Início': fmtBR(e.period_start),
          'Fim': fmtBR(e.period_end),
          Visitas: e.visits,
          Leads: e.leads,
          'Conversão %': Number(e.conversion).toFixed(2)
        });
      });
    });
    if (detail.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Detalhes');
    XLSX.writeFile(wb, `landing_pages.xlsx`);
  }

  async function exportTemplate() {
    await writeTemplate('template_landing_pages.xlsx', 'Landing pages', [{
      Título: 'Landing principal',
      URL: 'https://exemplo.com/landing',
      'Início': addDays(today(), -6),
      Fim: today(),
      Visitas: 1000,
      Leads: 100,
      Tags: 'Landing',
      Notas: 'Opcional'
    }]);
  }

  async function importXLS(file) {
    if (!file) return;
    try {
      const { XLSX, workbook } = await readWorkbook(file);
      const data = firstSheetRows(XLSX, workbook);
      const pageMap = new Map(pages.map(p => [`${p.title}|${p.url}`, p]));
      let ok = 0;
      let fail = 0;
      for (const row of data) {
        const title = String(row.Título || row.Titulo || row.Página || row.Pagina || '').trim();
        const url = String(row.URL || '').trim();
        const period_start = parseDate(row['Início'] || row.Inicio);
        const period_end = parseDate(row.Fim);
        if (!title || !url || !period_start || !period_end) { fail++; continue; }
        try {
          let page = pageMap.get(`${title}|${url}`);
          if (!page) {
            page = await api.post('/landing', {
              title,
              url,
              tags: await ensureTagIds(splitTags(row.Tags), tags, api)
            });
            pageMap.set(`${title}|${url}`, page);
          }
          await api.post(`/landing/${page.id}/entries`, {
            period_start,
            period_end,
            visits: num(row.Visitas),
            leads: num(row.Leads)
          });
          ok++;
        } catch {
          fail++;
        }
      }
      await load();
      alert(`Importados: ${ok}${fail ? ` · Falhas: ${fail}` : ''}`);
    } catch (e) {
      alert(e.message);
    } finally {
      if (importRef.current) importRef.current.value = '';
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
          <button className="btn" onClick={exportTemplate}>Template</button>
          <button className="btn" onClick={() => importRef.current?.click()}>Importar</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importXLS(e.target.files?.[0])} />
          <button className="btn" onClick={exportXLS}>↓ Excel</button>
          <button className="btn accent" onClick={() => open(null)}>+ Nova landing</button>
        </div>
      </div>

      <div className="dash-toolbar">
        <TagFilter value={tagFilter} onChange={setTagFilter} />
      </div>
      {filtered.length > 0 && (
        <div className="dash-toolbar">
          <label className="tag-chip">
            <input type="checkbox" checked={selected.length === filtered.length} onChange={e => setSelected(e.target.checked ? filtered.map(p => p.id) : [])} />
            Selecionar todas
          </label>
        </div>
      )}
      {selected.length > 0 && (
        <div className="glass-sm bulk-bar">
          <strong>{selected.length} selecionadas</strong>
          <TagSelector value={bulkTags} onChange={setBulkTags} />
          <button className="btn accent" onClick={applyBulkTags} disabled={bulkTags.length === 0}>Aplicar tags</button>
          <button className="btn ghost" onClick={() => setSelected([])}>Limpar</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <h3>Nenhuma landing cadastrada</h3>
            <p>Adicione título e URL para começar.</p>
          </div>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map(p => (
            <div key={p.id} className="glass">
              <div className="row-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-flex">
                    <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelected(p.id)} />
                    <h3 style={{ marginBottom: 4 }}>{p.title}</h3>
                  </div>
                  <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, wordBreak: 'break-all' }}>{p.url}</a>
                  <div className="row-flex mt-1">
                    {(p.tags || []).map(id => {
                      const t = tags.find(x => x.id === id);
                      return t ? <TagChip key={id} tag={t} /> : null;
                    })}
                  </div>
                </div>
                <div className="row-flex">
                  <button className="btn sm ghost" onClick={() => open(p)}>Editar</button>
                  <button className="btn sm danger" onClick={() => del(p.id)}>×</button>
                </div>
              </div>
              <div className="grid-3 mt-2">
                <div className="glass-sm" style={{ textAlign: 'center', padding: 14 }}>
                  <div className="text-tertiary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Visitas</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{p.totalVisits.toLocaleString('pt-BR')}</div>
                </div>
                <div className="glass-sm" style={{ textAlign: 'center', padding: 14 }}>
                  <div className="text-tertiary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Leads</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{p.totalLeads.toLocaleString('pt-BR')}</div>
                </div>
                <div className="glass-sm" style={{ textAlign: 'center', padding: 14 }}>
                  <div className="text-tertiary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Conversão</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-text)' }}>{Number(p.conversion).toFixed(2)}%</div>
                </div>
              </div>

              <div className="mt-2">
                <div className="row-flex" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong className="text-secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Registros</strong>
                  <button className="btn sm" onClick={() => openEntry(p)}>+ Registro</button>
                </div>
                {p.entries.length === 0 ? (
                  <div className="text-tertiary" style={{ fontSize: 12, padding: 8 }}>Sem registros ainda.</div>
                ) : (
                  <table className="table">
                    <thead><tr><th>Período</th><th>Visitas</th><th>Leads</th><th>Conv.</th><th></th></tr></thead>
                    <tbody>
                      {p.entries.slice().reverse().map(e => (
                        <tr key={e.id}>
                          <td style={{ fontSize: 12 }}>{fmtBR(e.period_start)}→{fmtBR(e.period_end)}</td>
                          <td>{e.visits}</td>
                          <td>{e.leads}</td>
                          <td>{Number(e.conversion).toFixed(2)}%</td>
                          <td className="actions-cell"><button className="btn sm danger" onClick={() => delEntry(p.id, e.id)}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="modal-backdrop" onClick={() => setShowNew(false)}>
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
        <div className="modal-backdrop" onClick={() => setEntry(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo registro · {entry.title}</h2>
              <button className="modal-close" onClick={() => setEntry(null)}>×</button>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Início</label>
                <input className="input" type="date" value={entryForm.period_start} onChange={e => setEntryForm({ ...entryForm, period_start: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Fim</label>
                <input className="input" type="date" value={entryForm.period_end} onChange={e => setEntryForm({ ...entryForm, period_end: e.target.value })} />
              </div>
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
