import { useState } from 'react';
import type { DataTableDefinition, DataFieldDefinition } from '../constants/dataManagementTables';
import { apiFetch } from '../api/client';

type CreateTableModalProps = {
    onClose: () => void;
    onCreated: () => void;
};

export function CreateTableModal({ onClose, onCreated }: CreateTableModalProps) {
    const [displayName, setDisplayName] = useState('');
    const [tableId, setTableId] = useState('');
    const [fields, setFields] = useState<DataFieldDefinition[]>([
        { name: 'id', displayName: 'ID', type: 'text', required: true, unique: true }
    ]);
    const [primaryKey, setPrimaryKey] = useState('id');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const addField = () => {
        setFields([...fields, { name: '', displayName: '', type: 'text', required: false, unique: false }]);
    };

    const removeField = (index: number) => {
        if (fields.length <= 1) return;
        const newFields = fields.filter((_, i) => i !== index);
        setFields(newFields);
        if (!newFields.find(f => f.name === primaryKey)) {
            setPrimaryKey(newFields[0]?.name || '');
        }
    };

    const updateField = (index: number, updates: Partial<DataFieldDefinition>) => {
        const newFields = [...fields];
        newFields[index] = { ...newFields[index], ...updates };
        setFields(newFields);
    };

    const handleCreate = async () => {
        if (!displayName || !tableId || !primaryKey) {
            setError('Please fill in all basic info.');
            return;
        }

        if (fields.some(f => !f.name)) {
            setError('All fields must have a name.');
            return;
        }

        setLoading(true);
        setError('');

        const schema: DataTableDefinition = {
            id: tableId,
            name: tableId.replace(/-/g, '_'),
            displayName,
            description: displayName,
            primaryKey,
            requiresValidation: true,
            fields,
            sampleCsv: fields.map(f => f.name).join(',')
        };

        try {
            const res = await apiFetch<{ success: boolean; error?: string }>('/admin/data/table-schemas', {
                method: 'POST',
                body: JSON.stringify(schema)
            });

            if (res.success) {
                onCreated();
                onClose();
            } else {
                setError(res.error || 'Failed to create table');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ width: '900px', maxWidth: '95vw' }}>
                <div className="modal-header" style={{ background: '#1e293b', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: '#fff', padding: '4px', borderRadius: '4px' }}>
                            <span style={{ color: '#1e293b', fontWeight: 800, fontSize: '14px' }}>🗄️</span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Enterprise Pricing System</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                </div>

                <div className="modal-body" style={{ padding: '32px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px', color: '#1e293b' }}>Create New Table</h2>

                    {error && <div className="error-box" style={{ marginBottom: '20px' }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '40px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0' }}>
                        {/* Left Column: Table Identity */}
                        <div style={{ flex: '0 0 320px', padding: '24px', borderRight: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Table Identity</h3>

                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#64748b' }}>Display Name</label>
                                <input
                                    className="form-input"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    placeholder="Enter table name..."
                                    value={displayName}
                                    onChange={(e) => {
                                        setDisplayName(e.target.value);
                                        if (!tableId) setTableId(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                                    }}
                                />
                            </div>

                            <div className="form-group">
                                <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: '#64748b' }}>Table ID</label>
                                <input
                                    className="form-input"
                                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    placeholder="table_id_name"
                                    value={tableId}
                                    onChange={(e) => setTableId(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Right Column: Columns Definition */}
                        <div style={{ flex: 1, padding: '24px' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: '#1e293b' }}>Columns Definition</h3>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
                                <table className="mapping-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc' }}>
                                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Field Name</th>
                                            <th style={{ textAlign: 'left', padding: '12px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Type</th>
                                            <th style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Required</th>
                                            <th style={{ textAlign: 'center', padding: '12px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>PK?</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fields.map((field, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px' }}>
                                                    <input
                                                        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                                                        value={field.name}
                                                        onChange={(e) => updateField(idx, {
                                                            name: e.target.value,
                                                            displayName: e.target.value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                                        })}
                                                    />
                                                </td>
                                                <td style={{ padding: '8px' }}>
                                                    <select
                                                        style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff' }}
                                                        value={field.type}
                                                        onChange={(e) => updateField(idx, { type: e.target.value as any })}
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="number">Number</option>
                                                        <option value="currency">Currency</option>
                                                        <option value="date">Date</option>
                                                        <option value="boolean">Boolean</option>
                                                        <option value="email">Email</option>
                                                    </select>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        style={{ width: '16px', height: '16px' }}
                                                        checked={field.required}
                                                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                                                    />
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '8px' }}>
                                                    <input
                                                        type="radio"
                                                        name="pk_selection"
                                                        style={{ width: '16px', height: '16px' }}
                                                        checked={primaryKey === field.name}
                                                        onChange={() => {
                                                            setPrimaryKey(field.name);
                                                            updateField(idx, { required: true, unique: true });
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <button
                                onClick={addField}
                                style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 600, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <span style={{ fontSize: '18px' }}>+</span> Add Column
                            </button>
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ padding: '20px 32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#f8fafc' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{ border: '1px solid #cbd5e1', padding: '10px 24px', borderRadius: '6px', background: '#fff', fontWeight: 600, cursor: 'pointer', color: '#475569' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        style={{ background: '#4f46e5', border: 'none', padding: '10px 24px', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                    >
                        {loading ? 'Creating...' : 'Create Table'}
                    </button>
                </div>
            </div>
        </div>
    );
}
