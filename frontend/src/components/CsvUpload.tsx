// CSV Upload Component
import { useEffect, useState } from 'react';
import { apiFetch, getAuthSession } from '../api/client';
import { parseCsv } from '../constants/dataManagementTables';

type CsvUploadProps = {
    selectedTableId: string;
    onUploadComplete: () => void;
    embedded?: boolean;
};

type FieldDef = {
    name: string;
    displayName: string;
    type: string;
    required: boolean;
    unique: boolean;
};

type ImportResult = {
    success: boolean;
    recordsProcessed: number;
    recordsImported: number;
    recordsUpdated: number;
    recordsSkipped: number;
    errors: Array<{ row?: number; field?: string; message: string }>;
    warnings: Array<{ row?: number; field?: string; message: string }>;
};

export function CsvUpload({ selectedTableId, onUploadComplete, embedded }: CsvUploadProps) {
    const [columns, setColumns] = useState<FieldDef[]>([]);
    const [loadingColumns, setLoadingColumns] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({}); // table column -> csv header
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [updateDuplicates, setUpdateDuplicates] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [showValidationRules, setShowValidationRules] = useState(true);

    useEffect(() => {
        async function fetchColumns() {
            if (!selectedTableId) return;
            setLoadingColumns(true);
            setErrorMsg('');
            setResult(null);
            setCsvFile(null);
            setCsvHeaders([]);
            try {
                const res = await apiFetch<{ success: boolean; data: FieldDef[]; error?: string }>(
                    `/admin/tables/${selectedTableId}/columns`
                );
                if (res.success) {
                    setColumns(res.data);
                    const newMapping: Record<string, string> = {};
                    res.data.forEach((col) => {
                        newMapping[col.name] = '';
                    });
                    setMapping(newMapping);
                } else {
                    setErrorMsg(res.error || 'Failed to fetch columns');
                }
            } catch (err) {
                setErrorMsg(String(err));
            } finally {
                setLoadingColumns(false);
            }
        }
        void fetchColumns();
    }, [selectedTableId]);

    const handleFiles = async (files: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        setCsvFile(file);
        setResult(null);
        setErrorMsg('');
        try {
            const text = await file.text();
            const parsed = parseCsv(text);
            if (parsed.headers.length > 0) {
                setCsvHeaders(parsed.headers);
                const newMapping = { ...mapping };
                columns.forEach((col) => {
                    const match = parsed.headers.find(h =>
                        h.toLowerCase() === col.name.toLowerCase() ||
                        h.toLowerCase() === col.displayName.toLowerCase()
                    );
                    if (match) {
                        newMapping[col.name] = match;
                    }
                });
                setMapping(newMapping);
            }
        } catch (err) {
            setErrorMsg('Failed to parse CSV headers.');
        }
    };

    const handleUpload = async () => {
        if (!csvFile || !selectedTableId) return;
        const missingRequired = columns.filter(col => col.required && !mapping[col.name]);
        if (missingRequired.length > 0) {
            setErrorMsg(`Please map required column(s): ${missingRequired.map(c => c.displayName).join(', ')}`);
            return;
        }

        setUploading(true);
        setErrorMsg('');
        setResult(null);
        try {
            const formData = new FormData();
            formData.append('file', csvFile);
            formData.append('mapping_json', JSON.stringify(mapping));
            formData.append('update_duplicates', updateDuplicates ? 'true' : 'false');

            const session = getAuthSession();
            const response = await fetch(`/api/admin/tables/${selectedTableId}/upload-csv`, {
                method: 'POST',
                headers: {
                    ...(session?.accessToken ? { 'Authorization': `Bearer ${session.accessToken}` } : {}),
                    ...(session?.tenantId ? { 'X-Tenant-ID': session.tenantId } : {}),
                },
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                setResult(data.data);
                onUploadComplete();
            } else {
                setErrorMsg(data.error || 'Upload failed');
            }
        } catch (err) {
            setErrorMsg(String(err));
        } finally {
            setUploading(false);
        }
    };

    const containerClass = embedded ? "" : "panel-card";

    return (
        <div className={containerClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontWeight: 800 }}>Import & Validate</h3>

            <div
                className={`drag-drop-zone ${isDragging ? 'active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '24px' }}>📄</span>
                    <strong>{csvFile ? csvFile.name : 'Drag & Drop CSV File'}</strong>
                    <label className="btn btn-xs" style={{ cursor: 'pointer', background: '#fff' }}>
                        Choose File
                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
                    </label>
                    <span className="muted" style={{ fontSize: '11px' }}>(up to 10MB)</span>
                </div>
            </div>

            <div className="validation-panel">
                <div className="validation-head" onClick={() => setShowValidationRules(!showValidationRules)}>
                    <span>∨ Validation Rules</span>
                    <span>⚙️</span>
                </div>
                {showValidationRules && (
                    <div className="validation-content">
                        <div className="metadata-item">
                            <label>Schema:</label>
                            <strong>{selectedTableId}_db</strong>
                        </div>
                        <div className="metadata-item">
                            <label>NULL Check:</label>
                            <span style={{ color: '#22c55e', fontWeight: 600 }}>Enabled</span>
                        </div>
                        <div className="metadata-item">
                            <label>Duplicate Check:</label>
                            <span style={{ color: '#22c55e', fontWeight: 600 }}>Enabled</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="validation-panel">
                <div className="validation-head">
                    <span>∨ Column Mapping</span>
                    <span className="muted" style={{ fontSize: '11px' }}>Auto-detect mapping</span>
                </div>
                <div className="validation-content" style={{ padding: '4px' }}>
                    <table className="mapping-table">
                        <thead>
                            <tr>
                                <th>CSV Column Header</th>
                                <th>Expected Field</th>
                                <th>Map To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((col) => (
                                <tr key={col.name}>
                                    <td className="muted">{mapping[col.name] || '—'}</td>
                                    <td>→ <strong>{col.displayName}</strong></td>
                                    <td>
                                        <select
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
            </div>

            <button
                className="btn btn-primary"
                style={{ background: '#065f46', border: 'none', padding: '12px', fontWeight: 700 }}
                onClick={handleUpload}
                disabled={uploading || !csvFile}
            >
                {uploading ? 'Processing...' : 'Validate and Import'}
            </button>

            {errorMsg && <div className="error-box">{errorMsg}</div>}
            {result && (
                <div className={result.errors.length > 0 ? 'error-box' : 'ok-box'} style={{ fontSize: '12px' }}>
                    <strong>Import Result:</strong> {result.recordsImported} imported, {result.recordsUpdated} updated.
                    {result.errors.length > 0 && <div style={{ color: 'var(--danger)', marginTop: '4px' }}>Errors identified in {result.errors.length} rows.</div>}
                </div>
            )}
        </div>
    );
}
