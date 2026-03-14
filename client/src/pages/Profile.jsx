import React, { useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../App';
import SignaturePad from '../components/SignaturePad';
import PasswordFields from '../components/PasswordFields';

const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [signature, setSignature] = useState(user?.signature || null);
  const [mode, setMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
  });
  const [pwForm, setPwForm] = useState({ current: '', password: '', password2: '' });
  const [changingPw, setChangingPw] = useState(false);
  const fileRef = useRef();

  const saveSignature = async (dataUrl) => {
    setSaving(true);
    try {
      await api.updateSignature(dataUrl);
      setSignature(dataUrl);
      setMode(null);
      setMsg('Podpis uložen!');
      updateUser({ signature: dataUrl });
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Chyba při ukládání: ' + e.message);
    }
    setSaving(false);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg('Soubor je příliš velký (max 2 MB)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => saveSignature(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeSignature = async () => {
    setSaving(true);
    await api.updateSignature(null);
    setSignature(null);
    updateUser({ signature: null });
    setMsg('Podpis odstraněn');
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { first_name: form.first_name, last_name: form.last_name, email: form.email };
      const updated = await api.updateProfile(data);
      updateUser({ full_name: updated.full_name, first_name: updated.first_name, last_name: updated.last_name, email: updated.email });
      setEditing(false);
      setMsg('Profil aktualizován!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Chyba: ' + e.message);
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.password !== pwForm.password2) {
      setMsg('Chyba: Nová hesla se neshodují');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        current_password: pwForm.current,
        password: pwForm.password
      });
      setPwForm({ current: '', password: '', password2: '' });
      setChangingPw(false);
      setMsg('Heslo změněno!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Chyba: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div>
      {msg && <div style={{ marginBottom: 16, padding: '10px 16px', background: msg.includes('Chyba') ? '#fee2e2' : '#d1fae5', borderRadius: 8, color: msg.includes('Chyba') ? '#dc2626' : '#059669', fontSize: 13 }}>{msg}</div>}

      <div className="card" style={{ maxWidth: 600 }}>
        {!editing ? (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Přihlašovací jméno</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{user?.username}</div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Jméno a příjmení</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{user?.full_name}</div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: 16 }}>{user?.email}</div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Role</div>
              <div style={{ fontSize: 16 }}><span className={`badge badge-${user?.role}`}>{roleLabels[user?.role] || user?.role}</span></div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Upravit profil</button>
          </>
        ) : (
          <form onSubmit={handleProfileSave}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Přihlašovací jméno</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace', color: '#94a3b8' }}>{user?.username}</div>
              <small style={{ color: '#94a3b8', fontSize: 11 }}>Nelze změnit</small>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Jméno *</label>
                <input className="form-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Příjmení</label>
                <input className="form-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="btn-group" style={{ marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Ukládám...' : 'Uložit'}</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Zrušit</button>
            </div>
          </form>
        )}
      </div>

      {/* Password change - separate card */}
      <div className="card" style={{ maxWidth: 600, marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Změna hesla</h2>
        {!changingPw ? (
          <button className="btn btn-outline btn-sm" onClick={() => setChangingPw(true)}>Změnit heslo</button>
        ) : (
          <form onSubmit={handlePasswordChange}>
            <PasswordFields
              currentPassword={pwForm.current}
              onCurrentPasswordChange={v => setPwForm(f => ({ ...f, current: v }))}
              password={pwForm.password}
              onPasswordChange={v => setPwForm(f => ({ ...f, password: v }))}
              password2={pwForm.password2}
              onPassword2Change={v => setPwForm(f => ({ ...f, password2: v }))}
              requireCurrent
            />
            <div className="btn-group" style={{ marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Ukládám...' : 'Změnit heslo'}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setChangingPw(false); setPwForm({ current: '', password: '', password2: '' }); }}>Zrušit</button>
            </div>
          </form>
        )}
      </div>

      <div className="card" style={{ maxWidth: 600, marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Podpis</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Podpis se zobrazí na fakturách, které vytvoříte.
        </p>

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
