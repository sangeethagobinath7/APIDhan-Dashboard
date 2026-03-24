#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://sandbox.dhan.co/v2',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'access-token': process.env.DHAN_ACCESS_TOKEN,
    'client-id': process.env.DHAN_CLIENT_ID,
  },
  timeout: 15000,
});

async function test(secId, seg, inst, label) {
  const body = {
    securityId: secId,
    exchangeSegment: seg,
    instrument: inst,
    interval: '5',
    fromDate: '2026-02-01',
    toDate: '2026-02-28',
  };
  try {
    const r = await client.post('/charts/intraday', body);
    const n = r.data.timestamp?.length || 0;
    const first = n > 0 ? r.data.open[0] : 'N/A';
    console.log(`✅ ${label}: ${n} candles, first open=${first}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e.response?.data?.errorCode} - ${e.response?.data?.errorMessage}`);
  }
}

async function main() {
  console.log('Testing sandbox with different securityIds...\n');
  await test('13',   'NSE_EQ',  'INDEX',  'NIFTY (13, NSE_EQ, INDEX)');
  await test('13',   'IDX_I',   'INDEX',  'NIFTY (13, IDX_I, INDEX)');
  await test('25',   'NSE_EQ',  'INDEX',  'BANKNIFTY (25, NSE_EQ)');
  await test('1333', 'NSE_EQ',  'EQUITY', 'HDFCBANK (1333, NSE_EQ)');
  await test('500',  'NSE_EQ',  'EQUITY', 'HDFC (500, NSE_EQ)');
  await test('288',  'NSE_EQ',  'EQUITY', 'RELIANCE (288, NSE_EQ)');
  process.exit(0);
}
main();
