import { useEffect, useState } from 'react';
import { apiFetch, getAuthSession } from '../api/client';
import { parseCsv } from '../constants/dataManagementTables';
import { MappingModal } from './MappingModal';

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
    const [showMappingModal, setShowMappingModal] = useState(false);

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
            console.error('CSV Parse Error:', err);
            setErrorMsg(`Failed to parse CSV headers: ${String(err)}`);
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
    const mappedCount = Object.values(mapping).filter(v => !!v).length;
    const totalFields = columns.length;

    return (
        <div className={containerClass} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontWeight: 800 }}>Import & Validate</h4>

            <div
                className={`drag-drop-zone ${isDragging ? 'active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px' }}>📄</span>
                    <strong style={{ fontSize: '13px' }}>{csvFile ? csvFile.name : 'Drag & Drop CSV File'}</strong>
                    <label className="btn btn-xs" style={{ cursor: 'pointer', background: '#fff', padding: '4px 8px' }}>
                        Choose File
                        <input type="file" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
                    </label>
                    <span className="muted" style={{ fontSize: '10px' }}>(up to 10MB)</span>
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
                <div className="validation-head" style={{ cursor: 'pointer' }} onClick={() => csvHeaders.length > 0 && setShowMappingModal(true)}>
                    <span>∨ Column Mapping</span>
                    <button className="btn btn-xs" disabled={csvHeaders.length === 0} style={{ padding: '2px 8px' }}>
                        Configure ⚙️
                    </button>
                </div>
                <div className="validation-content" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <span className="muted">Mapped Fields:</span>
                        <strong>{mappedCount} / {totalFields}</strong>
                    </div>
                    {csvHeaders.length === 0 && (
                        <p className="muted" style={{ fontSize: '11px', marginTop: '8px', fontStyle: 'italic' }}>
                            Upload a CSV file to configure mapping.
                        </p>
                    )}
                </div>
            </div>

            <button
                className={`btn btn-primary ${(!csvFile || mappedCount === 0) ? 'disabled' : ''}`}
                style={{
                    background: (uploading || !csvFile || mappedCount === 0) ? '#94a3b8' : '#065f46',
                    border: 'none',
                    padding: '10px',
                    fontWeight: 700,
                    cursor: (uploading || !csvFile || mappedCount === 0) ? 'not-allowed' : 'pointer',
                    opacity: (uploading || !csvFile || mappedCount === 0) ? 0.7 : 1,
                    transition: 'all 0.2s'
                }}
                onClick={() => {
                    if (!csvFile) {
                        setErrorMsg('Please select a CSV file first.');
                        return;
                    }
                    if (mappedCount === 0) {
                        setErrorMsg('Please configure column mapping.');
                        setShowMappingModal(true);
                        return;
                    }
                    handleUpload();
                }}
                disabled={uploading}
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

            {showMappingModal && (
                <MappingModal
                    columns={columns}
                    csvHeaders={csvHeaders}
                    initialMapping={mapping}
                    onSave={(newMapping) => setMapping(newMapping)}
                    onClose={() => setShowMappingModal(false)}
                />
            )}
        </div>
    );
}
