# Dhan Backtesting & Forward Testing System

A fast, scalable backtesting engine integrated with **Dhan API** for stock market strategy testing. Build, test, and validate trading strategies using historical and real-time market data.

---

## 🎯 What It Does

- **Backtest Strategies**: Run historical simulations of trading ideas on 1m, 5m, 15m, 1h, 1d candles
- **Multiple Instruments**: Test on Nifty 50, BankNifty, individual stocks, futures, options
- **Built-in Indicators**: VWAP, EMA, ATR, Supertrend, CPR, ORB
- **Pre-built Strategies**: VWAP Cross, EMA Crossover, Opening Range Breakout, Supertrend
- **Realistic Simulation**: Market/limit orders, slippage, brokerage, stop-loss, targets
- **Rich Analytics**: Win rate, max drawdown, Sharpe ratio, profit factor, equity curve
- **Web Dashboard**: React frontend with candlestick charts, equity curve, trade log
- **REST API**: Test strategies programmatically

---

## ⚡ Quick Start

### 1. Install Dependencies

```bash
cd /Users/gobinath-2857/Documents/Dhan-test

# Backend
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 2. Configure Dhan API Credentials

Copy `.env.example` to `.env` and fill in your Dhan credentials:

```bash
cp .env.example .env
```

Edit `.env`:
```
DHAN_CLIENT_ID=your_client_id
DHAN_ACCESS_TOKEN=your_access_token
PORT=3000
```

Your access token from the requirement.md is already in `.env` (expires 24 hours).

### 3. Start the Server

```bash
# Backend API (runs on port 3000)
node server.js
```

You'll see:
```
🚀 Dhan Backtest Server running on http://localhost:3000
```

### 4. Start the Frontend (in another terminal)

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📖 How to Use

### Web Dashboard

1. **Configure Backtest**:
   - Pick a symbol (NIFTY, HDFCBANK, etc.)
   - Choose timeframe (5m, 15m, 1h, 1d)
   - Set date range
   - Pick a strategy (VWAP Cross, EMA Crossover, etc.)
   - Adjust capital, brokerage, slippage

2. **Run Backtest**: Click "Run Backtest"

3. **View Results**:
   - **📊 Stats Panel**: Net P&L, return %, win rate, max drawdown, Sharpe ratio
   - **📈 Chart Tab**: Candlestick chart with Buy/Sell markers
   - **📊 Equity Curve Tab**: Capital growth over time
   - **📋 Trade Log Tab**: Detailed trade-by-trade breakdown

### Command Line

**Fetch historical data:**
```bash
node scripts/fetch-data.js \
  --symbol NIFTY \
  --interval 5 \
  --from 2024-01-01 \
  --to 2024-12-31
```

**Run backtest from command line:**
```bash
node scripts/run-backtest.js \
  --symbol HDFCBANK \
  --interval 15 \
  --from 2024-01-01 \
  --to 2024-06-30 \
  --strategy ema-cross
```

**Available strategies**: `vwap-cross`, `ema-cross`, `supertrend`, `orb`

---

## 🔌 REST API

### Endpoints

**Get Available Symbols**
```bash
GET /api/symbols
```

**Get Available Strategies**
```bash
GET /api/strategies
```

**Fetch & Cache Historical Data**
```bash
POST /api/fetch-data
Content-Type: application/json

{
  "symbol": "NIFTY",
  "interval": "5",
  "fromDate": "2024-01-01",
  "toDate": "2024-12-31"
}
```

**Run Backtest**
```bash
POST /api/backtest
Content-Type: application/json

{
  "symbol": "NIFTY",
  "interval": "5",
  "fromDate": "2024-01-01",
  "toDate": "2024-06-30",
  "strategy": "vwap-cross",
  "capital": 100000,
  "brokerage": 20,
  "slippagePct": 0.05,
  "intradaySquareOff": true
}
```

**Response:**
```json
{
  "runId": "run_1708903421234",
  "report": {
    "meta": { "symbol", "interval", "strategyName", "finalCapital" },
    "summary": { "netPnl", "returnPct", "winRate", "maxDrawdown", ... },
    "trades": [ { "id", "side", "entryPrice", "exitPrice", "netPnl", ... } ],
    "equity": [ { "time", "value" } ]
  }
}
```

**Get Backtest Results**
```bash
GET /api/results/:runId
GET /api/results             # List all cached runs
```

---

## 📊 Example Output

```
═══════════════════════════════════════════════
  Strategy      : VWAP Cross
  Capital       : ₹100,000
  Final Capital : ₹105,234
───────────────────────────────────────────────
  Net P&L       : ₹5,234 (5.23%)
  Total Trades  : 12
  Win Rate      : 66.67%
  Avg Win       : ₹650
  Avg Loss      : ₹450
  Avg R:R       : 1.44
  Profit Factor : 2.15
  Expectancy    : ₹436.17
  Max Drawdown  : ₹3,200 (3.2%)
═══════════════════════════════════════════════
```

---

## 🏗️ Dataset Cache

Historical data is cached locally in JSON format:

```
cache/
├── NIFTY_NSE_EQ_5.json       # 5-min Nifty candles
├── HDFCBANK_NSE_EQ_15.json   # 15-min HDFC candles
└── NIFTY_NSE_EQ_D.json       # Daily Nifty
```

Each file is a JSON array of candles with `{ time, open, high, low, close, volume }`.

---

## 🎓 Supported Strategies

### VWAP Cross
- Buys when price crosses **above** VWAP
- Sells when price crosses **below** VWAP
- Uses ATR-based stop-loss and 1:2 risk-reward target

### EMA Crossover (9/21)
- Buys when EMA(9) crosses **above** EMA(21)
- Sells when EMA(9) crosses **below** EMA(21)
- Stateful: tracks previous indicator values

### Supertrend
- Enters on **direction flip** of Supertrend indicator
- Uses Supertrend line as dynamic stop-loss
- 2× ATR as target

### Opening Range Breakout (ORB)
- Builds opening range from first 15 minutes
- Buys on **breakout above** ORB high
- Sells on **breakdown below** ORB low
- 1.5× ORB width as target

---

## 🛠️ Advanced: Write Your Own Strategy

Create a file `strategies/my-strategy.js`:

```javascript
function myStrategy(candle, context) {
  const { indicators, position, capital } = context;
  
  const vwap = indicators.vwap;
  const atr = indicators['atr14'];
  
  if (!position && candle.close > vwap) {
    return {
      action: 'BUY',
      orderType: 'MARKET',
      qty: 1,
      stopLoss: candle.close - 2 * atr,
      target: candle.close + 3 * atr
    };
  }
  
  return { action: 'HOLD' };
}

myStrategy.meta = {
  name: 'My Strategy',
  description: 'Buy above VWAP with ATR-based SL/target',
  indicatorOpts: { emaPeriods: [9, 21], atrPeriod: 14 }
};

module.exports = myStrategy;
```

Then register it in `server.js`:

```javascript
const STRATEGIES = {
  'my-strategy': () => require('./strategies/my-strategy.js'),
  // ... other strategies
};
```

---

## 🔒 Security Notes

- **Never commit `.env`** — it contains your Dhan access token
- Access token in the system expires in 24 hours; request a new one from Dhan
- Use `.env.example` as a template; change credentials for production

---

## 🐛 Troubleshooting

**"Cannot find module 'axios'"**
```bash
npm install
```

**Port 3000 already in use**
```bash
PORT=3001 node server.js
```

**Frontend can't reach API**
- Ensure backend is running on port 3000
- Check browser console for CORS errors
- Vite dev server proxies `/api` to `localhost:3000`

**No data from Dhan API**
- **Automatic Fallback**: If the Dhan API returns an error (e.g., 400), the system automatically generates synthetic historical data for testing. This allows you to continue backtesting even if the real API fails.
- **When This Happens**: Check logs for `[fetcher] API failed` and `using synthetic data for testing`
- **Real Data**: To use actual Dhan data, verify:
  - `.env` has valid `DHAN_CLIENT_ID` and `DHAN_ACCESS_TOKEN`
  - Token hasn't expired (valid for 24 hours from generation)
  - Symbol exists in Dhan's instrument list (see `/api/symbols`)
  - API endpoint is accessible from your network

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| `server.js` | Express API server + route handlers |
| `engine/backtest.js` | Main backtest loop (core engine) |
| `engine/indicators.js` | Technical indicators (VWAP, ATR, etc.) |
| `data/fetcher.js` | Dhan API integration + 90-day batching |
| `data/store.js` | JSON cache layer |
| `frontend/src/App.jsx` | React dashboard |
| `strategies/*.js` | Pre-built strategy implementations |

See `ARCHITECTURE.md` for detailed code walkthrough.

---

## 📝 License

Proprietary — Built for Dhan API testing.
