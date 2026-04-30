import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { today, addDays, ranges, fmtBR } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import TagSelector, { TagFilter, TagChip } from '../components/TagSelector.jsx';
import { ensureTagIds, firstSheetRows, num, parseDate, readWorkbook, splitTags, writeTemplate } from '../utils/spreadsheet.js';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

const newCampaign = () => ({ name: '', leads: '', cpl: '' });

export default function Leads() {
  const [range, setRange] = useState({ ...ranges['30d'](), preset: '30d' });
  const [tagFilter, setTagFilter] = useState(null);
  const [rows, setRows] = useState([]);
  const [tags, setTags] = useState([]);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkTags, setBulkTags] = useState([]);
  const importRef = useRef(null);
  const [form, setForm] = useState({
    period_start: addDays(today(), -6),
    period_end: today(),
    campaigns: [newCampaign()],
    tags: [],
    notes: ''
  });

  async function load() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (tagFilter) params.set('tag', tagFilter);
    const [r, t] = await Promise.all([api.get(`/leads?${params}`), api.get('/tags')]);
    setRows(r);
    setTags(t);
  }
  useEffect(() => { load(); }, [range.from, range.to, tagFilter]);

  function open(row) {
    setEditing(row || null);
    setForm(row ? { ...row, campaigns: row.campaigns.length ? row.campaigns : [newCampaign()] } : {
      period_start: addDays(today(), -6),
      period_end: today(),
      campaigns: [newCampaign()],
      tags: [],
      notes: ''
    });
    setShow(true);
  }

  function setCampaign(i, k, v) {
    const cs = [...form.campaigns];
    cs[i] = { ...cs[i], [k]: v };
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
      campaigns: form.campaigns.filter(c => c.name).map(c => ({
        name: c.name,
        leads: Number(c.leads) || 0,
        cpl: Number(c.cpl) || 0
      }))
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

  function totalsOf(r) {
    const totalLeads = r.campaigns.reduce((s, c) => s + (c.leads || 0), 0);
    const totalCost = r.campaigns.reduce((s, c) => s + (c.leads || 0) * (c.cpl || 0), 0);
    const avgCpl = totalLeads > 0 ? totalCost / totalLeads : 0;
    return { totalLeads, totalCost, avgCpl };
  }

  async function exportXLS() {
    const XLSX = await import('xlsx');
    const flat = [];
    rows.forEach(r => {
      r.campaigns.forEach(c => {
        flat.push({
          Período: `${fmtBR(r.period_start)} → ${fmtBR(r.period_end)}`,
          Campanha: c.name,
          Leads: c.leads,
          CPL: c.cpl,
          'Custo total': (c.leads || 0) * (c.cpl || 0)
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
      'Início': addDays(today(), -6),
      'Fim': today(),
      Campanha: 'Meta Ads - Conversão',
      Leads: 100,
      CPL: 12.5,
      Tags: 'Campanha',
      Notas: 'Opcional'
    }]);
  }

  async function importXLS(file) {
    if (!file) return;
    try {
      const { XLSX, workbook } = await readWorkbook(file);
      const data = firstSheetRows(XLSX, workbook);
      const groups = new Map();
      for (const row of data) {
        const period_start = parseDate(row['Início'] || row.Inicio || row.period_start);
        const period_end = parseDate(row.Fim || row.period_end);
        const name = String(row.Campanha || row.Anuncio || row.Anúncio || '').trim();
        if (!period_start || !period_end || !name) continue;
        const key = `${period_start}|${period_end}|${row.Tags || ''}|${row.Notas || ''}`;
        if (!groups.has(key)) {
          groups.set(key, {
            period_start,
            period_end,
            tags: splitTags(row.Tags),
            notes: row.Notas || '',
            campaigns: []
          });
        }
        groups.get(key).campaigns.push({ name, leads: num(row.Leads), cpl: num(row.CPL) });
      }
      let ok = 0;
      let fail = 0;
      for (const group of groups.values()) {
        try {
          await api.post('/leads', {
            ...group,
            tags: await ensureTagIds(group.tags, tags, api)
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
          <h1>Volume de leads</h1>
          <div className="subtitle">Relatórios por período com leads e CPL por campanha</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={exportTemplate}>Template</button>
          <button className="btn" onClick={() => importRef.current?.click()}>Importar</button>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importXLS(e.target.files?.[0])} />
          <button className="btn" onClick={exportXLS}>↓ Excel</button>
          <button className="btn accent" onClick={() => open(null)}>+ Adicionar relatório</button>
        </div>
      </div>

      <div className="dash-toolbar">
        <DateRangePicker value={range} onChange={setRange} />
      </div>
      <div className="dash-toolbar">
        <TagFilter value={tagFilter} onChange={setTagFilter} />
      </div>
      {rows.length > 0 && (
        <div className="dash-toolbar">
          <label className="tag-chip">
            <input type="checkbox" checked={selected.length === rows.length} onChange={e => setSelected(e.target.checked ? rows.map(r => r.id) : [])} />
            Selecionar todos
          </label>
        </div>
      )}
      {selected.length > 0 && (
        <div className="glass-sm bulk-bar">
          <strong>{selected.length} selecionados</strong>
          <TagSelector value={bulkTags} onChange={setBulkTags} />
          <button className="btn accent" onClick={applyBulkTags} disabled={bulkTags.length === 0}>Aplicar tags</button>
          <button className="btn ghost" onClick={() => setSelected([])}>Limpar</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="glass">
          <div className="empty-state">
            <h3>Nenhum relatório no período</h3>
            <p>Clique em "+ Adicionar relatório" para começar.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map(r => {
            const t = totalsOf(r);
            return (
              <div key={r.id} className="glass">
                <div className="row-flex mb-2" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="row-flex">
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelected(r.id)} />
                      <h3 style={{ marginBottom: 4 }}>{fmtBR(r.period_start)} → {fmtBR(r.period_end)}</h3>
                    </div>
                    <div className="row-flex">
                      {(r.tags || []).map(id => {
                        const tag = tags.find(x => x.id === id);
                        return tag ? <TagChip key={id} tag={tag} /> : null;
                      })}
                    </div>
                  </div>
                  <div className="row-flex">
                    <div className="text-tertiary">
                      <strong className="text-primary" style={{ fontSize: 18 }}>{t.totalLeads}</strong> leads
                    </div>
                    <div className="text-tertiary">
                      Custo: <strong className="text-primary">R$ {t.totalCost.toFixed(2)}</strong>
                    </div>
                    <div className="text-tertiary">
                      CPL médio: <strong className="text-primary">R$ {t.avgCpl.toFixed(2)}</strong>
                    </div>
                    <button className="btn sm ghost" onClick={() => open(r)}>Editar</button>
                    <button className="btn sm danger" onClick={() => del(r.id)}>×</button>
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr><th>Campanha</th><th>Leads</th><th>CPL</th><th>Custo</th></tr>
                  </thead>
                  <tbody>
                    {r.campaigns.map((c, i) => (
                      <tr key={i}>
                        <td>{c.name}</td>
                        <td>{c.leads}</td>
                        <td>R$ {Number(c.cpl).toFixed(2)}</td>
                        <td>R$ {(Number(c.leads) * Number(c.cpl)).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.notes && <div className="mt-2 text-tertiary" style={{ fontSize: 12 }}>{r.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <div className="modal-backdrop" onClick={() => setShow(false)}>
          <div className="modal wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar relatório' : 'Novo relatório'}</h2>
              <button className="modal-close" onClick={() => setShow(false)}>×</button>
            </div>
            <div className="grid-2">
              <div className="field">
                <label className="label">Início do período</label>
                <input className="input" type="date" value={form.period_start} onChange={e => setForm({ ...form, period_start: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Fim do período</label>
                <input className="input" type="date" value={form.period_end} onChange={e => setForm({ ...form, period_end: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label className="label">Campanhas</label>
              <div className="sheet">
                <div className="sheet-row header">
                  <div>Nome da campanha</div>
                  <div>Leads</div>
                  <div>CPL (R$)</div>
                  <div></div>
                </div>
                {form.campaigns.map((c, i) => (
                  <div className="sheet-row" key={i}>
                    <input value={c.name} onChange={e => setCampaign(i, 'name', e.target.value)} placeholder="Ex: Meta Ads — Conversão" />
                    <input type="number" value={c.leads} onChange={e => setCampaign(i, 'leads', e.target.value)} />
                    <input type="number" step="0.01" value={c.cpl} onChange={e => setCampaign(i, 'cpl', e.target.value)} />
                    <div className="row-action">
                      <button onClick={() => removeRow(i)} title="Remover">×</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn sm ghost mt-1" onClick={addRow}>+ Linha</button>
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
    </div>
  );
}
