from .database import cursor, conn
from .prices import get_price, get_price_change_24h
import time


def buy_stock(symbol: str, amount: int) -> None:
    if amount <= 0:
        return

    current_price = get_price(symbol)
    cursor.execute("SELECT amount, avg_buy_price FROM holdings WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()

    if row:
        old_amount = row[0]
        old_avg_price = row[1] or 0
        # Vypočítat novou průměrnou cenu
        new_amount = old_amount + amount
        new_avg_price = ((old_amount * old_avg_price) + (amount * current_price)) / new_amount
        
        cursor.execute(
            "UPDATE holdings SET amount = ?, avg_buy_price = ? WHERE symbol = ?",
            (new_amount, new_avg_price, symbol),
        )
    else:
        cursor.execute(
            "INSERT INTO holdings (symbol, amount, avg_buy_price) VALUES (?, ?, ?)",
            (symbol, amount, current_price),
        )

    conn.commit()


def sell_stock(symbol: str, amount: int) -> None:
    if amount <= 0:
        return

    cursor.execute("SELECT amount, avg_buy_price FROM holdings WHERE symbol = ?", (symbol,))
    row = cursor.fetchone()

    if not row:
        return

    current_amount = row[0]
    if current_amount < amount:
        return

    new_amount = current_amount - amount
    if new_amount == 0:
        cursor.execute("DELETE FROM holdings WHERE symbol = ?", (symbol,))
    else:
        # Průměrná cena zůstává stejná při prodeji
        cursor.execute(
            "UPDATE holdings SET amount = ? WHERE symbol = ?",
            (new_amount, symbol),
        )

    conn.commit()


def get_portfolio():
    cursor.execute("SELECT symbol, amount, avg_buy_price FROM holdings")
    rows = cursor.fetchall()

    portfolio = []
    total_value = 0.0

    for symbol, amount, avg_buy_price in rows:
        price = get_price(symbol)
        value = round(amount * price, 2)
        total_value += value
        
        # Výpočet all-time zisku
        cost_basis = amount * (avg_buy_price or 0)
        profit = value - cost_basis
        profit_percent = ((profit / cost_basis) * 100) if cost_basis > 0 else 0
        
        # Získat 24h změnu ceny
        price_change_24h = get_price_change_24h(symbol)
        
        portfolio.append(
            {
                "symbol": symbol,
                "amount": amount,
                "price": round(price, 2),
                "value": value,
                "avg_buy_price": round(avg_buy_price or 0, 2),
                "profit": round(profit, 2),
                "profit_percent": round(profit_percent, 2),
                "price_change_24h": round(price_change_24h, 2),
            }
        )

    total_value = round(total_value, 2)
    
    # Uložení aktuální hodnoty do historie
    current_time = int(time.time())
    cursor.execute(
        "INSERT INTO portfolio_history (timestamp, total_value) VALUES (?, ?)",
        (current_time, total_value)
    )
    conn.commit()
    
    # Výpočet změny za 24 hodin
    time_24h_ago = current_time - (24 * 60 * 60)
    cursor.execute(
        "SELECT total_value FROM portfolio_history WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT 1",
        (time_24h_ago,)
    )
    old_row = cursor.fetchone()
    
    change_24h = 0.0
    change_24h_percent = 0.0
    
    if old_row and old_row[0] > 0:
        old_value = old_row[0]
        change_24h = round(total_value - old_value, 2)
        change_24h_percent = round((change_24h / old_value) * 100, 2)
    
    # Vyčištění starých záznamů (starší než 7 dní)
    time_7d_ago = current_time - (7 * 24 * 60 * 60)
    cursor.execute("DELETE FROM portfolio_history WHERE timestamp < ?", (time_7d_ago,))
    conn.commit()

    return {
        "total_value": total_value,
        "change_24h": change_24h,
        "change_24h_percent": change_24h_percent,
        "positions": portfolio
    }


def get_portfolio_history_24h():
    """Vrátí historii hodnoty portfolia za posledních 24 hodin."""
    current_time = int(time.time())
    time_24h_ago = current_time - (24 * 60 * 60)
    
    cursor.execute(
        "SELECT timestamp, total_value FROM portfolio_history WHERE timestamp >= ? ORDER BY timestamp ASC",
        (time_24h_ago,)
    )
    rows = cursor.fetchall()
    
    history = []
    for timestamp, total_value in rows:
        history.append({
            "timestamp": timestamp,
            "value": round(total_value, 2)
        })
    
    return history
