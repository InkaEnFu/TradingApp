// Simple in-memory cache with TTLs
const _cache = {
    price: new Map(), // key: symbol -> {data, ts}
    portfolio: null, // {data, ts}
    portfolioHistory: null // {data, ts}
};

// localStorage keys pro persistentní cache
const STORAGE_KEYS = {
    portfolio: 'cached_portfolio',
    portfolioHistory: 'cached_portfolioHistory',
    stocksCategories: 'cached_stocksCategories'
};

// Uložit data do localStorage
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
        console.warn('localStorage save failed:', e);
    }
}

// Načíst data z localStorage
function loadFromStorage(key) {
    try {
        const item = localStorage.getItem(key);
        if (item) {
            return JSON.parse(item);
        }
    } catch (e) {
        console.warn('localStorage load failed:', e);
    }
    return null;
}

function now() { return Date.now(); }
function minutes(n) { return n * 60 * 1000; }
function invalidateCache(keys) {
    if (!keys) return;
    for (const k of keys) {
        if (k === 'price') _cache.price.clear();
        if (k === 'portfolio') _cache.portfolio = null;
        if (k === 'portfolioHistory') _cache.portfolioHistory = null;
    }
}

async function loadPrice() {
    const symbolInput = document.getElementById("symbol");
    const priceEl = document.getElementById("price");
    if (!symbolInput) return;

    const symbol = symbolInput.value.trim();
    if (!symbol) {
        priceEl.innerText = "Please enter a symbol.";
        return;
    }

    let data;
    const cached = _cache.price.get(symbol);
    if (cached && (now() - cached.ts) < minutes(5)) {
        data = cached.data;
    } else {
        const res = await fetch(`/api/price/${symbol}`);
        data = await res.json();
        _cache.price.set(symbol, { data, ts: now() });
    }
    priceEl.innerHTML = `Price of ${data.symbol}: $${data.price} <a href="#" onclick="openStockModal('${data.symbol}'); return false;" style="color: var(--light-purple); margin-left: 1rem;">📊 Detail</a>`;
}

async function buy() {
    const symbolInput = document.getElementById("symbol");
    const amountInput = document.getElementById("amount");
    const statusEl = document.getElementById("status");
    if (!symbolInput || !amountInput) return;

    const symbol = symbolInput.value.trim();
    const amount = parseInt(amountInput.value, 10);

    if (!symbol || isNaN(amount) || amount <= 0) {
        statusEl.innerText = "Enter valid symbol and amount.";
        return;
    }

    await fetch(`/api/buy/${symbol}/${amount}`, { method: "POST" });
    statusEl.innerText = `Bought ${amount}x ${symbol}.`;
}

async function sell() {
    const symbolInput = document.getElementById("symbol");
    const amountInput = document.getElementById("amount");
    const statusEl = document.getElementById("status");
    if (!symbolInput || !amountInput) return;

    const symbol = symbolInput.value.trim();
    const amount = parseInt(amountInput.value, 10);

    if (!symbol || isNaN(amount) || amount <= 0) {
        statusEl.innerText = "Enter valid symbol and amount.";
        return;
    }

    await fetch(`/api/sell/${symbol}/${amount}`, { method: "POST" });
    statusEl.innerText = `Sold ${amount}x ${symbol}.`;
}

async function loadPortfolio(force = false) {
    const container = document.getElementById("portfolio");
    if (!container) return;
    
    // Nejprve zobrazit uložená data z localStorage (okamžitě)
    const stored = loadFromStorage(STORAGE_KEYS.portfolio);
    if (stored && !_cache.portfolio) {
        renderPortfolio(stored.data);
    }
    
    let data;
    if (!force && _cache.portfolio && (now() - _cache.portfolio.ts) < minutes(1)) {
        data = _cache.portfolio.data;
    } else {
        const res = await fetch("/api/portfolio");
        data = await res.json();
        _cache.portfolio = { data, ts: now() };
        saveToStorage(STORAGE_KEYS.portfolio, data);
    }

    renderPortfolio(data);
    await loadPortfolioChart(force);
}

function renderPortfolio(data) {
    const container = document.getElementById("portfolio");
    if (!container) return;
    
    const positions = data.positions;
    const totalValue = data.total_value;
    const change24h = data.change_24h;
    const change24hPercent = data.change_24h_percent;

    // Aktualizace celkové hodnoty
    const totalValueEl = document.getElementById("total-value");
    if (totalValueEl) {
        totalValueEl.innerText = `$${totalValue}`;
    }

    // Aktualizace změny za 24h
    const change24hEl = document.getElementById("change-24h");
    const change24hPercentEl = document.getElementById("change-24h-percent");
    
    if (change24hEl && change24hPercentEl) {
        const changeColor = change24h >= 0 ? "green" : "red";
        const changePrefix = change24h >= 0 ? "+" : "";
        
        change24hEl.innerText = `${changePrefix}$${change24h}`;
        change24hEl.style.color = changeColor;
        
        change24hPercentEl.innerText = `${changePrefix}${change24hPercent}%`;
        change24hPercentEl.style.color = changeColor;
    }

    if (positions.length === 0) {
        container.innerHTML = "<p>No positions yet.</p>";
        return;
    }

    // Původní grid zobrazení
    let html = '<div class="portfolio-grid">';

    for (const p of positions) {
        const profitClass = p.profit >= 0 ? 'positive' : 'negative';
        const profitPrefix = p.profit >= 0 ? '+' : '';
        const firstLetter = p.symbol.charAt(0);
        
        html += `
            <div class="stock-card" data-symbol="${p.symbol}">
                <div class="stock-icon">${firstLetter}</div>
                <div class="stock-info">
                    <div class="stock-header">
                        <div class="stock-name">${p.symbol}</div>
                        <div class="stock-value">$${p.value}</div>
                    </div>
                    <div class="stock-details">
                        <div class="stock-amount">${p.amount} akcií</div>
                        <div class="stock-profit ${profitClass}">
                            ${profitPrefix}$${p.profit} (${profitPrefix}${p.profit_percent}%)
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    
    // Přidat nadpis pro treemap
    html += '<h3 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--light-purple);">Alokace aktiv</h3>';
    
    container.innerHTML = html;
    
    // Přidat click handlery pro portfolio karty
    container.querySelectorAll('.stock-card[data-symbol]').forEach(card => {
        card.addEventListener('click', () => {
            openStockModal(card.dataset.symbol);
        });
    });
    
    // Vytvořit treemap pod gridem
    createTreemap(container, positions, totalValue);
}

let portfolioChart = null;

async function loadPortfolioChart(force = false) {
    const canvas = document.getElementById("portfolio-chart");
    if (!canvas) return;
    
    // Nejprve zobrazit uložená data z localStorage (okamžitě)
    const stored = loadFromStorage(STORAGE_KEYS.portfolioHistory);
    if (stored && !_cache.portfolioHistory && stored.data.length > 0) {
        renderPortfolioChart(stored.data);
    }
    
    let history;
    if (!force && _cache.portfolioHistory && (now() - _cache.portfolioHistory.ts) < minutes(1)) {
        history = _cache.portfolioHistory.data;
    } else {
        const res = await fetch("/api/portfolio/history/24h");
        history = await res.json();
        _cache.portfolioHistory = { data: history, ts: now() };
        saveToStorage(STORAGE_KEYS.portfolioHistory, history);
    }
    
    if (history.length === 0) {
        return;
    }
    
    renderPortfolioChart(history);
}

function renderPortfolioChart(history) {
    const canvas = document.getElementById("portfolio-chart");
    if (!canvas || history.length === 0) return;
    
    // Převést timestamp na čas
    const labels = history.map(item => {
        const date = new Date(item.timestamp * 1000);
        return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    });
    
    const values = history.map(item => item.value);
    
    // Určit barvu grafu podle celkové změny
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const isPositive = lastValue >= firstValue;
    
    const ctx = canvas.getContext('2d');
    
    // Zničit předchozí graf, pokud existuje
    if (portfolioChart) {
        portfolioChart.destroy();
    }
    
    portfolioChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hodnota portfolia',
                data: values,
                borderColor: isPositive ? 'rgb(75, 192, 75)' : 'rgb(255, 99, 99)',
                backgroundColor: isPositive ? 'rgba(75, 192, 75, 0.1)' : 'rgba(255, 99, 99, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 8
                    }
                }
            }
        }
    });
}

// Ikony pro různé typy aktiv
const assetIcons = {
    'AAPL': '🍎',
    'GOOGL': '🔍',
    'MSFT': '🪟',
    'AMZN': '📦',
    'TSLA': '🚗',
    'META': '👥',
    'NVDA': '🎮',
    'BTC-USD': '₿',
    'ETH-USD': 'Ξ',
    'SPY': '📈',
    'QQQ': '💻',
    'VOO': '🏛️',
    'default': '💰'
};

function getAssetIcon(symbol) {
    return assetIcons[symbol] || assetIcons['default'];
}

function createTreemap(container, positions, totalValue) {
    // Seřadit podle hodnoty sestupně
    positions.sort((a, b) => b.value - a.value);
    
    // Vypočítat relativní velikosti
    const treemapData = positions.map(p => {
        const percentage = (p.value / totalValue) * 100;
        return {
            ...p,
            percentage: percentage,
            // Velikost v pixelech - proporcionální k hodnotě
            size: Math.max(100, Math.sqrt(percentage) * 50)
        };
    });
    
    // Vytvořit treemap HTML
    let html = '<div class="treemap-container">';
    
    for (const item of treemapData) {
        // Určit barvu podle 24h změny
        const change = item.price_change_24h;
        const absChange = Math.abs(change);
        
        let backgroundColor;
        if (change > 0) {
            // Zelená - čím větší změna, tím sytější barva
            const intensity = Math.min(absChange * 5, 100);
            const greenValue = Math.floor(150 + (intensity * 1.05)); // 150-255
            backgroundColor = `rgb(0, ${greenValue}, 0)`;
        } else if (change < 0) {
            // Červená - čím větší pokles, tím sytější barva - INTENZIVNÍ ČERVENÁ
            const intensity = Math.min(absChange * 5, 100);
            const redValue = Math.floor(180 + (intensity * 0.75)); // 180-255
            backgroundColor = `rgb(${redValue}, 0, 0)`;
        } else {
            // Neutrální šedá
            backgroundColor = 'rgb(100, 100, 100)';
        }
        
        // Určit velikost elementu
        const width = item.size * 2;
        const height = item.size * 1.5;
        
        // Určit třídu pro velikost (pro responzivní font)
        const sizeClass = item.percentage < 5 ? 'small' : '';
        
        const changePrefix = change >= 0 ? '+' : '';
        const icon = getAssetIcon(item.symbol);
        
        html += `
            <div class="treemap-item ${sizeClass}" 
                 style="width: ${width}px; height: ${height}px; background-color: ${backgroundColor}; cursor: pointer;"
                 title="${item.symbol}: $${item.value} (${item.percentage.toFixed(1)}%)"
                 data-symbol="${item.symbol}">
                <div class="treemap-icon">${icon}</div>
                <div class="treemap-symbol">${item.symbol}</div>
                <div class="treemap-change">${changePrefix}${change.toFixed(2)}%</div>
                <div class="treemap-value">$${item.value}</div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML += html;
    
    // Přidat click handlery pro treemap položky
    container.querySelectorAll('.treemap-item[data-symbol]').forEach(item => {
        item.addEventListener('click', () => {
            openStockModal(item.dataset.symbol);
        });
    });
}

// Category loader with caching
async function loadStocksByCategory() {
    const container = document.getElementById("stocks-categories");
    if (!container) return;
    if (container.getAttribute('data-loaded') === '1') return; // load once per session
    
    // Nejprve zobrazit uložená data z localStorage (okamžitě)
    const stored = loadFromStorage(STORAGE_KEYS.stocksCategories);
    if (stored) {
        renderStocksCategories(stored.data);
    } else {
        container.innerHTML = '<p>Načítání...</p>';
    }
    
    try {
        const res = await fetch('/api/stocks-by-category');
        const data = await res.json();
        saveToStorage(STORAGE_KEYS.stocksCategories, data);
        renderStocksCategories(data);
        container.setAttribute('data-loaded', '1');
    } catch (e) {
        if (!stored) {
            container.innerHTML = '<p>Chyba při načítání</p>';
        }
    }
}

function renderStocksCategories(data) {
    const container = document.getElementById("stocks-categories");
    if (!container) return;
    
    let html = '';
    for (const [category, stocks] of Object.entries(data)) {
        html += `<h3 style="margin-top:2rem; color:var(--light-purple);">${category}</h3>`;
        html += `<div class="stock-cards-grid">`;
        for (const stock of stocks) {
            let changeClass = '';
            if (typeof stock.change_percent === 'number') {
                changeClass = stock.change_percent > 0 ? 'positive' : (stock.change_percent < 0 ? 'negative' : '');
            }
            html += `
                <div class="stock-card stock-card-category">
                    <div class="stock-info">
                        <div class="stock-header">
                            <div class="stock-name">${stock.name}</div>
                            <div class="stock-value">${stock.price !== null ? '$' + stock.price : '-'}</div>
                        </div>
                        <div class="stock-details">
                            <div class="stock-amount">${stock.symbol}</div>
                            <div class="stock-profit ${changeClass}">
                                ${stock.change_percent !== null ? (stock.change_percent > 0 ? '+' : '') + stock.change_percent + '%' : '-'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }
    container.innerHTML = html;
    
    // Přidat click handlery pro karty kategorií
    container.querySelectorAll('.stock-card-category').forEach(card => {
        card.addEventListener('click', () => {
            const symbol = card.querySelector('.stock-amount').textContent;
            openStockModal(symbol);
        });
    });
}

// ==================== STOCK DETAIL MODAL ====================

let stockModalChart = null;
let currentModalSymbol = null;

function openStockModal(symbol) {
    currentModalSymbol = symbol.toUpperCase();
    const modal = document.getElementById('stock-modal');
    modal.style.display = 'flex';
    
    // Reset UI
    document.getElementById('modal-symbol').textContent = currentModalSymbol;
    document.getElementById('modal-current-price').textContent = 'Načítání...';
    document.getElementById('modal-change').textContent = '';
    document.getElementById('modal-change-percent').textContent = '';
    
    // Reset period buttons
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.period-btn[data-period="1d"]').classList.add('active');
    
    // Load 1D data by default
    loadStockHistory(currentModalSymbol, '1d');
    
    // Setup period button handlers
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadStockHistory(currentModalSymbol, btn.dataset.period);
        };
    });
}

function closeStockModal() {
    const modal = document.getElementById('stock-modal');
    modal.style.display = 'none';
    currentModalSymbol = null;
    
    if (stockModalChart) {
        stockModalChart.destroy();
        stockModalChart = null;
    }
}

// Close modal on click outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('stock-modal');
    if (e.target === modal) {
        closeStockModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeStockModal();
    }
});

async function loadStockHistory(symbol, period) {
    const loading = document.getElementById('modal-loading');
    const chartContainer = document.querySelector('.modal-chart-container');
    
    loading.style.display = 'block';
    chartContainer.style.opacity = '0.5';
    
    try {
        const res = await fetch(`/api/stock/${symbol}/history/${period}`);
        const data = await res.json();
        
        // Update price and change
        document.getElementById('modal-current-price').textContent = `$${data.current_price || 0}`;
        
        const changeEl = document.getElementById('modal-change');
        const changePercentEl = document.getElementById('modal-change-percent');
        const modalChangeDiv = document.querySelector('.modal-change');
        
        const prefix = data.change >= 0 ? '+' : '';
        changeEl.textContent = `${prefix}$${data.change}`;
        changePercentEl.textContent = `(${prefix}${data.change_percent}%)`;
        
        modalChangeDiv.classList.remove('positive', 'negative');
        modalChangeDiv.classList.add(data.change >= 0 ? 'positive' : 'negative');
        
        // Render chart
        renderStockModalChart(data);
        
    } catch (e) {
        console.error('Error loading stock history:', e);
        document.getElementById('modal-current-price').textContent = 'Chyba';
    } finally {
        loading.style.display = 'none';
        chartContainer.style.opacity = '1';
    }
}

function renderStockModalChart(data) {
    const canvas = document.getElementById('stock-modal-chart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    if (stockModalChart) {
        stockModalChart.destroy();
    }
    
    if (!data.data || data.data.length === 0) {
        return;
    }
    
    // Format labels based on period
    const labels = data.data.map(item => {
        const date = new Date(item.timestamp * 1000);
        if (data.period === '1d') {
            return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        } else if (data.period === '1w') {
            return date.toLocaleDateString('cs-CZ', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        } else if (data.period === '1m') {
            return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        } else {
            return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        }
    });
    
    const values = data.data.map(item => item.price);
    const isPositive = data.change >= 0;
    
    stockModalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: data.symbol,
                data: values,
                borderColor: isPositive ? 'rgb(75, 192, 75)' : 'rgb(255, 99, 99)',
                backgroundColor: isPositive ? 'rgba(75, 192, 75, 0.1)' : 'rgba(255, 99, 99, 0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: data.data.length > 50 ? 0 : 2,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '$' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return '$' + value;
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        maxTicksLimit: 6
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}
