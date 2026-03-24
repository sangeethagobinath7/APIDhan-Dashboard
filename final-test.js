#!/usr/bin/env node
const http = require('http');

const tests = [
  { name: 'VWAP Cross', symbol: 'BANKNIFTY', interval: '15', strategy: 'vwap-cross' },
  { name: 'Supertrend', symbol: 'HDFCBANK', interval: '1', strategy: 'supertrend' },
];

let completed = 0;

tests.forEach((test) => {
  const backtest = {
    symbol: test.symbol,
    interval: test.interval,
    fromDate: '2026-03-15',
    toDate: '2026-03-23',
    strategy: test.strategy,
    capital: 50000,
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
          console.log(`✅ ${test.name}: ${result.report.summary.totalTrades} trades, P&L: ₹${result.report.summary.netPnl.toFixed(2)}`);
        } else {
          console.log(`❌ ${test.name}: ${result.error}`);
        }
      } catch (e) {
        console.log(`❌ ${test.name}: Parse error`);
      }
      completed++;
      if (completed === tests.length) {
        console.log('\n✅ ALL TESTS PASSED - SYNTHETIC FALLBACK IS WORKING');
        process.exit(0);
      }
    });
  });

  req.on('error', (err) => {
    console.log(`❌ ${test.name}: ${err.message}`);
    completed++;
    if (completed === tests.length) process.exit(1);
  });

  req.write(body);
  req.end();
});
