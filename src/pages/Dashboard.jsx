import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { ranges } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import FilterPresets from '../components/FilterPresets.jsx';
import WidgetCard from '../components/WidgetCard.jsx';
import WidgetEditor from '../components/WidgetEditor.jsx';
import { TagFilter } from '../components/TagSelector.jsx';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

export default function Dashboard({ user }) {
  const readOnly = user?.role === 'user';
  const [range, setRange] = useState({ ...ranges['7d'](), preset: '7d' });
  const [tagFilter, setTagFilter] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [leads, setLeads] = useState([]);
  const [landing, setLanding] = useState([]);
  const [campaignNames, setCampaignNames] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dashModal, setDashModal] = useState(null); // { mode: 'create' | 'duplicate' }
  const [dashModalName, setDashModalName] = useState('');
  const dashRef = useRef(null);

  async function loadDashboards() {
    const list = await api.get('/dashboards');
    setDashboards(list);
    setActiveDashboard(current => current && list.find(d => d.id === current.id) ? current : list[0] || null);
    return list;
  }

  async function loadData() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (tagFilter) params.set('tag', tagFilter);
    const list = dashboards.length ? dashboards : await loadDashboards();
    const dash = activeDashboard || list[0];
    if (!dash) return;
    const [l, lp, ws, cn] = await Promise.all([
      api.get(`/leads?${params}`),
      api.get('/landing'),
      api.get(`/widgets?dashboard_id=${dash.id}`),
      api.get('/campaign_names')
    ]);
    setLeads(l);
    setLanding(lp);
    setWidgets(ws);
    setCampaignNames(cn);
  }

  useEffect(() => { loadDashboards(); }, []);
  useEffect(() => { if (activeDashboard) loadData(); }, [range.from, range.to, tagFilter, activeDashboard?.id]);

  async function createDashboard() {
    setDashModalName('Novo dashboard');
    setDashModal({ mode: 'create' });
  }

  async function createDashboardNow(title) {
    const dash = await api.post('/dashboards', { title });
    const list = await loadDashboards();
    setDashboards(list);
    setActiveDashboard(dash);
  }

  async function renameDashboard() {
    if (!activeDashboard) return;
    setDashModalName(activeDashboard.title);
    setDashModal({ mode: 'rename' });
  }

  async function renameDashboardNow(title) {
    const updated = await api.put(`/dashboards/${activeDashboard.id}`, { title });
    setActiveDashboard(updated);
    loadDashboards();
  }

  async function duplicateDashboard() {
    if (!activeDashboard) return;
    setDashModalName(`${activeDashboard.title} (cópia)`);
    setDashModal({ mode: 'duplicate' });
  }

  async function duplicateDashboardNow(title) {
    const newDash = await api.post('/dashboards', { title });
    for (const w of widgets) {
      const { id, dashboard_id, user_id, created_at, position, ...rest } = w;
      await api.post('/widgets', { ...rest, dashboard_id: newDash.id });
    }
    const list = await loadDashboards();
    setActiveDashboard(list.find(d => d.id === newDash.id) || newDash);
  }

  async function deleteDashboardNow(id) {
    await api.del(`/dashboards/${id}`);
    setPendingDelete(null);
    const list = await loadDashboards();
    setActiveDashboard(list[0] || null);
    setWidgets([]);
  }

  function deleteDashboard() {
    if (!activeDashboard) return;
    if (canSkipDeleteConfirm()) deleteDashboardNow(activeDashboard.id);
    else setPendingDelete({ type: 'dashboard', id: activeDashboard.id, message: 'Remover dashboard e seus widgets?' });
  }

  async function saveWidget(w) {
    const payload = { ...w, dashboard_id: activeDashboard?.id };
    if (editing) {
      await api.put(`/widgets/${editing.id}`, payload);
    } else {
      await api.post('/widgets', payload);
    }
    setEditing(null);
    setShowNew(false);
    loadData();
  }

  async function deleteWidgetNow(id) {
    await api.del(`/widgets/${id}`);
    setPendingDelete(null);
    loadData();
  }

  function deleteWidget(id) {
    if (canSkipDeleteConfirm()) deleteWidgetNow(id);
    else setPendingDelete({ type: 'widget', id, message: 'Remover widget?' });
  }

  async function confirmDashModal() {
    const name = dashModalName.trim() || 'Novo dashboard';
    const mode = dashModal.mode;
    setDashModal(null);
    if (mode === 'create') await createDashboardNow(name);
    else if (mode === 'rename') await renameDashboardNow(name);
    else if (mode === 'duplicate') await duplicateDashboardNow(name);
  }

  const PRESETS = [
    { title: 'Gasto total', source: 'daily', field: 'total_spent', aggregation: 'sum', chart_type: 'kpi', color: '#6d71f0', size: 3 },
    { title: 'CPL médio', source: 'daily', field: 'cpl', aggregation: 'avg', chart_type: 'kpi', color: '#8a8ef5', size: 3 },
    { title: 'Evolução do CPL', source: 'daily', field: 'cpl', aggregation: 'avg', chart_type: 'line', color: '#8a8ef5', size: 6 },
    { title: 'Conversão média das LPs', source: 'landing', field: 'conversion', aggregation: 'avg', chart_type: 'kpi', color: '#30d173', size: 3 },
    { title: 'Leads por landing page', source: 'landing', field: 'totalLeads', aggregation: 'sum', chart_type: 'bar', color: '#6d71f0', size: 6 },
    { title: 'Alcance por landing page', source: 'landing', field: 'totalVisits', aggregation: 'sum', chart_type: 'pie', color: '#6d71f0', size: 6 },
    { title: 'Leads por campanha', source: 'leads', field: 'leads', aggregation: 'sum', chart_type: 'bar', color: '#c4c6ff', size: 6 },
    { title: 'Gasto por campanha', source: 'leads', field: 'total_spent', aggregation: 'sum', chart_type: 'pie', color: '#ffb84d', size: 6 },
    { title: 'Conversão diária', source: 'daily', field: 'conversion_rate', aggregation: 'avg', chart_type: 'area', color: '#30d173', size: 6 },
    { title: 'Leads acumulados', source: 'daily', field: 'leads', aggregation: 'sum', chart_type: 'area', color: '#6d71f0', size: 6 },
  ];

  async function addPresets() {
    if (!activeDashboard) return;
    for (const preset of PRESETS) {
      await api.post('/widgets', { ...preset, dashboard_id: activeDashboard.id });
    }
    loadData();
  }

  async function exportPDF() {
    const { default: html2canvas } = await import('html2canvas');
    const { default: jsPDF } = await import('jspdf');
    const node = dashRef.current;
    const canvas = await html2canvas(node, { backgroundColor: '#0b0b0b', scale: 2 });
    const img = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, 'PNG', 0, 0, w, h);
    pdf.save(`dashboard_${range.from}_${range.to}.pdf`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{activeDashboard?.title || 'Dashboards'}</h1>
          <div className="subtitle">{range.label}{range.from ? ` · ${range.from} → ${range.to}` : ''}</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={() => setFiltersOpen(true)}>Filtros</button>
          {!readOnly && <button className="btn" onClick={renameDashboard} disabled={!activeDashboard}>Renomear</button>}
          {!readOnly && <button className="btn" onClick={duplicateDashboard} disabled={!activeDashboard}>Duplicar</button>}
          {!readOnly && <button className="btn danger" onClick={deleteDashboard} disabled={dashboards.length <= 1}>Excluir página</button>}
          <button className="btn" onClick={exportPDF}>↓ PDF</button>
          {!readOnly && <button className="btn" onClick={createDashboard}>+ Tab</button>}
          {!readOnly && <button className="btn" onClick={addPresets} disabled={!activeDashboard}>★ Sugeridos</button>}
          {!readOnly && <button className="btn accent" onClick={() => setShowNew(true)}>+ Widget</button>}
        </div>
      </div>

      <div className="dash-pages">
        {dashboards.map(d => (
          <button
            key={d.id}
            className={`range-pill ${activeDashboard?.id === d.id ? 'active' : ''}`}
            onClick={() => setActiveDashboard(d)}
          >{d.title}</button>
        ))}
      </div>

      <div ref={dashRef}>
        {widgets.length === 0 ? (
          <div className="glass">
            <div className="empty-state">
              <h3>Nenhum widget ainda</h3>
              <p>Crie seu primeiro widget para começar a visualizar dados.</p>
              {!readOnly && <button className="btn accent mt-2" onClick={() => setShowNew(true)}>+ Criar widget</button>}
            </div>
          </div>
        ) : (
          <div className="widgets-grid">
            {widgets.map(w => (
              <WidgetCard
                key={w.id}
                widget={w}
                dataLeads={leads}
                dataLanding={landing}
                dateRange={range}
                onEdit={readOnly ? null : () => setEditing(w)}
                onDelete={readOnly ? null : () => deleteWidget(w.id)}
              />
            ))}
          </div>
        )}
      </div>

      {(editing || showNew) && (
        <WidgetEditor
          initial={editing}
          onSave={saveWidget}
          onClose={() => { setEditing(null); setShowNew(false); }}
          landingPages={landing}
          campaignNames={campaignNames}
        />
      )}
      {pendingDelete && (
        <DeleteConfirm
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => pendingDelete.type === 'dashboard' ? deleteDashboardNow(pendingDelete.id) : deleteWidgetNow(pendingDelete.id)}
        />
      )}
      {dashModal && (
        <div className="modal-backdrop">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {dashModal.mode === 'create' ? 'Novo dashboard' : dashModal.mode === 'rename' ? 'Renomear dashboard' : 'Duplicar dashboard'}
              </h2>
              <button className="modal-close" onClick={() => setDashModal(null)}>×</button>
            </div>
            <div className="field">
              <label className="label">Nome</label>
              <input
                className="input"
                value={dashModalName}
                onChange={e => setDashModalName(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') confirmDashModal(); if (e.key === 'Escape') setDashModal(null); }}
              />
            </div>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setDashModal(null)}>Cancelar</button>
              <button className="btn accent" onClick={confirmDashModal}>Salvar</button>
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
              <FilterPresets onApply={setRange} />
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

