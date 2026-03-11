"""
User authentication module.

Uses PBKDF2-SHA256 for password hashing and signed tokens (HMAC-SHA256) for sessions.
No external dependencies – only Python standard library.
"""

import os
import time
import json
import base64
import hmac
import hashlib
import secrets

from .database import cursor, conn

# ── Secret key (env var for production, file fallback for local dev) ───
if os.environ.get("SECRET_KEY"):
    SECRET_KEY = os.environ["SECRET_KEY"]
else:
    _key_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".secret_key")
    if os.path.exists(_key_path):
        with open(_key_path) as _f:
            SECRET_KEY = _f.read().strip()
    else:
        SECRET_KEY = secrets.token_hex(32)
        with open(_key_path, "w") as _f:
            _f.write(SECRET_KEY)


# ── Password hashing ────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2-SHA256."""
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
    return f"{salt}:{h.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt, expected = stored.split(":")
        h = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000)
        return hmac.compare_digest(h.hex(), expected)
    except Exception:
        return False


# ── Token management ────────────────────────────────────────────────

def create_token(user_id: int, username: str) -> str:
    """Create a signed token containing user_id and username (valid 7 days)."""
    payload = json.dumps({"uid": user_id, "u": username, "exp": int(time.time()) + 86400 * 7})
    b = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), b.encode(), hashlib.sha256).hexdigest()
    return f"{b}.{sig}"


def verify_token(token: str):
    """Verify and decode a token. Returns {user_id, username} or None."""
    try:
        b, sig = token.rsplit(".", 1)
        expected = hmac.new(SECRET_KEY.encode(), b.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        # Fix base64 padding
        pad = 4 - len(b) % 4
        if pad != 4:
            b += "=" * pad
        payload = json.loads(base64.urlsafe_b64decode(b))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return {"user_id": payload["uid"], "username": payload["u"]}
    except Exception:
        return None


# ── Registration & Login ────────────────────────────────────────────

def register_user(username: str, password: str) -> dict:
    """Register a new user. Creates account with $100,000."""
    username = username.strip().lower()
    if len(username) < 3:
        return {"error": "Username must be at least 3 characters."}
    if len(password) < 4:
        return {"error": "Password must be at least 4 characters."}

    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        return {"error": "Username already taken."}

    pw_hash = hash_password(password)
    cursor.execute(
        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
        (username, pw_hash, int(time.time())),
    )
    uid = cursor.lastrowid

    # Create default trading account
    cursor.execute(
        "INSERT INTO account (user_id, cash_balance, initial_balance) VALUES (?, 100000, 100000)",
        (uid,),
    )
    conn.commit()

    token = create_token(uid, username)
    return {"status": "ok", "token": token, "username": username, "user_id": uid}


def login_user(username: str, password: str) -> dict:
    """Authenticate a user. Returns token on success."""
    username = username.strip().lower()
    cursor.execute("SELECT id, password_hash FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if not row or not verify_password(password, row[1]):
        return {"error": "Invalid username or password."}

    token = create_token(row[0], username)
    return {"status": "ok", "token": token, "username": username, "user_id": row[0]}


# ── Helpers ──────────────────────────────────────────────────────────

def get_all_user_ids() -> list:
    """Return all user IDs (used by background snapshot task)."""
    cursor.execute("SELECT id FROM users")
    return [r[0] for r in cursor.fetchall()]
