import React from 'react';

const rules = [
  { test: pw => pw.length >= 8, label: 'Alespoň 8 znaků' },
  { test: pw => /[A-Z]/.test(pw), label: 'Velké písmeno (A-Z)' },
  { test: pw => /[a-z]/.test(pw), label: 'Malé písmeno (a-z)' },
  { test: pw => /[0-9]/.test(pw), label: 'Číslice (0-9)' },
  { test: pw => /[^A-Za-z0-9]/.test(pw), label: 'Speciální znak (!@#$%...)' },
];

export function isPasswordValid(pw) {
  return rules.every(r => r.test(pw));
}

export default function PasswordFields({
  currentPassword, onCurrentPasswordChange,
  password, onPasswordChange,
  password2, onPassword2Change,
  requireCurrent = false
}) {
  const passed = rules.filter(r => r.test(password || '')).length;
  const strengthPct = password ? (passed / rules.length) * 100 : 0;
  const strengthColor = strengthPct <= 40 ? '#ef4444' : strengthPct <= 80 ? '#f59e0b' : '#22c55e';

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {requireCurrent && (
        <div className="form-group">
          <label className="form-label">Současné heslo *</label>
          <input className="form-input" type="password" value={currentPassword} onChange={e => onCurrentPasswordChange(e.target.value)} placeholder="••••••" required />
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Nové heslo *</label>
        <input className="form-input" type="password" value={password} onChange={e => onPasswordChange(e.target.value)} placeholder="••••••" required />
        {password && (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= passed ? strengthColor : '#e2e8f0', transition: 'background 0.2s' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gap: 2, fontSize: 11 }}>
              {rules.map((r, i) => (
                <div key={i} style={{ color: r.test(password) ? '#22c55e' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{r.test(password) ? '\u2713' : '\u2717'}</span>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Potvrzení nového hesla *</label>
        <input className="form-input" type="password" value={password2} onChange={e => onPassword2Change(e.target.value)} placeholder="••••••" required />
        {password2 && password !== password2 && (
          <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{'\u2717'} Hesla se neshodují</div>
        )}
        {password2 && password === password2 && password && (
          <div style={{ color: '#22c55e', fontSize: 11, marginTop: 4 }}>{'\u2713'} Hesla se shodují</div>
        )}
      </div>
    </div>
  );
}
