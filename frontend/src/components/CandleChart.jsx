import { useEffect, useRef, useState } from 'react';
import { ColorType, createChart } from 'lightweight-charts';

function calculateSma(data, period) {
  const out = [];
  let sum = 0;

  for (let i = 0; i < data.length; i += 1) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) {
      out.push({ time: data[i].time, value: Number((sum / period).toFixed(2)) });
    }
  }

  return out;
}

function calculateEma(data, period) {
  if (!data.length) return [];
  const alpha = 2 / (period + 1);
  const out = [];
  let ema = data[0].close;

  for (let i = 0; i < data.length; i += 1) {
    ema = i === 0 ? data[i].close : alpha * data[i].close + (1 - alpha) * ema;
    if (i >= period - 1) {
      out.push({ time: data[i].time, value: Number(ema.toFixed(2)) });
    }
  }

  return out;
}

export default function CandleChart({ candles, trades, meta }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({
    candle: null,
    volume: null,
    ma: null,
    ema: null,
  });
  const [activeIndicators, setActiveIndicators] = useState({
    ma: false,
    ema: false,
    vol: false,
  });

  useEffect(() => {
    if (!containerRef.current || !candles || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1a1d27' },
        horzLines: { color: '#1a1d27' },
      },
      rightPriceScale: {
        borderColor: '#2d3148',
      },
      timeScale: {
        borderColor: '#2d3148',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: '#4b5563', width: 1 },
        horzLine: { color: '#4b5563', width: 1 },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const normalized = candles
      .map((c) => ({
        time: Number(c.time),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume || 0),
      }))
      .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.open) && Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    candleSeries.setData(normalized);

    if (trades && trades.length > 0) {
      const markers = [];
      for (const t of trades) {
        markers.push({
          time: Number(t.entryTime),
          position: t.side === 'BUY' ? 'belowBar' : 'aboveBar',
          color: t.side === 'BUY' ? '#22c55e' : '#ef4444',
          shape: t.side === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: t.side === 'BUY' ? 'B' : 'S',
        });
        markers.push({
          time: Number(t.exitTime),
          position: t.side === 'BUY' ? 'aboveBar' : 'belowBar',
          color: t.netPnl >= 0 ? '#38bdf8' : '#f97316',
          shape: 'circle',
          text: t.netPnl >= 0 ? 'TP' : 'SL',
        });
      }
      candleSeries.setMarkers(markers);
    }

    if (activeIndicators.ma) {
      const maSeries = chart.addLineSeries({ color: '#60a5fa', lineWidth: 2, priceLineVisible: false });
      maSeries.setData(calculateSma(normalized, 20));
      seriesRef.current.ma = maSeries;
    }

    if (activeIndicators.ema) {
      const emaSeries = chart.addLineSeries({ color: '#f59e0b', lineWidth: 2, priceLineVisible: false });
      emaSeries.setData(calculateEma(normalized, 20));
      seriesRef.current.ema = emaSeries;
    }

    if (activeIndicators.vol) {
      const volSeries = chart.addHistogramSeries({
        priceScaleId: '',
        priceLineVisible: false,
        lastValueVisible: false,
        priceFormat: { type: 'volume' },
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.75, bottom: 0 },
      });
      volSeries.setData(
        normalized.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)',
        })),
      );
      seriesRef.current.volume = volSeries;
    }

    seriesRef.current.candle = candleSeries;

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 500,
      });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = { candle: null, volume: null, ma: null, ema: null };
    };
  }, [candles, trades, meta, activeIndicators]);

  const toolbarBtn = (active) => ({
    border: '1px solid #2d3148',
    background: active ? '#2a3f68' : '#1a1d27',
    color: active ? '#dbeafe' : '#9ca3af',
    borderRadius: '6px',
    fontSize: '11px',
    padding: '4px 8px',
    cursor: 'pointer',
  });

  function toggleIndicator(name) {
    setActiveIndicators((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '350px', background: '#0f1117', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 5,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          background: 'rgba(15,17,23,0.85)',
          padding: '6px',
          borderRadius: '8px',
          border: '1px solid #2d3148',
        }}
      >
        <button style={toolbarBtn(activeIndicators.ma)} onClick={() => toggleIndicator('ma')}>MA</button>
        <button style={toolbarBtn(activeIndicators.ema)} onClick={() => toggleIndicator('ema')}>EMA</button>
        <button style={toolbarBtn(activeIndicators.vol)} onClick={() => toggleIndicator('vol')}>VOL</button>
        <span style={{ color: '#6b7280', fontSize: 11, padding: '4px 2px' }}>
          {meta?.symbol || 'SYMBOL'} | {meta?.interval || 'NA'}m
        </span>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '350px' }} />
    </div>
  );
}
