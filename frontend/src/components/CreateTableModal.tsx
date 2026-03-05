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
            <div className="modal-container" style={{ width: '800px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2 style={{ margin: 0 }}>✨ Create New Table</h2>
                    <button className="btn btn-close" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body" style={{ overflowY: 'auto', padding: '24px' }}>
                    {error && <div className="error-box" style={{ marginBottom: '20px' }}>{error}</div>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="form-group">
                            <label>Display Name</label>
                            <input
                                className="btn"
                                style={{ width: '100%', textAlign: 'left', background: '#fff' }}
                                placeholder="e.g. Product Brands"
                                value={displayName}
                                onChange={(e) => {
                                    setDisplayName(e.target.value);
                                    if (!tableId) setTableId(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                                }}
                            />
                        </div>
                        <div className="form-group">
                            <label>Table ID (URL Slug)</label>
                            <input
                                className="btn"
                                style={{ width: '100%', textAlign: 'left', background: '#fff' }}
                                placeholder="e.g. product-brands"
                                value={tableId}
                                onChange={(e) => setTableId(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>Columns Definition</h3>
                        <button className="btn btn-xs btn-primary" onClick={addField}>+ Add Column</button>
                    </div>

                    <table className="mapping-table">
                        <thead>
                            <tr>
                                <th>Field Name</th>
                                <th>Type</th>
                                <th style={{ textAlign: 'center' }}>Required</th>
                                <th style={{ textAlign: 'center' }}>PK?</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((field, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <input
                                            className="btn btn-xs"
                                            style={{ width: '100%', textAlign: 'left', background: '#fff' }}
                                            value={field.name}
                                            onChange={(e) => updateField(idx, {
                                                name: e.target.value,
                                                displayName: e.target.value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                                            })}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            className="btn btn-xs"
                                            style={{ width: '100%', background: '#fff' }}
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
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={field.required}
                                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="radio"
                                            name="pk_selection"
                                            checked={primaryKey === field.name}
                                            onChange={() => {
                                                setPrimaryKey(field.name);
                                                updateField(idx, { required: true, unique: true });
                                            }}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button className="btn btn-xs" style={{ color: 'var(--danger)' }} onClick={() => removeField(idx)}>&times;</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--line)', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button className="btn" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Table 🚀'}
                    </button>
                </div>
            </div>
        </div>
    );
}
