import os
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Cookie, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from .prices import get_price, get_price_change_24h, get_stock_history, run_backtest
from .portfolio import (
    buy_stock, sell_stock, get_portfolio, get_portfolio_history_24h, get_portfolio_history,
    get_account_info, create_order, cancel_order, get_pending_orders,
    check_pending_orders, get_trade_history, get_trade_stats, reset_account,
    snapshot_portfolio_value, sell_all,
    create_pie, get_pies, delete_pie, buy_pie, update_pie,
)
from .technology_api import router as technology_router
from .auth import register_user, login_user, verify_token, get_all_user_ids

# Get the base directory (investment_app folder)
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


# ── Background scheduler: snapshot portfolio value every 5 min ───────
async def _portfolio_snapshot_loop():
    """Runs in the background, saves a portfolio value snapshot every 5 min."""
    while True:
        try:
            for uid in get_all_user_ids():
                snapshot_portfolio_value(uid)
        except Exception:
            pass
        await asyncio.sleep(300)  # 5 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: take an initial snapshot and start the loop
    for uid in get_all_user_ids():
        snapshot_portfolio_value(uid)
    task = asyncio.create_task(_portfolio_snapshot_loop())
    yield
    task.cancel()


app = FastAPI(title="Local Investment Simulator", lifespan=lifespan)

# Serve static files (HTML, JS)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(technology_router, prefix="/api")


# ── Auth helper ──────────────────────────────────────────────────────

def _get_user(request: Request) -> dict:
    """Extract current user from auth_token cookie. Raises 401 if invalid."""
    token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


# ── Auth routes ──────────────────────────────────────────────────────

@app.get("/login")
async def login_page():
    return FileResponse(STATIC_DIR / "login.html")


@app.post("/api/auth/register")
async def api_register(request: Request):
    body = await request.json()
    username = body.get("username", "")
    password = body.get("password", "")
    result = register_user(username, password)
    if result.get("error"):
        return JSONResponse(result, status_code=400)
    resp = JSONResponse({"status": "ok", "username": result["username"]})
    resp.set_cookie(
        key="auth_token", value=result["token"],
        httponly=True, samesite="lax", max_age=86400,
    )
    return resp


@app.post("/api/auth/login")
async def api_login(request: Request):
    body = await request.json()
    username = body.get("username", "")
    password = body.get("password", "")
    result = login_user(username, password)
    if result.get("error"):
        return JSONResponse(result, status_code=401)
    resp = JSONResponse({"status": "ok", "username": result["username"]})
    resp.set_cookie(
        key="auth_token", value=result["token"],
        httponly=True, samesite="lax", max_age=86400,
    )
    return resp


@app.post("/api/auth/logout")
async def api_logout():
    resp = JSONResponse({"status": "ok"})
    resp.delete_cookie("auth_token")
    return resp


@app.get("/api/auth/me")
async def api_me(request: Request):
    user = _get_user(request)
    return {"username": user["username"], "user_id": user["user_id"]}


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/portfolio")
async def portfolio_page():
    return FileResponse(STATIC_DIR / "index.html")


# === Price endpoints ===

@app.get("/api/price/{symbol}")
async def api_price(symbol: str):
    price = get_price(symbol)
    return {"symbol": symbol.upper(), "price": price}


@app.get("/api/stock/{symbol}/history/{period}")
async def api_stock_history(symbol: str, period: str):
    """Get stock history with OHLC data. Period: 1d, 1w, 1m, 1y"""
    return get_stock_history(symbol.upper(), period)


# === Trading endpoints ===

@app.post("/api/trade")
async def api_trade(request: Request):
    """Unified trade endpoint.
    Body: {symbol, action, amount, order_type?, target_price?}
    """
    user = _get_user(request)
    uid = user["user_id"]
    body = await request.json()
    symbol = body.get("symbol", "").upper()
    action = body.get("action", "buy")
    amount = float(body.get("amount", 0))
    order_type = body.get("order_type", "market")
    target_price = float(body.get("target_price", 0))

    if not symbol or amount <= 0:
        return {"error": "Invalid symbol or amount."}

    # Market orders execute immediately
    if order_type == "market":
        if action == "buy":
            return buy_stock(uid, symbol, amount)
        else:
            return sell_stock(uid, symbol, amount)
    else:
        # Pending orders: limit, stop_loss, target_sell, target_buy
        if target_price <= 0:
            return {"error": "Target price required for non-market orders."}
        return create_order(uid, symbol, order_type, action, amount, target_price)


# Keep old endpoints for backwards compat
@app.post("/api/buy/{symbol}/{amount}")
async def api_buy(symbol: str, amount: float, request: Request):
    user = _get_user(request)
    return buy_stock(user["user_id"], symbol.upper(), amount)


@app.post("/api/sell/{symbol}/{amount}")
async def api_sell(symbol: str, amount: float, request: Request):
    user = _get_user(request)
    return sell_stock(user["user_id"], symbol.upper(), amount)


# === Order management ===

@app.get("/api/orders")
async def api_orders(request: Request):
    user = _get_user(request)
    return get_pending_orders(user["user_id"])


@app.delete("/api/orders/{order_id}")
async def api_cancel_order(order_id: int, request: Request):
    user = _get_user(request)
    return cancel_order(user["user_id"], order_id)


@app.post("/api/orders/check")
async def api_check_orders(request: Request):
    """Check and execute pending orders whose conditions are met."""
    user = _get_user(request)
    executed = check_pending_orders(user["user_id"])
    return {"executed": executed}


# === Portfolio & account ===

@app.get("/api/portfolio")
async def api_portfolio(request: Request):
    user = _get_user(request)
    return get_portfolio(user["user_id"])


@app.get("/api/portfolio/history/24h")
async def api_portfolio_history(request: Request):
    user = _get_user(request)
    return get_portfolio_history_24h(user["user_id"])


@app.get("/api/portfolio/history/{period}")
async def api_portfolio_history_period(period: str, request: Request):
    user = _get_user(request)
    if period not in ('24h', '1w', '1m', '1y', 'max'):
        return {"error": "Invalid period"}
    return get_portfolio_history(user["user_id"], period)


@app.get("/api/account")
async def api_account(request: Request):
    user = _get_user(request)
    return get_account_info(user["user_id"])


@app.get("/api/trade-history")
async def api_trade_history(request: Request):
    user = _get_user(request)
    return get_trade_history(user["user_id"])


@app.get("/api/trade-stats")
async def api_trade_stats(request: Request):
    user = _get_user(request)
    return get_trade_stats(user["user_id"])


@app.post("/api/reset")
async def api_reset(request: Request):
    user = _get_user(request)
    return reset_account(user["user_id"])


@app.post("/api/sell-all")
async def api_sell_all(request: Request):
    user = _get_user(request)
    return sell_all(user["user_id"])


# === Pies ===

@app.get("/api/pies")
async def api_get_pies(request: Request):
    user = _get_user(request)
    return get_pies(user["user_id"])


@app.post("/api/pies")
async def api_create_pie(request: Request):
    user = _get_user(request)
    body = await request.json()
    name = body.get("name", "").strip()
    slices = body.get("slices", [])
    return create_pie(user["user_id"], name, slices)


@app.delete("/api/pies/{pie_id}")
async def api_delete_pie(pie_id: int, request: Request):
    user = _get_user(request)
    return delete_pie(user["user_id"], pie_id)


@app.put("/api/pies/{pie_id}")
async def api_update_pie(pie_id: int, request: Request):
    user = _get_user(request)
    body = await request.json()
    name = body.get("name", "").strip()
    slices = body.get("slices", [])
    return update_pie(user["user_id"], pie_id, name, slices)


@app.post("/api/pies/{pie_id}/buy")
async def api_buy_pie(pie_id: int, request: Request):
    user = _get_user(request)
    body = await request.json()
    amount = float(body.get("amount", 0))
    return buy_pie(user["user_id"], pie_id, amount)


# === Backtesting ===

@app.post("/api/backtest")
async def api_backtest(request: Request):
    """Run a backtest.
    Body: {symbol, start_date, investment}
    """
    body = await request.json()
    symbol = body.get("symbol", "").upper()
    start_date = body.get("start_date", "")
    investment = float(body.get("investment", 10000))

    if not symbol or not start_date:
        return {"error": "Symbol and start_date are required."}

    return run_backtest(symbol, start_date, investment)
