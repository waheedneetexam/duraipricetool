import { useEffect, useState } from 'react';
import { apiFetch, hasPermission } from '../api/client';

type AuditLog = {
    log_id: string;
    actor_user_id: string;
    actor_tenant_id: string;
    target_type: string;
    target_id: string;
    action: string;
    detail: any;
    created_at_epoch: number;
};

export function AuditLogAdmin() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Choose default view based on highest permission
    const canPlatform = hasPermission('platform.audit.read');
    const [view, setView] = useState<'admin' | 'platform'>(canPlatform ? 'platform' : 'admin');

    useEffect(() => {
        void loadLogs();
    }, [view]);

    async function loadLogs() {
        setLoading(true);
        setError('');
        try {
            const endpoint = view === 'platform' ? '/audit/platform' : '/audit/admin';
            const res = await apiFetch<{ data: AuditLog[] }>(endpoint);
            setLogs(res.data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="panel-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0 }}>Administrative Audit Logs</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {canPlatform && (
                        <div className="btn-group" style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <button
                                className="btn btn-xs"
                                style={{ borderRadius: 0, border: 'none', background: view === 'admin' ? '#cbd5e1' : 'white' }}
                                onClick={() => setView('admin')}
                            >My Tenant</button>
                            <button
                                className="btn btn-xs"
                                style={{ borderRadius: 0, border: 'none', background: view === 'platform' ? '#cbd5e1' : 'white' }}
                                onClick={() => setView('platform')}
                            >All Platform</button>
                        </div>
                    )}
                    <button className="btn btn-xs btn-primary" onClick={loadLogs} disabled={loading}>
                        {loading ? '...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {error && <div className="error-box" style={{ marginBottom: '16px' }}>{error}</div>}

            <div style={{ overflowX: 'auto' }}>
                <table className="admin-config-table" style={{ fontSize: '0.9em' }}>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Actor</th>
                            <th>Action</th>
                            <th>Target</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.length === 0 && (
                            <tr><td colSpan={5} className="muted text-center" style={{ padding: '32px' }}>No audit records found.</td></tr>
                        )}
                        {logs.map(l => (
                            <tr key={l.log_id}>
                                <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.created_at_epoch * 1000).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}</td>
                                <td>
                                    <div style={{ fontSize: '0.85em' }}>
                                        <strong>User:</strong> {l.actor_user_id.substring(0, 8)}...<br />
                                        <strong>Tenant:</strong> {l.actor_tenant_id}
                                    </div>
                                </td>
                                <td>
                                    <span className="badge" style={{
                                        background: '#f1f5f9',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        fontSize: '0.8em'
                                    }}>{l.action}</span>
                                </td>
                                <td>
                                    <div style={{ fontSize: '0.85em' }}>
                                        <span className="muted">{l.target_type}:</span><br />
                                        <code>{l.target_id}</code>
                                    </div>
                                </td>
                                <td>
                                    <details style={{ cursor: 'pointer' }}>
                                        <summary style={{ fontSize: '0.85em', color: '#6366f1' }}>View JSON</summary>
                                        <pre style={{
                                            fontSize: '0.75em',
                                            background: '#f8fafc',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            marginTop: '4px',
                                            border: '1px solid #e2e8f0',
                                            maxWidth: '300px',
                                            overflowX: 'auto'
                                        }}>{JSON.stringify(l.detail, null, 2)}</pre>
                                    </details>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
