import React, { useState, useEffect } from 'react';

const SOURCES = [
  { v: 'daily', label: 'Métricas diárias' },
  { v: 'leads', label: 'Volume de leads' },
  { v: 'landing', label: 'Landing pages' }
];

const FIELDS = {
  daily: [
    { v: 'leads', label: 'Leads' },
    { v: 'cpl', label: 'CPL' },
    { v: 'total_spent', label: 'Gasto total' },
    { v: 'visits', label: 'Visitas' },
    { v: 'conversion_rate', label: 'Conversão %' }
  ],
  leads: [
    { v: 'leads', label: 'Quantidade de leads' },
    { v: 'cpl', label: 'CPL' }
  ],
  landing: [
    { v: 'totalVisits', label: 'Visitas' },
    { v: 'totalLeads', label: 'Leads' },
    { v: 'conversion', label: 'Conversão %' }
  ]
};

const TYPES = [
  { v: 'kpi', label: 'KPI (número)' },
  { v: 'line', label: 'Linha' },
  { v: 'bar', label: 'Barras' },
  { v: 'area', label: 'Área' },
  { v: 'pie', label: 'Pizza' }
];

const AGGS = [
  { v: 'sum', label: 'Soma' },
  { v: 'avg', label: 'Média' },
  { v: 'max', label: 'Máximo' },
  { v: 'min', label: 'Mínimo' },
  { v: 'count', label: 'Contagem' }
];

const SIZES = [1, 2, 3, 4, 6, 8, 12];

const COLORS = ['#6d71f0', '#8a8ef5', '#c4c6ff', '#30d173', '#ffb84d', '#ff8078', '#a5a1b3'];

export default function WidgetEditor({ initial, onSave, onClose, landingPages = [] }) {
  const [w, setW] = useState(initial || {
    title: 'Novo widget',
    source: 'daily',
    field: 'leads',
    aggregation: 'sum',
    chart_type: 'line',
    color: '#6d71f0',
    size: 6
  });

  function set(k, v) {
    const next = { ...w, [k]: v };
    if (k === 'source') {
      next.field = FIELDS[v][0].v;
      next.landing_id = '';
    }
    setW(next);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{initial ? 'Editar widget' : 'Novo widget'}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="field">
          <label className="label">Título</label>
          <input className="input" value={w.title} onChange={e => set('title', e.target.value)} />
        </div>
        {w.source === 'landing' && (
          <div className="field">
            <label className="label">Landing page</label>
            <select className="select" value={w.landing_id || ''} onChange={e => set('landing_id', e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todas as landing pages</option>
              {landingPages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
        )}
        <div className="grid-2">
          <div className="field">
            <label className="label">Fonte de dados</label>
            <select className="select" value={w.source} onChange={e => set('source', e.target.value)}>
              {SOURCES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Campo</label>
            <select className="select" value={w.field} onChange={e => set('field', e.target.value)}>
              {FIELDS[w.source].map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label">Tipo</label>
            <select className="select" value={w.chart_type} onChange={e => set('chart_type', e.target.value)}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Agregação (KPI)</label>
            <select className="select" value={w.aggregation} onChange={e => set('aggregation', e.target.value)}>
              {AGGS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label className="label">Tamanho (colunas / 12)</label>
            <select className="select" value={w.size} onChange={e => set('size', Number(e.target.value))}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">Cor</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <div
                  key={c}
                  className={`color-dot ${w.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => set('color', c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn accent" onClick={() => onSave(w)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
