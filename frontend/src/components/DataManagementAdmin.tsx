import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { DataTableDefinition } from '../constants/dataManagementTables';
import { parseCsv } from '../constants/dataManagementTables';
import { TableManager } from './TableManager';
import { CsvUpload } from './CsvUpload';

type SchemasResponse = { success: boolean; data: Record<string, DataTableDefinition> };
type ImportResult = {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: Array<{ row?: number; field?: string; message: string }>;
  warnings: Array<{ row?: number; field?: string; message: string }>;
};
type StatsResponse = { success: boolean; data: { totalRecords: number; lastUpdated: string | null } };

export function DataManagementAdmin() {
  const [schemas, setSchemas] = useState<Record<string, DataTableDefinition>>({});
  const [selectedTableId, setSelectedTableId] = useState('products');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [viewTableManager, setViewTableManager] = useState(false);
  const [statsByTable, setStatsByTable] = useState<Record<string, { totalRecords: number; lastUpdated: string | null }>>({});

  const reloadStats = () => {
    if (selectedTableId) {
      loadStats(selectedTableId);
    }
  };

  useEffect(() => {
    void loadSchemas();
  }, []);

  const tableList = useMemo(() => Object.values(schemas), [schemas]);
  const selectedTable = schemas[selectedTableId];

  async function loadSchemas() {
    try {
      const response = await apiFetch<SchemasResponse>('/admin/data/table-schemas');
      if (response.success) {
        setSchemas(response.data);
        const ids = Object.keys(response.data);
        if (ids.length > 0 && !response.data[selectedTableId]) {
          setSelectedTableId(ids[0]);
        }
      }
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function loadStats(tableId: string) {
    try {
      const response = await apiFetch<StatsResponse>(`/admin/data/table/${tableId}/stats`);
      if (response.success) {
        setStatsByTable((prev) => ({ ...prev, [tableId]: response.data }));
      }
    } catch {
      // ignore cards that fail
    }
  }

  useEffect(() => {
    tableList.forEach((table) => {
      if (!statsByTable[table.id]) {
        void loadStats(table.id);
      }
    });
  }, [tableList.length]);

  async function importCsv(updateDuplicates: boolean) {
    if (!selectedTable || !csvFile) {
      setMessage('Select a table and CSV file first.');
      return;
    }
    setImportLoading(true);
    setMessage('');
    setImportResult(null);
    try {
      const text = await csvFile.text();
      const parsed = parseCsv(text);
      const response = await apiFetch<{ success: boolean; data: ImportResult; error?: string }>(`/admin/data/import/${selectedTable.id}`, {
        method: 'POST',
        body: JSON.stringify({
          data: parsed.rows,
          update_duplicates: updateDuplicates,
        }),
      });
      if (!response.success) {
        setMessage(response.error || 'Import failed');
        return;
      }
      setImportResult(response.data);
      void loadStats(selectedTable.id);
    } catch (err) {
      setMessage(String(err));
    } finally {
      setImportLoading(false);
    }
  }

  function downloadSampleCsv() {
    if (!selectedTable) return;
    const blob = new Blob([selectedTable.sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTable.name}_sample.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (selectedTable && viewTableManager) {
    return <TableManager table={selectedTable} onBack={() => setViewTableManager(false)} />;
  }

  return (
    <section className="panel-card master-data-panel">
      <h3>Data Management Admin</h3>
      <p className="muted">Manage 9 master data tables with CSV import, validation, and table manager CRUD.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start', marginBottom: '1.5rem' }}>
        <div className="tenant-controls" style={{ margin: 0, height: '100%' }}>
          <label>
            Select Table
            <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}>
              {tableList.map((table) => (
                <option key={table.id} value={table.id}>{table.displayName}</option>
              ))}
            </select>
          </label>

          <div className="tenant-actions" style={{ marginTop: '1rem' }}>
            <button className="btn" type="button" onClick={downloadSampleCsv} disabled={!selectedTable}>Download Sample CSV</button>
            <button className="btn" type="button" onClick={() => setViewTableManager(true)} disabled={!selectedTable}>Open Table Manager CRUD</button>
          </div>

          {selectedTable && (
            <div className="info-box" style={{ marginTop: '1rem' }}>
              <p><strong>{selectedTable.displayName}</strong>: {selectedTable.description}</p>
              <p><strong>Primary Key:</strong> {selectedTable.primaryKey}</p>
              {selectedTable.parentTables && selectedTable.parentTables.length > 0 && (
                <p><strong>Parent Tables:</strong> {selectedTable.parentTables.join(', ')}</p>
              )}
            </div>
          )}
        </div>

        <CsvUpload
          selectedTableId={selectedTableId}
          onUploadComplete={reloadStats}
        />
      </div>

      {importResult && (
        <div className={importResult.errors.length > 0 ? 'error-box' : 'ok-box'}>
          <p>Processed: {importResult.recordsProcessed}</p>
          <p>Imported: {importResult.recordsImported}</p>
          <p>Updated: {importResult.recordsUpdated}</p>
          <p>Skipped: {importResult.recordsSkipped}</p>
          {importResult.warnings.length > 0 && <p>Warnings: {importResult.warnings.length}</p>}
          {importResult.errors.length > 0 && (
            <p>Errors: {importResult.errors.slice(0, 10).map((err) => `Row ${err.row ?? '?'} ${err.field ?? ''}: ${err.message}`).join(' | ')}</p>
          )}
        </div>
      )}

      <div className="stats-grid">
        {tableList.map((table) => {
          const stats = statsByTable[table.id];
          return (
            <div key={table.id} className="metric-card">
              <strong>{table.displayName}</strong>
              <span>Records: {stats?.totalRecords ?? 0}</span>
              <span>Last Updated: {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : '-'}</span>
              <div className="tenant-actions">
                <button className="btn btn-xs" type="button" onClick={() => { setSelectedTableId(table.id); setViewTableManager(true); }}>View</button>
                <button className="btn btn-xs" type="button" onClick={() => { setSelectedTableId(table.id); }}>Import</button>
              </div>
            </div>
          );
        })}
      </div>
      {message && <div className="error-box">{message}</div>}
    </section>
  );
}
