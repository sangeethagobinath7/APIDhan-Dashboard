'use strict';

'use strict';

/**
 * Strategy: VWAP Cross (factory — stateful prevVwap tracking)
 *
 * Rules:
 *  - BUY  when close crosses ABOVE VWAP
 *  - SELL when close crosses BELOW VWAP
 *
 * SL   : 1.5× ATR    Target: 3× ATR  (1:2 R:R)
 */
function createVwapCross() {
  let prevVwap  = null;
  let prevClose = null;

  function strategy(candle, context) {
    const { indicators, position } = context;

    const vwap = indicators.vwap;
    const atr  = indicators['atr14'];

    if (!vwap || !atr) {
      prevVwap  = vwap;
      prevClose = candle.close;
      return { action: 'HOLD' };
    }

    const currClose = candle.close;
    const crossUp   = prevVwap !== null && prevClose < prevVwap && currClose > vwap;
    const crossDown = prevVwap !== null && prevClose > prevVwap && currClose < vwap;

    prevVwap  = vwap;
    prevClose = currClose;

    if (!position) {
      if (crossUp) {
        return { action: 'BUY',  orderType: 'MARKET', qty: 1,
                 stopLoss: currClose - 1.5 * atr, target: currClose + 3 * atr };
      }
      if (crossDown) {
        return { action: 'SELL', orderType: 'MARKET', qty: 1,
                 stopLoss: currClose + 1.5 * atr, target: currClose - 3 * atr };
      }
    }

    // Exit on opposing cross (close-only — do NOT open opposite)
    if (position) {
      if (position.side === 'BUY'  && crossDown) return { action: 'SELL', orderType: 'MARKET', qty: 1, closeOnly: true };
      if (position.side === 'SELL' && crossUp)   return { action: 'BUY',  orderType: 'MARKET', qty: 1, closeOnly: true };
    }

    return { action: 'HOLD' };
  }

  strategy.meta = {
    name: 'VWAP Cross',
    description: 'Buys when price crosses above VWAP, sells on cross below. ATR SL/target.',
    indicatorOpts: { emaPeriods: [9, 21], atrPeriod: 14 },
  };

  return strategy;
}

module.exports = createVwapCross;
