import React from 'react';

export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <button className="btn sm ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
      <span className="text-secondary">{page} / {totalPages}</span>
      <button className="btn sm ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Próxima</button>
    </div>
  );
}
