from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import yfinance as yf
import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from .stock_categories import stocks_by_category

router = APIRouter()

# ── Server-side cache for stock prices ──
_price_cache = {}
_CACHE_TTL = 300  # 5 minutes

def _get_cached_price(symbol: str):
    """Get price from cache if fresh, otherwise return None."""
    if symbol in _price_cache:
        data, ts = _price_cache[symbol]
        if time.time() - ts < _CACHE_TTL:
            return data
    return None

def _set_cached_price(symbol: str, data: dict):
    """Store price in cache."""
    _price_cache[symbol] = (data, time.time())

def _fetch_single_price(symbol: str) -> dict:
    """Fetch price for a single symbol (used in thread pool)."""
    cached = _get_cached_price(symbol)
    if cached:
        return cached
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        price = info.get("regularMarketPrice")
        prev_close = info.get("regularMarketPreviousClose")
        if price is not None and prev_close is not None and prev_close != 0:
            change_percent = round(((price - prev_close) / prev_close) * 100, 2)
        else:
            change_percent = None
        result = {"price": price, "change_percent": change_percent}
    except Exception:
        result = {"price": None, "change_percent": None}
    _set_cached_price(symbol, result)
    return result

# Build a flat list of all known symbols for autocomplete
_all_symbols = []
_seen = set()
for _cat, _stocks in stocks_by_category.items():
    for _s in _stocks:
        if _s["symbol"] not in _seen:
            _all_symbols.append({"symbol": _s["symbol"], "name": _s["name"]})
            _seen.add(_s["symbol"])


def _yahoo_search(query: str, max_results: int = 10) -> list:
    """Search Yahoo Finance for symbols matching the query."""
    try:
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        params = {
            "q": query,
            "quotesCount": max_results,
            "newsCount": 0,
            "listsCount": 0,
            "enableFuzzyQuery": True,
        }
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, params=params, headers=headers, timeout=3)
        data = resp.json()
        results = []
        for quote in data.get("quotes", []):
            sym = quote.get("symbol", "")
            name = quote.get("shortname") or quote.get("longname") or ""
            if sym:
                results.append({"symbol": sym, "name": name})
        return results
    except Exception:
        return []


@router.get("/symbols/search")
def search_symbols(q: str = Query("", min_length=0)):
    """Return matching symbols. If q is empty, return predefined list.
    Otherwise, filter predefined list AND search Yahoo Finance for more results."""
    if not q:
        return _all_symbols

    qu = q.upper()
    # First: filter predefined symbols
    local_matches = [s for s in _all_symbols if s["symbol"].upper().startswith(qu) or qu in s["name"].upper()]

    # Second: search Yahoo Finance for additional results
    yahoo_matches = _yahoo_search(q, max_results=10)

    # Merge, avoiding duplicates
    seen_syms = {s["symbol"].upper() for s in local_matches}
    for ym in yahoo_matches:
        if ym["symbol"].upper() not in seen_syms:
            local_matches.append(ym)
            seen_syms.add(ym["symbol"].upper())

    return local_matches[:15]

@router.get("/stocks-by-category")
def get_stocks_by_category():
    # Collect all unique symbols
    all_symbols = set()
    for stocks in stocks_by_category.values():
        for stock in stocks:
            all_symbols.add(stock["symbol"])
    
    # Fetch prices in parallel (max 10 threads)
    prices = {}
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_symbol = {executor.submit(_fetch_single_price, sym): sym for sym in all_symbols}
        for future in as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                prices[symbol] = future.result()
            except Exception:
                prices[symbol] = {"price": None, "change_percent": None}
    
    # Build result
    result = {}
    for category, stocks in stocks_by_category.items():
        enriched = []
        for stock in stocks:
            symbol = stock["symbol"]
            price_data = prices.get(symbol, {"price": None, "change_percent": None})
            enriched.append({
                "symbol": symbol,
                "name": stock["name"],
                "price": price_data["price"],
                "change_percent": price_data["change_percent"]
            })
        result[category] = enriched
    return result
