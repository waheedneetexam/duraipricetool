import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type Tenant = {
    tenant_id: string;
    tenant_name: string;
    active: boolean;
};

type PlatformUser = {
    user_id: string;
    email: string;
    full_name: string;
    active: boolean;
    tenant_roles: string; // "tenant:role,tenant:role"
};

export function PlatformManagementAdmin() {
    const [activeTab, setActiveTab] = useState<'tenants' | 'users'>('tenants');
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [roles, setRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form states
    const [newTenantName, setNewTenantName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newPass, setNewPass] = useState('');
    const [selTenant, setSelTenant] = useState('');
    const [selRole, setSelRole] = useState('TenantAdmin');

    // State for existing user assignment
    const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
    const [assignTenantId, setAssignTenantId] = useState('');
    const [assignRoleId, setAssignRoleId] = useState('TenantAdmin');

    // Inline editing state
    const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
    const [editingTenantName, setEditingTenantName] = useState('');

    useEffect(() => {
        void loadData();
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            if (activeTab === 'tenants') {
                const res = await apiFetch<{ data: Tenant[] }>('/platform/tenants');
                setTenants(res.data);
            } else {
                const [uRes, tRes, rRes] = await Promise.all([
                    apiFetch<{ data: PlatformUser[] }>('/platform/users'),
                    apiFetch<{ data: Tenant[] }>('/platform/tenants'),
                    apiFetch<{ data: string[] }>('/platform/roles')
                ]);
                setUsers(uRes.data);
                setTenants(tRes.data);
                setRoles(rRes.data);
                if (tRes.data.length > 0 && !selTenant) setSelTenant(tRes.data[0].tenant_id);
                if (tRes.data.length > 0 && !assignTenantId) setAssignTenantId(tRes.data[0].tenant_id);
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateTenant(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>('/platform/tenants', {
                method: 'POST',
                body: JSON.stringify({ tenant_name: newTenantName })
            });
            if (!res.success) {
                setError(res.error || 'Failed to create tenant');
                return;
            }
            setNewTenantName('');
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function toggleTenant(tenantId: string, currentActive: boolean) {
        if (!confirm(`Are you sure you want to ${currentActive ? 'suspend' : 'activate'} this tenant?`)) return;
        setLoading(true);
        try {
            await apiFetch(`/platform/tenants/${tenantId}`, {
                method: 'PATCH',
                body: JSON.stringify({ active: !currentActive })
            });
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteTenant(tenantId: string) {
        if (tenantId === 'default') {
            alert("The 'default' tenant cannot be deleted.");
            return;
        }
        if (!confirm(`Are you SURE you want to PERMANENTLY delete this tenant and ALL associated data? This action cannot be undone.`)) return;

        setLoading(true);
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>(`/platform/tenants/${tenantId}`, {
                method: 'DELETE'
            });
            if (!res.success) {
                setError(res.error || 'Failed to delete tenant');
                return;
            }
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleRenameTenant(tenantId: string) {
        if (!editingTenantName.trim()) return;
        setLoading(true);
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>(`/platform/tenants/${tenantId}/name`, {
                method: 'PATCH',
                body: JSON.stringify({ tenant_name: editingTenantName })
            });
            if (!res.success) {
                setError(res.error || 'Failed to rename tenant');
                return;
            }
            setEditingTenantId(null);
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleRemoveRole(userId: string, tenantId: string, roleName: string) {
        if (!confirm(`Remove access for ${roleName} from this tenant?`)) return;
        setLoading(true);
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>(
                `/platform/users/${userId}/tenants/${tenantId}/roles/${roleName}`,
                { method: 'DELETE' }
            );
            if (!res.success) {
                setError(res.error || 'Failed to remove role');
                return;
            }
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>('/platform/users', {
                method: 'POST',
                body: JSON.stringify({
                    email: newEmail,
                    full_name: newName,
                    password: newPass,
                    tenant_id: selTenant,
                    role: selRole
                })
            });
            if (!res.success) {
                setError(res.error || 'Failed to create platform user');
                return;
            }
            setNewEmail('');
            setNewName('');
            setNewPass('');
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleAssignTenant(userId: string) {
        setLoading(true);
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>(`/platform/users/${userId}/assign-tenant`, {
                method: 'POST',
                body: JSON.stringify({
                    tenant_id: assignTenantId,
                    role: assignRoleId
                })
            });
            if (!res.success) {
                setError(res.error || 'Failed to assign tenant');
                return;
            }
            setAssigningUserId(null);
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="tabbar" style={{ padding: '6px', gap: '4px' }}>
                <button className={activeTab === 'tenants' ? 'active' : ''} onClick={() => setActiveTab('tenants')}>Tenants</button>
                <button className={activeTab === 'users' ? 'active' : ''} onClick={() => setActiveTab('users')}>Users (Global)</button>
            </div>

            {error && <div className="error-box">{error}</div>}

            {activeTab === 'tenants' && (
                <div className="admin-layout">
                    <div className="panel-card">
                        <h3>Platform Tenants</h3>
                        <table className="admin-config-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Name</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tenants.map(t => (
                                    <tr key={t.tenant_id}>
                                        <td>
                                            {editingTenantId === t.tenant_id ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <input
                                                        value={editingTenantName}
                                                        onChange={e => setEditingTenantName(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') handleRenameTenant(t.tenant_id);
                                                            if (e.key === 'Escape') setEditingTenantId(null);
                                                        }}
                                                        style={{ padding: '2px 4px', fontSize: '0.9em' }}
                                                    />
                                                    <button className="btn btn-xs btn-primary" onClick={() => handleRenameTenant(t.tenant_id)}>Save</button>
                                                    <button className="btn btn-xs" onClick={() => setEditingTenantId(null)}>X</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{t.tenant_name}</span>
                                                    <button
                                                        className="btn btn-xs"
                                                        style={{ padding: '2px 4px', fontSize: '0.8em', opacity: 0.6 }}
                                                        onClick={() => {
                                                            setEditingTenantId(t.tenant_id);
                                                            setEditingTenantName(t.tenant_name);
                                                        }}
                                                    >
                                                        ✎
                                                    </button>
                                                </div>
                                            )}
                                            <span className="muted" style={{ fontSize: '0.7em', display: 'block' }}>{t.tenant_id.substring(0, 8)}...</span>
                                        </td>
                                        <td>
                                            <span className="badge" style={{
                                                background: t.active ? '#dcfce7' : '#fee2e2',
                                                color: t.active ? '#166534' : '#991b1b',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.85em',
                                                fontWeight: 600
                                            }}>
                                                {t.active ? 'Active' : 'Suspended'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-xs" onClick={() => toggleTenant(t.tenant_id, t.active)}>
                                                {t.active ? 'Suspend' : 'Activate'}
                                            </button>
                                            {t.tenant_id !== 'default' && (
                                                <button
                                                    className="btn btn-xs"
                                                    style={{ marginLeft: '4px', background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}
                                                    onClick={() => handleDeleteTenant(t.tenant_id)}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <form className="panel-card" onSubmit={handleCreateTenant}>
                        <h3>Create Tenant</h3>
                        <p className="muted" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
                            Add a new client organization to the platform.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label>
                                Tenant Name
                                <input value={newTenantName} onChange={e => setNewTenantName(e.target.value)} required placeholder="Acme Corp" />
                            </label>
                            <button className="btn btn-primary" type="submit" disabled={loading}>Create Tenant</button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="admin-layout">
                    <div className="panel-card">
                        <h3>Global User Management</h3>
                        <table className="admin-config-table">
                            <thead>
                                <tr>
                                    <th>Email</th>
                                    <th>Full Name</th>
                                    <th>Assignments (tenant:role)</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.user_id}>
                                        <td>{u.email}</td>
                                        <td>{u.full_name}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {u.tenant_roles.split(',').filter(Boolean).map(raw => {
                                                    const [tid, tname, rname] = raw.split(':');
                                                    return (
                                                        <span key={raw} className="badge" style={{
                                                            background: '#f3f4f6',
                                                            color: '#374151',
                                                            padding: '2px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.85em',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px'
                                                        }}>
                                                            {tname}:{rname}
                                                            <button
                                                                onClick={() => handleRemoveRole(u.user_id, tid, rname)}
                                                                style={{
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    cursor: 'pointer',
                                                                    color: '#991b1b',
                                                                    padding: '0 2px',
                                                                    fontSize: '14px',
                                                                    lineHeight: 1,
                                                                    fontWeight: 'bold'
                                                                }}
                                                                title="Remove assignment"
                                                            >×</button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        <td>
                                            {assigningUserId === u.user_id ? (
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <select value={assignTenantId} onChange={e => setAssignTenantId(e.target.value)} style={{ padding: '2px', fontSize: '11px' }}>
                                                        {tenants.map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}
                                                    </select>
                                                    <select value={assignRoleId} onChange={e => setAssignRoleId(e.target.value)} style={{ padding: '2px', fontSize: '11px' }}>
                                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                    <button className="btn btn-xs btn-primary" onClick={() => handleAssignTenant(u.user_id)}>Add</button>
                                                    <button className="btn btn-xs" onClick={() => setAssigningUserId(null)}>X</button>
                                                </div>
                                            ) : (
                                                <button className="btn btn-xs" onClick={() => setAssigningUserId(u.user_id)}>+ Assign Tenant</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <form className="panel-card" onSubmit={handleCreateUser}>
                        <h3>Platform User Sign-up</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label>Email <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required /></label>
                            <label>Full Name <input value={newName} onChange={e => setNewName(e.target.value)} required /></label>
                            <label>Password <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required /></label>
                            <label>Initial Assignment (Tenant)
                                <select value={selTenant} onChange={e => setSelTenant(e.target.value)}>
                                    {tenants.map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}
                                </select>
                            </label>
                            <label>Role
                                <select value={selRole} onChange={e => setSelRole(e.target.value)}>
                                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </label>
                            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px' }}>Create User</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
