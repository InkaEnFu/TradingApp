from .database import cursor, conn
from .prices import get_price, get_price_change_24h
import time

FEE_RATE = 0.001  # 0.1 % per trade


# ── Account helpers ──────────────────────────────────────────────────

def get_cash_balance() -> float:
    cursor.execute("SELECT cash_balance FROM account WHERE id = 1")
    row = cursor.fetchone()
    return row[0] if row else 100000.0


def _update_cash(delta: float):
    cursor.execute("UPDATE account SET cash_balance = cash_balance + ? WHERE id = 1", (delta,))
    conn.commit()


def get_account_info() -> dict:
    cursor.execute("SELECT cash_balance, initial_balance FROM account WHERE id = 1")
    row = cursor.fetchone()
    cash = row[0] if row else 100000.0
    initial = row[1] if row else 100000.0

    # Invested value
    cursor.execute("SELECT symbol, amount FROM holdings")
    holdings = cursor.fetchall()
    invested_value = 0.0
    for symbol, amount in holdings:
        invested_value += amount * get_price(symbol)

    total = round(cash + invested_value, 2)
    profit = round(total - initial, 2)
    profit_pct = round((profit / initial) * 100, 2) if initial > 0 else 0

    return {
        "cash": round(cash, 2),
        "invested": round(invested_value, 2),
        "total": total,
        "initial": round(initial, 2),
        "profit": profit,
        "profit_percent": profit_pct,
    }


# ── Market buy / sell ────────────────────────────────────────────────

def buy_stock(symbol: str, amount: float, order_type: str = "market") -> dict:
    if amount <= 0:
        return {"error": "Amount must be positive."}

    current_price = get_price(symbol)
    if current_price <= 0:
        return {"error": f"Cannot get price for {symbol}."}

    cost = amount * current_price
    fee = round(cost * FEE_RATE, 2)
    total_cost = cost + fee

    cash = get_cash_balance()
    if total_cost > cash:
        return {"error": f"Insufficient funds. Need ${round(total_cost,2)}, have ${round(cash,2)}."}

    # Deduct cash
    _update_cash(-total_cost)

    # Update holdings
    cursor.execute("SELECT amount, avg_buy_price FROM holdings WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()

    if row:
        old_amount = row[0]
        old_avg = row[1] or 0
        new_amount = old_amount + amount
        new_avg = ((old_amount * old_avg) + (amount * current_price)) / new_amount
        cursor.execute(
            "UPDATE holdings SET amount = ?, avg_buy_price = ? WHERE symbol = ?",
            (new_amount, new_avg, symbol),
        )
    else:
        cursor.execute(
            "INSERT INTO holdings (symbol, amount, avg_buy_price) VALUES (?, ?, ?)",
            (symbol, amount, current_price),
        )

    # Record trade
    cursor.execute(
        """INSERT INTO trade_history
           (symbol, action, amount, price, fee, total, profit, timestamp, order_type)
           VALUES (?, 'buy', ?, ?, ?, ?, 0, ?, ?)""",
        (symbol, amount, current_price, fee, total_cost, int(time.time()), order_type),
    )
    conn.commit()

    return {
        "status": "ok",
        "message": f"Bought {amount}x {symbol} @ ${round(current_price,2)}. Fee: ${fee}. Total: ${round(total_cost,2)}.",
    }


def sell_stock(symbol: str, amount: float, order_type: str = "market") -> dict:
    if amount <= 0:
        return {"error": "Amount must be positive."}

    cursor.execute("SELECT amount, avg_buy_price FROM holdings WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()

    if not row:
        return {"error": f"No position in {symbol}."}

    current_amount = row[0]
    avg_buy = row[1] or 0

    # Allow tiny floating-point overflows (e.g. 0.8467 vs 0.846663)
    if amount > current_amount:
        if amount - current_amount < 0.01:
            amount = current_amount  # snap to actual holding
        else:
            return {"error": f"Not enough shares. Have {current_amount}, want to sell {amount}."}

    current_price = get_price(symbol)
    if current_price <= 0:
        return {"error": f"Cannot get price for {symbol}."}

    revenue = amount * current_price
    fee = round(revenue * FEE_RATE, 2)
    total_revenue = revenue - fee

    # Profit on this sale
    cost_basis = amount * avg_buy
    profit = total_revenue - cost_basis

    # Credit cash
    _update_cash(total_revenue)

    # Update holdings
    new_amount = current_amount - amount
    if new_amount <= 0.0001:  # float tolerance
        cursor.execute("DELETE FROM holdings WHERE symbol = ?", (symbol,))
    else:
        cursor.execute("UPDATE holdings SET amount = ? WHERE symbol = ?", (new_amount, symbol))

    # Record trade
    cursor.execute(
        """INSERT INTO trade_history
           (symbol, action, amount, price, fee, total, profit, timestamp, order_type)
           VALUES (?, 'sell', ?, ?, ?, ?, ?, ?, ?)""",
        (symbol, amount, current_price, fee, total_revenue, profit, int(time.time()), order_type),
    )
    conn.commit()

    return {
        "status": "ok",
        "message": f"Sold {amount}x {symbol} @ ${round(current_price,2)}. Fee: ${fee}. Profit: ${round(profit,2)}.",
    }


# ── Pending orders (limit / stop-loss / target-sell / target-buy) ────

def create_order(symbol: str, order_type: str, action: str, amount: float, target_price: float) -> dict:
    """Create a pending order.
    order_type: 'limit', 'stop_loss', 'target_sell', 'target_buy'
    action: 'buy' or 'sell'
    """
    if amount <= 0 or target_price <= 0:
        return {"error": "Amount and target price must be positive."}

    # Force correct action for target_sell / target_buy
    if order_type == "target_sell":
        action = "sell"
    elif order_type == "target_buy":
        action = "buy"

    # For stop_loss / target_sell the user must own the asset
    if order_type in ("stop_loss", "target_sell"):
        cursor.execute("SELECT amount FROM holdings WHERE symbol = ?", (symbol,))
        row = cursor.fetchone()
        if not row or row[0] < amount:
            return {"error": f"Not enough holdings in {symbol} for this order."}

    cursor.execute(
        """INSERT INTO orders (symbol, order_type, action, amount, target_price, created_at, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')""",
        (symbol, order_type, action, amount, target_price, int(time.time())),
    )
    conn.commit()
    return {"status": "ok", "message": f"{order_type} order created for {amount}x {symbol} @ ${target_price}."}


def cancel_order(order_id: int) -> dict:
    cursor.execute("UPDATE orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'", (order_id,))
    conn.commit()
    if cursor.rowcount == 0:
        return {"error": "Order not found or already processed."}
    return {"status": "ok"}


def get_pending_orders() -> list:
    cursor.execute(
        "SELECT id, symbol, order_type, action, amount, target_price, created_at FROM orders WHERE status = 'pending' ORDER BY created_at DESC"
    )
    rows = cursor.fetchall()
    return [
        {
            "id": r[0], "symbol": r[1], "order_type": r[2], "action": r[3],
            "amount": r[4], "target_price": r[5], "created_at": r[6],
        }
        for r in rows
    ]


def check_pending_orders() -> list:
    """Check all pending orders and execute if conditions met. Returns list of executed orders."""
    cursor.execute(
        "SELECT id, symbol, order_type, action, amount, target_price FROM orders WHERE status = 'pending'"
    )
    pending = cursor.fetchall()
    executed = []

    for oid, symbol, otype, action, amount, target in pending:
        try:
            price = get_price(symbol)
            if price <= 0:
                continue

            should_execute = False
            if otype == "limit" and action == "buy" and price <= target:
                should_execute = True
            elif otype == "limit" and action == "sell" and price >= target:
                should_execute = True
            elif otype == "stop_loss" and price <= target:
                should_execute = True
            elif otype == "target_sell" and price >= target:
                should_execute = True
            elif otype == "target_buy" and price <= target:
                should_execute = True

            if should_execute:
                if action == "buy" or otype == "limit" and action == "buy":
                    result = buy_stock(symbol, amount, order_type=otype)
                else:
                    result = sell_stock(symbol, amount, order_type=otype)

                if result.get("status") == "ok":
                    cursor.execute("UPDATE orders SET status = 'executed' WHERE id = ?", (oid,))
                    conn.commit()
                    executed.append({"id": oid, "symbol": symbol, "type": otype, "result": result["message"]})
                else:
                    # If execution failed (e.g. no funds), cancel
                    cursor.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", (oid,))
                    conn.commit()
        except Exception:
            continue

    return executed


# ── Trade history & stats ────────────────────────────────────────────

def get_trade_history(limit: int = 50) -> list:
    cursor.execute(
        "SELECT id, symbol, action, amount, price, fee, total, profit, timestamp, order_type FROM trade_history ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    )
    rows = cursor.fetchall()
    return [
        {
            "id": r[0], "symbol": r[1], "action": r[2], "amount": round(r[3], 4),
            "price": round(r[4], 2), "fee": round(r[5], 2), "total": round(r[6], 2),
            "profit": round(r[7], 2), "timestamp": r[8], "order_type": r[9],
        }
        for r in rows
    ]


def get_trade_stats() -> dict:
    """Win/Loss ratio and other stats from closed sell trades."""
    cursor.execute(
        "SELECT profit FROM trade_history WHERE action = 'sell'"
    )
    rows = cursor.fetchall()

    if not rows:
        return {"total_trades": 0, "sells": 0, "wins": 0, "losses": 0, "win_rate": 0, "loss_rate": 0, "total_profit": 0, "total_fees": 0}

    wins = sum(1 for r in rows if r[0] > 0)
    losses = sum(1 for r in rows if r[0] <= 0)
    total_profit = sum(r[0] for r in rows)

    cursor.execute("SELECT COUNT(*), SUM(fee) FROM trade_history")
    total_row = cursor.fetchone()
    total_trades = total_row[0] or 0
    total_fees = total_row[1] or 0

    sell_count = len(rows)
    win_rate = round((wins / sell_count) * 100, 1) if sell_count > 0 else 0
    loss_rate = round((losses / sell_count) * 100, 1) if sell_count > 0 else 0

    return {
        "total_trades": total_trades,
        "sells": sell_count,
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "loss_rate": loss_rate,
        "total_profit": round(total_profit, 2),
        "total_fees": round(total_fees, 2),
    }


# ── Portfolio overview ───────────────────────────────────────────────

def get_portfolio():
    cursor.execute("SELECT symbol, amount, avg_buy_price FROM holdings")
    rows = cursor.fetchall()

    portfolio = []
    invested_value = 0.0

    for symbol, amount, avg_buy_price in rows:
        price = get_price(symbol)
        value = round(amount * price, 2)
        invested_value += value

        cost_basis = amount * (avg_buy_price or 0)
        profit = value - cost_basis
        profit_percent = ((profit / cost_basis) * 100) if cost_basis > 0 else 0

        price_change_24h = get_price_change_24h(symbol)

        portfolio.append({
            "symbol": symbol,
            "amount": amount,
            "price": round(price, 2),
            "value": value,
            "avg_buy_price": round(avg_buy_price or 0, 2),
            "profit": round(profit, 2),
            "profit_percent": round(profit_percent, 2),
            "price_change_24h": round(price_change_24h, 2),
        })

    cash = get_cash_balance()
    total_value = round(cash + invested_value, 2)

    # Get initial balance for overall P&L
    cursor.execute("SELECT initial_balance FROM account WHERE id = 1")
    row = cursor.fetchone()
    initial_balance = row[0] if row else 100000

    # Save to history
    current_time = int(time.time())
    cursor.execute(
        "INSERT INTO portfolio_history (timestamp, total_value) VALUES (?, ?)",
        (current_time, total_value),
    )
    conn.commit()

    # 24h change
    time_24h_ago = current_time - 86400
    cursor.execute(
        "SELECT total_value FROM portfolio_history WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT 1",
        (time_24h_ago,),
    )
    old_row = cursor.fetchone()

    change_24h = 0.0
    change_24h_percent = 0.0
    if old_row and old_row[0] > 0:
        change_24h = round(total_value - old_row[0], 2)
        change_24h_percent = round((change_24h / old_row[0]) * 100, 2)

    # Cleanup old records (>1 year)
    time_1y_ago = current_time - (365 * 86400)
    cursor.execute("DELETE FROM portfolio_history WHERE timestamp < ?", (time_1y_ago,))
    conn.commit()

    return {
        "total_value": total_value,
        "cash": round(cash, 2),
        "invested": round(invested_value, 2),
        "initial_balance": round(initial_balance, 2),
        "change_24h": change_24h,
        "change_24h_percent": change_24h_percent,
        "positions": portfolio,
    }


def snapshot_portfolio_value():
    """Lightweight snapshot – calculate current total and store it.
    Called by the background scheduler every few minutes."""
    try:
        cursor.execute("SELECT symbol, amount FROM holdings")
        holdings = cursor.fetchall()
        invested = 0.0
        for symbol, amount in holdings:
            invested += amount * get_price(symbol)
        cash = get_cash_balance()
        total = round(cash + invested, 2)
        current_time = int(time.time())
        cursor.execute(
            "INSERT INTO portfolio_history (timestamp, total_value) VALUES (?, ?)",
            (current_time, total),
        )
        conn.commit()
        return total
    except Exception:
        return None


def get_portfolio_history_24h():
    """Return portfolio value aggregated into 24 hourly buckets."""
    return get_portfolio_history('24h')


def get_portfolio_history(period: str = '24h'):
    """Return portfolio value history for the given period.

    Supported periods: '1w' (week), '1m' (month), '1y' (year), 'max', '24h'.
    Data is aggregated into appropriate time buckets.
    """
    current_time = int(time.time())

    period_config = {
        '24h': {'seconds': 86400,       'bucket': 3600,      'max_points': 24},
        '1w':  {'seconds': 7 * 86400,   'bucket': 6 * 3600,  'max_points': 28},
        '1m':  {'seconds': 30 * 86400,  'bucket': 86400,     'max_points': 30},
        '1y':  {'seconds': 365 * 86400, 'bucket': 7 * 86400, 'max_points': 52},
        'max': {'seconds': None,        'bucket': None,      'max_points': 100},
    }

    config = period_config.get(period, period_config['24h'])

    if config['seconds'] is not None:
        time_start = current_time - config['seconds']
        cursor.execute(
            "SELECT timestamp, total_value FROM portfolio_history WHERE timestamp >= ? ORDER BY timestamp ASC",
            (time_start,),
        )
    else:
        cursor.execute(
            "SELECT timestamp, total_value FROM portfolio_history ORDER BY timestamp ASC"
        )
    rows = cursor.fetchall()

    if not rows:
        return []

    # For 'max' period, auto-calculate bucket size
    bucket_size = config['bucket']
    if bucket_size is None:
        total_span = rows[-1][0] - rows[0][0]
        if total_span <= 0:
            return [{"timestamp": rows[0][0], "value": round(rows[0][1], 2)}]
        bucket_size = max(3600, total_span // config['max_points'])

    time_start_val = rows[0][0] if config['seconds'] is None else current_time - config['seconds']
    bucket_start = time_start_val - (time_start_val % bucket_size) + bucket_size

    buckets = {}
    for ts, val in rows:
        b_ts = ts - (ts % bucket_size)
        buckets[b_ts] = round(val, 2)

    result = []
    last_value = rows[0][1]
    hour = bucket_start
    while hour <= current_time:
        if hour in buckets:
            last_value = buckets[hour]
        result.append({"timestamp": hour, "value": round(last_value, 2)})
        hour += bucket_size

    return result


# ── Reset ────────────────────────────────────────────────────────────

def reset_account() -> dict:
    """Wipe everything and start fresh with $100,000."""
    cursor.execute("DELETE FROM holdings")
    cursor.execute("DELETE FROM orders")
    cursor.execute("DELETE FROM trade_history")
    cursor.execute("DELETE FROM portfolio_history")
    cursor.execute("DELETE FROM pie_slices")
    cursor.execute("DELETE FROM pies")
    cursor.execute("UPDATE account SET cash_balance = 100000 WHERE id = 1")
    conn.commit()
    return {"status": "ok", "message": "Account reset to $100,000."}


# ── Pies ─────────────────────────────────────────────────────────────

def create_pie(name: str, slices: list) -> dict:
    """Create a pie.  slices = [{symbol, percent}, ...]"""
    if not name:
        return {"error": "Pie name is required."}
    total_pct = sum(s.get("percent", 0) for s in slices)
    if abs(total_pct - 100) > 0.01:
        return {"error": f"Percentages must add up to 100% (currently {total_pct}%)."}
    if len(slices) == 0:
        return {"error": "At least one stock is required."}
    for s in slices:
        if not s.get("symbol") or s.get("percent", 0) <= 0:
            return {"error": "Each slice needs a valid symbol and positive percent."}

    # Validate all symbols exist
    invalid = []
    for s in slices:
        sym = s["symbol"].upper()
        price = get_price(sym)
        if price <= 0:
            invalid.append(sym)
    if invalid:
        return {"error": f"Invalid or unknown symbols: {', '.join(invalid)}"}

    cursor.execute(
        "INSERT INTO pies (name, created_at) VALUES (?, ?)",
        (name, int(time.time())),
    )
    pie_id = cursor.lastrowid
    for s in slices:
        cursor.execute(
            "INSERT INTO pie_slices (pie_id, symbol, percent) VALUES (?, ?, ?)",
            (pie_id, s["symbol"].upper(), s["percent"]),
        )
    conn.commit()
    return {"status": "ok", "pie_id": pie_id, "message": f"Pie '{name}' created."}


def get_pies() -> list:
    cursor.execute("SELECT id, name, created_at FROM pies ORDER BY created_at DESC")
    pies = []
    for pid, name, created_at in cursor.fetchall():
        cursor.execute("SELECT symbol, percent FROM pie_slices WHERE pie_id = ?", (pid,))
        slices = []
        invested_total = 0.0
        for r in cursor.fetchall():
            symbol = r[0]
            price = get_price(symbol)
            # Check how much of this stock the user holds
            cursor.execute("SELECT amount FROM holdings WHERE symbol = ?", (symbol,))
            hrow = cursor.fetchone()
            held = hrow[0] if hrow else 0
            value_held = round(held * price, 2)
            invested_total += value_held
            slices.append({"symbol": symbol, "percent": r[1], "price": round(price, 2), "held": round(held, 4), "value_held": value_held})
        pies.append({"id": pid, "name": name, "created_at": created_at, "slices": slices, "invested_value": round(invested_total, 2)})
    return pies


def delete_pie(pie_id: int) -> dict:
    cursor.execute("DELETE FROM pie_slices WHERE pie_id = ?", (pie_id,))
    cursor.execute("DELETE FROM pies WHERE id = ?", (pie_id,))
    conn.commit()
    if cursor.rowcount == 0:
        return {"error": "Pie not found."}
    return {"status": "ok"}


def update_pie(pie_id: int, name: str, slices: list) -> dict:
    """Update an existing pie's name and slices."""
    cursor.execute("SELECT id FROM pies WHERE id = ?", (pie_id,))
    if not cursor.fetchone():
        return {"error": "Pie not found."}
    if not name:
        return {"error": "Pie name is required."}
    total_pct = sum(s.get("percent", 0) for s in slices)
    if abs(total_pct - 100) > 0.01:
        return {"error": f"Percentages must add up to 100% (currently {total_pct}%)."}
    if len(slices) == 0:
        return {"error": "At least one stock is required."}
    for s in slices:
        if not s.get("symbol") or s.get("percent", 0) <= 0:
            return {"error": "Each slice needs a valid symbol and positive percent."}
    # Validate symbols
    invalid = []
    for s in slices:
        sym = s["symbol"].upper()
        price = get_price(sym)
        if price <= 0:
            invalid.append(sym)
    if invalid:
        return {"error": f"Invalid or unknown symbols: {', '.join(invalid)}"}
    # Update
    cursor.execute("UPDATE pies SET name = ? WHERE id = ?", (name, pie_id))
    cursor.execute("DELETE FROM pie_slices WHERE pie_id = ?", (pie_id,))
    for s in slices:
        cursor.execute(
            "INSERT INTO pie_slices (pie_id, symbol, percent) VALUES (?, ?, ?)",
            (pie_id, s["symbol"].upper(), s["percent"]),
        )
    conn.commit()
    return {"status": "ok", "message": f"Pie '{name}' updated."}


def buy_pie(pie_id: int, total_amount: float) -> dict:
    """Buy stocks according to pie allocation for a given dollar amount."""
    if total_amount <= 0:
        return {"error": "Amount must be positive."}
    cursor.execute("SELECT symbol, percent FROM pie_slices WHERE pie_id = ?", (pie_id,))
    slices = cursor.fetchall()
    if not slices:
        return {"error": "Pie not found or has no stocks."}

    results = []
    for symbol, percent in slices:
        alloc = total_amount * (percent / 100.0)
        price = get_price(symbol)
        if price <= 0:
            results.append({"symbol": symbol, "error": f"Cannot get price for {symbol}."})
            continue
        shares = alloc / price
        if shares <= 0:
            continue
        res = buy_stock(symbol, round(shares, 6))
        results.append({"symbol": symbol, "allocated": round(alloc, 2), "shares": round(shares, 6), "result": res})

    return {"status": "ok", "total": total_amount, "purchases": results}
