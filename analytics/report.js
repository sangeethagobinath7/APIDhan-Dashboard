'use strict';

const { calcMetrics } = require('./metrics');

/**
 * Format backtest results into a structured report object.
 * This is what gets returned from the API and displayed in the frontend.
 *
 * @param {object} opts
 * @param {Array}    opts.trades
 * @param {Array}    opts.equity
 * @param {Array}    opts.candles
 * @param {number}   opts.finalCapital
 * @param {number}   opts.initialCapital
 * @param {string}   opts.symbol
 * @param {string}   opts.interval
 * @param {string}   opts.fromDate
 * @param {string}   opts.toDate
 * @param {string}   opts.strategyName
 * @returns {object} report
 */
function buildReport(opts) {
  const {
    trades,
    equity,
    candles,
    finalCapital,
    initialCapital,
    symbol,
    interval,
    fromDate,
    toDate,
    strategyName,
  } = opts;

  const metrics = calcMetrics({ trades, equity, initialCapital });

  const report = {
    meta: {
      symbol,
      interval,
      fromDate,
      toDate,
      strategyName: strategyName || 'custom',
      generatedAt: new Date().toISOString(),
      initialCapital,
      finalCapital: Math.round(finalCapital * 100) / 100,
    },
    summary: {
      netPnl: metrics.netPnl,
      returnPct: metrics.returnPct,
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      avgWin: metrics.avgWin,
      avgLoss: metrics.avgLoss,
      avgRR: metrics.avgRR,
      profitFactor: metrics.profitFactor,
      expectancy: metrics.expectancy,
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownPct: metrics.maxDrawdownPct,
      sharpeRatio: metrics.sharpeRatio,
      totalBrokerage: metrics.totalBrokerage,
    },
    trades: trades.map((t, i) => ({
      id: i + 1,
      side: t.side,
      entryTime: t.entryTime,
      entryTimeIST: epochToIST(t.entryTime),
      exitTime: t.exitTime,
      exitTimeIST: epochToIST(t.exitTime),
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      qty: t.qty,
      grossPnl: Math.round(t.grossPnl * 100) / 100,
      brokerage: Math.round(t.brokerage * 100) / 100,
      netPnl: Math.round(t.netPnl * 100) / 100,
      exitReason: t.exitReason,
      outcome: t.netPnl > 0 ? 'WIN' : t.netPnl < 0 ? 'LOSS' : 'BREAKEVEN',
    })),
    candles: (candles || []).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    })),
    equity: metrics.equity,
  };

  return report;
}

/**
 * Convert epoch seconds to IST timestamp string.
 */
function epochToIST(epoch) {
  if (!epoch) return null;
  return new Date((epoch + 5.5 * 3600) * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' IST';
}

module.exports = { buildReport };
