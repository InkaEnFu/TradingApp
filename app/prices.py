import yfinance as yf
from datetime import datetime


def get_price(symbol: str) -> float:
    """Get the latest close price for a symbol using yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="1d")
        if history.empty:
            return 0.0
        price = history["Close"].iloc[-1]
        return float(price)
    except Exception:
        return 0.0


def get_price_change_24h(symbol: str) -> float:
    """Get 24h price change percentage for a symbol using yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="5d")
        if len(history) < 2:
            return 0.0
        
        current_price = history["Close"].iloc[-1]
        previous_price = history["Close"].iloc[-2]
        
        if previous_price == 0:
            return 0.0
        
        change_percent = ((current_price - previous_price) / previous_price) * 100
        return float(change_percent)
    except Exception:
        return 0.0


def get_stock_history(symbol: str, period: str) -> dict:
    """Get historical price data for a symbol (line chart data + OHLC for candlestick).
    
    period: '1d', '1w', '1m', '1y'
    """
    try:
        ticker = yf.Ticker(symbol)
        
        try:
            current_price = float(ticker.fast_info['lastPrice'])
        except:
            current_price = get_price(symbol)
        
        # Mapování období na yfinance parametry
        period_map = {
            '1d': ('1d', '5m'),
            '1w': ('5d', '15m'),
            '1m': ('1mo', '1h'),
            '1y': ('1y', '1d'),
        }
        
        yf_period, interval = period_map.get(period, ('1mo', '1d'))
        history = ticker.history(period=yf_period, interval=interval)
        
        if history.empty:
            return {
                "symbol": symbol.upper(), "period": period,
                "data": [], "ohlc": [],
                "current_price": round(current_price, 2),
                "change": 0, "change_percent": 0
            }
        
        # Line chart data (close prices)
        data = []
        # OHLC candlestick data
        ohlc = []
        
        for timestamp, row in history.iterrows():
            ts = int(timestamp.timestamp())
            data.append({
                "timestamp": ts,
                "price": round(float(row["Close"]), 2)
            })
            ohlc.append({
                "time": ts,
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2)
            })
        
        first_price = data[0]["price"] if data else current_price
        change = round(current_price - first_price, 2)
        change_percent = round((change / first_price) * 100, 2) if first_price > 0 else 0
        
        return {
            "symbol": symbol.upper(),
            "period": period,
            "current_price": round(current_price, 2),
            "first_price": round(first_price, 2),
            "data": data,
            "ohlc": ohlc,
            "change": change,
            "change_percent": change_percent
        }
    except Exception as e:
        return {
            "symbol": symbol.upper(), "period": period,
            "data": [], "ohlc": [],
            "current_price": 0, "change": 0, "change_percent": 0,
            "error": str(e)
        }


def run_backtest(symbol: str, start_date: str, investment: float) -> dict:
    """Run a backtest: what if user invested $X in symbol on start_date?
    
    start_date: 'YYYY-MM-DD'
    investment: dollar amount invested
    Returns: result with profit/loss info and historical chart data.
    """
    try:
        ticker = yf.Ticker(symbol)
        
        history = ticker.history(start=start_date, interval="1d")
        
        if history.empty or len(history) < 2:
            return {"error": "No data available for this symbol/date range."}
        
        buy_price = float(history["Close"].iloc[0])
        current_price = float(history["Close"].iloc[-1])
        
        if buy_price <= 0:
            return {"error": "Invalid price data."}
        
        # 0.1% fee on buy
        fee_buy = investment * 0.001
        effective_investment = investment - fee_buy
        shares = effective_investment / buy_price
        
        current_value = shares * current_price
        # 0.1% fee if sold now
        fee_sell = current_value * 0.001
        final_value = current_value - fee_sell
        
        total_fees = fee_buy + fee_sell
        profit = final_value - investment
        profit_percent = (profit / investment) * 100
        
        # Chart data for the backtest period
        chart_data = []
        for timestamp, row in history.iterrows():
            value = shares * float(row["Close"])
            chart_data.append({
                "timestamp": int(timestamp.timestamp()),
                "price": round(float(row["Close"]), 2),
                "value": round(value, 2)
            })
        
        buy_date = history.index[0].strftime("%Y-%m-%d")
        end_date = history.index[-1].strftime("%Y-%m-%d")
        
        return {
            "symbol": symbol.upper(),
            "start_date": buy_date,
            "end_date": end_date,
            "investment": round(investment, 2),
            "buy_price": round(buy_price, 2),
            "current_price": round(current_price, 2),
            "shares": round(shares, 4),
            "current_value": round(final_value, 2),
            "profit": round(profit, 2),
            "profit_percent": round(profit_percent, 2),
            "total_fees": round(total_fees, 2),
            "chart_data": chart_data
        }
    except Exception as e:
        return {"error": str(e)}
