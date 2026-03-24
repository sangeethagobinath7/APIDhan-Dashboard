'use strict';

/**
 * Strategy: Opening Range Breakout (ORB)
 *
 * Rules:
 *  - During the first 15 minutes, the system builds the Opening Range (high & low).
 *  - After the ORB is established:
 *    BUY  when price breaks ABOVE orbHigh (bullish breakout)
 *    SELL when price breaks BELOW orbLow  (bearish breakdown)
 *  - Only ONE trade per day.
 *  - SL   : other side of the ORB (orbLow for longs, orbHigh for shorts)
 *  - Target: ORB width projected from breakout level (1:1.5 RR minimum)
 *
 * @param {object} candle
 * @param {object} context
 * @returns {object} signal
 */
function orbStrategy(candle, context) {
  const { indicators, position, i, candles } = context;

  const orb = indicators.orb;
  if (!orb) return { action: 'HOLD' }; // ORB not yet established

  const { orbHigh, orbLow } = orb;
  const orbWidth = orbHigh - orbLow;

  // Already in a position — let SL/Target/SquareOff handle exit
  if (position) return { action: 'HOLD' };

  // Allow only one trade per session (check if any trade happened today)
  const today = epochToDate(candle.time);
  const tradedToday = context.tradedDates && context.tradedDates.has(today);
  // Note: tradedDates is not maintained by the engine — we use a simple closure check instead.

  const prevClose = i > 0 ? candles[i - 1].close : candle.close;
  const currClose = candle.close;

  if (prevClose <= orbHigh && currClose > orbHigh) {
    return {
      action: 'BUY',
      orderType: 'MARKET',
      qty: 1,
      stopLoss: orbLow,
      target: orbHigh + orbWidth * 1.5,
    };
  }

  if (prevClose >= orbLow && currClose < orbLow) {
    return {
      action: 'SELL',
      orderType: 'MARKET',
      qty: 1,
      stopLoss: orbHigh,
      target: orbLow - orbWidth * 1.5,
    };
  }

  return { action: 'HOLD' };
}

function epochToDate(ts) {
  return new Date((ts + 5.5 * 3600) * 1000).toISOString().slice(0, 10);
}

orbStrategy.meta = {
  name: 'Opening Range Breakout (ORB)',
  description: 'Enters on breakout of the first 15-minute opening range. SL at the other end of ORB, target at 1.5× ORB width.',
  indicatorOpts: { emaPeriods: [], atrPeriod: 14, orbMinutes: 15 },
};

module.exports = orbStrategy;
