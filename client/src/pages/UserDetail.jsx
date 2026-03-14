import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { usePageTitle } from '../App';
import SignaturePad from '../components/SignaturePad';

const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

export default function UserDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  usePageTitle(user ? `${user.first_name} ${user.last_name}` : undefined);
  const [sigMode, setSigMode] = useState(null);
  const [sigMsg, setSigMsg] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.getUser(id).then(setUser).finally(() => setLoading(false));
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

  if (loading) return <div className="loading">Načítání...</div>;
  if (!user) return <div className="empty-state">Uživatel nenalezen</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Osobní údaje</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Jméno</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{user.first_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Příjmení</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{user.last_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Uživatelské jméno (login)</div>
              <div style={{ fontSize: '1rem', fontWeight: 600 }}>{user.username}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Email</div>
              <div style={{ fontSize: '1rem' }}>{user.email}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: '1rem' }}>Systémové údaje</div>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Role</div>
              <div><span className={`badge badge-${user.role}`}>{roleLabels[user.role]}</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Status</div>
              <div><span className={`badge ${user.active ? 'badge-paid' : 'badge-cancelled'}`}>{user.active ? 'Aktivní' : 'Neaktivní'}</span></div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Vytvořen</div>
              <div style={{ fontSize: '1rem' }}>{user.created_at ? (() => { const p = user.created_at.slice(0,10).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : user.created_at; })() : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gray-500)', marginBottom: 4 }}>Vystavených faktur</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{user.invoice_count}</div>
            </div>
          </div>
        </div>
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
