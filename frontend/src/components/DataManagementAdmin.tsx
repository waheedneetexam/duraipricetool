import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { DataTableDefinition } from '../constants/dataManagementTables';
import { TableManager } from './TableManager';
import { CsvUpload } from './CsvUpload';
import { CreateTableModal } from './CreateTableModal';
import { DATA_CLASSIFICATION } from '../data/dataClassification';

type SchemasResponse = { success: boolean; data: Record<string, DataTableDefinition> };
type StatsResponse = { success: boolean; data: { totalRecords: number; lastUpdated: string | null } };

type TableDetailsModalProps = {
  table: DataTableDefinition;
  classification: string;
  onClose: () => void;
};

function TableDetailsModal({ table, classification, onClose }: TableDetailsModalProps) {
  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div style={{ background: "#fff", borderRadius: "18px", width: "520px", maxWidth: "90vw", padding: "32px", boxShadow: "0 25px 60px rgba(15,23,42,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em" }}>Table Details</p>
            <h3 style={{ margin: "4px 0 0", fontSize: "22px" }}>{table.displayName}</h3>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer", color: "#64748b" }} aria-label="Close modal">
            ×
          </button>
        </div>
        <p style={{ marginTop: "16px", color: "#475569", fontSize: "14px" }}>{table.description}</p>
        <div style={{ marginTop: "18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Classification</span>
            <strong style={{ fontSize: "13px" }}>{classification}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Primary Key</span>
            <strong style={{ fontSize: "13px" }}>{table.primaryKey}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Fields</span>
            <strong style={{ fontSize: "13px" }}>{table.fields.length}</strong>
          </div>
        </div>
        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-xs" style={{ background: "#e2e8f0", color: "#0f172a", padding: "8px 16px", borderRadius: "10px" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

type TableRecordsModalProps = {
  table: DataTableDefinition;
  onClose: () => void;
  onDataLoad: () => void;
};

function TableRecordsModal({ table, onClose, onDataLoad }: TableRecordsModalProps) {
  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
      <div style={{ width: "90vw", maxWidth: "1000px", maxHeight: "85vh", overflowY: "auto", background: "#fff", borderRadius: "20px", padding: "24px", boxShadow: "0 30px 70px rgba(15,23,42,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8", textTransform: "uppercase" }}>Table Data</p>
            <h3 style={{ margin: "4px 0 0", fontSize: "20px" }}>{table.displayName}</h3>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: "24px", cursor: "pointer", color: "#475569" }} aria-label="Close records modal">
            ×
          </button>
        </div>
        <TableManager table={table} embedded={false} onDataLoad={onDataLoad} />
      </div>
    </div>
  );
}

export function DataManagementAdmin() {
  const [schemas, setSchemas] = useState<Record<string, DataTableDefinition>>({});
  const [selectedTableId, setSelectedTableId] = useState('products');
  const [message, setMessage] = useState('');
  const [statsByTable, setStatsByTable] = useState<Record<string, { totalRecords: number; lastUpdated: string | null }>>({});
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tableCategories, setTableCategories] = useState<Record<string, string>>({});
  const [classificationDraft, setClassificationDraft] = useState('master_data');
  const [categorySaving, setCategorySaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showTableModal, setShowTableModal] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [rulesOpen, setRulesOpen] = useState(true);
  const [mappingOpen, setMappingOpen] = useState(true);

  const reloadStats = () => {
    if (selectedTableId) {
      loadStats(selectedTableId);
    }
  };

  useEffect(() => {
    void loadSchemas();
  }, []);

  useEffect(() => {
    void loadTableClassifications();
  }, []);

  const tableList = useMemo(() => Object.values(schemas), [schemas]);
  const fallbackCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(DATA_CLASSIFICATION).forEach(([cat, tables]) => {
      tables.forEach((tableName) => {
        map[tableName] = cat;
      });
    });
    return map;
  }, []);

  const categoryLabel: Record<string, string> = {
    master_data: 'Master Data',
    transactional_data: 'Transactional Data',
    configuration_data: 'Configuration Data',
    metadata: 'Metadata',
    organization_data: 'Organization Data',
  };

  const CATEGORY_OPTIONS = Object.entries(categoryLabel).map(([value, label]) => ({ value, label }));

  const getEffectiveCategory = (tableId: string) => tableCategories[tableId] || fallbackCategoryMap[tableId] || 'master_data';

  const filteredTableList = useMemo(() => {
    return tableList.filter((t) => {
      const matchesSearch =
        t.displayName.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
        t.id.toLowerCase().includes(sidebarSearch.toLowerCase());
      const category = getEffectiveCategory(t.id);
      const matchesCategory = selectedCategory === 'all' ? true : category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [tableList, sidebarSearch, selectedCategory, tableCategories, fallbackCategoryMap]);

  const categoryBreakdown = useMemo(() => {
    const copy: Record<string, number> = {};
    filteredTableList.forEach((t) => {
      const cat = getEffectiveCategory(t.id);
      copy[cat] = (copy[cat] ?? 0) + 1;
    });
    return Object.entries(categoryLabel).map(([key, label]) => ({
      key,
      label,
      count: copy[key] ?? 0,
    }));
  }, [filteredTableList, tableCategories, fallbackCategoryMap]);

  const selectedTable = schemas[selectedTableId];
  const selectedStats = statsByTable[selectedTableId];

  useEffect(() => {
    if (!selectedTableId) return;
    setClassificationDraft(getEffectiveCategory(selectedTableId));
  }, [selectedTableId, tableCategories, fallbackCategoryMap]);

  async function loadSchemas() {
    try {
      const response = await apiFetch<SchemasResponse>('/admin/data/table-schemas');
      if (response.success) {
        setSchemas(response.data);
        const ids = Object.keys(response.data);
        if (ids.length > 0 && (!selectedTableId || !response.data[selectedTableId])) {
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

  async function deleteTable(tableId: string) {
    if (!window.confirm(`Are you sure you want to delete the table "${schemas[tableId]?.displayName}"? All data will be lost.`)) return;

    try {
      const res = await apiFetch<{ success: boolean; error?: string }>(`/admin/data/table-schemas/${tableId}`, {
        method: 'DELETE'
      });
      if (res.success) {
        await loadSchemas();
        setSelectedTableId(Object.keys(schemas)[0]);
      } else {
        alert(res.error || 'Failed to delete table');
      }
    } catch (err) {
      alert(String(err));
    }
  }

  async function loadTableClassifications() {
    try {
      const response = await apiFetch<{ success: boolean; data: Record<string, string> }>('/admin/data/table-classifications');
      if (response.success) {
        setTableCategories(response.data);
      }
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function updateTableCategory() {
    if (!selectedTableId) return;
    setCategorySaving(true);
    try {
      const response = await apiFetch<{ success: boolean; error?: string }>(`/admin/data/table-classifications/${encodeURIComponent(selectedTableId)}`, {
        method: 'PUT',
        body: JSON.stringify({ category: classificationDraft }),
      });
      if (response.success) {
        await loadTableClassifications();
        setMessage('Table classification updated.');
      } else {
        setMessage(response.error || 'Failed to update classification.');
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      setCategorySaving(false);
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
      <div
        className="panel-card"
        style={{
          padding: '24px 32px',
          background: '#0f172a',
          borderRadius: '20px',
          color: '#f8fafc',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: '18px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '12px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#94a3b8' }}>Home / Data Management / {selectedTable?.displayName ?? 'Product Hierarchies'}</p>
            <h1 style={{ margin: '6px 0 0', fontSize: '32px', fontWeight: 700 }}>Table: {selectedTable?.displayName ?? 'Product Hierarchies'}</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ background: '#0ea5e9', borderRadius: '10px', padding: '12px 20px' }}>Save</button>
            <button className="btn btn-ghost" style={{ borderRadius: '10px', padding: '12px 20px', borderColor: '#d1d5db', color: '#fff' }} onClick={() => setShowRecordsModal(true)} disabled={!selectedTable}>View Data</button>
          </div>
        </div>
        <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Search tables..."
            style={{ width: '220px', padding: '8px 12px', borderRadius: '10px', border: '1px solid #475569', background: '#111827', color: '#fff' }}
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #475569', background: '#111827', color: '#fff' }}
          >
            <option value="all">All classifications</option>
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          {categoryBreakdown.map(({ key, label, count }) => (
            <div key={key} style={{ padding: '12px 16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', background: '#111827' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#a5b4fc' }}>{label}</p>
              <p style={{ margin: '6px 0 0', fontSize: '18px', fontWeight: 700 }}>{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div className="admin-data-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '18px' }}>
        <aside className="admin-data-sidebar" style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 20px 64px rgba(15,23,42,0.08)', padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '16px' }}>Tables</h4>
            <span style={{ fontSize: '11px', color: '#475569' }}>{filteredTableList.length}/{tableList.length}</span>
          </div>
          <div>
            <input
              className="form-input"
              placeholder="Search..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }}
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
          </div>
          <div className="admin-sidebar-list">
            {filteredTableList.map((table) => {
              const stats = statsByTable[table.id];
              const category = categoryLabel[getEffectiveCategory(table.id)] ?? 'Uncategorized';
              return (
                <div
                  key={table.id}
                  className={`sidebar-item sidebar-item-hover ${selectedTableId === table.id ? 'active' : ''}`}
                  onClick={() => setSelectedTableId(table.id)}
                  style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', padding: '12px 14px', borderRadius: '12px', border: selectedTableId === table.id ? '1px solid #4f46e5' : '1px solid transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{table.isDynamic ? '✨' : '🗄️'}</span>
                      <strong>{table.displayName}</strong>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{category}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#475569' }}>
                    <span>Records: {stats?.totalRecords ?? 0}</span>
                    <span>PK: {table.primaryKey}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px' }}>{selectedTable?.displayName ?? 'Select a table'}</h3>
              <p style={{ margin: '4px 0 0', color: '#475569' }}>{selectedTable?.description ?? 'Choose a table to view schema, stats, and import controls.'}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-xs" style={{ background: '#eef2ff', color: '#312e81' }} onClick={() => setShowTableModal(true)}>View details</button>
              <button className="btn btn-xs" onClick={reloadStats}>Refresh</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Total fields', value: selectedTable?.fields.length ?? 0 },
              { label: 'Classification', value: categoryLabel[getEffectiveCategory(selectedTableId)] ?? 'Uncategorized' },
              { label: 'Last update', value: statsByTable[selectedTableId]?.lastUpdated ? new Date(statsByTable[selectedTableId]!.lastUpdated!).toLocaleString() : '—' },
            ].map((card) => (
              <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{card.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 600, color: '#0f172a' }}>{card.value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#fff', borderRadius: '18px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step 1 · Database Classification</p>
                  <h4 style={{ margin: '6px 0 4px', fontSize: '18px' }}>{selectedTable?.displayName ?? 'Select a table'}</h4>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '12px', color: '#0f172a' }}>Last update: {statsByTable[selectedTableId]?.lastUpdated ? new Date(statsByTable[selectedTableId]!.lastUpdated!).toLocaleString() : '—'}</span>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-xs" style={{ borderRadius: '10px', border: '1px solid #cbd5e1' }} onClick={() => setShowTableModal(true)}>Preview schema</button>
                    <button className="btn btn-xs" style={{ borderRadius: '10px' }} onClick={() => setShowRecordsModal(true)} disabled={!selectedTableId}>View data</button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '14px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={classificationDraft}
                  onChange={(e) => setClassificationDraft(e.target.value)}
                  style={{ flex: '1 1 240px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                >
                  {CATEGORY_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  onClick={updateTableCategory}
                  disabled={categorySaving || classificationDraft === getEffectiveCategory(selectedTableId)}
                  style={{ borderRadius: '10px', padding: '10px 18px' }}
                >
                  {categorySaving ? 'Saving...' : 'Save'}
                </button>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Schema integrity', 'Quality rules', 'Authorization'].map((tag) => (
                    <span key={tag} style={{ background: '#eef2ff', color: '#312e81', padding: '6px 12px', borderRadius: '999px', fontSize: '12px' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '18px', padding: '24px', border: '1px dashed #94a3b8', boxShadow: '0 8px 30px rgba(15,23,42,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step 2 · Import & Validate</p>
                  <h4 style={{ margin: '6px 0 0', fontSize: '20px' }}>Primary focal point</h4>
                </div>
                <span className="status-dot online" />
              </div>
              <div style={{ minHeight: '160px', borderRadius: '16px', border: '2px dashed #64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: '#475569', fontSize: '15px', background: '#f8fafc' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8">
                  <path d="M12 4v12"></path>
                  <path d="M6 10l6-6 6 6"></path>
                  <path d="M5 18h14"></path>
                </svg>
                <strong style={{ fontSize: '16px', color: '#0f172a' }}>{uploadedFileName ? `File uploaded: ${uploadedFileName}` : 'Drag & Drop or Click to Upload Data File'}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Limit: 100MB · CSV / Excel / JSON</span>
                <CsvUpload
                  selectedTableId={selectedTableId}
                  onUploadComplete={(name) => {
                    setUploadedFileName(name);
                    reloadStats();
                  }}
                  embedded={true}
                />
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: '18px', padding: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step 3 · Validation Progress</p>
                  <h4 style={{ margin: '6px 0 0', fontSize: '18px' }}>Validation rules & mapping</h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#475569' }}>
                  {['Validate', 'Map Columns', 'Import'].map((step, idx) => (
                    <span key={step} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: idx === 0 ? '#0ea5e9' : '#64748b' }}>●</strong>
                      {step}
                      {idx < 2 && <span style={{ margin: '0 6px' }}>→</span>}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setRulesOpen(!rulesOpen)}>
                    <span style={{ fontWeight: 600 }}>Validation rules</span>
                    <span>{rulesOpen ? '−' : '+'}</span>
                  </div>
                  {rulesOpen && (
                    <ul style={{ marginTop: '10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      {[
                        { id: 1, label: 'Null check', status: 'Pending' },
                        { id: 2, label: 'Duplicate check', status: 'Ready' },
                      ].map((rule) => (
                        <li key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{rule.id}. {rule.label}</span>
                          <span style={{ fontSize: '11px', color: '#10b981' }}>{rule.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setMappingOpen(!mappingOpen)}>
                    <span style={{ fontWeight: 600 }}>Mapping</span>
                    <span>{mappingOpen ? '−' : '+'}</span>
                  </div>
                  {mappingOpen && (
                    <ul style={{ marginTop: '10px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      {[
                        { name: 'Product SKU', target: 'sku' },
                        { name: 'Region', target: 'region_id' },
                      ].map((map) => (
                        <li key={map.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{map.name}</span>
                          <span>{map.target}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary btn-xs">Validate and Prepare Import</button>
                <button className="btn btn-xs">Clear Form</button>
              </div>
            </div>
          </div>
          {selectedTable && (
            <div style={{ background: '#fff', borderRadius: '18px', padding: '16px', border: '1px solid #e2e8f0' }}>
              <TableManager table={selectedTable} embedded={true} onDataLoad={reloadStats} />
            </div>
          )}
        </div>

      </div>

      {showCreateModal && (
        <CreateTableModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadSchemas}
        />
      )}

      {message && (
        <div
          className="error-box"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '320px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span>{message}</span>
          <button
            className="btn btn-xs"
            style={{ background: 'transparent', border: 'none', fontSize: '16px', lineHeight: 1 }}
            onClick={() => setMessage('')}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {showTableModal && selectedTable && (
        <TableDetailsModal
          table={selectedTable}
          classification={categoryLabel[getEffectiveCategory(selectedTableId)] ?? 'Uncategorized'}
          onClose={() => setShowTableModal(false)}
        />
      )}
      {showRecordsModal && selectedTable && (
        <TableRecordsModal
          table={selectedTable}
          onClose={() => setShowRecordsModal(false)}
          onDataLoad={reloadStats}
        />
      )}
    </div>
  );
}
