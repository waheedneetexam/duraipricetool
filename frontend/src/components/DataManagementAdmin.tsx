import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { DataTableDefinition } from '../constants/dataManagementTables';
import { TableManager } from './TableManager';
import { CsvUpload } from './CsvUpload';
import { CreateTableModal } from './CreateTableModal';
import { DATA_CLASSIFICATION } from '../data/dataClassification';

type SchemasResponse = { success: boolean; data: Record<string, DataTableDefinition> };
type StatsResponse = { success: boolean; data: { totalRecords: number; lastUpdated: string | null } };

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
      <div className="panel-card" style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'var(--shadow-sm)' }}>
        <div className="title-block">
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Data Management Admin</h3>
          <p style={{ color: '#64748b', fontSize: '14px' }}>Manage {tableList.length} master data tables with CRUD, CSV import, and validation.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
            <input
              className="form-input"
              placeholder="Search tables..."
              style={{ width: '240px', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
          </div>
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
            >
              <option value="all">All Classifications</option>
              {CATEGORY_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Filter by database classification</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ background: '#4f46e5', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span style={{ fontSize: '18px' }}>+</span> New Table
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: 600, fontSize: '14px' }}>
            System <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Grid */}
      <div className="admin-data-grid" style={{ gridTemplateColumns: '260px 1fr 340px' }}>
        {/* Column 1: Sidebar Navigation */}
        <aside className="admin-data-sidebar" style={{ overflowY: 'auto' }}>
          <div className="admin-sidebar-head">
            <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
              <input
                className="btn btn-xs"
                placeholder="Filter..."
                style={{ flex: 1, height: '32px', fontSize: '12px' }}
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
              <button className="btn btn-xs" title="Manage Tables">⚙️</button>
            </div>
          </div>
          <div className="admin-sidebar-list">
            {filteredTableList.map((table) => {
              const stats = statsByTable[table.id];
              return (
                <div
                  key={table.id}
                  className={`sidebar-item sidebar-item-hover ${selectedTableId === table.id ? 'active' : ''}`}
                  onClick={() => setSelectedTableId(table.id)}
                >
                  <div className="sidebar-item-label">
                    <span>{table.isDynamic ? '✨' : '🗄️'}</span>
                    <span>{table.displayName}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{categoryLabel[getEffectiveCategory(table.id)] ?? 'Uncategorized'}</span>
                  {table.isDynamic && (
                    <button
                      className="btn btn-xs"
                      style={{ padding: '0 4px', background: 'transparent', border: 'none', color: 'inherit', opacity: 0.5 }}
                      onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                    >
                      &times;
                    </button>
                  )}
                  {!table.isDynamic && <span className="status-dot online"></span>}

                  {/* Hover Tooltip */}
                  <div className="sidebar-tooltip">
                    <div style={{ fontWeight: 700, marginBottom: '8px', borderBottom: '1px solid var(--line)', paddingBottom: '6px' }}>
                      {table.isDynamic ? '✨' : '🗄️'} {table.displayName} {table.isDynamic && '(Dynamic)'}
                    </div>
                    <div className="metadata-item"><label>Total Records:</label><strong>{stats?.totalRecords ?? 0}</strong></div>
                    <div className="metadata-item"><label>Primary Key:</label><strong>🔑 {table.primaryKey}</strong></div>
                    <div className="metadata-item"><label>Last Updated:</label><strong style={{ fontSize: '11px' }}>{stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Column 2: Main Data Workspace (Data Grid) */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, minHeight: 0, gap: '12px' }}>
          <div className="panel-card" style={{ padding: '16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Database Classification</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Assign a category to the selected table.
                </p>
              </div>
              <span style={{ fontSize: '12px', color: '#0f172a' }}>{categoryLabel[getEffectiveCategory(selectedTableId)] ?? 'Uncategorized'}</span>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select
                value={classificationDraft}
                onChange={(e) => setClassificationDraft(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              >
                {CATEGORY_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                className="btn btn-primary btn-xs"
                onClick={updateTableCategory}
                disabled={categorySaving || classificationDraft === getEffectiveCategory(selectedTableId)}
                style={{ padding: '8px 14px', borderRadius: '8px' }}
              >
                {categorySaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {selectedTable && (
            <TableManager
              table={selectedTable}
              embedded={true}
              onDataLoad={reloadStats}
            />
          )}
        </div>

        {/* Column 4: CSV Import & Validation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', paddingRight: '4px' }}>
          <CsvUpload
            selectedTableId={selectedTableId}
            onUploadComplete={reloadStats}
            embedded={true}
          />
        </div>
      </div>

      {showCreateModal && (
        <CreateTableModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadSchemas}
        />
      )}

      {message && <div className="error-box" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>{message}</div>}
    </div>
  );
}
