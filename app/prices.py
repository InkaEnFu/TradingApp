import yfinance as yf


def get_price(symbol: str) -> float:
    """Get the latest close price for a symbol using yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="1d")
        if history.empty:
            # If no data, return 0.0 (or you can raise an error)
            return 0.0
        price = history["Close"].iloc[-1]
        return float(price)
    except Exception:
        # Very simple fallback – in real app you'd handle errors better
        return 0.0


def get_price_change_24h(symbol: str) -> float:
    """Get 24h price change percentage for a symbol using yfinance."""
    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period="5d")
        if len(history) < 2:
            return 0.0
        
        # Získat dnešní a včerejší zavírací cenu
        current_price = history["Close"].iloc[-1]
        previous_price = history["Close"].iloc[-2]
        
        if previous_price == 0:
            return 0.0
        
        change_percent = ((current_price - previous_price) / previous_price) * 100
        return float(change_percent)
    except Exception:
        return 0.0


def get_stock_history(symbol: str, period: str) -> dict:
    """Get historical price data for a symbol.
    
    period: '1d', '1w', '1m', '1y'
    """
    try:
        ticker = yf.Ticker(symbol)
        
        # Získat aktuální cenu z fast_info (konzistentní napříč všemi obdobími)
        try:
            current_price = float(ticker.fast_info['lastPrice'])
        except:
            current_price = get_price(symbol)
        
        # Mapování období na yfinance parametry
        period_map = {
            '1d': ('1d', '5m'),      # 1 den, 5 minutové intervaly
            '1w': ('5d', '15m'),     # 5 dní, 15 minutové intervaly
            '1m': ('1mo', '1h'),     # 1 měsíc, hodinové intervaly
            '1y': ('1y', '1d'),      # 1 rok, denní intervaly
        }
        
        yf_period, interval = period_map.get(period, ('1mo', '1d'))
        history = ticker.history(period=yf_period, interval=interval)
        
        if history.empty:
            return {"symbol": symbol.upper(), "period": period, "data": [], "current_price": round(current_price, 2), "change": 0, "change_percent": 0}
        
        # Převést na seznam
        data = []
        for timestamp, row in history.iterrows():
            data.append({
                "timestamp": int(timestamp.timestamp()),
                "price": round(float(row["Close"]), 2)
            })
        
        # První cena z období
        first_price = data[0]["price"] if data else current_price
        
        # Vypočítat změnu oproti začátku období
        change = round(current_price - first_price, 2)
        change_percent = round((change / first_price) * 100, 2) if first_price > 0 else 0
        
        return {
            "symbol": symbol.upper(),
            "period": period,
            "current_price": round(current_price, 2),
            "first_price": round(first_price, 2),
            "data": data,
            "change": change,
            "change_percent": change_percent
        }
    except Exception as e:
        return {"symbol": symbol.upper(), "period": period, "data": [], "current_price": 0, "change": 0, "change_percent": 0, "error": str(e)}
