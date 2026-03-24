'use strict';
// Quick smoke test - validates the engine end-to-end with synthetic data
const { runBacktest } = require('../engine/backtest');
const createEmaCross = require('../strategies/ema-cross');
const { buildReport } = require('../analytics/report');

const candles = [];
let price = 22000;
for (let i = 0; i < 200; i++) {
  const open = price;
  const trend = i < 100 ? 10 : -8;
  const close = price + trend + (Math.random() - 0.5) * 30;
  candles.push({
    time: 1700000000 + i * 300,
    open,
    high: Math.max(open, close) + 10,
    low: Math.min(open, close) - 10,
    close,
    volume: 10000,
  });
  price = close;
}

const strat = createEmaCross();
const result = runBacktest({ candles, strategyFn: strat, capital: 100000 });
const report = buildReport({
  ...result,
  initialCapital: 100000,
  symbol: 'TEST',
  interval: '5',
  fromDate: '2024-01-01',
  toDate: '2024-06-30',
  strategyName: 'EMA Cross',
});

console.log('Trades      :', report.summary.totalTrades);
console.log('Win Rate    :', report.summary.winRate + '%');
console.log('Net P&L (Rs):', report.summary.netPnl);
console.log('Max Drawdown:', report.summary.maxDrawdownPct + '%');
console.log('SMOKE TEST PASSED');
