# Technická dokumentace – ZenTrade

## Obsah

1. [Přehled projektu](#1-přehled-projektu)
2. [Technologický stack](#2-technologický-stack)
3. [Architektura aplikace](#3-architektura-aplikace)
4. [Struktura souborů](#4-struktura-souborů)
5. [Databáze](#5-databáze)
6. [Autentizace a bezpečnost](#6-autentizace-a-bezpečnost)
7. [Backend – APIEndpointy](#7-backend--api-endpointy)
8. [Obchodní logika](#8-obchodní-logika)
9. [Správa portfolia](#9-správa-portfolia)
10. [Systém Pies](#10-systém-pies)
11. [Získávání tržních dat](#11-získávání-tržních-dat)
12. [Backtesting](#12-backtesting)
13. [Frontend](#13-frontend)
14. [Pozadí a úlohy na pozadí](#14-pozadí-a-úlohy-na-pozadí)
15. [Cachování a optimalizace](#15-cachování-a-optimalizace)
16. [Nasazení (Deployment)](#16-nasazení-deployment)
17. [Konfigurace a proměnné prostředí](#17-konfigurace-a-proměnné-prostředí)

---

## 1. Přehled projektu

**ZenTrade** je webová aplikace pro simulaci investování na finančních trzích. Aplikace umožňuje uživatelům obchodovat s akciemi, kryptoměnami, forexem a komoditami s využitím reálných tržních dat z Yahoo Finance – bez rizika ztráty skutečných peněz.

### Hlavní funkce

- Víceuživatelský systém s bezpečnou autentizací
- Virtuální účet s počátečním zůstatkem **$100 000**
- Obchodování s akciemi, kryptoměnami, komoditami a forexovými páry
- Tržní příkazy (okamžité) a podmíněné příkazy (Target Buy/Sell)
- Interaktivní grafy (liniové i svíčkové)
- Systém „Pies" pro automatické rozložení investice
- Backtesting – historická simulace
- Historie obchodů a statistiky úspěšnosti
- Responzivní design pro desktop i mobilní zařízení

---

## 2. Technologický stack

### Backend

| Technologie | Verze | Účel |
|---|---|---|
| **Python** | 3.x | Hlavní programovací jazyk |
| **FastAPI** | nejnovější | Asynchronní webový framework |
| **Uvicorn** | nejnovější | ASGI server |
| **yfinance** | nejnovější | Získávání tržních dat z Yahoo Finance |
| **SQLite3** | vestavěný | Relační databáze (bez serveru) |
| **requests** | nejnovější | HTTP klient pro vyhledávání symbolů |
| **a2wsgi** | nejnovější | ASGI/WSGI bridge |

### Frontend

| Technologie | Účel |
|---|---|
| **HTML5** | Struktura stránek |
| **CSS3** | Vlastní design systém s CSS proměnnými |
| **Vanilla JavaScript** | Aplikační logika (bez frameworků) |
| **Chart.js** | Grafy portfolia a backtestingu |
| **Lightweight Charts** | Svíčkové grafy (TradingView knihovna) |

### Nasazení

| Služba | Účel |
|---|---|
| **Render** | Hosting webové služby |
| **GitHub** | Správa zdrojového kódu, automatický deploy |

---

## 3. Architektura aplikace

Aplikace využívá architekturu **klient-server**:

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │index.html│  │login.html│  │    script.js       │  │
│  │(hlavní)  │  │(přihlášení)│ │(aplikační logika) │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                      │                               │
│               fetch('/api/...')                       │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP (JSON)
┌─────────────────────┴───────────────────────────────┐
│                    BACKEND (FastAPI)                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ main.py  │  │ auth.py   │  │technology_api.py │  │
│  │(routy)   │  │(autentiz.)│  │(vyhledávání)     │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │portfolio │  │ prices.py │  │stock_categories  │  │
│  │.py       │  │(ceny)     │  │.py (kategorie)   │  │
│  └──────────┘  └───────────┘  └──────────────────┘  │
│                      │                               │
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────┐
│              DATOVÁ VRSTVA                           │
│  ┌──────────────┐        ┌────────────────────┐     │
│  │ database.py  │        │ Yahoo Finance API  │     │
│  │ (SQLite)     │        │ (yfinance)         │     │
│  └──────────────┘        └────────────────────┘     │
│  portfolio.db                                        │
└─────────────────────────────────────────────────────┘
```

---

## 4. Struktura souborů

```
investment_app/
├── run.py                    # Vstupní bod pro lokální spuštění
├── requirements.txt          # Python závislosti
├── render.yaml               # Konfigurace pro Render hosting
├── .gitignore                # Ignorované soubory
├── .secret_key               # Automaticky generovaný tajný klíč (nenahrává se na Git)
├── portfolio.db              # SQLite databáze (nenahrává se na Git)
│
├── app/                      # Backend aplikace
│   ├── __init__.py           # Označení Python balíčku
│   ├── main.py               # FastAPI aplikace, routy, životní cyklus
│   ├── auth.py               # Autentizace, hashování hesel, tokeny
│   ├── database.py           # Schéma databáze, migrace, připojení
│   ├── portfolio.py          # Obchodní logika (nákup, prodej, portfolio)
│   ├── prices.py             # Získávání cen z Yahoo Finance
│   ├── stock_categories.py   # Definice kategorií aktiv
│   └── technology_api.py     # API router – vyhledávání symbolů, kategorie
│
├── static/                   # Frontend soubory
│   ├── index.html            # Hlavní stránka aplikace
│   ├── login.html            # Přihlašovací/registrační stránka
│   ├── script.js             # JavaScript – veškerá logika frontendu
│   └── style.css             # Styly – tmavý design
│
├── MANUAL.md                 # Uživatelský manuál
├── README.md                 # Popis projektu
├── DEPLOY_RENDER.md          # Návod na nasazení na Render
└── LICENSE                   # Licence
```

### Popis klíčových souborů

| Soubor | Řádků | Popis |
|---|---|---|
| `app/main.py` | ~250 | FastAPI aplikace se 19+ endpointy, middleware, životní cyklus |
| `app/auth.py` | ~130 | Kompletní autentizační systém bez externích závislostí |
| `app/database.py` | ~150 | Schéma 7 tabulek, automatická migrace ze single-user |
| `app/portfolio.py` | ~450 | Jádro obchodní logiky – nákup, prodej, objednávky, pies |
| `app/prices.py` | ~100 | Wrapper nad yfinance pro ceny, historii, backtest |
| `app/technology_api.py` | ~100 | Vyhledávání symbolů, kategorie s paralelním načítáním |
| `static/script.js` | ~900 | Veškerá frontendová logika |
| `static/style.css` | ~600 | Kompletní design systém |
| `static/index.html` | ~300 | HTML struktura hlavní aplikace |

---

## 5. Databáze

Aplikace používá **SQLite3** – souborovou relační databázi bez nutnosti serveru. Databázový soubor `portfolio.db` se automaticky vytvoří při prvním spuštění.

### Schéma tabulek

#### Tabulka `users`

Ukládá registrované uživatele.

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unikátní identifikátor |
| `username` | TEXT | UNIQUE NOT NULL | Uživatelské jméno (malá písmena) |
| `password_hash` | TEXT | NOT NULL | Hash hesla (PBKDF2-SHA256) |
| `created_at` | INTEGER | NOT NULL | Unix timestamp registrace |

#### Tabulka `account`

Finanční stav účtu uživatele.

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `user_id` | INTEGER | PRIMARY KEY, FK → users.id | Identifikátor uživatele |
| `cash_balance` | REAL | DEFAULT 100000 | Aktuální hotovost |
| `initial_balance` | REAL | DEFAULT 100000 | Počáteční zůstatek |

#### Tabulka `holdings`

Aktuální držené pozice (akcie, krypto atd.).

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `user_id` | INTEGER | NOT NULL, FK → users.id | Identifikátor uživatele |
| `symbol` | TEXT | NOT NULL | Ticker symbol (např. AAPL) |
| `amount` | REAL | NOT NULL | Počet držených jednotek |
| `avg_buy_price` | REAL | DEFAULT 0 | Průměrná nákupní cena |
| | | PRIMARY KEY (user_id, symbol) | Kompozitní klíč |

#### Tabulka `orders`

Čekající (podmíněné) příkazy.

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID objednávky |
| `user_id` | INTEGER | NOT NULL, FK → users.id | Identifikátor uživatele |
| `symbol` | TEXT | NOT NULL | Ticker symbol |
| `order_type` | TEXT | NOT NULL | Typ: limit, stop_loss, target_sell, target_buy |
| `action` | TEXT | NOT NULL | Akce: buy nebo sell |
| `amount` | REAL | NOT NULL | Množství |
| `target_price` | REAL | NOT NULL | Cílová cena pro vykonání |
| `created_at` | INTEGER | NOT NULL | Unix timestamp vytvoření |
| `status` | TEXT | DEFAULT 'pending' | Stav: pending, executed, cancelled |

#### Tabulka `trade_history`

Záznamy o provedených obchodech.

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID záznamu |
| `user_id` | INTEGER | NOT NULL, FK → users.id | Identifikátor uživatele |
| `symbol` | TEXT | NOT NULL | Ticker symbol |
| `action` | TEXT | NOT NULL | buy nebo sell |
| `amount` | REAL | NOT NULL | Množství |
| `price` | REAL | NOT NULL | Cena při provedení |
| `fee` | REAL | NOT NULL | Poplatek (0.1 %) |
| `total` | REAL | NOT NULL | Celková částka (po poplatku) |
| `profit` | REAL | DEFAULT 0 | Realizovaný zisk (jen u prodejů) |
| `timestamp` | INTEGER | NOT NULL | Unix timestamp obchodu |
| `order_type` | TEXT | DEFAULT 'market' | Typ objednávky |

#### Tabulka `portfolio_history`

Snímky hodnoty portfolia pro grafy.

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID záznamu |
| `user_id` | INTEGER | NOT NULL, FK → users.id | Identifikátor uživatele |
| `timestamp` | INTEGER | NOT NULL | Unix timestamp |
| `total_value` | REAL | NOT NULL | Celková hodnota portfolia |

#### Tabulka `pies` a `pie_slices`

Systém „koláčů" pro automatické investování.

**pies:**

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID koláče |
| `user_id` | INTEGER | NOT NULL, FK → users.id | Identifikátor uživatele |
| `name` | TEXT | NOT NULL | Název koláče |
| `created_at` | INTEGER | NOT NULL | Unix timestamp |

**pie_slices:**

| Sloupec | Typ | Omezení | Popis |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | ID řezu |
| `pie_id` | INTEGER | NOT NULL, FK → pies.id (CASCADE) | ID koláče |
| `symbol` | TEXT | NOT NULL | Ticker symbol |
| `percent` | REAL | NOT NULL | Procentuální alokace |

### ER Diagram (textový)

```
users ─────┬──── account         (1:1)
           ├──── holdings        (1:N)
           ├──── orders          (1:N)
           ├──── trade_history   (1:N)
           ├──── portfolio_history (1:N)
           └──── pies            (1:N)
                   └──── pie_slices (1:N, CASCADE DELETE)
```

### Automatická migrace

Modul `database.py` obsahuje logiku pro automatickou migraci z jednouživa­telského schématu na víceuživatelské:
1. Detekuje staré schéma (tabulka `holdings` bez sloupce `user_id`)
2. Vytvoří uživatele `legacy_user` s výchozím heslem
3. Přemigruje data ze starých tabulek do nového schématu
4. Zachová veškerá existující data

---

## 6. Autentizace a bezpečnost

Autentizační systém je implementován v modulu `auth.py` **bez externích závislostí** – využívá pouze standardní knihovnu Pythonu.

### Hashování hesel

- **Algoritmus:** PBKDF2-SHA256
- **Iterace:** 200 000
- **Salt:** 32bajtový náhodný řetězec (unikátní pro každého uživatele)
- **Formát uložení:** `{salt}:{hash}`
- **Porovnání:** Časově konstantní (`hmac.compare_digest`) – ochrana proti timing útokům

### Tokeny (session management)

- **Formát:** `{base64_payload}.{HMAC-SHA256_podpis}` (podobné JWT, bez externích knihoven)
- **Payload:** JSON s `uid` (ID uživatele), `u` (username), `exp` (expirace)
- **Platnost:** 7 dní (v tokenu), cookie 24 hodin
- **Podpis:** HMAC-SHA256 s tajným klíčem `SECRET_KEY`
- **Uložení:** HttpOnly cookie `auth_token` (nepřístupná z JavaScriptu)

### Správa tajného klíče

```
1. Pokud existuje env proměnná SECRET_KEY → použije se
2. Pokud existuje soubor .secret_key → načte se z něj
3. Jinak → vygeneruje se nový a uloží do .secret_key
```

Na produkci (Render) se používá env proměnná, aby klíč přežil redeploy.

### Bezpečnostní opatření

| Opatření | Implementace |
|---|---|
| HttpOnly cookies | Token není přístupný z JS → ochrana proti XSS |
| SameSite=Lax | Ochrana proti CSRF útokům |
| PBKDF2 s vysokým počtem iterací | Odolnost proti brute-force útokům |
| Konstantní porovnání hashů | Ochrana proti timing útokům |
| Náhodný salt per uživatel | Ochrana proti rainbow table útokům |

### Funkce modulu auth.py

| Funkce | Parametry | Návratová hodnota | Popis |
|---|---|---|---|
| `hash_password` | `password: str` | `str` | Zahashuje heslo s náhodným saltem |
| `verify_password` | `password: str, stored: str` | `bool` | Ověří heslo proti uloženému hashi |
| `create_token` | `user_id: int, username: str` | `str` | Vytvoří podepsaný token (platný 7 dní) |
| `verify_token` | `token: str` | `dict \| None` | Ověří a dekóduje token |
| `register_user` | `username: str, password: str` | `dict` | Registrace nového uživatele |
| `login_user` | `username: str, password: str` | `dict` | Přihlášení uživatele |
| `get_all_user_ids` | – | `list[int]` | Vrátí ID všech uživatelů |

---

## 7. Backend – API Endpointy

### Autentizační endpointy

| Metoda | Cesta | Autentizace | Tělo požadavku | Odpověď |
|---|---|---|---|---|
| `GET` | `/login` | Ne | – | HTML login stránka |
| `POST` | `/api/auth/register` | Ne | `{username, password}` | `{status, username}` + cookie |
| `POST` | `/api/auth/login` | Ne | `{username, password}` | `{status, username}` + cookie |
| `POST` | `/api/auth/logout` | Ano (cookie) | – | `{status: ok}` + smaže cookie |
| `GET` | `/api/auth/me` | Ano (cookie) | – | `{username, user_id}` nebo 401 |

### Obchodní endpointy

| Metoda | Cesta | Autentizace | Tělo požadavku | Odpověď |
|---|---|---|---|---|
| `POST` | `/api/trade` | Ano | `{symbol, action, amount, order_type?, target_price?}` | Výsledek obchodu |
| `POST` | `/api/buy/{symbol}/{amount}` | Ano | – | Výsledek nákupu |
| `POST` | `/api/sell/{symbol}/{amount}` | Ano | – | Výsledek prodeje |

### Správa objednávek

| Metoda | Cesta | Autentizace | Odpověď |
|---|---|---|---|
| `GET` | `/api/orders` | Ano | Seznam čekajících objednávek |
| `DELETE` | `/api/orders/{order_id}` | Ano | `{status: ok}` nebo chyba |
| `POST` | `/api/orders/check` | Ano | `{executed: [...]}` |

### Portfolio

| Metoda | Cesta | Autentizace | Odpověď |
|---|---|---|---|
| `GET` | `/api/portfolio` | Ano | Kompletní snímek portfolia |
| `GET` | `/api/portfolio/history/{period}` | Ano | Časová řada hodnoty portfolia |
| `GET` | `/api/account` | Ano | `{cash, invested, total, initial, profit, profit_percent}` |

### Historie a statistiky

| Metoda | Cesta | Autentizace | Odpověď |
|---|---|---|---|
| `GET` | `/api/trade-history` | Ano | Posledních 50 obchodů |
| `GET` | `/api/trade-stats` | Ano | Statistiky (výhry, prohry, poplatky) |
| `POST` | `/api/reset` | Ano | Reset účtu na $100 000 |
| `POST` | `/api/sell-all` | Ano | Prodej všech pozic |

### Pies (koláče)

| Metoda | Cesta | Autentizace | Tělo | Odpověď |
|---|---|---|---|---|
| `GET` | `/api/pies` | Ano | – | Seznam koláčů s cenami |
| `POST` | `/api/pies` | Ano | `{name, slices}` | Vytvořený koláč |
| `PUT` | `/api/pies/{pie_id}` | Ano | `{name, slices}` | Aktualizovaný koláč |
| `DELETE` | `/api/pies/{pie_id}` | Ano | – | `{status: ok}` |
| `POST` | `/api/pies/{pie_id}/buy` | Ano | `{amount}` | Výsledky nákupů |

### Tržní data

| Metoda | Cesta | Autentizace | Odpověď |
|---|---|---|---|
| `GET` | `/api/price/{symbol}` | Ne | `{symbol, price}` |
| `GET` | `/api/stock/{symbol}/history/{period}` | Ne | OHLC data + liniová data |
| `POST` | `/api/backtest` | Ne | Výsledek historické simulace |
| `GET` | `/api/symbols/search?q=` | Ne | Seznam nalezených symbolů |
| `GET` | `/api/stocks-by-category` | Ne | Kategorie s aktuálními cenami |

---

## 8. Obchodní logika

### Provedení nákupu (`buy_stock`)

```
1. Načte aktuální cenu symbolu z Yahoo Finance
2. Vypočítá celkovou cenu: amount × price
3. Vypočítá poplatek: total × 0.001 (0.1 %)
4. Ověří dostatečný zůstatek hotovosti
5. Odečte z hotovosti: total + fee
6. Aktualizuje/vytvoří holding s novým průměrem:
   nový_průměr = (starý_amount × starý_avg + nový_amount × price) / nový_celkový_amount
7. Zapíše do trade_history
8. Vrátí potvrzení s detaily obchodu
```

### Provedení prodeje (`sell_stock`)

```
1. Ověří existenci pozice a dostatečné množství
2. Načte aktuální cenu z Yahoo Finance
3. Vypočítá příjem: amount × price
4. Vypočítá poplatek: revenue × 0.001 (0.1 %)
5. Vypočítá realizovaný zisk: revenue − (amount × avg_buy_price)
6. Přičte k hotovosti: revenue − fee
7. Aktualizuje/smaže holding (smaže pokud amount ≤ 0.0001)
8. Automaticky zruší související čekající prodejní objednávky
9. Zapíše do trade_history
```

### Typy objednávek

| Typ | Popis | Podmínka vykonání |
|---|---|---|
| `market` | Okamžité provedení za aktuální cenu | Ihned |
| `target_buy` | Nákup při dosažení cílové ceny | Aktuální cena ≤ cílová cena |
| `target_sell` | Prodej při dosažení cílové ceny | Aktuální cena ≥ cílová cena |
| `limit` (buy) | Limitní nákup | Aktuální cena ≤ cílová cena |
| `limit` (sell) | Limitní prodej | Aktuální cena ≥ cílová cena |
| `stop_loss` | Ochranný prodej | Aktuální cena ≤ cílová cena |

### Kontrola čekajících objednávek

Funkce `check_pending_orders` se volá:
- Automaticky z frontendu každých **30 sekund**
- Manuálně uživatelem z portfolia

Pro každou objednávku se stáhne aktuální cena a porovná s cílovou. Pokud je podmínka splněna, objednávka se vykoná jako tržní obchod.

### Struktura poplatků

- **Poplatek: 0.1 %** na každý obchod
- Při nákupu: přičteno k celkové ceně
- Při prodeji: odečteno z příjmu
- Evidováno v `trade_history.fee`

---

## 9. Správa portfolia

### Získání portfolia (`get_portfolio`)

Vrací kompletní přehled:

```json
{
  "total_value": 150000.50,
  "cash": 50000.25,
  "invested": 100000.25,
  "initial_balance": 100000,
  "change_24h": 2500.00,
  "change_24h_percent": 1.67,
  "positions": [
    {
      "symbol": "AAPL",
      "amount": 100,
      "price": 500.00,
      "value": 50000.00,
      "avg_buy_price": 450.00,
      "profit": 5000.00,
      "profit_percent": 11.11,
      "price_change_24h": 2.50
    }
  ]
}
```

### Historie portfolia

Časová řada s automatickým seskupováním (bucketing):

| Období | Interval vzorků | Max bodů |
|---|---|---|
| 24h | 1 hodina | 24 |
| 1w | 6 hodin | 28 |
| 1m | 24 hodin | 30 |
| 1y | 7 dní | 52 |
| max | automaticky | proměnlivý |

### Statistiky obchodů (`get_trade_stats`)

```json
{
  "total_trades": 42,
  "sells": 20,
  "wins": 15,
  "losses": 5,
  "win_rate": 75.0,
  "loss_rate": 25.0,
  "total_profit": 12500.50,
  "total_fees": 150.25
}
```

### Reset účtu

Funkce `reset_account` kompletně vymaže data uživatele:
- Smaže všechny holdings, objednávky, historii, pies
- Nastaví hotovost zpět na $100 000

---

## 10. Systém Pies

Systém „Pies" (koláčů) umožňuje uživatelům vytvářet investiční šablony – rozložení investice do více aktiv podle procentuální alokace.

### Vytvoření Pie

- Uživatel zadá název a seznam aktiv s procentuální alokací
- Validace: procenta musí dávat dohromady přesně 100 %
- Příklad: `[{symbol: "AAPL", percent: 50}, {symbol: "MSFT", percent: 50}]`

### Investice do Pie

Při nákupu se celková částka automaticky rozdělí:

```
Pro každý slice v pie:
  alokace = celková_částka × (procento / 100)
  počet_akcií = alokace / aktuální_cena
  → provede se buy_stock() pro každý symbol
```

### Zobrazení Pie

Každý pie zobrazuje:
- Kruhový graf (doughnut) s barevným rozlišením
- Aktuální ceny jednotlivých aktiv
- Celkovou investovanou hodnotu
- Množství držených jednotek pro každé aktivum

---

## 11. Získávání tržních dat

### Modul `prices.py`

| Funkce | Popis |
|---|---|
| `get_price(symbol)` | Získá aktuální cenu pomocí `yfinance.history(period="1d")` |
| `get_price_change_24h(symbol)` | Vypočítá procentuální změnu za 24h |
| `get_stock_history(symbol, period)` | Historická data (OHLC + linie) |
| `run_backtest(symbol, start_date, investment)` | Simulace historické investice |

### Mapování období na yfinance

| Období | yf_period | Interval | Použití |
|---|---|---|---|
| 1d | 1d | 5m | Intradenní obchodování |
| 1w | 5d | 15m | Týdenní přehled |
| 1m | 1mo | 1h | Měsíční přehled |
| 1y | 1y | 1d | Roční přehled |

### Server-side cache (technology_api.py)

- **TTL:** 5 minut na symbol
- **Paralelní načítání:** `ThreadPoolExecutor` s max 10 vlákny
- Využíváno endpointem `/api/stocks-by-category`

### Kategorie aktiv

8 předdefinovaných kategorií s 5 aktivy v každé:

| Kategorie | Příklady symbolů |
|---|---|
| Technology | AAPL, MSFT, GOOGL, NVDA, ADBE |
| IT | CRM, ORCL, IBM, SAP, INTC |
| Financial | JPM, BAC, WFC, GS, MS |
| Healthcare | JNJ, PFE, MRK, UNH, LLY |
| AI | MSFT, NVDA, GOOGL, META, AMD |
| Cryptocurrency | BTC-USD, ETH-USD, BNB-USD, SOL-USD, XRP-USD |
| Forex | EURUSD=X, GBPUSD=X, JPY=X, AUDUSD=X, CADUSD=X |
| Commodities | GC=F, CL=F, SI=F, NG=F, HG=F |

---

## 12. Backtesting

Modul pro simulaci historických investic: „Co by se stalo, kdybych investoval X dolarů do symbolu Y dne Z?"

### Vstup

```json
{
  "symbol": "AAPL",
  "start_date": "2020-01-01",
  "investment": 10000
}
```

### Výstup

```json
{
  "symbol": "AAPL",
  "start_date": "2020-01-01",
  "end_date": "2026-03-11",
  "buy_price": 75.50,
  "current_price": 180.25,
  "shares": 132.45,
  "investment": 10000,
  "current_value": 23869.12,
  "profit": 13869.12,
  "profit_percent": 138.69,
  "total_fees": 33.87,
  "chart_data": [
    {"timestamp": 1577836800, "price": 75.50, "value": 10000},
    ...
  ]
}
```

### Logika výpočtu

1. Stáhne historická data od `start_date` do současnosti
2. Vypočítá počet akcií: `investment / buy_price`
3. Poplatky: 0.1 % při nákupu + 0.1 % při (hypotetickém) prodeji
4. Vygeneruje časovou řadu hodnoty portfolia pro graf

---

## 13. Frontend

### Architektura

Frontend je implementován jako **Single Page Application** (SPA) bez použití frameworků. Navigace mezi sekcemi (Market / Portfolio) je řešena přes URL hash (`#market`, `#portfolio`).

### Autentizační flow

```
1. Stránka se načte s loading spinner (zakrývá obsah)
2. fetch('/api/auth/me') ověří validitu cookie
3. Pokud OK → spinner zmizí, obsah se zobrazí
4. Pokud 401 → redirect na /login (window.location.replace)
5. Globální interceptor: každý fetch s 401 → redirect na login
```

### Cache systém (klient)

```javascript
_cache = {
  price: new Map(),         // Cache cen (5 min TTL)
  portfolio: null,          // Cache portfolia (1 min TTL)
  portfolioHistory: null    // Cache historie
}

localStorage = {
  cached_portfolio,          // Persistentní cache
  cached_portfolioHistory,
  cached_stocksCategories
}
```

### Hlavní moduly frontendu

| Modul | Funkce | Popis |
|---|---|---|
| **Autocomplete** | `setupAutocomplete()` | Debounced (250ms) dropdown s klávesovou navigací |
| **Balance Bar** | `refreshBalanceBar()` | Hlavička s cash, invested, total, P&L |
| **Trading** | `executeTrade()` | Odesílá obchod s validací |
| **Portfolio** | `loadPortfolio()`, `renderPortfolio()` | Kartičky pozic, alokační mapa |
| **Grafy** | `loadPortfolioChart()` | Chart.js liniový graf s přepínáním období |
| **Orders** | `loadPendingOrders()`, `checkOrders()` | Tabulka objednávek, auto-check 30s |
| **Trade History** | `loadTradeHistory()` | Stránkovaná tabulka (10 na stránku) |
| **Stats** | `loadTradeStats()` | Dashboard statistik |
| **Pies** | `createPie()`, `loadPies()`, `buyPie()` | Správa koláčů s doughnut grafem |
| **Stock Modal** | `openStockModal()` | Detail akcie s liniovým/svíčkovým grafem |
| **Backtest** | `runBacktest()` | Formulář a graf backtestingu |
| **Categories** | `loadStocksByCategory()` | Kategorie aktiv s cenami |

### Design systém

Tmavé téma s fialovými akcenty:

| Proměnná | Hodnota | Použití |
|---|---|---|
| `--dark-black` | #0a0a0a | Pozadí |
| `--accent-purple` | #6b46c1 | Primární akce |
| `--light-purple` | #9f7aea | Zvýrazněný text |
| `--text-light` | #e2e8f0 | Hlavní text |
| `--success` | #48bb78 | Zelená (zisk) |
| `--danger` | #f56565 | Červená (ztráta) |
| `--card-bg` | #1a1625 | Pozadí karet |

### Responzivní design

- **Desktop (>768px):** 2 sloupcové rozvržení
- **Mobilní (<768px):** 1 sloupec, optimalizované mezery

---

## 14. Pozadí a úlohy na pozadí

### Snímkování portfolia (backend)

```python
async def _portfolio_snapshot_loop():
    """Běží na pozadí, ukládá snímek hodnoty portfolia každých 5 minut."""
    while True:
        for uid in get_all_user_ids():
            snapshot_portfolio_value(uid)
        await asyncio.sleep(300)  # 5 minut
```

- **Spuštění:** Při startu aplikace (lifespan event)
- **Interval:** Každých 5 minut
- **Účel:** Naplnění tabulky `portfolio_history` pro grafy
- **Ukončení:** Při vypnutí aplikace (cancellation)

### Kontrola objednávek (frontend)

```javascript
setInterval(checkOrders, 30000);  // Každých 30 sekund
```

- Volá `POST /api/orders/check`
- Kontroluje podmínky čekajících objednávek
- Automaticky vykoná objednávky při splnění podmínek

---

## 15. Cachování a optimalizace

### Server-side cache

| Typ | TTL | Účel |
|---|---|---|
| Cache cen symbolů | 5 minut | Snížení počtu volání Yahoo Finance API |

### Client-side cache

| Typ | TTL | Úložiště |
|---|---|---|
| Cache cen | 5 minut | `_cache.price` (Map v paměti) |
| Cache portfolia | 1 minuta | `_cache.portfolio` + localStorage |
| Cache historie | 1 minuta | `_cache.portfolioHistory` + localStorage |
| Cache kategorií | persistentní | localStorage |

### Paralelní načítání

Endpoint `/api/stocks-by-category` využívá `ThreadPoolExecutor` s 10 vlákny pro paralelní stahování cen ~35 unikátních symbolů. Bez paralelizace: 20–60 sekund → s paralelizací: 3–6 sekund.

---

## 16. Nasazení (Deployment)

### Render.com

Aplikace je nakonfigurována pro nasazení na Render přes soubor `render.yaml`:

```yaml
services:
  - type: web
    name: trading-app
    runtime: python
    branch: master
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PORT
        value: 10000
      - key: SECRET_KEY
        generateValue: true
```

### Lokální spuštění

```bash
# Aktivace virtuálního prostředí
.venv\Scripts\Activate.ps1     # Windows
source .venv/bin/activate       # Linux/Mac

# Spuštění
python run.py
# → Otevře http://127.0.0.1:8000/login
```

### Omezení Render Free plánu

- Server se uspí po 15 minutách nečinnosti (cold start 30–60 s)
- SQLite databáze přežije restart, ale **smaže se při redeployi**
- Pro trvalá data je třeba Render Disk (placený) nebo migrace na PostgreSQL

---

## 17. Konfigurace a proměnné prostředí

| Proměnná | Výchozí hodnota | Popis |
|---|---|---|
| `SECRET_KEY` | Automaticky generován | Tajný klíč pro podepisování tokenů |
| `PORT` | 8000 (lokálně), 10000 (Render) | Port serveru |

### Závislosti (requirements.txt)

```
fastapi
uvicorn
yfinance
requests
a2wsgi
```

### Ignorované soubory (.gitignore)

```
__pycache__/
*.pyc
.venv/
portfolio.db
.secret_key
build/
```
