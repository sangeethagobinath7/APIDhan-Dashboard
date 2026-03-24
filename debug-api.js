#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const dhanClient = axios.create({
  baseURL: 'https://api.dhan.co/v2',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'access-token': process.env.DHAN_API_KEY,
  },
  timeout: 30000,
});

async function testFetch() {
  try {
    console.log('Testing endpoints...\n');
    
    // Test 1: GET request
    console.log('1. Testing GET /user/info...');
    try {
      const res = await dhanClient.get('/user/info');
      console.log('✓ User info:', res.data);
    } catch (err) {
      console.log('✗ Error:', err.response?.status, err.response?.data || err.message);
    }
    
    // Test 2: POST with correct format
    console.log('\n2. Testing POST /charts/intraday with numeric securityId...');
    const body = {
      securityId: 1333,
      exchangeSegment: 'NSE_EQ',
      instrument: 'EQUITY',
      interval: 1,
      fromDate: '2026-03-16',
      toDate: '2026-03-23',
    };
    
    console.log('Sending body:', JSON.stringify(body));
    const res = await dhanClient.post('/charts/intraday', body);
    console.log('✓ Response:', res.data.slice(0, 200) + '...');
  } catch (err) {
    console.error('❌ Error:', err.response?.status, err.response?.data || err.message);
  }
}

testFetch();
