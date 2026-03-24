'use strict';

const WebSocket = require('ws');
const config = require('../config/dhan');

/**
 * Minimal WebSocket wrapper for Dhan Live Market Feed.
 * Used during paper trading (forward testing).
 *
 * Usage:
 *   const ws = new DhanWebSocket();
 *   ws.on('tick', (data) => console.log(data));
 *   ws.connect([{ securityId: '13', exchangeSegment: 'NSE_EQ' }]);
 */
class DhanWebSocket {
  constructor() {
    this._ws = null;
    this._handlers = {};
    this._subscriptions = [];
  }

  on(event, handler) {
    this._handlers[event] = handler;
    return this;
  }

  _emit(event, data) {
    if (this._handlers[event]) this._handlers[event](data);
  }

  connect(instruments = []) {
    this._subscriptions = instruments;

    this._ws = new WebSocket(config.wsURL, {
      headers: {
        'access-token': config.accessToken,
        'client-id': config.clientId,
      },
    });

    this._ws.on('open', () => {
      this._emit('open');
      // Subscribe to market feed
      const subscribeMsg = {
        RequestCode: 21, // Subscribe
        InstrumentCount: instruments.length,
        InstrumentList: instruments.map((i) => ({
          ExchangeSegment: i.exchangeSegment,
          SecurityId: i.securityId,
        })),
      };
      this._ws.send(JSON.stringify(subscribeMsg));
    });

    this._ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);
        this._emit('tick', data);
      } catch {
        // Binary tick packets — pass raw buffer for advanced users
        this._emit('tick', raw);
      }
    });

    this._ws.on('error', (err) => this._emit('error', err));

    this._ws.on('close', () => {
      this._emit('close');
    });
  }

  disconnect() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}

module.exports = DhanWebSocket;
