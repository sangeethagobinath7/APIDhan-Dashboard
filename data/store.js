'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.resolve(__dirname, '../cache');

// Ensure the cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Build a deterministic cache file path for a given data key.
 * @param {string} symbol   - e.g. 'NIFTY'
 * @param {string} segment  - e.g. 'NSE_EQ'
 * @param {string} interval - e.g. '5' (minutes) or 'D' (daily)
 * @param {string} [fromDate] - YYYY-MM-DD
 * @param {string} [toDate]   - YYYY-MM-DD
 * @returns {string} absolute file path
 */
function cacheFilePath(symbol, segment, interval, fromDate = '', toDate = '') {
  const range = fromDate && toDate ? `_${fromDate}_${toDate}` : '';
  const name = `${symbol}_${segment}_${interval}${range}.json`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return path.join(CACHE_DIR, name);
}

/**
 * Save candles to cache.
 * @param {string} symbol
 * @param {string} segment
 * @param {string|number} interval
 * @param {Array<{time,open,high,low,close,volume}>} candles
 * @param {string} [fromDate]
 * @param {string} [toDate]
 */
function saveCandles(symbol, segment, interval, candles, fromDate = '', toDate = '') {
  const filePath = cacheFilePath(symbol, segment, String(interval), fromDate, toDate);
  const payload = {
    symbol,
    segment,
    interval: String(interval),
    fromDate,
    toDate,
    updatedAt: new Date().toISOString(),
    count: candles.length,
    candles,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

/**
 * Load candles from cache.
 * Returns null if no cache file exists.
 * @param {string} symbol
 * @param {string} segment
 * @param {string|number} interval
 * @param {string} [fromDate]
 * @param {string} [toDate]
 * @returns {{ candles: Array, updatedAt: string } | null}
 */
function loadCandles(symbol, segment, interval, fromDate = '', toDate = '') {
  const filePath = cacheFilePath(symbol, segment, String(interval), fromDate, toDate);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Save arbitrary JSON (e.g. backtest results) to cache/<name>.json.
 * @param {string} name  - filename without extension
 * @param {*} data
 */
function saveJSON(name, data) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(CACHE_DIR, `${safe}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

/**
 * Load arbitrary JSON from cache/<name>.json.
 * @param {string} name
 * @returns {*|null}
 */
function loadJSON(name) {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(CACHE_DIR, `${safe}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * List all cached data files.
 * @returns {string[]} file names
 */
function listCache() {
  return fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
}

module.exports = { saveCandles, loadCandles, saveJSON, loadJSON, listCache, cacheFilePath };
