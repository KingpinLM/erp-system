import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { usePageTitle } from '../App';
import SignaturePad from '../components/SignaturePad';
import PasswordFields, { isPasswordValid } from '../components/PasswordFields';

const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

export default function UserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(user ? `${user.first_name} ${user.last_name}` : undefined);
  const [sigMode, setSigMode] = useState(null);
  const [sigMsg, setSigMsg] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [pwForm, setPwForm] = useState({ password: '', password2: '' });
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.getUser(id).then(u => {
      setUser(u);
      setForm({ first_name: u.first_name || '', last_name: u.last_name || '', email: u.email || '' });
    }).finally(() => setLoading(false));
  }, [id]);

  const saveSig = async (dataUrl) => {
    await api.updateUserSignature(id, dataUrl);
    setUser(u => ({ ...u, signature: dataUrl }));
    setSigMode(null);
    setSigMsg('Podpis uložen!');
    setTimeout(() => setSigMsg(''), 3000);
  };

  const removeSig = async () => {
    await api.updateUserSignature(id, null);
    setUser(u => ({ ...u, signature: null }));
    setSigMsg('Podpis odstraněn');
    setTimeout(() => setSigMsg(''), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateUser(id, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        role: user.role,
        active: user.active
      });
      const full_name = `${form.first_name} ${form.last_name}`.trim();
      setUser(u => ({ ...u, first_name: form.first_name, last_name: form.last_name, email: form.email, full_name }));
      setEditing(false);
      setMsg('Údaje uloženy!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Chyba: ' + e.message);
    }
    setSaving(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.password !== pwForm.password2) {
      setMsg('Chyba: Hesla se neshodují');
      return;
    }
    if (!isPasswordValid(pwForm.password)) {
      setMsg('Chyba: Heslo nesplňuje bezpečnostní požadavky');
      return;
    }
    setSaving(true);
    try {
      await api.updateUser(id, {
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        active: user.active,
        password: pwForm.password
      });
      setPwForm({ password: '', password2: '' });
      setChangingPw(false);
      setMsg('Heslo změněno!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg('Chyba: ' + e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="loading">Načítání...</div>;
  if (!user) return <div className="empty-state">Uživatel nenalezen</div>;

  const labelStyle = { fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 };

  return (
    <div>
      {msg && <div style={{ marginBottom: 16, padding: '10px 16px', background: msg.includes('Chyba') ? '#fee2e2' : '#d1fae5', borderRadius: 8, color: msg.includes('Chyba') ? '#dc2626' : '#059669', fontSize: 13 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Osobní údaje</div>
          {!editing ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <div style={labelStyle}>Jméno</div>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>{user.first_name || '—'}</div>
              </div>
              <div>
                <div style={labelStyle}>Příjmení</div>
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>{user.last_name || '—'}</div>
              </div>
              <div>
                <div style={labelStyle}>Uživatelské jméno (login)</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'monospace' }}>{user.username}</div>
              </div>
              <div>
                <div style={labelStyle}>Email</div>
                <div style={{ fontSize: '1rem' }}>{user.email}</div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ justifySelf: 'start' }} onClick={() => setEditing(true)}>Upravit údaje</button>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Jméno *</label>
                  <input className="form-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Příjmení</label>
                  <input className="form-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                </div>
                <div>
                  <div style={labelStyle}>Uživatelské jméno (login)</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--gray-400)' }}>{user.username}</div>
                  <small style={{ color: 'var(--gray-400)', fontSize: 11 }}>Nelze změnit</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="btn-group" style={{ marginTop: '0.25rem' }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Ukládám...' : 'Uložit'}</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(false); setForm({ first_name: user.first_name || '', last_name: user.last_name || '', email: user.email || '' }); }}>Zrušit</button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Systémové údaje</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <div style={labelStyle}>Role</div>
              <div><span className={`badge badge-${user.role}`}>{roleLabels[user.role]}</span></div>
            </div>
            <div>
              <div style={labelStyle}>Status</div>
              <div><span className={`badge ${user.active ? 'badge-paid' : 'badge-cancelled'}`}>{user.active ? 'Aktivní' : 'Neaktivní'}</span></div>
            </div>
            <div>
              <div style={labelStyle}>Vytvořen</div>
              <div style={{ fontSize: '1rem' }}>{user.created_at ? (() => { const p = user.created_at.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : user.created_at; })() : '—'}</div>
            </div>
            <div>
              <div style={labelStyle}>Vystavených faktur</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{user.invoice_count}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem', maxWidth: 600 }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Změna hesla</div>
        {!changingPw ? (
          <button className="btn btn-outline btn-sm" onClick={() => setChangingPw(true)}>Nastavit nové heslo</button>
        ) : (
          <form onSubmit={handlePasswordChange}>
            <PasswordFields
              password={pwForm.password}
              onPasswordChange={v => setPwForm(f => ({ ...f, password: v }))}
              password2={pwForm.password2}
              onPassword2Change={v => setPwForm(f => ({ ...f, password2: v }))}
            />
            <div className="btn-group" style={{ marginTop: '0.75rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Ukládám...' : 'Změnit heslo'}</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setChangingPw(false); setPwForm({ password: '', password2: '' }); }}>Zrušit</button>
            </div>
          </form>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem', maxWidth: 600 }}>
        <div className="card-title" style={{ marginBottom: '1rem' }}>Podpis</div>
        {sigMsg && <div style={{ padding: '6px 12px', background: '#d1fae5', borderRadius: 8, color: '#059669', fontSize: 13, marginBottom: 12 }}>{sigMsg}</div>}

        {user.signature && !sigMode && (
          <div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, background: '#fff', textAlign: 'center', marginBottom: 12 }}>
              <img src={user.signature} alt="Podpis" style={{ maxWidth: '100%', maxHeight: 120 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setSigMode('draw')}>Překreslit</button>
              <button className="btn btn-outline btn-sm" onClick={() => setSigMode('upload')}>Nahrát nový</button>
              <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={removeSig}>Odstranit</button>
            </div>
          </div>
        )}

        {!user.signature && !sigMode && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setSigMode('draw')}>Nakreslit podpis</button>
            <button className="btn btn-outline btn-sm" onClick={() => setSigMode('upload')}>Nahrát obrázek</button>
          </div>
        )}

        {sigMode === 'draw' && (
          <div>
            <SignaturePad onSave={saveSig} />
            <button className="btn btn-outline btn-sm" onClick={() => setSigMode(null)} style={{ marginTop: 8 }}>Zrušit</button>
          </div>
        )}

        {sigMode === 'upload' && (
          <div>
            <input type="file" accept="image/*" ref={fileRef} onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) { setSigMsg('Max 2 MB'); return; }
              const reader = new FileReader();
              reader.onload = (ev) => saveSig(ev.target.result);
              reader.readAsDataURL(file);
            }} style={{ marginBottom: 8 }} />
            <br />
            <button className="btn btn-outline btn-sm" onClick={() => setSigMode(null)}>Zrušit</button>
          </div>
        )}
      </div>
    </div>
  );
}
