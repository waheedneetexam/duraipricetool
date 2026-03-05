import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import type { DataTableDefinition } from '../constants/dataManagementTables';
import { toCsv } from '../constants/dataManagementTables';

type Props = {
  table: DataTableDefinition;
  onBack?: () => void;
};

type TableResponse = {
  success: boolean;
  data: Record<string, unknown>[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export function TableManager({ table, onBack }: Props) {
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

  return (
    <section className="panel-card master-data-panel">
      <div className="table-manager-head">
        <h3>{table.displayName} Table Manager</h3>
        <div className="tenant-actions">
          {onBack && <button className="btn" onClick={onBack} type="button">Back</button>}
          <button className="btn" onClick={loadData} type="button" disabled={loading}>Refresh</button>
          <button className="btn" onClick={exportCsv} type="button">Export CSV</button>
          <button className="btn btn-danger" onClick={deleteSelected} type="button" disabled={selectedIds.length === 0}>
            Delete ({selectedIds.length})
          </button>
        </div>
      </div>

      <div className="tenant-controls">
        <label>
          Search
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in table"
          />
        </label>
        <div className="tenant-actions">
          <button
            className="btn"
            type="button"
            onClick={() => {
              setPage(1);
              void loadData();
            }}
          >
            Apply
          </button>
          <label>
            Page Size
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
      </div>

      <div className="master-table">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onChange={toggleAll} checked={rows.length > 0 && rows.every((r) => selectedIds.includes(String(r[table.primaryKey] ?? '')))} /></th>
              {table.fields.map((field) => (
                <th key={field.name}>
                  <button className="table-sort-btn" type="button" onClick={() => toggleSort(field.name)}>
                    {field.displayName} {sortBy === field.name ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = String(row[table.primaryKey] || '');
              const isEditing = editingId === id;
              return (
                <tr key={id}>
                  <td><input type="checkbox" checked={selectedIds.includes(id)} onChange={() => toggleSelected(id)} /></td>
                  {table.fields.map((field) => (
                    <td key={`${id}-${field.name}`}>
                      {isEditing ? (
                        <input
                          value={draft[field.name] ?? ''}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        />
                      ) : (
                        String(row[field.name] ?? '')
                      )}
                    </td>
                  ))}
                  <td>
                    {!isEditing && <button className="btn btn-xs" type="button" onClick={() => startEdit(row)}>Edit</button>}
                    {isEditing && <button className="btn btn-xs" type="button" onClick={saveEdit}>Save</button>}
                    {isEditing && <button className="btn btn-xs" type="button" onClick={() => setEditingId(null)}>Cancel</button>}
                    {!isEditing && <button className="btn btn-danger btn-xs" type="button" onClick={() => deleteRow(id)}>Delete</button>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={table.fields.length + 2} className="empty">{loading ? 'Loading...' : 'No records found'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="tenant-controls">
        <span className="muted">Showing page {page} of {totalPages} (total {total})</span>
        <div className="tenant-actions">
          <button className="btn" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</button>
          <button className="btn" type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
        </div>
      </div>

      <div className="form-grid">
        {table.fields.map((field) => (
          <label key={`new-${field.name}`}>
            {field.displayName}
            <input
              value={draft[field.name] ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" type="button" onClick={createRow}>Add New</button>
      </div>
      {message && <div className="error-box">{message}</div>}
    </section>
  );
}
