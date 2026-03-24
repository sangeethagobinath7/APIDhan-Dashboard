'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const newRunId = () => crypto.randomUUID ? crypto.randomUUID() : `run_${Math.random().toString(36).slice(2)}`;

const config = require('./config/dhan');
const { fetchCandles } = require('./data/fetcher');
const { saveJSON, loadJSON, listCache } = require('./data/store');
const { runBacktest } = require('./engine/backtest');
const { buildReport } = require('./analytics/report');
const { listSymbols } = require('./data/instruments');

// Strategy registry
const createVwapCross = require('./strategies/vwap-cross');
const createEmaCross = require('./strategies/ema-cross');
const createSupertrend = require('./strategies/supertrend');
const orbStrategy = require('./strategies/orb');
const createTripleEdge = require('./strategies/triple-edge');

const STRATEGIES = {
  'vwap-cross': () => createVwapCross(),
  'ema-cross': () => createEmaCross(),
  'supertrend': () => createSupertrend(),
  'orb': () => orbStrategy,
  'triple-edge': () => createTripleEdge(),
};

const app = express();
app.use(cors());
app.use(express.json());

// Serve React frontend in production
const frontendDist = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendDist));

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/symbols — list available instruments
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/symbols', (req, res) => {
  res.json({ symbols: listSymbols() });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/strategies — list available strategy names
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/strategies', (req, res) => {
  const list = Object.entries(STRATEGIES).map(([id, factory]) => {
    const fn = factory();
    return { id, name: fn.meta?.name || id, description: fn.meta?.description || '' };
  });
  res.json({ strategies: list });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/fetch-data — fetch & cache historical candles
// Body: { symbol, interval, fromDate, toDate, force? }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/fetch-data', async (req, res) => {
  const { symbol, interval, fromDate, toDate, force = false } = req.body;

  if (!symbol || !interval || !fromDate || !toDate) {
    return res.status(400).json({ error: 'symbol, interval, fromDate, toDate are required.' });
  }

  try {
    const candles = await fetchCandles({
      symbol,
      interval,
      fromDate,
      toDate,
      useCache: !force,
    });

    res.json({
      ok: true,
      symbol,
      interval,
      count: candles.length,
      from: candles[0]?.time,
      to: candles[candles.length - 1]?.time,
    });
  } catch (err) {
    console.error('[/api/fetch-data]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/backtest — run backtest and return results
// Body: {
//   symbol, interval, fromDate, toDate,
//   strategy: 'vwap-cross' | 'ema-cross' | 'supertrend' | 'orb',
//   capital?, brokerage?, slippagePct?,
//   intradaySquareOff?,
//   indicatorOpts?
// }
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/backtest', async (req, res) => {
  const {
    symbol,
    interval,
    fromDate,
    toDate,
    strategy: strategyId,
    capital = 100000,
    brokerage,
    slippagePct,
    intradaySquareOff = true,
    indicatorOpts,
  } = req.body;

  if (!symbol || !interval || !fromDate || !toDate || !strategyId) {
    return res.status(400).json({ error: 'symbol, interval, fromDate, toDate, strategy are required.' });
  }

  if (!STRATEGIES[strategyId]) {
    return res.status(400).json({
      error: `Unknown strategy: "${strategyId}". Available: ${Object.keys(STRATEGIES).join(', ')}`,
    });
  }

  try {
    // Fetch (or load from cache) candles
    const candles = await fetchCandles({ symbol, interval, fromDate, toDate, useCache: true });

    if (candles.length < 10) {
      return res.status(400).json({ error: `Not enough candle data for ${symbol} (${candles.length} candles). Try a wider date range.` });
    }

    // Build strategy function
    const strategyFn = STRATEGIES[strategyId]();
    const mergedIndicatorOpts = { ...(strategyFn.meta?.indicatorOpts || {}), ...(indicatorOpts || {}) };

    // Run backtest
    const backtestResult = runBacktest({
      candles,
      strategyFn,
      capital,
      brokerage,
      slippagePct,
      intradaySquareOff,
      indicatorOpts: mergedIndicatorOpts,
    });

    // Build formatted report
    const report = buildReport({
      ...backtestResult,
      candles,
      initialCapital: capital,
      symbol,
      interval,
      fromDate,
      toDate,
      strategyName: strategyFn.meta?.name || strategyId,
    });

    // Cache the result
    const runId = `run_${Date.now()}`;
    saveJSON(runId, report);


    res.json({ runId, report });
  } catch (err) {
    console.error('[/api/backtest]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/:id — retrieve a cached backtest result
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/results/:id', (req, res) => {
  const data = loadJSON(req.params.id);
  if (!data) return res.status(404).json({ error: 'Result not found.' });
  res.json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results — list all cached run ids
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/results', (req, res) => {
  const files = listCache().filter((f) => f.startsWith('run_'));
  res.json({ results: files.map((f) => f.replace('.json', '')) });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fallback — serve React app for all unmatched routes
// ─────────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  const indexHtml = path.join(frontendDist, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.json({ message: 'Dhan Backtest API is running.', endpoints: [
      'GET  /api/symbols',
      'GET  /api/strategies',
      'POST /api/fetch-data',
      'POST /api/backtest',
      'GET  /api/results',
      'GET  /api/results/:id',
    ] });
  }
});

app.listen(config.port, () => {
  console.log(`🚀 Dhan Backtest Server running on http://localhost:${config.port}`);
});

module.exports = app;
