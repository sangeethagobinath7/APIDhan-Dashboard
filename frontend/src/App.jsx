import { useState, useEffect } from 'react';
import BacktestForm from './components/BacktestForm.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import CandleChart from './components/CandleChart.jsx';
import EquityCurve from './components/EquityCurve.jsx';
import TradeLog from './components/TradeLog.jsx';

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#0f1117',
  },
  header: {
    background: '#1a1d27',
    borderBottom: '1px solid #2d3148',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#7c8cff',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#6b7280',
  },
  body: {
    display: 'flex',
    flex: 1,
    gap: 0,
    overflow: 'hidden',
  },
  sidebar: {
    width: '300px',
    minWidth: '280px',
    background: '#1a1d27',
    borderRight: '1px solid #2d3148',
    overflowY: 'auto',
    padding: '16px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chartsRow: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 0,
    overflow: 'hidden',
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'column',
    gap: '12px',
    color: '#4b5563',
  },
  emptyIcon: { fontSize: '48px' },
  emptyText: { fontSize: '16px' },
  emptyHint: { fontSize: '13px', color: '#374151' },
  error: {
    background: '#2d1b1b',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    borderRadius: '8px',
    padding: '12px 16px',
    margin: '16px',
    fontSize: '13px',
  },
};

export default function App() {
  const [symbols, setSymbols] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');

  useEffect(() => {
    fetch('/api/symbols').then(r => r.json()).then(d => setSymbols(d.symbols || []));
    fetch('/api/strategies').then(r => r.json()).then(d => setStrategies(d.strategies || []));
  }, []);

  async function handleRun(params) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Backtest failed');
      setReport(data.report);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.title}>📈 Dhan Backtest</div>
          <div style={styles.subtitle}>Strategy Backtesting & Forward Testing</div>
        </div>
      </header>

      <div style={styles.body}>
        {/* Sidebar: Form */}
        <aside style={styles.sidebar}>
          <BacktestForm
            symbols={symbols}
            strategies={strategies}
            loading={loading}
            onRun={handleRun}
          />
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          {error && <div style={styles.error}>⚠️ {error}</div>}

          {!report && !loading && !error && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📊</div>
              <div style={styles.emptyText}>No backtest results yet</div>
              <div style={styles.emptyHint}>Configure your strategy and click Run Backtest</div>
            </div>
          )}

          {loading && (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>⏳</div>
              <div style={styles.emptyText}>Running backtest...</div>
            </div>
          )}

          {report && (
            <>
              <StatsPanel summary={report.summary} meta={report.meta} />
              <TabBar active={activeTab} onChange={setActiveTab} />
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                {activeTab === 'chart' && (
                  <CandleChart candles={report.candles} trades={report.trades} meta={report.meta} />
                )}
                {activeTab === 'equity' && <EquityCurve equity={report.equity} />}
                {activeTab === 'trades' && <TradeLog trades={report.trades} />}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'chart', label: '🕯 Chart' },
    { id: 'equity', label: '📈 Equity Curve' },
    { id: 'trades', label: '📋 Trade Log' },
  ];
  return (
    <div style={{
      display: 'flex',
      background: '#1a1d27',
      borderBottom: '1px solid #2d3148',
      padding: '0 16px',
    }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '10px 16px',
            background: 'none',
            border: 'none',
            color: active === t.id ? '#7c8cff' : '#6b7280',
            borderBottom: active === t.id ? '2px solid #7c8cff' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: active === t.id ? 600 : 400,
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
