import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { DataTableDefinition } from '../constants/dataManagementTables';
import { toCsv } from '../constants/dataManagementTables';

type Props = {
  table: DataTableDefinition;
  onBack?: () => void;
  embedded?: boolean;
  onDataLoad?: () => void;
};

type TableResponse = {
  success: boolean;
  data: Record<string, unknown>[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export function TableManager({ table, onBack, embedded, onDataLoad }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const headers = useMemo(() => table.fields.map((f) => f.name), [table.fields]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        search,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      const response = await apiFetch<TableResponse>(`/admin/data/table/${table.id}?${params.toString()}`);
      if (response.success) {
        setRows(response.data);
        setTotal(response.pagination.total);
        onDataLoad?.();
      }
    } catch (err) {
      setMessage(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [table.id, page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    setSelectedIds([]);
  }, [table.id, page]);

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  }

  function startEdit(row: Record<string, unknown>) {
    const id = String(row[table.primaryKey] || '');
    setEditingId(id);
    const next: Record<string, string> = {};
    headers.forEach((h) => {
      next[h] = String(row[h] ?? '');
    });
    setDraft(next);
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      const payload: Record<string, unknown> = {};
      headers.forEach((h) => {
        payload[h] = draft[h];
      });
      const response = await apiFetch<{ success: boolean; error?: string }>(`/admin/data/table/${table.id}/${encodeURIComponent(editingId)}`, {
        method: 'PUT',
        body: JSON.stringify({ values: payload }),
      });
      if (!response.success) {
        setMessage(response.error || 'Save failed');
        return;
      }
      setEditingId(null);
      setDraft({});
      await loadData();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function createRow() {
    try {
      const payload: Record<string, unknown> = {};
      headers.forEach((h) => {
        payload[h] = draft[h] || '';
      });
      const response = await apiFetch<{ success: boolean; error?: string }>(`/admin/data/table/${table.id}`, {
        method: 'POST',
        body: JSON.stringify({ values: payload }),
      });
      if (!response.success) {
        setMessage(response.error || 'Create failed');
        return;
      }
      setDraft({});
      await loadData();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function deleteRow(id: string) {
    if (!window.confirm(`Delete ${id}?`)) return;
    try {
      await apiFetch(`/admin/data/table/${table.id}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      await loadData();
    } catch (err) {
      setMessage(String(err));
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected record(s)?`)) return;
    try {
      await apiFetch(`/admin/data/table/${table.id}/bulk-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      await loadData();
    } catch (err) {
      setMessage(String(err));
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    const ids = rows.map((row) => String(row[table.primaryKey] ?? ''));
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : ids);
  }

  function exportCsv() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${table.name}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const contentClass = embedded ? "master-data-panel" : "panel-card master-data-panel";

  return (
    <section className={contentClass} style={{
      padding: embedded ? 0 : '12px',
      border: embedded ? 'none' : undefined,
      background: embedded ? 'transparent' : undefined,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
    }}>
      <div className="table-manager-head" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ fontWeight: 800 }}>{table.displayName} Table Manager</h3>
        </div>
        <div className="tenant-actions">
          <button className="btn" type="button" onClick={createRow} style={{ background: '#059669', color: '#fff', border: 'none' }}>
            New {table.displayName.replace(/s$/, '')} +
          </button>
          <button className="btn" onClick={exportCsv} type="button">Export CSV</button>
          <button className="btn" onClick={loadData} type="button" disabled={loading}>🔄 Refresh</button>
          <button className="btn btn-danger" onClick={deleteSelected} type="button" disabled={selectedIds.length === 0}>
            Delete ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="panel-card" style={{
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        maxHeight: 'calc(100vh - 280px)',
      }}>
        <div className="tenant-controls" style={{ padding: '12px', borderBottom: '1px solid var(--line)', background: '#f8fafc' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              className="btn"
              placeholder="Search in table"
              style={{ width: '100%', paddingLeft: '32px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadData()}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}>🔍</span>
          </div>
          <div className="tenant-actions">
            <button className="btn" type="button">📑 Clone</button>
            <button className="btn" type="button" disabled>Bulk Actions ▾</button>
          </div>
        </div>

        <div className="master-table" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <table className="pricing-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}><input type="checkbox" onChange={toggleAll} checked={rows.length > 0 && rows.every((r) => selectedIds.includes(String(r[table.primaryKey] ?? '')))} /></th>
                {table.fields.map((field) => (
                  <th key={field.name}>
                    <button className="table-sort-btn" type="button" onClick={() => toggleSort(field.name)} style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)' }}>
                      {field.displayName} {sortBy === field.name ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </button>
                  </th>
                ))}
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const id = String(row[table.primaryKey] ?? '');
                const isEditing = editingId === id;
                const rowKey = id || `row-${index}`;
                return (
                  <tr key={rowKey}>
                    <td><input type="checkbox" checked={id !== '' && selectedIds.includes(id)} onChange={() => toggleSelected(id)} disabled={id === ''} /></td>
                    {table.fields.map((field) => (
                      <td key={`${id}-${field.name}`}>
                        {isEditing ? (
                          <input
                            className="btn btn-xs"
                            value={draft[field.name] ?? ''}
                            onChange={(e) => setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))}
                          />
                        ) : (
                          <span style={{ fontSize: '13px' }}>{String(row[field.name] ?? '')}</span>
                        )}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        {!isEditing && <button className="btn btn-xs" type="button" onClick={() => startEdit(row)}>📝 Edit</button>}
                        {isEditing && <button className="btn btn-xs" type="button" onClick={saveEdit}>💾 Save</button>}
                        {isEditing && <button className="btn btn-xs" type="button" onClick={() => setEditingId(null)}>✕</button>}
                        {!isEditing && <button className="btn btn-danger btn-xs" type="button" onClick={() => deleteRow(id)}>🗑️</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={table.fields.length + 2} className="empty" style={{ padding: '40px', textAlign: 'center' }}>
                    {loading ? 'Loading...' : 'No records found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-sidebar-head" style={{ borderTop: '1px solid var(--line)', background: '#f8fafc', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: '13px' }}>
            Showing <strong>{rows.length > 0 ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, total)}</strong> of <strong>{total}</strong>
          </span>
          <div className="tenant-actions" style={{ gap: '4px' }}>
            <button className="btn btn-xs" type="button" onClick={() => setPage(1)} disabled={page <= 1}>«</button>
            <button className="btn btn-xs" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`btn btn-xs ${page === p ? 'btn-primary' : ''}`}
                    onClick={() => setPage(p)}
                    style={{ minWidth: '28px' }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <button className="btn btn-xs" type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
            <button className="btn btn-xs" type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span className="muted">Page Size:</span>
            <select
              className="btn btn-xs"
              style={{ width: 'auto', padding: '2px 8px' }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {message && <div className="error-box" style={{ marginTop: '12px' }}>{message}</div>}
    </section>
  );
}
