import React, { useState } from 'react';
import { ranges } from '../utils/dates.js';

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

export default function DateRangePicker({ value, onChange }) {
  const [custom, setCustom] = useState(false);
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
      </div>
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
