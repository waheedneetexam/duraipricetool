import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, uploadCsv } from '../api/client';
import type { TenantLineItemConfig } from '../api/types';
import { DEFAULT_LINE_ITEM_COLUMNS, DEFAULT_LINE_ITEM_KEYS } from '../constants/lineItemColumns';
import type { LineItemColumnConfig as ColumnConfig } from '../constants/lineItemColumns';
import { MasterDataManager } from './MasterDataManager';

type ImportResult = { status: 'ok' | 'error'; message: string };

const DEFAULT_MAPPING = {
  transaction_date: 'transaction_date',
  sku: 'sku',
  product_family: 'product_family',
  customer_id: 'customer_id',
  customer_name: 'customer_name',
  customer_segment: 'customer_segment',
  region: 'region',
  list_price: 'list_price',
  discount_percent: 'discount_percent',
  net_price: 'net_price',
  cost: 'cost',
  quantity: 'quantity',
  quote_id: 'quote_id',
  sales_rep: 'sales_rep',
  currency: 'currency'
};

export function AdminScreen() {
  const [file, setFile] = useState<File | null>(null);
  const [mappingJson, setMappingJson] = useState(JSON.stringify(DEFAULT_MAPPING, null, 2));
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState('default');
  const [lineItemConfig, setLineItemConfig] = useState<ColumnConfig[]>(DEFAULT_LINE_ITEM_COLUMNS);
  const [newColumnKey, setNewColumnKey] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState<'manual' | 'calculated'>('manual');
  const [newColumnFormula, setNewColumnFormula] = useState('');

  useEffect(() => {
    void loadLineItemConfig();
  }, []);

  const sampleCsv = useMemo(
    () =>
      [
        'transaction_date,sku,product_family,customer_id,customer_name,customer_segment,region,list_price,discount_percent,net_price,cost,quantity,quote_id,sales_rep,currency',
        '2026-01-02,SKU-1001,Compute,CUST-0001,Customer 0001,Enterprise,NA,1200,0.12,1056,700,25,Q-11111,rep_9,USD',
        '2026-01-07,SKU-2040,Storage,CUST-0002,Customer 0002,Mid-Market,EMEA,440,0.08,404.8,280,80,Q-22222,rep_4,EUR'
      ].join('\n'),
    []
  );

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setResult({ status: 'error', message: 'Please choose a CSV file.' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const mapping = JSON.parse(mappingJson) as Record<string, string>;
      const response = await uploadCsv(file, mapping);
      setResult({ status: 'ok', message: `Import completed: ${JSON.stringify(response)}` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function generateFakeData() {
    setLoading(true);
    try {
      const response = await apiFetch<{ rows_inserted: number }>('/admin/seed/sample-data?row_count=10000', { method: 'POST' });
      setResult({ status: 'ok', message: `Generated ${response.rows_inserted} synthetic rows.` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function seedWorkflow() {
    setLoading(true);
    try {
      const response = await apiFetch<{ seeded_rules: number }>('/admin/seed/workflow-rules', { method: 'POST' });
      setResult({ status: 'ok', message: `Seeded ${response.seeded_rules} workflow rules.` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function runSyncOnce() {
    setLoading(true);
    try {
      const response = await apiFetch<{ status: string; total_rows_synced?: number; reason?: string; tables?: Record<string, number> }>(
        '/admin/sync/run-once',
        { method: 'POST' }
      );
      if (response.status === 'ok') {
        setResult({
          status: 'ok',
          message: `Sync completed. Rows synced: ${response.total_rows_synced ?? 0}. Table details: ${JSON.stringify(
            response.tables ?? {}
          )}`
        });
      } else {
        setResult({ status: 'error', message: `Sync skipped: ${response.reason ?? 'Unknown reason'}` });
      }
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function loadLineItemConfig() {
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: TenantLineItemConfig }>(
        `/admin/line-item-config?tenant_id=${encodeURIComponent(tenantId || 'default')}`
      );
      if (response.success) {
        setLineItemConfig(
          response.data.columns.map((col) => ({
            ...col,
            formula: col.formula ?? ''
          }))
        );
        setResult({ status: 'ok', message: `Loaded line-item config for tenant "${response.data.tenantId}".` });
      }
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function saveLineItemConfig() {
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: TenantLineItemConfig }>(
        `/admin/line-item-config?tenant_id=${encodeURIComponent(tenantId || 'default')}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            columns: lineItemConfig.map((col) => ({
              key: col.key,
              label: col.label,
              visible: col.visible,
              mandatory: col.mandatory,
              editable: col.editable,
              is_calculated: col.isCalculated,
              formula: col.formula,
            }))
          })
        }
      );
      if (response.success) {
        setLineItemConfig(response.data.columns);
        setResult({ status: 'ok', message: `Saved line-item config for tenant "${response.data.tenantId}".` });
      }
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  function updateColumnFlag(key: string, flag: 'visible' | 'mandatory' | 'editable', value: boolean) {
    setLineItemConfig((prev) => prev.map((col) => (col.key === key ? { ...col, [flag]: value } : col)));
  }

  function updateColumnField(key: string, field: 'label' | 'formula', value: string) {
    setLineItemConfig((prev) => prev.map((col) => (col.key === key ? { ...col, [field]: value } : col)));
  }

  function updateColumnCalculated(key: string, calculated: boolean) {
    setLineItemConfig((prev) =>
      prev.map((col) =>
        col.key === key
          ? {
              ...col,
              isCalculated: calculated,
              editable: calculated ? false : col.editable,
              formula: calculated ? col.formula : ''
            }
          : col
      )
    );
  }

  function removeColumn(key: string) {
    setLineItemConfig((prev) => prev.filter((col) => col.key !== key));
  }

  function downloadSampleCsv() {
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historical-transactions-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="screen">
      <div className="screen-head">
        <div>
          <h2>Data Management Admin</h2>
          <p>Import historical transactions and seed reference data</p>
        </div>
      </div>

      <div className="admin-layout">
        <form className="panel-card" onSubmit={handleUpload}>
          <h3>CSV Upload</h3>
          <p className="muted">Chunked ingestion for large files. Map your columns to the historical transaction schema.</p>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <label>Column Mapping JSON</label>
          <textarea value={mappingJson} onChange={(e) => setMappingJson(e.target.value)} rows={14} />
          <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Importing...' : 'Upload & Import'}</button>
        </form>

        <div className="panel-card">
          <h3>Utilities</h3>
          <button className="btn" onClick={downloadSampleCsv}>Download Sample CSV Template</button>
          <button className="btn" onClick={generateFakeData} disabled={loading}>Generate 10,000 Sample Rows</button>
          <button className="btn" onClick={seedWorkflow} disabled={loading}>Seed Workflow Rules</button>
          <button className="btn btn-primary" onClick={runSyncOnce} disabled={loading}>Run Sync (Postgres to DuckDB)</button>
          <div className="info-box">
            <p><strong>Customer A:</strong> VP approval for discounts &gt; 20%</p>
            <p><strong>Customer B:</strong> VP approval for discounts &gt; 10%</p>
          </div>
        </div>

        <div className="panel-card admin-column-config">
          <h3>Line Item Column Config (Per Tenant)</h3>
          <div className="tenant-controls">
            <label>
              Tenant / Client ID
              <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="default" />
            </label>
            <div className="tenant-actions">
              <button className="btn" type="button" onClick={loadLineItemConfig} disabled={loading}>Load</button>
              <button className="btn btn-primary" type="button" onClick={saveLineItemConfig} disabled={loading}>Save</button>
            </div>
          </div>

          <table className="admin-config-table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Label</th>
                <th>Visible</th>
                <th>Mandatory</th>
                <th>Editable</th>
                <th>Type</th>
                <th>Formula</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {lineItemConfig.map((col) => {
                const isDefaultColumn = DEFAULT_LINE_ITEM_KEYS.includes(col.key);
                return (
                  <tr key={col.key}>
                    <td>{col.key}</td>
                  <td>
                    <input value={col.label} onChange={(e) => updateColumnField(col.key, 'label', e.target.value)} />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={(e) => updateColumnFlag(col.key, 'visible', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={col.mandatory}
                      onChange={(e) => updateColumnFlag(col.key, 'mandatory', e.target.checked)}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={col.editable}
                      onChange={(e) => updateColumnFlag(col.key, 'editable', e.target.checked)}
                      disabled={col.isCalculated}
                    />
                  </td>
                  <td>
                    <select
                      value={col.isCalculated ? 'calculated' : 'manual'}
                      onChange={(e) => updateColumnCalculated(col.key, e.target.value === 'calculated')}
                    >
                      <option value="manual">Manual</option>
                      <option value="calculated">Calculated</option>
                    </select>
                  </td>
                  <td>
                    {col.isCalculated ? (
                      <input
                        value={col.formula}
                        onChange={(e) => updateColumnField(col.key, 'formula', e.target.value)}
                        placeholder="formula"
                      />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {isDefaultColumn ? (
                      <span className="muted">default</span>
                    ) : (
                      <button
                        className="btn btn-danger btn-xs"
                        type="button"
                        onClick={() => removeColumn(col.key)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
          <div className="tenant-actions">
            <label>
              New column key
              <input value={newColumnKey} onChange={(e) => setNewColumnKey(e.target.value)} placeholder="commissionRate" />
            </label>
            <label>
              Label
              <input value={newColumnLabel} onChange={(e) => setNewColumnLabel(e.target.value)} placeholder="Commission %" />
            </label>
            <label>
              Type
              <select value={newColumnType} onChange={(e) => setNewColumnType(e.target.value as 'manual' | 'calculated')}>
                <option value="manual">Manual</option>
                <option value="calculated">Calculated</option>
              </select>
            </label>
            {newColumnType === 'calculated' && (
              <label>
                Formula
                <input
                  value={newColumnFormula}
                  onChange={(e) => setNewColumnFormula(e.target.value)}
                  placeholder="listPrice * 0.1"
                />
              </label>
            )}
            <button
              className="btn"
              type="button"
              disabled={!newColumnKey || !newColumnLabel}
              onClick={() => {
                if (!newColumnKey.trim()) return;
                const exists = lineItemConfig.some((col) => col.key === newColumnKey);
                if (exists) {
                  setResult({ status: 'error', message: `Column key "${newColumnKey}" already exists.` });
                  return;
                }
                setLineItemConfig((prev) => [
                  ...prev,
                  {
                    key: newColumnKey,
                    label: newColumnLabel,
                    visible: true,
                    mandatory: false,
                    editable: newColumnType === 'manual',
                    isCalculated: newColumnType === 'calculated',
                    formula: newColumnType === 'calculated' ? newColumnFormula : '',
                    sortOrder: prev.length,
                  }
                ]);
                setNewColumnKey('');
                setNewColumnLabel('');
                setNewColumnFormula('');
                setNewColumnType('manual');
              }}
            >
              Add Column
            </button>
          </div>
          <p className="muted">Changes are loaded at runtime in the Line Items screen based on tenant/client ID.</p>
        </div>
      </div>

      <MasterDataManager />

      {result && <div className={result.status === 'ok' ? 'ok-box' : 'error-box'}>{result.message}</div>}
    </section>
  );
}
