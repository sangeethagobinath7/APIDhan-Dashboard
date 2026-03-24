'use strict';

/**
 * CLI script: Run a backtest and print results to the console.
 *
 * Usage:
 *   node scripts/run-backtest.js --symbol NIFTY --interval 5 --from 2024-01-01 --to 2024-06-30 --strategy vwap-cross
 *   node scripts/run-backtest.js --symbol HDFCBANK --interval 15 --from 2024-01-01 --to 2024-12-31 --strategy ema-cross
 *
 * Available strategies: vwap-cross, ema-cross, supertrend, orb
 */

require('dotenv').config();
const { fetchCandles } = require('../data/fetcher');
const { runBacktest } = require('../engine/backtest');
const { buildReport } = require('../analytics/report');

const vwapCross = require('../strategies/vwap-cross');
const createEmaCross = require('../strategies/ema-cross');
const createSupertrend = require('../strategies/supertrend');
const orbStrategy = require('../strategies/orb');

const STRATEGIES = {
  'vwap-cross': () => vwapCross,
  'ema-cross': () => createEmaCross(),
  'supertrend': () => createSupertrend(),
  'orb': () => orbStrategy,
};

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const symbol     = get('--symbol') || 'NIFTY';
const interval   = get('--interval') || '5';
const fromDate   = get('--from') || '2024-01-01';
const toDate     = get('--to') || new Date().toISOString().slice(0, 10);
const strategyId = get('--strategy') || 'vwap-cross';
const capital    = parseInt(get('--capital') || '100000', 10);

(async () => {
  console.log(`\n📊 Backtest: ${symbol} [${interval}] | ${fromDate} → ${toDate} | Strategy: ${strategyId}\n`);

  if (!STRATEGIES[strategyId]) {
    console.error(`Unknown strategy: ${strategyId}. Available: ${Object.keys(STRATEGIES).join(', ')}`);
    process.exit(1);
  }

  try {
    const candles = await fetchCandles({ symbol, interval, fromDate, toDate, useCache: true });
    console.log(`Loaded ${candles.length} candles.\n`);

    const strategyFn = STRATEGIES[strategyId]();
    const indicatorOpts = strategyFn.meta?.indicatorOpts || {};

    const result = runBacktest({ candles, strategyFn, capital, indicatorOpts });
    const report = buildReport({
      ...result,
      initialCapital: capital,
      symbol, interval, fromDate, toDate,
      strategyName: strategyFn.meta?.name || strategyId,
    });

    const s = report.summary;
    console.log('═'.repeat(50));
    console.log(`  Strategy     : ${report.meta.strategyName}`);
    console.log(`  Capital      : ₹${report.meta.initialCapital.toLocaleString()}`);
    console.log(`  Final Capital: ₹${report.meta.finalCapital.toLocaleString()}`);
    console.log('─'.repeat(50));
    console.log(`  Net P&L      : ₹${s.netPnl.toLocaleString()} (${s.returnPct}%)`);
    console.log(`  Total Trades : ${s.totalTrades}`);
    console.log(`  Win Rate     : ${s.winRate}%`);
    console.log(`  Avg Win      : ₹${s.avgWin}`);
    console.log(`  Avg Loss     : ₹${s.avgLoss}`);
    console.log(`  Avg R:R      : ${s.avgRR}`);
    console.log(`  Profit Factor: ${s.profitFactor}`);
    console.log(`  Expectancy   : ₹${s.expectancy}`);
    console.log(`  Max Drawdown : ₹${s.maxDrawdown} (${s.maxDrawdownPct}%)`);
    console.log(`  Sharpe Ratio : ${s.sharpeRatio ?? 'N/A'}`);
    console.log(`  Brokerage    : ₹${s.totalBrokerage}`);
    console.log('═'.repeat(50));

    if (report.trades.length > 0) {
      console.log('\nFirst 5 trades:');
      report.trades.slice(0, 5).forEach((t) => {
        console.log(
          `  #${t.id} ${t.side.padEnd(4)} ${t.entryTimeIST} @ ₹${t.entryPrice} → ${t.exitTimeIST} @ ₹${t.exitPrice} | P&L: ₹${t.netPnl} [${t.outcome}] (${t.exitReason})`
        );
      });
    }
    console.log('');

  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
})();
