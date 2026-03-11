from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import yfinance as yf
import requests
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
