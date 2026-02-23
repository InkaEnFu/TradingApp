# Uživatelský manuál – Investment Simulator

## Obsah

1. [Úvod](#1-úvod)
2. [Požadavky a instalace](#2-požadavky-a-instalace)
3. [Spuštění aplikace](#3-spuštění-aplikace)
4. [Přehled rozhraní](#4-přehled-rozhraní)
5. [Market – Obchodování](#5-market--obchodování)
   - [Vyhledávání symbolů](#51-vyhledávání-symbolů)
   - [Zobrazení ceny](#52-zobrazení-ceny)
   - [Nákup a prodej](#53-nákup-a-prodej)
   - [Typy příkazů](#54-typy-příkazů)
   - [Zadávání množství](#55-zadávání-množství)
6. [Přehled aktiv podle kategorií](#6-přehled-aktiv-podle-kategorií)
7. [Backtesting – Historická simulace](#7-backtesting--historická-simulace)
8. [Portfolio – Správa portfolia](#8-portfolio--správa-portfolia)
   - [Dashboard a statistiky](#81-dashboard-a-statistiky)
   - [Graf hodnoty portfolia](#82-graf-hodnoty-portfolia)
   - [Nevyřízené příkazy](#83-nevyřízené-příkazy)
   - [Otevřené pozice](#84-otevřené-pozice)
   - [Alokace aktiv](#85-alokace-aktiv)
9. [Pies – Automatické investování](#9-pies--automatické-investování)
   - [Vytvoření Pie](#91-vytvoření-pie)
   - [Investování do Pie](#92-investování-do-pie)
   - [Úprava a smazání Pie](#93-úprava-a-smazání-pie)
10. [Detail akcie – Modální okno](#10-detail-akcie--modální-okno)
11. [Historie obchodů a statistiky](#11-historie-obchodů-a-statistiky)
12. [Reset účtu](#12-reset-účtu)
13. [Technické informace](#13-technické-informace)
14. [Řešení problémů](#14-řešení-problémů)

---

## 1. Úvod

**Investment Simulator** je lokální webová aplikace pro simulaci investování na finančních trzích. Aplikace umožňuje obchodovat s akciemi, kryptoměnami, forexem a komoditami s využitím reálných tržních dat z Yahoo Finance – vše bez rizika ztráty skutečných peněz.

Hlavní funkce:
- Virtuální účet s počátečním zůstatkem **$100 000**
- Nákup a prodej akcií, kryptoměn, komodit a forexových párů
- Tržní příkazy (okamžité provedení) i podmíněné příkazy (Target Buy/Sell)
- Interaktivní grafy (liniové i svíčkové)
- Systém „Pies" pro automatické rozložení investice do více aktiv
- Backtesting – historická simulace „co by se stalo, kdybych investoval"
- Historie obchodů a statistiky úspěšnosti

---

## 2. Požadavky a instalace

### Systémové požadavky

- **Python 3.8** nebo novější
- Připojení k internetu (pro stahování reálných cen z Yahoo Finance)

### Instalace závislostí

Otevřete terminál ve složce projektu a spusťte:

```bash
pip install -r requirements.txt
```

Aplikace vyžaduje tyto knihovny:
| Knihovna | Účel |
|---|---|
| `fastapi` | Webový framework (backend API) |
| `uvicorn` | ASGI server pro spuštění aplikace |
| `yfinance` | Stahování tržních dat z Yahoo Finance |
| `requests` | HTTP požadavky (vyhledávání symbolů) |

---

## 3. Spuštění aplikace

1. Otevřete terminál ve složce `investment_app`
2. Spusťte příkaz:

```bash
python run.py
```

3. Aplikace automaticky:
   - Spustí lokální server na adrese `http://127.0.0.1:8000`
   - Otevře webový prohlížeč s aplikací

Pokud se prohlížeč neotevře automaticky, zadejte do adresního řádku ručně: `http://127.0.0.1:8000`

> **Ukončení aplikace:** Zavřete okno terminálu nebo stiskněte `Ctrl + C`.

---

## 4. Přehled rozhraní

Aplikace má dvě hlavní zobrazení, mezi kterými se přepínáte pomocí navigace v záhlaví:

- **Market** – obchodování, přehled aktiv, backtesting
- **Portfolio** – správa portfolia, pozice, příkazy, Pies, historie

### Lišta zůstatku (Balance Bar)

V horní části obrazovky je vždy viditelná lišta s přehledem účtu:

| Položka | Popis |
|---|---|
| **Cash** | Disponibilní hotovost |
| **Invested** | Celková hodnota investovaných aktiv |
| **Total** | Celková hodnota účtu (Cash + Invested) |
| **P&L** | Celkový zisk/ztráta oproti počátečnímu zůstatku |

---

## 5. Market – Obchodování

### 5.1 Vyhledávání symbolů

Pole **Symbol** podporuje automatické doplňování:
- Začněte psát ticker symbol (např. `AAPL`, `BTC`, `MSFT`)
- Zobrazí se rozbalovací nabídka s odpovídajícími výsledky
- Vyhledávání prohledává předdefinované symboly i Yahoo Finance
- Kliknutím na nabídku vyberete symbol

**Příklady symbolů:**
| Typ aktiva | Příklad | Popis |
|---|---|---|
| Akcie | `AAPL` | Apple Inc. |
| Kryptoměna | `BTC-USD` | Bitcoin v USD |
| Forex | `EURUSD=X` | Euro/Americký dolar |
| Komodita | `GC=F` | Zlato (futures) |

### 5.2 Zobrazení ceny

1. Zadejte symbol do pole **Symbol**
2. Klikněte na tlačítko **Get Price**
3. Pod polem se zobrazí aktuální cena vybraného aktiva

### 5.3 Nákup a prodej

1. Zadejte **Symbol** aktiva
2. Zvolte **typ příkazu** (Order Type)
3. Zadejte **množství** (Amount)
4. Klikněte na **Buy** (nákup) nebo **Sell** (prodej)

Po provedení obchodu se zobrazí potvrzující zpráva s detaily transakce (cena, poplatek, celková částka).

> **Poplatek:** Každý obchod (nákup i prodej) je zpoplatněn sazbou **0,1 %** z objemu transakce.

### 5.4 Typy příkazů

| Typ příkazu | Popis |
|---|---|
| **Market Order** | Okamžité provedení za aktuální tržní cenu |
| **Target Buy** | Podmíněný nákup – provede se, když cena klesne na zadanou cílovou cenu nebo níže |
| **Target Sell** | Podmíněný prodej – provede se, když cena vzroste na zadanou cílovou cenu nebo výše |

Při výběru **Target Buy** nebo **Target Sell** se zobrazí pole **Target Price ($)**, kde zadáte požadovanou cílovou cenu.

Podmíněné příkazy se kontrolují automaticky každých 30 sekund. Pokud je podmínka splněna, obchod se provede.

### 5.5 Zadávání množství

Množství lze zadat dvěma způsoby (přepnout lze tlačítky **Units** / **USD ($)**):

- **Units** – zadáváte počet kusů (akcií, coinů apod.)
- **USD ($)** – zadáváte dolarovou částku; systém automaticky přepočítá na odpovídající počet kusů

---

## 6. Přehled aktiv podle kategorií

V sekci **Assets** na stránce Market najdete předdefinované seznamy aktiv rozdělené do kategorií:

| Kategorie | Příklady |
|---|---|
| **Technology** | AAPL, MSFT, GOOGL, NVDA, ADBE |
| **IT** | CRM, ORCL, IBM, SAP, INTC |
| **Financial** | JPM, BAC, WFC, GS, MS |
| **Healthcare** | JNJ, PFE, MRK, UNH, LLY |
| **AI** | MSFT, NVDA, GOOGL, META, AMD |
| **Cryptocurrency** | BTC-USD, ETH-USD, BNB-USD, SOL-USD, XRP-USD |
| **Forex** | EUR/USD, GBP/USD, USD/JPY, AUD/USD, CAD/USD |
| **Commodities** | Zlato, Ropa, Stříbro, Zemní plyn, Měď |

Mezi kategoriemi se přepínáte kliknutím na záložky. U každého aktiva se zobrazuje aktuální cena a denní změna v procentech. Kliknutím na aktivum otevřete jeho detail.

---

## 7. Backtesting – Historická simulace

Backtesting umožňuje ověřit, jak by dopadla hypotetická investice do vybraného aktiva v minulosti.

### Jak jej použít:

1. Zadejte **Symbol** aktiva (např. `AAPL`)
2. Nastavte **Start Date** – datum, kdy by investice začala
3. Zadejte **Investment ($)** – výši investované částky (výchozí: $10 000)
4. Klikněte na **Run Simulation**

### Výsledky obsahují:

- Nákupní cena v den startu
- Aktuální cena
- Počet nakoupených kusů
- Aktuální hodnota investice (po odečtení poplatků 0,1 % při nákupu i prodeji)
- Celkový zisk/ztráta v dolarech i procentech
- Interaktivní graf vývoje hodnoty investice v čase

---

## 8. Portfolio – Správa portfolia

Přepněte se na záložku **Portfolio** v navigaci.

### 8.1 Dashboard a statistiky

V horní části se zobrazují čtyři klíčové statistiky:

| Karta | Popis |
|---|---|
| **Total Value** | Celková hodnota portfolia (hotovost + investice) |
| **Cash Balance** | Aktuální zůstatek hotovosti |
| **24h Change** | Změna hodnoty portfolia za posledních 24 hodin |
| **Win Rate** | Procento ziskových obchodů |

### 8.2 Graf hodnoty portfolia

Interaktivní graf zobrazující vývoj celkové hodnoty portfolia v čase. Dostupná časová období:

| Tlačítko | Období |
|---|---|
| **24H** | Posledních 24 hodin |
| **1W** | Poslední týden |
| **1M** | Poslední měsíc |
| **1Y** | Poslední rok |
| **MAX** | Celá historie |

Hodnota portfolia se automaticky ukládá každých 5 minut na pozadí pro přesnější historické grafy.

### 8.3 Nevyřízené příkazy

Sekce **Pending Orders** zobrazuje seznam všech aktivních podmíněných příkazů (Target Buy, Target Sell). Každý příkaz lze zrušit kliknutím na příslušné tlačítko.

Příkazy se automaticky kontrolují každých 30 sekund. Jakmile je podmínka splněna (cena dosáhne cílové hodnoty), příkaz se automaticky provede.

### 8.4 Otevřené pozice

Sekce **Open Positions** zobrazuje všechna aktuálně držená aktiva s těmito údaji:

- **Symbol** – ticker aktiva
- **Množství** – počet držených kusů
- **Aktuální cena** – tržní cena za kus
- **Hodnota** – celková hodnota pozice
- **Průměrná nákupní cena** – vážený průměr nákupních cen
- **Zisk/Ztráta** – nerealizovaný zisk/ztráta v $ a %
- **24h změna** – denní změna ceny v procentech

**Tlačítko „Sell All Positions"** okamžitě prodá všechny otevřené pozice za aktuální tržní cenu.

Kliknutím na konkrétní pozici otevřete detail akcie s možností prodeje.

### 8.5 Alokace aktiv

Sekce **Asset Allocation** vizuálně zobrazuje rozložení investic mezi jednotlivá aktiva pomocí přehledné mapy.

---

## 9. Pies – Automatické investování

Funkce **Pies** umožňuje vytvářet „koláče" – přednastavené alokace mezi více aktiv. Poté stačí zadat celkovou částku a systém automaticky nakoupí aktiva podle definovaného procentuálního rozložení.

### 9.1 Vytvoření Pie

1. Zadejte **název Pie** (např. „Tech Mix")
2. Přidejte akcie kliknutím na **+ Add Stock**
3. Pro každou akcii zadejte:
   - **Symbol** (např. AAPL)
   - **Procentuální podíl** (např. 40)
4. Celkový součet procent musí být přesně **100 %**
5. Klikněte na **Create Pie**

**Příklad:**

| Symbol | Podíl |
|---|---|
| AAPL | 40 % |
| MSFT | 35 % |
| GOOGL | 25 % |

### 9.2 Investování do Pie

1. U vytvořeného Pie zadejte částku v dolarech
2. Klikněte na tlačítko pro nákup
3. Systém automaticky:
   - Rozdělí částku podle definovaných procent
   - Vypočítá počet kusů pro každý symbol
   - Provede nákupy za aktuální tržní ceny

**Příklad:** Investice $1 000 do Pie výše → nakoupí se AAPL za $400, MSFT za $350, GOOGL za $250.

### 9.3 Úprava a smazání Pie

- **Úprava** – lze měnit název i složení (symboly a procentuální podíly)
- **Smazání** – odstraní definici Pie (již nakoupené akcie zůstávají v portfoliu)

---

## 10. Detail akcie – Modální okno

Kliknutím na symbol akcie (v přehledu kategorií nebo v otevřených pozicích) se otevře detailní modální okno s:

- **Aktuální cenou** a změnou
- **Interaktivním grafem** s volbou období:
  - 1D (1 den), 1W (1 týden), 1M (1 měsíc), 1Y (1 rok)
- **Typem grafu:**
  - **Line** – liniový graf (zavírací ceny)
  - **Candle** – svíčkový graf (OHLC data: Open, High, Low, Close)
- **Panelem prodeje** (pokud držíte danou akcii):
  - Prodej zadáním počtu kusů nebo dolarové hodnoty
  - Rychlé tlačítka: **25 %**, **50 %**, **75 %**, **100 %** z držené pozice
  - Náhled výsledku prodeje před potvrzením

---

## 11. Historie obchodů a statistiky

### Historie obchodů

Sekce **Trade History** na stránce Portfolio zobrazuje posledních 50 obchodů s detaily:
- Symbol, akce (Buy/Sell), množství, cena, poplatek, celková částka, zisk/ztráta, typ příkazu

### Statistiky obchodování

Sekce **Trade Statistics** zobrazuje souhrnné metriky:

| Metrika | Popis |
|---|---|
| **Total Trades** | Celkový počet obchodů (nákupy + prodeje) |
| **Winning Trades** | Počet ziskových prodejů |
| **Losing Trades** | Počet ztrátových prodejů |
| **Total P&L** | Celkový realizovaný zisk/ztráta |
| **Total Fees Paid** | Celkem zaplacené poplatky |

---

## 12. Reset účtu

Na konci stránky Portfolio se nachází tlačítko **Reset Account ($100,000)**.

Po kliknutí se:
- Smaže veškerá historie obchodů
- Zruší všechny otevřené pozice a příkazy
- Smažou se všechny Pies
- Vymaže se celá historie portfolia
- Zůstatek se obnoví na **$100 000**

> **Upozornění:** Tato akce je nevratná!

---

## 13. Technické informace

### Architektura

- **Backend:** Python + FastAPI (REST API)
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Databáze:** SQLite (soubor `portfolio.db` ve hlavní složce projektu)
- **Data:** Yahoo Finance (knihovna `yfinance`)

### Struktura projektu

```
investment_app/
├── run.py              # Spouštěcí skript
├── requirements.txt    # Seznam závislostí
├── portfolio.db        # SQLite databáze (vytvoří se automaticky)
├── app/
│   ├── __init__.py         # Označení balíčku
│   ├── main.py             # FastAPI aplikace, API endpointy
│   ├── database.py         # Inicializace databáze a tabulek
│   ├── portfolio.py        # Logika portfolia (nákup, prodej, příkazy, Pies)
│   ├── prices.py           # Získávání cen a historických dat
│   ├── stock_categories.py # Předdefinované kategorie aktiv
│   └── technology_api.py   # API pro vyhledávání symbolů a kategorií
└── static/
    ├── index.html      # Hlavní HTML stránka
    ├── script.js       # Klientský JavaScript
    └── style.css       # Styly
```

### Databázové tabulky

| Tabulka | Účel |
|---|---|
| `account` | Zůstatek na účtu (hotovost, počáteční balance) |
| `holdings` | Aktuálně držená aktiva (symbol, množství, průměrná nákupní cena) |
| `orders` | Podmíněné příkazy (limit, stop-loss, target buy/sell) |
| `trade_history` | Historie všech provedených obchodů |
| `portfolio_history` | Časová řada celkové hodnoty portfolia |
| `pies` | Definice Pies (název) |
| `pie_slices` | Složení Pies (symbol + procentuální podíl) |

### API Endpointy

| Metoda | Endpoint | Popis |
|---|---|---|
| `GET` | `/api/price/{symbol}` | Aktuální cena aktiva |
| `GET` | `/api/stock/{symbol}/history/{period}` | Historická data (1d, 1w, 1m, 1y) |
| `POST` | `/api/trade` | Provedení obchodu (nákup/prodej) |
| `GET` | `/api/portfolio` | Přehled portfolia |
| `GET` | `/api/account` | Informace o účtu |
| `GET` | `/api/orders` | Nevyřízené příkazy |
| `DELETE` | `/api/orders/{id}` | Zrušení příkazu |
| `POST` | `/api/orders/check` | Kontrola a provedení příkazů |
| `GET` | `/api/trade-history` | Historie obchodů |
| `GET` | `/api/trade-stats` | Statistiky obchodování |
| `GET` | `/api/portfolio/history/{period}` | Historie hodnoty portfolia |
| `GET` | `/api/pies` | Seznam Pies |
| `POST` | `/api/pies` | Vytvoření Pie |
| `PUT` | `/api/pies/{id}` | Úprava Pie |
| `DELETE` | `/api/pies/{id}` | Smazání Pie |
| `POST` | `/api/pies/{id}/buy` | Investice do Pie |
| `POST` | `/api/backtest` | Spuštění backtestingu |
| `POST` | `/api/reset` | Reset účtu |
| `POST` | `/api/sell-all` | Prodej všech pozic |
| `GET` | `/api/symbols/search?q=...` | Vyhledávání symbolů |
| `GET` | `/api/stocks-by-category` | Aktiva podle kategorií |

---

## 14. Řešení problémů

| Problém | Řešení |
|---|---|
| Aplikace se nespustí | Ověřte, že máte nainstalovaný Python 3.8+ a všechny závislosti (`pip install -r requirements.txt`) |
| Port 8000 je obsazený | Ukončete jiný proces na portu 8000, nebo upravte port v `run.py` |
| Cena se nezobrazuje (0.0) | Zkontrolujte připojení k internetu; ověřte správnost tickeru |
| Yahoo Finance vrací chybu | Služba Yahoo Finance může být dočasně nedostupná; zkuste to znovu za chvíli |
| Databáze je poškozená | Smažte soubor `portfolio.db` ve složce projektu a spusťte aplikaci znovu (vytvoří se nová databáze) |
| Prohlížeč se neotevřel | Ručně otevřete adresu `http://127.0.0.1:8000` |

---

*Investment Simulator – lokální simulátor investování pro vzdělávací účely. Nejedná se o finanční poradenství.*
