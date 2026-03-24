import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

/**
 * Equity curve visualization using lightweight-charts area series.
 */
export default function EquityCurve({ equity }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !equity || equity.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 400,
      layout: {
        background: { color: '#0f1117' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1e2235' },
        horzLines: { color: '#1e2235' },
      },
      rightPriceScale: { borderColor: '#2d3148' },
      timeScale: { borderColor: '#2d3148', timeVisible: true },
    });

    const areaSeries = chart.addAreaSeries({
      lineColor: '#7c8cff',
      topColor: 'rgba(124, 140, 255, 0.3)',
      bottomColor: 'rgba(124, 140, 255, 0)',
      lineWidth: 2,
    });

    // Deduplicate by time
    const seen = new Set();
    const dedupedEquity = equity
      .filter(p => { if (seen.has(p.time)) return false; seen.add(p.time); return true; })
      .sort((a, b) => a.time - b.time);

    areaSeries.setData(dedupedEquity.map(p => ({ time: p.time, value: p.value })));
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [equity]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '350px', background: '#0f1117' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '350px' }} />
    </div>
  );
}
