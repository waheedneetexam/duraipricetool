import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

type AdminUser = {
    user_id: string;
    email: string;
    full_name: string;
    active: boolean;
    roles: string; // comma separated
};

type Props = {
    tenantId: string;
};

export function UserManagementAdmin({ tenantId }: Props) {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [roles, setRoles] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newPass, setNewPass] = useState('');
    const [newRole, setNewRole] = useState('Viewer');

    useEffect(() => {
        void loadData();
    }, [tenantId]);

    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [uRes, rRes] = await Promise.all([
                apiFetch<{ data: AdminUser[] }>('/admin/users'),
                apiFetch<{ data: string[] }>('/admin/roles')
            ]);
            setUsers(uRes.data);
            setRoles(rRes.data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch<{ success: boolean; error?: string }>('/admin/users', {
                method: 'POST',
                body: JSON.stringify({
                    email: newEmail,
                    full_name: newName,
                    password: newPass,
                    role: newRole
                })
            });
            if (!res.success) {
                setError(res.error || 'Failed to create user');
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

    async function handleAssignRole(userId: string, role: string) {
        setLoading(true);
        setError('');
        try {
            await apiFetch(`/admin/users/${userId}/assign-role`, {
                method: 'POST',
                body: JSON.stringify({ role })
            });
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function handleRemoveRole(userId: string, role: string) {
        if (!confirm(`Are you sure you want to remove the role "${role}"?`)) return;
        setLoading(true);
        setError('');
        try {
            await apiFetch(`/admin/users/${userId}/role/${role}`, {
                method: 'DELETE'
            });
            await loadData();
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="admin-layout">
            <div className="panel-card" style={{ flex: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>User Management</h3>
                    <button className="btn btn-xs" onClick={loadData} disabled={loading}>Refresh List</button>
                </div>
                {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}
                <table className="admin-config-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Full Name</th>
                            <th>Roles</th>
                            <th>Add Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 && (
                            <tr><td colSpan={4} className="muted text-center" style={{ padding: '24px' }}>No users found for this tenant.</td></tr>
                        )}
                        {users.map(u => (
                            <tr key={u.user_id}>
                                <td>{u.email}</td>
                                <td>{u.full_name}</td>
                                <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {u.roles.split(',').filter(Boolean).map(r => (
                                            <span key={r} className="badge" style={{
                                                background: '#eef2ff',
                                                color: '#4338ca',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.85em',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {r}
                                                <button
                                                    onClick={() => handleRemoveRole(u.user_id, r)}
                                                    style={{ border: 'none', background: 'none', color: '#991b1b', cursor: 'pointer', padding: '0', fontSize: '1.2em', lineHeight: 1 }}
                                                    title="Remove role"
                                                >×</button>
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td>
                                    <select
                                        style={{ padding: '2px 4px', fontSize: '0.9em' }}
                                        onChange={(e) => {
                                            if (e.target.value) handleAssignRole(u.user_id, e.target.value);
                                            e.target.value = '';
                                        }}
                                        value=""
                                    >
                                        <option value="">Select...</option>
                                        {roles.filter(r => !u.roles.split(',').includes(r)).map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <form className="panel-card" style={{ flex: 1 }} onSubmit={handleCreateUser}>
                <h3>Invite User</h3>
                <p className="muted" style={{ fontSize: '0.9em', marginBottom: '16px' }}>
                    Create a new user specifically for <strong>{tenantId}</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label>
                        Email
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="user@company.com" />
                    </label>
                    <label>
                        Full Name
                        <input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="John Doe" />
                    </label>
                    <label>
                        Password
                        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="••••••••" />
                    </label>
                    <label>
                        Initial Role
                        <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </label>
                    <button className="btn btn-primary" style={{ marginTop: '8px' }} type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create User'}
                    </button>
                </div>
            </form>
        </div>
    );
}
