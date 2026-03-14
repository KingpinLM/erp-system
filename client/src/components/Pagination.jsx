import React from 'react';

const PER_PAGE_OPTIONS = [20, 50, 100];

export default function Pagination({ total, page, perPage = 20, onPageChange, onPerPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (total <= 20 && perPage === 20) return null;

  const from = Math.min((page - 1) * perPage + 1, total);
  const to = Math.min(page * perPage, total);

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);
  if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }

  return (
    <div className="pagination">
      <div className="pagination-info">
        {from}–{to} z {total}
      </div>
      <div className="pagination-pages">
        <button className="pagination-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {pages.map((p, i) =>
          p === '...' ? <span key={`e${i}`} className="pagination-ellipsis">…</span> :
          <button key={p} className={`pagination-btn${p === page ? ' active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        )}
        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</button>
      </div>
      {onPerPageChange && (
        <select className="pagination-select" value={perPage} onChange={e => onPerPageChange(Number(e.target.value))}>
          {PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n} / stránka</option>)}
        </select>
      )}
    </div>
  );
}

export function usePagination(items, defaultPerPage = 20) {
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(defaultPerPage);

  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = items.slice((safePage - 1) * perPage, safePage * perPage);

  const resetPage = () => setPage(1);

  return { page: safePage, perPage, setPage, setPerPage, paged, resetPage, total: items.length };
}
