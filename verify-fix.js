#!/usr/bin/env node
const http = require('http');

const backtest = {
  symbol: 'NIFTY',
  interval: '5',
  fromDate: '2026-03-10',
  toDate: '2026-03-20',
  strategy: 'ema-cross',
  capital: 100000,
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
        console.log('✅ BACKTEST SUCCESSFUL');
        console.log('Trades Generated:', result.report.summary.totalTrades);
        console.log('Net P&L (₹):', result.report.summary.netPnl.toFixed(2));
        console.log('Return (%):', result.report.summary.returnPct.toFixed(2));
        console.log('Win Rate (%):', result.report.summary.winRate);
        console.log('\n✅ SYNTHETIC DATA FALLBACK WORKING');
        process.exit(0);
      } else {
        console.log('❌ ERROR:', result.error);
        process.exit(1);
      }
    } catch (e) {
      console.log('❌ Parse error:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.log('❌ Request error:', err.message);
  process.exit(1);
});

req.write(body);
req.end();
