import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  ComposedChart
} from 'recharts';
import { fmtBRShort } from '../utils/dates.js';

function computeFiltered(source, landing_id, campaign_filter, dataLeads, dataLanding) {
  if (source === 'daily') {
    const byDate = {};
    for (const record of dataLeads) {
      const date = record.period_start;
      if (!byDate[date]) byDate[date] = { date, leads: 0, visits: 0, total_spent: 0 };
      for (const c of record.campaigns || []) {
        byDate[date].leads += Number(c.leads) || 0;
        byDate[date].visits += Number(c.visits) || 0;
        byDate[date].total_spent += Number(c.total_spent) || ((Number(c.leads) || 0) * (Number(c.cpl) || 0));
      }
    }
    return Object.values(byDate).map(r => ({
      ...r,
      cpl: r.leads > 0 ? r.total_spent / r.leads : 0,
      conversion_rate: r.visits > 0 ? (r.leads / r.visits) * 100 : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
  if (source === 'leads') {
    const arr = [];
    for (const r of dataLeads) {
      for (const c of r.campaigns || []) {
        if (campaign_filter && c.name !== campaign_filter) continue;
        arr.push({
          name: c.name, leads: Number(c.leads) || 0, visits: Number(c.visits) || 0,
          conversion_rate: Number(c.conversion_rate) || 0, cpl: Number(c.cpl) || 0,
          total_spent: Number(c.total_spent) || ((Number(c.leads) || 0) * (Number(c.cpl) || 0)),
          period: r.period_start
        });
      }
    }
    return arr;
  }
  if (source === 'landing') {
    const rows = landing_id ? dataLanding.filter(p => Number(p.id) === Number(landing_id)) : dataLanding;
    return rows.map(p => {
      const entries = Array.isArray(p.entries) ? p.entries : [];
      const totalVisits = entries.reduce((s, e) => s + (Number(e.visits) || 0), 0);
      const totalLeads = entries.reduce((s, e) => s + (Number(e.leads) || 0), 0);
      return { ...p, totalVisits, totalLeads, conversion: totalVisits > 0 ? (totalLeads / totalVisits) * 100 : 0 };
    });
  }
  return [];
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getPrevRange(from, to, mode) {
  if (mode === 'prev_month') {
    const f = new Date(from + 'T12:00:00'); f.setMonth(f.getMonth() - 1);
    const t = new Date(to + 'T12:00:00'); t.setMonth(t.getMonth() - 1);
    return [f.toISOString().slice(0, 10), t.toISOString().slice(0, 10)];
  }
  if (mode === 'prev_year') {
    const yr = s => s.replace(/^\d{4}/, y => String(Number(y) - 1));
    return [yr(from), yr(to)];
  }
  const days = Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000) + 1;
  const pTo = shiftDate(from, -1);
  return [shiftDate(pTo, -(days - 1)), pTo];
}

const COMPARE_LABELS = { prev_period: 'período anterior', prev_month: 'mês anterior', prev_year: 'ano anterior' };
const OP_LABELS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

const COLORS = ['#6d71f0', '#8a8ef5', '#c4c6ff', '#a5a1b3', '#30d173', '#ffb84d', '#ff8078'];
const AXIS_COLOR = '#acadb1';
const CHART_TEXT = { fill: AXIS_COLOR };
const PIE_LABEL = { fill: AXIS_COLOR, fontSize: 12, fontWeight: 600 };

function kpiColor(value, widget) {
  if (!widget.dynamic_color || widget.goal_value === '' || widget.goal_value == null) return widget.color;
  const goal = Number(widget.goal_value);
  if (value < goal) return widget.color_below || '#ff8078';
  if (value > goal) return widget.color_above || '#30d173';
  return widget.color_on || '#ffb84d';
}

function aggregateValue(rows, field, agg) {
  if (!rows.length) return 0;
  const nums = rows.map(r => Number(r[field]) || 0);
  if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  if (agg === 'max') return Math.max(...nums);
  if (agg === 'min') return Math.min(...nums);
  if (agg === 'count') return nums.length;
  return 0;
}

function fmt(n, field) {
  if (n === undefined || n === null || isNaN(n)) return '-';
  if (field === 'conversion_rate' || field === 'conversion') return n.toFixed(2) + '%';
  if (['cpl', 'total_spent'].includes(field)) return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const FIELD_LABELS = {
  leads: 'Leads', cpl: 'CPL', total_spent: 'Gasto', visits: 'Alcance',
  conversion_rate: 'Conversão', totalVisits: 'Alcance', totalLeads: 'Leads', conversion: 'Conversão'
};

function EyeIcon({ hidden }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.5 5.4A10.8 10.8 0 0 1 12 5c5 0 8.5 4.4 9.5 7a13 13 0 0 1-2.3 3.6" />
      <path d="M6.4 6.9A13 13 0 0 0 2.5 12c1 2.6 4.5 7 9.5 7 1.4 0 2.7-.3 3.8-.9" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12c1-2.6 4.5-7 9.5-7s8.5 4.4 9.5 7c-1 2.6-4.5 7-9.5 7s-8.5-4.4-9.5-7Z" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  );
}

const TOOLTIP_STYLE = { background: 'rgba(20,20,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8e7ec' };
const TOOLTIP_ITEM  = { color: '#e8e7ec' };
const TOOLTIP_LABEL = { color: '#acadb1', fontWeight: 600 };
const TT = { contentStyle: TOOLTIP_STYLE, itemStyle: TOOLTIP_ITEM, labelStyle: TOOLTIP_LABEL };

export default function WidgetCard({ widget, dataLeads, dataLanding, dateRange, onEdit, onDelete }) {
  const [dataHidden, setDataHidden] = useState(false);
  const [prevLeads, setPrevLeads] = useState([]);
  const [prevLanding, setPrevLanding] = useState([]);
  const [manualLeads1, setManualLeads1] = useState([]);
  const [manualLanding1, setManualLanding1] = useState([]);

  const filtered = useMemo(() => {
    if (widget.chart_type === 'compare' && widget.manual_from1 && manualLeads1.length >= 0) {
      return computeFiltered(widget.source, widget.landing_id, widget.campaign_filter, manualLeads1, manualLanding1);
    }
    return computeFiltered(widget.source, widget.landing_id, widget.campaign_filter, dataLeads, dataLanding);
  }, [widget.chart_type, widget.source, widget.landing_id, widget.campaign_filter, dataLeads, dataLanding, manualLeads1, manualLanding1]);

  const filtered2 = useMemo(() => {
    if (widget.chart_type !== 'formula') return [];
    return computeFiltered(widget.source2 || 'daily', widget.landing_id, '', dataLeads, dataLanding);
  }, [widget.chart_type, widget.source2, dataLeads, dataLanding]);

  useEffect(() => {
    if (widget.chart_type !== 'compare') return;
    // Período 1
    if (widget.manual_from1 && widget.manual_to1) {
      const p1 = new URLSearchParams({ from: widget.manual_from1, to: widget.manual_to1 });
      Promise.all([
        api.get(`/leads?${p1}`),
        widget.source === 'landing' ? api.get('/landing') : Promise.resolve([])
      ]).then(([leads, land]) => {
        setManualLeads1(leads);
        if (land.length) setManualLanding1(land);
      }).catch(() => {});
    }
    // Período 2
    if (widget.manual_from2 && widget.manual_to2) {
      const p2 = new URLSearchParams({ from: widget.manual_from2, to: widget.manual_to2 });
      Promise.all([
        api.get(`/leads?${p2}`),
        widget.source === 'landing' ? api.get('/landing') : Promise.resolve([])
      ]).then(([leads, land]) => {
        setPrevLeads(leads);
        if (land.length) setPrevLanding(land);
      }).catch(() => {});
    }
  }, [widget.chart_type, widget.source, widget.manual_from1, widget.manual_to1, widget.manual_from2, widget.manual_to2]);

  const filteredPrev = useMemo(() =>
    computeFiltered(widget.source, widget.landing_id, widget.campaign_filter, prevLeads, prevLanding),
    [widget.source, widget.landing_id, widget.campaign_filter, prevLeads, prevLanding]
  );

  const actions = (
    <div className="widget-actions">
      <button type="button" onClick={() => setDataHidden(v => !v)} title={dataHidden ? 'Mostrar dados' : 'Ocultar dados'}>
        <EyeIcon hidden={dataHidden} />
      </button>
      {onEdit && <button onClick={onEdit}>✎</button>}
      {onDelete && <button onClick={onDelete}>×</button>}
    </div>
  );

  // Formula widget: combina duas métricas com uma operação
  if (widget.chart_type === 'formula') {
    const val1 = aggregateValue(filtered, widget.field, widget.aggregation || 'sum');
    const val2 = aggregateValue(filtered2, widget.field2 || widget.field, widget.aggregation2 || 'sum');
    const op = widget.operation || '/';
    const result = op === '+' ? val1 + val2 : op === '-' ? val1 - val2 : op === '*' ? val1 * val2 : val2 !== 0 ? val1 / val2 : 0;
    const color = kpiColor(result, widget);
    const goal = widget.dynamic_color && widget.goal_value !== '' && widget.goal_value != null ? Number(widget.goal_value) : null;
    return (
      <div className={`widget size-${widget.size || 3}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div className="widget-kpi">
          <div className={`value ${dataHidden ? 'masked-value' : ''}`} style={{ color }}>
            {dataHidden ? '••••' : fmt(result, '')}
          </div>
          <div className="label">{fmt(val1, widget.field)} {OP_LABELS[op]} {fmt(val2, widget.field2)} = resultado</div>
          {goal != null && !dataHidden && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 6 }}>
              <span>Meta: {fmt(goal, '')}</span>
              <span style={{ color, fontWeight: 600 }}>{result < goal ? '▼ abaixo' : result > goal ? '▲ acima' : '● na meta'}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compare widget: mesmo campo, dois períodos
  if (widget.chart_type === 'compare') {
    const current = aggregateValue(filtered, widget.field, widget.aggregation || 'sum');
    const previous = aggregateValue(filteredPrev, widget.field, widget.aggregation || 'sum');
    const pct = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : null;
    const color = kpiColor(current, widget);
    const trendColor = pct == null ? '#acadb1' : pct > 0 ? '#30d173' : pct < 0 ? '#ff8078' : '#acadb1';
    const goal = widget.dynamic_color && widget.goal_value !== '' && widget.goal_value != null ? Number(widget.goal_value) : null;
    return (
      <div className={`widget size-${widget.size || 3}`}>
        <div className="widget-head">
          <div className="widget-title">
            {widget.title}
            {widget.campaign_filter && <span className="text-tertiary" style={{ fontSize: 11, marginLeft: 6 }}>· {widget.campaign_filter}</span>}
          </div>
          {actions}
        </div>
        <div className="widget-kpi">
          <div className={`value ${dataHidden ? 'masked-value' : ''}`} style={{ color }}>
            {dataHidden ? '••••' : fmt(current, widget.field)}
          </div>
          {!dataHidden && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="label">
                vs {widget.manual_from2 ? `${widget.manual_from2} → ${widget.manual_to2}` : '—'}
                : {fmt(previous, widget.field)}
              </span>
              {pct != null && (
                <span style={{ color: trendColor, fontWeight: 700, fontSize: 13 }}>
                  {pct > 0 ? '▲' : pct < 0 ? '▼' : '●'} {Math.abs(pct).toFixed(1)}%
                </span>
              )}
            </div>
          )}
          {goal != null && !dataHidden && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex', gap: 6 }}>
              <span>Meta: {fmt(goal, widget.field)}</span>
              <span style={{ color, fontWeight: 600 }}>{current < goal ? '▼ abaixo' : current > goal ? '▲ acima' : '● na meta'}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Progress bar ────────────────────────────────────────────────────────────
  if (widget.chart_type === 'progress') {
    const value = aggregateValue(filtered, widget.field, widget.aggregation || 'sum');
    const goal = Number(widget.goal_value) || 100;
    const pct = Math.min((value / goal) * 100, 100);
    const color = kpiColor(value, widget);
    return (
      <div className={`widget size-${widget.size || 4}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div className="widget-kpi">
          <div className={`value ${dataHidden ? 'masked-value' : ''}`} style={{ color }}>{dataHidden ? '••••' : fmt(value, widget.field)}</div>
          <div style={{ margin: '8px 0 4px', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Meta: {fmt(goal, widget.field)} · {pct.toFixed(1)}%</div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, height: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 8, transition: 'width 0.5s ease', minWidth: pct > 0 ? 4 : 0 }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Funil de conversão ───────────────────────────────────────────────────────
  if (widget.chart_type === 'funnel') {
    const visits = aggregateValue(filtered, widget.source === 'landing' ? 'totalVisits' : 'visits', 'sum');
    const leads  = aggregateValue(filtered, widget.source === 'landing' ? 'totalLeads'  : 'leads',  'sum');
    const conv   = visits > 0 ? (leads / visits * 100) : 0;
    const leadsW = visits > 0 ? Math.max((leads / visits) * 100, 20) : 50;
    const fColor = kpiColor(leads, widget);
    return (
      <div className={`widget size-${widget.size || 4}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: '100%', background: `${fColor}22`, borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#acadb1' }}>Alcance</span>
            <span style={{ fontWeight: 700 }}>{dataHidden ? '••••' : visits.toLocaleString('pt-BR')}</span>
          </div>
          <div style={{ color: '#acadb1', fontSize: 12 }}>▼ {dataHidden ? '•••' : conv.toFixed(1)}% conversão</div>
          <div style={{ width: `${leadsW}%`, background: `${fColor}33`, borderRadius: 8, padding: '10px 16px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#acadb1' }}>Leads</span>
            <span style={{ fontWeight: 700, color: fColor }}>{dataHidden ? '••••' : leads.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Ranking ──────────────────────────────────────────────────────────────────
  if (widget.chart_type === 'ranking') {
    const limit = widget.rank_limit || 5;
    let items = [];
    if (widget.source === 'leads') {
      const byName = {};
      filtered.forEach(c => { byName[c.name] = (byName[c.name] || 0) + (Number(c[widget.field]) || 0); });
      items = Object.entries(byName).map(([name, value]) => ({ name, value }));
    } else if (widget.source === 'landing') {
      items = filtered.map(p => ({ name: p.title, value: Number(p[widget.field]) || 0 }));
    } else {
      items = filtered.map(r => ({ name: fmtBRShort(r.date), value: Number(r[widget.field]) || 0 }));
    }
    items = items.sort((a, b) => b.value - a.value).slice(0, limit);
    const maxVal = Math.max(...items.map(i => i.value), 1);
    const total  = items.reduce((s, i) => s + i.value, 0);
    return (
      <div className={`widget size-${widget.size || 6}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div style={{ padding: '4px 14px 12px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 16 }}>#{i + 1}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                </span>
                <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                  {dataHidden ? '••••' : fmt(item.value, widget.field)}
                  {!dataHidden && total > 0 && <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginLeft: 4 }}>{(item.value / total * 100).toFixed(0)}%</span>}
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 4 }}>
                <div style={{ height: '100%', width: `${item.value / maxVal * 100}%`, background: kpiColor(item.value, widget), borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Gauge / Velocímetro ──────────────────────────────────────────────────────
  if (widget.chart_type === 'gauge') {
    const value = aggregateValue(filtered, widget.field, widget.aggregation || 'sum');
    const goal  = Number(widget.goal_value) || 100;
    const pct   = Math.min(Math.max(value / goal, 0), 1);
    const color = kpiColor(value, widget);
    const cx = 100, cy = 86, r = 68;
    const polar = (deg) => ({ x: cx + r * Math.cos(deg * Math.PI / 180), y: cy - r * Math.sin(deg * Math.PI / 180) });
    const p0 = polar(180), p1 = polar(0);
    const bg = `M ${p0.x} ${p0.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y}`;
    const valDeg = 180 - pct * 180;
    const pv = polar(valDeg);
    const arc = pct > 0 ? `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${pv.x} ${pv.y}` : '';
    return (
      <div className={`widget size-${widget.size || 3}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
          <svg width={200} height={100} style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
            <path d={bg} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={14} strokeLinecap="round" />
            {arc && <path d={arc} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />}
            <text x={cx} y={cy + 18} textAnchor="middle" fill="#e8e7ec" fontSize={18} fontWeight="700">{dataHidden ? '•••' : fmt(value, widget.field)}</text>
            <text x={cx} y={cy + 34} textAnchor="middle" fill="#acadb1" fontSize={11}>{(pct * 100).toFixed(1)}% da meta</text>
          </svg>
        </div>
      </div>
    );
  }

  // ── Sparkline ────────────────────────────────────────────────────────────────
  if (widget.chart_type === 'sparkline') {
    const lastVal  = filtered.length ? Number(filtered[filtered.length - 1][widget.field]) || 0 : 0;
    const firstVal = filtered.length ? Number(filtered[0][widget.field]) || 0 : 0;
    const trend    = lastVal - firstVal;
    const lineColor = kpiColor(aggregateValue(filtered, widget.field, 'avg'), widget);
    const sparkData = filtered.map(r => ({ v: Number(r[widget.field]) || 0 }));
    return (
      <div className={`widget size-${widget.size || 3}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div style={{ padding: '2px 12px 10px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: lineColor, marginBottom: 2 }}>{dataHidden ? '••••' : fmt(lastVal, widget.field)}</div>
          <div style={{ fontSize: 11, color: trend >= 0 ? '#30d173' : '#ff8078', marginBottom: 6 }}>
            {trend >= 0 ? '▲' : '▼'} {dataHidden ? '•••' : fmt(Math.abs(trend), widget.field)} vs início
          </div>
          <ResponsiveContainer width="100%" height={44}>
            <LineChart data={sparkData}>
              <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // ── Scoreboard (múltiplos KPIs) ──────────────────────────────────────────────
  if (widget.chart_type === 'scoreboard') {
    const metrics = widget.source === 'landing'
      ? [{ f: 'totalVisits', l: 'Alcance' }, { f: 'totalLeads', l: 'Leads' }, { f: 'conversion', l: 'Conversão' }]
      : [{ f: 'leads', l: 'Leads' }, { f: 'visits', l: 'Alcance' }, { f: 'total_spent', l: 'Gasto' }, { f: 'cpl', l: 'CPL médio', agg: 'avg' }, { f: 'conversion_rate', l: 'Conv. %', agg: 'avg' }];
    return (
      <div className={`widget size-${widget.size || 6}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6, padding: '6px 12px 14px' }}>
          {metrics.map(m => (
            <div key={m.f} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#acadb1', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{m.l}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{dataHidden ? '••••' : fmt(aggregateValue(filtered, m.f, m.agg || 'sum'), m.f)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Tabela detalhada ─────────────────────────────────────────────────────────
  if (widget.chart_type === 'table') {
    const limit = widget.table_limit || 10;
    let cols = [], rows = [];
    if (widget.source === 'daily') {
      cols = ['Data', 'Leads', 'Alcance', 'Conv%', 'CPL', 'Gasto'];
      rows = [...filtered].reverse().slice(0, limit).map(r => [fmtBRShort(r.date), r.leads, r.visits, r.conversion_rate.toFixed(1) + '%', fmt(r.cpl, 'cpl'), fmt(r.total_spent, 'total_spent')]);
    } else if (widget.source === 'leads') {
      cols = ['Campanha', 'Leads', 'Alcance', 'CPL', 'Gasto'];
      const byName = {};
      filtered.forEach(c => {
        if (!byName[c.name]) byName[c.name] = { ...c };
        else { byName[c.name].leads += c.leads; byName[c.name].visits += c.visits; byName[c.name].total_spent += c.total_spent; }
      });
      rows = Object.values(byName).sort((a, b) => b.leads - a.leads).slice(0, limit).map(r => [r.name, r.leads, r.visits, fmt(r.cpl, 'cpl'), fmt(r.total_spent, 'total_spent')]);
    } else {
      cols = ['Página', 'Alcance', 'Leads', 'Conv%'];
      rows = [...filtered].sort((a, b) => b.totalLeads - a.totalLeads).slice(0, limit).map(p => [p.title, p.totalVisits, p.totalLeads, p.conversion.toFixed(1) + '%']);
    }
    return (
      <div className={`widget size-${widget.size || 6}`}>
        <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
        <div style={{ overflowX: 'auto', padding: '0 4px 8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{cols.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', color: '#acadb1', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {row.map((cell, j) => <td key={j} style={{ padding: '6px 10px', color: j === 0 ? '#e8e7ec' : '#acadb1', whiteSpace: j === 0 ? 'nowrap' : undefined }}>{dataHidden && j > 0 ? '••••' : cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Heatmap de calendário ────────────────────────────────────────────────────
  if (widget.chart_type === 'heatmap') {
    const valueMap = {};
    filtered.forEach(r => { valueMap[r.date] = Number(r[widget.field]) || 0; });
    const maxVal = Math.max(...Object.values(valueMap), 1);
    const from = dateRange?.from, to = dateRange?.to;
    if (from && to) {
      const dates = [];
      let cur = from;
      while (cur <= to) { dates.push(cur); cur = shiftDate(cur, 1); }
      const firstDay = new Date(from + 'T12:00:00').getDay();
      const padded = [...Array(firstDay).fill(null), ...dates];
      const weeks = [];
      for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
      const DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
      return (
        <div className={`widget size-${widget.size || 12}`}>
          <div className="widget-head"><div className="widget-title">{widget.title}</div>{actions}</div>
          <div style={{ padding: '4px 12px 12px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 18 }}>
                {DAY_LABELS.map((d, i) => <div key={i} style={{ height: 14, fontSize: 9, color: '#acadb1', lineHeight: '14px' }}>{d}</div>)}
              </div>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {wi === 0 && <div style={{ height: 16, fontSize: 9, color: '#acadb1' }}>{fmtBRShort(dates[0])}</div>}
                  {wi > 0 && <div style={{ height: 16 }} />}
                  {week.map((day, di) => {
                    const val = day ? (valueMap[day] || 0) : 0;
                    const alpha = day ? (val > 0 ? 0.15 + (val / maxVal) * 0.85 : 0.08) : 0;
                    return <div key={di} title={day ? `${day}: ${val}` : ''} style={{ width: 14, height: 14, borderRadius: 3, background: day ? `rgba(109,113,240,${alpha.toFixed(2)})` : 'transparent' }} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  // KPI mode
  if (widget.chart_type === 'kpi') {
    const value = aggregateValue(filtered, widget.field, widget.aggregation);
    const color = kpiColor(value, widget);
    const goal = widget.dynamic_color && widget.goal_value !== '' && widget.goal_value != null ? Number(widget.goal_value) : null;
    return (
      <div className={`widget size-${widget.size || 3}`}>
        <div className="widget-head">
          <div className="widget-title">
            {widget.title}
            {widget.campaign_filter && <span className="text-tertiary" style={{ fontSize: 11, marginLeft: 6 }}>· {widget.campaign_filter}</span>}
          </div>
          {actions}
        </div>
        <div className="widget-kpi">
          <div className={`value ${dataHidden ? 'masked-value' : ''}`} style={{ color }}>
            {dataHidden ? '••••' : fmt(value, widget.field)}
          </div>
          <div className="label">
            {widget.aggregation === 'avg' ? 'Média' : widget.aggregation === 'sum' ? 'Total' : widget.aggregation} de {FIELD_LABELS[widget.field] || widget.field}
          </div>
          {goal != null && !dataHidden && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Meta: {fmt(goal, widget.field)}</span>
              <span style={{ color, fontWeight: 600 }}>
                {value < goal ? '▼ abaixo' : value > goal ? '▲ acima' : '● na meta'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Build chart data
  let chartData = [];
  if (widget.source === 'daily') {
    chartData = filtered.map(r => ({
      name: fmtBRShort(r.date),
      value: Number(r[widget.field]) || 0,
      value2: Number(r[widget.field2]) || 0
    }));
  } else if (widget.source === 'leads') {
    if (widget.chart_type === 'pie' || widget.chart_type === 'donut' || widget.chart_type === 'bar') {
      const byName = {};
      for (const c of filtered) {
        if (!byName[c.name]) byName[c.name] = 0;
        byName[c.name] += Number(c[widget.field]) || 0;
      }
      chartData = Object.entries(byName).map(([name, value]) => ({ name, value }));
    } else {
      const byDate = {};
      for (const c of filtered) {
        const d = c.period;
        if (!byDate[d]) byDate[d] = { value: 0, value2: 0 };
        byDate[d].value  += Number(c[widget.field])  || 0;
        byDate[d].value2 += Number(c[widget.field2]) || 0;
      }
      chartData = Object.keys(byDate).sort().map(d => ({ name: fmtBRShort(d), ...byDate[d] }));
    }
  } else if (widget.source === 'landing') {
    chartData = filtered.map(p => ({
      name: p.title,
      value: widget.field === 'conversion' ? p.conversion : (widget.field === 'totalLeads' ? p.totalLeads : p.totalVisits)
    }));
  }

  return (
    <div className={`widget size-${widget.size || 6}`}>
      <div className="widget-head">
        <div className="widget-title">
          {widget.title}
          {widget.campaign_filter && <span className="text-tertiary" style={{ fontSize: 11, marginLeft: 6 }}>· {widget.campaign_filter}</span>}
        </div>
        {actions}
      </div>
      <div className="widget-chart">
        {chartData.length === 0 ? (
          <div className="empty-widget"><div>Sem dados para o período</div></div>
        ) : widget.chart_type === 'pie' ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} label={dataHidden ? false : PIE_LABEL}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              {!dataHidden && <Tooltip {...TT} />}
            </PieChart>
          </ResponsiveContainer>
        ) : widget.chart_type === 'donut' ? (
          <div style={{ position: 'relative', height: 220 }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={90} innerRadius={56}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                {!dataHidden && <Tooltip {...TT} />}
              </PieChart>
            </ResponsiveContainer>
            {!dataHidden && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{aggregateValue(filtered, widget.field, 'sum').toLocaleString('pt-BR')}</div>
                <div style={{ fontSize: 10, color: '#acadb1' }}>total</div>
              </div>
            )}
          </div>
        ) : widget.chart_type === 'combo' ? (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
              <YAxis yAxisId="left" stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              {!dataHidden && <Tooltip {...TT} />}
              <Bar yAxisId="left" dataKey="value" radius={[4, 4, 0, 0]} name={FIELD_LABELS[widget.field] || widget.field}>
                {chartData.map((entry, i) => <Cell key={i} fill={kpiColor(entry.value, widget)} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="value2" stroke={widget.color2 || '#30d173'} strokeWidth={2} dot={false} name={FIELD_LABELS[widget.field2] || widget.field2} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : widget.chart_type === 'bar' ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
              <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              {!dataHidden && <Tooltip {...TT} />}
              {widget.dynamic_color && widget.goal_value != null && widget.goal_value !== '' && (
                <ReferenceLine y={Number(widget.goal_value)} stroke={widget.color_on || '#ffb84d'} strokeDasharray="4 3" />
              )}
              <Bar dataKey="value" radius={[6, 6, 0, 0]} minPointSize={1}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={kpiColor(entry.value, widget)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : widget.chart_type === 'area' ? (() => {
          const avgVal = aggregateValue(filtered, widget.field, 'avg');
          const lineColor = kpiColor(avgVal, widget);
          return (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`g${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
                <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
                {!dataHidden && <Tooltip {...TT} />}
                {widget.dynamic_color && widget.goal_value != null && widget.goal_value !== '' && (
                  <ReferenceLine y={Number(widget.goal_value)} stroke={widget.color_on || '#ffb84d'} strokeDasharray="4 3" />
                )}
                <Area type="monotone" dataKey="value" stroke={lineColor} fill={`url(#g${widget.id})`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          );
        })() : (() => {
          const avgVal = aggregateValue(filtered, widget.field, 'avg');
          const lineColor = kpiColor(avgVal, widget);
          return (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
                <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
                {!dataHidden && <Tooltip {...TT} />}
                {widget.dynamic_color && widget.goal_value != null && widget.goal_value !== '' && (
                  <ReferenceLine y={Number(widget.goal_value)} stroke={widget.color_on || '#ffb84d'} strokeDasharray="4 3" />
                )}
                <Line type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} dot={{ fill: lineColor, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          );
        })()}
      </div>
    </div>
  );
}

