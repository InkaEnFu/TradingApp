import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .prices import get_price, get_price_change_24h, get_stock_history
from .portfolio import buy_stock, sell_stock, get_portfolio, get_portfolio_history_24h
from .technology_api import router as technology_router

# Get the base directory (investment_app folder)
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Local Investment Simulator")

# Serve static files (HTML, JS)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(technology_router, prefix="/api")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/portfolio")
async def portfolio_page():
    # Serve the same SPA for portfolio route to avoid full reloads
    return FileResponse(STATIC_DIR / "index.html")


# === API endpoints ===

@app.get("/api/price/{symbol}")
async def api_price(symbol: str):
    price = get_price(symbol)
    return {"symbol": symbol.upper(), "price": price}


@app.post("/api/buy/{symbol}/{amount}")
async def api_buy(symbol: str, amount: int):
    buy_stock(symbol.upper(), amount)
    return {"status": "ok"}


@app.post("/api/sell/{symbol}/{amount}")
async def api_sell(symbol: str, amount: int):
    sell_stock(symbol.upper(), amount)
    return {"status": "ok"}


@app.get("/api/portfolio")
async def api_portfolio():
    return get_portfolio()


@app.get("/api/portfolio/history/24h")
async def api_portfolio_history():
    return get_portfolio_history_24h()


@app.get("/api/stock/{symbol}/history/{period}")
async def api_stock_history(symbol: str, period: str):
    """Get stock price history. Period: 1d, 1w, 1m, 1y"""
    return get_stock_history(symbol.upper(), period)
