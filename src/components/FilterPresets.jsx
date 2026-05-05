import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function FilterPresets({ onApply }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get('/filter_presets').then(setItems).catch(() => setItems([]));
  }, []);
  const active = items.filter(x => x.active !== false);
  if (!active.length) return null;
  return (
    <div className="row-flex" style={{ flexWrap: 'wrap' }}>
      {active.map(f => (
        <button
          key={f.id}
          className="range-pill"
          onClick={() => onApply({ from: f.from, to: f.to, preset: `custom-${f.id}`, label: f.name })}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
