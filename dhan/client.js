'use strict';

const axios = require('axios');
const config = require('../config/dhan');

/**
 * Axios instance pre-configured for the Dhan API v2.
 * All requests automatically include the required access-token header.
 */
const dhanClient = axios.create({
  baseURL: config.baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'access-token': config.accessToken,
    'client-id': config.clientId,
  },
  timeout: 30000,
});

// Log API errors clearly without exposing the token
dhanClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const errorCode = err.response?.data?.errorCode;
    const errorMessage =
      err.response?.data?.errorMessage ||
      err.response?.data?.message ||
      err.message;

    if (errorCode === 'DH-906') {
      throw new Error(
        `Dhan API error ${status} (${errorCode}): ${errorMessage}. ` +
        'Regenerate DHAN_ACCESS_TOKEN from Dhan Developer portal and update your .env file.'
      );
    }

    throw new Error(`Dhan API error ${status}${errorCode ? ` (${errorCode})` : ''}: ${errorMessage}`);
  }
);

module.exports = dhanClient;
