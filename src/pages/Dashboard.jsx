import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { ranges } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
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
  const [daily, setDaily] = useState([]);
  const [leads, setLeads] = useState([]);
  const [landing, setLanding] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
    const [d, l, lp, ws] = await Promise.all([
      api.get(`/daily?${params}`),
      api.get(`/leads?${params}`),
      api.get('/landing'),
      api.get(`/widgets?dashboard_id=${dash.id}`)
    ]);
    setDaily(d);
    setLeads(l);
    setLanding(lp);
    setWidgets(ws);
  }

  useEffect(() => { loadDashboards(); }, []);
  useEffect(() => { if (activeDashboard) loadData(); }, [range.from, range.to, tagFilter, activeDashboard?.id]);

  async function createDashboard() {
    const title = prompt('Nome do dashboard?') || 'Novo dashboard';
    const dash = await api.post('/dashboards', { title });
    const list = await loadDashboards();
    setDashboards(list);
    setActiveDashboard(dash);
  }

  async function renameDashboard() {
    if (!activeDashboard) return;
    const title = prompt('Novo nome?', activeDashboard.title);
    if (!title) return;
    const updated = await api.put(`/dashboards/${activeDashboard.id}`, { title });
    setActiveDashboard(updated);
    loadDashboards();
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
          {!readOnly && <button className="btn danger" onClick={deleteDashboard} disabled={dashboards.length <= 1}>Excluir página</button>}
          <button className="btn" onClick={exportPDF}>↓ PDF</button>
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
        {!readOnly && <button className="range-pill add" onClick={createDashboard}>NewTab</button>}
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
                dataDaily={daily}
                dataLeads={leads}
                dataLanding={landing}
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
        />
      )}
      {pendingDelete && (
        <DeleteConfirm
          message={pendingDelete.message}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => pendingDelete.type === 'dashboard' ? deleteDashboardNow(pendingDelete.id) : deleteWidgetNow(pendingDelete.id)}
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
