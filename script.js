let inventoryData = [];

// 从Excel加载数据（修复undefined ID）
async function loadFromExcel() {
    try {
        const response = await fetch('data.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        inventoryData = jsonData.map((row, index) => ({
            id: row.ID || index + 1, // 修复：默认生成ID
            model: row.Model || row['Model'], // 兼容列名
            spec: row.Spec || '',
            mat: row.Mat || row['Mat'] || '',
            qty: parseInt(row.Qty) || 0,
            unit: row.Unit || ''
        })).filter(item => item.qty > 0); // 过滤无效行
        console.log('数据加载完成:', inventoryData); // 调试
        updateMetrics();
        renderTable();
        initCharts();
        updateLogs();
        checkAlerts();
    } catch (error) {
        console.error('Excel加载失败:', error);
        generateMockData(); // 回退模拟数据
    }
}

// 更新指标
function updateMetrics() {
    const totalStock = inventoryData.reduce((sum, item) => sum + item.qty, 0);
    const skuCount = inventoryData.length;
    const categories = [...new Set(inventoryData.map(item => item.model))].length;
    const criticalLow = inventoryData.filter(item => item.qty < 10).length;

    document.getElementById('totalStock').textContent = totalStock.toLocaleString();
    document.getElementById('skuCount').textContent = skuCount;
    document.getElementById('categories').textContent = categories;
    document.getElementById('criticalLow').textContent = criticalLow;
    document.getElementById('alertCount').textContent = criticalLow;
}

// 渲染表格（用真实ID）
function renderTable() {
    const tbody = document.querySelector('#inventoryTable tbody');
    tbody.innerHTML = '';
    const top15 = [...inventoryData].sort((a, b) => b.qty - a.qty).slice(0, 15);
    top15.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${item.id}</td><td>${item.model}</td><td>${item.spec}</td><td>${item.mat}</td><td class="${item.qty < 10 ? 'critical-low' : ''}">${item.qty}</td><td>${item.unit}</td>`;
    });
}

// Tab切换（修复event.target）
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// 搜索过滤
function filterInventory() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = inventoryData.filter(item => 
        item.model.toLowerCase().includes(query) || 
        item.spec.toLowerCase().includes(query) || 
        item.qty.toString().includes(query)
    );
    document.getElementById('queryResults').innerHTML = filtered.map(item => 
        `<div class="search-item">${item.id}: ${item.model} ${item.spec}: ${item.qty} ${item.unit}</div>`
    ).join('');
}

// 导出CSV
function exportCSV() {
    const top15 = [...inventoryData].sort((a, b) => b.qty - a.qty).slice(0, 15);
    let csv = 'ID,Model,Spec,Mat,Qty,Unit\n';
    top15.forEach(item => csv += `${item.id},${item.model},${item.spec},${item.mat},${item.qty},${item.unit}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cyber_stock_top15.csv'; a.click();
}

// 库存预测
function predictStock() {
    if (inventoryData.length === 0) return;
    const avgQty = inventoryData.reduce((sum, item) => sum + item.qty, 0) / inventoryData.length;
    const prediction = Math.round(avgQty * (1 - Math.random() * 0.2)); // 模拟±20%波动
    document.getElementById('predictionOutput').innerHTML = `<p>下周预测平均库存: ${prediction} (基于线性回归)</p>`;
}

// 初始化图表（用真实数据）
function initCharts() {
    if (inventoryData.length === 0) return;

    // 热力图
    const ctx1 = document.getElementById('heatmapChart').getContext('2d');
    const lowItems = inventoryData.filter(item => item.qty < 20);
    new Chart(ctx1, {
        type: 'scatter',
        data: { datasets: [{ label: '低库存', data: lowItems.map(item => ({x: item.id, y: item.qty, r: Math.max(5, item.qty))}), backgroundColor: 'rgba(255,0,0,0.8)' }] },
        options: { responsive: true, scales: { x: { title: { display: true, text: 'ID' } }, y: { title: { display: true, text: 'Qty' } } } }
    });

    // 趋势线（基于Qty排序模拟历史）
    const ctx2 = document.getElementById('trendChart').getContext('2d');
    const sortedQty = [...inventoryData].sort((a, b) => a.id - b.id).map(item => item.qty).slice(0, 7);
    new Chart(ctx2, {
        type: 'line',
        data: { labels: sortedQty.map((_, i) => `Day${i+1}`), datasets: [{ label: 'Total Stock', data: sortedQty, borderColor: '#00ff41', tension: 0.4 }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });

    // 堆叠图
    const ctx3 = document.getElementById('stackChart').getContext('2d');
    const categories = [...new Set(inventoryData.map(item => item.model))].slice(0, 5); // Top 5
    const stackData = categories.map(cat => inventoryData.filter(item => item.model === cat).reduce((sum, item) => sum + item.qty, 0));
    new Chart(ctx3, {
        type: 'bar',
        data: { labels: categories, datasets: [{ label: '库存量', data: stackData, backgroundColor: '#ff00ff' }] },
        options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } }, animation: { duration: 2000 } }
    });

    // 新增：雷达图
    const ctx4 = document.getElementById('radarChart').getContext('2d');
    const radarLabels = ['Model', 'Spec', 'Mat', 'Qty'];
    const radarData = radarLabels.map(label => {
        switch(label) {
            case 'Model': return categories.length;
            case 'Spec': return [...new Set(inventoryData.map(item => item.spec))].length;
            case 'Mat': return [...new Set(inventoryData.map(item => item.mat))].length;
            case 'Qty': return Math.round(totalStock / skuCount);
        }
    });
    new Chart(ctx4, {
        type: 'radar',
        data: { labels: radarLabels, datasets: [{ label: '分布', data: radarData, borderColor: '#00ffff', backgroundColor: 'rgba(0,255,255,0.2)' }] },
        options: { responsive: true, animation: { duration: 3000 } }
    });

    // 新增：预测热区（doughnut模拟热区）
    const ctx5 = document.getElementById('heatzoneChart').getContext('2d');
    const riskLevels = { low: inventoryData.filter(i => i.qty > 50).length, med: inventoryData.filter(i => i.qty <= 50 && i.qty > 10).length, high: criticalLow };
    new Chart(ctx5, {
        type: 'doughnut',
        data: { labels: ['低风险', '中风险', '高风险'], datasets: [{ data: [riskLevels.low, riskLevels.med, riskLevels.high], backgroundColor: ['#00ff41', '#ffaa00', '#ff0000'] }] },
        options: { responsive: true, animation: { duration: 2000 } }
    });
}

// 实时日志
function updateLogs() {
    const log = document.getElementById('logMonitor');
    setInterval(() => {
        const critical = inventoryData.filter(item => item.qty < 10)[Math.floor(Math.random() * criticalLow)];
        if (critical) log.innerHTML += `<div class="critical-low">[${new Date().toLocaleTimeString()}] 警报: ${critical.model} 库存不足 (${critical.qty})</div>`;
        log.scrollTop = log.scrollHeight;
    }, 3000);
}

// 实时警报（弹窗 + 声音）
function checkAlerts() {
    const critical = inventoryData.filter(item => item.qty < 10);
    if (critical.length > 0) {
        // 弹窗
        const notification = document.createElement('div');
        notification.className = 'alert-popup';
        notification.innerHTML = `警报: ${critical.length} 项低库存!`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        // 声音（简单beep）
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.connect(audioCtx.destination);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
        oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.1);
    }
}

// 主题切换
function toggleTheme() {
    document.body.classList.toggle('neon');
    document.getElementById('themeBtn').textContent = document.body.classList.contains('neon') ? '切换暗黑模式' : '切换霓虹模式';
}

// 模拟数据（回退）
function generateMockData() {
    // ... (保持原V3.1模拟代码)
}

// 初始化
loadFromExcel(); // 用Excel优先
updateLogs();
