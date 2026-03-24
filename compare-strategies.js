#!/usr/bin/env node
// Compare all 5 strategies
const http = require('http');

const fromDate = '2026-02-03';
const toDate = '2026-03-20';

const strategies = [
  { id: 'vwap-cross', name: 'VWAP Cross' },
  { id: 'ema-cross', name: 'EMA Cross' },
  { id: 'supertrend', name: 'Supertrend' },
  { id: 'orb', name: 'ORB' },
  { id: 'triple-edge', name: 'TriplEdge Pro ⭐' },
];

function runTest(strategy) {
  return new Promise((resolve) => {
    const backtest = {
      symbol: 'NIFTY',
      interval: '5',
      fromDate,
      toDate,
      strategy: strategy.id,
      capital: 100000,
      useCache: true,
    };

    const body = JSON.stringify(backtest);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/backtest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.report) {
            const s = result.report.summary;
            const fmt = (v) => (v == null ? 'N/A' : Number(v).toFixed(2));
            resolve({
              name: strategy.name,
              trades: s.totalTrades,
              winRate: s.winRate,
              netPnl: fmt(s.netPnl),
              returnPct: fmt(s.returnPct),
              maxDrawdown: fmt(s.maxDrawdownPct),
              sharpe: fmt(s.sharpeRatio),
              profitFactor: fmt(s.profitFactor),
            });
          } else {
            resolve({ name: strategy.name, error: result.error });
          }
        } catch (e) {
          resolve({ name: strategy.name, error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ name: strategy.name, error: err.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('\n📊 STRATEGY COMPARISON — NIFTY 5min\n');
  console.log(`Period: ${fromDate} → ${toDate}`);
  console.log('='.repeat(80));

  // Run sequentially to avoid cache conflicts  
  for (const s of strategies) {
    const r = await runTest(s);
    if (r.error) {
      console.log(`\n❌ ${r.name}: ${r.error}`);
    } else {
      const pnlSign = r.netPnl > 0 ? '✅' : '❌';
      console.log(`\n${pnlSign} ${r.name}`);
      console.log(`   Trades: ${r.trades}  |  Win Rate: ${r.winRate}%  |  Profit Factor: ${r.profitFactor}`);
      console.log(`   Net P&L: ₹${r.netPnl}  |  Return: ${r.returnPct}%  |  Max DD: -${r.maxDrawdown}%  |  Sharpe: ${r.sharpe}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Done\n');
}

main();
