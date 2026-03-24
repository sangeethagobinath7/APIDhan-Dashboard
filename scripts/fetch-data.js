'use strict';

/**
 * CLI script: Fetch historical data and cache it locally.
 *
 * Usage:
 *   node scripts/fetch-data.js --symbol NIFTY --interval 5 --from 2024-01-01 --to 2024-12-31
 *   node scripts/fetch-data.js --symbol HDFCBANK --interval D --from 2023-01-01 --to 2024-12-31
 */

require('dotenv').config();
const { fetchCandles } = require('../data/fetcher');

const args = process.argv.slice(2);
const get = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const symbol   = get('--symbol') || 'NIFTY';
const interval = get('--interval') || '5';
const fromDate = get('--from') || '2024-01-01';
const toDate   = get('--to') || new Date().toISOString().slice(0, 10);
const force    = args.includes('--force');

(async () => {
  console.log(`Fetching ${symbol} [${interval}] from ${fromDate} to ${toDate}${force ? ' (force refresh)' : ''}...`);
  try {
    const candles = await fetchCandles({ symbol, interval, fromDate, toDate, useCache: !force });
    console.log(`✅ Got ${candles.length} candles.`);
    console.log(`   First: ${new Date(candles[0].time * 1000).toISOString()}`);
    console.log(`   Last : ${new Date(candles[candles.length - 1].time * 1000).toISOString()}`);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
})();
