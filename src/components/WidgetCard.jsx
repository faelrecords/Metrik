import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
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
        byDate[date].total_spent += Number(c.total_spent) || 0;
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
  leads: 'Leads', cpl: 'CPL', total_spent: 'Gasto', visits: 'Visitas',
  conversion_rate: 'Conversão', totalVisits: 'Visitas', totalLeads: 'Leads', conversion: 'Conversão'
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

export default function WidgetCard({ widget, dataLeads, dataLanding, dateRange, onEdit, onDelete }) {
  const [dataHidden, setDataHidden] = useState(false);
  const [prevLeads, setPrevLeads] = useState([]);
  const [prevLanding, setPrevLanding] = useState([]);

  const filtered = useMemo(() =>
    computeFiltered(widget.source, widget.landing_id, widget.campaign_filter, dataLeads, dataLanding),
    [widget.source, widget.landing_id, widget.campaign_filter, dataLeads, dataLanding]
  );

  const filtered2 = useMemo(() => {
    if (widget.chart_type !== 'formula') return [];
    return computeFiltered(widget.source2 || 'daily', widget.landing_id, '', dataLeads, dataLanding);
  }, [widget.chart_type, widget.source2, dataLeads, dataLanding]);

  useEffect(() => {
    if (widget.chart_type !== 'compare' || !dateRange?.from || !dateRange?.to) return;
    const [pFrom, pTo] = getPrevRange(dateRange.from, dateRange.to, widget.compare_mode || 'prev_period');
    const params = new URLSearchParams({ from: pFrom, to: pTo });
    Promise.all([
      api.get(`/leads?${params}`),
      widget.source === 'landing' ? api.get('/landing') : Promise.resolve([])
    ]).then(([leads, land]) => {
      setPrevLeads(leads);
      if (land.length) setPrevLanding(land);
    }).catch(() => {});
  }, [widget.chart_type, widget.compare_mode, widget.source, dateRange?.from, dateRange?.to]);

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
              <span className="label">vs {COMPARE_LABELS[widget.compare_mode || 'prev_period']}: {fmt(previous, widget.field)}</span>
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
    chartData = filtered.map(r => ({ name: fmtBRShort(r.date), value: Number(r[widget.field]) || 0 }));
  } else if (widget.source === 'leads') {
    if (widget.chart_type === 'pie' || widget.chart_type === 'bar') {
      // group by campaign name
      const byName = {};
      for (const c of filtered) {
        if (!byName[c.name]) byName[c.name] = 0;
        byName[c.name] += Number(c[widget.field]) || 0;
      }
      chartData = Object.entries(byName).map(([name, value]) => ({ name, value }));
    } else {
      // time-series: group by date
      const byDate = {};
      for (const c of filtered) {
        const d = c.period;
        if (!byDate[d]) byDate[d] = 0;
        byDate[d] += Number(c[widget.field]) || 0;
      }
      chartData = Object.keys(byDate).sort().map(d => ({ name: fmtBRShort(d), value: byDate[d] }));
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
              {!dataHidden && <Tooltip contentStyle={TOOLTIP_STYLE} />}
            </PieChart>
          </ResponsiveContainer>
        ) : widget.chart_type === 'bar' ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
              <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              {!dataHidden && <Tooltip contentStyle={TOOLTIP_STYLE} />}
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
                {!dataHidden && <Tooltip contentStyle={TOOLTIP_STYLE} />}
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
                {!dataHidden && <Tooltip contentStyle={TOOLTIP_STYLE} />}
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
