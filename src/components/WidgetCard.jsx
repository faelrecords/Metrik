import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import { fmtBRShort } from '../utils/dates.js';

const COLORS = ['#6d71f0', '#8a8ef5', '#c4c6ff', '#a5a1b3', '#30d173', '#ffb84d', '#ff8078'];
const AXIS_COLOR = '#acadb1';
const CHART_TEXT = { fill: AXIS_COLOR };
const PIE_LABEL = { fill: AXIS_COLOR, fontSize: 12, fontWeight: 600 };

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
  if (field === 'conversion_rate') return n.toFixed(2) + '%';
  if (['cpl', 'total_spent'].includes(field)) return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const FIELD_LABELS = {
  leads: 'Leads',
  cpl: 'CPL',
  total_spent: 'Gasto',
  visits: 'Visitas',
  conversion_rate: 'Conversão'
};

function EyeIcon({ hidden }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
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

export default function WidgetCard({ widget, dataDaily, dataLeads, dataLanding, onEdit, onDelete }) {
  const [dataHidden, setDataHidden] = useState(false);
  const filtered = useMemo(() => {
    if (widget.source === 'daily') return dataDaily;
    if (widget.source === 'leads') {
      // expand campaigns
      const arr = [];
      for (const r of dataLeads) {
        for (const c of r.campaigns || []) {
          arr.push({ name: c.name, leads: c.leads, cpl: c.cpl, period: r.period_start });
        }
      }
      return arr;
    }
    if (widget.source === 'landing') {
      const landingRows = widget.landing_id
        ? dataLanding.filter(p => Number(p.id) === Number(widget.landing_id))
        : dataLanding;
      return landingRows.map(p => {
        const entries = Array.isArray(p.entries) ? p.entries : [];
        const totalVisits = entries.reduce((s, e) => s + (Number(e.visits) || 0), 0);
        const totalLeads = entries.reduce((s, e) => s + (Number(e.leads) || 0), 0);
        return {
          ...p,
          totalVisits,
          totalLeads,
          conversion: totalVisits > 0 ? (totalLeads / totalVisits) * 100 : 0
        };
      });
    }
    return [];
  }, [widget.source, widget.landing_id, dataDaily, dataLeads, dataLanding]);
  const actions = (
    <div className="widget-actions">
      <button
        type="button"
        onClick={() => setDataHidden(v => !v)}
        title={dataHidden ? 'Mostrar dados' : 'Ocultar dados'}
        aria-label={dataHidden ? 'Mostrar dados' : 'Ocultar dados'}
      >
        <EyeIcon hidden={dataHidden} />
      </button>
      {onEdit && <button onClick={onEdit}>✎</button>}
      {onDelete && <button onClick={onDelete}>×</button>}
    </div>
  );

  // KPI mode
  if (widget.chart_type === 'kpi') {
    const value = aggregateValue(filtered, widget.field, widget.aggregation);
    return (
      <div className={`widget size-${widget.size || 3}`}>
        <div className="widget-head">
          <div className="widget-title">{widget.title}</div>
          {actions}
        </div>
        <div className="widget-kpi">
          <div className={`value ${dataHidden ? 'masked-value' : ''}`} style={{ color: widget.color }}>{dataHidden ? '••••' : fmt(value, widget.field)}</div>
          <div className="label">{widget.aggregation === 'avg' ? 'Média' : widget.aggregation === 'sum' ? 'Total' : widget.aggregation} de {FIELD_LABELS[widget.field] || widget.field}</div>
        </div>
      </div>
    );
  }

  // chart data
  let chartData = [];
  if (widget.source === 'daily') {
    chartData = filtered.map(r => ({ name: fmtBRShort(r.date), value: Number(r[widget.field]) || 0 }));
  } else if (widget.source === 'leads') {
    // group by campaign name, sum leads
    const byName = {};
    for (const c of filtered) {
      if (!byName[c.name]) byName[c.name] = 0;
      byName[c.name] += Number(c[widget.field]) || 0;
    }
    chartData = Object.entries(byName).map(([name, value]) => ({ name, value }));
  } else if (widget.source === 'landing') {
    chartData = filtered.map(p => ({
      name: p.title,
      value: widget.field === 'conversion' ? p.conversion : (widget.field === 'totalLeads' ? p.totalLeads : p.totalVisits)
    }));
  }

  return (
    <div className={`widget size-${widget.size || 6}`}>
      <div className="widget-head">
        <div className="widget-title">{widget.title}</div>
        {actions}
      </div>
      <div className="widget-chart">
        {chartData.length === 0 ? (
          <div className="empty-widget">
            <div>Sem dados para o período</div>
          </div>
        ) : widget.chart_type === 'pie' ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} label={dataHidden ? false : PIE_LABEL}>
                {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              {!dataHidden && <Tooltip contentStyle={{ background: 'rgba(20,20,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8e7ec' }} />}
            </PieChart>
          </ResponsiveContainer>
        ) : widget.chart_type === 'bar' ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
              <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              {!dataHidden && <Tooltip contentStyle={{ background: 'rgba(20,20,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8e7ec' }} />}
              <Bar dataKey="value" fill={widget.color} radius={[6, 6, 0, 0]} minPointSize={1} />
            </BarChart>
          </ResponsiveContainer>
        ) : widget.chart_type === 'area' ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`g${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={widget.color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={widget.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
              <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              {!dataHidden && <Tooltip contentStyle={{ background: 'rgba(20,20,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8e7ec' }} />}
              <Area type="monotone" dataKey="value" stroke={widget.color} fill={`url(#g${widget.id})`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke={AXIS_COLOR} tick={CHART_TEXT} fontSize={11} />
              <YAxis stroke={AXIS_COLOR} tick={dataHidden ? false : CHART_TEXT} fontSize={11} />
              {!dataHidden && <Tooltip contentStyle={{ background: 'rgba(20,20,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8e7ec' }} />}
              <Line type="monotone" dataKey="value" stroke={widget.color} strokeWidth={2} dot={{ fill: widget.color, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
