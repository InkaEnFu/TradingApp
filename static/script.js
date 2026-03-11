// ===== CACHE =====
const _cache = { price: new Map(), portfolio: null, portfolioHistory: null };
const STORAGE_KEYS = { portfolio: 'cached_portfolio', portfolioHistory: 'cached_portfolioHistory', stocksCategories: 'cached_stocksCategories' };
function saveToStorage(k, d) { try { localStorage.setItem(k, JSON.stringify({data:d, ts:Date.now()})); } catch(e){} }
function loadFromStorage(k) { try { const i=localStorage.getItem(k); if(i) return JSON.parse(i); } catch(e){} return null; }
function now() { return Date.now(); }
function minutes(n) { return n*60*1000; }
function invalidateCache(keys) { if(!keys) return; for(const k of keys){ if(k==='price') _cache.price.clear(); if(k==='portfolio') _cache.portfolio=null; if(k==='portfolioHistory') _cache.portfolioHistory=null; }}

// ===== AUTOCOMPLETE =====
let _acCache = null;
let _acDebounce = null;

async function getAllSymbols() {
    if(!_acCache) {
        const res = await fetch('/api/symbols/search?q=');
        _acCache = await res.json();
    }
    return _acCache;
}

async function searchSymbols(query) {
    if(!query || query.length === 0) return getAllSymbols().then(all => all.slice(0, 10));
    // For queries with 1+ characters, search server-side (Yahoo Finance)
    try {
        const res = await fetch('/api/symbols/search?q=' + encodeURIComponent(query));
        return await res.json();
    } catch(e) {
        // Fallback to local filtering
        const all = await getAllSymbols();
        return filterSymbols(all, query);
    }
}

function filterSymbols(all, query) {
    if(!query) return all.slice(0, 10);
    const qu = query.toUpperCase();
    return all.filter(s => s.symbol.toUpperCase().startsWith(qu) || s.name.toUpperCase().includes(qu)).slice(0, 12);
}

function setupAutocomplete(inputId, dropdownId, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if(!input || !dropdown) return;

    let activeIdx = -1;
    let justSelected = false;

    async function showSuggestions() {
        if(justSelected) { justSelected = false; return; }
        const val = input.value.trim();
        const results = await searchSymbols(val);
        activeIdx = -1;
        if(!results.length) { dropdown.classList.remove('show'); return; }
        dropdown.innerHTML = results.map((r, i) =>
            '<div class="autocomplete-item" data-symbol="' + r.symbol + '" data-idx="' + i + '">' +
            '<span class="ac-symbol">' + r.symbol + '</span>' +
            (r.name ? '<span class="ac-name" style="margin-left:0.5rem;color:var(--text-muted);font-size:0.85em;">' + r.name + '</span>' : '') +
            '</div>'
        ).join('');
        dropdown.classList.add('show');
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                justSelected = true;
                input.value = this.dataset.symbol;
                dropdown.classList.remove('show');
                dropdown.innerHTML = '';
                activeIdx = -1;
                if(onSelect) onSelect(this.dataset.symbol);
            });
        });
    }

    function highlightItem() {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        items.forEach(it => it.classList.remove('active'));
        if(activeIdx >= 0 && activeIdx < items.length) {
            items[activeIdx].classList.add('active');
            items[activeIdx].scrollIntoView({block:'nearest'});
        }
    }

    input.addEventListener('input', function() {
        clearTimeout(_acDebounce);
        _acDebounce = setTimeout(showSuggestions, 250);
    });

    input.addEventListener('focus', function() {
        clearTimeout(_acDebounce);
        _acDebounce = setTimeout(showSuggestions, 250);
    });

    input.addEventListener('blur', function() {
        // Small delay to allow mousedown on item
        setTimeout(() => { dropdown.classList.remove('show'); activeIdx = -1; }, 150);
    });

    input.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if(!dropdown.classList.contains('show') || !items.length) return;
        if(e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = Math.min(activeIdx + 1, items.length - 1);
            highlightItem();
        } else if(e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, 0);
            highlightItem();
        } else if(e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            justSelected = true;
            input.value = items[activeIdx].dataset.symbol;
            dropdown.classList.remove('show');
            dropdown.innerHTML = '';
            activeIdx = -1;
            if(onSelect) onSelect(input.value);
        } else if(e.key === 'Escape') {
            dropdown.classList.remove('show');
            activeIdx = -1;
        }
    });
}

// ===== BALANCE BAR =====
async function refreshBalanceBar() {
    try {
        const res = await fetch('/api/account');
        const d = await res.json();
        const el = (id) => document.getElementById(id);
        if(el('bar-cash')) el('bar-cash').textContent = '$' + d.cash.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        if(el('bar-invested')) el('bar-invested').textContent = '$' + d.invested.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        if(el('bar-total')) el('bar-total').textContent = '$' + d.total.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
        if(el('bar-pnl')) {
            const prefix = d.profit >= 0 ? '+' : '';
            el('bar-pnl').textContent = prefix + '$' + d.profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' (' + prefix + d.profit_percent + '%)';
            el('bar-pnl').className = 'balance-value ' + (d.profit >= 0 ? 'positive' : 'negative');
        }
    } catch(e) { console.error('Balance bar error:', e); }
}

// ===== PRICE =====
async function loadPrice() {
    const symbolInput = document.getElementById('symbol');
    const priceEl = document.getElementById('price');
    if(!symbolInput) return;
    const symbol = symbolInput.value.trim().toUpperCase();
    if(!symbol) { priceEl.innerText = 'Please enter a symbol.'; return; }
    let data;
    const cached = _cache.price.get(symbol);
    if(cached && (now()-cached.ts)<minutes(5)) { data = cached.data; }
    else { const res = await fetch('/api/price/'+symbol); data = await res.json(); _cache.price.set(symbol, {data, ts:now()}); }
    if(!data.price || data.price <= 0) {
        priceEl.innerHTML = '<span class="negative">Symbol "'+data.symbol+'" not found or has no price data.</span>';
        return;
    }
    priceEl.innerHTML = 'Price of '+data.symbol+': $'+data.price+' <a href="#" onclick="openStockModal(\''+data.symbol+'\'); return false;" style="color:var(--light-purple);margin-left:1rem;">Detail</a>';
}

// ===== ORDER TYPE CHANGE =====
function onOrderTypeChange() {
    const ot = document.getElementById('order-type').value;
    const tpg = document.getElementById('target-price-group');
    tpg.style.display = (ot === 'market') ? 'none' : 'block';
    const tradeButtons = document.querySelector('.trade-buttons');
    const btnBuy = tradeButtons ? tradeButtons.querySelector('.btn-buy') : null;
    const btnSell = tradeButtons ? tradeButtons.querySelector('.btn-sell') : null;
    if(ot === 'target_sell') { if(btnBuy) btnBuy.style.display = 'none'; if(btnSell) btnSell.style.display = ''; }
    else if(ot === 'target_buy') { if(btnSell) btnSell.style.display = 'none'; if(btnBuy) btnBuy.style.display = ''; }
    else { if(btnBuy) btnBuy.style.display = ''; if(btnSell) btnSell.style.display = ''; }
}

// ===== EXECUTE TRADE =====
let tradeAmountMode = 'units'; // 'units' or 'usd'

function setTradeAmountMode(mode) {
    tradeAmountMode = mode;
    document.querySelectorAll('.trade-amount-mode-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector('.trade-amount-mode-btn[data-mode="'+mode+'"]');
    if(activeBtn) activeBtn.classList.add('active');
    const label = document.getElementById('amount-label');
    const input = document.getElementById('amount');
    if(mode === 'usd') {
        label.textContent = 'Amount (USD $)';
        input.placeholder = '$100';
        input.value = '';
    } else {
        label.textContent = 'Amount (shares/units)';
        input.placeholder = '1';
        input.value = '1';
    }
}

async function executeTrade(action) {
    const symbol = (document.getElementById('symbol').value || '').trim().toUpperCase();
    let rawAmount = parseFloat(document.getElementById('amount').value);
    const orderType = document.getElementById('order-type').value;
    const targetPrice = parseFloat(document.getElementById('target-price').value) || 0;
    const statusEl = document.getElementById('status');
    if(!symbol || isNaN(rawAmount) || rawAmount <= 0) { statusEl.innerText = 'Enter valid symbol and amount.'; return; }
    if(orderType !== 'market' && targetPrice <= 0) { statusEl.innerText = 'Enter a target price for this order type.'; return; }

    let amount = rawAmount;
    // If USD mode, convert dollar amount to shares
    if(tradeAmountMode === 'usd' && orderType === 'market') {
        try {
            const priceRes = await fetch('/api/price/'+symbol);
            const priceData = await priceRes.json();
            if(!priceData.price || priceData.price <= 0) {
                statusEl.innerHTML = '<span class="negative">Symbol "'+symbol+'" not found or has no price data.</span>';
                return;
            }
            amount = rawAmount / priceData.price;
            if(amount <= 0) { statusEl.innerHTML = '<span class="negative">Amount too small.</span>'; return; }
        } catch(e) { statusEl.innerText = 'Error getting price: '+e.message; return; }
    }

    try {
        const res = await fetch('/api/trade', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({symbol, action, amount, order_type: orderType, target_price: targetPrice})
        });
        const data = await res.json();
        if(data.error) { statusEl.innerHTML = '<span class="negative">'+data.error+'</span>'; }
        else { statusEl.innerHTML = '<span class="positive">'+data.message+'</span>'; }
        invalidateCache(['portfolio','portfolioHistory']);
        refreshBalanceBar();
        loadPortfolio(true);
        loadPendingOrders();
        loadTradeHistory();
        loadTradeStats();
        loadPies();
    } catch(e) { statusEl.innerText = 'Error: '+e.message; }
}

// ===== PORTFOLIO =====
async function loadPortfolio(force=false) {
    const container = document.getElementById('portfolio');
    if(!container) return;
    const stored = loadFromStorage(STORAGE_KEYS.portfolio);
    if(stored && !_cache.portfolio) renderPortfolio(stored.data);
    let data;
    if(!force && _cache.portfolio && (now()-_cache.portfolio.ts)<minutes(1)) { data = _cache.portfolio.data; }
    else { const res = await fetch('/api/portfolio'); data = await res.json(); _cache.portfolio = {data, ts:now()}; saveToStorage(STORAGE_KEYS.portfolio, data); }
    renderPortfolio(data);
    await loadPortfolioChart(force);
}

function renderPortfolio(data) {
    const container = document.getElementById('portfolio');
    if(!container) return;
    const positions = data.positions;
    const totalValue = data.total_value;
    const cash = data.cash;
    const change24h = data.change_24h;
    const change24hPercent = data.change_24h_percent;
    // Update dashboard stats
    const el = (id) => document.getElementById(id);
    if(el('total-value')) el('total-value').textContent = '$' + totalValue.toLocaleString('en-US', {minimumFractionDigits:2});
    if(el('cash-balance')) el('cash-balance').textContent = '$' + cash.toLocaleString('en-US', {minimumFractionDigits:2});
    if(el('change-24h')) {
        const prefix = change24h >= 0 ? '+' : '';
        el('change-24h').textContent = prefix + '$' + change24h + ' (' + prefix + change24hPercent + '%)';
        el('change-24h').className = 'value ' + (change24h >= 0 ? 'positive' : 'negative');
    }
    if(positions.length === 0) { container.innerHTML = '<p class="text-muted">No positions yet.</p>'; renderAllocationMap([]); return; }
    let html = '<div class="portfolio-grid">';
    for(const p of positions) {
        const profitClass = p.profit >= 0 ? 'positive' : 'negative';
        const profitPrefix = p.profit >= 0 ? '+' : '';
        const firstLetter = p.symbol.charAt(0);
        html += '<div class="stock-card" data-symbol="'+p.symbol+'">'
            +'<div class="stock-icon">'+firstLetter+'</div>'
            +'<div class="stock-info">'
            +'<div class="stock-header"><div class="stock-name">'+p.symbol+'</div><div class="stock-value">$'+p.value+'</div></div>'
            +'<div class="stock-details">'
            +'<div class="stock-amount">'+p.amount+' units @ $'+p.avg_buy_price+'</div>'
            +'<div class="stock-profit '+profitClass+'">'+profitPrefix+'$'+p.profit+' ('+profitPrefix+p.profit_percent+'%)</div>'
            +'</div></div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.stock-card[data-symbol]').forEach(card => {
        card.addEventListener('click', () => openStockModal(card.dataset.symbol));
    });
    renderAllocationMap(positions);
}

function renderAllocationMap(positions) {
    const map = document.getElementById('allocation-map');
    if(!map) return;
    if(!positions || positions.length === 0) { map.innerHTML = '<p class="text-muted">No positions yet.</p>'; return; }
    const totalValue = positions.reduce((s, p) => s + p.value, 0);
    if(totalValue <= 0) { map.innerHTML = ''; return; }
    // Sort descending by value
    const sorted = [...positions].sort((a, b) => b.value - a.value);
    let html = '';
    for(const p of sorted) {
        const weight = p.value / totalValue;
        // 24h $ change for this position: price_change_24h * amount
        const dollarChange = p.price_change_24h ? round2(p.price_change_24h * p.amount) : 0;
        // 24h % change for this position
        const oldPrice = p.price - (p.price_change_24h || 0);
        const pctChange = oldPrice > 0 ? round2((p.price_change_24h / oldPrice) * 100) : 0;
        const cls = dollarChange >= 0 ? 'positive' : 'negative';
        const prefix = dollarChange >= 0 ? '+' : '';
        // Size: flex-grow proportional to value, min ~80px
        const basis = Math.max(80, Math.round(weight * 500));
        const grow = Math.max(1, Math.round(weight * 100));
        html += '<div class="alloc-block '+cls+'" data-symbol="'+p.symbol+'" style="flex:'+grow+' 1 '+basis+'px; height:'+Math.max(90, Math.round(weight * 300 + 60))+'px;">'
            +'<div class="alloc-symbol">'+p.symbol+'</div>'
            +'<div class="alloc-pct">'+prefix+pctChange+'%</div>'
            +'<div class="alloc-dollar">'+prefix+'$'+dollarChange+'</div>'
            +'</div>';
    }
    map.innerHTML = html;
    map.querySelectorAll('.alloc-block[data-symbol]').forEach(block => {
        block.addEventListener('click', () => openStockModal(block.dataset.symbol));
    });
}
function round2(v) { return Math.round(v * 100) / 100; }

// ===== PORTFOLIO CHART =====
let portfolioChart = null;
let currentPortfolioPeriod = '24h';

function getChartLabelFormat(period) {
    return function(timestamp) {
        const d = new Date(timestamp * 1000);
        if(period === '24h') return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        if(period === '1w') return d.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric' });
        if(period === '1m') return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        if(period === '1y') return d.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' });
        return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: '2-digit' });
    };
}

function switchPortfolioPeriod(period, btnEl) {
    currentPortfolioPeriod = period;
    // Update active button
    document.querySelectorAll('.chart-period-buttons .period-btn').forEach(b => b.classList.remove('active'));
    if(btnEl) btnEl.classList.add('active');
    // Clear cache and reload
    _cache.portfolioHistory = null;
    loadPortfolioChart(true);
}

async function loadPortfolioChart(force=false) {
    const canvas = document.getElementById('portfolio-chart');
    if(!canvas) return;
    let history;
    const cacheKey = 'ph_' + currentPortfolioPeriod;
    if(!force && _cache.portfolioHistory && _cache.portfolioHistory.period === currentPortfolioPeriod && (now()-_cache.portfolioHistory.ts)<minutes(1)) {
        history = _cache.portfolioHistory.data;
    } else {
        const res = await fetch('/api/portfolio/history/' + currentPortfolioPeriod);
        history = await res.json();
        _cache.portfolioHistory = { data: history, ts: now(), period: currentPortfolioPeriod };
    }
    if(!history || history.length === 0) {
        if(portfolioChart) { portfolioChart.destroy(); portfolioChart = null; }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#a0aec0'; ctx.textAlign = 'center';
        ctx.fillText('No data yet – chart will populate over time', canvas.width/2, canvas.height/2);
        return;
    }
    const labelFn = getChartLabelFormat(currentPortfolioPeriod);
    const labels = history.map(i => labelFn(i.timestamp));
    const values = history.map(i => i.value);
    const isPositive = values[values.length - 1] >= values[0];
    const maxTicks = currentPortfolioPeriod === '24h' ? 12 : currentPortfolioPeriod === '1w' ? 7 : 10;
    const pointRadius = history.length > 50 ? 0 : history.length > 30 ? 2 : 4;
    const ctx = canvas.getContext('2d');
    if(portfolioChart) portfolioChart.destroy();
    portfolioChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Portfolio Value',
                data: values,
                borderColor: isPositive ? 'rgb(75,192,75)' : 'rgb(255,99,99)',
                backgroundColor: isPositive ? 'rgba(75,192,75,0.1)' : 'rgba(255,99,99,0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: pointRadius,
                pointHoverRadius: 7,
                pointBackgroundColor: isPositive ? 'rgb(75,192,75)' : 'rgb(255,99,99)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: function(items) { return items[0].label; },
                        label: function(ctx) { return 'Value: $' + ctx.parsed.y.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    suggestedMin: (function() {
                        const minV = Math.min(...values);
                        const maxV = Math.max(...values);
                        const range = maxV - minV;
                        const avg = (maxV + minV) / 2;
                        // Ensure the range is at least 0.5% of average to avoid extreme zoom
                        const minRange = avg * 0.005;
                        const padding = Math.max(range, minRange) * 0.3;
                        return minV - padding;
                    })(),
                    suggestedMax: (function() {
                        const minV = Math.min(...values);
                        const maxV = Math.max(...values);
                        const range = maxV - minV;
                        const avg = (maxV + minV) / 2;
                        const minRange = avg * 0.005;
                        const padding = Math.max(range, minRange) * 0.3;
                        return maxV + padding;
                    })(),
                    ticks: { callback: function(v) { return '$' + v.toLocaleString(); } },
                    grid: { color: 'rgba(255,255,255,0.06)' }
                },
                x: {
                    ticks: { maxTicksLimit: maxTicks, maxRotation: 45, minRotation: 0 },
                    grid: { color: 'rgba(255,255,255,0.06)' }
                }
            }
        }
    });

    // Highlight 24H button by default on first load
    if(!document.querySelector('.chart-period-buttons .period-btn.active')) {
        const btns = document.querySelectorAll('.chart-period-buttons .period-btn');
        btns.forEach(b => { if(b.textContent === '24H') b.classList.add('active'); });
    }
}

// ===== PENDING ORDERS =====
async function loadPendingOrders() {
    const container = document.getElementById('pending-orders');
    if(!container) return;
    try {
        const res = await fetch('/api/orders');
        const orders = await res.json();
        if(!orders || orders.length === 0) { container.innerHTML = '<p class="text-muted">No pending orders.</p>'; return; }
        let html = '<table><thead><tr><th>Symbol</th><th>Type</th><th>Action</th><th>Amount</th><th>Target Price</th><th>Created</th><th></th></tr></thead><tbody>';
        for(const o of orders) {
            const date = new Date(o.created_at * 1000).toLocaleString('cs-CZ');
            html += '<tr><td>'+o.symbol+'</td><td>'+o.order_type+'</td><td>'+o.action+'</td><td>'+o.amount+'</td><td>$'+o.target_price+'</td><td>'+date+'</td>'
                +'<td><button class="btn-sm btn-danger" onclick="cancelOrder('+o.id+')">Cancel</button></td></tr>';
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-muted">Error loading orders.</p>'; }
}

async function cancelOrder(id) {
    await fetch('/api/orders/'+id, {method:'DELETE'});
    loadPendingOrders();
}

async function checkOrders() {
    try { await fetch('/api/orders/check', {method:'POST'}); } catch(e){}
}

// ===== TRADE HISTORY =====
const TRADES_PER_PAGE = 10;
let _allTrades = [];
let _tradesPage = 1;

async function loadTradeHistory() {
    const container = document.getElementById('trade-history');
    if(!container) return;
    try {
        const res = await fetch('/api/trade-history');
        const trades = await res.json();
        if(!trades || trades.length === 0) { container.innerHTML = '<p class="text-muted">No trades yet.</p>'; return; }
        _allTrades = trades;
        _tradesPage = 1;
        renderTradeHistoryPage(container);
    } catch(e) { container.innerHTML = '<p class="text-muted">Error loading trade history.</p>'; }
}

function renderTradeHistoryPage(container) {
    if(!container) container = document.getElementById('trade-history');
    if(!container) return;
    const totalPages = Math.ceil(_allTrades.length / TRADES_PER_PAGE);
    if(_tradesPage < 1) _tradesPage = 1;
    if(_tradesPage > totalPages) _tradesPage = totalPages;
    const start = (_tradesPage - 1) * TRADES_PER_PAGE;
    const pageTrades = _allTrades.slice(start, start + TRADES_PER_PAGE);

    let html = '<table><thead><tr><th>Date</th><th>Symbol</th><th>Action</th><th>Amount</th><th>Price</th><th>Fee</th><th>Total</th><th>Profit</th><th>Type</th></tr></thead><tbody>';
    for(const t of pageTrades) {
        const date = new Date(t.timestamp * 1000).toLocaleString('cs-CZ');
        const profitClass = t.action === 'sell' ? (t.profit >= 0 ? 'positive' : 'negative') : '';
        const profitText = t.action === 'sell' ? ((t.profit >= 0 ? '+' : '') + '$' + t.profit) : '-';
        const actionClass = t.action === 'buy' ? 'positive' : 'negative';
        html += '<tr><td>'+date+'</td><td>'+t.symbol+'</td><td class="'+actionClass+'">'+t.action.toUpperCase()+'</td>'
            +'<td>'+t.amount+'</td><td>$'+t.price+'</td><td>$'+t.fee+'</td><td>$'+t.total+'</td>'
            +'<td class="'+profitClass+'">'+profitText+'</td><td>'+t.order_type+'</td></tr>';
    }
    html += '</tbody></table>';

    if(totalPages > 1) {
        html += '<div class="pagination">';
        html += '<button class="page-btn'+ (_tradesPage <= 1 ? ' disabled' : '') +'" onclick="changeTradesPage(-1)">&laquo; Prev</button>';
        for(let i = 1; i <= totalPages; i++) {
            html += '<button class="page-btn'+ (i === _tradesPage ? ' active' : '') +'" onclick="goToTradesPage('+i+')">'+i+'</button>';
        }
        html += '<button class="page-btn'+ (_tradesPage >= totalPages ? ' disabled' : '') +'" onclick="changeTradesPage(1)">Next &raquo;</button>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function changeTradesPage(delta) { _tradesPage += delta; renderTradeHistoryPage(); }
function goToTradesPage(page) { _tradesPage = page; renderTradeHistoryPage(); }

// ===== TRADE STATS =====
async function loadTradeStats() {
    try {
        const res = await fetch('/api/trade-stats');
        const s = await res.json();
        const el = (id) => document.getElementById(id);
        if(el('stat-total-trades')) el('stat-total-trades').textContent = s.total_trades;
        if(el('stat-wins')) el('stat-wins').textContent = s.wins + ' (' + s.win_rate + '%)';
        if(el('stat-losses')) el('stat-losses').textContent = s.losses + ' (' + (s.loss_rate || 0) + '%)';
        if(el('stat-total-pnl')) {
            const prefix = s.total_profit >= 0 ? '+' : '';
            el('stat-total-pnl').textContent = prefix + '$' + s.total_profit;
            el('stat-total-pnl').className = 'value ' + (s.total_profit >= 0 ? 'positive' : 'negative');
        }
        if(el('stat-total-fees')) el('stat-total-fees').textContent = '$' + s.total_fees;
        if(el('win-rate')) el('win-rate').textContent = s.win_rate + '%';
    } catch(e){}
}

// ===== RESET ACCOUNT =====
async function sellAll() {
    if(!confirm('Are you sure you want to sell ALL positions at market price?')) return;
    try {
        const res = await fetch('/api/sell-all', {method:'POST'});
        const data = await res.json();
        if(data.error && !data.results) {
            alert('Error: ' + data.error);
        } else {
            let msg = data.message || 'Positions sold.';
            if(data.results) {
                msg += '\n\n';
                for(const r of data.results) {
                    if(r.error) msg += r.symbol + ': FAILED - ' + r.error + '\n';
                    else msg += r.symbol + ': ' + r.message + '\n';
                }
            }
            alert(msg);
        }
        invalidateCache(['portfolio','portfolioHistory']);
        refreshBalanceBar();
        loadPortfolio(true);
        loadPendingOrders();
        loadTradeHistory();
        loadTradeStats();
        loadPies();
    } catch(e) { alert('Error selling all: ' + e.message); }
}

async function resetAccount() {
    if(!confirm('Are you sure you want to reset your account? All data will be lost.')) return;
    await fetch('/api/reset', {method:'POST'});
    invalidateCache(['portfolio','portfolioHistory']);
    localStorage.clear();
    refreshBalanceBar();
    loadPortfolio(true);
    loadPendingOrders();
    loadTradeHistory();
    loadTradeStats();
    loadPies();
    alert('Account has been reset to $100,000.');
}

// ===== PIES =====
const PIE_COLORS = ['#6b46c1','#48bb78','#f56565','#ed8936','#4299e1','#ecc94b','#38b2ac','#e53e3e','#9f7aea','#fc8181','#68d391','#63b3ed'];

function addPieSliceRow() {
    const builder = document.getElementById('pie-slices-builder');
    const row = document.createElement('div');
    row.className = 'pie-slice-row';
    row.style.cssText = 'display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
    const uid = 'pie-sym-' + Date.now();
    const ddid = uid + '-dd';
    row.innerHTML = '<div class="autocomplete-wrapper" style="flex:2;"><input type="text" placeholder="Symbol (e.g. AAPL)" class="pie-symbol" id="'+uid+'" autocomplete="off">'
        +'<div class="autocomplete-dropdown" id="'+ddid+'"></div></div>'
        +'<input type="number" placeholder="%" class="pie-percent" min="1" max="100" style="flex:1;" oninput="updatePiePctTotal()">'
        +'<span style="cursor:pointer;color:var(--danger);font-size:1.2rem;" onclick="this.parentElement.remove();updatePiePctTotal();">&times;</span>';
    builder.appendChild(row);
    setupAutocomplete(uid, ddid);
}

function updatePiePctTotal() {
    const pcts = document.querySelectorAll('#pie-slices-builder .pie-percent');
    let total = 0;
    pcts.forEach(p => total += parseFloat(p.value) || 0);
    const el = document.getElementById('pie-total-pct');
    if(el) { el.textContent = 'Total: ' + total + '%'; el.style.color = Math.abs(total-100)<0.01 ? 'var(--success)' : 'var(--text-muted)'; }
}

// Attach oninput to the initial row
document.addEventListener('DOMContentLoaded', () => {
    const first = document.querySelector('#pie-slices-builder .pie-percent');
    if(first) first.addEventListener('input', updatePiePctTotal);
});

async function createPie() {
    const name = (document.getElementById('pie-name').value || '').trim();
    const statusEl = document.getElementById('pie-create-status');
    const rows = document.querySelectorAll('#pie-slices-builder .pie-slice-row');
    const slices = [];
    rows.forEach(row => {
        const sym = (row.querySelector('.pie-symbol').value || '').trim().toUpperCase();
        const pct = parseFloat(row.querySelector('.pie-percent').value) || 0;
        if(sym && pct > 0) slices.push({symbol: sym, percent: pct});
    });
    if(!name) { statusEl.innerHTML = '<span class="negative">Enter a pie name.</span>'; return; }
    if(slices.length === 0) { statusEl.innerHTML = '<span class="negative">Add at least one stock.</span>'; return; }
    const total = slices.reduce((s,x) => s+x.percent, 0);
    if(Math.abs(total-100) > 0.01) { statusEl.innerHTML = '<span class="negative">Percentages must add up to 100% (currently '+total+'%).</span>'; return; }
    try {
        const res = await fetch('/api/pies', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, slices})});
        const data = await res.json();
        if(data.error) { statusEl.innerHTML = '<span class="negative">'+data.error+'</span>'; }
        else {
            statusEl.innerHTML = '<span class="positive">'+data.message+'</span>';
            document.getElementById('pie-name').value = '';
            document.getElementById('pie-slices-builder').innerHTML = '<div class="pie-slice-row" style="display:flex; gap:0.5rem; margin-bottom:0.5rem;">'
                +'<input type="text" placeholder="Symbol (e.g. AAPL)" class="pie-symbol" style="flex:2;">'
                +'<input type="number" placeholder="%" class="pie-percent" min="1" max="100" style="flex:1;" oninput="updatePiePctTotal()"></div>';
            updatePiePctTotal();
            loadPies();
        }
    } catch(e) { statusEl.innerHTML = '<span class="negative">Error creating pie.</span>'; }
}

async function loadPies() {
    const container = document.getElementById('pies-list');
    if(!container) return;
    try {
        const res = await fetch('/api/pies');
        const pies = await res.json();
        if(!pies || pies.length === 0) { container.innerHTML = '<p class="text-muted">No pies yet. Create one above.</p>'; return; }
        let html = '';
        for(const pie of pies) {
            const pieJson = JSON.stringify(pie).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += '<div class="pie-card" id="pie-card-'+pie.id+'">';
            html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
            html += '<h3>'+pie.name+'</h3>';
            html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
            html += '<span style="font-size:1.1rem;font-weight:700;color:var(--light-purple);">Invested: $'+(pie.invested_value||0)+'</span>';
            html += '<button class="btn-sm btn-secondary" onclick=\'startEditPie('+pie.id+')\' title="Edit pie" style="font-size:0.85rem;">✏️</button>';
            html += '<button class="btn-sm btn-secondary" onclick="deletePie('+pie.id+')" title="Delete pie" style="background:rgba(245,101,101,0.2);border-color:rgba(245,101,101,0.4);color:#f56565;">&times;</button>';
            html += '</div></div>';
            // Edit form (hidden by default)
            html += '<div id="pie-edit-form-'+pie.id+'" style="display:none; border:1px solid var(--border-color); border-radius:10px; padding:1rem; margin-bottom:0.75rem;">';
            html += '<div class="form-group"><label>Pie Name</label><input type="text" id="pie-edit-name-'+pie.id+'" value="'+pie.name+'"></div>';
            html += '<div id="pie-edit-slices-'+pie.id+'">';
            pie.slices.forEach(s => {
                html += '<div class="pie-slice-row" style="display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;">'
                    +'<input type="text" value="'+s.symbol+'" class="pie-symbol" style="flex:2;">'
                    +'<input type="number" value="'+s.percent+'" class="pie-percent" min="1" max="100" style="flex:1;" oninput="updateEditPiePct('+pie.id+')">'
                    +'<span style="cursor:pointer;color:var(--danger);font-size:1.2rem;" onclick="this.parentElement.remove();updateEditPiePct('+pie.id+');">&times;</span></div>';
            });
            html += '</div>';
            html += '<div style="display:flex; gap:0.5rem; align-items:center; margin-top:0.5rem;">';
            html += '<button class="btn-secondary btn-sm" onclick="addEditPieSliceRow('+pie.id+')">+ Add Stock</button>';
            html += '<span id="pie-edit-pct-'+pie.id+'" style="color:var(--text-muted); margin-left:auto;">Total: '+pie.slices.reduce((s,x)=>s+x.percent,0)+'%</span>';
            html += '</div>';
            html += '<div style="display:flex; gap:0.5rem; margin-top:0.75rem;">';
            html += '<button onclick="saveEditPie('+pie.id+')">Save</button>';
            html += '<button class="btn-secondary" onclick="cancelEditPie('+pie.id+')">Cancel</button>';
            html += '</div>';
            html += '<p id="pie-edit-status-'+pie.id+'" style="margin-top:0.5rem;font-size:0.85rem;"></p>';
            html += '</div>';
            // Visual pie chart + legend
            html += '<div id="pie-display-'+pie.id+'" style="display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;">';
            html += '<div style="width:160px;height:160px;flex-shrink:0;"><canvas id="pie-chart-'+pie.id+'"></canvas></div>';
            // Legend with prices
            html += '<div class="pie-slices-legend" style="flex:1;flex-direction:column;">';
            pie.slices.forEach((s, i) => {
                const color = PIE_COLORS[i % PIE_COLORS.length];
                html += '<div class="pie-legend-item"><span class="pie-legend-dot" style="background:'+color+';"></span><span>'+s.symbol+' — '+s.percent+'% — <strong>$'+(s.price||0)+'</strong></span></div>';
            });
            html += '</div>';
            html += '</div>';
            // Buy row
            html += '<div class="pie-buy-row">';
            html += '<input type="number" id="pie-buy-amount-'+pie.id+'" placeholder="$ amount" min="1" step="any">';
            html += '<button class="btn-buy btn-sm" onclick="buyPie('+pie.id+')">Buy Pie</button>';
            html += '</div>';
            html += '<p id="pie-status-'+pie.id+'" style="margin-top:0.5rem;font-size:0.85rem;"></p>';
            html += '</div>';
        }
        container.innerHTML = html;
        // Render Chart.js doughnut for each pie
        for(const pie of pies) {
            const canvas = document.getElementById('pie-chart-'+pie.id);
            if(!canvas) continue;
            new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: pie.slices.map(s => s.symbol),
                    datasets: [{
                        data: pie.slices.map(s => s.percent),
                        backgroundColor: pie.slices.map((s, i) => PIE_COLORS[i % PIE_COLORS.length]),
                        borderColor: 'rgba(26,22,37,0.8)',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: c => c.label + ': ' + c.parsed + '%' } }
                    },
                    cutout: '55%'
                }
            });
        }
    } catch(e) { container.innerHTML = '<p class="text-muted">Error loading pies.</p>'; }
}

function startEditPie(pieId) {
    document.getElementById('pie-edit-form-'+pieId).style.display = 'block';
    document.getElementById('pie-display-'+pieId).style.display = 'none';
}
function cancelEditPie(pieId) {
    document.getElementById('pie-edit-form-'+pieId).style.display = 'none';
    document.getElementById('pie-display-'+pieId).style.display = '';
}
function addEditPieSliceRow(pieId) {
    const builder = document.getElementById('pie-edit-slices-'+pieId);
    const row = document.createElement('div');
    row.className = 'pie-slice-row';
    row.style.cssText = 'display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center;';
    row.innerHTML = '<input type="text" placeholder="Symbol" class="pie-symbol" style="flex:2;">'
        +'<input type="number" placeholder="%" class="pie-percent" min="1" max="100" style="flex:1;" oninput="updateEditPiePct('+pieId+')">'
        +'<span style="cursor:pointer;color:var(--danger);font-size:1.2rem;" onclick="this.parentElement.remove();updateEditPiePct('+pieId+');">&times;</span>';
    builder.appendChild(row);
}
function updateEditPiePct(pieId) {
    const pcts = document.querySelectorAll('#pie-edit-slices-'+pieId+' .pie-percent');
    let total = 0;
    pcts.forEach(p => total += parseFloat(p.value) || 0);
    const el = document.getElementById('pie-edit-pct-'+pieId);
    if(el) { el.textContent = 'Total: '+total+'%'; el.style.color = Math.abs(total-100)<0.01 ? 'var(--success)' : 'var(--text-muted)'; }
}
async function saveEditPie(pieId) {
    const name = (document.getElementById('pie-edit-name-'+pieId).value || '').trim();
    const statusEl = document.getElementById('pie-edit-status-'+pieId);
    const rows = document.querySelectorAll('#pie-edit-slices-'+pieId+' .pie-slice-row');
    const slices = [];
    rows.forEach(row => {
        const sym = (row.querySelector('.pie-symbol').value || '').trim().toUpperCase();
        const pct = parseFloat(row.querySelector('.pie-percent').value) || 0;
        if(sym && pct > 0) slices.push({symbol: sym, percent: pct});
    });
    if(!name) { statusEl.innerHTML = '<span class="negative">Enter a pie name.</span>'; return; }
    if(slices.length === 0) { statusEl.innerHTML = '<span class="negative">Add at least one stock.</span>'; return; }
    const total = slices.reduce((s,x) => s+x.percent, 0);
    if(Math.abs(total-100) > 0.01) { statusEl.innerHTML = '<span class="negative">Percentages must add up to 100% (currently '+total+'%).</span>'; return; }
    try {
        const res = await fetch('/api/pies/'+pieId, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name, slices})});
        const data = await res.json();
        if(data.error) { statusEl.innerHTML = '<span class="negative">'+data.error+'</span>'; }
        else {
            statusEl.innerHTML = '<span class="positive">'+data.message+'</span>';
            loadPies();
        }
    } catch(e) { statusEl.innerHTML = '<span class="negative">Error updating pie.</span>'; }
}

async function buyPie(pieId) {
    const amountEl = document.getElementById('pie-buy-amount-'+pieId);
    const statusEl = document.getElementById('pie-status-'+pieId);
    const amount = parseFloat(amountEl.value) || 0;
    if(amount <= 0) { statusEl.innerHTML = '<span class="negative">Enter a valid dollar amount.</span>'; return; }
    try {
        const res = await fetch('/api/pies/'+pieId+'/buy', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({amount})});
        const data = await res.json();
        if(data.error && !data.purchases) { statusEl.innerHTML = '<span class="negative">'+data.error+'</span>'; }
        else {
            const purchases = data.purchases || [];
            let successCount = data.success_count || 0;
            let failCount = data.fail_count || 0;
            let msg = '';
            if(successCount === 0) {
                msg = '<span class="negative">No purchases were executed:<br>';
            } else if(failCount > 0) {
                msg = '<span class="positive">Bought pie for $'+amount+' ('+successCount+' succeeded, '+failCount+' failed):<br>';
            } else {
                msg = '<span class="positive">Bought pie for $'+amount+':<br>';
            }
            for(const p of purchases) {
                if(p.error) msg += '<span class="negative">'+p.symbol+': '+p.error+'</span><br>';
                else if(p.result && p.result.error) msg += '<span class="negative">'+p.symbol+': '+p.result.error+'</span><br>';
                else msg += p.symbol+': '+p.shares+' shares ($'+p.allocated+')<br>';
            }
            msg += (successCount === 0 ? '</span>' : '</span>');
            statusEl.innerHTML = msg;
            invalidateCache(['portfolio']); refreshBalanceBar();
            loadPortfolio(true);
            loadTradeHistory();
            loadTradeStats();
            loadPies();
        }
    } catch(e) { statusEl.innerHTML = '<span class="negative">Error buying pie.</span>'; }
}

async function deletePie(pieId) {
    if(!confirm('Delete this pie?')) return;
    await fetch('/api/pies/'+pieId, {method:'DELETE'});
    loadPies();
}

// ===== CATEGORIES =====
async function loadStocksByCategory(forceRefresh = false) {
    const container = document.getElementById('stocks-categories');
    if(!container) return;
    
    // Show cached data immediately if available
    const stored = loadFromStorage(STORAGE_KEYS.stocksCategories);
    if(stored && stored.data) {
        renderStocksCategories(stored.data);
    } else {
        container.innerHTML = '<p style=\"color:var(--text-muted);\">Loading prices...</p>';\n    }
    
    // Skip fetch if already loaded and not forcing refresh
    if(!forceRefresh && container.getAttribute('data-loaded')==='1' && stored) return;
    
    try {
        const res = await fetch('/api/stocks-by-category');
        const data = await res.json();
        saveToStorage(STORAGE_KEYS.stocksCategories, data);
        renderStocksCategories(data);
        container.setAttribute('data-loaded','1');
    } catch(e) { 
        if(!stored) container.innerHTML = '<p class=\"negative\">Error loading categories.</p>'; 
    }
}

let currentCategory = null;
function renderStocksCategories(data) {
    const container = document.getElementById('stocks-categories');
    const tabsContainer = document.getElementById('category-tabs');
    if(!container || !tabsContainer) return;
    const categories = Object.keys(data);
    if(!currentCategory) currentCategory = categories[0];
    // Render tabs
    let tabsHtml = '';
    for(const cat of categories) {
        tabsHtml += '<button class="tab '+(cat === currentCategory ? 'active' : '')+'" onclick="switchCategory(\''+cat+'\')">'+cat+'</button>';
    }
    tabsContainer.innerHTML = tabsHtml;
    // Render stocks for current category
    const stocks = data[currentCategory] || [];
    let html = '<div class="stock-cards-grid">';
    for(const stock of stocks) {
        let changeClass = '';
        if(typeof stock.change_percent === 'number') changeClass = stock.change_percent > 0 ? 'positive' : (stock.change_percent < 0 ? 'negative' : '');
        html += '<div class="stock-card stock-card-category" data-symbol="'+stock.symbol+'">'
            +'<div class="stock-info"><div class="stock-header"><div class="stock-name">'+stock.name+'</div>'
            +'<div class="stock-value">'+(stock.price !== null ? '$'+stock.price : '-')+'</div></div>'
            +'<div class="stock-details"><div class="stock-amount">'+stock.symbol+'</div>'
            +'<div class="stock-profit '+changeClass+'">'+(stock.change_percent !== null ? (stock.change_percent > 0 ? '+' : '')+stock.change_percent+'%' : '-')+'</div>'
            +'</div></div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.stock-card-category').forEach(card => {
        card.addEventListener('click', () => openStockModal(card.dataset.symbol));
    });
    // Store data for tab switching
    container._allData = data;
}

function switchCategory(cat) {
    const container = document.getElementById('stocks-categories');
    if(!container || !container._allData) return;
    currentCategory = cat;
    renderStocksCategories(container._allData);
}

// ===== BACKTESTING =====
let btChart = null;
async function runBacktest() {
    const symbol = (document.getElementById('bt-symbol').value || '').trim().toUpperCase();
    const startDate = document.getElementById('bt-date').value;
    const investment = parseFloat(document.getElementById('bt-investment').value) || 10000;
    const resultEl = document.getElementById('bt-result');
    const chartContainer = document.getElementById('bt-chart-container');
    if(!symbol || !startDate) { resultEl.innerHTML = '<p class="negative">Enter symbol and date.</p>'; return; }
    resultEl.innerHTML = '<p>Running simulation...</p>';
    chartContainer.style.display = 'none';
    try {
        const res = await fetch('/api/backtest', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({symbol, start_date: startDate, investment})
        });
        const data = await res.json();
        if(data.error) { resultEl.innerHTML = '<p class="negative">'+data.error+'</p>'; return; }
        const profitClass = data.profit >= 0 ? 'positive' : 'negative';
        const prefix = data.profit >= 0 ? '+' : '';
        resultEl.innerHTML = '<div class="backtest-result">'
            +'<div class="bt-row"><span>Symbol:</span><strong>'+data.symbol+'</strong></div>'
            +'<div class="bt-row"><span>Period:</span><strong>'+data.start_date+' to '+data.end_date+'</strong></div>'
            +'<div class="bt-row"><span>Buy Price:</span><strong>$'+data.buy_price+'</strong></div>'
            +'<div class="bt-row"><span>Current Price:</span><strong>$'+data.current_price+'</strong></div>'
            +'<div class="bt-row"><span>Shares Bought:</span><strong>'+data.shares+'</strong></div>'
            +'<div class="bt-row"><span>Investment:</span><strong>$'+data.investment+'</strong></div>'
            +'<div class="bt-row"><span>Current Value:</span><strong>$'+data.current_value+'</strong></div>'
            +'<div class="bt-row"><span>Total Fees:</span><strong>$'+data.total_fees+'</strong></div>'
            +'<div class="bt-row bt-profit"><span>Profit/Loss:</span><strong class="'+profitClass+'">'+prefix+'$'+data.profit+' ('+prefix+data.profit_percent+'%)</strong></div>'
            +'</div>';
        // Render backtest chart
        if(data.chart_data && data.chart_data.length > 0) {
            chartContainer.style.display = 'block';
            const labels = data.chart_data.map(i => { const d=new Date(i.timestamp*1000); return d.toLocaleDateString('cs-CZ',{day:'numeric',month:'short'}); });
            const values = data.chart_data.map(i => i.value);
            const isPos = values[values.length-1] >= values[0];
            const ctx = document.getElementById('bt-chart').getContext('2d');
            if(btChart) btChart.destroy();
            btChart = new Chart(ctx, {
                type:'line', data:{labels, datasets:[{label:'Portfolio Value', data:values,
                    borderColor:isPos?'rgb(75,192,75)':'rgb(255,99,99)',
                    backgroundColor:isPos?'rgba(75,192,75,0.1)':'rgba(255,99,99,0.1)',
                    tension:0.3, fill:true, pointRadius:0, pointHoverRadius:4}]},
                options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false},
                    tooltip:{callbacks:{label:c=>'$'+c.parsed.y.toFixed(2)}}},
                    scales:{y:{beginAtZero:false, ticks:{callback:v=>'$'+v}}, x:{ticks:{maxTicksLimit:8}}}}
            });
        }
    } catch(e) { resultEl.innerHTML = '<p class="negative">Error: '+e.message+'</p>'; }
}

// ===== STOCK DETAIL MODAL =====
let stockModalChart = null;
let stockModalLWChart = null;
let currentModalSymbol = null;
let currentModalData = null;
let currentChartType = 'line';
let currentModalHolding = null;
let currentSellMode = 'units';

function openStockModal(symbol) {
    currentModalSymbol = symbol.toUpperCase();
    currentChartType = 'line';
    currentModalHolding = null;
    currentSellMode = 'units';
    const modal = document.getElementById('stock-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-symbol').textContent = currentModalSymbol;
    document.getElementById('modal-current-price').textContent = 'Loading...';
    document.getElementById('modal-change').textContent = '';
    document.getElementById('modal-change-percent').textContent = '';
    // Reset sell panel
    const sellPanel = document.getElementById('modal-sell-panel');
    sellPanel.style.display = 'none';
    document.getElementById('modal-sell-amount').value = '';
    document.getElementById('modal-sell-status').innerHTML = '';
    document.getElementById('modal-sell-preview').textContent = '';
    // Fetch fresh portfolio to check holdings
    fetch('/api/portfolio').then(r => r.json()).then(pData => {
        _cache.portfolio = { data: pData, ts: now() };
        saveToStorage(STORAGE_KEYS.portfolio, pData);
        const pos = pData.positions.find(p => p.symbol === currentModalSymbol);
        if(pos && pos.amount > 0) {
            currentModalHolding = pos;
            sellPanel.style.display = 'block';
            document.getElementById('modal-sell-symbol').textContent = pos.symbol;
            document.getElementById('modal-sell-holding').textContent = pos.amount;
            document.getElementById('modal-sell-value').textContent = '$' + pos.value;
            setSellMode('units');
        }
    }).catch(e => console.warn('Could not fetch portfolio for sell panel:', e));
    // Reset buttons
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.period-btn[data-period="1d"]').classList.add('active');
    document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.chart-type-btn[data-type="line"]').classList.add('active');
    loadStockHistory(currentModalSymbol, '1d');
    // Period button handlers
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadStockHistory(currentModalSymbol, btn.dataset.period);
        };
    });
    // Chart type handlers
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentChartType = btn.dataset.type;
            if(currentModalData) renderModalChart(currentModalData);
        };
    });
}

function closeStockModal() {
    document.getElementById('stock-modal').style.display = 'none';
    currentModalSymbol = null;
    currentModalData = null;
    currentModalHolding = null;
    if(stockModalChart) { stockModalChart.destroy(); stockModalChart = null; }
    if(stockModalLWChart) { stockModalLWChart.remove(); stockModalLWChart = null; }
    document.getElementById('candlestick-container').innerHTML = '';
}

// ===== MODAL SELL FUNCTIONALITY =====
function setSellMode(mode) {
    currentSellMode = mode;
    document.querySelectorAll('.sell-mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.sell-mode-btn[data-mode="'+mode+'"]').classList.add('active');
    const label = document.getElementById('modal-sell-label');
    const input = document.getElementById('modal-sell-amount');
    input.value = '';
    document.getElementById('modal-sell-preview').textContent = '';
    if(mode === 'units') {
        label.textContent = 'Units to sell:';
        input.placeholder = '0';
        input.step = 'any';
    } else {
        label.textContent = 'Dollar amount to sell:';
        input.placeholder = '$0';
        input.step = '0.01';
    }
}

function sellQuick(pct) {
    if(!currentModalHolding) return;
    const input = document.getElementById('modal-sell-amount');
    if(currentSellMode === 'units') {
        input.value = parseFloat((currentModalHolding.amount * pct).toFixed(6));
    } else {
        const price = (currentModalData && currentModalData.current_price) ? currentModalData.current_price : currentModalHolding.price;
        input.value = parseFloat((currentModalHolding.amount * price * pct).toFixed(2));
    }
    onSellAmountInput();
}

function onSellAmountInput() {
    const preview = document.getElementById('modal-sell-preview');
    if(!currentModalHolding) { preview.textContent = ''; return; }
    const raw = parseFloat(document.getElementById('modal-sell-amount').value);
    if(isNaN(raw) || raw <= 0) { preview.textContent = ''; return; }
    const price = (currentModalData && currentModalData.current_price) ? currentModalData.current_price : currentModalHolding.price;
    if(currentSellMode === 'units') {
        const val = (raw * price).toFixed(2);
        const fee = (raw * price * 0.001).toFixed(2);
        preview.textContent = 'Sell ' + raw + ' units ≈ $' + val + ' (fee: $' + fee + ')';
    } else {
        const units = (raw / price).toFixed(6);
        const fee = (raw * 0.001).toFixed(2);
        preview.textContent = 'Sell ≈ ' + units + ' units for $' + raw + ' (fee: $' + fee + ')';
    }
}

async function executeModalSell() {
    if(!currentModalHolding || !currentModalData) return;
    const statusEl = document.getElementById('modal-sell-status');
    const raw = parseFloat(document.getElementById('modal-sell-amount').value);
    if(isNaN(raw) || raw <= 0) { statusEl.innerHTML = '<span class="negative">Enter a valid amount.</span>'; return; }

    const price = currentModalData.current_price || currentModalHolding.price;
    let units;
    if(currentSellMode === 'units') {
        units = raw;
    } else {
        units = raw / price;
    }
    if(units > currentModalHolding.amount) units = currentModalHolding.amount;
    if(units <= 0) { statusEl.innerHTML = '<span class="negative">Amount too small.</span>'; return; }

    try {
        const res = await fetch('/api/trade', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({symbol: currentModalSymbol, action: 'sell', amount: units, order_type: 'market', target_price: 0})
        });
        const data = await res.json();
        if(data.error) { statusEl.innerHTML = '<span class="negative">'+data.error+'</span>'; }
        else {
            statusEl.innerHTML = '<span class="positive">'+data.message+'</span>';
            currentModalHolding.amount = Math.max(0, currentModalHolding.amount - units);
            currentModalHolding.value = parseFloat(Math.max(0, currentModalHolding.amount * price).toFixed(2));
            document.getElementById('modal-sell-holding').textContent = currentModalHolding.amount.toFixed(4);
            document.getElementById('modal-sell-value').textContent = '$' + currentModalHolding.value;
            document.getElementById('modal-sell-amount').value = '';
            document.getElementById('modal-sell-preview').textContent = '';
            if(currentModalHolding.amount <= 0.0001) {
                document.getElementById('modal-sell-panel').style.display = 'none';
            }
            invalidateCache(['portfolio','portfolioHistory']);
            refreshBalanceBar();
            await loadPortfolio(true);
            loadPendingOrders();
            loadTradeHistory();
            loadTradeStats();
            loadPies();
        }
    } catch(e) { statusEl.innerHTML = '<span class="negative">Error: '+e.message+'</span>'; }
}

document.addEventListener('click', e => { if(e.target === document.getElementById('stock-modal')) closeStockModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeStockModal(); });

async function loadStockHistory(symbol, period) {
    const loading = document.getElementById('modal-loading');
    const chartContainer = document.querySelector('.modal-chart-container');
    loading.style.display = 'block';
    chartContainer.style.opacity = '0.5';
    try {
        const res = await fetch('/api/stock/'+symbol+'/history/'+period);
        const data = await res.json();
        currentModalData = data;
        document.getElementById('modal-current-price').textContent = '$'+(data.current_price || 0);
        const changeEl = document.getElementById('modal-change');
        const changePercentEl = document.getElementById('modal-change-percent');
        const changeDiv = document.querySelector('.modal-change');
        const prefix = data.change >= 0 ? '+' : '';
        changeEl.textContent = prefix+'$'+data.change;
        changePercentEl.textContent = '('+prefix+data.change_percent+'%)';
        changeDiv.classList.remove('positive','negative');
        changeDiv.classList.add(data.change >= 0 ? 'positive' : 'negative');
        renderModalChart(data);
    } catch(e) { document.getElementById('modal-current-price').textContent = 'Error'; }
    finally { loading.style.display = 'none'; chartContainer.style.opacity = '1'; }
}

function renderModalChart(data) {
    const canvas = document.getElementById('stock-modal-chart');
    const candleContainer = document.getElementById('candlestick-container');
    // Clean up previous charts
    if(stockModalChart) { stockModalChart.destroy(); stockModalChart = null; }
    if(stockModalLWChart) { stockModalLWChart.remove(); stockModalLWChart = null; }
    candleContainer.innerHTML = '';
    if(currentChartType === 'candle' && data.ohlc && data.ohlc.length > 0) {
        // Candlestick with lightweight-charts
        canvas.style.display = 'none';
        candleContainer.style.display = 'block';
        const chart = LightweightCharts.createChart(candleContainer, {
            width: candleContainer.clientWidth || 550,
            height: 250,
            layout: { background: {type:'solid', color:'transparent'}, textColor:'#a0aec0' },
            grid: { vertLines:{color:'rgba(255,255,255,0.05)'}, horzLines:{color:'rgba(255,255,255,0.05)'} },
            crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
            timeScale: { timeVisible: true, secondsVisible: false }
        });
        const candleSeries = chart.addCandlestickSeries({
            upColor:'#48bb78', downColor:'#f56565', borderUpColor:'#48bb78', borderDownColor:'#f56565',
            wickUpColor:'#48bb78', wickDownColor:'#f56565'
        });
        candleSeries.setData(data.ohlc.map(d => ({time: d.time, open: d.open, high: d.high, low: d.low, close: d.close})));
        chart.timeScale().fitContent();
        stockModalLWChart = chart;
    } else {
        // Line chart with Chart.js
        canvas.style.display = 'block';
        candleContainer.style.display = 'none';
        if(!data.data || data.data.length === 0) return;
        const labels = data.data.map(i => {
            const d = new Date(i.timestamp*1000);
            if(data.period==='1d') return d.toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
            if(data.period==='1w') return d.toLocaleDateString('cs-CZ',{weekday:'short',hour:'2-digit',minute:'2-digit'});
            return d.toLocaleDateString('cs-CZ',{day:'numeric',month:'short'});
        });
        const values = data.data.map(i => i.price);
        const isPos = data.change >= 0;
        const ctx = canvas.getContext('2d');
        stockModalChart = new Chart(ctx, {
            type:'line', data:{labels, datasets:[{label:data.symbol, data:values,
                borderColor:isPos?'rgb(75,192,75)':'rgb(255,99,99)',
                backgroundColor:isPos?'rgba(75,192,75,0.1)':'rgba(255,99,99,0.1)',
                tension:0.3, fill:true, pointRadius:data.data.length>50?0:2, pointHoverRadius:4}]},
            options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false},
                tooltip:{callbacks:{label:c=>'$'+c.parsed.y.toFixed(2)}}},
                scales:{y:{beginAtZero:false, ticks:{callback:v=>'$'+v}, grid:{color:'rgba(255,255,255,0.1)'}},
                    x:{ticks:{maxTicksLimit:6}, grid:{color:'rgba(255,255,255,0.1)'}}}}
        });
    }
}
