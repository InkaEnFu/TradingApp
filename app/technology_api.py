from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import yfinance as yf
from .stock_categories import stocks_by_category

router = APIRouter()

# Build a flat list of all known symbols for autocomplete
_all_symbols = []
_seen = set()
for _cat, _stocks in stocks_by_category.items():
    for _s in _stocks:
        if _s["symbol"] not in _seen:
            _all_symbols.append({"symbol": _s["symbol"], "name": _s["name"]})
            _seen.add(_s["symbol"])


@router.get("/symbols/search")
def search_symbols(q: str = Query("", min_length=0)):
    """Return all known symbols (for client-side filtering)."""
    return _all_symbols

@router.get("/stocks-by-category")
def get_stocks_by_category():
    result = {}
    for category, stocks in stocks_by_category.items():
        enriched = []
        for stock in stocks:
            symbol = stock["symbol"]
            name = stock["name"]
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                price = info.get("regularMarketPrice")
                prev_close = info.get("regularMarketPreviousClose")
                if price is not None and prev_close is not None and prev_close != 0:
                    change_percent = round(((price - prev_close) / prev_close) * 100, 2)
                else:
                    change_percent = None
            except Exception:
                price = None
                change_percent = None
            enriched.append({
                "symbol": symbol,
                "name": name,
                "price": price,
                "change_percent": change_percent
            })
        result[category] = enriched
    return result
