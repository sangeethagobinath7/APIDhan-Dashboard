'use strict';

require('dotenv').config();
const axios = require('axios');

const client = axios.create({
  baseURL: process.env.DHAN_BASE_URL || 'https://api.dhan.co/v2',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'access-token': process.env.DHAN_ACCESS_TOKEN,
    'client-id': process.env.DHAN_CLIENT_ID,
  },
  timeout: 30000,
});

const cases = [
  {
    label: 'NIFTY NSE_EQ INDEX',
    body: {
      securityId: '13',
      exchangeSegment: 'NSE_EQ',
      instrument: 'INDEX',
      interval: '5',
      oi: false,
      fromDate: '2025-03-23 09:15:00',
      toDate: '2025-06-20 15:30:00',
    },
  },
  {
    label: 'NIFTY IDX_I INDEX',
    body: {
      securityId: '13',
      exchangeSegment: 'IDX_I',
      instrument: 'INDEX',
      interval: '5',
      oi: false,
      fromDate: '2025-03-23 09:15:00',
      toDate: '2025-06-20 15:30:00',
    },
  },
  {
    label: 'BANKNIFTY NSE_EQ INDEX',
    body: {
      securityId: '25',
      exchangeSegment: 'NSE_EQ',
      instrument: 'INDEX',
      interval: '5',
      oi: false,
      fromDate: '2025-03-23 09:15:00',
      toDate: '2025-06-20 15:30:00',
    },
  },
  {
    label: 'HDFCBANK NSE_EQ EQUITY',
    body: {
      securityId: '1333',
      exchangeSegment: 'NSE_EQ',
      instrument: 'EQUITY',
      interval: '5',
      oi: false,
      fromDate: '2025-03-23 09:15:00',
      toDate: '2025-06-20 15:30:00',
    },
  },
];

async function main() {
  for (const t of cases) {
    try {
      const res = await client.post('/charts/intraday', t.body);
      const count = res.data?.timestamp?.length || 0;
      console.log(`OK  ${t.label}: ${count} candles`);
    } catch (e) {
      const d = e.response?.data || {};
      console.log(`ERR ${t.label}: status=${e.response?.status} code=${d.errorCode || '-'} msg=${d.errorMessage || d.message || e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
