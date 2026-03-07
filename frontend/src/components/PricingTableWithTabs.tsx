import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiFetch, hasPermission } from '../api/client';
import type { MasterCustomer, MasterProduct, PricingLineItem, QuoteDetail, TenantLineItemConfig } from '../api/types';
import { DEFAULT_LINE_ITEM_COLUMNS, type LineItemColumnConfig, type LineItemColumnKey } from '../constants/lineItemColumns';
import { LineItemAnalytics } from './LineItemAnalytics';

type Props = {
  quoteId?: string;
  onBack: () => void;
};

type QuoteResponse = { success: boolean; data: QuoteDetail };
type TenantLineItemConfigResponse = { success: boolean; data: TenantLineItemConfig };
type DebugRule = { scope?: string | null; field_key?: string; fieldKey?: string; generated_code?: string; generatedCode?: string };
type RuleFormulaMeta = { formula: string; hasRule: boolean };

const BASE_EDITABLE_KEYS: LineItemColumnKey[] = ['quantity', 'listPrice', 'cost', 'volumeDiscount', 'rebate'];
const SAFE_FORMULA_ALLOWED = /^[0-9a-zA-Z_\s.+\-*/()%]*$/;
const STANDARD_LINE_FIELDS = new Set([
  'productName',
  'sku',
  'quantity',
  'listPrice',
  'cost',
  'volumeDiscount',
  'rebate',
  'netPrice',
  'margin',
  'totalValue',
  'showAnalytics',
]);

function toSafeFormula(expr: string) {
  const cleaned = expr.trim();
  if (!cleaned) return '';
  return SAFE_FORMULA_ALLOWED.test(cleaned) ? cleaned : '';
}

function evaluateFormula(expression: string, context: Record<string, number>): number {
  const sanitized = toSafeFormula(expression);
  if (!sanitized) return 0;
  const keys = Object.keys(context);
  try {
    const func = new Function(...keys, `return ${sanitized};`);
    const values = keys.map((key) => Number(context[key] ?? 0));
    const result = func(...values);
    const value = Number(result);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function buildFormulaContext(line: PricingLineItem): Record<string, number> {
  const context: Record<string, number> = {
    quantity: line.quantity ?? 0,
    listPrice: line.listPrice ?? 0,
    cost: line.cost ?? 0,
    volumeDiscount: line.volumeDiscount ?? 0,
    rebate: line.rebate ?? 0,
    netPrice: line.netPrice ?? 0,
    margin: line.margin ?? 0,
    totalValue: line.totalValue ?? 0,
  };
  context.list_price = context.listPrice;
  context.discount_percent = context.volumeDiscount;
  return context;
}

function getDynamicFields(line: PricingLineItem): Record<string, unknown> {
  const dynamic: Record<string, unknown> = {};
  Object.keys(line).forEach((key) => {
    if (!STANDARD_LINE_FIELDS.has(key) && key !== 'id') {
      dynamic[key] = line[key];
    }
  });
  return dynamic;
}

function isCalculatedColumn(column: LineItemColumnConfig, formulaOverride?: string) {
  if (column.isCalculated) return true;
  return Boolean((formulaOverride || '').trim());
}

function getColumnValue(line: PricingLineItem, column: LineItemColumnConfig, formulaOverride?: string) {
  if (isCalculatedColumn(column, formulaOverride)) {
    const formula = (formulaOverride || column.formula || '').trim();
    if (!formula) {
      return line[column.key];
    }
    return evaluateFormula(formula, buildFormulaContext(line));
  }
  return line[column.key];
}

function formatColumnDisplay(value: unknown, column: LineItemColumnConfig, isCalculatedOverride?: boolean) {
  const isCalculated = isCalculatedOverride ?? column.isCalculated;
  if (isCalculated && typeof value === 'number') {
    if (column.key === 'margin') return `${value.toFixed(2)}%`;
    return `$${value.toFixed(2)}`;
  }
  if (typeof value === 'number' && ['listPrice', 'cost', 'rebate', 'totalValue'].includes(column.key)) {
    return `$${value.toFixed(2)}`;
  }
  if (typeof value === 'number' && column.key === 'margin') {
    return `${value.toFixed(2)}%`;
  }
  return typeof value === 'undefined' || value === null ? '' : String(value);
}

function emptyLine(index: number): PricingLineItem {
  return {
    id: `L-${Date.now()}-${index}`,
    productName: 'New Product',
    sku: `SKU-${Math.floor(Math.random() * 9000 + 1000)}`,
    quantity: 1,
    listPrice: 0,
    cost: 0,
    volumeDiscount: 0,
    rebate: 0,
    netPrice: 0,
    margin: 0,
    totalValue: 0,
    showAnalytics: false
  };
}

function toNumber(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isTextField(key: LineItemColumnKey): boolean {
  return key === 'productName' || key === 'sku';
}

export function PricingTableWithTabs({ quoteId, onBack }: Props) {
  const [currentQuoteId, setCurrentQuoteId] = useState(quoteId || '');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerSegment, setCustomerSegment] = useState('Enterprise');
  const [productHierarchy, setProductHierarchy] = useState('');
  const [salesOrg, setSalesOrg] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [priceList, setPriceList] = useState('');
  const [validityDate, setValidityDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [activeTab, setActiveTab] = useState<'header' | 'lineitems'>('header');
  const [lineItems, setLineItems] = useState<PricingLineItem[]>([emptyLine(1)]);
  const [lineItemColumns, setLineItemColumns] = useState<LineItemColumnConfig[]>(DEFAULT_LINE_ITEM_COLUMNS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [productCatalog, setProductCatalog] = useState<MasterProduct[]>([]);
  const [customerCatalog, setCustomerCatalog] = useState<MasterCustomer[]>([]);
  const [debugTenantId, setDebugTenantId] = useState('');
  const [debugRuleCount, setDebugRuleCount] = useState(0);
  const [debugScopeCount, setDebugScopeCount] = useState<{ line_item: number; other: number }>({ line_item: 0, other: 0 });
  const [fieldLogicRules, setFieldLogicRules] = useState<DebugRule[]>([]);
  const canWriteQuotes = hasPermission('quotes.write');

  const tenantId = useMemo(() => {
    const raw = customerId.trim();
    return raw || 'default';
  }, [customerId]);

  useEffect(() => {
    if (!quoteId) return;
    void loadQuote(quoteId);
  }, [quoteId]);

  useEffect(() => {
    void loadRuleDebug();
  }, []);

  useEffect(() => {
  const timer = setTimeout(() => {
    void loadTenantColumnConfig(tenantId);
  }, 300);
  return () => clearTimeout(timer);
}, [tenantId]);

  useEffect(() => {
    void loadProductCatalog();
  }, []);

  useEffect(() => {
    void loadCustomerCatalog();
  }, []);

  function normalizeFieldKey(key: string) {
    return key
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }

  const ruleFormulaByKey = useMemo(() => {
    const map = new Map<string, RuleFormulaMeta>();
    fieldLogicRules.forEach((rule) => {
      const fieldKeyRaw = rule.field_key || rule.fieldKey || '';
      const fieldKey = String(fieldKeyRaw || '').trim();
      if (!fieldKey) return;
      const formula = String(rule.generated_code || rule.generatedCode || '').trim();
      const setMeta = (key: string) => {
        const normalized = normalizeFieldKey(key);
        if (!normalized) return;
        map.set(normalized, { formula, hasRule: true });
      };
      setMeta(fieldKey);
      setMeta(normalizeFieldKey(fieldKey));
      // also map camelCase to snake_case target and back
      const camel = fieldKey.replace(/_([a-z])/g, (_, c) => String(c).toUpperCase());
      setMeta(camel);
      setMeta(normalizeFieldKey(camel));
    });
    return map;
  }, [fieldLogicRules]);

  function getRuleMetaForColumn(columnKey: string): RuleFormulaMeta {
    const normalized = normalizeFieldKey(columnKey);
    return ruleFormulaByKey.get(normalized) || { formula: '', hasRule: false };
  }

  function getRuleFormulaForColumn(columnKey: string) {
    return getRuleMetaForColumn(columnKey).formula || '';
  }

  const debugFormulaList = useMemo(() => {
    return lineItemColumns
      .filter((col) => {
        const ruleMeta = getRuleMetaForColumn(col.key);
        const configFormula = (col.formula || '').trim();
        return col.isCalculated || ruleMeta.hasRule || Boolean(configFormula);
      })
      .map((col) => {
        const ruleMeta = getRuleMetaForColumn(col.key);
        const configFormula = (col.formula || '').trim();
        const formula = ruleMeta.formula || configFormula;
        const source = ruleMeta.hasRule ? 'field_logic_rules' : 'line_item_config';
        return {
          key: col.key,
          label: col.label,
          formula: ruleMeta.hasRule && !ruleMeta.formula ? '' : formula,
          source,
        };
      });
  }, [lineItemColumns, ruleFormulaByKey]);

  async function loadRuleDebug() {
    try {
      const me = await apiFetch<any>('/auth/me', { method: 'GET' });
      if (me?.success && me.data?.tenant_id) {
        setDebugTenantId(String(me.data.tenant_id));
      }

      const fetchRules = async (scope?: string, allTenants = false, includeInactive = false) => {
        const params = new URLSearchParams();
        if (scope) params.set('scope', scope);
        if (allTenants) params.set('all_tenants', 'true');
        if (includeInactive) params.set('include_inactive', 'true');
        const query = params.toString() ? `?${params.toString()}` : '';
        const res = await apiFetch<any>(`/admin/field-logic/list${query}`, { method: 'GET' });
        if (!res.success || !Array.isArray(res.data)) return [] as DebugRule[];
        return res.data as DebugRule[];
      };

      let rules = await fetchRules('line_item');
      if (rules.length === 0) {
        rules = await fetchRules();
      }
      if (rules.length === 0) {
        rules = await fetchRules(undefined, true, true);
      }

      setFieldLogicRules(rules);
      const lineItemCount = rules.filter((rule: DebugRule) => (rule.scope || 'line_item') === 'line_item').length;
      const otherCount = rules.length - lineItemCount;
      setDebugRuleCount(rules.length);
      setDebugScopeCount({ line_item: lineItemCount, other: otherCount });
    } catch {
      setDebugRuleCount(0);
      setDebugScopeCount({ line_item: 0, other: 0 });
    }
  }

  async function loadQuote(id: string) {
    try {
      const response = await apiFetch<QuoteResponse>(`/quotes/${encodeURIComponent(id)}`);
      if (!response.success) return;
      const q = response.data;
      setCurrentQuoteId(q.id);
      setDescription(q.description || '');
      setCustomerName(q.customerName || '');
      setCustomerId(q.customerId || '');
      setCustomerSegment(q.customerSegment || 'Enterprise');
      setProductHierarchy(q.productHierarchy || '');
      setSalesOrg(q.salesOrg || '');
      setRegion(q.region || '');
      setCountry(q.country || '');
      setCurrency(q.currency || 'USD');
      setPriceList(q.priceList || '');
      setValidityDate(q.validityDate || '');
      setPaymentTerms(q.paymentTerms || '');
      setLineItems(q.lineItems?.length ? q.lineItems : [emptyLine(1)]);
    } catch (err) {
      setError(String(err));
    }
  }

  async function loadTenantColumnConfig(targetTenantId: string) {
    try {
      const response = await apiFetch<TenantLineItemConfigResponse>(
        `/admin/line-item-config?tenant_id=${encodeURIComponent(targetTenantId)}`
      );
      if (response.success && response.data?.columns?.length) {
        setLineItemColumns(response.data.columns as LineItemColumnConfig[]);
      } else {
        setLineItemColumns(DEFAULT_LINE_ITEM_COLUMNS);
      }
    } catch {
      setLineItemColumns(DEFAULT_LINE_ITEM_COLUMNS);
    }
  }

  async function loadProductCatalog() {
    try {
      const response = await apiFetch<{ success: boolean; data: MasterProduct[] }>('/master/products');
      if (response.success) {
        setProductCatalog(response.data ?? []);
      }
    } catch {
      setProductCatalog([]);
    }
  }

  async function loadCustomerCatalog() {
    try {
      const response = await apiFetch<{ success: boolean; data: MasterCustomer[] }>('/master/customers');
      if (response.success) {
        setCustomerCatalog(response.data ?? []);
      }
    } catch {
      setCustomerCatalog([]);
    }
  }

  function handleCustomerNameChange(value: string) {
    setCustomerName(value);
    const normalized = value.trim().toLowerCase();
    if (!normalized) return;

    const matchedCustomer = customerCatalog.find(
      (customer) => String(customer.name ?? '').trim().toLowerCase() === normalized
    );
    if (!matchedCustomer) return;

    if (matchedCustomer.customer_id) setCustomerId(matchedCustomer.customer_id);
    if (matchedCustomer.segment) setCustomerSegment(matchedCustomer.segment);
    if (matchedCustomer.region) setRegion(matchedCustomer.region);
  }

  function computeLine(line: PricingLineItem): PricingLineItem {
    const discountedPrice = line.listPrice * (1 - line.volumeDiscount / 100);
    const totalBeforeRebate = discountedPrice * line.quantity;
    const totalAfterRebate = totalBeforeRebate - line.rebate;
    const netPrice = line.quantity > 0 ? totalAfterRebate / line.quantity : 0;
    const marginPct = totalAfterRebate > 0 ? ((totalAfterRebate - line.cost * line.quantity) / totalAfterRebate) * 100 : 0;
    let updated: PricingLineItem = {
      ...line,
      netPrice,
      margin: marginPct,
      totalValue: totalAfterRebate
    };
    // Apply field_logic_rules / config formulas on top of defaults
    lineItemColumns
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .forEach((col) => {
        const formulaOverride = getRuleFormulaForColumn(col.key);
        if (!isCalculatedColumn(col, formulaOverride)) return;
        const formula = (formulaOverride || col.formula || '').trim();
        if (!formula) return;
        const value = evaluateFormula(formula, buildFormulaContext(updated));
        updated = { ...updated, [col.key]: value } as PricingLineItem;
      });
    return updated;
  }

  function applyLineFieldUpdate(line: PricingLineItem, field: LineItemColumnKey, rawValue: string): PricingLineItem {
    if (field === 'productName') {
      const matchedProduct = productCatalog.find((product) => product.name === rawValue);
      if (matchedProduct) {
        return { ...line, productName: matchedProduct.name, sku: matchedProduct.sku };
      }
      return { ...line, productName: rawValue };
    }

    if (field === 'sku') {
      return { ...line, sku: rawValue };
    }

    const value = toNumber(rawValue);
    if (BASE_EDITABLE_KEYS.includes(field)) {
      return computeLine({ ...line, [field]: value } as PricingLineItem);
    }

    if (field === 'netPrice') {
      const totalValue = value * line.quantity;
      const discountedTotal = line.listPrice * (1 - line.volumeDiscount / 100) * line.quantity;
      const rebate = discountedTotal - totalValue;
      return computeLine({ ...line, rebate } as PricingLineItem);
    }

    if (field === 'totalValue') {
      const discountedTotal = line.listPrice * (1 - line.volumeDiscount / 100) * line.quantity;
      const rebate = discountedTotal - value;
      return computeLine({ ...line, rebate } as PricingLineItem);
    }

    if (field === 'margin') {
      if (!line.totalValue || !line.quantity) return { ...line, margin: value };
      const totalCost = line.totalValue * (1 - value / 100);
      const cost = totalCost / line.quantity;
      return computeLine({ ...line, cost } as PricingLineItem);
    }

    const manualValue = isTextField(field) ? rawValue : toNumber(rawValue);
    return { ...line, [field]: manualValue };
  }

  function updateLine(id: string, field: LineItemColumnKey, value: string) {
    if (!canWriteQuotes) return;
    setLineItems((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        return applyLineFieldUpdate(line, field, value);
      })
    );
  }

  function addLine() {
    if (!canWriteQuotes) return;
    setLineItems((prev) => [...prev, emptyLine(prev.length + 1)]);
    setActiveTab('lineitems');
  }

  function removeLine(id: string) {
    if (!canWriteQuotes) return;
    setLineItems((prev) => prev.filter((x) => x.id !== id));
  }

  function toggleAnalytics(id: string) {
    setLineItems((prev) => prev.map((x) => (x.id === id ? { ...x, showAnalytics: !x.showAnalytics } : x)));
  }

  function validateMandatoryFields(): string | null {
    const mandatoryColumns = lineItemColumns.filter((col) => col.mandatory);
    for (let lineIndex = 0; lineIndex < lineItems.length; lineIndex += 1) {
      const line = lineItems[lineIndex];
      for (const col of mandatoryColumns) {
        const formulaOverride = getRuleFormulaForColumn(col.key);
        const value = getColumnValue(line, col, formulaOverride);
        if (isCalculatedColumn(col, formulaOverride)) {
          if (typeof value !== 'number' || Number.isNaN(value)) {
            return `Line ${lineIndex + 1}: "${col.label}" could not be calculated.`;
          }
        } else if (isTextField(col.key)) {
          if (!String(value ?? '').trim()) {
            return `Line ${lineIndex + 1}: "${col.label}" is mandatory.`;
          }
        } else if (value === null || value === undefined || Number.isNaN(Number(value))) {
          return `Line ${lineIndex + 1}: "${col.label}" is mandatory.`;
        }
      }
    }
    return null;
  }

  async function saveQuote() {
    if (!canWriteQuotes) {
      setError('You do not have permission to modify quotes.');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError('');
    const validationError = validateMandatoryFields();
    if (validationError) {
      setSaving(false);
      setError(validationError);
      setActiveTab('lineitems');
      return;
    }

    try {
      const response = await apiFetch<{ success: boolean; data: { id: string } }>('/quotes/save', {
        method: 'POST',
        body: JSON.stringify({
          id: currentQuoteId || null,
          description,
          customerName,
          customerId,
          customerSegment,
          productHierarchy,
          salesOrg,
          region,
          country,
          currency,
          priceList,
          validityDate,
          paymentTerms,
          lineItems: lineItems.map((line) => ({
            id: line.id,
            productName: line.productName,
            sku: line.sku,
            quantity: line.quantity,
            listPrice: line.listPrice,
            cost: line.cost,
            volumeDiscount: line.volumeDiscount,
            rebate: line.rebate
            ,
            dynamic_fields: getDynamicFields(line)
          }))
        })
      });
      if (response.success) {
        setCurrentQuoteId(response.data.id);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    return lineItems.reduce(
      (acc, line) => {
        acc.total += line.totalValue;
        acc.weightedMargin += line.margin * line.totalValue;
        return acc;
      },
      { total: 0, weightedMargin: 0 }
    );
  }, [lineItems]);

  const averageMargin = totals.total > 0 ? totals.weightedMargin / totals.total : 0;

  const availableProducts = useMemo(
    () => productCatalog.filter((product) => product.active ?? true),
    [productCatalog]
  );

  const availableCustomers = useMemo(
    () => customerCatalog.filter((customer) => customer.active ?? true),
    [customerCatalog]
  );

  const visibleColumns = useMemo(
    () => [...lineItemColumns].sort((a, b) => a.sortOrder - b.sortOrder).filter((col) => col.visible),
    [lineItemColumns]
  );

  function isColumnEditable(column: LineItemColumnConfig): boolean {
    return column.editable;
  }

  function renderCell(line: PricingLineItem, column: LineItemColumnConfig) {
    const formulaOverride = getRuleFormulaForColumn(column.key);
    const isCalculated = isCalculatedColumn(column, formulaOverride);
    const value = getColumnValue(line, column, formulaOverride);
    const editable = !isCalculated && column.editable;
    if (!editable) {
      return <td className="readonly-cell">{formatColumnDisplay(value, column, isCalculated)}</td>;
    }

    const storedValue = line[column.key];
    if (column.key === 'productName') {
      const datalistId = `product-options-${line.id}`;
      return (
        <td>
          <input
            type="text"
            list={availableProducts.length ? datalistId : undefined}
            value={String(storedValue ?? '')}
            required={column.mandatory}
            disabled={!canWriteQuotes}
            onChange={(e) => updateLine(line.id, column.key, e.target.value)}
          />
          {availableProducts.length > 0 && (
            <datalist id={datalistId}>
              {availableProducts.map((product) => (
                <option key={product.product_id} value={product.name} />
              ))}
            </datalist>
          )}
        </td>
      );
    }

    const inputType = isTextField(column.key) ? 'text' : 'number';
    return (
      <td>
        <input
          type={inputType}
          value={String(storedValue ?? '')}
          required={column.mandatory}
          disabled={!canWriteQuotes}
          onChange={(e) => updateLine(line.id, column.key, e.target.value)}
        />
      </td>
    );
  }

  return (
    <section className="screen pricing-screen">
      <div className="screen-head">
        <div className="head-stack">
          <button className="btn" onClick={onBack}>Back to Quotes</button>
          <div>
            <h2>{currentQuoteId || 'New Quote'}</h2>
            <p>Total: ${totals.total.toFixed(2)}</p>
          </div>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={addLine} disabled={!canWriteQuotes}>Add Line Item</button>
          <button className="btn btn-primary" onClick={saveQuote} disabled={saving || !canWriteQuotes}>{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Quote'}</button>
        </div>
      </div>

      <div style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
        Debug: tenant {debugTenantId || 'unknown'} • rules {debugRuleCount} • line_item {debugScopeCount.line_item} • other {debugScopeCount.other}
      </div>
      <div style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b' }}>
        {debugFormulaList.map((item) => (
          <div key={item.key} style={{ marginBottom: '4px' }}>
            {item.label} ({item.key}) → {item.formula || 'no formula'} [{item.source}]
          </div>
        ))}
      </div>

      <div className="tabbar">
        <button className={activeTab === 'header' ? 'active' : ''} onClick={() => setActiveTab('header')}>Quote Configuration</button>
        <button className={activeTab === 'lineitems' ? 'active' : ''} onClick={() => setActiveTab('lineitems')}>Line Items ({lineItems.length})</button>
      </div>

      {activeTab === 'header' && (
        <div className="content-stack">
          <div className="panel-card">
            <h3>Quote Information</h3>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} />
          </div>

          <div className="summary-grid">
            <div className="summary-card blue"><span>Total Quote Value</span><strong>${totals.total.toFixed(2)}</strong></div>
            <div className="summary-card violet"><span>Average Margin</span><strong>{averageMargin.toFixed(2)}%</strong></div>
            <div className="summary-card gray"><span>Total Line Items</span><strong>{lineItems.length}</strong></div>
          </div>

          <div className="panel-card">
            <h3>Configuration</h3>
            <div className="form-grid">
              <label>
                Customer Name
                <input
                  value={customerName}
                  list={availableCustomers.length ? 'customer-options' : undefined}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                />
                {availableCustomers.length > 0 && (
                  <datalist id="customer-options">
                    {availableCustomers.map((customer) => (
                      <option key={customer.customer_id} value={customer.name} />
                    ))}
                  </datalist>
                )}
              </label>
              <label>Customer ID<input value={customerId} onChange={(e) => setCustomerId(e.target.value)} /></label>
              <label>Customer Segment<input value={customerSegment} onChange={(e) => setCustomerSegment(e.target.value)} /></label>
              <label>Product Hierarchy<input value={productHierarchy} onChange={(e) => setProductHierarchy(e.target.value)} /></label>
              <label>Sales Organization<input value={salesOrg} onChange={(e) => setSalesOrg(e.target.value)} /></label>
              <label>Region<input value={region} onChange={(e) => setRegion(e.target.value)} /></label>
              <label>Country<input value={country} onChange={(e) => setCountry(e.target.value)} /></label>
              <label>Currency<input value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
              <label>Price List<input value={priceList} onChange={(e) => setPriceList(e.target.value)} /></label>
              <label>Validity Date<input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} /></label>
              <label>Payment Terms<input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></label>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lineitems' && (
        <div className="lineitems-wrap">
          <div style={{ marginBottom: '12px', padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', color: '#334155' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Debug: Applied Formulas</div>
            {debugFormulaList.length === 0 && <div>No calculated fields found.</div>}
            {debugFormulaList.map((item) => (
              <div key={item.key} style={{ marginBottom: '4px' }}>
                {item.label} ({item.key}) → {item.formula || (item.source === 'field_logic_rules' ? 'no generated_code' : 'no formula')} [{item.source}]
              </div>
            ))}
          </div>
          <table className="pricing-table">
            <thead>
              <tr>
                <th></th>
                {visibleColumns.map((column) => (
                  <th key={column.key}>
                    {column.label}
                    {column.mandatory ? ' *' : ''}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line) => (
                <Fragment key={line.id}>
                  <tr>
                    <td><button className="btn btn-xs" onClick={() => toggleAnalytics(line.id)}>{line.showAnalytics ? '−' : '+'}</button></td>
                    {visibleColumns.map((column) => (
                      <Fragment key={`${line.id}-${column.key}`}>{renderCell(line, column)}</Fragment>
                    ))}
                    <td><button className="btn btn-danger btn-xs" disabled={!canWriteQuotes} onClick={() => removeLine(line.id)}>Delete</button></td>
                  </tr>
                  {line.showAnalytics && (
                    <tr key={`${line.id}-analytics`}>
                      <td colSpan={visibleColumns.length + 2}><LineItemAnalytics item={line} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
    </section>
  );
}
