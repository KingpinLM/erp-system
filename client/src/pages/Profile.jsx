import React, { useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import SignaturePad from '../components/SignaturePad';

export default function Profile() {
  const { user, login } = useAuth();
  const [signature, setSignature] = useState(user?.signature || null);
  const [mode, setMode] = useState(null); // 'draw' | 'upload'
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  const saveSignature = async (dataUrl) => {
    setSaving(true);
    try {
      await api.updateSignature(dataUrl);
      setSignature(dataUrl);
      setMode(null);
      setMsg('Podpis uložen!');
      // Update local user data
      const saved = JSON.parse(localStorage.getItem('erp_user') || '{}');
      saved.signature = dataUrl;
      localStorage.setItem('erp_user', JSON.stringify(saved));
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Chyba při ukládání: ' + e.message);
    }
    setSaving(false);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg('Soubor je příliš velký (max 2 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => saveSignature(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeSignature = async () => {
    setSaving(true);
    await api.updateSignature(null);
    setSignature(null);
    const saved = JSON.parse(localStorage.getItem('erp_user') || '{}');
    saved.signature = null;
    localStorage.setItem('erp_user', JSON.stringify(saved));
    setMsg('Podpis odstraněn');
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div>
      <h1 className="page-title">Můj profil</h1>

      <div className="card" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Jméno</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{user?.full_name}</div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Email</div>
          <div style={{ fontSize: 16 }}>{user?.email}</div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Role</div>
          <div style={{ fontSize: 16 }}>{user?.role}</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600, marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Podpis</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Podpis se zobrazí na fakturách, které vytvoříte.
        </p>

        {msg && <div className="alert" style={{ marginBottom: 16, padding: '10px 16px', background: '#d1fae5', borderRadius: 8, color: '#059669', fontSize: 13 }}>{msg}</div>}

        {signature && !mode && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#fff', textAlign: 'center' }}>
              <img src={signature} alt="Podpis" style={{ maxWidth: '100%', maxHeight: 120 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setMode('draw')}>Překreslit</button>
              <button className="btn btn-outline btn-sm" onClick={() => setMode('upload')}>Nahrát nový</button>
              <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={removeSignature} disabled={saving}>Odstranit</button>
            </div>
          </div>
        )}

        {!signature && !mode && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setMode('draw')}>Nakreslit podpis</button>
            <button className="btn btn-outline btn-sm" onClick={() => setMode('upload')}>Nahrát obrázek</button>
          </div>
        )}

        {mode === 'draw' && (
          <div>
            <SignaturePad onSave={saveSignature} />
            <button className="btn btn-outline btn-sm" onClick={() => setMode(null)} style={{ marginTop: 8 }}>Zrušit</button>
          </div>
        )}

        {mode === 'upload' && (
          <div>
            <input type="file" accept="image/*" ref={fileRef} onChange={handleUpload} style={{ marginBottom: 8 }} />
            <br />
            <button className="btn btn-outline btn-sm" onClick={() => setMode(null)}>Zrušit</button>
          </div>
        )}
      </div>
    </div>
  );
}
