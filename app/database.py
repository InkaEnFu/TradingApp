import sqlite3
import os

# Ensure DB lives next to this file (project root)
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "portfolio.db")

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("PRAGMA foreign_keys = ON")

# ── Users table ──────────────────────────────────────────────────────
cursor.execute(
    """CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )"""
)

# ── Detect old (single-user) schema and migrate ─────────────────────
def _has_column(table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())

def _table_exists(table: str) -> bool:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None

_needs_migration = _table_exists("holdings") and not _has_column("holdings", "user_id")

if _needs_migration:
    import time as _time, secrets as _sec, hashlib as _hl
    # Create a legacy user so old data is preserved
    _salt = _sec.token_hex(16)
    _pwh = _salt + ":" + _hl.pbkdf2_hmac("sha256", b"changeme", _salt.encode(), 200_000).hex()
    cursor.execute("INSERT OR IGNORE INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                   ("legacy_user", _pwh, int(_time.time())))
    conn.commit()
    cursor.execute("SELECT id FROM users WHERE username = 'legacy_user'")
    _duid = cursor.fetchone()[0]

    # Holdings – needs new composite PK
    cursor.execute("ALTER TABLE holdings RENAME TO _holdings_old")
    cursor.execute(
        """CREATE TABLE holdings (
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            amount REAL NOT NULL,
            avg_buy_price REAL DEFAULT 0,
            PRIMARY KEY (user_id, symbol),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )
    cursor.execute("INSERT INTO holdings (user_id, symbol, amount, avg_buy_price) "
                   "SELECT ?, symbol, amount, COALESCE(avg_buy_price, 0) FROM _holdings_old", (_duid,))
    cursor.execute("DROP TABLE _holdings_old")

    # Account – PK changes from id to user_id
    cursor.execute("ALTER TABLE account RENAME TO _account_old")
    cursor.execute(
        """CREATE TABLE account (
            user_id INTEGER PRIMARY KEY,
            cash_balance REAL NOT NULL DEFAULT 100000,
            initial_balance REAL NOT NULL DEFAULT 100000,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )
    cursor.execute("INSERT INTO account (user_id, cash_balance, initial_balance) "
                   "SELECT ?, cash_balance, initial_balance FROM _account_old", (_duid,))
    cursor.execute("DROP TABLE _account_old")

    # Other tables – just add user_id column
    for _tbl in ("orders", "trade_history", "portfolio_history", "pies"):
        if _table_exists(_tbl) and not _has_column(_tbl, "user_id"):
            cursor.execute(f"ALTER TABLE {_tbl} ADD COLUMN user_id INTEGER DEFAULT {_duid}")
    conn.commit()
else:
    # Fresh database – create all tables with user_id from the start
    cursor.execute(
        """CREATE TABLE IF NOT EXISTS holdings (
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            amount REAL NOT NULL,
            avg_buy_price REAL DEFAULT 0,
            PRIMARY KEY (user_id, symbol),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS account (
            user_id INTEGER PRIMARY KEY,
            cash_balance REAL NOT NULL DEFAULT 100000,
            initial_balance REAL NOT NULL DEFAULT 100000,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            order_type TEXT NOT NULL,
            action TEXT NOT NULL,
            amount REAL NOT NULL,
            target_price REAL NOT NULL,
            created_at INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS trade_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            action TEXT NOT NULL,
            amount REAL NOT NULL,
            price REAL NOT NULL,
            fee REAL NOT NULL,
            total REAL NOT NULL,
            profit REAL DEFAULT 0,
            timestamp INTEGER NOT NULL,
            order_type TEXT DEFAULT 'market',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS portfolio_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            total_value REAL NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS pies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"""
    )

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
