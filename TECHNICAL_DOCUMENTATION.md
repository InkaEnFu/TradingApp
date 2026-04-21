# Technical Documentation – ZenTrade

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Application Architecture](#3-application-architecture)
4. [File Structure](#4-file-structure)
5. [Database](#5-database)
6. [Authentication & Security](#6-authentication--security)
7. [Backend – API Endpoints](#7-backend--api-endpoints)
8. [Trading Logic](#8-trading-logic)
9. [Portfolio Management](#9-portfolio-management)
10. [Pies System](#10-pies-system)
11. [Market Data Fetching](#11-market-data-fetching)
12. [Backtesting](#12-backtesting)
13. [Frontend](#13-frontend)
14. [Background Tasks](#14-background-tasks)
15. [Caching & Optimization](#15-caching--optimization)
16. [Deployment](#16-deployment)
17. [Configuration & Environment Variables](#17-configuration--environment-variables)

---

## 1. Project Overview

**ZenTrade** is a web application for simulating investments on financial markets. It enables users to trade stocks, cryptocurrencies, forex, and commodities using real market data from Yahoo Finance – without any risk of losing real money.

### Key Features

- Multi-user system with secure authentication
- Virtual account with an initial balance of **$100,000**
- Trading stocks, cryptocurrencies, commodities, and forex pairs
- Market orders (instant) and conditional orders (Target Buy/Sell)
- Interactive charts (line and candlestick)
- "Pies" system for automated portfolio allocation
- Backtesting – historical investment simulation
- Trade history and performance statistics
- Responsive design for desktop and mobile devices

---

## 2. Technology Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| **Python** | 3.x | Primary programming language |
| **FastAPI** | latest | Asynchronous web framework |
| **Uvicorn** | latest | ASGI server |
| **yfinance** | latest | Fetching market data from Yahoo Finance |
| **SQLite3** | built-in | Relational database (serverless) |
| **requests** | latest | HTTP client for symbol search |
| **a2wsgi** | latest | ASGI/WSGI bridge |

### Frontend

| Technology | Purpose |
|---|---|
| **HTML5** | Page structure |
| **CSS3** | Custom design system with CSS variables |
| **Vanilla JavaScript** | Application logic (no frameworks) |
| **Chart.js** | Portfolio and backtesting charts |
| **Lightweight Charts** | Candlestick charts (TradingView library) |

### Deployment

| Service | Purpose |
|---|---|
| **Render** | Web service hosting |
| **GitHub** | Source code management, automatic deployment |

---

## 3. Application Architecture

The application uses a **client-server** architecture:

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │index.html│  │login.html│  │    script.js       │  │
│  │(main)    │  │(auth)    │  │(application logic) │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                      │                               │
│               fetch('/api/...')                       │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP (JSON)
┌─────────────────────┴───────────────────────────────┐
│                    BACKEND (FastAPI)                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ main.py  │  │ auth.py   │  │technology_api.py │  │
│  │(routes)  │  │(auth)     │  │(search)          │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │portfolio │  │ prices.py │  │stock_categories  │  │
│  │.py       │  │(prices)   │  │.py (categories)  │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
│                      │                               │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────┐
│              DATA LAYER                              │
│  ┌──────────────┐        ┌────────────────────┐     │
│  │ database.py  │        │ Yahoo Finance API  │     │
│  │ (SQLite)     │        │ (yfinance)         │     │
│  └──────────────┘        └────────────────────┘     │
│  portfolio.db                                        │
└─────────────────────────────────────────────────────┘
```

---

## 4. File Structure

```
investment_app/
├── run.py                    # Entry point for local execution
├── requirements.txt          # Python dependencies
├── render.yaml               # Render hosting configuration
├── .gitignore                # Ignored files
├── .secret_key               # Auto-generated secret key (not in Git)
├── portfolio.db              # SQLite database (not in Git)
│
├── app/                      # Backend application
│   ├── __init__.py           # Python package marker
│   ├── main.py               # FastAPI app, routes, lifecycle
│   ├── auth.py               # Authentication, password hashing, tokens
│   ├── database.py           # Database schema, migration, connection
│   ├── portfolio.py          # Trading logic (buy, sell, portfolio)
│   ├── prices.py             # Price fetching from Yahoo Finance
│   ├── stock_categories.py   # Asset category definitions
│   └── technology_api.py     # API router – symbol search, categories
│
├── static/                   # Frontend files
│   ├── index.html            # Main application page
│   ├── login.html            # Login/registration page
│   ├── script.js             # JavaScript – all frontend logic
│   └── style.css             # Styles – dark theme
│
├── MANUAL.md                 # User manual (Czech)
├── README.md                 # Project description
├── DEPLOY_RENDER.md          # Render deployment guide
└── LICENSE                   # License
```

### Key File Descriptions

| File | Lines | Description |
|---|---|---|
| `app/main.py` | ~250 | FastAPI app with 19+ endpoints, middleware, lifecycle |
| `app/auth.py` | ~130 | Complete authentication system with no external dependencies |
| `app/database.py` | ~150 | Schema for 7 tables, automatic migration from single-user |
| `app/portfolio.py` | ~450 | Core trading logic – buy, sell, orders, pies |
| `app/prices.py` | ~100 | Wrapper over yfinance for prices, history, backtesting |
| `app/technology_api.py` | ~100 | Symbol search, categories with parallel loading |
| `static/script.js` | ~900 | All frontend logic |
| `static/style.css` | ~600 | Complete design system |
| `static/index.html` | ~300 | HTML structure of the main application |

---

## 5. Database

The application uses **SQLite3** – a file-based relational database requiring no separate server. The database file `portfolio.db` is automatically created on first launch.

### Table Schema

#### `users` Table

Stores registered users.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique identifier |
| `username` | TEXT | UNIQUE NOT NULL | Username (lowercase) |
| `password_hash` | TEXT | NOT NULL | Password hash (PBKDF2-SHA256) |
| `created_at` | INTEGER | NOT NULL | Registration Unix timestamp |

#### `account` Table

User account financial state.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `user_id` | INTEGER | PRIMARY KEY, FK → users.id | User identifier |
| `cash_balance` | REAL | DEFAULT 100000 | Current cash |
| `initial_balance` | REAL | DEFAULT 100000 | Starting balance |

#### `holdings` Table

Currently held positions (stocks, crypto, etc.).

| Column | Type | Constraint | Description |
|---|---|---|---|
| `user_id` | INTEGER | NOT NULL, FK → users.id | User identifier |
| `symbol` | TEXT | NOT NULL | Ticker symbol (e.g. AAPL) |
| `amount` | REAL | NOT NULL | Number of held units |
| `avg_buy_price` | REAL | DEFAULT 0 | Average purchase price |
| | | PRIMARY KEY (user_id, symbol) | Composite key |

#### `orders` Table

Pending (conditional) orders.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Order ID |
| `user_id` | INTEGER | NOT NULL, FK → users.id | User identifier |
| `symbol` | TEXT | NOT NULL | Ticker symbol |
| `order_type` | TEXT | NOT NULL | Type: limit, stop_loss, target_sell, target_buy |
| `action` | TEXT | NOT NULL | Action: buy or sell |
| `amount` | REAL | NOT NULL | Quantity |
| `target_price` | REAL | NOT NULL | Target price for execution |
| `created_at` | INTEGER | NOT NULL | Creation Unix timestamp |
| `status` | TEXT | DEFAULT 'pending' | Status: pending, executed, cancelled |

#### `trade_history` Table

Records of executed trades.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Record ID |
| `user_id` | INTEGER | NOT NULL, FK → users.id | User identifier |
| `symbol` | TEXT | NOT NULL | Ticker symbol |
| `action` | TEXT | NOT NULL | buy or sell |
| `amount` | REAL | NOT NULL | Quantity |
| `price` | REAL | NOT NULL | Execution price |
| `fee` | REAL | NOT NULL | Fee (0.1%) |
| `total` | REAL | NOT NULL | Total amount (after fee) |
| `profit` | REAL | DEFAULT 0 | Realized profit (sells only) |
| `timestamp` | INTEGER | NOT NULL | Trade Unix timestamp |
| `order_type` | TEXT | DEFAULT 'market' | Order type |

#### `portfolio_history` Table

Portfolio value snapshots for charting.

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Record ID |
| `user_id` | INTEGER | NOT NULL, FK → users.id | User identifier |
| `timestamp` | INTEGER | NOT NULL | Unix timestamp |
| `total_value` | REAL | NOT NULL | Total portfolio value |

#### `pies` and `pie_slices` Tables

Pie system for automated investing.

**pies:**

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Pie ID |
| `user_id` | INTEGER | NOT NULL, FK → users.id | User identifier |
| `name` | TEXT | NOT NULL | Pie name |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**pie_slices:**

| Column | Type | Constraint | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Slice ID |
| `pie_id` | INTEGER | NOT NULL, FK → pies.id (CASCADE) | Pie ID |
| `symbol` | TEXT | NOT NULL | Ticker symbol |
| `percent` | REAL | NOT NULL | Percentage allocation |

### ER Diagram (text)

```
users ─────┬──── account           (1:1)
           ├──── holdings          (1:N)
           ├──── orders            (1:N)
           ├──── trade_history     (1:N)
           ├──── portfolio_history (1:N)
           └──── pies              (1:N)
                   └──── pie_slices (1:N, CASCADE DELETE)
```

### Automatic Migration

The `database.py` module includes logic for automatic migration from a single-user schema to multi-user:
1. Detects old schema (table `holdings` without `user_id` column)
2. Creates a `legacy_user` account with a default password
3. Migrates data from old tables to the new schema
4. Preserves all existing data

---

## 6. Authentication & Security

The authentication system is implemented in the `auth.py` module **without any external dependencies** – using only Python's standard library.

### Password Hashing

- **Algorithm:** PBKDF2-SHA256
- **Iterations:** 200,000
- **Salt:** 32-byte random string (unique per user)
- **Storage format:** `{salt}:{hash}`
- **Comparison:** Constant-time (`hmac.compare_digest`) – protection against timing attacks

### Tokens (Session Management)

- **Format:** `{base64_payload}.{HMAC-SHA256_signature}` (JWT-like, without external libraries)
- **Payload:** JSON with `uid` (user ID), `u` (username), `exp` (expiration)
- **Validity:** 7 days (in token), 24-hour cookie
- **Signature:** HMAC-SHA256 with `SECRET_KEY`
- **Storage:** HttpOnly cookie `auth_token` (inaccessible from JavaScript)

### Secret Key Management

```
1. If env variable SECRET_KEY exists → use it
2. If .secret_key file exists → read from it
3. Otherwise → generate new key and save to .secret_key
```

In production (Render), an environment variable is used so the key survives redeployment.

### Security Measures

| Measure | Implementation |
|---|---|
| HttpOnly cookies | Token inaccessible from JS → XSS protection |
| SameSite=Lax | CSRF attack protection |
| PBKDF2 with high iteration count | Brute-force resistance |
| Constant-time hash comparison | Timing attack protection |
| Random salt per user | Rainbow table attack protection |

### auth.py Module Functions

| Function | Parameters | Return Value | Description |
|---|---|---|---|
| `hash_password` | `password: str` | `str` | Hashes password with random salt |
| `verify_password` | `password: str, stored: str` | `bool` | Verifies password against stored hash |
| `create_token` | `user_id: int, username: str` | `str` | Creates signed token (valid 7 days) |
| `verify_token` | `token: str` | `dict \| None` | Verifies and decodes token |
| `register_user` | `username: str, password: str` | `dict` | Registers new user |
| `login_user` | `username: str, password: str` | `dict` | Authenticates user |
| `get_all_user_ids` | – | `list[int]` | Returns all user IDs |

---

## 7. Backend – API Endpoints

### Authentication Endpoints

| Method | Path | Auth | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/login` | No | – | HTML login page |
| `POST` | `/api/auth/register` | No | `{username, password}` | `{status, username}` + cookie |
| `POST` | `/api/auth/login` | No | `{username, password}` | `{status, username}` + cookie |
| `POST` | `/api/auth/logout` | Yes (cookie) | – | `{status: ok}` + deletes cookie |
| `GET` | `/api/auth/me` | Yes (cookie) | – | `{username, user_id}` or 401 |

### Trading Endpoints

| Method | Path | Auth | Request Body | Response |
|---|---|---|---|---|
| `POST` | `/api/trade` | Yes | `{symbol, action, amount, order_type?, target_price?}` | Trade result |
| `POST` | `/api/buy/{symbol}/{amount}` | Yes | – | Buy result |
| `POST` | `/api/sell/{symbol}/{amount}` | Yes | – | Sell result |

### Order Management

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/api/orders` | Yes | List of pending orders |
| `DELETE` | `/api/orders/{order_id}` | Yes | `{status: ok}` or error |
| `POST` | `/api/orders/check` | Yes | `{executed: [...]}` |

### Portfolio

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/api/portfolio` | Yes | Complete portfolio snapshot |
| `GET` | `/api/portfolio/history/{period}` | Yes | Portfolio value time series |
| `GET` | `/api/account` | Yes | `{cash, invested, total, initial, profit, profit_percent}` |

### History & Statistics

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/api/trade-history` | Yes | Last 50 trades |
| `GET` | `/api/trade-stats` | Yes | Statistics (wins, losses, fees) |
| `POST` | `/api/reset` | Yes | Reset account to $100,000 |
| `POST` | `/api/sell-all` | Yes | Sell all positions |

### Pies

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/pies` | Yes | – | List of pies with prices |
| `POST` | `/api/pies` | Yes | `{name, slices}` | Created pie |
| `PUT` | `/api/pies/{pie_id}` | Yes | `{name, slices}` | Updated pie |
| `DELETE` | `/api/pies/{pie_id}` | Yes | – | `{status: ok}` |
| `POST` | `/api/pies/{pie_id}/buy` | Yes | `{amount}` | Purchase results |

### Market Data

| Method | Path | Auth | Response |
|---|---|---|---|
| `GET` | `/api/price/{symbol}` | No | `{symbol, price}` |
| `GET` | `/api/stock/{symbol}/history/{period}` | No | OHLC data + line data |
| `POST` | `/api/backtest` | No | Historical simulation result |
| `GET` | `/api/symbols/search?q=` | No | List of matching symbols |
| `GET` | `/api/stocks-by-category` | No | Categories with current prices |

---

## 8. Trading Logic

### Buy Execution (`buy_stock`)

```
1. Fetch current price for the symbol from Yahoo Finance
2. Calculate total cost: amount × price
3. Calculate fee: total × 0.001 (0.1%)
4. Verify sufficient cash balance
5. Deduct from cash: total + fee
6. Update/create holding with new average:
   new_avg = (old_amount × old_avg + new_amount × price) / new_total_amount
7. Record in trade_history
8. Return confirmation with trade details
```

### Sell Execution (`sell_stock`)

```
1. Verify position exists and sufficient quantity
2. Fetch current price from Yahoo Finance
3. Calculate revenue: amount × price
4. Calculate fee: revenue × 0.001 (0.1%)
5. Calculate realized profit: revenue − (amount × avg_buy_price)
6. Add to cash: revenue − fee
7. Update/delete holding (delete if amount ≤ 0.0001)
8. Automatically cancel related pending sell orders
9. Record in trade_history
```

### Order Types

| Type | Description | Execution Condition |
|---|---|---|
| `market` | Immediate execution at market price | Instant |
| `target_buy` | Buy when target price is reached | Current price ≤ target price |
| `target_sell` | Sell when target price is reached | Current price ≥ target price |
| `limit` (buy) | Limit buy order | Current price ≤ target price |
| `limit` (sell) | Limit sell order | Current price ≥ target price |
| `stop_loss` | Protective sell order | Current price ≤ target price |

### Pending Order Checking

The `check_pending_orders` function is called:
- Automatically from the frontend every **30 seconds**
- Manually by the user from the portfolio view

For each order, the current price is fetched and compared with the target. If the condition is met, the order executes as a market trade.

### Fee Structure

- **Fee: 0.1%** per trade
- On buy: added to total cost
- On sell: deducted from proceeds
- Tracked in `trade_history.fee`

---

## 9. Portfolio Management

### Get Portfolio (`get_portfolio`)

Returns a complete overview:

```json
{
  "total_value": 150000.50,
  "cash": 50000.25,
  "invested": 100000.25,
  "initial_balance": 100000,
  "change_24h": 2500.00,
  "change_24h_percent": 1.67,
  "positions": [
    {
      "symbol": "AAPL",
      "amount": 100,
      "price": 500.00,
      "value": 50000.00,
      "avg_buy_price": 450.00,
      "profit": 5000.00,
      "profit_percent": 11.11,
      "price_change_24h": 2.50
    }
  ]
}
```

### Portfolio History

Time series data with automatic bucketing:

| Period | Sample Interval | Max Points |
|---|---|---|
| 24h | 1 hour | 24 |
| 1w | 6 hours | 28 |
| 1m | 24 hours | 30 |
| 1y | 7 days | 52 |
| max | automatic | variable |

### Trade Statistics (`get_trade_stats`)

```json
{
  "total_trades": 42,
  "sells": 20,
  "wins": 15,
  "losses": 5,
  "win_rate": 75.0,
  "loss_rate": 25.0,
  "total_profit": 12500.50,
  "total_fees": 150.25
}
```

### Account Reset

The `reset_account` function completely wipes user data:
- Deletes all holdings, orders, history, pies
- Resets cash balance to $100,000

---

## 10. Pies System

The "Pies" system allows users to create investment templates – distributing an investment across multiple assets according to percentage allocation.

### Creating a Pie

- User specifies a name and a list of assets with percentage allocations
- Validation: percentages must sum to exactly 100%
- Example: `[{symbol: "AAPL", percent: 50}, {symbol: "MSFT", percent: 50}]`

### Investing in a Pie

When buying, the total amount is automatically distributed:

```
For each slice in pie:
  allocation = total_amount × (percent / 100)
  shares = allocation / current_price
  → buy_stock() is called for each symbol
```

### Pie Display

Each pie displays:
- Doughnut chart with color differentiation
- Current prices of individual assets
- Total invested value
- Number of held units for each asset

---

## 11. Market Data Fetching

### `prices.py` Module

| Function | Description |
|---|---|
| `get_price(symbol)` | Fetches current price using `yfinance.history(period="1d")` |
| `get_price_change_24h(symbol)` | Calculates 24h percentage change |
| `get_stock_history(symbol, period)` | Historical data (OHLC + line) |
| `run_backtest(symbol, start_date, investment)` | Historical investment simulation |

### Period to yfinance Mapping

| Period | yf_period | Interval | Use Case |
|---|---|---|---|
| 1d | 1d | 5m | Intraday trading |
| 1w | 5d | 15m | Weekly overview |
| 1m | 1mo | 1h | Monthly overview |
| 1y | 1y | 1d | Yearly overview |

### Server-side Cache (technology_api.py)

- **TTL:** 5 minutes per symbol
- **Parallel fetching:** `ThreadPoolExecutor` with max 10 workers
- Used by the `/api/stocks-by-category` endpoint

### Asset Categories

8 predefined categories with 5 assets each:

| Category | Example Symbols |
|---|---|
| Technology | AAPL, MSFT, GOOGL, NVDA, ADBE |
| IT | CRM, ORCL, IBM, SAP, INTC |
| Financial | JPM, BAC, WFC, GS, MS |
| Healthcare | JNJ, PFE, MRK, UNH, LLY |
| AI | MSFT, NVDA, GOOGL, META, AMD |
| Cryptocurrency | BTC-USD, ETH-USD, BNB-USD, SOL-USD, XRP-USD |
| Forex | EURUSD=X, GBPUSD=X, JPY=X, AUDUSD=X, CADUSD=X |
| Commodities | GC=F, CL=F, SI=F, NG=F, HG=F |

---

## 12. Backtesting

A module for simulating historical investments: "What would have happened if I invested X dollars in symbol Y on date Z?"

### Input

```json
{
  "symbol": "AAPL",
  "start_date": "2020-01-01",
  "investment": 10000
}
```

### Output

```json
{
  "symbol": "AAPL",
  "start_date": "2020-01-01",
  "end_date": "2026-03-11",
  "buy_price": 75.50,
  "current_price": 180.25,
  "shares": 132.45,
  "investment": 10000,
  "current_value": 23869.12,
  "profit": 13869.12,
  "profit_percent": 138.69,
  "total_fees": 33.87,
  "chart_data": [
    {"timestamp": 1577836800, "price": 75.50, "value": 10000}
  ]
}
```

### Calculation Logic

1. Downloads historical data from `start_date` to present
2. Calculates number of shares: `investment / buy_price`
3. Fees: 0.1% on buy + 0.1% on (hypothetical) sell
4. Generates a time series of portfolio value for charting

---

## 13. Frontend

### Architecture

The frontend is implemented as a **Single Page Application** (SPA) without any frameworks. Navigation between sections (Market / Portfolio) is handled via URL hash (`#market`, `#portfolio`).

### Authentication Flow

```
1. Page loads with a loading spinner (covering all content)
2. fetch('/api/auth/me') verifies cookie validity
3. If OK → spinner disappears, content is shown
4. If 401 → redirect to /login (window.location.replace)
5. Global interceptor: every fetch returning 401 → redirect to login
```

### Client-side Cache System

```javascript
_cache = {
  price: new Map(),         // Price cache (5 min TTL)
  portfolio: null,          // Portfolio cache (1 min TTL)
  portfolioHistory: null    // History cache
}

localStorage = {
  cached_portfolio,          // Persistent cache
  cached_portfolioHistory,
  cached_stocksCategories
}
```

### Main Frontend Modules

| Module | Key Functions | Description |
|---|---|---|
| **Autocomplete** | `setupAutocomplete()` | Debounced (250ms) dropdown with keyboard navigation |
| **Balance Bar** | `refreshBalanceBar()` | Header showing cash, invested, total, P&L |
| **Trading** | `executeTrade()` | Submits trade with validation |
| **Portfolio** | `loadPortfolio()`, `renderPortfolio()` | Position cards, allocation map |
| **Charts** | `loadPortfolioChart()` | Chart.js line chart with period switching |
| **Orders** | `loadPendingOrders()`, `checkOrders()` | Orders table, auto-check every 30s |
| **Trade History** | `loadTradeHistory()` | Paginated table (10 per page) |
| **Stats** | `loadTradeStats()` | Statistics dashboard |
| **Pies** | `createPie()`, `loadPies()`, `buyPie()` | Pie management with doughnut chart |
| **Stock Modal** | `openStockModal()` | Stock detail with line/candlestick charts |
| **Backtest** | `runBacktest()` | Backtesting form and chart |
| **Categories** | `loadStocksByCategory()` | Asset categories with prices |

### Design System

Dark theme with purple accents:

| Variable | Value | Usage |
|---|---|---|
| `--dark-black` | #0a0a0a | Background |
| `--accent-purple` | #6b46c1 | Primary action |
| `--light-purple` | #9f7aea | Emphasized text |
| `--text-light` | #e2e8f0 | Main text |
| `--success` | #48bb78 | Green (profit) |
| `--danger` | #f56565 | Red (loss) |
| `--card-bg` | #1a1625 | Card background |

### Responsive Design

- **Desktop (>768px):** 2-column layout
- **Mobile (<768px):** 1 column, optimized spacing

---

## 14. Background Tasks

### Portfolio Snapshot Loop (Backend)

```python
async def _portfolio_snapshot_loop():
    """Runs in the background, saves a portfolio value snapshot every 5 min."""
    while True:
        for uid in get_all_user_ids():
            snapshot_portfolio_value(uid)
        await asyncio.sleep(300)  # 5 minutes
```

- **Start:** On application startup (lifespan event)
- **Interval:** Every 5 minutes
- **Purpose:** Populate `portfolio_history` table for charting
- **Cancellation:** On application shutdown

### Order Checking (Frontend)

```javascript
setInterval(checkOrders, 30000);  // Every 30 seconds
```

- Calls `POST /api/orders/check`
- Checks conditions of pending orders
- Automatically executes orders when conditions are met

---

## 15. Caching & Optimization

### Server-side Cache

| Type | TTL | Purpose |
|---|---|---|
| Symbol price cache | 5 minutes | Reduce Yahoo Finance API calls |

### Client-side Cache

| Type | TTL | Storage |
|---|---|---|
| Price cache | 5 minutes | `_cache.price` (in-memory Map) |
| Portfolio cache | 1 minute | `_cache.portfolio` + localStorage |
| History cache | 1 minute | `_cache.portfolioHistory` + localStorage |
| Categories cache | persistent | localStorage |

### Parallel Loading

The `/api/stocks-by-category` endpoint uses `ThreadPoolExecutor` with 10 threads for parallel price fetching of ~35 unique symbols. Without parallelization: 20–60 seconds → with parallelization: 3–6 seconds.

---

## 16. Deployment

### Render.com

The application is configured for deployment on Render via the `render.yaml` file:

```yaml
services:
  - type: web
    name: trading-app
    runtime: python
    branch: master
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PORT
        value: 10000
      - key: SECRET_KEY
        generateValue: true
```

### Local Execution

```bash
# Activate virtual environment
.venv\Scripts\Activate.ps1     # Windows
source .venv/bin/activate       # Linux/Mac

# Run
python run.py
# → Opens http://127.0.0.1:8000/login
```

### Render Free Plan Limitations

- Server sleeps after 15 minutes of inactivity (cold start 30–60s)
- SQLite database survives restarts but **is deleted on redeployment**
- For persistent data: Render Disk (paid) or migration to PostgreSQL required

---

## 17. Configuration & Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `SECRET_KEY` | Auto-generated | Secret key for signing tokens |
| `PORT` | 8000 (local), 10000 (Render) | Server port |

### Dependencies (requirements.txt)

```
fastapi
uvicorn
yfinance
requests
a2wsgi
```

### Ignored Files (.gitignore)

```
__pycache__/
*.pyc
.venv/
portfolio.db
.secret_key
build/
```
