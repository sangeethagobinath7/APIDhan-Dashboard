import { useState } from 'react';

const s = {
  section: { marginBottom: '20px' },
  label: { display: 'block', fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  input: {
    width: '100%', background: '#252839', border: '1px solid #363b52', borderRadius: '6px',
    color: '#e2e8f0', padding: '8px 10px', outline: 'none',
  },
  select: {
    width: '100%', background: '#252839', border: '1px solid #363b52', borderRadius: '6px',
    color: '#e2e8f0', padding: '8px 10px', outline: 'none', cursor: 'pointer',
  },
  row: { display: 'flex', gap: '8px' },
  btn: {
    width: '100%', padding: '11px', background: '#4f57d1', border: 'none', borderRadius: '8px',
    color: '#fff', fontWeight: 600, cursor: 'pointer', marginTop: '8px', fontSize: '14px',
    transition: 'background 0.15s',
  },
  btnDisabled: { background: '#2d3148', cursor: 'not-allowed', color: '#6b7280' },
  heading: { fontSize: '13px', fontWeight: 700, color: '#c4caff', marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #2d3148' },
  divider: { height: '1px', background: '#2d3148', margin: '16px 0' },
  hint: { fontSize: '11px', color: '#4b5563', marginTop: '4px' },
};

const today = new Date().toISOString().slice(0, 10);
const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function BacktestForm({ symbols, strategies, loading, onRun }) {
  const [form, setForm] = useState({
    symbol: 'NIFTY',
    interval: '5',
    fromDate: oneYearAgo,
    toDate: today,
    strategy: 'triple-edge',
    capital: 100000,
    brokerage: 20,
    slippagePct: 0.05,
    intradaySquareOff: true,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  function handleSubmit(e) {
    e.preventDefault();
    onRun({
      ...form,
      capital: Number(form.capital),
      brokerage: Number(form.brokerage),
      slippagePct: Number(form.slippagePct),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={s.heading}>🔧 Backtest Configuration</div>

      <div style={s.section}>
        <label style={s.label}>Symbol</label>
        <select style={s.select} value={form.symbol} onChange={e => set('symbol', e.target.value)}>
          {symbols.map(sym => <option key={sym} value={sym}>{sym}</option>)}
          {symbols.length === 0 && <option value="NIFTY">NIFTY</option>}
        </select>
      </div>

      <div style={s.section}>
        <label style={s.label}>Timeframe</label>
        <select style={s.select} value={form.interval} onChange={e => set('interval', e.target.value)}>
          <option value="1">1 Minute</option>
          <option value="5">5 Minutes</option>
          <option value="15">15 Minutes</option>
          <option value="25">25 Minutes</option>
          <option value="60">1 Hour</option>
          <option value="D">Daily</option>
        </select>
      </div>

      <div style={s.section}>
        <label style={s.label}>Date Range</label>
        <div style={s.row}>
          <div style={{ flex: 1 }}>
            <input type="date" style={s.input} value={form.fromDate}
              onChange={e => set('fromDate', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <input type="date" style={s.input} value={form.toDate}
              onChange={e => set('toDate', e.target.value)} />
          </div>
        </div>
        <div style={s.hint}>Max 90 days per fetch for intraday — larger ranges auto-batch.</div>
      </div>

      <div style={s.divider} />

      <div style={s.section}>
        <label style={s.label}>Strategy</label>
        <select style={s.select} value={form.strategy} onChange={e => set('strategy', e.target.value)}>
          {strategies.map(st => (
            <option key={st.id} value={st.id}>{st.name}</option>
          ))}
          {strategies.length === 0 && <>
            <option value="vwap-cross">VWAP Cross</option>
            <option value="ema-cross">EMA Crossover (9/21)</option>
            <option value="supertrend">Supertrend</option>
            <option value="orb">Opening Range Breakout</option>
          </>}
        </select>
        {strategies.find(s => s.id === form.strategy)?.description && (
          <div style={s.hint}>{strategies.find(st => st.id === form.strategy).description}</div>
        )}
      </div>

      <div style={s.divider} />

      <div style={s.section}>
        <label style={s.label}>Starting Capital (₹)</label>
        <input type="number" style={s.input} value={form.capital}
          onChange={e => set('capital', e.target.value)} min={1000} step={1000} />
      </div>

      <div style={{ ...s.row, ...s.section }}>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Brokerage (₹/order)</label>
          <input type="number" style={s.input} value={form.brokerage}
            onChange={e => set('brokerage', e.target.value)} min={0} step={1} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={s.label}>Slippage (%)</label>
          <input type="number" style={s.input} value={form.slippagePct}
            onChange={e => set('slippagePct', e.target.value)} min={0} step={0.01} />
        </div>
      </div>

      <div style={s.section}>
        <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.intradaySquareOff}
            onChange={e => set('intradaySquareOff', e.target.checked)} />
          Intraday Square-off at 15:15
        </label>
      </div>

      <button
        type="submit"
        style={loading ? { ...s.btn, ...s.btnDisabled } : s.btn}
        disabled={loading}
      >
        {loading ? '⏳ Running...' : '▶ Run Backtest'}
      </button>
    </form>
  );
}
