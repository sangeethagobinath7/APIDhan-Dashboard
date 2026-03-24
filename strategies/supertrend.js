'use strict';

/**
 * Strategy: Supertrend Reversal
 *
 * Rules:
 *  - BUY  when Supertrend flips from downtrend (-1) to uptrend (1)
 *  - SELL when Supertrend flips from uptrend (1) to downtrend (-1)
 *
 * SL   : Supertrend line value (dynamic trailing)
 * Target: 2× ATR
 *
 * @param {object} candle
 * @param {object} context
 * @returns {object} signal
 */
function createSupertrendStrategy(period = 7, multiplier = 3) {
  let prevDirection = null;

  function strategy(candle, context) {
    const { indicators, position, i } = context;

    const st = indicators.supertrend;
    const atr = indicators['atr14'];

    if (!st || !atr) {
      prevDirection = null;
      return { action: 'HOLD' };
    }

    const { value: stValue, direction } = st;

    const flippedUp = prevDirection === -1 && direction === 1;
    const flippedDown = prevDirection === 1 && direction === -1;

    prevDirection = direction;

    if (!position) {
      if (flippedUp) {
        return {
          action: 'BUY',
          orderType: 'MARKET',
          qty: 1,
          stopLoss: stValue,        // trailing: update stValue each candle
          target: candle.close + 2 * atr,
        };
      }
      if (flippedDown) {
        return {
          action: 'SELL',
          orderType: 'MARKET',
          qty: 1,
          stopLoss: stValue,
          target: candle.close - 2 * atr,
        };
      }
    }

    // Exit on direction flip
    if (position) {
      if (position.side === 'BUY' && flippedDown) {
        return { action: 'SELL', orderType: 'MARKET', qty: 1 };
      }
      if (position.side === 'SELL' && flippedUp) {
        return { action: 'BUY', orderType: 'MARKET', qty: 1 };
      }
    }

    return { action: 'HOLD' };
  }

  strategy.meta = {
    name: `Supertrend (${period}, ${multiplier})`,
    description: 'Enters on Supertrend direction flip. SL at Supertrend line, target at 2× ATR.',
    indicatorOpts: { emaPeriods: [9], atrPeriod: 14, supertrendPeriod: period, supertrendMultiplier: multiplier },
  };

  return strategy;
}

module.exports = createSupertrendStrategy;
