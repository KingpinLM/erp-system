import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../App';

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
  const { can } = useAuth();

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

  useEffect(() => { load(); loadRoles(); loadGroups(); }, []);

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
    e.preventDefault();
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
      <div className="page-header">
        <h1 className="page-title">Správa uživatelů</h1>
        <div className="btn-group">
          {activeTab === 'users' && <button className="btn btn-primary" onClick={openNew}>+ Nový uživatel</button>}
          {activeTab === 'roles' && <button className="btn btn-primary" onClick={openNewRole}>+ Nová role</button>}
          {activeTab === 'groups' && <button className="btn btn-primary" onClick={openNewGroup}>+ Nová skupina</button>}
        </div>
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
                  <thead><tr><th>Jméno</th><th>Uživatel</th><th>Email</th><th>Registrován</th><th>Akce</th></tr></thead>
                  <tbody>
                    {pending.map(u => (
                      <tr key={u.id}>
                        <td><strong>{u.full_name}</strong></td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.created_at?.slice(0, 10)}</td>
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
                              if (confirm('Opravdu zamítnout registraci?')) { await api.rejectUser(u.id); load(); }
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
                  <thead><tr><th>Jméno</th><th>Uživatel</th><th>Email</th><th>Role</th><th>Status</th><th>Vytvořen</th><th>Akce</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td><Link to={`/users/${u.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{u.full_name}</Link></td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
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
                        <td><span className={`badge ${u.active ? 'badge-paid' : 'badge-cancelled'}`}>{u.active ? 'Aktivní' : 'Neaktivní'}</span></td>
                        <td>{u.created_at?.slice(0, 10)}</td>
                        <td>
                          <div className="btn-group">
                            <Link to={`/users/${u.id}`} className="btn btn-outline btn-sm">Detail</Link>
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)}>Upravit</button>
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                              if (!confirm(`Smazat uživatele ${u.username}?`)) return;
                              try { await api.deleteUser(u.id); load(); } catch (e) { setError(e.message); }
                            }}>Smazat</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'roles' && can('admin') && (
        <>
          {/* Built-in roles */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-title" style={{ marginBottom: '1rem' }}>Systémové role</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Přehled výchozích rolí a jejich oprávnění. Kliknutím na roli uživatele v tabulce ji můžete rychle změnit.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {Object.entries(roleLabels).map(([key, label]) => (
                <div key={key} className="role-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span className={`badge badge-${key}`} style={{ fontSize: '0.75rem' }}>{label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                      {users.filter(u => u.role === key).length} uživatelů
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {roleDefaults[key].map(perm => {
                      const p = allPermissions.find(ap => ap.key === perm);
                      return p ? (
                        <span key={perm} style={{
                          fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 4,
                          background: 'var(--success-light)', color: 'var(--success-dark)', fontWeight: 600
                        }}>{p.label}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom roles */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Vlastní role</div>
            </div>
            {roles.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Zatím žádné vlastní role</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Vytvořte vlastní role s přesně nastavenými oprávněními.</div>
                <button className="btn btn-primary" onClick={openNewRole}>+ Vytvořit roli</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {roles.map(role => (
                  <div key={role.id} className="role-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '0.95rem' }}>{role.name}</div>
                        {role.description && <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{role.description}</div>}
                      </div>
                      <span className={`badge badge-${role.base_role}`} style={{ fontSize: '0.65rem' }}>
                        {roleLabels[role.base_role]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
                      {(role.permissions || []).map(perm => {
                        const p = allPermissions.find(ap => ap.key === perm);
                        return p ? (
                          <span key={perm} style={{
                            fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 4,
                            background: 'var(--primary-50)', color: 'var(--primary-dark)', fontWeight: 600
                          }}>{p.label}</span>
                        ) : null;
                      })}
                    </div>
                    <div className="btn-group">
                      <button className="btn btn-outline btn-sm" onClick={() => openEditRole(role)}>Upravit</button>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        if (confirm(`Smazat roli "${role.name}"?`)) {
                          await api.deleteRole(role.id);
                          loadRoles();
                        }
                      }}>Smazat</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* === GROUPS TAB === */}
      {activeTab === 'groups' && can('admin') && (
        <>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Skupiny uživatelů</div>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Vytvářejte skupiny uživatelů se sdílenými oprávněními. Oprávnění skupiny se přidají ke stávajícím oprávněním uživatele.
            </p>
            {groups.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--gray-400)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Zatím žádné skupiny</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>Vytvořte skupinu pro sdílení oprávnění mezi uživateli.</div>
                <button className="btn btn-primary" onClick={openNewGroup}>+ Vytvořit skupinu</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                {groups.map(group => (
                  <div key={group.id} className="role-card" style={{ borderLeft: `4px solid ${group.color || '#6366f1'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gray-900)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: group.color || '#6366f1' }} />
                          {group.name}
                        </div>
                        {group.description && <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 2 }}>{group.description}</div>}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                        {(group.members || []).length} členů
                      </span>
                    </div>
                    {/* Permissions badges */}
                    {(group.permissions || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.5rem' }}>
                        {(group.permissions || []).map(perm => {
                          const p = allPermissions.find(ap => ap.key === perm);
                          return p ? (
                            <span key={perm} style={{
                              fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: 4,
                              background: `${group.color || '#6366f1'}15`, color: group.color || '#6366f1', fontWeight: 600
                            }}>{p.label}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {/* Members avatars */}
                    {(group.members || []).length > 0 && (
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {(group.members || []).slice(0, 6).map(m => (
                          <span key={m.user_id} style={{
                            fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: 6,
                            background: 'var(--gray-100)', color: 'var(--gray-600)', fontWeight: 500
                          }}>{m.full_name || m.username}</span>
                        ))}
                        {(group.members || []).length > 6 && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', alignSelf: 'center' }}>+{group.members.length - 6}</span>
                        )}
                      </div>
                    )}
                    <div className="btn-group">
                      <button className="btn btn-outline btn-sm" onClick={() => openGroupMembers(group)}>Členové</button>
                      <button className="btn btn-outline btn-sm" onClick={() => openEditGroup(group)}>Upravit</button>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        if (confirm(`Smazat skupinu "${group.name}"?`)) {
                          await api.deleteUserGroup(group.id);
                          loadGroups();
                        }
                      }}>Smazat</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Group modal */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingGroup ? 'Upravit skupinu' : 'Nová skupina'}</h3>
              <button className="modal-close" onClick={() => setShowGroupModal(false)}>&times;</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleGroupSubmit}>
              <div className="form-group">
                <label className="form-label">Název skupiny *</label>
                <input className="form-input" value={groupForm.name} onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))} required placeholder="např. Fakturanti, Správci banky" />
              </div>
              <div className="form-group">
                <label className="form-label">Popis</label>
                <input className="form-input" value={groupForm.description} onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))} placeholder="Volitelný popis skupiny" />
              </div>
              <div className="form-group">
                <label className="form-label">Barva</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {groupColors.map(c => (
                    <div key={c} onClick={() => setGroupForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer',
                        border: groupForm.color === c ? '3px solid var(--gray-900)' : '3px solid transparent',
                        transition: 'all 0.15s', transform: groupForm.color === c ? 'scale(1.15)' : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '0.75rem' }}>Oprávnění skupiny</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setGroupForm(f => ({ ...f, permissions: allPermissions.map(p => p.key) }))}>Vybrat vše</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setGroupForm(f => ({ ...f, permissions: [] }))}>Zrušit vše</button>
                </div>
                {permissionGroups.map(group => (
                  <div key={group} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {allPermissions.filter(p => p.group === group).map(perm => (
                        <label key={perm.key} className="perm-toggle" style={{
                          background: groupForm.permissions.includes(perm.key) ? `${groupForm.color}15` : 'var(--gray-50)',
                          border: `1px solid ${groupForm.permissions.includes(perm.key) ? groupForm.color : 'var(--gray-200)'}`,
                          borderRadius: 8, transition: 'all 0.15s ease'
                        }}>
                          <input type="checkbox" checked={groupForm.permissions.includes(perm.key)}
                            onChange={() => toggleGroupPermission(perm.key)}
                            style={{ width: 16, height: 16, accentColor: groupForm.color }}
                          />
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: groupForm.permissions.includes(perm.key) ? 'var(--gray-800)' : 'var(--gray-600)' }}>
                            {perm.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="btn-group" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">{editingGroup ? 'Uložit' : 'Vytvořit skupinu'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowGroupModal(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group members modal */}
      {showGroupMembers && (
        <div className="modal-overlay" onClick={() => setShowGroupMembers(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">Členové: {showGroupMembers.name}</h3>
              <button className="modal-close" onClick={() => setShowGroupMembers(null)}>&times;</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem' }}>
              Vyberte uživatele, kteří budou součástí této skupiny. Oprávnění skupiny se přidají k jejich stávajícím oprávněním.
            </p>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {users.map(u => (
                <label key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem',
                  borderRadius: 8, cursor: 'pointer', marginBottom: '0.25rem',
                  background: groupMemberIds.includes(u.id) ? `${showGroupMembers.color || '#6366f1'}10` : 'transparent',
                  border: `1px solid ${groupMemberIds.includes(u.id) ? (showGroupMembers.color || '#6366f1') + '40' : 'transparent'}`,
                  transition: 'all 0.15s',
                }}>
                  <input type="checkbox" checked={groupMemberIds.includes(u.id)}
                    onChange={() => setGroupMemberIds(ids => ids.includes(u.id) ? ids.filter(id => id !== u.id) : [...ids, u.id])}
                    style={{ width: 18, height: 18, accentColor: showGroupMembers.color || '#6366f1' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-900)' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{u.username} · {roleLabels[u.role]}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="btn-group" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={saveGroupMembers}>Uložit ({groupMemberIds.length} vybraných)</button>
              <button className="btn btn-outline" onClick={() => setShowGroupMembers(null)}>Zrušit</button>
            </div>
          </div>
        </div>
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

      {/* Role modal */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editingRole ? 'Upravit roli' : 'Nová role'}</h3>
              <button className="modal-close" onClick={() => setShowRoleModal(false)}>&times;</button>
            </div>
            {error && <div className="login-error">{error}</div>}
            <form onSubmit={handleRoleSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label">Název role *</label>
                  <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} required placeholder="např. Senior účetní" />
                </div>
                <div className="form-group">
                  <label className="form-label">Základní role</label>
                  <select className="form-select" value={roleForm.base_role} onChange={e => setRoleForm(f => ({ ...f, base_role: e.target.value }))}>
                    <option value="admin">Administrátor</option>
                    <option value="accountant">Účetní</option>
                    <option value="manager">Manažer</option>
                    <option value="viewer">Náhled</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Popis</label>
                <input className="form-input" value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} placeholder="Volitelný popis role" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '0.75rem' }}>Oprávnění</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setRoleForm(f => ({ ...f, permissions: allPermissions.map(p => p.key) }))}>Vybrat vše</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setRoleForm(f => ({ ...f, permissions: [] }))}>Zrušit vše</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setRoleForm(f => ({ ...f, permissions: [...(roleDefaults[f.base_role] || [])] }))}>Výchozí pro roli</button>
                </div>
                {permissionGroups.map(group => (
                  <div key={group} style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>{group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {allPermissions.filter(p => p.group === group).map(perm => (
                        <label key={perm.key} className="perm-toggle" style={{
                          background: roleForm.permissions.includes(perm.key) ? 'var(--success-light)' : 'var(--gray-50)',
                          border: `1px solid ${roleForm.permissions.includes(perm.key) ? 'var(--success)' : 'var(--gray-200)'}`,
                          borderRadius: 8, transition: 'all 0.15s ease'
                        }}>
                          <input type="checkbox" checked={roleForm.permissions.includes(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                            style={{ width: 16, height: 16, accentColor: 'var(--success)' }}
                          />
                          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: roleForm.permissions.includes(perm.key) ? 'var(--success-dark)' : 'var(--gray-600)' }}>
                            {perm.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="btn-group" style={{ marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">{editingRole ? 'Uložit' : 'Vytvořit roli'}</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowRoleModal(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
