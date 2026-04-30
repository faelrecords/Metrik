import React, { useState } from 'react';
import { skipDeleteConfirm } from '../utils/confirmDelete.js';

export default function DeleteConfirm({ message, onCancel, onConfirm }) {
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(30);

  function confirm() {
    if (enabled) skipDeleteConfirm(minutes);
    onConfirm();
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Confirmar exclusão</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <p className="text-secondary mb-2">{message}</p>
        <label className="confirm-skip">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <span>Não perguntar pelos próximos</span>
          <input
            className="input"
            type="number"
            min="1"
            value={minutes}
            disabled={!enabled}
            onChange={e => setMinutes(e.target.value)}
          />
          <span>minutos</span>
        </label>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn danger" onClick={confirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}
