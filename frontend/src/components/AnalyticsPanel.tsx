import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { apiFetch } from '../api/client';
import type { AnalyticsSeries, WaterfallPoint } from '../api/types';

type ChartPayload<T> = { chart_type: string; data: T[] };

export function AnalyticsPanel() {
  const [waterfall, setWaterfall] = useState<WaterfallPoint[]>([]);
  const [bar, setBar] = useState<AnalyticsSeries[]>([]);
  const [timeSeries, setTimeSeries] = useState<AnalyticsSeries[]>([]);
  const [selectedSegment, setSelectedSegment] = useState('');
  const [drilldown, setDrilldown] = useState<AnalyticsSeries[]>([]);

  useEffect(() => {
    void Promise.all([
      apiFetch<ChartPayload<WaterfallPoint>>('/analytics/waterfall').then((r) => setWaterfall(r.data)),
      apiFetch<ChartPayload<AnalyticsSeries>>('/analytics/bar').then((r) => setBar(r.data)),
      apiFetch<ChartPayload<AnalyticsSeries>>('/analytics/time-series').then((r) => setTimeSeries(r.data))
    ]);
  }, []);

  useEffect(() => {
    if (!selectedSegment) return;
    void apiFetch<{ rows: AnalyticsSeries[] }>(`/analytics/drilldown?chart_type=bar&key=${encodeURIComponent(selectedSegment)}`).then((r) => {
      setDrilldown(r.rows);
    });
  }, [selectedSegment]);

  const waterfallOption = useMemo(
    () => ({
      xAxis: { type: 'category', data: waterfall.map((x) => x.step) },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: waterfall.map((x) => x.value), itemStyle: { color: '#ea580c' } }],
      tooltip: { trigger: 'axis' }
    }),
    [waterfall]
  );

  const barOption = useMemo(
    () => ({
      xAxis: { type: 'category', data: bar.map((x) => String(x.customer_segment)) },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: bar.map((x) => Number(x.revenue)), itemStyle: { color: '#0f766e' } }],
      tooltip: { trigger: 'axis' }
    }),
    [bar]
  );

  const timeOption = useMemo(
    () => ({
      xAxis: { type: 'category', data: timeSeries.map((x) => String(x.month)) },
      yAxis: { type: 'value' },
      series: [{ type: 'line', smooth: true, data: timeSeries.map((x) => Number(x.revenue)), lineStyle: { color: '#1d4ed8' } }],
      tooltip: { trigger: 'axis' }
    }),
    [timeSeries]
  );

  return (
    <section className="panel">
      <h2>Analytics</h2>
      <div className="chart-grid">
        <div className="card"><h3>Waterfall (Price Bridge)</h3><ReactECharts option={waterfallOption} style={{ height: 240 }} /></div>
        <div className="card"><h3>Revenue by Segment</h3><ReactECharts option={barOption} style={{ height: 240 }} /></div>
        <div className="card full"><h3>Time Series Revenue</h3><ReactECharts option={timeOption} style={{ height: 240 }} /></div>
      </div>

      <div className="card">
        <h3>Drill-Down Table</h3>
        <div className="row">
          <label>Customer Segment</label>
          <select value={selectedSegment} onChange={(e) => setSelectedSegment(e.target.value)}>
            <option value="">Select segment</option>
            {bar.map((entry) => {
              const segment = String(entry.customer_segment);
              return <option key={segment} value={segment}>{segment}</option>;
            })}
          </select>
        </div>

        <div className="drill-table-wrap">
          <table className="drill-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Quote</th>
                <th>SKU</th>
                <th>Customer</th>
                <th>Qty</th>
                <th>List</th>
                <th>Discount</th>
                <th>Net</th>
                <th>Margin</th>
              </tr>
            </thead>
            <tbody>
              {drilldown.map((row, idx) => (
                <tr key={`${row.quote_id}-${idx}`}>
                  <td>{String(row.transaction_date ?? '')}</td>
                  <td>{String(row.quote_id ?? '')}</td>
                  <td>{String(row.sku ?? '')}</td>
                  <td>{String(row.customer_name ?? '')}</td>
                  <td>{String(row.quantity ?? '')}</td>
                  <td>{Number(row.list_price ?? 0).toFixed(2)}</td>
                  <td>{(Number(row.discount_percent ?? 0) * 100).toFixed(1)}%</td>
                  <td>{Number(row.net_price ?? 0).toFixed(2)}</td>
                  <td>{Number(row.margin ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
