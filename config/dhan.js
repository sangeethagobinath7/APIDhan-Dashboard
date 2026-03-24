'use strict';

require('dotenv').config();

const config = {
  clientId: process.env.DHAN_CLIENT_ID,
  accessToken: process.env.DHAN_ACCESS_TOKEN,
  baseURL: process.env.DHAN_BASE_URL || 'https://api.dhan.co/v2',
  strictRealData: process.env.DHAN_STRICT_MODE !== 'false',
  wsURL: 'wss://api-order-update.dhan.co',
  port: parseInt(process.env.PORT, 10) || 3000,
};

if (!config.clientId || !config.accessToken) {
  throw new Error(
    'Missing DHAN_CLIENT_ID or DHAN_ACCESS_TOKEN in environment. Copy .env.example to .env and fill in values.'
  );
}

module.exports = config;
