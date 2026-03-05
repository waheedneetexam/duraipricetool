import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import type { AuditLog } from '../api/types';

type Props = {
    tableId: string;
    recordId: string;
    onClose: () => void;
};

export function ChangelogModal({ tableId, recordId, onClose }: Props) {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        void loadChangelog();
    }, [tableId, recordId]);

    async function loadChangelog() {
        setLoading(true);
        setError('');
        try {
            const res = await apiFetch<{ data: AuditLog[] }>(`/admin/data/table/${tableId}/${recordId}/changelog`);
            setLogs(res.data);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: 'white', padding: '24px', borderRadius: '12px',
                width: '90%', maxWidth: '800px', maxHeight: '85vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>History: {recordId} <span className="muted" style={{ fontSize: '0.9rem', fontWeight: 400 }}>({tableId})</span></h3>
                    <button className="btn btn-xs" onClick={onClose}>✕ Close</button>
                </div>

                {loading && <div className="text-center p-4">Loading history...</div>}
                {error && <div className="error-box">{error}</div>}

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    {logs.length === 0 && !loading && <p className="muted text-center p-8">No history found for this record.</p>}
                    <div className="changelog-timeline" style={{ position: 'relative', paddingLeft: '24px' }}>
                        <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', background: '#e2e8f0' }} />

                        {logs.map((log) => (
                            <div key={log.log_id} style={{ position: 'relative', marginBottom: '24px' }}>
                                <div style={{
                                    position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px',
                                    borderRadius: '50%', background: log.action.includes('delete') ? 'var(--danger)' : 'var(--primary)',
                                    border: '2px solid white', boxShadow: '0 0 0 2px #e2e8f0'
                                }} />

                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>
                                    <strong>{new Date(log.created_at_epoch * 1000).toLocaleString()}</strong> by {log.actor_name || 'System'}
                                </div>

                                <div style={{
                                    padding: '12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0'
                                }}>
                                    <span className="badge" style={{
                                        background: '#cbd5e1', color: '#1e293b', fontWeight: 700, padding: '2px 6px',
                                        borderRadius: '4px', textTransform: 'uppercase', fontSize: '0.75rem', marginRight: '8px'
                                    }}>{log.action.replace('_', ' ')}</span>

                                    {log.detail?.diff && Object.keys(log.detail.diff).length > 0 ? (
                                        <table style={{ width: '100%', marginTop: '10px', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                                                    <th style={{ padding: '4px' }}>Field</th>
                                                    <th style={{ padding: '4px' }}>Old Value</th>
                                                    <th style={{ padding: '4px' }}>New Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(log.detail.diff).map(([field, vals]: [string, any]) => (
                                                    <tr key={field} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '4px', fontWeight: 600 }}>{field}</td>
                                                        <td style={{ padding: '4px', color: '#94a3b8', textDecoration: 'line-through' }}>{String(vals[0] ?? '—')}</td>
                                                        <td style={{ padding: '4px', color: '#059669', fontWeight: 500 }}>{String(vals[1] ?? '—')}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : log.action === 'create_record' ? (
                                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#4b5563' }}>
                                            Record initialized with initial values.
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                            No field changes detected.
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
