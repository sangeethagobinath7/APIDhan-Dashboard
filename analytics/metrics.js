'use strict';

/**
 * Analytics — Performance Metrics Calculator
 *
 * Accepts the trade log and equity curve from the backtest engine and
 * returns a comprehensive set of performance statistics.
 */

/**
 * Calculate all performance metrics from backtest results.
 *
 * @param {object} opts
 * @param {Array}  opts.trades        - trade log from runBacktest()
 * @param {Array}  opts.equity        - equity curve [{time, value}] from runBacktest()
 * @param {number} opts.initialCapital
 * @param {number} [opts.riskFreeRate=0.065]  - annualised risk-free rate (default 6.5% Indian T-bill)
 * @returns {object} metrics
 */
function calcMetrics({ trades, equity, initialCapital, riskFreeRate = 0.065 }) {
  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      netPnl: 0,
      grossPnl: 0,
      totalBrokerage: 0,
      avgWin: 0,
      avgLoss: 0,
      avgRR: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      profitFactor: 0,
      expectancy: 0,
      sharpeRatio: null,
      returnPct: 0,
      equity,
    };
  }

  const winners = trades.filter((t) => t.netPnl > 0);
  const losers = trades.filter((t) => t.netPnl <= 0);

  const totalTrades = trades.length;
  const winRate = winners.length / totalTrades;
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const grossPnl = trades.reduce((s, t) => s + t.grossPnl, 0);
  const totalBrokerage = trades.reduce((s, t) => s + t.brokerage, 0);

  const avgWin = winners.length > 0
    ? winners.reduce((s, t) => s + t.netPnl, 0) / winners.length
    : 0;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + t.netPnl, 0) / losers.length)
    : 0;

  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

  // Profit Factor = gross wins / gross losses
  const grossWins = winners.reduce((s, t) => s + t.netPnl, 0);
  const grossLosses = Math.abs(losers.reduce((s, t) => s + t.netPnl, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  // Expectancy = (winRate × avgWin) − (lossRate × avgLoss)
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  // Max Drawdown
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equity);

  // Sharpe Ratio (using daily equity returns)
  const sharpeRatio = calcSharpeRatio(equity, riskFreeRate);

  const returnPct = (netPnl / initialCapital) * 100;

  return {
    totalTrades,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRate: round(winRate * 100, 2),     // as %
    netPnl: round(netPnl, 2),
    grossPnl: round(grossPnl, 2),
    totalBrokerage: round(totalBrokerage, 2),
    avgWin: round(avgWin, 2),
    avgLoss: round(avgLoss, 2),
    avgRR: round(avgRR, 2),
    maxDrawdown: round(maxDrawdown, 2),
    maxDrawdownPct: round(maxDrawdownPct, 2),
    profitFactor: round(profitFactor, 2),
    expectancy: round(expectancy, 2),
    sharpeRatio: sharpeRatio !== null ? round(sharpeRatio, 2) : null,
    returnPct: round(returnPct, 2),
    equity,
  };
}

/**
 * Calculate Maximum Drawdown from equity curve.
 * @param {Array<{time,value}>} equity
 * @returns {{ maxDrawdown: number, maxDrawdownPct: number }}
 */
function calcMaxDrawdown(equity) {
  if (!equity || equity.length < 2) return { maxDrawdown: 0, maxDrawdownPct: 0 };

  let peak = equity[0].value;
  let maxDD = 0;
  let maxDDPct = 0;

  for (const point of equity) {
    if (point.value > peak) peak = point.value;
    const dd = peak - point.value;
    const ddPct = (dd / peak) * 100;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  return { maxDrawdown: maxDD, maxDrawdownPct: maxDDPct };
}

/**
 * Calculate annualised Sharpe Ratio from equity curve.
 * Uses daily equity returns if data spans multiple days, else per-candle returns.
 *
 * @param {Array<{time,value}>} equity
 * @param {number} riskFreeRate  - annualised
 * @returns {number|null}
 */
function calcSharpeRatio(equity, riskFreeRate = 0.065) {
  if (!equity || equity.length < 10) return null;

  // Group by date and take the last equity value per day
  const dayMap = new Map();
  for (const pt of equity) {
    const date = new Date((pt.time + 5.5 * 3600) * 1000).toISOString().slice(0, 10);
    dayMap.set(date, pt.value);
  }

  const dailyValues = [...dayMap.values()];
  if (dailyValues.length < 5) return null;

  const returns = [];
  for (let i = 1; i < dailyValues.length; i++) {
    returns.push((dailyValues[i] - dailyValues[i - 1]) / dailyValues[i - 1]);
  }

  const meanReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return null;

  // Annualise: ~252 trading days
  const dailyRFR = riskFreeRate / 252;
  const sharpe = ((meanReturn - dailyRFR) / stdDev) * Math.sqrt(252);
  return sharpe;
}

function round(n, decimals) {
  return Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

module.exports = { calcMetrics, calcMaxDrawdown, calcSharpeRatio };
