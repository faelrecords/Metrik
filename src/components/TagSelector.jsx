import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export function TagChip({ tag, selected, onClick, removable, onRemove }) {
  return (
    <span
      className={`tag-chip ${selected ? 'selected' : ''} ${removable ? 'removable' : ''}`}
      style={selected ? { borderColor: tag.color, background: tag.color + '22', color: tag.color } : { color: tag.color }}
      onClick={onClick}
    >
      <span className="dot" style={{ background: tag.color }} />
      {tag.name}
      {removable && <button className="x" onClick={(e) => { e.stopPropagation(); onRemove?.(); }}>×</button>}
    </span>
  );
}

export default function TagSelector({ value, onChange }) {
  const [tags, setTags] = useState([]);
  useEffect(() => { api.get('/tags').then(setTags); }, []);
  function toggle(id) {
    const set = new Set(value || []);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange([...set]);
  }
  if (tags.length === 0) return <div className="hint">Crie tags em "Tags" para usar aqui.</div>;
  return (
    <div className="row-flex">
      {tags.map(t => (
        <TagChip key={t.id} tag={t} selected={(value || []).includes(t.id)} onClick={() => toggle(t.id)} />
      ))}
    </div>
  );
}

export function TagFilter({ value, onChange }) {
  const [tags, setTags] = useState([]);
  useEffect(() => { api.get('/tags').then(setTags); }, []);
  if (tags.length === 0) return null;
  return (
    <div className="row-flex">
      <button
        className={`tag-chip ${!value ? 'selected' : ''}`}
        onClick={() => onChange(null)}
        style={!value ? { borderColor: 'var(--border-strong)', color: 'var(--text-primary)' } : {}}
      >Todas</button>
      {tags.map(t => (
        <TagChip key={t.id} tag={t} selected={value === t.id} onClick={() => onChange(value === t.id ? null : t.id)} />
      ))}
    </div>
  );
}
