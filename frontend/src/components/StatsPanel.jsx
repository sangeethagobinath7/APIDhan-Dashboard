const s = {
  panel: {
    background: '#1a1d27',
    borderBottom: '1px solid #2d3148',
    padding: '12px 20px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'center',
  },
  card: {
    background: '#252839',
    borderRadius: '8px',
    padding: '10px 16px',
    minWidth: '100px',
    textAlign: 'center',
  },
  cardLabel: { fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' },
  cardValue: { fontSize: '20px', fontWeight: 700, lineHeight: 1 },
  meta: { fontSize: '11px', color: '#4b5563', marginLeft: 'auto' },
  positive: { color: '#34d399' },
  negative: { color: '#f87171' },
  neutral: { color: '#e2e8f0' },
};

function Stat({ label, value, isPositive, suffix = '' }) {
  const color = isPositive === true ? s.positive : isPositive === false ? s.negative : s.neutral;
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardValue, ...color }}>{value}{suffix}</div>
    </div>
  );
}

export default function StatsPanel({ summary, meta }) {
  const { netPnl, returnPct, totalTrades, winRate, avgRR, maxDrawdownPct, sharpeRatio, profitFactor } = summary;
  const isProfit = netPnl >= 0;

  return (
    <div style={s.panel}>
      <Stat label="Net P&L" value={`₹${netPnl.toLocaleString()}`} isPositive={isProfit} />
      <Stat label="Return" value={returnPct} suffix="%" isPositive={isProfit} />
      <Stat label="Total Trades" value={totalTrades} />
      <Stat label="Win Rate" value={winRate} suffix="%" isPositive={winRate >= 50} />
      <Stat label="Avg R:R" value={avgRR} isPositive={avgRR >= 1} />
      <Stat label="Max Drawdown" value={maxDrawdownPct} suffix="%" isPositive={maxDrawdownPct < 10} />
      <Stat label="Profit Factor" value={profitFactor} isPositive={profitFactor >= 1.5} />
      {sharpeRatio !== null && <Stat label="Sharpe" value={sharpeRatio} isPositive={sharpeRatio >= 1} />}
      <div style={s.meta}>
        <div>{meta.strategyName} · {meta.symbol} [{meta.interval}]</div>
        <div>{meta.fromDate} → {meta.toDate}</div>
      </div>
    </div>
  );
}
