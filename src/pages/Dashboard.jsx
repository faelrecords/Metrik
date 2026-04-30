import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { ranges } from '../utils/dates.js';
import DateRangePicker from '../components/DateRangePicker.jsx';
import WidgetCard from '../components/WidgetCard.jsx';
import WidgetEditor from '../components/WidgetEditor.jsx';
import { TagFilter } from '../components/TagSelector.jsx';
import DeleteConfirm from '../components/DeleteConfirm.jsx';
import { canSkipDeleteConfirm } from '../utils/confirmDelete.js';

export default function Dashboard() {
  const [range, setRange] = useState({ ...ranges['7d'](), preset: '7d' });
  const [tagFilter, setTagFilter] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [daily, setDaily] = useState([]);
  const [leads, setLeads] = useState([]);
  const [landing, setLanding] = useState([]);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const dashRef = useRef(null);

  async function loadData() {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    if (tagFilter) params.set('tag', tagFilter);
    const [d, l, lp, ws] = await Promise.all([
      api.get(`/daily?${params}`),
      api.get(`/leads?${params}`),
      api.get('/landing'),
      api.get('/widgets')
    ]);
    setDaily(d);
    setLeads(l);
    setLanding(lp);
    setWidgets(ws);
  }

  useEffect(() => { loadData(); }, [range.from, range.to, tagFilter]);

  async function saveWidget(w) {
    if (editing) {
      await api.put(`/widgets/${editing.id}`, w);
    } else {
      await api.post('/widgets', w);
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
    else setPendingDelete({ id, message: 'Remover widget?' });
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
          <h1>Dashboard</h1>
          <div className="subtitle">{range.label} · {range.from} → {range.to}</div>
        </div>
        <div className="row-flex">
          <button className="btn" onClick={exportPDF}>↓ PDF</button>
          <button className="btn accent" onClick={() => setShowNew(true)}>+ Widget</button>
        </div>
      </div>

      <div className="dash-toolbar">
        <DateRangePicker value={range} onChange={setRange} />
      </div>
      <div className="dash-toolbar">
        <TagFilter value={tagFilter} onChange={setTagFilter} />
      </div>

      <div ref={dashRef}>
        {widgets.length === 0 ? (
          <div className="glass">
            <div className="empty-state">
              <h3>Nenhum widget ainda</h3>
              <p>Crie seu primeiro widget para começar a visualizar dados.</p>
              <button className="btn accent mt-2" onClick={() => setShowNew(true)}>+ Criar widget</button>
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
                onEdit={() => setEditing(w)}
                onDelete={() => deleteWidget(w.id)}
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
          onConfirm={() => deleteWidgetNow(pendingDelete.id)}
        />
      )}
    </div>
  );
}
