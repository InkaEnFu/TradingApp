# Návod na deploy na Render.com

## Přehled

Tento návod krok za krokem popisuje, jak nahrát ZenTrade na hosting **Render** (https://dashboard.render.com/).

---

## Předpoklady

- Máš účet na [Render.com](https://dashboard.render.com/)
- Máš účet na [GitHub](https://github.com/) (nebo GitLab)
- Máš nainstalovaný Git na počítači

---

## Krok 1 – Nahrát projekt na GitHub

1. Otevři terminál ve složce `investment_app`
2. Inicializuj Git repozitář (pokud ještě nemáš):

```bash
git init
git branch -M master
```

3. Přidej `.gitignore` – ujisti se, že nenahráváš zbytečné soubory. Zkontroluj, že `.gitignore` obsahuje:

```
__pycache__/
*.pyc
.venv/
portfolio.db
.secret_key
build/
```

> **DŮLEŽITÉ:** Soubor `portfolio.db` (databáze) a `.secret_key` se NESMÍ nahrávat na GitHub. Databáze se vytvoří automaticky při prvním spuštění.

4. Přidej soubory a commitni:

```bash
git add .
git commit -m "Initial commit"
```

5. Vytvoř nový repozitář na GitHubu:
   - Jdi na https://github.com/new
   - Pojmenuj ho např. `investment-simulator`
   - Zvol **Private** (soukromý) nebo **Public**
   - **NEKLIKEJ** na "Initialize this repository" – repozitář musí být prázdný
   - Klikni **Create repository**

6. Propoj lokální repozitář s GitHubem a pushni:

```bash
git remote add origin https://github.com/TVOJE_JMENO/investment-simulator.git
git push -u origin master
```

---

## Krok 2 – Vytvořit službu na Renderu

1. Přihlaš se na https://dashboard.render.com/
2. Klikni na **"New +"** → **"Web Service"**
3. Zvol **"Build and deploy from a Git repository"** → **Next**
4. Propoj svůj GitHub účet (pokud ještě nemáš):
   - Klikni **"Connect GitHub"**
   - Autorizuj Render přístup ke svým repozitářům
5. Vyber svůj repozitář `investment-simulator`
6. Klikni **"Connect"**

---

## Krok 3 – Nastavení služby

Na stránce nastavení vyplň:

| Pole | Hodnota |
|---|---|
| **Name** | `trading-app` (nebo jakýkoliv název) |
| **Region** | `Frankfurt (EU Central)` (nejbližší k ČR) |
| **Branch** | `master` |
| **Runtime** | `Python` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Instance Type** | `Free` (zdarma) |

---

## Krok 4 – Nastavit Environment Variables (proměnné prostředí)

Toto je **klíčový krok**! Scrolluj dolů do sekce **"Environment Variables"** a přidej:

| Key | Value |
|---|---|
| `SECRET_KEY` | Klikni na **"Generate"** – vygeneruje se náhodný klíč |
| `PORT` | `10000` |

> **PROČ SECRET_KEY?** Render má **dočasný disk** – při každém redeployi se souborový systém smaže. Bez této proměnné by se secret klíč pro tokeny pokaždé změnil a všichni uživatelé by se museli znovu přihlásit.

---

## Krok 5 – Spustit deploy

1. Klikni **"Create Web Service"**
2. Render začne:
   - Klonovat tvůj repozitář
   - Instalovat Python závislosti (`pip install -r requirements.txt`)
   - Spouštět aplikaci
3. Počkej na zelený status **"Live"** (trvá cca 2–5 minut)
4. Tvoje aplikace bude dostupná na URL jako: `https://trading-app-xxxx.onrender.com`

---

## Krok 6 – Otevřít aplikaci

- Klikni na URL v horní části stránky služby na Renderu
- Připoj `/login` na konec URL: `https://trading-app-xxxx.onrender.com/login`
- Zaregistruj se a začni obchodovat!

---

## Důležité informace o Free plánu

### Uspávání serveru
Render Free plán **uspí server po 15 minutách nečinnosti**. Při dalším přístupu se server probudí, ale **trvá to 30–60 sekund**. To je normální.

### Databáze (SQLite)
Aplikace používá SQLite databázi uloženou v souboru `portfolio.db`. Na Render Free plánu:
- **Databáze přežije restart** serveru (sleep/wake)
- **Databáze se SMAŽE při novém deployi** (nový push na GitHub)

Pokud chceš trvalá data i po deployích, máš dvě možnosti:
1. **Render Disk** (placený) – připojíš persistent disk
2. **Přejít na PostgreSQL** – Render nabízí managed PostgreSQL (složitější migrace)

Pro simulátor to většinou nevadí – uživatelé si prostě vytvoří nový účet.

---

## Aktualizace aplikace

Kdykoli pushneš nový commit na `master` branch na GitHubu, Render automaticky spustí nový deploy:

```bash
git add .
git commit -m "Update"
git push origin master
```

---

## Řešení problémů

| Problém | Řešení |
|---|---|
| Deploy selže | Zkontroluj logy v Render dashboardu – sekce **"Logs"** |
| `ModuleNotFoundError` | Zkontroluj, že modul je v `requirements.txt` |
| Stránka se nenačte | Ověř, že Start Command je správně: `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| 401 Unauthorized po deployi | Ověř, že máš nastavenou env proměnnou `SECRET_KEY` |
| Server se dlouho startuje | Free plán má cold start – je potřeba počkat 30–60 sekund |

---

## Shrnutí kroků

1. ✅ Nahrát projekt na GitHub (`git push`)
2. ✅ Vytvořit Web Service na Renderu
3. ✅ Nastavit Build/Start příkazy
4. ✅ Přidat `SECRET_KEY` a `PORT` do Environment Variables
5. ✅ Deploy a otevřít URL
