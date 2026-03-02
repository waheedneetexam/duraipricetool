import { FormEvent, useState } from 'react';
import { apiFetch, uploadCsv } from '../api/client';

type Result = { status: 'ok' | 'error'; message: string };

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

export function AdminPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [mappingText, setMappingText] = useState(JSON.stringify(DEFAULT_MAPPING, null, 2));
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setResult({ status: 'error', message: 'Choose a CSV file first.' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const mapping = JSON.parse(mappingText) as Record<string, string>;
      const resp = await uploadCsv(file, mapping);
      setResult({ status: 'ok', message: `CSV ingested: ${JSON.stringify(resp)}` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function seedSampleData() {
    setLoading(true);
    try {
      const resp = await apiFetch<{ rows_inserted: number }>('/admin/seed/sample-data?row_count=10000', { method: 'POST' });
      setResult({ status: 'ok', message: `Synthetic rows inserted: ${resp.rows_inserted}` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function seedWorkflowRules() {
    setLoading(true);
    try {
      const resp = await apiFetch<{ seeded_rules: number }>('/admin/seed/workflow-rules', { method: 'POST' });
      setResult({ status: 'ok', message: `Workflow rules seeded: ${resp.seeded_rules}` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Admin & Data Integration</h2>
      <div className="admin-grid">
        <form onSubmit={handleUpload} className="card">
          <h3>Chunked CSV Upload</h3>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <label>Column Mapping JSON</label>
          <textarea value={mappingText} onChange={(e) => setMappingText(e.target.value)} rows={14} />
          <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload & Ingest'}</button>
        </form>

        <div className="card action-stack">
          <h3>Data Utilities</h3>
          <button onClick={seedSampleData} disabled={loading}>Generate 10,000+ Sample Rows</button>
          <button onClick={seedWorkflowRules} disabled={loading}>Seed Workflow Rules</button>
          <p className="hint">Customer A threshold: &gt;20% discount. Customer B threshold: &gt;10% discount.</p>
        </div>
      </div>

      {result && <div className={`result ${result.status}`}>{result.message}</div>}
    </section>
  );
}
