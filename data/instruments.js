'use strict';

/**
 * Master instrument lookup table.
 *
 * Keys are user-friendly symbols. Values are the fields required by Dhan API.
 *
 * exchangeSegment values:
 *   NSE_EQ  - NSE Equity
 *   BSE_EQ  - BSE Equity
 *   NSE_FNO - NSE Futures & Options
 *   BSE_FNO - BSE Futures & Options
 *   IDX_I   - Index (used for historical data of indices)
 *
 * instrument values:
 *   EQUITY, INDEX, FUTIDX, FUTSTK, OPTIDX, OPTSTK
 *
 * securityId: Dhan's unique ID for each scrip (from Dhan instrument master CSV).
 */
const INSTRUMENTS = {
  // --- Indices ---
  NIFTY: {
    securityId: '13',
    exchangeSegment: 'IDX_I',
    instrument: 'INDEX',
    name: 'Nifty 50',
  },
  BANKNIFTY: {
    securityId: '25',
    exchangeSegment: 'IDX_I',
    instrument: 'INDEX',
    name: 'Bank Nifty',
  },

  // --- Index Futures ---
  NIFTY_FUT: {
    securityId: '13',
    exchangeSegment: 'NSE_FNO',
    instrument: 'FUTIDX',
    name: 'Nifty Futures',
  },
  BANKNIFTY_FUT: {
    securityId: '25',
    exchangeSegment: 'NSE_FNO',
    instrument: 'FUTIDX',
    name: 'BankNifty Futures',
  },

  // --- Popular Equity ---
  RELIANCE: {
    securityId: '2885',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'Reliance Industries',
  },
  TCS: {
    securityId: '11536',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'TCS',
  },
  INFY: {
    securityId: '1594',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'Infosys',
  },
  HDFCBANK: {
    securityId: '1333',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'HDFC Bank',
  },
  ICICIBANK: {
    securityId: '4963',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'ICICI Bank',
  },
  SBIN: {
    securityId: '3045',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'State Bank of India',
  },
  WIPRO: {
    securityId: '3787',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'Wipro',
  },
  AXISBANK: {
    securityId: '5900',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'Axis Bank',
  },
  HCLTECH: {
    securityId: '1850',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'HCL Technologies',
  },
  KOTAKBANK: {
    securityId: '1922',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'Kotak Mahindra Bank',
  },
};

/**
 * Get instrument config by symbol.
 * @param {string} symbol - e.g. 'NIFTY', 'HDFCBANK'
 * @returns {{ securityId, exchangeSegment, instrument, name }}
 */
function getInstrument(symbol) {
  const key = symbol.toUpperCase();
  const inst = INSTRUMENTS[key];
  if (!inst) {
    throw new Error(
      `Unknown symbol: "${symbol}". Add it to data/instruments.js or provide securityId manually.`
    );
  }
  return inst;
}

/**
 * Get all available symbols.
 * @returns {string[]}
 */
function listSymbols() {
  return Object.keys(INSTRUMENTS);
}

module.exports = { getInstrument, listSymbols, INSTRUMENTS };
