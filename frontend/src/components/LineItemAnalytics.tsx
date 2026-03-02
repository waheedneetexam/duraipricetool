import ReactECharts from 'echarts-for-react';
import type { PricingLineItem } from '../api/types';

type Props = { item: PricingLineItem };

export function LineItemAnalytics({ item }: Props) {
  const priceBreakdown = {
    xAxis: { type: 'category', data: ['List', 'Discounted', 'Net', 'Cost'] },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: [
          item.listPrice,
          item.listPrice * (1 - item.volumeDiscount / 100),
          item.netPrice,
          item.cost
        ],
        itemStyle: { color: '#2563eb' }
      }
    ]
  };

  const sensitivityData = [10, 25, 50, 75, 100, 150, 200].map((qty) => {
    const discountedPrice = item.listPrice * (1 - item.volumeDiscount / 100);
    const totalBeforeRebate = discountedPrice * qty;
    const totalAfterRebate = totalBeforeRebate - item.rebate;
    const margin = totalAfterRebate > 0 ? ((totalAfterRebate - item.cost * qty) / totalAfterRebate) * 100 : 0;
    return { qty, revenue: totalAfterRebate, margin };
  });

  const volumeSensitivity = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: sensitivityData.map((x) => x.qty) },
    yAxis: [{ type: 'value' }, { type: 'value' }],
    series: [
      { type: 'line', data: sensitivityData.map((x) => x.revenue), yAxisIndex: 0, smooth: true, name: 'Revenue' },
      { type: 'line', data: sensitivityData.map((x) => x.margin), yAxisIndex: 1, smooth: true, name: 'Margin %' }
    ]
  };

  return (
    <div className="line-analytics">
      <div className="metric-row">
        <div className="metric-card"><span>Revenue</span><strong>${item.totalValue.toFixed(2)}</strong></div>
        <div className="metric-card"><span>Profit</span><strong>${(item.totalValue - item.cost * item.quantity).toFixed(2)}</strong></div>
        <div className="metric-card"><span>Margin</span><strong>{item.margin.toFixed(2)}%</strong></div>
        <div className="metric-card"><span>Units</span><strong>{item.quantity}</strong></div>
      </div>
      <div className="analytics-grid">
        <div className="panel-card"><h4>Price Breakdown</h4><ReactECharts option={priceBreakdown} style={{ height: 220 }} /></div>
        <div className="panel-card"><h4>Volume Sensitivity</h4><ReactECharts option={volumeSensitivity} style={{ height: 220 }} /></div>
      </div>
    </div>
  );
}
