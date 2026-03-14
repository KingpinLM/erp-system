import React from 'react';

export function Skeleton({ width, height = 16, borderRadius = 6, style }) {
  return (
    <div
      className="skeleton-pulse"
      style={{
        width: width || '100%',
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <div className="card">
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}><Skeleton width={60 + Math.random() * 60} height={14} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, ri) => (
              <tr key={ri}>
                {Array.from({ length: cols }).map((_, ci) => (
                  <td key={ci}><Skeleton width={40 + Math.random() * 80} height={14} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 16, flex: '1 1 200px', minWidth: 180 }}>
          <Skeleton width={80} height={12} style={{ marginBottom: 8 }} />
          <Skeleton width={120} height={28} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={10} />
        </div>
      ))}
    </div>
  );
}
