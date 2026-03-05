import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, hasPermission, uploadCsv } from '../api/client';
import { DataManagementAdmin } from './DataManagementAdmin';
import type {
  AIPricingProcessResult,
  FieldLogicRule,
  FieldLogicValidationResult,
  TenantLineItemConfig,
} from '../api/types';
import { DEFAULT_LINE_ITEM_COLUMNS, DEFAULT_LINE_ITEM_KEYS } from '../constants/lineItemColumns';
import type { LineItemColumnConfig as ColumnConfig } from '../constants/lineItemColumns';
import { FormulaBuilderAdmin } from './FormulaBuilderAdmin';
import { UserManagementAdmin } from './UserManagementAdmin';
import { PlatformManagementAdmin } from './PlatformManagementAdmin';
import { AuditLogAdmin } from './AuditLogAdmin';

type ImportResult = { status: 'ok' | 'error'; message: string };
type AdminTab = 'data' | 'table' | 'logic' | 'ai' | 'formula' | 'users' | 'platform' | 'audit';
type Props = { tenantId: string; tenantName?: string };

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

const FIELD_TYPES = ['text', 'number', 'currency', 'percent', 'date', 'select', 'textarea', 'checkbox', 'calculated'];

export function AdminScreen({ tenantId, tenantName }: Props) {
  const [adminTab, setAdminTab] = useState<AdminTab>('table');
  const [file, setFile] = useState<File | null>(null);
  const [mappingJson, setMappingJson] = useState(JSON.stringify(DEFAULT_MAPPING, null, 2));
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [lineItemConfig, setLineItemConfig] = useState<ColumnConfig[]>(DEFAULT_LINE_ITEM_COLUMNS);
  const [configValidationSummary, setConfigValidationSummary] = useState('');
  const [newColumnKey, setNewColumnKey] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState('text');
  const [newColumnFormula, setNewColumnFormula] = useState('');

  const [logicScope, setLogicScope] = useState('line_item');
  const [logicFieldKey, setLogicFieldKey] = useState('');
  const [logicText, setLogicText] = useState('');
  const [logicExplanation, setLogicExplanation] = useState('');
  const [logicValidation, setLogicValidation] = useState<FieldLogicValidationResult | null>(null);
  const [logicRules, setLogicRules] = useState<FieldLogicRule[]>([]);

  const [aiTemplate, setAiTemplate] = useState(`company_info:
  name: "My Company"
  industry: "General"
line_item_fields:
  - name: "quantity"
    type: "number"
    required: true
PricingRules: []`);
  const [aiResult, setAiResult] = useState<AIPricingProcessResult | null>(null);
  const canAdminManage = hasPermission('admin.manage');
  const canManageUsers = hasPermission('tenant.users.manage');
  const canManagePlatform = hasPermission('platform.tenants.manage');
  const canReadAudit = hasPermission('tenant.audit.read') || hasPermission('platform.audit.read');

  useEffect(() => {
    void loadLineItemConfig();
    void loadFieldLogicRules();
  }, [tenantId]);

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
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
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
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
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
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
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
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
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
        '/admin/line-item-config'
      );
      if (response.success) {
        setLineItemConfig(response.data.columns.map((col, idx) => ({ ...col, sortOrder: col.sortOrder ?? idx })));
      }
      setConfigValidationSummary('');
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function validateLineItemConfig() {
    if (!canAdminManage) {
      setConfigValidationSummary('You do not have admin.manage permission.');
      return;
    }
    setLoading(true);
    try {
      const payloadColumns = lineItemConfig.map((col) => ({
        key: col.key,
        label: col.label,
        visible: col.visible,
        mandatory: col.mandatory,
        editable: col.editable,
        is_calculated: col.isCalculated,
        formula: col.formula,
        field_type: col.fieldType ?? (col.isCalculated ? 'calculated' : 'text'),
        default_value: col.defaultValue ?? null,
        width: col.width ?? null,
        options: col.options ?? [],
        validation: col.validation ?? {},
        description: col.description ?? '',
        category: col.category ?? ''
      }));
      const response = await apiFetch<{ success: boolean; data: { isValid: boolean; errors: Array<{ field: string; message: string }>; warnings: Array<{ field: string; message: string }> } }>(
        '/admin/line-item-config/validate',
        {
          method: 'POST',
          body: JSON.stringify({ columns: payloadColumns })
        }
      );
      const messages = [
        response.data.isValid ? 'Validation passed.' : 'Validation failed.',
        ...response.data.errors.map((item) => `Error: ${item.message}`),
        ...response.data.warnings.map((item) => `Warning: ${item.message}`)
      ];
      setConfigValidationSummary(messages.join(' '));
    } catch (err) {
      setConfigValidationSummary(`Validation error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveLineItemConfig() {
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data?: TenantLineItemConfig; error?: string }>(
        '/admin/line-item-config',
        {
          method: 'PUT',
          body: JSON.stringify({
            columns: lineItemConfig.map((col, idx) => ({
              key: col.key,
              label: col.label,
              visible: col.visible,
              mandatory: col.mandatory,
              editable: col.editable,
              is_calculated: col.isCalculated,
              formula: col.formula,
              field_type: col.fieldType ?? (col.isCalculated ? 'calculated' : 'text'),
              default_value: col.defaultValue ?? null,
              width: col.width ?? null,
              options: col.options ?? [],
              validation: col.validation ?? {},
              description: col.description ?? '',
              category: col.category ?? '',
              sortOrder: idx
            }))
          })
        }
      );
      if (!response.success) {
        setResult({ status: 'error', message: response.error || 'Save failed' });
        return;
      }
      if (response.data) {
        setLineItemConfig(response.data.columns);
        setResult({ status: 'ok', message: `Saved table config for tenant "${response.data.tenantId}".` });
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

  function updateColumnField(
    key: string,
    field: 'label' | 'formula' | 'fieldType' | 'description' | 'category' | 'defaultValue' | 'width',
    value: string
  ) {
    setLineItemConfig((prev) =>
      prev.map((col) =>
        col.key === key
          ? {
            ...col,
            [field]: field === 'width' ? (value ? Number(value) : null) : value
          }
          : col
      )
    );
  }

  function updateColumnCalculated(key: string, calculated: boolean) {
    setLineItemConfig((prev) =>
      prev.map((col) =>
        col.key === key
          ? {
            ...col,
            isCalculated: calculated,
            editable: calculated ? false : col.editable,
            formula: calculated ? col.formula : '',
            fieldType: calculated ? 'calculated' : col.fieldType || 'text'
          }
          : col
      )
    );
  }

  function moveColumn(key: string, direction: -1 | 1) {
    setLineItemConfig((prev) => {
      const idx = prev.findIndex((col) => col.key === key);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const cloned = [...prev];
      const [target] = cloned.splice(idx, 1);
      cloned.splice(nextIdx, 0, target);
      return cloned.map((col, index) => ({ ...col, sortOrder: index }));
    });
  }

  function removeColumn(key: string) {
    setLineItemConfig((prev) => prev.filter((col) => col.key !== key).map((col, idx) => ({ ...col, sortOrder: idx })));
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

  async function validateFieldLogic() {
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: FieldLogicValidationResult }>('/admin/field-logic/validate', {
        method: 'POST',
        body: JSON.stringify({
          scope: logicScope,
          field_key: logicFieldKey,
          logic_text: logicText
        })
      });
      setLogicValidation(response.data);
      setLogicExplanation(
        response.data.status === 'valid'
          ? 'Validation passed. Review generated code and save.'
          : 'Validation found blocking issues. Fix errors and retry.'
      );
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function saveFieldLogic() {
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data?: { logicId: string; version: number }; error?: string }>(
        '/admin/field-logic/save',
        {
          method: 'POST',
          body: JSON.stringify({
            scope: logicScope,
            field_key: logicFieldKey,
            logic_text: logicText,
            generated_code: logicValidation?.generatedCode || '',
            explanation: logicExplanation,
            dependencies: logicValidation?.dependencies || {}
          })
        }
      );
      if (!response.success) {
        setResult({ status: 'error', message: response.error || 'Unable to save field logic' });
        return;
      }
      setResult({ status: 'ok', message: `Field logic saved. Version ${response.data?.version ?? 1}.` });
      await loadFieldLogicRules();
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function loadFieldLogicRules() {
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data: FieldLogicRule[] }>(
        '/admin/field-logic/list'
      );
      if (response.success) {
        setLogicRules(response.data);
      }
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function processAiTemplate() {
    if (!canAdminManage) {
      setResult({ status: 'error', message: 'You do not have admin.manage permission.' });
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch<{ success: boolean; data?: AIPricingProcessResult; error?: string }>(
        '/admin/ai-pricing/process-template',
        {
          method: 'POST',
          body: JSON.stringify({
            template_text: aiTemplate
          })
        }
      );
      if (!response.success || !response.data) {
        setResult({ status: 'error', message: response.error || 'AI processing failed' });
        return;
      }
      setAiResult(response.data);
      setResult({ status: 'ok', message: `AI template processed. Confidence ${response.data.confidence}%.` });
    } catch (err) {
      setResult({ status: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="screen">
      <div className="screen-head admin-screen-header">
        <div className="title-block">
          <h2>Admin <span style={{ color: 'var(--primary)' }}>Configuration</span></h2>
          <p>Orchestrate global settings, logic rules, and data intelligence.</p>
        </div>
        <div className="admin-tab-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={adminTab === 'table' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('table')} type="button">Table Manager</button>
          <button className={adminTab === 'logic' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('logic')} type="button">Field Logic</button>
          <button className={adminTab === 'ai' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('ai')} type="button">AI Pricing</button>
          {canManageUsers && <button className={adminTab === 'users' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('users')} type="button">Users</button>}
          {canManagePlatform && <button className={adminTab === 'platform' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('platform')} type="button">Platform</button>}
          {canReadAudit && <button className={adminTab === 'audit' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('audit')} type="button">Audit Log</button>}
          <button className={adminTab === 'data' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('data')} type="button">Data</button>
          <button className={adminTab === 'formula' ? 'btn btn-primary' : 'btn'} onClick={() => setAdminTab('formula')} type="button">Formula</button>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            onClick={runSyncOnce}
            disabled={loading || !canAdminManage}
            type="button"
            style={{ background: 'var(--primary)', fontWeight: 'bold' }}
          >
            {loading ? 'Syncing...' : 'Run Sync (Postgres to DuckDB)'}
          </button>
        </div>
      </div>


      {adminTab === 'table' && (
        <div className="panel-card admin-column-config">
          <div className="table-manager-head">
            <h3>Line Item Table Manager</h3>
            <div className="tenant-actions">
              <button className="btn" type="button" onClick={validateLineItemConfig} disabled={loading || !canAdminManage}>Validate</button>
              <button className="btn btn-primary" type="button" onClick={saveLineItemConfig} disabled={loading || !canAdminManage}>Save</button>
            </div>
          </div>
          {configValidationSummary && <div className="info-box">{configValidationSummary}</div>}
          <table className="admin-config-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Key</th>
                <th>Label</th>
                <th>Type</th>
                <th>Width</th>
                <th>Visible</th>
                <th>Required</th>
                <th>Editable</th>
                <th>Formula</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItemConfig.map((col, idx) => {
                const isDefaultColumn = DEFAULT_LINE_ITEM_KEYS.includes(col.key);
                return (
                  <tr key={col.key}>
                    <td>{idx + 1}</td>
                    <td>{col.key}</td>
                    <td><input value={col.label} onChange={(e) => updateColumnField(col.key, 'label', e.target.value)} /></td>
                    <td>
                      <select
                        value={col.isCalculated ? 'calculated' : col.fieldType || 'text'}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateColumnCalculated(col.key, value === 'calculated');
                          updateColumnField(col.key, 'fieldType', value);
                        }}
                      >
                        {FIELD_TYPES.map((fieldType) => <option key={fieldType} value={fieldType}>{fieldType}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={col.width ?? ''}
                        onChange={(e) => updateColumnField(col.key, 'width', e.target.value)}
                        min={60}
                      />
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
                        disabled={col.isCalculated}
                        onChange={(e) => updateColumnFlag(col.key, 'editable', e.target.checked)}
                      />
                    </td>
                    <td>
                      {col.isCalculated ? (
                        <input
                          value={col.formula}
                          onChange={(e) => updateColumnField(col.key, 'formula', e.target.value)}
                          placeholder="quantity * listPrice"
                        />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="config-row-actions">
                        <button className="btn btn-xs" type="button" onClick={() => moveColumn(col.key, -1)} disabled={idx === 0 || !canAdminManage}>Up</button>
                        <button className="btn btn-xs" type="button" onClick={() => moveColumn(col.key, 1)} disabled={idx === lineItemConfig.length - 1 || !canAdminManage}>Down</button>
                        {isDefaultColumn ? (
                          <span className="muted">default</span>
                        ) : (
                          <button className="btn btn-danger btn-xs" type="button" disabled={!canAdminManage} onClick={() => removeColumn(col.key)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="tenant-controls">
            <label>
              New field key
              <input value={newColumnKey} onChange={(e) => setNewColumnKey(e.target.value)} placeholder="commissionRate" />
            </label>
            <label>
              New field label
              <input value={newColumnLabel} onChange={(e) => setNewColumnLabel(e.target.value)} placeholder="Commission %" />
            </label>
            <label>
              Type
              <select value={newColumnType} onChange={(e) => setNewColumnType(e.target.value)}>
                {FIELD_TYPES.map((fieldType) => <option key={fieldType} value={fieldType}>{fieldType}</option>)}
              </select>
            </label>
            {newColumnType === 'calculated' && (
              <label>
                Formula
                <input value={newColumnFormula} onChange={(e) => setNewColumnFormula(e.target.value)} placeholder="listPrice * 0.1" />
              </label>
            )}
            <button
              className="btn"
              type="button"
              disabled={!newColumnKey.trim() || !newColumnLabel.trim() || !canAdminManage}
              onClick={() => {
                const key = newColumnKey.trim();
                if (lineItemConfig.some((col) => col.key === key)) {
                  setResult({ status: 'error', message: `Field "${key}" already exists.` });
                  return;
                }
                setLineItemConfig((prev) => [
                  ...prev,
                  {
                    key,
                    label: newColumnLabel.trim(),
                    visible: true,
                    mandatory: false,
                    editable: newColumnType !== 'calculated',
                    isCalculated: newColumnType === 'calculated',
                    formula: newColumnType === 'calculated' ? newColumnFormula : '',
                    sortOrder: prev.length,
                    fieldType: newColumnType,
                    width: 140,
                    defaultValue: '',
                    options: [],
                    validation: {},
                    description: '',
                    category: ''
                  }
                ]);
                setNewColumnKey('');
                setNewColumnLabel('');
                setNewColumnFormula('');
                setNewColumnType('text');
              }}
            >
              Add Field
            </button>
          </div>
        </div>
      )}

      {adminTab === 'logic' && (
        <div className="admin-layout">
          <div className="panel-card">
            <h3>Field Logic Manager</h3>
            <div className="form-grid">
              <label>
                Tenant / Client
                <input value={tenantName || tenantId} readOnly />
              </label>
              <label>
                Scope
                <select value={logicScope} onChange={(e) => setLogicScope(e.target.value)}>
                  <option value="line_item">line_item</option>
                  <option value="header">header</option>
                </select>
              </label>
              <label>
                Field Key
                <input value={logicFieldKey} onChange={(e) => setLogicFieldKey(e.target.value)} placeholder="netPrice" />
              </label>
            </div>
            <label>
              Natural Language Logic
              <textarea rows={7} value={logicText} onChange={(e) => setLogicText(e.target.value)} />
            </label>
            <label>
              Explanation / Notes
              <textarea rows={3} value={logicExplanation} onChange={(e) => setLogicExplanation(e.target.value)} />
            </label>
            <div className="form-actions">
              <button className="btn" type="button" onClick={loadFieldLogicRules} disabled={loading || !canAdminManage}>Load Logic Rules</button>
              <button className="btn" type="button" onClick={validateFieldLogic} disabled={loading || !canAdminManage}>Validate & Generate</button>
              <button className="btn btn-primary" type="button" onClick={saveFieldLogic} disabled={loading || !logicValidation || logicValidation.status !== 'valid' || !canAdminManage}>
                Save Logic
              </button>
            </div>
            {logicValidation && (
              <div className={logicValidation.status === 'valid' ? 'ok-box' : 'error-box'}>
                <p><strong>Status:</strong> {logicValidation.status} ({logicValidation.severity})</p>
                {logicValidation.errors.length > 0 && <p><strong>Errors:</strong> {logicValidation.errors.map((x) => x.message).join(' | ')}</p>}
                {logicValidation.warnings.length > 0 && <p><strong>Warnings:</strong> {logicValidation.warnings.map((x) => x.message).join(' | ')}</p>}
                <p><strong>Dependencies:</strong> tables[{logicValidation.dependencies.tables.join(', ')}] columns[{logicValidation.dependencies.columns.join(', ')}]</p>
                <pre>{logicValidation.generatedCode}</pre>
              </div>
            )}
          </div>
          <div className="panel-card">
            <h3>Saved Logic Rules</h3>
            {logicRules.length === 0 && <p className="muted">No rules saved for this tenant.</p>}
            {logicRules.map((rule) => (
              <div key={rule.logicId} className="logic-rule-card">
                <p><strong>{rule.scope}.{rule.fieldKey}</strong> v{rule.version} {rule.active ? '(active)' : '(inactive)'}</p>
                <p className="muted">{rule.logicText}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminTab === 'users' && <UserManagementAdmin tenantId={tenantId} />}
      {adminTab === 'platform' && <PlatformManagementAdmin />}
      {adminTab === 'audit' && <AuditLogAdmin />}

      {adminTab === 'ai' && (
        <div className="panel-card">
          <h3>AI Pricing Engine (Template Processor)</h3>
          <p className="muted">Paste YAML pricing requirements. The server performs structured processing and saves artifacts.</p>
          <textarea rows={14} value={aiTemplate} onChange={(e) => setAiTemplate(e.target.value)} />
          <div className="form-actions">
            <button className="btn btn-primary" type="button" onClick={processAiTemplate} disabled={loading || !canAdminManage}>Process Template</button>
          </div>
          {aiResult && (
            <div className="ok-box">
              <p><strong>Status:</strong> {aiResult.status}</p>
              <p><strong>Confidence:</strong> {aiResult.confidence}%</p>
              <p><strong>Summary:</strong> {aiResult.summary}</p>
            </div>
          )}
        </div>
      )
      }

      {adminTab === 'formula' && <FormulaBuilderAdmin />}



      {adminTab === 'data' && <DataManagementAdmin />}

      {result && <div className={result.status === 'ok' ? 'ok-box' : 'error-box'}>{result.message}</div>}
    </section >
  );
}
