import { useState } from 'react';

type FieldDef = {
    name: string;
    displayName: string;
    type: string;
    required: boolean;
    unique: boolean;
};

type Props = {
    columns: FieldDef[];
    csvHeaders: string[];
    initialMapping: Record<string, string>;
    onSave: (mapping: Record<string, string>) => void;
    onClose: () => void;
};

export function MappingModal({ columns, csvHeaders, initialMapping, onSave, onClose }: Props) {
    const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

    return (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
            <div className="modal-content" style={{
                background: 'white', padding: '24px', borderRadius: '12px',
                width: '90%', maxWidth: '900px', maxHeight: '85vh', overflow: 'hidden',
                display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Configure Column Mapping</h3>
                    <button className="btn btn-xs" onClick={onClose}>✕ Close</button>
                </div>

                <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
                    <table className="mapping-table" style={{ minWidth: '600px', width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '12px' }}>CSV Column Header</th>
                                <th style={{ padding: '12px' }}>Expected Field</th>
                                <th style={{ padding: '12px' }}>Map To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((col) => (
                                <tr key={col.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px', color: '#64748b' }}>{mapping[col.name] || '—'}</td>
                                    <td style={{ padding: '12px' }}>
                                        → <strong>{col.displayName}</strong>
                                        {col.required && <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>*</span>}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <select
                                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                            value={mapping[col.name] || ''}
                                            onChange={(e) => setMapping(prev => ({ ...prev, [col.name]: e.target.value }))}
                                        >
                                            <option value="">Skip Column</option>
                                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" style={{ background: '#059669', border: 'none' }} onClick={() => {
                        onSave(mapping);
                        onClose();
                    }}>Save Mapping</button>
                </div>
            </div>
        </div>
    );
}
