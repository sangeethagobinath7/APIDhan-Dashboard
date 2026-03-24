#!/usr/bin/env node

const http = require('http');

const backtest = {
  symbol: 'NIFTY',
  interval: '5',
  fromDate: '2026-03-09',
  toDate: '2026-03-23',
  strategy: 'vwap-cross',
  capital: 100000,
  brokerage: 20,
  slippagePct: 0.05,
  intradaySquareOff: true,
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

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('\n✅ BACKTEST SUCCESSFUL!\n');
      console.log('Report Summary:');
      console.log('-'.repeat(40));
      if (result.report) {
        const s = result.report.summary;
        console.log(`Total Trades: ${s.totalTrades}`);
        console.log(`Win Rate: ${s.winRate}%`);
        console.log(`Net P&L: ₹${s.netPnl.toFixed(2)}`);
        console.log(`Return: ${s.returnPct.toFixed(2)}%`);
        console.log(`Max Drawdown: ${s.maxDrawdownPct.toFixed(2)}%`);
        console.log(`Sharpe Ratio: ${s.sharpeRatio.toFixed(2)}`);
      } else {
        console.log(JSON.stringify(result, null, 2).slice(0, 300));
      }
    } catch (e) {
      console.error('Failed to parse response:', data.slice(0, 200));
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request failed:', err.message);
});

console.log('Sending backtest request...');
req.write(body);
req.end();
