import sqlite3
import os

# Ensure DB lives next to this file (project root)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "portfolio.db")

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

# Holdings table
cursor.execute(
    """CREATE TABLE IF NOT EXISTS holdings (
        symbol TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        avg_buy_price REAL DEFAULT 0
    )"""
)

# Přidání sloupce do existující tabulky pokud neexistuje
try:
    cursor.execute("ALTER TABLE holdings ADD COLUMN avg_buy_price REAL DEFAULT 0")
    conn.commit()
except:
    pass  # Sloupec už existuje

# Account table – virtual cash balance
cursor.execute(
    """CREATE TABLE IF NOT EXISTS account (
        id INTEGER PRIMARY KEY DEFAULT 1,
        cash_balance REAL NOT NULL DEFAULT 100000,
        initial_balance REAL NOT NULL DEFAULT 100000
    )"""
)
cursor.execute(
    "INSERT OR IGNORE INTO account (id, cash_balance, initial_balance) VALUES (1, 100000, 100000)"
)

# Pending orders table (limit, stop-loss, take-profit)
cursor.execute(
    """CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        order_type TEXT NOT NULL,
        action TEXT NOT NULL,
        amount REAL NOT NULL,
        target_price REAL NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT DEFAULT 'pending'
    )"""
)

# Trade history table (all executed trades)
cursor.execute(
    """CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL,
        amount REAL NOT NULL,
        price REAL NOT NULL,
        fee REAL NOT NULL,
        total REAL NOT NULL,
        profit REAL DEFAULT 0,
        timestamp INTEGER NOT NULL,
        order_type TEXT DEFAULT 'market'
    )"""
)

# Portfolio history table
cursor.execute(
    """CREATE TABLE IF NOT EXISTS portfolio_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        total_value REAL NOT NULL
    )"""
)

# Pies table
cursor.execute(
    """CREATE TABLE IF NOT EXISTS pies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )"""
)

# Pie slices table
cursor.execute(
    """CREATE TABLE IF NOT EXISTS pie_slices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pie_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        percent REAL NOT NULL,
        FOREIGN KEY (pie_id) REFERENCES pies(id) ON DELETE CASCADE
    )"""
)

conn.commit()
