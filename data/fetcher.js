'use strict';

const config = require('../config/dhan');
const dhanClient = require('../dhan/client');
const { saveCandles, loadCandles } = require('./store');
const { getInstrument } = require('./instruments');

/**
 * Convert Dhan's columnar response array format to row-based candle objects.
 * Dhan returns { open: [], high: [], low: [], close: [], volume: [], timestamp: [] }
 *
 * @param {object} raw - raw Dhan API response data
 * @returns {Array<{time, open, high, low, close, volume}>}
 */
function normalizeCandles(raw) {
  const { open, high, low, close, volume, timestamp } = raw;
  if (!timestamp || !open) return [];

  return timestamp.map((ts, i) => ({
    time: ts,           // Unix epoch seconds
    open: open[i],
    high: high[i],
    low: low[i],
    close: close[i],
    volume: volume[i],
  }));
}

/**
 * Add days to a Date object and return a new Date.
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Format a Date as 'YYYY-MM-DD'.
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Format a Date as 'YYYY-MM-DD HH:mm:ss' (for intraday API).
 */
function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Geometric Brownian Motion synthetic candle generator.
 *
 * Uses the standard GBM model: dS = μ·S·dt + σ·S·dW
 * with regime-switching drift so momentum strategies can find real edge.
 *
 * Statistical properties:
 *  - Market hours only: 9:15–15:30 IST, weekdays
 *  - σ (annualised vol) = 0.15 – 0.18 → realistic 5-min ATR
 *  - μ (drift) switches every 15–30 candles: ±0.8 Sharpe ratio
 *  - Overnight gaps drawn from N(0, 0.003)
 *  - Volume proportional to current price level, higher at open/close
 *
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {number} intervalMinutes
 * @param {string} symbol
 * @returns {Array<{time, open, high, low, close, volume}>}
 */
function generateSyntheticCandles(startDate, endDate, intervalMinutes, symbol) {
  const candles = [];

  const basePrices = {
    NIFTY: 23500, BANKNIFTY: 50000, TCS: 3600,
    HDFCBANK: 1700, INFY: 2200, RELIANCE: 2900,
    SBIN: 820, TATAMOTORS: 980, WIPRO: 550,
  };
  const baseVol = { NIFTY: 180000, BANKNIFTY: 280000 };
  const DEFAULT_VOL = 350000;

  // GBM parameters
  const ANNUAL_SESSIONS = 252;
  const CANDLES_PER_SESSION = Math.round(375 / intervalMinutes);
  const ANNUAL_CANDLES = ANNUAL_SESSIONS * CANDLES_PER_SESSION;
  const dt = 1 / ANNUAL_CANDLES;            // fraction of a year per candle

  // Annualised vol → per-candle σ
  const sigma = symbol === 'BANKNIFTY' ? 0.18 : 0.15;
  const sigmaCandle = sigma * Math.sqrt(dt); // ~0.0006 per 5-min candle

  // ----- Box-Muller normal random sample -----
  function randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  let price = basePrices[symbol] || 20000;

  // Regime state
  let regimeDrift = 0;               // annualised drift for current regime
  let regimeRemaining = 0;           // candles left in this regime

  function nextRegime() {
    // 60% chance trending, 40% flat
    const trending = Math.random() < 0.60;
    const direction = Math.random() < 0.5 ? 1 : -1;
    // Sharpe of ±0.8 during trend, ±0.1 during flat
    const sharpe = trending ? 0.8 * direction : 0.1 * (Math.random() > 0.5 ? 1 : -1);
    regimeDrift = sharpe * sigma;     // μ = Sharpe × σ
    regimeRemaining = 15 + Math.floor(Math.random() * 20);
  }
  nextRegime();

  const cursor = new Date(startDate);
  cursor.setUTCHours(0, 0, 0, 0);
  const endMs = endDate.getTime();

  while (cursor.getTime() < endMs) {
    const dow = cursor.getUTCDay();
    if (dow === 0 || dow === 6) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      continue;
    }

    // Overnight gap ~ N(0, 0.3%)
    if (candles.length > 0) {
      price *= Math.exp(randn() * 0.003);
    }

    const marketOpenUTC  = new Date(cursor); marketOpenUTC.setUTCHours(3, 45, 0, 0);
    const marketCloseUTC = new Date(cursor); marketCloseUTC.setUTCHours(10, 0, 0, 0);
    let sessionTs  = marketOpenUTC.getTime() / 1000;
    const sessionEnd = marketCloseUTC.getTime() / 1000;
    const stepSec = intervalMinutes * 60;

    while (sessionTs < sessionEnd) {
      // Regime tick
      if (regimeRemaining <= 0) nextRegime();
      regimeRemaining--;

      // GBM step
      const driftTerm = (regimeDrift - 0.5 * sigma * sigma) * dt;
      const diffTerm  = sigmaCandle * randn();
      const returnRate = driftTerm + diffTerm;

      const open  = price;
      const close = price * Math.exp(returnRate);

      // Realistic O/H/L from intra-candle volatility
      const candleRange = price * sigmaCandle * (0.5 + Math.random() * 0.8);
      const high  = Math.max(open, close) + candleRange * 0.4 * Math.random();
      const low   = Math.min(open, close) - candleRange * 0.4 * Math.random();

      // Volume: proportional to price × natural randomness × open/close boost
      const istMin = Math.floor(((sessionTs + 5.5 * 3600) % 86400) / 60);
      const openBoost  = (istMin >= 555 && istMin <= 585) ? 2.0 : 1;
      const closeBoost = (istMin >= 900 && istMin <= 930) ? 1.5 : 1;
      const baseV = baseVol[symbol] || DEFAULT_VOL;
      const volume = Math.floor(baseV * openBoost * closeBoost * (0.4 + Math.random() * 0.8));

      candles.push({
        time:  Math.floor(sessionTs),
        open:  parseFloat(open.toFixed(2)),
        high:  parseFloat(high.toFixed(2)),
        low:   parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });

      price = close;
      sessionTs += stepSec;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  console.log(`[fetcher] GBM synthetic: ${candles.length} candles for ${symbol} (market-hours only, regime-switching drift)`);
  return candles;
}


/**
 * Fetch intraday (minute) historical data.
 * Dhan allows max 90 days per request — this function batches automatically.
 *
 * @param {object} opts
 * @param {string} opts.symbol           - e.g. 'NIFTY' or custom
 * @param {string} [opts.securityId]     - override securityId (for options, custom)
 * @param {string} [opts.exchangeSegment]
 * @param {string} [opts.instrument]
 * @param {1|5|15|25|60} opts.interval   - candle interval in minutes
 * @param {string} opts.fromDate         - 'YYYY-MM-DD'
 * @param {string} opts.toDate           - 'YYYY-MM-DD'
 * @param {boolean} [opts.useCache=true] - skip fetch if cached data exists
 * @param {boolean} [opts.oi=false]      - include open interest
 * @returns {Promise<Array<{time,open,high,low,close,volume}>>}
 */
async function fetchIntraday(opts) {
  const { interval, fromDate, toDate, useCache = true, oi = false } = opts;

  // Resolve instrument details
  let securityId, exchangeSegment, instrument;
  if (opts.securityId) {
    securityId = opts.securityId;
    exchangeSegment = opts.exchangeSegment;
    instrument = opts.instrument;
  } else {
    const inst = getInstrument(opts.symbol);
    securityId = inst.securityId;
    exchangeSegment = inst.exchangeSegment;
    instrument = inst.instrument;
  }

  const symbol = opts.symbol || securityId;
  const seg = exchangeSegment;
  const intStr = String(interval);

  // Check cache first
  if (useCache) {
    const cached = loadCandles(symbol, seg, intStr, fromDate, toDate);
    if (cached) {
      console.log(`[fetcher] Cache hit: ${symbol} ${intStr}m (${cached.count} candles)`);
      return cached.candles;
    }
  }

  // Batch: 90-day windows
  const BATCH_DAYS = 89;
  let cursor = new Date(fromDate);
  const end = new Date(toDate);
  const allCandles = [];

  while (cursor < end) {
    const batchEnd = addDays(cursor, BATCH_DAYS);
    const effectiveEnd = batchEnd > end ? end : batchEnd;

    const body = {
      securityId,
      exchangeSegment,
      instrument,
      interval: String(interval),
      oi,
      fromDate: formatDateTime(cursor),
      toDate: formatDateTime(effectiveEnd),
    };

    console.log(`[fetcher] Fetching ${symbol} ${intStr}m: ${body.fromDate} → ${body.toDate}`);

    try {
      const res = await dhanClient.post('/charts/intraday', body);
      const candles = normalizeCandles(res.data);

      // Strict mode: require realistic candle count, otherwise hard-fail.
      const days = Math.max(1, Math.ceil((effectiveEnd - cursor) / (1000 * 86400)));
      const minExpected = Math.max(10, days * 5);
      if (candles.length < minExpected) {
        throw new Error(
          `Insufficient real candle data from Dhan (${candles.length}). Expected at least ${minExpected} for ${formatDate(cursor)} to ${formatDate(effectiveEnd)}.`
        );
      }

      allCandles.push(...candles);
    } catch (apiErr) {
      if (config.strictRealData) {
        throw new Error(
          `Strict mode: real Dhan data unavailable for ${symbol} ${intStr}m (${formatDate(cursor)} to ${formatDate(effectiveEnd)}). ${apiErr.message}`
        );
      }

      // Non-strict mode (optional): allow synthetic fallback for offline testing.
      console.warn(`[fetcher] Non-strict mode fallback: ${apiErr.message}`);
      const syntheticCandles = generateSyntheticCandles(cursor, effectiveEnd, interval, symbol);
      allCandles.push(...syntheticCandles);
    }

    cursor = addDays(effectiveEnd, 1);

    // Respect rate limits — brief pause between batch calls
    if (cursor < end) await sleep(400);
  }

  // Sort by time ascending (safety)
  allCandles.sort((a, b) => a.time - b.time);

  // Deduplicate by timestamp
  const deduped = [];
  const seen = new Set();
  for (const c of allCandles) {
    if (!seen.has(c.time)) {
      seen.add(c.time);
      deduped.push(c);
    }
  }

  if (useCache) {
    const saved = saveCandles(symbol, seg, intStr, deduped, fromDate, toDate);
    console.log(`[fetcher] Saved ${deduped.length} candles → ${saved}`);
  }

  return deduped;
}

/**
 * Fetch daily (EOD) historical data — no batching needed.
 *
 * @param {object} opts
 * @param {string} opts.symbol
 * @param {string} [opts.securityId]
 * @param {string} [opts.exchangeSegment]
 * @param {string} [opts.instrument]
 * @param {string} opts.fromDate   - 'YYYY-MM-DD'
 * @param {string} opts.toDate     - 'YYYY-MM-DD'
 * @param {boolean} [opts.useCache=true]
 * @param {boolean} [opts.oi=false]
 * @returns {Promise<Array<{time,open,high,low,close,volume}>>}
 */
async function fetchDaily(opts) {
  const { fromDate, toDate, useCache = true, oi = false } = opts;

  let securityId, exchangeSegment, instrument;
  if (opts.securityId) {
    securityId = opts.securityId;
    exchangeSegment = opts.exchangeSegment;
    instrument = opts.instrument;
  } else {
    const inst = getInstrument(opts.symbol);
    securityId = inst.securityId;
    exchangeSegment = inst.exchangeSegment;
    instrument = inst.instrument;
  }

  const symbol = opts.symbol || securityId;
  const seg = exchangeSegment;

  if (useCache) {
    const cached = loadCandles(symbol, seg, 'D', fromDate, toDate);
    if (cached) {
      console.log(`[fetcher] Cache hit: ${symbol} daily (${cached.count} candles)`);
      return cached.candles;
    }
  }

  const body = {
    securityId,
    exchangeSegment,
    instrument,
    expiryCode: 0,
    oi,
    fromDate,
    toDate,
  };

  console.log(`[fetcher] Fetching ${symbol} daily: ${fromDate} → ${toDate}`);
  const res = await dhanClient.post('/charts/historical', body);
  const candles = normalizeCandles(res.data);

  if (candles.length === 0) {
    throw new Error(`Strict mode: no real daily candles returned by Dhan for ${symbol} (${fromDate} to ${toDate}).`);
  }

  candles.sort((a, b) => a.time - b.time);

  if (useCache) {
    const saved = saveCandles(symbol, seg, 'D', candles, fromDate, toDate);
    console.log(`[fetcher] Saved ${candles.length} daily candles → ${saved}`);
  }

  return candles;
}

/**
 * Fetch data for a symbol/interval combo, auto-selecting intraday or daily.
 *
 * @param {object} opts
 * @param {string} opts.symbol
 * @param {'5'|'15'|'60'|'D'|'1d'} opts.interval - '5', '15', '60', or 'D'/'1d'
 * @param {string} opts.fromDate
 * @param {string} opts.toDate
 * @param {boolean} [opts.useCache]
 * @returns {Promise<Array>}
 */
async function fetchCandles(opts) {
  const interval = String(opts.interval).toUpperCase();
  if (interval === 'D' || interval === '1D') {
    return fetchDaily({ ...opts });
  }
  const parsed = parseInt(interval, 10);
  if (![1, 5, 15, 25, 60].includes(parsed)) {
    throw new Error(`Unsupported interval: ${opts.interval}. Use 1, 5, 15, 25, 60, or 'D'.`);
  }
  return fetchIntraday({ ...opts, interval: parsed });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { fetchCandles, fetchIntraday, fetchDaily, normalizeCandles };
