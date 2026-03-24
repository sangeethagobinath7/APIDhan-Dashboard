'use strict';

/**
 * Strategy: TriplEdge Intraday Pro
 *
 * A high-probability intraday strategy designed for 5-minute charts.
 * Only enters on STRONG trend signals confirmed by multiple indicators.
 *
 * Entry Logic (LONG):
 *   1. Triple EMA alignment: EMA9 > EMA21 > EMA50 (confirmed uptrend)
 *   2. Price is ABOVE VWAP (bullish bias confirmed)
 *   3. Supertrend is BULLISH (direction = 1)
 *   4. RSI is between 45-70 (momentum present, not overbought)
 *   5. Current candle is BULLISH (close > open)
 *   6. Time is between 9:30 AM – 2:30 PM IST (avoid opening chaos & closing rush)
 *   7. Max 3 trades per day (prevent overtrading)
 *
 * Entry Logic (SHORT):
 *   1. Triple EMA alignment: EMA9 < EMA21 < EMA50 (confirmed downtrend)
 *   2. Price is BELOW VWAP (bearish bias confirmed)
 *   3. Supertrend is BEARISH (direction = -1)
 *   4. RSI is between 30-55 (selling pressure, not oversold)
 *   5. Current candle is BEARISH (close < open)
 *   6. Same time filter
 *   7. Max 3 trades per day
 *
 * Exit Logic:
 *   - Stop Loss  : 1.2 × ATR below/above entry
 *   - Target     : 3.5 × ATR (2.9:1 Risk-Reward)
 *   - Trend exit : Exit long if Supertrend flips bearish OR price breaks below EMA21
 *   - Trend exit : Exit short if Supertrend flips bullish OR price breaks above EMA21
 *   - Intraday   : Auto square-off at 15:15 IST (handled by backtest engine)
 *
 * @param {object} candle
 * @param {object} context
 * @returns {object} signal
 */

function createTripleEdge() {
  let dailyTradeCount = 0;
  let lastDate = null;
  let prevStDirection = null;

  /**
   * RSI(14) calculation — computed fresh from the candles slice.
   * Uses Wilder's smoothing for accuracy.
   *
   * @param {Array} candles - context.candles (slice up to current i)
   * @param {number} period
   * @returns {number|null}
   */
  function calcRSI(candles, period = 14) {
    const len = candles.length;
    if (len < period + 1) return null;

    // Initial gains/losses over the first `period` changes
    let avgGain = 0;
    let avgLoss = 0;
    for (let j = 1; j <= period; j++) {
      const change = candles[j].close - candles[j - 1].close;
      if (change > 0) avgGain += change;
      else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    // Wilder's smoothing for the rest
    for (let j = period + 1; j < len; j++) {
      const change = candles[j].close - candles[j - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Convert Unix timestamp (seconds) to IST total minutes since midnight.
   */
  function toISTMinutes(ts) {
    const dt = new Date((ts + 5.5 * 3600) * 1000);
    return dt.getUTCHours() * 60 + dt.getUTCMinutes();
  }

  /**
   * Get YYYY-MM-DD date string in IST.
   */
  function toISTDate(ts) {
    const dt = new Date((ts + 5.5 * 3600) * 1000);
    return dt.toISOString().slice(0, 10);
  }

  /**
   * Time window: Only trade 9:30 AM – 2:30 PM IST.
   * Avoids: opening volatility (9:15-9:30), and closing rush (2:30-3:30).
   */
  function isTradeTime(ts) {
    const m = toISTMinutes(ts);
    return m >= 570 && m <= 870; // 9:30=570, 14:30=870
  }

  function strategy(candle, context) {
    const { indicators, position, i, candles } = context;

    // Need enough candles for EMA50 (50) + ATR warmup
    if (i < 55) return { action: 'HOLD' };

    const ema9  = indicators.ema9;
    const ema21 = indicators.ema21;
    const ema50 = indicators.ema50;
    const vwap  = indicators.vwap;
    const st    = indicators.supertrend;
    const atr   = indicators.atr14;

    if (!ema9 || !ema21 || !ema50 || !vwap || !st || !atr) return { action: 'HOLD' };

    const { direction: stDir } = st;
    const close  = candle.close;
    const open   = candle.open;

    // ── Reset daily trade counter at new session ─────────────────────────────
    const today = toISTDate(candle.time);
    if (today !== lastDate) {
      dailyTradeCount = 0;
      lastDate = today;
    }

    // ── Time filter ──────────────────────────────────────────────────────────
    if (!isTradeTime(candle.time)) {
      prevStDirection = stDir;
      return { action: 'HOLD' };
    }

    // ── Max 3 trades per day ─────────────────────────────────────────────────
    if (dailyTradeCount >= 3) {
      prevStDirection = stDir;
      return { action: 'HOLD' };
    }

    // ── Compute RSI ──────────────────────────────────────────────────────────
    const rsi = calcRSI(candles);

    // ── LONG setup conditions ────────────────────────────────────────────────
    const tripleEmaUp   = ema9 > ema21 && ema21 > ema50;  // All EMAs bullish
    const priceAboveVwap = close > vwap;                   // Above VWAP
    const stBullish     = stDir === 1;                     // Supertrend up
    const rsiBuyZone    = rsi !== null && rsi >= 45 && rsi <= 72; // Healthy momentum
    const bullCandle    = close > open;                    // Bullish candle body
    const longSetup     = tripleEmaUp && priceAboveVwap && stBullish && rsiBuyZone && bullCandle;

    // ── SHORT setup conditions ───────────────────────────────────────────────
    const tripleEmaDown  = ema9 < ema21 && ema21 < ema50; // All EMAs bearish
    const priceBelowVwap = close < vwap;                   // Below VWAP
    const stBearish      = stDir === -1;                   // Supertrend down
    const rsiSellZone    = rsi !== null && rsi >= 28 && rsi <= 55; // Selling pressure
    const bearCandle     = close < open;                   // Bearish candle body
    const shortSetup     = tripleEmaDown && priceBelowVwap && stBearish && rsiSellZone && bearCandle;

    const slAtr = 1.2;    // ATR multiplier for stop-loss
    const tgtAtr = 3.5;   // ATR multiplier for target (2.9:1 R:R)

    // ── Enter new positions ──────────────────────────────────────────────────
    if (!position) {
      if (longSetup) {
        dailyTradeCount++;
        return {
          action: 'BUY',
          orderType: 'MARKET',
          qty: 1,
          stopLoss: close - slAtr * atr,
          target: close + tgtAtr * atr,
        };
      }
      if (shortSetup) {
        dailyTradeCount++;
        return {
          action: 'SELL',
          orderType: 'MARKET',
          qty: 1,
          stopLoss: close + slAtr * atr,
          target: close - tgtAtr * atr,
        };
      }
    }

    // ── Dynamic trend-reversal exits ─────────────────────────────────────────
    // Exit LONG if Supertrend flips bearish OR price decisively breaks EMA21
    if (position && position.side === 'BUY') {
      const stFlippedDown = prevStDirection === 1 && stDir === -1;
      const priceBrokeEma21 = close < ema21 * 0.9995; // 0.05% buffer
      if (stFlippedDown || priceBrokeEma21) {
        prevStDirection = stDir;
        return { action: 'SELL', orderType: 'MARKET', qty: 1, closeOnly: true };
      }
    }

    // Exit SHORT if Supertrend flips bullish OR price decisively breaks above EMA21
    if (position && position.side === 'SELL') {
      const stFlippedUp = prevStDirection === -1 && stDir === 1;
      const priceBrokeEma21 = close > ema21 * 1.0005; // 0.05% buffer
      if (stFlippedUp || priceBrokeEma21) {
        prevStDirection = stDir;
        return { action: 'BUY', orderType: 'MARKET', qty: 1, closeOnly: true };
      }
    }

    prevStDirection = stDir;
    return { action: 'HOLD' };
  }

  strategy.meta = {
    name: 'TriplEdge Intraday Pro',
    description:
      'Triple EMA (9/21/50) + VWAP + Supertrend + RSI confluence. Best for 5-min intraday. Max 3 trades/day. 3.5:1.2 ATR target:SL.',
    indicatorOpts: {
      emaPeriods: [9, 21, 50],
      atrPeriod: 14,
      supertrendPeriod: 10,
      supertrendMultiplier: 3,
    },
  };

  return strategy;
}

module.exports = createTripleEdge;
