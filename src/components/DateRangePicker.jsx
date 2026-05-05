import React, { useState } from 'react';
import { fmtBRShort, iso, ranges, weeksOfMonth } from '../utils/dates.js';

const PRESET = [
  { key: 'all', label: 'Todos' },
  { key: '7d', label: '7 dias' },
  { key: '14d', label: '14 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'today', label: 'Hoje' },
  { key: 'this_week', label: 'Semana' },
  { key: 'last_week', label: 'Semana passada' },
  { key: 'this_month', label: 'Mês' },
  { key: 'last_month', label: 'Mês passado' },
  { key: 'quarter', label: 'Trimestre' }
];

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function DateRangePicker({ value, onChange }) {
  const [custom, setCustom] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  function pickMonth(month) {
    const from = iso(new Date(year, month, 1));
    const to = iso(new Date(year, month + 1, 0));
    setCustom(false);
    setMonthOpen(false);
    onChange({ from, to, preset: 'month_select', label: `${MONTHS[month]} ${year}` });
  }

  function pickWeek(week) {
    setCustom(false);
    setMonthOpen(false);
    setWeekOpen(false);
    onChange({ from: week.from, to: week.to, preset: 'week_select', label: `${MONTHS[selectedMonth]} ${year} · ${week.label}` });
  }

  const weeks = weeksOfMonth(year, selectedMonth);

  return (
    <div className="row-flex">
      <div className="range-pills">
        {PRESET.map(p => (
          <button
            key={p.key}
            className={`range-pill ${value.preset === p.key ? 'active' : ''}`}
            onClick={() => { setCustom(false); onChange({ ...ranges[p.key](), preset: p.key }); }}
          >{p.label}</button>
        ))}
        <button
          className={`range-pill ${custom || value.preset === 'custom' ? 'active' : ''}`}
          onClick={() => setCustom(c => !c)}
        >Personalizado</button>
        <button
          className={`range-pill ${monthOpen || value.preset === 'month_select' ? 'active' : ''}`}
          onClick={() => { setCustom(false); setWeekOpen(false); setMonthOpen(v => !v); }}
        >Selecionar mês</button>
        <button
          className={`range-pill ${weekOpen || value.preset === 'week_select' ? 'active' : ''}`}
          onClick={() => { setCustom(false); setMonthOpen(false); setWeekOpen(v => !v); }}
        >Selecionar semana</button>
      </div>
      {monthOpen && (
        <div className="month-picker">
          <button className="btn sm ghost" onClick={() => setYear(y => y - 1)}>‹</button>
          <strong>{year}</strong>
          <button className="btn sm ghost" onClick={() => setYear(y => y + 1)}>›</button>
          <div className="month-grid">
            {MONTHS.map((m, i) => (
              <button key={m} className="range-pill" onClick={() => { setSelectedMonth(i); pickMonth(i); }}>{m}</button>
            ))}
          </div>
        </div>
      )}
      {weekOpen && (
        <div className="month-picker">
          <button className="btn sm ghost" onClick={() => setYear(y => y - 1)}>‹</button>
          <strong>{MONTHS[selectedMonth]} {year}</strong>
          <button className="btn sm ghost" onClick={() => setYear(y => y + 1)}>›</button>
          <div className="month-grid">
            {MONTHS.map((m, i) => (
              <button key={m} className={`range-pill ${selectedMonth === i ? 'active' : ''}`} onClick={() => setSelectedMonth(i)}>{m}</button>
            ))}
          </div>
          <div className="month-grid">
            {weeks.map(w => (
              <button key={w.from} className="range-pill" onClick={() => pickWeek(w)}>{w.label} · {fmtBRShort(w.from)}-{fmtBRShort(w.to)}</button>
            ))}
          </div>
        </div>
      )}
      {(custom || value.preset === 'custom') && (
        <div className="row-flex" style={{ marginLeft: 6 }}>
          <input
            className="input" type="date" style={{ width: 150 }}
            value={value.from || ''}
            onChange={e => onChange({ ...value, from: e.target.value, preset: 'custom', label: 'Personalizado' })}
          />
          <span className="text-tertiary">→</span>
          <input
            className="input" type="date" style={{ width: 150 }}
            value={value.to || ''}
            onChange={e => onChange({ ...value, to: e.target.value, preset: 'custom', label: 'Personalizado' })}
          />
        </div>
      )}
    </div>
  );
}
