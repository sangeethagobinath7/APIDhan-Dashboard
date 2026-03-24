# Architecture & Code Explanation

Detailed walkthrough of the Dhan Backtesting System — how each component works and fits together.

---

## 🏛️ Overall Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend (Vite)                      │
│               BacktestForm → StatsPanel → Charts                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                ┌──────▼──────┐
                │  Express    │
                │  API Server │  (server.js)
                └──────┬──────┘
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌────────┐      ┌──────────┐      ┌──────────┐
│ Dhan   │      │ Backtest │      │Analytics │
│ API    │      │ Engine   │      │ Engine   │
│Client  │      │          │      │          │
└────────┘      └──────────┘      └──────────┘
    │                 │                 │
    ├─► Data Fetcher  │  ◄─ Indicators │
    │     (batches    │  ◄─ Execution  │
    │     90 days)    │  ◄─ Position   │
    │                 │     Management │
    └─► JSON Cache    │                │
        (local store)  └─── Metrics ◄──┘
```

---

## 📂 Directory Structure

```
project-root/
├── config/
│   └── dhan.js              # Loads env variables, validates secrets
├── dhan/
│   ├── client.js            # Axios instance with auth headers
│   └── websocket.js         # Live market feed (for paper trading)
├── data/
│   ├── instruments.js       # Symbol → securityId mapping
│   ├── fetcher.js           # Fetch historical data from Dhan
│   └── store.js             # JSON cache read/write
├── engine/
│   ├── indicators.js        # Technical indicators (VWAP, EMA, ATR, etc.)
│   ├── execution.js         # Order fill simulation, SL/target logic
│   └── backtest.js          # Main backtesting loop
├── analytics/
│   ├── metrics.js           # Win rate, drawdown, Sharpe calculation
│   └── report.js            # Format results for frontend
├── strategies/
│   ├── vwap-cross.js
│   ├── ema-cross.js
│   ├── orb.js
│   └── supertrend.js
├── scripts/
│   ├── fetch-data.js        # CLI: fetch historical data
│   ├── run-backtest.js      # CLI: run backtest from terminal
│   └── smoke-test.js        # Validation test
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React component
│   │   ├── index.css        # Styling (dark theme)
│   │   ├── main.jsx         # Entry point
│   │   └── components/
│   │       ├── BacktestForm.jsx  # Left sidebar: config form
│   │       ├── StatsPanel.jsx    # Top: metric cards
│   │       ├── CandleChart.jsx   # Candlestick + markers
│   │       ├── EquityCurve.jsx   # Area chart
│   │       └── TradeLog.jsx      # Sortable table
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── node_modules/
├── cache/                       # JSON cache files (auto-created)
│   ├── NIFTY_NSE_EQ_5.json
│   └── ...
├── node_modules/
├── .env                         # Secrets (DO NOT COMMIT)
├── .env.example
├── .gitignore
├── package.json
├── server.js                    # Express server entry point
├── README.md
├── ARCHITECTURE.md              # This file
└── requirement.md
```

---

## 🔑 Core Modules

### 1. config/dhan.js

**Purpose**: Load and validate environment variables.

```javascript
require('dotenv').config();

const config = {
  clientId: process.env.DHAN_CLIENT_ID,
  accessToken: process.env.DHAN_ACCESS_TOKEN,
  baseURL: 'https://api.dhan.co/v2',
  port: process.env.PORT || 3000,
};
```

**Key Points**:
- Fails at startup if `DHAN_CLIENT_ID` or `DHAN_ACCESS_TOKEN` missing
- Never logs credentials (masked for security)

---

### 2. dhan/client.js

**Purpose**: Pre-configured Axios instance for Dhan API calls.

```javascript
const dhanClient = axios.create({
  baseURL: 'https://api.dhan.co/v2',
  headers: {
    'access-token': config.accessToken,
    'Content-Type': 'application/json',
  },
});
```

**Key Points**:
- **Every request** automatically includes the `access-token` header
- Error handler strips credentials before logging
- Used by `data/fetcher.js` to fetch historical data

---

### 3. data/instruments.js

**Purpose**: Master registry of tradeable instruments with their Dhan identifiers.

```javascript
const INSTRUMENTS = {
  NIFTY: {
    securityId: '13',           // Dhan's internal ID
    exchangeSegment: 'NSE_EQ',  // Exchange segment
    instrument: 'INDEX',        // Instrument type
    name: 'Nifty 50',
  },
  HDFCBANK: {
    securityId: '1333',
    exchangeSegment: 'NSE_EQ',
    instrument: 'EQUITY',
    name: 'HDFC Bank',
  },
  // ... more instruments
};
```

**Key Points**:
- `securityId` is required by every Dhan API call
- Maps user-friendly symbols (NIFTY) → Dhan's securityId (13)
- Supports multiple exchanges and segments

---

### 4. data/fetcher.js

**Purpose**: Fetch historical candles from Dhan API, handling the 90-day limit intelligently.

```javascript
async function fetchIntraday(opts) {
  // Dhan limits intraday to 90 days max per request
  // This function batches multiple requests automatically
  
  const BATCH_DAYS = 89;
  let cursor = new Date(fromDate);
  const allCandles = [];
  
  while (cursor < end) {
    const batchEnd = addDays(cursor, BATCH_DAYS);
    // Fetch candles for this 90-day window
    allCandles.push(...await dhanClient.post('/charts/intraday', { ... }));
    cursor = addDays(batchEnd, 1);
  }
  
  // Deduplicate and cache
  return deduped;
}
```

**Key Points**:
- **Auto-batches**: Fetching 1 year of 5-min data splits into 4 × 90-day calls
- **Caches locally**: Stores in `cache/SYMBOL_SEGMENT_INTERVAL.json`
- **Returns normalized candles**: `[{ time, open, high, low, close, volume }, ...]`
- Respects rate limits (400ms pause between batch calls)

---

### 5. engine/indicators.js

**Purpose**: Calculate technical indicators — VWAP, EMA, ATR, Supertrend, CPR, ORB.

**Key principle: NO LOOKAHEAD**. All indicators only look at candles `[0..i]` (present + past, never future).

#### VWAP (Volume Weighted Average Price)

```javascript
function vwapAt(candles, i) {
  // VWAP resets each trading day
  const currentDate = timestampToDate(candles[i].time);
  let cumTPV = 0, cumVol = 0;
  
  // Sum only candles from today's open to now
  for (let j = i; j >= 0; j--) {
    if (timestampToDate(candles[j].time) !== currentDate) break;
    const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
    cumTPV += tp * candles[j].volume;
    cumVol += candles[j].volume;
  }
  
  return cumVol === 0 ? null : cumTPV / cumVol;
}
```

#### EMA (Exponential Moving Average)

```javascript
function emaAt(candles, period, i) {
  const k = 2 / (period + 1);  // Smoothing constant
  
  if (i < period - 1) return null;  // Not enough data
  
  // Seed with SMA
  let ema = 0;
  for (let j = 0; j < period; j++) ema += candles[j].close;
  ema /= period;
  
  // Apply exponential smoothing forward
  for (let j = period; j <= i; j++) {
    ema = candles[j].close * k + ema * (1 - k);
  }
  return ema;
}
```

#### Supertrend

Uses ATR and adapting upper/lower bands:

```javascript
function supertrendArray(candles, period = 7, multiplier = 3) {
  // Compute ATR for all candles
  // Build basic bands: HL2 ± (multiplier × ATR)
  // Adjust bands using previous values (prevents whipsaws)
  // Return array of { value, direction: 1|-1 }
}
```

**Key Points**:
- `buildIndicatorSeries()` pre-computes all indicators for efficiency
- Instead of re-calculating per candle, compute once at start
- Returns indicator arrays keyed by name: `{ vwap, ema9, ema21, atr14, ... }`

---

### 6. engine/execution.js

**Purpose**: Simulate realistic order fills.

```javascript
function marketFillPrice(nextCandle, side, slippagePct) {
  // Market order fills at NEXT candle's open ± slippage
  const slip = nextCandle.open * (slippagePct / 100);
  return side === 'BUY'
    ? nextCandle.open + slip  // adverse slippage going up for buys
    : nextCandle.open - slip; // adverse slippage going down for sells
}

function checkStopAndTarget(candle, side, stopLoss, target) {
  // Check if SL or target hit within this candle
  if (side === 'BUY') {
    if (stopLoss && candle.low <= stopLoss) return { hit: 'SL', price: stopLoss };
    if (target && candle.high >= target) return { hit: 'TARGET', price: target };
  }
  // ... short logic
}

function calcPnl(entrySide, entryPrice, exitPrice, qty, brokerage) {
  const grossPnl = entrySide === 'BUY'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
  
  const totalBrokerage = brokerage * 2;  // entry + exit
  return { grossPnl, brokerage: totalBrokerage, netPnl: grossPnl - totalBrokerage };
}
```

**Key Points**:
- Market orders fill at **NEXT candle's open** (prevents lookahead)
- Limit orders only fill if candle range touches price
- Stop-loss & targets checked **every candle** while position is open
- Brokerage = flat ₹20 per order (entry + exit = ₹40/trade)

---

### 7. engine/backtest.js

**Purpose**: Main backtesting loop — the core engine.

```javascript
function runBacktest(opts) {
  const { candles, strategyFn, capital, indicatorOpts } = opts;
  
  // Pre-compute all indicators once (efficient)
  const indicatorSeries = buildIndicatorSeries(candles, indicatorOpts);
  
  let capital = initialCapital;
  let position = null;  // { side, entryPrice, qty, entryTime, stopLoss, target }
  const trades = [];
  
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    
    // ① Check if existing position hits SL or target
    if (position) {
      const { hit, price } = checkStopAndTarget(candle, position.side, ...);
      if (hit) {
        // Close position, record trade
        trades.push({ ... });
        position = null;
      }
    }
    
    // ② Build context (NO FUTURE DATA)
    const context = {
      candles: candles.slice(0, i + 1),  // Only past + current, never future
      i,
      indicators: { vwap: indicatorSeries.vwap[i], ... },
      position,
      capital,
    };
    
    // ③ Call user strategy
    const signal = strategyFn(candle, context);
    
    // ④ Process signal (open/close position)
    if (signal.action === 'BUY' || signal.action === 'SELL') {
      // Close opposite position if open
      // Open new position at NEXT candle (no lookahead)
      position = { side: signal.action, entryPrice, ... };
    }
    
    // ⑤ Track equity
    equity.push({ time: candle.time, value: capital });
  }
  
  // Close any remaining position at the end
  if (position) { ... }
  
  return { trades, equity, finalCapital: capital };
}
```

**Key Points**:
- **No lookahead bias**: Strategy at index `i` sees only `candles[0..i]`
- **Intraday square-off**: Auto-closes positions at 15:15 IST
- Market orders fill at **next candle** (prevents impossible prices)
- Indicator series pre-computed for speed
- Equity tracked per candle (for drawdown calculation)

---

### 8. analytics/metrics.js

**Purpose**: Calculate performance statistics from trade log.

```javascript
function calcMetrics({ trades, equity, initialCapital }) {
  const winners = trades.filter(t => t.netPnl > 0);
  const losers = trades.filter(t => t.netPnl <= 0);
  
  const netPnl = trades.reduce((s, t) => s + t.netPnl, 0);
  const winRate = winners.length / trades.length;
  const avgWin = winners.length > 0 ? winners.reduce(...) / winners.length : 0;
  const avgLoss = Math.abs(losers.reduce(...) / losers.length);
  
  // R:R ratio
  const avgRR = avgWin / avgLoss;
  
  // Profit Factor = sum of wins / sum of losses
  const profitFactor = grossWins / grossLosses;
  
  // Expectancy = (winRate × avgWin) - ((1 - winRate) × avgLoss)
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;
  
  // Max Drawdown
  const { maxDrawdown, maxDrawdownPct } = calcMaxDrawdown(equity);
  
  // Sharpe Ratio (daily returns annualized)
  const sharpeRatio = calcSharpeRatio(equity, riskFreeRate);
  
  return { netPnl, winRate, avgWin, avgRR, profitFactor, expectancy, ... };
}
```

**Metrics Explained:**

| Metric | Formula | Interpretation |
|--------|---------|-----------------|
| **Win Rate** | wins / total | % of profitable trades |
| **Avg R:R** | avgWin / avgLoss | Reward-to-risk ratio (>1.5 is good) |
| **Profit Factor** | sum(wins) / sum(losses) | >1.5 generally viable |
| **Max Drawdown** | peak → trough | Worst capital loss % |
| **Expectancy** | (WR × W) - (LR × L) | Avg P&L per trade |
| **Sharpe Ratio** | (mean return - risk-free) / std dev | Risk-adjusted return (>1.0 good) |

---

### 9. frontend/src/App.jsx

**Purpose**: Main React dashboard layout.

```javascript
export default function App() {
  const [symbols, setSymbols] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');
  
  useEffect(() => {
    fetch('/api/symbols').then(r => r.json()).then(d => setSymbols(d.symbols));
    fetch('/api/strategies').then(r => r.json()).then(d => setStrategies(d.strategies));
  }, []);
  
  async function handleRun(params) {
    const res = await fetch('/api/backtest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json();
    setReport(data.report);
  }
  
  return (
    <div style={{ display: 'flex' }}>
      <BacktestForm onRun={handleRun} />
      <main>
        <StatsPanel summary={report.summary} />
        {activeTab === 'chart' && <CandleChart trades={report.trades} />}
        {activeTab === 'equity' && <EquityCurve equity={report.equity} />}
        {activeTab === 'trades' && <TradeLog trades={report.trades} />}
      </main>
    </div>
  );
}
```

**Components:**
- **BacktestForm**: Left sidebar — input form for backtest parameters
- **StatsPanel**: Top bar — metric card display
- **CandleChart**: Line chart with Buy/Sell markers (lightweight-charts)
- **EquityCurve**: Area chart of capital over time
- **TradeLog**: Sortable table of all trades with entry/exit details

---

### 10. server.js

**Purpose**: Express API server — routes and handlers.

```javascript
// GET /api/symbols
app.get('/api/symbols', (req, res) => {
  res.json({ symbols: listSymbols() });
});

// POST /api/backtest
app.post('/api/backtest', async (req, res) => {
  const { symbol, interval, fromDate, toDate, strategy, capital } = req.body;
  
  // Fetch candles
  const candles = await fetchCandles({ symbol, interval, fromDate, toDate });
  
  // Get strategy function
  const strategyFn = STRATEGIES[strategy]();
  
  // Run backtest
  const result = runBacktest({ candles, strategyFn, capital, ... });
  
  // Format report
  const report = buildReport({ ...result, symbol, interval, ... });
  
  // Cache result
  saveJSON(`run_${Date.now()}`, report);
  
  res.json({ runId, report });
});
```

**Flow:**
1. Client calls `POST /api/backtest` with parameters
2. Server fetches (or loads from cache) candles via Dhan API
3. Runs backtest engine with user's strategy
4. Calculates metrics and formats report
5. Caches result in `cache/run_TIMESTAMP.json`
6. Returns full report to frontend

---

## 🔄 Data Flow Diagram

### Running a Backtest

```
User fills form in Frontend
           │
           ▼
   POST /api/backtest
           │
           ├─► Check /cache if exists
           │
           ├─► No cache? Fetch from Dhan API
           │    └─► Batch 90-day chunks
           │    └─► Save to /cache
           │
           ▼
   Get candles array
           │
           ├─► Build indicator series (pre-compute all at once)
           │    ├─ VWAP, EMA, ATR, Supertrend, CPR, ORB
           │    └─ Return: { vwap[], ema9[], ... }
           │
           ▼
   Call runBacktest()
           │
           ├─► Loop i=0 to candles.length
           │    │
           │    ├─ Check SL/target on current position
           │    │
           │    ├─ Build context (candles[0..i], indicators[i])
           │    │
           │    ├─ Call strategyFn(candle, context)
           │    │
           │    ├─ Process signal (fill at NEXT candle)
           │    │
           │    └─ Track equity
           │
           └─► Return { trades[], equity[], finalCapital }
                   │
                   ▼
           Calculate metrics
           (Win Rate, Sharpe, etc.)
                   │
                   ▼
           Format report
           (meta, summary, trades, equity)
                   │
                   ▼
           Return to Frontend
                   │
                   ▼
           Render Charts + Tables
```

---

## 🛡️ Design Principles

### 1. **No Lookahead Bias**

Every decision is made with **only past data**:
- Strategy sees `candles[0..i]`, never `[i+1..]`
- Market orders fill at `candles[i+1]` open (not current)
- Indicators only look backward

### 2. **Efficiency via Pre-computation**

Instead of:
```javascript
// ❌ Slow: recalculate EMA from scratch per candle
for (let i = 0; i < candles.length; i++) {
  const ema = emaAt(candles, 21, i);  // Recalculates each iteration
}
```

We do:
```javascript
// ✅ Fast: compute once, index as needed
const ema21 = ema(candles, 21);  // O(n) once
for (let i = 0; i < candles.length; i++) {
  const val = ema21[i];  // O(1) lookup
}
```

### 3. **Separation of Concerns**

- **Data layer** (fetcher, store): Manage candles
- **Indicator layer**: Calculate technical values
- **Execution layer**: Simulate order fills
- **Backtest layer**: Orchestrate the simulation
- **Analytics layer**: Compute statistics

Each module is **independent** and **testable**.

### 4. **Realistic Simulation**

- Market orders fill at next candle's open (not current bar)
- Slippage applied to entry and exit
- Stop-loss checked on bar low/high (intraday square-off at 15:15)
- Brokerage deducted per trade

---

## 🧪 Testing

**Smoke Test** (validates end-to-end):
```bash
node scripts/smoke-test.js
```

Generates 200 synthetic candles, runs EMA Cross strategy, validates:
- Trades generated
- P&L calculated
- Metrics computed
- No crashes

---

## 🚀 Performance Notes

### Memory Efficiency

- Candles stored as normalized array of objects (light on memory)
- Indicators pre-computed once (no redundant calculation)
- Context slicing (`candles.slice(0, i+1)`) is O(n), not a bottleneck for typical data

### Speed

- 1 year of 5-min data (≈250k candles): ~500-800ms to backtest
- Daily data (≈252 candles): <50ms
- Network (Dhan API): 400ms pause between 90-day batches (respect rate limits)

---

## 📖 How Strategies Work

### Opening Context

```javascript
function strategy(candle, context) {
  const { 
    candles,              // Array of { time, open, high, low, close, volume }
    i,                    // Current index (0-based)
    indicators,           // { vwap, ema9, ema21, atr14, supertrend, ... }[i]
    position,             // null or { side, entryPrice, qty, entryTime, stopLoss, target }
    capital,              // Current capital in account
    initialCapital        // Starting capital
  } = context;
  
  // Your logic here
}
```

### Return Signal

```javascript
{
  action: 'BUY' | 'SELL' | 'HOLD',
  orderType: 'MARKET' | 'LIMIT',
  price: null or limit_price,
  qty: 1,
  stopLoss: price or null,
  target: price or null
}
```

### Example: Simple MA Crossover

```javascript
function maStrategy(candle, context) {
  const { indicators, position, i } = context;
  
  if (i < 21) return { action: 'HOLD' };  // Not enough EMA data
  
  const ema9 = indicators.ema9;
  const ema21 = indicators.ema21;
  
  // Simple: no position memory across candles
  // Just check current vs previous
  if (i > 0) {
    const prevEma9 = context.candles[i-1]?.ema9;  // Won't have this
    // Need to use a factory for stateful logic (see ema-cross.js)
  }
  
  return { action: 'HOLD' };
}
```

**For stateful logic**, use a closure:

```javascript
function createStrategy() {
  let prevEma9 = null;
  
  return function strategy(candle, context) {
    const ema9 = context.indicators.ema9;
    
    if (prevEma9 && prevEma9 < ema21 && ema9 > ema21) {
      // Crossover detected
      return { action: 'BUY', ... };
    }
    
    prevEma9 = ema9;
    return { action: 'HOLD' };
  };
}

module.exports = createStrategy;
```

---

## 🔗 Example Request Flow

**1. User configures & submits form**

```
Form Data:
{
  symbol: "NIFTY",
  interval: "5",
  fromDate: "2024-01-01",
  toDate: "2024-06-30",
  strategy: "vwap-cross",
  capital: 100000
}
```

**2. Frontend posts to /api/backtest**

```javascript
POST /api/backtest
{
  "symbol": "NIFTY",
  "interval": "5",
  "fromDate": "2024-01-01",
  "toDate": "2024-06-30",
  "strategy": "vwap-cross",
  "capital": 100000,
  "brokerage": 20,
  "slippagePct": 0.05
}
```

**3. Server processes**

- Checks cache: is `cache/NIFTY_NSE_EQ_5.json` already loaded?
  - **YES**: Load from file (fast, <100ms)
  - **NO**: Batch-fetch 90-day chunks from Dhan API, save cache
- Load vwap-cross strategy: `require('./strategies/vwap-cross.js')`
- Call `runBacktest(candles, strategyFn, capital, ...)`
  - Pre-compute indicators
  - Loop 183 candles × 181 candles of trading
  - Simulate entries/exits
  - Compute equity curve
- Call `calcMetrics(trades, equity)`
- Call `buildReport(...)`
- Cache result: `cache/run_1708903421234.json`
- Return report to frontend

**4. Frontend displays**

- Stats panel (win rate, P&L, etc.)
- Candle chart with Buy/Sell markers
- Equity curve
- Trade log table

---

## 📡 Dhan API Integration Points

### 1. Historical Data Fetching

```javascript
// dhan/client.js
POST /charts/intraday
{
  securityId: "13",
  exchangeSegment: "NSE_EQ",
  instrument: "INDEX",
  interval: "5",
  fromDate: "2024-01-01 09:30:00",
  toDate: "2024-03-30 15:30:00"
}
// Response: { open: [...], high: [...], close: [...], volume: [...], timestamp: [...] }
```

### 2. Live Market Feed (Future: Paper Trading)

```javascript
// dhan/websocket.js
new DhanWebSocket()
  .on('tick', (data) => {
    // Real-time price updates
    // Feed into paper trading engine
  })
  .connect([{ securityId: '13', exchangeSegment: 'NSE_EQ' }])
```

---

## Summary

This architecture provides:

✅ **Separation of Concerns** — Each module has one job  
✅ **No Lookahead Bias** — Realistic backtesting  
✅ **Efficiency** — Pre-computed indicators, cached data  
✅ **Extensibility** — Easy to add new strategies, indicators  
✅ **Realistic Simulation** — Slippage, brokerage, SL/target logic  
✅ **Rich Output** — Trades, metrics, equity curve, charts  

See `README.md` for quick-start and usage examples.
