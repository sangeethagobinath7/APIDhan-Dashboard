'use strict';

/**
 * Strategy: EMA Crossover
 *
 * Rules:
 *  - BUY  when fast EMA (9) crosses ABOVE slow EMA (21)
 *  - SELL when fast EMA (9) crosses BELOW slow EMA (21)
 *
 * SL   : 1.5× ATR below/above entry
 * Target: 2× ATR (1:1.33 RR)
 *
 * @param {object} candle
 * @param {object} context
 * @returns {object} signal
 */
function emaCrossStrategy(candle, context) {
  const { indicators, position, i, candles } = context;

  if (i < 22) return { action: 'HOLD' }; // Not enough data for EMA(21)

  const ema9 = indicators.ema9;
  const ema21 = indicators.ema21;
  const prevEma9 = i > 0 ? context.candles[i - 1]._ema9 : null;
  const prevEma21 = i > 0 ? context.candles[i - 1]._ema21 : null;
  const atr = indicators['atr14'];

  if (!ema9 || !ema21 || !atr) return { action: 'HOLD' };

  // Retrieve previous candle's EMA values from the precomputed series
  // The indicator series is only in `indicators` at the current index.
  // Access via the passed pre-built series trick: indicators contain [i] values.
  // For cross detection, we need [i-1] values — check candles array won't have them,
  // so the strategy fetches from the indicatorSeries via closure.
  // Since we don't have direct access to prior indicator values here without the full series,
  // we approximate: if current ema9 > ema21 and gap is newly formed, that's our cross condition.

  // Simple approach: if candles list length changed, detect cross on last 2 indicators
  // (The strategy context only gets indicators[i], not [i-1]. For production, strategies
  //  should be written to track state across calls. Here we use a stateful closure.)

  return { action: 'HOLD' }; // See stateful version below
}

/**
 * Factory that creates a stateful EMA crossover strategy function.
 * Use this instead of emaCrossStrategy directly.
 *
 * @returns {Function} strategyFn
 */
function createEmaCross() {
  let prevEma9 = null;
  let prevEma21 = null;

  function strategy(candle, context) {
    const { indicators, position, i } = context;

    if (i < 22) return { action: 'HOLD' };

    const ema9 = indicators.ema9;
    const ema21 = indicators.ema21;
    const atr = indicators['atr14'];

    if (!ema9 || !ema21 || !atr) {
      prevEma9 = ema9;
      prevEma21 = ema21;
      return { action: 'HOLD' };
    }

    const crossUp = prevEma9 !== null && prevEma9 < prevEma21 && ema9 > ema21;
    const crossDown = prevEma9 !== null && prevEma9 > prevEma21 && ema9 < ema21;

    prevEma9 = ema9;
    prevEma21 = ema21;

    if (!position) {
      if (crossUp) {
        return {
          action: 'BUY',
          orderType: 'MARKET',
          qty: 1,
          stopLoss: candle.close - 1.5 * atr,
          target: candle.close + 2 * atr,
        };
      }
      if (crossDown) {
        return {
          action: 'SELL',
          orderType: 'MARKET',
          qty: 1,
          stopLoss: candle.close + 1.5 * atr,
          target: candle.close - 2 * atr,
        };
      }
    }

    // Flip on cross (close-only — don't auto-open opposite position)
    if (position && position.side === 'BUY' && crossDown) {
      return { action: 'SELL', orderType: 'MARKET', qty: 1, closeOnly: true };
    }
    if (position && position.side === 'SELL' && crossUp) {
      return { action: 'BUY', orderType: 'MARKET', qty: 1, closeOnly: true };
    }

    return { action: 'HOLD' };
  }

  strategy.meta = {
    name: 'EMA Crossover (9/21)',
    description: 'Buys on EMA9 crossing above EMA21, sells on cross below. ATR-based SL/target.',
    indicatorOpts: { emaPeriods: [9, 21], atrPeriod: 14 },
  };

  return strategy;
}

module.exports = createEmaCross;
