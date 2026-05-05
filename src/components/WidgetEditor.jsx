import React, { useState } from 'react';

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
    { v: 'visits', label: 'Visitas' },
    { v: 'conversion_rate', label: 'Conversão %' },
    { v: 'total_spent', label: 'Gasto total' },
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
  { v: 'pie', label: 'Pizza' },
  { v: 'donut', label: 'Donut (pizza c/ total)' },
  { v: 'combo', label: 'Linha + Barras (combo)' },
  { v: 'progress', label: 'Barra de progresso' },
  { v: 'gauge', label: 'Gauge / Velocímetro' },
  { v: 'funnel', label: 'Funil de conversão' },
  { v: 'ranking', label: 'Ranking (top N)' },
  { v: 'sparkline', label: 'Sparkline (tendência)' },
  { v: 'scoreboard', label: 'Scoreboard (multi-KPI)' },
  { v: 'table', label: 'Tabela detalhada' },
  { v: 'heatmap', label: 'Heatmap de calendário' },
  { v: 'formula', label: 'Fórmula (2 métricas)' },
  { v: 'compare', label: 'Comparação de período' }
];

const RANK_LIMITS = [3, 5, 10, 20];
const TABLE_LIMITS = [5, 10, 20, 50];

const OPERATIONS = [
  { v: '/', label: 'Divisão (M1 ÷ M2)' },
  { v: '+', label: 'Soma (M1 + M2)' },
  { v: '-', label: 'Diferença (M1 − M2)' },
  { v: '*', label: 'Produto (M1 × M2)' }
];

const COMPARE_MODES = [
  { v: 'prev_period', label: 'Período anterior (mesma duração)' },
  { v: 'prev_month', label: 'Mesmo período, mês anterior' },
  { v: 'prev_year', label: 'Mesmo período, ano anterior' }
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

export default function WidgetEditor({ initial, onSave, onClose, landingPages = [], campaignNames = [] }) {
  const [w, setW] = useState(initial || {
    title: 'Novo widget',
    source: 'daily',
    field: 'leads',
    aggregation: 'sum',
    chart_type: 'line',
    color: '#6d71f0',
    size: 6,
    campaign_filter: ''
  });

  function set(k, v) {
    const next = { ...w, [k]: v };
    if (k === 'source') {
      next.field = FIELDS[v][0].v;
      next.landing_id = '';
      next.campaign_filter = '';
    }
    if (k === 'source2') next.field2 = FIELDS[v][0].v;
    if (k === 'chart_type' && v === 'formula') {
      next.source2 = next.source2 || 'daily';
      next.field2 = next.field2 || 'visits';
      next.aggregation2 = next.aggregation2 || 'sum';
      next.operation = next.operation || '/';
    }
    if (k === 'chart_type' && v === 'compare') {
      next.compare_mode = next.compare_mode || 'prev_period';
    }
    setW(next);
  }

  const activeCampaigns = campaignNames.filter(c => c.active);

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
        {w.source === 'leads' && (
          <div className="field">
            <label className="label">Filtrar por campanha</label>
            <select className="select" value={w.campaign_filter || ''} onChange={e => set('campaign_filter', e.target.value)}>
              <option value="">Todas as campanhas</option>
              {activeCampaigns.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        )}
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
            <label className="label">Tipo</label>
            <select className="select" value={w.chart_type} onChange={e => set('chart_type', e.target.value)}>
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">{w.chart_type === 'formula' ? 'Agregação (Métrica 1)' : 'Agregação (KPI)'}</label>
            <select className="select" value={w.aggregation} onChange={e => set('aggregation', e.target.value)}>
              {AGGS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </div>
        </div>

        {w.chart_type === 'formula' && (
          <>
            <div className="field">
              <label className="label">Operação</label>
              <select className="select" value={w.operation || '/'} onChange={e => set('operation', e.target.value)}>
                {OPERATIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 }}>
              <div className="label" style={{ marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Métrica 2</div>
              <div className="grid-2">
                <div className="field" style={{ margin: 0 }}>
                  <label className="label">Fonte</label>
                  <select className="select" value={w.source2 || 'daily'} onChange={e => set('source2', e.target.value)}>
                    {SOURCES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label className="label">Campo</label>
                  <select className="select" value={w.field2 || 'visits'} onChange={e => set('field2', e.target.value)}>
                    {FIELDS[w.source2 || 'daily'].map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                <label className="label">Agregação</label>
                <select className="select" value={w.aggregation2 || 'sum'} onChange={e => set('aggregation2', e.target.value)}>
                  {AGGS.map(a => <option key={a.v} value={a.v}>{a.label}</option>)}
                </select>
              </div>
            </div>
          </>
        )}

        {w.chart_type === 'compare' && (
          <div className="field">
            <label className="label">Comparar com</label>
            <select className="select" value={w.compare_mode || 'prev_period'} onChange={e => set('compare_mode', e.target.value)}>
              {COMPARE_MODES.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </div>
        )}

        {(w.chart_type === 'progress' || w.chart_type === 'gauge') && (
          <div className="field">
            <label className="label">Meta (valor alvo)</label>
            <input className="input" type="number" step="any" placeholder="Ex: 500"
              value={w.goal_value ?? ''} onChange={e => set('goal_value', e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
        )}

        {w.chart_type === 'combo' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12 }}>
            <div className="label" style={{ marginBottom: 8, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Campo da linha (eixo direito)</div>
            <div className="grid-2">
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Campo</label>
                <select className="select" value={w.field2 || 'cpl'} onChange={e => set('field2', e.target.value)}>
                  {FIELDS[w.source].map(f => <option key={f.v} value={f.v}>{f.label}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">Cor da linha</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <div key={c} className={`color-dot ${(w.color2 || '#30d173') === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set('color2', c)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {w.chart_type === 'ranking' && (
          <div className="field">
            <label className="label">Quantidade de itens</label>
            <select className="select" value={w.rank_limit || 5} onChange={e => set('rank_limit', Number(e.target.value))}>
              {RANK_LIMITS.map(n => <option key={n} value={n}>Top {n}</option>)}
            </select>
          </div>
        )}

        {w.chart_type === 'table' && (
          <div className="field">
            <label className="label">Linhas exibidas</label>
            <select className="select" value={w.table_limit || 10} onChange={e => set('table_limit', Number(e.target.value))}>
              {TABLE_LIMITS.map(n => <option key={n} value={n}>{n} linhas</option>)}
            </select>
          </div>
        )}

        {['funnel', 'scoreboard', 'heatmap'].includes(w.chart_type) && (
          <div className="hint" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {w.chart_type === 'funnel' && 'Campos usados automaticamente: Visitas e Leads da fonte selecionada.'}
            {w.chart_type === 'scoreboard' && 'Exibe todas as métricas principais da fonte selecionada em um único card.'}
            {w.chart_type === 'heatmap' && 'Grade de dias colorida por intensidade do campo selecionado. Funciona melhor com tamanho 12.'}
          </div>
        )}

        <div className="grid-2">
          <div className="field">
            <label className="label">Tamanho (colunas / 12)</label>
            <select className="select" value={w.size} onChange={e => set('size', Number(e.target.value))}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {!w.dynamic_color && (
            <div className="field">
              <label className="label">Cor</label>
              <div className="color-picker">
                {COLORS.map(c => (
                  <div key={c} className={`color-dot ${w.color === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => set('color', c)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {w.chart_type !== 'pie' && (
          <div className="field">
            <label className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Cor dinâmica por meta</span>
              <div
                onClick={() => set('dynamic_color', !w.dynamic_color)}
                style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: w.dynamic_color ? '#6d71f0' : 'rgba(255,255,255,0.12)',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
                }}
              >
                <div style={{
                  position: 'absolute', top: 3, left: w.dynamic_color ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s'
                }} />
              </div>
            </label>
            {w.dynamic_color && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="field" style={{ margin: 0 }}>
                  <label className="label">Meta</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    value={w.goal_value ?? ''}
                    onChange={e => set('goal_value', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 100"
                  />
                </div>
                <div className="grid-3">
                  <div className="field" style={{ margin: 0 }}>
                    <label className="label">Abaixo da meta</label>
                    <input className="input" type="color" style={{ height: 40, padding: '4px 6px', cursor: 'pointer' }}
                      value={w.color_below || '#ff8078'} onChange={e => set('color_below', e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label className="label">Na meta</label>
                    <input className="input" type="color" style={{ height: 40, padding: '4px 6px', cursor: 'pointer' }}
                      value={w.color_on || '#ffb84d'} onChange={e => set('color_on', e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label className="label">Acima da meta</label>
                    <input className="input" type="color" style={{ height: 40, padding: '4px 6px', cursor: 'pointer' }}
                      value={w.color_above || '#30d173'} onChange={e => set('color_above', e.target.value)} />
                  </div>
                </div>
                <div className="hint" style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -4 }}>
                  "Na meta" = valor exatamente igual ao número acima. Abaixo e acima são aplicados para qualquer desvio.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn accent" onClick={() => onSave(w)}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
