import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { today, ranges, fmtBR } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import TagSelector, { TagFilter, TagChip } from '../components/TagSelector.jsx';
import { ensureTagIds, firstSheetRows, num, parseDate, readWorkbook, splitTags, writeTemplate } from '../utils/spreadsheet.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';
import Pagination from '../components/Pagination.jsx';

const EMPTY = { date: today(), leads: '', cpl: '', total_spent: '', visits: '', conversion_rate: '', tags: [], notes: '' };

export default function Daily({ readOnly = false }) {
  const [range, setRange] = useState({ ...ranges['30d'](), preset: '30d' });
  const [tagFilter, setTagFilter] = useState(null);
  const [rows, setRows] = useState([]);
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkTags, setBulkTags] = useState([]);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const importRef = useRef(null);
  const pageSize = 31;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  async function load() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (tagFilter) params.set('tag', tagFilter);
    const [r, t] = await Promise.all([api.get(`/daily?${params}`), api.get('/tags')]);
    setRows(r.reverse());
    setTags(t);
  }
  useEffect(() => { load(); }, [range.from, range.to, tagFilter]);
  useEffect(() => { setPage(1); }, [range.from, range.to, tagFilter]);

  function open(row) {
    setEditing(row || null);
    setForm(row ? { ...row } : EMPTY);
    setShow(true);
  }

  async function save() {
    // auto calcular conversão se vazio
    const f = { ...form };
    if (!f.conversion_rate && f.visits && f.leads) {
      f.conversion_rate = (Number(f.leads) / Number(f.visits)) * 100;
    }
    if (!f.cpl && f.total_spent && f.leads) {
      f.cpl = Number(f.total_spent) / Number(f.leads);
    }
    try {
      if (editing) await api.put(`/daily/${editing.id}`, f);
      else await api.post('/daily', f);
      setShow(false);
      setEditing(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function delNow(id) {
    await api.del(`/daily/${id}`);
    setPendingDelete(null);
    load();
  }

  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover registro?' });
  }

  function toggleSelected(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function applyBulkTags() {
    for (const id of selected) {
      const row = rows.find(r => r.id === id);
      if (!row) continue;
      const tagsNext = [...new Set([...(row.tags || []), ...bulkTags])];
      await api.put(`/daily/${id}`, { ...row, tags: tagsNext });
    }
    setSelected([]);
    setBulkTags([]);
    load();
  }

  async function exportXLS() {
    const XLSX = await import('xlsx');
    const data = rows.map(r => ({
      Data: fmtBR(r.date),
      Leads: r.leads,
      CPL: r.cpl,
      'Gasto total': r.total_spent,
      Visitas: r.visits,
      'Conversão %': r.conversion_rate,
      Tags: (r.tags || []).map(id => tags.find(t => t.id === id)?.name).filter(Boolean).join(', '),
      Notas: r.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diário');
    XLSX.writeFile(wb, `diario_${range.from}_${range.to}.xlsx`);
  }

  async function exportTemplate() {
    await writeTemplate('template_metricas_diarias.xlsx', 'Metricas diarias', [{
      Data: today(),
      Leads: 100,
      CPL: 12.5,
      'Gasto total': 1250,
      Visitas: 1000,
      'Conversão %': 10,
      Tags: 'Conta de anúncio',
      Notas: 'Opcional'
    }]);
  }

  async function importXLS(file) {
    if (!file) return;
    try {
      const { XLSX, workbook } = await readWorkbook(file);
      const data = firstSheetRows(XLSX, workbook);
      let ok = 0;
      let fail = 0;
      for (const row of data) {
        const date = parseDate(row.Data || row.data);
        if (!date) { fail++; continue; }
        const payload = {
          date,
          leads: num(row.Leads),
          cpl: num(row.CPL),
          total_spent: num(row['Gasto total'] || row.Gasto),
          visits: num(row.Visitas),
          conversion_rate: num(row['Conversão %'] || row.Conversao || row['Conversao %']),
          tags: await ensureTagIds(splitTags(row.Tags), tags, api),
          notes: row.Notas || ''
        };
        const existing = rows.find(r => r.date === date);
        try {
          if (existing) await api.put(`/daily/${existing.id}`, payload);
          else await api.post('/daily', payload);
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

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 14;
    pdf.setFontSize(16);
    pdf.text(`Métricas diárias · ${fmtBR(range.from)} → ${fmtBR(range.to)}`, 14, y);
    y += 10;
    pdf.setFontSize(9);
    const headers = ['Data', 'Leads', 'CPL', 'Gasto', 'Visitas', 'Conv%'];
    const cw = [25, 22, 28, 32, 25, 22];
    let x = 14;
    headers.forEach((h, i) => { pdf.text(h, x, y); x += cw[i]; });
    y += 6;
    pdf.line(14, y - 3, 196, y - 3);
    rows.forEach(r => {
      if (y > 280) { pdf.addPage(); y = 14; }
      x = 14;
      const vals = [
        fmtBR(r.date),
        String(r.leads),
        'R$' + Number(r.cpl).toFixed(2),
        'R$' + Number(r.total_spent).toFixed(2),
        String(r.visits),
        Number(r.conversion_rate).toFixed(2) + '%'
      ];
      vals.forEach((v, i) => { pdf.text(v, x, y); x += cw[i]; });
      y += 6;
    });
    pdf.save(`diario_${range.from}_${range.to}.pdf`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Métricas diárias</h1>
          <div className="subtitle">Registro diário de leads, CPL, gasto, visitas e conversão</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setFiltersOpen(true)}>Filtros</button>
          {!readOnly && <button className="btn" onClick={exportTemplate}>Template</button>}
          {!readOnly && <button className="btn" onClick={() => importRef.current?.click()}>Importar</button>}
          {!readOnly && <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importXLS(e.target.files?.[0])} />}
          <button className="btn" onClick={exportXLS}>↓ Excel</button>
          <button className="btn" onClick={exportPDF}>↓ PDF</button>
          {!readOnly && <button className="btn accent" onClick={() => open(null)}>+ Registrar</button>}
        </div>
      </div>

      {!readOnly && selected.length > 0 && (
        <div className="glass-sm bulk-bar">
          <strong>{selected.length} selecionados</strong>
          <TagSelector value={bulkTags} onChange={setBulkTags} />
          <button className="btn accent" onClick={applyBulkTags} disabled={bulkTags.length === 0}>Aplicar tags</button>
          <button className="btn ghost" onClick={() => setSelected([])}>Limpar</button>
        </div>
      )}

      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>Sem registros no período</h3>
            {!readOnly && <p>Clique em "+ Registrar" para adicionar.</p>}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {!readOnly && <th><input type="checkbox" checked={pageRows.length > 0 && pageRows.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...pageRows.map(r => r.id)])] : selected.filter(id => !pageRows.some(r => r.id === id)))} /></th>}<th>Data</th><th>Leads</th><th>CPL</th><th>Gasto</th><th>Visitas</th><th>Conversão</th><th>Tags</th>{!readOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {pageRows.map(r => (
                <tr key={r.id}>
                  {!readOnly && <td><input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelected(r.id)} /></td>}
                  <td>{fmtBR(r.date)}</td>
                  <td>{r.leads}</td>
                  <td>R$ {Number(r.cpl).toFixed(2)}</td>
                  <td>R$ {Number(r.total_spent).toFixed(2)}</td>
                  <td>{r.visits}</td>
                  <td>{Number(r.conversion_rate).toFixed(2)}%</td>
                  <td>
                    <div className="row-flex">
                      {(r.tags || []).map(id => {
                        const t = tags.find(x => x.id === id);
                        return t ? <TagChip key={id} tag={t} /> : null;
                      })}
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="actions-cell">
                      <button className="btn sm ghost" onClick={() => open(r)}>Editar</button>
                      <button className="btn sm danger" onClick={() => del(r.id)}>×</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

      {show && (
        <div className="modal-backdrop" onClick={() => setShow(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar registro' : 'Novo registro'}</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Data</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Leads</label>
                <input className="input" type="number" value={form.leads} onChange={e => setForm({ ...form, leads: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">CPL (R$)</label>
                <input className="input" type="number" step="0.01" value={form.cpl} onChange={e => setForm({ ...form, cpl: e.target.value })} placeholder="auto se gasto/leads preenchidos" />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Gasto total (R$)</label>
                <input className="input" type="number" step="0.01" value={form.total_spent} onChange={e => setForm({ ...form, total_spent: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Visitas</label>
                <input className="input" type="number" value={form.visits} onChange={e => setForm({ ...form, visits: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label className="label">Conversão (%)</label>
              <input className="input" type="number" step="0.01" value={form.conversion_rate} onChange={e => setForm({ ...form, conversion_rate: e.target.value })} placeholder="auto se visitas/leads preenchidos" />
            </div>
            <div className="field">
              <label className="label">Tags</label>
              <TagSelector value={form.tags} onChange={v => setForm({ ...form, tags: v })} />
            </div>
            <div className="field">
              <label className="label">Notas</label>
              <textarea className="textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
          </aside>
        </div>
      )}
    </div>
  );
}
