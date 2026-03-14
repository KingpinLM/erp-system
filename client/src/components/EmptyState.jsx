import React from 'react';

const illustrations = {
  invoices: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
      <rect x="25" y="10" width="70" height="80" rx="6" fill="var(--gray-100)" stroke="var(--gray-300)" strokeWidth="1.5"/>
      <rect x="35" y="25" width="40" height="4" rx="2" fill="var(--gray-300)"/>
      <rect x="35" y="35" width="50" height="4" rx="2" fill="var(--gray-200)"/>
      <rect x="35" y="45" width="30" height="4" rx="2" fill="var(--gray-200)"/>
      <rect x="35" y="60" width="50" height="8" rx="3" fill="var(--primary-100)"/>
      <circle cx="85" cy="75" r="18" fill="var(--primary-50)" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 3"/>
      <path d="M79 75h12M85 69v12" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  clients: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
      <circle cx="45" cy="35" r="15" fill="var(--gray-100)" stroke="var(--gray-300)" strokeWidth="1.5"/>
      <circle cx="45" cy="30" r="6" fill="var(--gray-300)"/>
      <path d="M33 45a12 12 0 0 1 24 0" fill="var(--gray-200)"/>
      <circle cx="75" cy="40" r="12" fill="var(--primary-50)" stroke="var(--primary)" strokeWidth="1.5"/>
      <circle cx="75" cy="36" r="5" fill="var(--primary-100)"/>
      <path d="M65 48a10 10 0 0 1 20 0" fill="var(--primary-100)"/>
      <rect x="30" y="65" width="60" height="4" rx="2" fill="var(--gray-200)"/>
      <rect x="40" y="75" width="40" height="4" rx="2" fill="var(--gray-200)"/>
    </svg>
  ),
  data: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
      <rect x="15" y="55" width="16" height="30" rx="4" fill="var(--gray-200)"/>
      <rect x="37" y="40" width="16" height="45" rx="4" fill="var(--gray-200)"/>
      <rect x="59" y="25" width="16" height="60" rx="4" fill="var(--primary-100)"/>
      <rect x="81" y="45" width="16" height="40" rx="4" fill="var(--gray-200)"/>
      <circle cx="90" cy="20" r="14" fill="var(--primary-50)" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 3"/>
      <path d="M86 20h8M90 16v8" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  search: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
      <circle cx="52" cy="42" r="22" fill="var(--gray-100)" stroke="var(--gray-300)" strokeWidth="1.5"/>
      <circle cx="52" cy="42" r="14" fill="white" stroke="var(--gray-200)" strokeWidth="1"/>
      <line x1="69" y1="59" x2="85" y2="75" stroke="var(--gray-300)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M46 42h12M52 36v12" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="0"/>
    </svg>
  ),
  default: (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
      <rect x="20" y="20" width="80" height="60" rx="8" fill="var(--gray-100)" stroke="var(--gray-300)" strokeWidth="1.5"/>
      <rect x="35" y="35" width="50" height="5" rx="2.5" fill="var(--gray-200)"/>
      <rect x="35" y="47" width="35" height="5" rx="2.5" fill="var(--gray-200)"/>
      <circle cx="60" cy="68" r="8" fill="var(--primary-50)" stroke="var(--primary)" strokeWidth="1.5"/>
      <path d="M57 68h6M60 65v6" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
};

export default function EmptyState({ icon, title, description, action, actionLabel, type = 'default' }) {
  const illustration = illustrations[type] || illustrations.default;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{ marginBottom: 16, opacity: 0.85 }}>
        {icon || illustration}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800, #1e293b)', marginBottom: 6 }}>
        {title || 'Žádná data'}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--gray-500, #64748b)', maxWidth: 320, lineHeight: 1.5, marginBottom: action ? 16 : 0 }}>
          {description}
        </div>
      )}
      {action && (
        <button className="btn btn-primary" onClick={action} style={{ marginTop: 4 }}>
          {actionLabel || 'Vytvořit'}
        </button>
      )}
    </div>
  );
}
