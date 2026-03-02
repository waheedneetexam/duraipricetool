import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import ReactECharts from 'echarts-for-react';
import { apiFetch } from '../api/client';
import type { QuoteLine, QuoteRequest } from '../api/types';

type QuoteResponse = {
  quote_id: string;
  status: string;
  totals: { total_list_price: number; total_net_price: number; total_cost: number; total_margin: number };
  embedded_analytics: {
    historical_trend: { month: string; avg_net_price: number }[];
    mini_waterfall: { steps: { step: string; value: number }[] };
  };
};

type WorkflowResponse = { allowed: boolean; next_state: string; required_approver_role?: string | null; reason: string };

const BASE_LINE_ITEMS: QuoteLine[] = [
  {
    quote_line_id: 'QL-1001',
    sku: 'SKU-1001',
    quantity: 10,
    list_price: 1200,
    discount_percent: 0.1,
    cost: 700,
    dynamic_fields: { band: 'Gold' }
  },
  {
    quote_line_id: 'QL-1002',
    sku: 'SKU-2001',
    quantity: 25,
    list_price: 550,
    discount_percent: 0.08,
    cost: 320,
    dynamic_fields: { band: 'Silver' }
  }
];

export function QuotePanel() {
  const [quoteId, setQuoteId] = useState('Q-UI-001');
  const [customerId, setCustomerId] = useState('CustomerA');
  const [customerName, setCustomerName] = useState('Customer A Holdings');
  const [segment, setSegment] = useState('Enterprise');
  const [headerFields, setHeaderFields] = useState<Record<string, string>>({ deal_type: 'Renewal', region_owner: 'NA-East' });
  const [lineItems, setLineItems] = useState<QuoteLine[]>(BASE_LINE_ITEMS);
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [response, setResponse] = useState<QuoteResponse | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowResponse | null>(null);
  const [error, setError] = useState('');

  const columns = useMemo<ColDef<QuoteLine>[]>(
    () => [
      { field: 'quote_line_id', headerName: 'Line ID', editable: true, width: 120 },
      { field: 'sku', headerName: 'SKU', editable: true, width: 120 },
      { field: 'quantity', headerName: 'Qty', editable: true, width: 90, type: 'numericColumn' },
      { field: 'list_price', headerName: 'List Price', editable: true, width: 120, type: 'numericColumn' },
      { field: 'discount_percent', headerName: 'Discount %', editable: true, width: 120, type: 'numericColumn' },
      { field: 'cost', headerName: 'Cost', editable: true, width: 110, type: 'numericColumn' },
      {
        headerName: 'Band',
        valueGetter: (params) => String(params.data?.dynamic_fields?.band ?? ''),
        valueSetter: (params) => {
          const next = { ...(params.data?.dynamic_fields ?? {}) };
          next.band = params.newValue;
          params.data!.dynamic_fields = next;
          return true;
        },
        editable: true,
        width: 120
      }
    ],
    []
  );

  function onCellValueChanged() {
    setLineItems((prev) => [...prev]);
  }

  function addLine() {
    const index = lineItems.length + 1;
    setLineItems((prev) => [
      ...prev,
      {
        quote_line_id: `QL-${1000 + index}`,
        sku: `SKU-${3000 + index}`,
        quantity: 1,
        list_price: 100,
        discount_percent: 0,
        cost: 50,
        dynamic_fields: {}
      }
    ]);
  }

  function addHeaderField() {
    if (!newHeaderKey.trim()) return;
    setHeaderFields((prev) => ({ ...prev, [newHeaderKey.trim()]: newHeaderValue }));
    setNewHeaderKey('');
    setNewHeaderValue('');
  }

  async function calculateQuote() {
    setError('');
    const payload: QuoteRequest = {
      header: {
        quote_id: quoteId,
        customer_id: customerId,
        customer_name: customerName,
        customer_segment: segment,
        header_fields: headerFields
      },
      line_items: lineItems,
      formulas: [
        { target_field: 'net_price', expression: 'list_price * (1 - discount_percent)' },
        { target_field: 'margin', expression: '(net_price - cost) * quantity' }
      ]
    };

    try {
      const data = await apiFetch<QuoteResponse>('/quotes/calculate', { method: 'POST', body: JSON.stringify(payload) });
      setResponse(data);
    } catch (err) {
      setError(String(err));
    }
  }

  async function evaluateWorkflow() {
    setError('');
    const maxDiscount = Math.max(...lineItems.map((line) => line.discount_percent));
    try {
      const data = await apiFetch<WorkflowResponse>('/quotes/workflow/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          quote_id: quoteId,
          customer_id: customerId,
          customer_segment: segment,
          discount_percent: maxDiscount,
          current_state: 'Draft',
          requested_state: 'Pending Approval'
        })
      });
      setWorkflow(data);
    } catch (err) {
      setError(String(err));
    }
  }

  const miniWaterfall = {
    xAxis: { type: 'category', data: response?.embedded_analytics.mini_waterfall.steps.map((x) => x.step) ?? [] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: response?.embedded_analytics.mini_waterfall.steps.map((x) => x.value) ?? [], itemStyle: { color: '#dc2626' } }]
  };

  const miniTrend = {
    xAxis: { type: 'category', data: response?.embedded_analytics.historical_trend.map((x) => x.month) ?? [] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, data: response?.embedded_analytics.historical_trend.map((x) => x.avg_net_price) ?? [], lineStyle: { color: '#0ea5e9' } }]
  };

  return (
    <section className="panel quote-layout">
      <div className="quote-main card">
        <div className="row-wrap">
          <input value={quoteId} onChange={(e) => setQuoteId(e.target.value)} placeholder="Quote ID" />
          <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="Customer ID" />
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer Name" />
          <input value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="Segment" />
          <button onClick={addLine}>Add Line</button>
          <button onClick={calculateQuote}>Calculate Quote</button>
          <button onClick={evaluateWorkflow}>Evaluate Workflow</button>
        </div>

        <div className="ag-theme-quartz" style={{ height: 360, width: '100%' }}>
          <AgGridReact rowData={lineItems} columnDefs={columns} onCellValueChanged={onCellValueChanged} suppressMovableColumns />
        </div>
      </div>

      <aside className="quote-side">
        <div className="card">
          <h3>Dynamic Header Fields</h3>
          {Object.entries(headerFields).map(([k, v]) => (
            <div key={k} className="row split"><span>{k}</span><span>{v}</span></div>
          ))}
          <div className="row-wrap">
            <input value={newHeaderKey} onChange={(e) => setNewHeaderKey(e.target.value)} placeholder="field" />
            <input value={newHeaderValue} onChange={(e) => setNewHeaderValue(e.target.value)} placeholder="value" />
            <button onClick={addHeaderField}>Add</button>
          </div>
        </div>

        <div className="card">
          <h3>Embedded Mini Waterfall</h3>
          <ReactECharts option={miniWaterfall} style={{ height: 180 }} />
        </div>

        <div className="card">
          <h3>Historical Trend</h3>
          <ReactECharts option={miniTrend} style={{ height: 180 }} />
        </div>

        {response && (
          <div className="card totals">
            <h3>Quote Totals</h3>
            <p>List: {response.totals.total_list_price.toFixed(2)}</p>
            <p>Net: {response.totals.total_net_price.toFixed(2)}</p>
            <p>Cost: {response.totals.total_cost.toFixed(2)}</p>
            <p>Margin: {response.totals.total_margin.toFixed(2)}</p>
          </div>
        )}

        {workflow && (
          <div className={`card ${workflow.allowed ? 'ok' : 'warn'}`}>
            <h3>Workflow Decision</h3>
            <p>{workflow.reason}</p>
            {workflow.required_approver_role && <p>Approver: {workflow.required_approver_role}</p>}
          </div>
        )}

        {error && <div className="card error">{error}</div>}
      </aside>
    </section>
  );
}
