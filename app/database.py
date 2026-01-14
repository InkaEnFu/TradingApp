import sqlite3
import os

# Ensure DB lives next to this file (project root)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "portfolio.db")

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

cursor.execute(
    """CREATE TABLE IF NOT EXISTS holdings (
        symbol TEXT PRIMARY KEY,
        amount INTEGER NOT NULL,
        avg_buy_price REAL DEFAULT 0
    )"""
)

# Přidání sloupce do existující tabulky pokud neexistuje
try:
    cursor.execute("ALTER TABLE holdings ADD COLUMN avg_buy_price REAL DEFAULT 0")
    conn.commit()
except:
    pass  # Sloupec už existuje

cursor.execute(
    """CREATE TABLE IF NOT EXISTS portfolio_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        total_value REAL NOT NULL
    )"""
)

conn.commit()
