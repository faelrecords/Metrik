import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { today, ranges, fmtBR } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import FilterPresets from '../components/FilterPresets.jsx';
import TagSelector, { TagFilter, TagChip } from '../components/TagSelector.jsx';
import { ensureTagIds, firstSheetRows, num, parseDate, readWorkbook, splitTags, writeTemplate } from '../utils/spreadsheet.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';
import Pagination from '../components/Pagination.jsx';

const newCampaign = () => ({ name: '', leads: '', visits: '', total_spent: '', cpl: '' });

export default function Leads({ readOnly = false }) {
  const [range, setRange] = useState({ ...ranges['30d'](), preset: '30d' });
  const [tagFilter, setTagFilter] = useState(null);
  const [rows, setRows] = useState([]);
  const [tags, setTags] = useState([]);
  const [campaignNames, setCampaignNames] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkTags, setBulkTags] = useState([]);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkModal, setBulkModal] = useState(null);
  const importRef = useRef(null);
  const pageSize = 31;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const [form, setForm] = useState({
    date: today(),
    campaigns: [newCampaign()],
    tags: [],
    notes: ''
  });

  async function load() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (tagFilter) params.set('tag', tagFilter);
    const [r, t, cn] = await Promise.all([api.get(`/leads?${params}`), api.get('/tags'), api.get('/campaign_names')]);
    setRows(r);
    setTags(t);
    setCampaignNames(cn);
  }
  useEffect(() => { load(); }, [range.from, range.to, tagFilter]);
  useEffect(() => { setPage(1); }, [range.from, range.to, tagFilter]);

  function open(row) {
    setEditing(row || null);
    setForm(row
      ? { ...row, date: row.period_start, notes: row.notes || '', campaigns: row.campaigns.length ? row.campaigns : [newCampaign()] }
      : { date: today(), campaigns: [newCampaign()], tags: [], notes: '' }
    );
    setShow(true);
  }

  function setCampaign(i, k, v) {
    const cs = [...form.campaigns];
    const updated = { ...cs[i], [k]: v };
    if (k === 'total_spent' || k === 'leads') {
      const spent = Number(k === 'total_spent' ? v : updated.total_spent) || 0;
      const leads = Number(k === 'leads' ? v : updated.leads) || 0;
      updated.cpl = spent > 0 && leads > 0 ? (spent / leads).toFixed(2) : '';
    }
    cs[i] = updated;
    setForm({ ...form, campaigns: cs });
  }

  function addRow() {
    setForm({ ...form, campaigns: [...form.campaigns, newCampaign()] });
  }
  function removeRow(i) {
    const cs = form.campaigns.filter((_, x) => x !== i);
    setForm({ ...form, campaigns: cs.length ? cs : [newCampaign()] });
  }

  async function save() {
    const f = {
      ...form,
      period_start: form.date,
      period_end: form.date,
      campaigns: form.campaigns.filter(c => c.name).map(c => {
        const leads = Number(c.leads) || 0;
        const visits = Number(c.visits) || 0;
        const total_spent = Number(c.total_spent) || 0;
        return {
          name: c.name,
          leads,
          visits,
          total_spent,
          cpl: Number(c.cpl) || (total_spent && leads ? total_spent / leads : 0),
          conversion_rate: visits > 0 ? (leads / visits) * 100 : 0
        };
      })
    };
    try {
      if (editing) await api.put(`/leads/${editing.id}`, f);
      else await api.post('/leads', f);
      setShow(false);
      setEditing(null);
      load();
    } catch (e) { alert(e.message); }
  }

  async function delNow(id) {
    await api.del(`/leads/${id}`);
    setPendingDelete(null);
    load();
  }

  function del(id) {
    if (canSkipDeleteConfirm()) delNow(id);
    else setPendingDelete({ id, message: 'Remover relatório?' });
  }

  function toggleSelected(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function applyBulkTags() {
    for (const id of selected) {
      const row = rows.find(r => r.id === id);
      if (!row) continue;
      await api.put(`/leads/${id}`, { ...row, tags: [...new Set([...(row.tags || []), ...bulkTags])] });
    }
    setSelected([]);
    setBulkTags([]);
    load();
  }

  async function exportXLS() {
    const XLSX = await import('xlsx');
    const flat = [];
    rows.forEach(r => {
      r.campaigns.forEach(c => {
        flat.push({
          Data: fmtBR(r.period_start),
          Campanha: c.name,
          Leads: c.leads,
          Alcance: c.visits || 0,
          'Conversão (%)': (c.conversion_rate || 0).toFixed(1),
          'Total gasto': Number(c.total_spent) || (c.leads || 0) * (c.cpl || 0),
          CPL: c.cpl,
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Volume de leads');
    XLSX.writeFile(wb, `leads_${range.from}_${range.to}.xlsx`);
  }

  async function exportTemplate() {
    await writeTemplate('template_volume_leads.xlsx', 'Volume de leads', [{
      Data: today(),
      Campanha: 'Meta Ads - Conversão',
      Leads: 100,
      Alcance: 500,
      'Total gasto': 1250,
      CPL: 12.5,
      Tags: 'Campanha'
    }]);
  }

  async function importXLS(file) {
    if (!file) return;
    try {
      const { XLSX, workbook } = await readWorkbook(file);
      const data = firstSheetRows(XLSX, workbook);
      const groups = new Map();
      for (const row of data) {
        const date = parseDate(row.Data || row['Início'] || row.Inicio || row.period_start);
        const period_start = date;
        const period_end = parseDate(row.Fim || row.period_end) || date;
        const name = String(row.Campanha || row.Anuncio || row.Anúncio || '').trim();
        if (!period_start || !name) continue;
        const key = `${period_start}|${period_end}|${row.Tags || ''}`;
        if (!groups.has(key)) {
          groups.set(key, { period_start, period_end, tags: splitTags(row.Tags), campaigns: [] });
        }
        const leads = num(row.Leads);
        const visits = num(row.Alcance || row.alcance || row.Visitas || row.visitas || 0);
        const totalSpent = num(row['Total gasto'] || row.Gasto || row.Custo);
        const cpl = num(row.CPL) || (totalSpent && leads ? totalSpent / leads : 0);
        const conversion_rate = visits > 0 ? (leads / visits) * 100 : 0;
        groups.get(key).campaigns.push({ name, leads, visits, total_spent: totalSpent, cpl, conversion_rate });
      }
      let ok = 0, fail = 0;
      for (const group of groups.values()) {
        try {
          await api.post('/leads', { ...group, tags: await ensureTagIds(group.tags, tags, api) });
          ok++;
        } catch { fail++; }
      }
      await load();
      alert(`Importados: ${ok}${fail ? ` · Falhas: ${fail}` : ''}`);
    } catch (e) {
      alert(e.message);
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  }

  function openBulk() {
    setBulkModal({ phase: 'config', dateFrom: today(), dateTo: today(), campaignName: '', tags: [], leads: '', visits: '', total_spent: '' });
  }

  async function bulkNext() {
    const { dateFrom, dateTo, campaignName, tags, currentDate, leads, visits, total_spent } = bulkModal;
    const date = currentDate || dateFrom;
    const leadsN = Number(leads) || 0;
    const visitsN = Number(visits) || 0;
    const spentN = Number(total_spent) || 0;
    const cpl = spentN > 0 && leadsN > 0 ? spentN / leadsN : 0;
    await api.post('/leads', {
      period_start: date, period_end: date,
      campaigns: [{ name: campaignName, leads: leadsN, visits: visitsN, total_spent: spentN, cpl, conversion_rate: visitsN > 0 ? (leadsN / visitsN) * 100 : 0 }],
      tags
    });
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextStr = next.toISOString().slice(0, 10);
    if (nextStr > dateTo) {
      setBulkModal(null);
      load();
    } else {
      setBulkModal(prev => ({ ...prev, phase: 'entry', currentDate: nextStr, leads: '', visits: '', total_spent: '' }));
    }
  }

  function bulkSetField(k, v) {
    setBulkModal(prev => {
      const next = { ...prev, [k]: v };
      if (k === 'total_spent' || k === 'leads') {
        const spent = Number(k === 'total_spent' ? v : next.total_spent) || 0;
        const leads = Number(k === 'leads' ? v : next.leads) || 0;
        next.bulkCpl = spent > 0 && leads > 0 ? (spent / leads).toFixed(2) : '';
      }
      return next;
    });
  }

  // Flatten records into one row per campaign for the compact table
  const flatRows = [];
  pageRows.forEach(r => {
    if (r.campaigns.length === 0) {
      flatRows.push({ record: r, campaign: null, isFirst: true });
    } else {
      r.campaigns.forEach((c, ci) => {
        flatRows.push({ record: r, campaign: c, isFirst: ci === 0 });
      });
    }
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Volume de leads</h1>
          <div className="subtitle">Relatórios por período com leads e CPL por campanha</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setFiltersOpen(true)}>Filtros</button>
          {!readOnly && <button className="btn" onClick={exportTemplate}>Template</button>}
          {!readOnly && <button className="btn" onClick={() => importRef.current?.click()}>Importar</button>}
          {!readOnly && <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importXLS(e.target.files?.[0])} />}
          <button className="btn" onClick={exportXLS}>↓ Excel</button>
          {!readOnly && <button className="btn" onClick={openBulk}>+ Em massa</button>}
          {!readOnly && <button className="btn accent" onClick={() => open(null)}>+ Adicionar relatório</button>}
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
            <h3>Nenhum relatório no período</h3>
            {!readOnly && <p>Clique em "+ Adicionar relatório" para começar.</p>}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {!readOnly && <th><input type="checkbox" checked={pageRows.length > 0 && pageRows.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...pageRows.map(r => r.id)])] : selected.filter(id => !pageRows.some(r => r.id === id)))} /></th>}
                <th>Data</th>
                <th>Campanha</th>
                <th>Leads</th>
                <th>Alcance</th>
                <th>Conversão</th>
                <th>Total gasto</th>
                <th>CPL</th>
                <th>Tags</th>
                {!readOnly && <th></th>}
              </tr>
            </thead>
            <tbody>
              {flatRows.map(({ record: r, campaign: c, isFirst }, fi) => (
                <tr key={`${r.id}-${fi}`} style={isFirst && fi > 0 ? { borderTop: '2px solid rgba(255,255,255,0.06)' } : {}}>
                  {!readOnly && (
                    <td>{isFirst ? <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelected(r.id)} /> : null}</td>
                  )}
                  <td style={{ whiteSpace: 'nowrap' }}>{isFirst ? fmtBR(r.period_start) : ''}</td>
                  <td>{c?.name || '—'}</td>
                  <td>{c?.leads ?? 0}</td>
                  <td>{c?.visits ?? 0}</td>
                  <td>{(c?.conversion_rate || 0).toFixed(1)}%</td>
                  <td>R$ {(Number(c?.total_spent) || (Number(c?.leads || 0) * Number(c?.cpl || 0))).toFixed(2)}</td>
                  <td>R$ {Number(c?.cpl || 0).toFixed(2)}</td>
                  <td>
                    {isFirst ? (
                      <div className="row-flex">
                        {(r.tags || []).map(id => {
                          const tag = tags.find(x => x.id === id);
                          return tag ? <TagChip key={id} tag={tag} /> : null;
                        })}
                      </div>
                    ) : null}
                  </td>
                  {!readOnly && (
                    <td className="actions-cell">
                      {isFirst ? (
                        <>
                          <button className="btn sm ghost" onClick={() => open(r)}>Editar</button>
                          <button className="btn sm danger" onClick={() => del(r.id)}>×</button>
                        </>
                      ) : null}
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
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar relatório' : 'Novo relatório'}</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="field">
              <label className="label">Data</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>

            <div className="field">
              <label className="label">Campanhas</label>
              {form.campaigns.map((c, i) => (
                <div key={i} className="glass-sm" style={{ padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      className="input"
                      list="campaign-names-list"
                      value={c.name}
                      onChange={e => setCampaign(i, 'name', e.target.value)}
                      placeholder="Nome da campanha"
                      style={{ flex: 1 }}
                    />
                    <datalist id="campaign-names-list">
                      {campaignNames.filter(cn => cn.active).map(cn => (
                        <option key={cn.id} value={cn.name} />
                      ))}
                    </datalist>
                    <button className="btn sm danger" onClick={() => removeRow(i)} title="Remover">×</button>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label className="label">Leads</label>
                      <input className="input" type="number" value={c.leads} onChange={e => setCampaign(i, 'leads', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label">Alcance</label>
                      <input className="input" type="number" value={c.visits || ''} onChange={e => setCampaign(i, 'visits', e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label className="label">Total gasto (R$)</label>
                      <input className="input" type="number" step="0.01" value={c.total_spent || ''} onChange={e => setCampaign(i, 'total_spent', e.target.value)} />
                    </div>
                    <div className="field">
                      <label className="label">CPL (R$)</label>
                      <input className="input" type="number" step="0.01" value={c.cpl || ''} onChange={e => setCampaign(i, 'cpl', e.target.value)} placeholder="auto" />
                    </div>
                  </div>
                  {(Number(c.visits) > 0 && Number(c.leads) > 0) && (
                    <div className="text-tertiary" style={{ fontSize: 12, marginTop: 4 }}>
                      Conversão: <strong>{((Number(c.leads) / Number(c.visits)) * 100).toFixed(1)}%</strong>
                    </div>
                  )}
                </div>
              ))}
              <button className="btn sm ghost mt-1" onClick={addRow}>+ Campanha</button>
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

      {bulkModal && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            {bulkModal.phase === 'config' ? (
              <>
                <div className="modal-header">
                  <h2>Adição em massa · Configurar</h2>
                  <button className="modal-close" onClick={() => setBulkModal(null)}>×</button>
                </div>
                <div className="field">
                  <label className="label">Campanha (fixa para todo o período)</label>
                  <input className="input" list="campaign-names-list" value={bulkModal.campaignName} onChange={e => setBulkModal(p => ({ ...p, campaignName: e.target.value }))} placeholder="Nome da campanha" autoFocus />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label className="label">Data inicial</label>
                    <input className="input" type="date" value={bulkModal.dateFrom} onChange={e => setBulkModal(p => ({ ...p, dateFrom: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label className="label">Data final</label>
                    <input className="input" type="date" value={bulkModal.dateTo} onChange={e => setBulkModal(p => ({ ...p, dateTo: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label className="label">Tags</label>
                  <select className="select" value={bulkModal.tags[0] || ''} onChange={e => setBulkModal(p => ({ ...p, tags: e.target.value ? [Number(e.target.value)] : [] }))}>
                    <option value="">Sem tag</option>
                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setBulkModal(null)}>Cancelar</button>
                  <button className="btn accent" disabled={!bulkModal.campaignName.trim() || bulkModal.dateFrom > bulkModal.dateTo}
                    onClick={() => setBulkModal(p => ({ ...p, phase: 'entry', currentDate: p.dateFrom, leads: '', visits: '', total_spent: '', bulkCpl: '' }))}>
                    Iniciar →
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h2>{bulkModal.campaignName} · {(() => { const d = new Date(bulkModal.currentDate + 'T12:00:00'); return d.toLocaleDateString('pt-BR'); })()}</h2>
                  <button className="modal-close" onClick={() => setBulkModal(null)}>×</button>
                </div>
                <div className="text-tertiary" style={{ fontSize: 12, marginBottom: 12 }}>
                  {bulkModal.currentDate <= bulkModal.dateTo ? `Até ${new Date(bulkModal.dateTo + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label className="label">Leads</label>
                    <input className="input" type="number" value={bulkModal.leads} onChange={e => bulkSetField('leads', e.target.value)} autoFocus />
                  </div>
                  <div className="field">
                    <label className="label">Alcance</label>
                    <input className="input" type="number" value={bulkModal.visits} onChange={e => bulkSetField('visits', e.target.value)} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label className="label">Total gasto (R$)</label>
                    <input className="input" type="number" step="0.01" value={bulkModal.total_spent} onChange={e => bulkSetField('total_spent', e.target.value)} />
                  </div>
                  <div className="field">
                    <label className="label">CPL (R$)</label>
                    <input className="input" type="number" step="0.01" value={bulkModal.bulkCpl || ''} readOnly placeholder="auto" style={{ opacity: 0.7 }} />
                  </div>
                </div>
                {Number(bulkModal.visits) > 0 && Number(bulkModal.leads) > 0 && (
                  <div className="text-tertiary" style={{ fontSize: 12, marginBottom: 8 }}>
                    Conversão: <strong>{((Number(bulkModal.leads) / Number(bulkModal.visits)) * 100).toFixed(1)}%</strong>
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn ghost" onClick={() => setBulkModal(null)}>Cancelar</button>
                  <button className="btn accent" onClick={bulkNext}>
                    {bulkModal.currentDate >= bulkModal.dateTo ? 'Finalizar ✓' : 'Próximo →'}
                  </button>
                </div>
              </>
            )}
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
              <FilterPresets onApply={setRange} />
            </div>
            <div className="drawer-section">
              <div className="label">Tags</div>
              <TagFilter value={tagFilter} onChange={setTagFilter} />
            </div>
            {!readOnly && rows.length > 0 && (
              <div className="drawer-section">
                <div className="label">Ações em massa</div>
                <label className="tag-chip">
                  <input type="checkbox" checked={pageRows.length > 0 && pageRows.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? [...new Set([...selected, ...pageRows.map(r => r.id)])] : selected.filter(id => !pageRows.some(r => r.id === id)))} />
                  Selecionar página
                </label>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

