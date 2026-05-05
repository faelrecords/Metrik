import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ranges, fmtBR } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import FilterPresets from '../components/FilterPresets.jsx';
import { TagFilter, TagChip } from '../components/TagSelector.jsx';
import Pagination from '../components/Pagination.jsx';

function aggregateLeads(leadsRows, tags, tagFilter) {
  const byKey = {};
  for (const record of leadsRows) {
    const date = record.period_start;
    const recordTags = record.tags && record.tags.length > 0 ? record.tags : [null];
    for (const tagId of recordTags) {
      if (tagFilter && tagId !== tagFilter) continue;
      const key = `${date}|${tagId ?? 'none'}`;
      if (!byKey[key]) byKey[key] = { date, tagId, leads: 0, reach: 0, total_spent: 0 };
      for (const c of record.campaigns || []) {
        byKey[key].leads += Number(c.leads) || 0;
        byKey[key].reach += Number(c.visits ?? c.reach) || 0;
        byKey[key].total_spent += Number(c.total_spent) || 0;
      }
    }
  }
  return Object.values(byKey).map(r => ({
    ...r,
    cpl: r.leads > 0 ? r.total_spent / r.leads : 0,
    conversion_rate: r.reach > 0 ? (r.leads / r.reach) * 100 : 0,
    tag: tags.find(t => t.id === r.tagId) || null
  })).sort((a, b) => b.date.localeCompare(a.date));
}

export default function Daily() {
  const [range, setRange] = useState({ ...ranges['30d'](), preset: '30d' });
  const [tagFilter, setTagFilter] = useState(null);
  const [leadsRows, setLeadsRows] = useState([]);
  const [tags, setTags] = useState([]);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageSize = 31;

  async function load() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    const [r, t] = await Promise.all([api.get(`/leads?${params}`), api.get('/tags')]);
    setLeadsRows(r);
    setTags(t);
  }

  useEffect(() => { load(); }, [range.from, range.to]);
  useEffect(() => { setPage(1); }, [range.from, range.to, tagFilter]);

  const rows = aggregateLeads(leadsRows, tags, tagFilter);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  async function exportXLS() {
    const XLSX = await import('xlsx');
    const data = rows.map(r => ({
      Data: fmtBR(r.date),
      Tag: r.tag?.name || '(sem tag)',
      Leads: r.leads,
      Alcance: r.reach,
      'Conversão %': r.conversion_rate.toFixed(2),
      'Gasto total': r.total_spent.toFixed(2),
      CPL: r.cpl.toFixed(2)
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Diário');
    XLSX.writeFile(wb, `diario_${range.from}_${range.to}.xlsx`);
  }

  async function exportPDF() {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    let y = 14;
    pdf.setFontSize(16);
    pdf.text(`Métricas diárias · ${fmtBR(range.from)} → ${fmtBR(range.to)}`, 14, y);
    y += 10;
    pdf.setFontSize(9);
    const headers = ['Data', 'Tag', 'Leads', 'Alcance', 'Conv%', 'Gasto', 'CPL'];
    const cw = [22, 34, 18, 18, 16, 28, 24];
    let x = 14;
    headers.forEach((h, i) => { pdf.text(h, x, y); x += cw[i]; });
    y += 6;
    pdf.line(14, y - 3, 196, y - 3);
    rows.forEach(r => {
      if (y > 280) { pdf.addPage(); y = 14; }
      x = 14;
      const vals = [
        fmtBR(r.date),
        r.tag?.name || '(sem tag)',
        String(r.leads),
        String(r.reach),
        r.conversion_rate.toFixed(1) + '%',
        'R$' + r.total_spent.toFixed(2),
        'R$' + r.cpl.toFixed(2)
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
          <div className="subtitle">Agregado automático dos leads por dia e tag</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setFiltersOpen(true)}>Filtros</button>
          <button className="btn" onClick={exportXLS}>↓ Excel</button>
          <button className="btn" onClick={exportPDF}>↓ PDF</button>
        </div>
      </div>

      <div className="glass" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>Sem dados no período</h3>
            <p>Adicione leads com tags em "Leads" para ver os dados aqui.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tag</th>
                <th>Leads</th>
                <th>Alcance</th>
                <th>Conversão</th>
                <th>Gasto total</th>
                <th>CPL</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtBR(r.date)}</td>
                  <td>
                    {r.tag ? <TagChip tag={r.tag} /> : <span className="text-tertiary" style={{ fontSize: 12 }}>sem tag</span>}
                  </td>
                  <td>{r.leads}</td>
                  <td>{r.reach}</td>
                  <td>{r.conversion_rate.toFixed(1)}%</td>
                  <td>R$ {r.total_spent.toFixed(2)}</td>
                  <td>R$ {r.cpl.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      </div>

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
              <div className="label">Tag</div>
              <TagFilter value={tagFilter} onChange={setTagFilter} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}


