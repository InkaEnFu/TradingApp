# Investment Simulator

Webová aplikace simulující obchodování na burze s reálnými cenami akcií, kryptoměn, forexu a komodit. Každý uživatel začíná s virtuálním kapitálem **$100 000** a může obchodovat bez rizika ztráty reálných peněz.

---

## Obsah

- [Funkce](#funkce)
- [Technologie](#technologie)
- [Architektura projektu](#architektura-projektu)
- [Jak spustit](#jak-spustit)
- [Jak funguje – popis modulů](#jak-funguje--popis-modulů)
- [API přehled](#api-přehled)
- [Databáze](#databáze)

---

## Funkce

- **Registrace a přihlášení** – každý uživatel má vlastní oddělené portfolio
- **Nákup a prodej** – tržní i limitní příkazy pro akcie, krypto, forex a komodity
- **Reálné ceny** – data z Yahoo Finance přes knihovnu `yfinance`
- **Portfolio** – přehled držených pozic, průměrná nákupní cena, aktuální zisk/ztráta
- **Historie portfolia** – snímky hodnoty portfolia každých 5 minut (grafy)
- **Obchodní historie** – záznamy všech provedených obchodů a statistiky
- **Investiční „koláče" (Pies)** – vytvoření vlastní sady aktiv s alokací v procentech a jednorázová koupě celého koláče
- **Backtesting** – otestování strategie na historických datech
- **Vyhledávání symbolů** – lokální seznam + live vyhledávání přes Yahoo Finance API
- **Reset účtu** – vrácení portfolia na počáteční stav $100 000
- **Poplatky** – 0,1 % z každé transakce

---

## Technologie

| Vrstva | Technologie |
|---|---|
| Backend | [FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/) |
| Databáze | SQLite (`portfolio.db`) |
| Cenová data | [yfinance](https://github.com/ranaroussi/yfinance) |
| Autentizace | PBKDF2-SHA256 (hesla) + HMAC-SHA256 tokeny |
| Frontend | HTML + CSS + Vanilla JavaScript |
| Spuštění | `python run.py` |

---

## Architektura projektu

```
investment_app/
├── run.py                  # Vstupní bod – spustí server a otevře prohlížeč
├── requirements.txt        # Python závislosti
├── portfolio.db            # SQLite databáze (generuje se automaticky)
├── .secret_key             # Tajný klíč pro podepisování tokenů (generuje se automaticky)
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI aplikace, všechny HTTP routes
│   ├── auth.py             # Registrace, přihlášení, tokeny
│   ├── database.py         # Připojení k DB, schéma tabulek, migrace
│   ├── portfolio.py        # Logika nákupu/prodeje, portfolio, objednávky, koláče
│   ├── prices.py           # Získání cen z Yahoo Finance, historická data, backtest
│   ├── technology_api.py   # API pro vyhledávání symbolů a kategorií
│   └── stock_categories.py # Předdefinovaný seznam akcií podle sektoru
└── static/
    ├── index.html          # Hlavní stránka (dashboard, obchodování)
    ├── login.html          # Přihlašovací / registrační stránka
    ├── portfolio.html      # Detailní pohled na portfolio
    ├── script.js           # Veškerá frontend logika
    └── style.css           # Styly
```

---

## Jak spustit

### Požadavky

- Python 3.10+
- Připojení k internetu (pro stahování cen z Yahoo Finance)

### Instalace

```bash
# Naklonuj nebo stáhni projekt, přejdi do složky investment_app
cd investment_app

# Vytvoř virtuální prostředí
python -m venv .venv
.venv\Scripts\activate        # Windows
# nebo: source .venv/bin/activate  # Linux/macOS

# Nainstaluj závislosti
pip install -r requirements.txt
```

### Spuštění

```bash
python run.py
```

Skript automaticky spustí server na `http://127.0.0.1:8000` a otevře prohlížeč. Při prvním spuštění se vytvoří soubory `portfolio.db` a `.secret_key`.

---

## Jak funguje – popis modulů

### `run.py` – spuštění aplikace

Spustí Uvicorn server jako samostatný proces a po 1 sekundě otevře prohlížeč na adrese `http://127.0.0.1:8000`.

---

### `app/auth.py` – autentizace

- **Hesla**: hashována pomocí PBKDF2-SHA256 s náhodnou solí (200 000 iterací)
- **Tokeny**: podepsané HMAC-SHA256, platnost 7 dní, uložené jako `HttpOnly` cookie `auth_token`
- **Tajný klíč**: vygenerován jednou při prvním spuštění, uložen v `.secret_key`
- **Nový uživatel**: po registraci dostane automaticky $100 000 na účet

---

### `app/database.py` – databáze

Vytváří a spravuje SQLite databázi se schématem:

| Tabulka | Popis |
|---|---|
| `users` | Uživatelé (jméno, hash hesla) |
| `account` | Zůstatek hotovosti a počáteční kapitál |
| `holdings` | Aktuálně držené pozice (symbol, množství, průměrná nákupní cena) |
| `orders` | Čekající limitní příkazy |
| `trade_history` | Kompletní záznamy všech obchodů |
| `portfolio_history` | Časové snímky celkové hodnoty portfolia |
| `pies` | Uložené investiční koláče |

Modul obsahuje také automatickou **migraci** pro případ, že existuje starší schéma bez sloupce `user_id`.

---

### `app/prices.py` – ceny a grafy

- `get_price(symbol)` – aktuální cena z Yahoo Finance
- `get_price_change_24h(symbol)` – procentuální změna za posledních 24 h
- `get_stock_history(symbol, period)` – historická data pro grafy (`1d`, `1w`, `1m`, `1y`), vrací data pro čárový graf i svíčkový (OHLC) graf
- `run_backtest(symbol, period, strategy)` – backtesting zvolené strategie na historických datech

---

### `app/portfolio.py` – obchodování a portfolio

- **Nákup** (`buy_stock`): odpočítá hotovost + poplatek 0,1 %, přidá/aktualizuje pozici v `holdings`, uloží záznam obchodu
- **Prodej** (`sell_stock`): realizuje zisk/ztrátu, odebere pozici, připíše hotovost
- **Limitní příkazy** (`create_order`): uložené příkazy, kontrolované periodicky v `check_pending_orders`
- **Koláče** (`create_pie`, `buy_pie`): definice alokací v %, jednorázová koupě všech složek koláče najednou
- **Snímky portfolia** (`snapshot_portfolio_value`): ukládají celkovou hodnotu každých 5 minut pro grafy vývoje
- **Reset účtu** (`reset_account`): smaže všechny pozice, obchody, objednávky a vrátí zůstatek na $100 000

---

### `app/technology_api.py` – vyhledávání symbolů

- `GET /api/symbols/search?q=...` – hledá nejprve v lokálním seznamu, pak volá Yahoo Finance Search API; vrací až 15 výsledků
- `GET /api/stocks-by-category` – vrátí předdefinovaný seznam akcií řazených do sektorů i s aktuální cenou a procentuální změnou

---

### `app/stock_categories.py` – předdefinované sektory

Statický slovník s předvybranými symboly pro 8 sektorů:

`Technology` · `IT` · `Financial` · `Healthcare` · `AI` · `Cryptocurrency` · `Forex` · `Commodities`

---

### `app/main.py` – FastAPI aplikace

- Registruje všechny HTTP routy (`/api/auth/...`, `/api/portfolio/...`, `/api/prices/...`, atd.)
- Obsluhuje statické soubory (`/static/`)
- Spouští **background task** – každých 5 minut ukládá snímek hodnoty portfolia pro všechny uživatele
- Autorizace u chráněných endpointů probíhá přes `auth_token` cookie

---

## API přehled

| Metoda | Endpoint | Popis |
|---|---|---|
| `GET` | `/login` | Přihlašovací stránka |
| `POST` | `/api/auth/register` | Registrace nového uživatele |
| `POST` | `/api/auth/login` | Přihlášení |
| `POST` | `/api/auth/logout` | Odhlášení |
| `GET` | `/api/portfolio` | Aktuální portfolio uživatele |
| `GET` | `/api/account` | Přehled účtu (hotovost, zisk, celková hodnota) |
| `POST` | `/api/buy` | Nákup aktiva |
| `POST` | `/api/sell` | Prodej aktiva |
| `GET` | `/api/history` | Historie obchodů |
| `GET` | `/api/price/{symbol}` | Aktuální cena symbolu |
| `GET` | `/api/chart/{symbol}` | Historická data pro graf |
| `POST` | `/api/orders` | Vytvoření limitního příkazu |
| `DELETE` | `/api/orders/{id}` | Zrušení příkazu |
| `GET` | `/api/pies` | Seznam investičních koláčů |
| `POST` | `/api/pies` | Vytvoření koláče |
| `POST` | `/api/pies/{id}/buy` | Koupě celého koláče |
| `GET` | `/api/symbols/search` | Vyhledávání symbolů |
| `GET` | `/api/stocks-by-category` | Akcie podle sektoru |
| `POST` | `/api/reset` | Reset účtu na $100 000 |

---

## Databáze

Databáze je uložena jako soubor `portfolio.db` přímo ve složce `investment_app/`. Vytváří se automaticky při prvním spuštění. Pro každého uživatele jsou data plně oddělena pomocí sloupce `user_id`.

> **Poznámka:** Soubory `portfolio.db` a `.secret_key` jsou specifické pro dané spuštění a nejsou součástí zdrojového kódu.
