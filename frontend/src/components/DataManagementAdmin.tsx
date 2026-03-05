import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { DataTableDefinition } from '../constants/dataManagementTables';
import { TableManager } from './TableManager';
import { CsvUpload } from './CsvUpload';

type SchemasResponse = { success: boolean; data: Record<string, DataTableDefinition> };
type StatsResponse = { success: boolean; data: { totalRecords: number; lastUpdated: string | null } };

export function DataManagementAdmin() {
  const [schemas, setSchemas] = useState<Record<string, DataTableDefinition>>({});
  const [selectedTableId, setSelectedTableId] = useState('products');
  const [message, setMessage] = useState('');
  const [statsByTable, setStatsByTable] = useState<Record<string, { totalRecords: number; lastUpdated: string | null }>>({});
  const [sidebarSearch, setSidebarSearch] = useState('');

  const reloadStats = () => {
    if (selectedTableId) {
      loadStats(selectedTableId);
    }
  };

  useEffect(() => {
    void loadSchemas();
  }, []);

  const tableList = useMemo(() => Object.values(schemas), [schemas]);
  const filteredTableList = useMemo(() => {
    return tableList.filter(t =>
      t.displayName.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      t.id.toLowerCase().includes(sidebarSearch.toLowerCase())
    );
  }, [tableList, sidebarSearch]);

  const selectedTable = schemas[selectedTableId];
  const selectedStats = statsByTable[selectedTableId];

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
      // ignore
    }
  }

  useEffect(() => {
    tableList.forEach((table) => {
      if (!statsByTable[table.id]) {
        void loadStats(table.id);
      }
    });
  }, [tableList.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Global Header */}
      <div className="panel-card" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="title-block">
          <h3 style={{ fontWeight: 800 }}>Data Management Admin</h3>
          <p className="muted">Manage {tableList.length} master data tables with CRUD, CSV import, and validation.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              className="btn"
              placeholder="Search tables..."
              style={{ width: '220px', paddingLeft: '32px' }}
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>🔍</span>
          </div>
          <button className="btn" type="button">⚙️</button>
          <div className="status-indicator">
            System <span className="dot green"></span>
          </div>
          <div className="status-indicator">
            API <span className="dot green"></span>
          </div>
        </div>
      </div>

      {/* Main 4-Column Grid */}
      <div className="admin-data-grid">
        {/* Column 1: Sidebar Navigation */}
        <aside className="admin-data-sidebar">
          <div className="admin-sidebar-head">
            <div style={{ position: 'relative' }}>
              <input
                className="btn btn-xs"
                placeholder="Filter categories..."
                style={{ height: '32px', fontSize: '12px' }}
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px' }}>⚙️</span>
            </div>
          </div>
          <div className="admin-sidebar-list">
            {filteredTableList.map((table) => (
              <div
                key={table.id}
                className={`sidebar-item ${selectedTableId === table.id ? 'active' : ''}`}
                onClick={() => setSelectedTableId(table.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🗄️</span>
                  {table.displayName}
                </div>
                <span className="status-dot online"></span>
              </div>
            ))}
          </div>
        </aside>

        {/* Column 2: Metadata & Summary */}
        <div className="metadata-panel">
          <div className="metadata-card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <h4><span>🗄️</span> {selectedTable?.displayName} Table Manager</h4>
            <div className="metadata-item">
              <label>Total Records:</label>
              <strong>{selectedStats?.totalRecords ?? 0}</strong>
            </div>
            <div className="metadata-item">
              <label>Primary Key:</label>
              <strong>🔑 {selectedTable?.primaryKey}</strong>
            </div>
            <div className="metadata-item">
              <label>Last Updated:</label>
              <strong>{selectedStats?.lastUpdated ? new Date(selectedStats.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}</strong>
            </div>
            <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--line)', fontSize: '13px', display: 'flex', gap: '12px' }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>Nulls: 0</span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Duplicates: 0</span>
            </div>
          </div>
        </div>

        {/* Column 3: Main Data Workspace (Data Grid) */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {selectedTable && (
            <TableManager
              table={selectedTable}
              embedded={true}
              onDataLoad={reloadStats}
            />
          )}
        </div>

        {/* Column 4: CSV Import & Validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <CsvUpload
            selectedTableId={selectedTableId}
            onUploadComplete={reloadStats}
            embedded={true}
          />
        </div>
      </div>

      {message && <div className="error-box" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>{message}</div>}
    </div>
  );
}
