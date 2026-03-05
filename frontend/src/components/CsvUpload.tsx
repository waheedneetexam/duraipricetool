// CSV Upload Component
import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { parseCsv } from '../constants/dataManagementTables';

type CsvUploadProps = {
    selectedTableId: string;
    onUploadComplete: () => void;
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

export function CsvUpload({ selectedTableId, onUploadComplete }: CsvUploadProps) {
    const [columns, setColumns] = useState<FieldDef[]>([]);
    const [loadingColumns, setLoadingColumns] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({}); // table column -> csv header
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [updateDuplicates, setUpdateDuplicates] = useState(true);

    useEffect(() => {
        async function fetchColumns() {
            if (!selectedTableId) return;
            setLoadingColumns(true);
            setErrorMsg('');
            setResult(null);
            try {
                const res = await apiFetch<{ success: boolean; data: FieldDef[]; error?: string }>(
                    `/admin/tables/${selectedTableId}/columns`
                );
                if (res.success) {
                    setColumns(res.data);
                    // Reset mapping
                    const newMapping: Record<string, string> = {};
                    res.data.forEach((col) => {
                        newMapping[col.name] = ''; // Start empty
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setCsvFile(null);
            setCsvHeaders([]);
            return;
        }
        setCsvFile(file);
        try {
            const text = await file.text();
            const parsed = parseCsv(text);
            if (parsed.headers.length > 0) {
                setCsvHeaders(parsed.headers);

                // Auto-map where possible
                const newMapping = { ...mapping };
                columns.forEach((col) => {
                    const match = parsed.headers.find(h => h.toLowerCase() === col.name.toLowerCase() || h.toLowerCase() === col.displayName.toLowerCase());
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

    const handleMappingChange = (columnName: string, headerName: string) => {
        setMapping((prev) => ({ ...prev, [columnName]: headerName }));
    };

    const handleUpload = async () => {
        if (!csvFile || !selectedTableId) return;

        // Validate required fields are mapped
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

            const response = await fetch(`/api/v1/admin/tables/${selectedTableId}/upload-csv`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData,
            });

            const resText = await response.text();
            let data;
            try {
                data = JSON.parse(resText);
            } catch {
                throw new Error('Invalid JSON response from server');
            }

            if (data.success) {
                setResult(data.data);
                onUploadComplete();
                // Clear file after successful upload to prevent double submission
            } else {
                setErrorMsg(data.error || 'Upload failed');
            }
        } catch (err) {
            setErrorMsg(String(err));
        } finally {
            setUploading(false);
        }
    };

    if (loadingColumns) {
        return <div className="csv-upload-panel panel-card">Loading column mappings...</div>;
    }

    return (
        <div className="csv-upload-panel panel-card">
            <h3 style={{ marginTop: 0 }}>Advanced CSV Upload</h3>
            <p className="muted">Upload CSV and map columns to <strong>{selectedTableId}</strong> table.</p>

            <div style={{ marginBottom: '1rem' }}>
                <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
            </div>

            {csvFile && csvHeaders.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    <h4>Column Mapping</h4>
                    <table className="data-table" style={{ width: '100%', marginBottom: '1rem' }}>
                        <thead>
                            <tr>
                                <th>Table Column</th>
                                <th>Required</th>
                                <th>CSV Header</th>
                            </tr>
                        </thead>
                        <tbody>
                            {columns.map((col) => (
                                <tr key={col.name}>
                                    <td><strong>{col.displayName}</strong> <code>{col.name}</code></td>
                                    <td>{col.required ? <span style={{ color: 'var(--color-danger)' }}>Yes</span> : 'No'}</td>
                                    <td>
                                        <select
                                            value={mapping[col.name] || ''}
                                            onChange={(e) => handleMappingChange(col.name, e.target.value)}
                                            style={{ width: '100%', padding: '0.25rem' }}
                                        >
                                            <option value="">-- Ignore --</option>
                                            {csvHeaders.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={updateDuplicates}
                                onChange={(e) => setUpdateDuplicates(e.target.checked)}
                            />
                            Update existing records
                        </label>
                        <button
                            className="btn btn-primary"
                            onClick={handleUpload}
                            disabled={uploading}
                            style={{ flex: 1 }}
                        >
                            {uploading ? 'Uploading...' : 'Upload & Sync Data'}
                        </button>
                    </div>
                </div>
            )}

            {errorMsg && <div className="error-box" style={{ marginTop: '1rem' }}>{errorMsg}</div>}

            {result && (
                <div className={result.errors.length > 0 ? 'error-box' : 'ok-box'} style={{ marginTop: '1rem' }}>
                    <h4>Upload Complete</h4>
                    <p>Processed: {result.recordsProcessed}</p>
                    <p>Imported: {result.recordsImported}</p>
                    <p>Updated: {result.recordsUpdated}</p>
                    <p>Skipped: {result.recordsSkipped}</p>
                    {result.warnings.length > 0 && <p>Warnings: {result.warnings.length}</p>}
                    {result.errors.length > 0 && (
                        <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '0.5rem', background: 'rgba(0,0,0,0.05)', padding: '0.5rem' }}>
                            <strong>Errors (first 10):</strong><br />
                            {result.errors.slice(0, 10).map((err, i) => (
                                <span key={i}>Row {err.row ?? '?'} {err.field ? `[${err.field}]` : ''}: {err.message}<br /></span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
