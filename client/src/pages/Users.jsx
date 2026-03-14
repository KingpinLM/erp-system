import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const roleLabels = { admin: 'Administrátor', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

const allPermissions = [
  { key: 'invoices.create', label: 'Vytvářet faktury', group: 'Faktury' },
  { key: 'invoices.edit', label: 'Upravovat faktury', group: 'Faktury' },
  { key: 'invoices.delete', label: 'Mazat faktury', group: 'Faktury' },
  { key: 'invoices.send', label: 'Odesílat faktury', group: 'Faktury' },
  { key: 'clients.manage', label: 'Spravovat klienty', group: 'Klienti' },
  { key: 'evidence.create', label: 'Vytvářet záznamy', group: 'Evidence' },
  { key: 'evidence.delete', label: 'Mazat záznamy', group: 'Evidence' },
  { key: 'bank.manage', label: 'Spravovat banku', group: 'Banka' },
  { key: 'accounting.manage', label: 'Spravovat účetnictví', group: 'Účetnictví' },
  { key: 'users.manage', label: 'Spravovat uživatele', group: 'Uživatelé' },
  { key: 'company.manage', label: 'Nastavení společnosti', group: 'Společnost' },
  { key: 'reports.view', label: 'Zobrazit reporty', group: 'Reporty' },
];

const roleDefaults = {
  admin: allPermissions.map(p => p.key),
  accountant: ['invoices.create', 'invoices.edit', 'invoices.send', 'clients.manage', 'evidence.create', 'evidence.delete', 'bank.manage', 'accounting.manage', 'reports.view'],
  manager: ['invoices.create', 'invoices.edit', 'invoices.delete', 'invoices.send', 'clients.manage', 'evidence.create', 'reports.view'],
  viewer: ['reports.view'],
};

/* ═══ Single group card — always shows everything, fully editable ═══ */
function GroupCard({ group, users, loadGroups, allPermissions, permissionGroups, groupColors }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(group.name);
  const [desc, setDesc] = useState(group.description || '');
  const [saving, setSaving] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [memberIds, setMemberIds] = useState((group.members || []).map(m => m.user_id));
  const rl = { admin: 'Admin', accountant: 'Účetní', manager: 'Manažer', viewer: 'Náhled' };

  // Sync when parent data changes
  useEffect(() => {
    setName(group.name);
    setDesc(group.description || '');
    setMemberIds((group.members || []).map(m => m.user_id));
  }, [group]);

  const perms = group.permissions || [];

  const save = async (data) => {
    setSaving(true);
    try {
      await api.updateUserGroup(group.id, { name: data.name ?? name, description: data.desc ?? desc, permissions: data.permissions ?? perms, color: data.color ?? group.color });
      await loadGroups();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const togglePerm = (key) => {
    const next = perms.includes(key) ? perms.filter(p => p !== key) : [...perms, key];
    save({ permissions: next });
  };

  const saveName = () => {
    if (name && (name !== group.name || desc !== (group.description || ''))) {
      save({ name, desc });
    }
  };

  const saveMembers = async () => {
    setSaving(true);
    try {
      await api.setGroupMembers(group.id, memberIds);
      setShowMembers(false);
      await loadGroups();
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const del = async () => {
    const ok = await confirm({ title: 'Smazat skupinu', message: `Opravdu chcete smazat skupinu „${group.name}"?`, type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
    await api.deleteUserGroup(group.id);
    toast.success('Skupina smazána');
    loadGroups();
  };

  return (
    <div className="card" style={{ borderLeft: `4px solid ${group.color || 'var(--primary)'}`, padding: '1.25rem' }}>
      {/* Row 1: Name + Description + Color + Delete */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px' }}>
          <label className="form-label">Název skupiny</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)}
            onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()}
            style={{ fontWeight: 600 }} />
        </div>
        <div style={{ flex: '2 1 200px' }}>
          <label className="form-label">Popis</label>
          <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)}
            onBlur={saveName} onKeyDown={e => e.key === 'Enter' && saveName()}
            placeholder="Volitelný popis skupiny" />
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', paddingBottom: '0.1rem' }}>
          {groupColors.map(c => (
            <div key={c} onClick={() => save({ color: c })}
              style={{
                width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer',
                outline: (group.color || '#0d9488') === c ? '2px solid var(--gray-800)' : 'none',
                outlineOffset: 1,
              }} />
          ))}
        </div>
        <button className="btn btn-danger btn-sm" onClick={del} title="Smazat skupinu" style={{ marginLeft: 'auto', flexShrink: 0 }}>
          Smazat
        </button>
      </div>

      {/* Row 2: Permission checkboxes — always visible */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span className="form-label" style={{ margin: 0 }}>
            Oprávnění ({perms.length}/{allPermissions.length})
            {saving && <span style={{ color: 'var(--primary)', fontWeight: 400, fontStyle: 'italic', marginLeft: 6 }}>ukládám...</span>}
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              onClick={() => save({ permissions: allPermissions.map(p => p.key) })}>Vše</button>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              onClick={() => save({ permissions: [] })}>Nic</button>
          </div>
        </div>
        {permissionGroups.map(pg => (
          <div key={pg} style={{ marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{pg}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {allPermissions.filter(p => p.group === pg).map(perm => {
                const on = perms.includes(perm.key);
                return (
                  <label key={perm.key} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.35rem 0.6rem', borderRadius: 6, cursor: 'pointer',
                    background: on ? 'var(--success-light)' : 'white',
                    border: `1px solid ${on ? 'var(--success)' : 'var(--gray-200)'}`,
                    transition: 'all 0.1s',
                  }}>
                    <input type="checkbox" checked={on} onChange={() => togglePerm(perm.key)}
                      style={{ width: 16, height: 16, accentColor: 'var(--success)', cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: on ? 600 : 400, color: on ? 'var(--success-dark)' : 'var(--gray-500)' }}>
                      {perm.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Row 3: Members */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span className="form-label" style={{ margin: 0 }}>Členové ({(group.members || []).length})</span>
          <button className="btn btn-outline btn-sm" onClick={() => setShowMembers(!showMembers)}>
            {showMembers ? 'Zavřít' : 'Upravit členy'}
          </button>
        </div>
        {(group.members || []).length > 0 && !showMembers && (
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {(group.members || []).map(m => (
              <span key={m.user_id} style={{
                fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: 6,
                background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 500,
              }}>{m.full_name || m.username}</span>
            ))}
          </div>
        )}
        {(group.members || []).length === 0 && !showMembers && (
          <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>Žádní členové — klikněte „Upravit členy"</div>
        )}
        {showMembers && (
          <div style={{ border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '0.5rem', marginTop: '0.25rem', maxHeight: 300, overflowY: 'auto' }}>
            {users.map(u => (
              <label key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.5rem',
                borderRadius: 6, cursor: 'pointer',
                background: memberIds.includes(u.id) ? 'var(--primary-50)' : 'transparent',
              }}>
                <input type="checkbox" checked={memberIds.includes(u.id)}
                  onChange={() => setMemberIds(ids => ids.includes(u.id) ? ids.filter(x => x !== u.id) : [...ids, u.id])}
                  style={{ width: 16, height: 16, accentColor: group.color || 'var(--primary)', cursor: 'pointer' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--gray-800)' }}>{u.full_name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{rl[u.role]}</span>
              </label>
            ))}
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem' }}>
              <button className="btn btn-primary btn-sm" onClick={saveMembers}>Uložit členy</button>
              <button className="btn btn-outline btn-sm" onClick={() => { setShowMembers(false); setMemberIds((group.members || []).map(m => m.user_id)); }}>Zrušit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Permission checkboxes grid — reusable ═══ */
function PermissionGrid({ perms, onToggle, allPerms, permGroups, saving }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span className="form-label" style={{ margin: 0 }}>
          Oprávnění ({perms.length}/{allPerms.length})
          {saving && <span style={{ color: 'var(--primary)', fontWeight: 400, fontStyle: 'italic', marginLeft: 6 }}>ukládám...</span>}
        </span>
      </div>
      {permGroups.map(pg => (
        <div key={pg} style={{ marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{pg}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {allPerms.filter(p => p.group === pg).map(perm => {
              const on = perms.includes(perm.key);
              return (
                <label key={perm.key} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.6rem', borderRadius: 6, cursor: 'pointer',
                  background: on ? 'var(--success-light)' : 'white',
                  border: `1px solid ${on ? 'var(--success)' : 'var(--gray-200)'}`,
                  transition: 'all 0.1s',
                }}>
                  <input type="checkbox" checked={on} onChange={() => onToggle(perm.key)}
                    style={{ width: 16, height: 16, accentColor: 'var(--success)', cursor: 'pointer' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: on ? 600 : 400, color: on ? 'var(--success-dark)' : 'var(--gray-500)' }}>
                    {perm.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ System role card — editable permissions for accountant/manager/viewer ═══ */
function SystemRoleCard({ roleKey, label, defaultPerms, currentPerms, userCount, onSave, allPerms, permGroups }) {
  const [perms, setPerms] = useState(currentPerms);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setPerms(currentPerms); setDirty(false); }, [currentPerms]);

  const toggle = (key) => {
    setPerms(prev => {
      const next = prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key];
      setDirty(true);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    await onSave(roleKey, perms);
    setDirty(false);
    setSaving(false);
  };

  const reset = () => { setPerms(defaultPerms); setDirty(true); };

  return (
    <div className="card" style={{ borderLeft: `4px solid var(--primary)`, padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span className={`badge badge-${roleKey}`} style={{ fontSize: '0.8rem' }}>{label}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{userCount} uživatelů</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>Systémová role</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>{perms.length}/{allPerms.length} oprávnění</span>
        {dirty && <span style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>Neuloženo</span>}
      </div>

      {expanded && (
        <>
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', marginBottom: '0.5rem' }}>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              onClick={() => { setPerms(allPerms.map(p => p.key)); setDirty(true); }}>Vše</button>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              onClick={reset}>Výchozí</button>
            <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              onClick={() => { setPerms([]); setDirty(true); }}>Nic</button>
          </div>

          <PermissionGrid perms={perms} onToggle={toggle} allPerms={allPerms} permGroups={permGroups} saving={saving} />

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Ukládám...' : 'Uložit oprávnění'}
            </button>
            {dirty && <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 500 }}>Neuložené změny</span>}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ Custom role card — collapsed by default, expands to show editing ═══ */
function RoleCard({ role, loadRoles, allPermissions, permissionGroups }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description || '');
  const [baseRole, setBaseRole] = useState(role.base_role || 'viewer');
  const [perms, setPerms] = useState(role.permissions || []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setName(role.name);
    setDesc(role.description || '');
    setBaseRole(role.base_role || 'viewer');
    setPerms(role.permissions || []);
    setDirty(false);
  }, [role]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.updateRole(role.id, { name, description: desc, base_role: baseRole, permissions: perms });
      await loadRoles();
      setDirty(false);
    } catch (e) { toast.error(e.message); }
    setSaving(false);
  };

  const togglePerm = (key) => {
    setPerms(prev => {
      const next = prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key];
      setDirty(true);
      return next;
    });
  };

  const del = async () => {
    const ok = await confirm({ title: 'Smazat roli', message: `Opravdu chcete smazat roli „${role.name}"?`, type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
    await api.deleteRole(role.id);
    toast.success('Role smazána');
    loadRoles();
  };

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--primary-light)', padding: '1.25rem' }}>
      {/* Collapsed header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="2" style={{ transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span style={{ fontWeight: 700, color: 'var(--gray-800)', fontSize: '0.95rem' }}>{role.name}</span>
        {role.description && <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{role.description}</span>}
        <span className={`badge badge-${role.base_role}`} style={{ fontSize: '0.65rem' }}>{roleLabels[role.base_role]}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>{(role.permissions || []).length}/{allPermissions.length} oprávnění</span>
        {dirty && <span style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 600 }}>Neuloženo</span>}
      </div>

      {expanded && (
        <>
          {/* Row 1: Name + Description + Base role + Delete */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginTop: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label className="form-label">Název role</label>
              <input className="form-input" value={name} onChange={e => { setName(e.target.value); setDirty(true); }}
                style={{ fontWeight: 600 }} />
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label className="form-label">Popis</label>
              <input className="form-input" value={desc} onChange={e => { setDesc(e.target.value); setDirty(true); }}
                placeholder="Volitelný popis role" />
            </div>
            <div style={{ flex: '0 1 140px' }}>
              <label className="form-label">Základ</label>
              <select className="form-select" value={baseRole} onChange={e => { setBaseRole(e.target.value); setDirty(true); }}>
                <option value="admin">Administrátor</option>
                <option value="accountant">Účetní</option>
                <option value="manager">Manažer</option>
                <option value="viewer">Náhled</option>
              </select>
            </div>
            <button className="btn btn-danger btn-sm" onClick={del} title="Smazat roli" style={{ flexShrink: 0 }}>
              Smazat
            </button>
          </div>

          {/* Permission checkboxes */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={() => { setPerms(allPermissions.map(p => p.key)); setDirty(true); }}>Vše</button>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={() => { setPerms(roleDefaults[baseRole] || []); setDirty(true); }}>Výchozí</button>
              <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                onClick={() => { setPerms([]); setDirty(true); }}>Nic</button>
            </div>
            <PermissionGrid perms={perms} onToggle={togglePerm} allPerms={allPermissions} permGroups={permissionGroups} saving={saving} />
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || saving}>
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            {dirty && <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 500 }}>Neuložené změny</span>}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══ GroupsTab — renders all group cards ═══ */
function GroupsTab({ groups, users, loadGroups, allPermissions, permissionGroups, groupColors }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

  const createGroup = async () => {
    if (!newName.trim()) return;
    setErr('');
    try {
      await api.createUserGroup({ name: newName.trim(), description: '', permissions: [], color: '#0d9488' });
      setNewName('');
      setCreating(false);
      loadGroups();
    } catch (e) { setErr(e.message); }
  };

  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
        Každá skupina má vlastní sadu oprávnění. Upravujte název, oprávnění i členy přímo na kartě.
      </p>

      {groups.length === 0 && !creating && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <div style={{ fontWeight: 600, color: 'var(--gray-600)' }}>Zatím žádné skupiny</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginBottom: '1rem' }}>Vytvořte první skupinu pro sdílení oprávnění.</div>
        </div>
      )}

      {groups.map(g => (
        <GroupCard key={g.id} group={g} users={users} loadGroups={loadGroups}
          allPermissions={allPermissions} permissionGroups={permissionGroups} groupColors={groupColors} />
      ))}

      {creating ? (
        <div className="card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', padding: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Název nové skupiny</label>
            <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createGroup()}
              autoFocus placeholder="např. Fakturanti, Správci banky" />
            {err && <div className="form-error">{err}</div>}
          </div>
          <button className="btn btn-primary" onClick={createGroup}>Vytvořit</button>
          <button className="btn btn-outline" onClick={() => { setCreating(false); setNewName(''); setErr(''); }}>Zrušit</button>
        </div>
      ) : (
        <button className="btn btn-primary" onClick={() => setCreating(true)} style={{ marginTop: '0.75rem' }}>
          + Nová skupina
        </button>
      )}
    </div>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', role: 'viewer', active: 1 });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [roles, setRoles] = useState([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', description: '', base_role: 'viewer', permissions: [] });
  const [roleAssignUser, setRoleAssignUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', permissions: [], color: '#6366f1' });
  const [showGroupMembers, setShowGroupMembers] = useState(null);
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [roleOverrides, setRoleOverrides] = useState({});
  const [pendingStatus, setPendingStatus] = useState({}); // { [userId]: 0|1 }
  const [savingStatus, setSavingStatus] = useState(false);
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    Promise.all([api.getUsers(), api.getPendingUsers().catch(() => [])])
      .then(([u, p]) => { setUsers(u); setPending(p); })
      .finally(() => setLoading(false));
  };

  const loadRoles = () => {
    api.getRoles().then(setRoles).catch(() => {});
  };

  const loadGroups = () => {
    api.getUserGroups().then(setGroups).catch(() => {});
  };

  const loadRoleOverrides = () => {
    api.getRoleOverrides().then(setRoleOverrides).catch(() => {});
  };

  const saveSystemRolePerms = async (roleKey, perms) => {
    const next = { ...roleOverrides, [roleKey]: perms };
    await api.saveRoleOverrides(next);
    setRoleOverrides(next);
  };

  useEffect(() => { load(); loadRoles(); loadGroups(); loadRoleOverrides(); }, []);

  const openNew = () => { setEditing(null); setForm({ username: '', email: '', password: '', first_name: '', last_name: '', role: 'viewer', active: 1 }); setError(''); setShowModal(true); };
  const openEdit = (u) => {
    setEditing(u); setForm({ username: u.username, email: u.email, password: '', first_name: u.first_name || '', last_name: u.last_name || '', role: u.role, active: u.active });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        const data = { email: form.email, first_name: form.first_name, last_name: form.last_name, role: form.role, active: form.active };
        if (form.password) data.password = form.password;
        await api.updateUser(editing.id, data);
      } else {
        await api.createUser(form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRoleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!roleForm.name.trim()) return;
    setError('');
    try {
      if (editingRole) {
        await api.updateRole(editingRole.id, roleForm);
      } else {
        await api.createRole(roleForm);
      }
      setShowRoleModal(false);
      loadRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  const openNewRole = () => {
    setEditingRole(null);
    setRoleForm({ name: '', description: '', base_role: 'viewer', permissions: [] });
    setError('');
    setShowRoleModal(true);
  };

  const openEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({ name: role.name, description: role.description || '', base_role: role.base_role || 'viewer', permissions: role.permissions || [] });
    setError('');
    setShowRoleModal(true);
  };

  const togglePermission = (key) => {
    setRoleForm(f => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key]
    }));
  };

  const hasPendingStatus = Object.keys(pendingStatus).length > 0;

  const saveAllStatus = async () => {
    setSavingStatus(true);
    setError('');
    try {
      for (const [userId, newActive] of Object.entries(pendingStatus)) {
        const u = users.find(x => x.id === Number(userId));
        if (u) {
          await api.updateUser(u.id, { email: u.email, first_name: u.first_name, last_name: u.last_name, role: u.role, active: newActive });
        }
      }
      setPendingStatus({});
      load();
    } catch (e) { setError(e.message); }
    setSavingStatus(false);
  };

  const handleQuickRoleChange = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupForm({ name: '', description: '', permissions: [], color: '#6366f1' });
    setError('');
    setShowGroupModal(true);
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setGroupForm({ name: group.name, description: group.description || '', permissions: group.permissions || [], color: group.color || '#6366f1' });
    setError('');
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingGroup) {
        await api.updateUserGroup(editingGroup.id, groupForm);
      } else {
        await api.createUserGroup(groupForm);
      }
      setShowGroupModal(false);
      loadGroups();
    } catch (err) {
      setError(err.message);
    }
  };

  const openGroupMembers = (group) => {
    setShowGroupMembers(group);
    setGroupMemberIds((group.members || []).map(m => m.user_id));
  };

  const saveGroupMembers = async () => {
    await api.setGroupMembers(showGroupMembers.id, groupMemberIds);
    setShowGroupMembers(null);
    loadGroups();
  };

  const toggleGroupPermission = (key) => {
    setGroupForm(f => ({
      ...f,
      permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key]
    }));
  };

  const groupColors = ['#6366f1', '#059669', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#0f172a'];

  const permissionGroups = [...new Set(allPermissions.map(p => p.group))];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        {activeTab === 'users' && <button className="btn btn-primary" onClick={openNew}>+ Nový uživatel</button>}
        {activeTab === 'roles' && <button className="btn btn-primary" onClick={openNewRole}>+ Nová role</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: 0 }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.25rem', border: 'none', background: 'none',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            color: activeTab === 'users' ? 'var(--primary)' : 'var(--gray-500)',
            borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s'
          }}
        >Uživatelé</button>
        {can('admin') && (
          <button
            onClick={() => setActiveTab('roles')}
            style={{
              padding: '0.75rem 1.25rem', border: 'none', background: 'none',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              color: activeTab === 'roles' ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === 'roles' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s'
            }}
          >Role a oprávnění</button>
        )}
        {can('admin') && (
          <button
            onClick={() => setActiveTab('groups')}
            style={{
              padding: '0.75rem 1.25rem', border: 'none', background: 'none',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              color: activeTab === 'groups' ? 'var(--primary)' : 'var(--gray-500)',
              borderBottom: activeTab === 'groups' ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1, transition: 'all 0.15s'
            }}
          >Skupiny</button>
        )}
      </div>

      {activeTab === 'users' && (
        <>
          {pending.length > 0 && (
            <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--warning)' }}>
              <div className="card-title" style={{ marginBottom: '0.75rem', color: 'var(--warning)' }}>Čekající na schválení ({pending.length})</div>
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Jméno</th><th className="hide-mobile">Uživatel</th><th className="hide-mobile">Email</th><th className="hide-mobile">Registrován</th><th>Akce</th></tr></thead>
                  <tbody>
                    {pending.map(u => (
                      <tr key={u.id}>
                        <td><strong>{u.full_name}</strong></td>
                        <td className="hide-mobile">{u.username}</td>
                        <td className="hide-mobile">{u.email}</td>
                        <td className="hide-mobile">{u.created_at?.slice(0, 10)}</td>
                        <td>
                          <div className="btn-group">
                            <select className="form-select" id={`role-${u.id}`} defaultValue="viewer" style={{ width: 130, display: 'inline-block', marginRight: 8 }}>
                              <option value="viewer">Náhled</option>
                              <option value="manager">Manažer</option>
                              <option value="accountant">Účetní</option>
                              <option value="admin">Administrátor</option>
                            </select>
                            <button className="btn btn-success btn-sm" onClick={async () => {
                              const role = document.getElementById(`role-${u.id}`).value;
                              await api.approveUser(u.id, role);
                              load();
                            }}>Schválit</button>
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                              const ok = await confirm({ title: 'Zamítnout registraci', message: 'Opravdu chcete zamítnout tuto registraci?', type: 'danger', confirmText: 'Zamítnout' }); if (ok) { await api.rejectUser(u.id); toast.success('Registrace zamítnuta'); load(); }
                            }}>Zamítnout</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            {loading ? <div className="loading">Načítání...</div> : (
              <div className="table-responsive">
                <table>
                  <thead><tr><th>Jméno</th><th className="hide-mobile">Uživatel</th><th className="hide-mobile">Email</th><th>Role</th><th className="hide-mobile">Status</th><th className="hide-mobile">Vytvořen</th><th>Akce</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td><Link to={`/users/${u.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{u.full_name}</Link></td>
                        <td className="hide-mobile">{u.username}</td>
                        <td className="hide-mobile">{u.email}</td>
                        <td>
                          {can('admin') && roleAssignUser === u.id ? (
                            <select className="form-select" value={u.role} onChange={async (e) => {
                              await handleQuickRoleChange(u.id, e.target.value);
                              setRoleAssignUser(null);
                            }} onBlur={() => setRoleAssignUser(null)} autoFocus
                              style={{ width: 140, fontSize: '0.8rem', padding: '0.3rem 0.5rem' }}
                            >
                              <option value="admin">Administrátor</option>
                              <option value="accountant">Účetní</option>
                              <option value="manager">Manažer</option>
                              <option value="viewer">Náhled</option>
                            </select>
                          ) : (
                            <span className={`badge badge-${u.role}`}
                              onClick={() => can('admin') && setRoleAssignUser(u.id)}
                              style={{ cursor: can('admin') ? 'pointer' : 'default', transition: 'all 0.15s' }}
                              title={can('admin') ? 'Klikněte pro změnu role' : ''}
                            >
                              {roleLabels[u.role]}
                            </span>
                          )}
                        </td>
                        <td className="hide-mobile">
                          {can('admin') ? (() => {
                            const currentVal = pendingStatus.hasOwnProperty(u.id) ? pendingStatus[u.id] : u.active;
                            const changed = pendingStatus.hasOwnProperty(u.id) && pendingStatus[u.id] !== u.active;
                            return (
                              <select
                                className="form-select"
                                value={currentVal}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setPendingStatus(prev => {
                                    const next = { ...prev };
                                    if (val === u.active) { delete next[u.id]; } else { next[u.id] = val; }
                                    return next;
                                  });
                                }}
                                style={{
                                  width: 120, fontSize: '0.8rem', padding: '0.3rem 0.5rem',
                                  color: currentVal ? '#059669' : '#ef4444',
                                  fontWeight: 600,
                                  borderColor: changed ? 'var(--primary)' : undefined,
                                  background: changed ? 'var(--primary-50, #eef2ff)' : undefined,
                                }}
                              >
                                <option value={1} style={{ color: '#059669' }}>Aktivní</option>
                                <option value={0} style={{ color: '#ef4444' }}>Neaktivní</option>
                              </select>
                            );
                          })() : (
                            <span className={`badge ${u.active ? 'badge-paid' : 'badge-cancelled'}`}>{u.active ? 'Aktivní' : 'Neaktivní'}</span>
                          )}
                        </td>
                        <td className="hide-mobile">{u.created_at?.slice(0, 10)}</td>
                        <td>
                          <div className="btn-group">
                            <Link to={`/users/${u.id}`} className="btn btn-outline btn-sm">Detail</Link>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>Upravit</button>
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                              const ok = await confirm({ title: 'Smazat uživatele', message: `Opravdu chcete smazat uživatele ${u.username}?`, type: 'danger', confirmText: 'Smazat' }); if (!ok) return;
                              try { await api.deleteUser(u.id); toast.success('Uživatel smazán'); load(); } catch (e) { setError(e.message); }
                            }}>Smazat</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {can('admin') && hasPendingStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--primary-50, #eef2ff)', borderRadius: 'var(--radius)', border: '1px solid var(--primary, #6366f1)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-700)', flex: 1 }}>
                  {Object.keys(pendingStatus).length} {Object.keys(pendingStatus).length === 1 ? 'změna' : 'změny'} ke uložení
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => setPendingStatus({})}>Zrušit změny</button>
                <button className="btn btn-primary btn-sm" onClick={saveAllStatus} disabled={savingStatus}>
                  {savingStatus ? 'Ukládám...' : 'Uložit změny'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'roles' && can('admin') && (
        <>
          {/* System roles — editable (except admin) */}
          <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
            Upravujte oprávnění systémových i vlastních rolí. Administrátor má vždy všechna oprávnění.
          </p>

          {/* Admin — read-only, collapsed same as others */}
          <div className="card" style={{ borderLeft: '4px solid var(--gray-300)', padding: '1.25rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-300)" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M5 12h14"/>
              </svg>
              <span className="badge badge-admin" style={{ fontSize: '0.8rem' }}>Administrátor</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{users.filter(u => u.role === 'admin').length} uživatelů</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>Plná oprávnění — nelze omezit</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>{allPermissions.length}/{allPermissions.length} oprávnění</span>
            </div>
          </div>

          {/* Editable system roles: accountant, manager, viewer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {['accountant', 'manager', 'viewer'].map(key => (
              <SystemRoleCard
                key={key}
                roleKey={key}
                label={roleLabels[key]}
                defaultPerms={roleDefaults[key]}
                currentPerms={roleOverrides[key] || roleDefaults[key]}
                userCount={users.filter(u => u.role === key).length}
                onSave={saveSystemRolePerms}
                allPerms={allPermissions}
                permGroups={permissionGroups}
              />
            ))}
          </div>

          {/* Custom roles */}
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>Vlastní role</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)', margin: 0 }}>
              Přejmenujte, přidávejte a odebírejte oprávnění přímo na kartě. Změny se uloží tlačítkem „Uložit".
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {roles.map(role => (
              <RoleCard key={role.id} role={role} loadRoles={loadRoles} allPermissions={allPermissions} permissionGroups={permissionGroups} />
            ))}
          </div>

          {/* Inline new role creation */}
          {showRoleModal ? (
            <div className="card" style={{ marginTop: '0.75rem', padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label className="form-label">Název nové role</label>
                  <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleRoleSubmit(e)}
                    autoFocus placeholder="např. Senior účetní" />
                </div>
                <div style={{ flex: '1 1 120px' }}>
                  <label className="form-label">Základní role</label>
                  <select className="form-select" value={roleForm.base_role} onChange={e => setRoleForm(f => ({ ...f, base_role: e.target.value }))}>
                    <option value="admin">Administrátor</option>
                    <option value="accountant">Účetní</option>
                    <option value="manager">Manažer</option>
                    <option value="viewer">Náhled</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleRoleSubmit}>Vytvořit</button>
                <button className="btn btn-outline" onClick={() => setShowRoleModal(false)}>Zrušit</button>
              </div>
              {error && <div className="form-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
            </div>
          ) : (
            <button className="btn btn-primary" onClick={openNewRole} style={{ marginTop: '0.75rem' }}>
              + Nová role
            </button>
          )}
        </>
      )}

      {/* === GROUPS TAB — fully dynamic inline editing === */}
      {activeTab === 'groups' && can('admin') && (
        <GroupsTab
          groups={groups}
          users={users}
          loadGroups={loadGroups}
          allPermissions={allPermissions}
          permissionGroups={permissionGroups}
          groupColors={groupColors}
          error={error}
          setError={setError}
        />
      )}

      {/* User modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Upravit uživatele' : 'Nový uživatel'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              {!editing && (
                <div className="form-group">
                  <label className="form-label">Uživatelské jméno *</label>
                  <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Jméno *</label>
                  <input className="form-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Příjmení *</label>
                  <input className="form-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">{editing ? 'Nové heslo (ponechte prázdné = beze změny)' : 'Heslo *'}</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} {...(!editing && { required: true })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="admin">Administrátor</option>
                    <option value="accountant">Účetní</option>
                    <option value="manager">Manažer</option>
                    <option value="viewer">Náhled</option>
                  </select>
                </div>
                {editing && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.active} onChange={e => setForm(f => ({ ...f, active: parseInt(e.target.value) }))}>
                      <option value={1}>Aktivní</option>
                      <option value={0}>Neaktivní</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="btn-group" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">{editing ? 'Uložit' : 'Vytvořit'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role modal removed — roles are now edited inline on their cards */}
    </div>
  );
}
