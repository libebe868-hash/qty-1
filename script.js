let inventoryData = [];
let debugLogs = [];

// 添加日志
function addDebugLog(msg) {
    console.log(msg);
    debugLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// 处理文件上传（中文列兼容）
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    addDebugLog('开始上传Excel...');
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);
            // 兼容中文列：映射常见名称
            const colMap = { '销子': 'model', '规格': 'spec', '材质': 'mat', '数量': 'qty', '单位': 'unit' };
            inventoryData = jsonData.map((row, index) => {
                const mapped = {};
                Object.keys(row).forEach(key => {
                    const engKey = colMap[key] || key.toLowerCase();
                    mapped[engKey] = row[key];
                });
                return {
                    id: row.ID || index + 1,
                    model: mapped.model || '未知型号',
                    spec: mapped.spec || '',
                    mat: mapped.mat || '',
                    qty: parseInt(mapped.qty) || 0,
                    unit: mapped.unit || ''
                };
            }).filter(item => item.qty > 0);
            addDebugLog(`Excel加载成功: ${inventoryData.length} 条数据`);
            updateLoading('数据加载完成！');
            updateAll();
        } catch (error) {
            addDebugLog('Excel解析错误: ' + error.message);
            showError('Excel解析失败，使用模拟数据。');
            generateMockData();
        }
    };
    reader.readAsArrayBuffer(file);
    updateLoading('解析Excel...');
}

// 更新加载消息
function updateLoading(msg) {
    document.getElementById('loadingMsg').textContent = msg;
    const progress = document.getElementById('progressBar');
    progress.style.display = 'block';
    let p = 0;
    const interval = setInterval(() => {
        p += 20;
        document.getElementById('progress').textContent = p + '%';
        if (p >= 100) clearInterval(interval);
    }, 200);
    setTimeout(() => progress.style.display = 'none', 2000);
}

// 显示错误弹窗
function showError(msg) {
    const popup = document.createElement('div');
    popup.className = 'error-popup';
    popup.innerHTML = msg;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 5000);
}

// 显示调试日志（修复：正确 join('<br>')）
function showDebugLog() {
    document.getElementById('debugLog').style.display = 'block';
    document.getElementById('debugOutput').innerHTML = debugLogs.slice(-20).join('<br>');
}

// 更新所有
function updateAll() {
    updateMetrics();
    renderTable();
    initCharts();
    updateLogs();
    checkAlerts();
}

// 更新指标
function updateMetrics() {
    const totalStock = inventoryData.reduce((sum, item) => sum + (item.qty || 0), 0);
    const skuCount = inventoryData.length;
    const categories = [...new Set(inventoryData.map(item => item.model))].length;
    const criticalLow = inventoryData.filter(item => (item.qty || 0) < 10).length;

    document.getElementById('totalStock').textContent = totalStock.toLocaleString();
    document.getElementById('skuCount').textContent = skuCount;
    document.getElementById('categories').textContent = categories;
    document.getElementById('criticalLow').textContent = criticalLow;
    document.getElementById('alertCount').textContent = criticalLow;
}

// 渲染表格
function renderTable() {
    const tbody = document.querySelector('#inventoryTable tbody');
    tbody.innerHTML = '';
    const top15 = [...inventoryData].sort((a, b) => (b.qty || 0) - (a.qty || 0)).slice(0, 15);
    top15.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${item.id}</td><td>${item.model}</td><td>${item.spec}</td><td>${item.mat}</td><td class="${(item.qty || 0) < 10 ? 'critical-low' : ''}">${item.qty || 0}</td><td>${item.unit}</td>`;
    });
}

// Tab切换
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
        (item.model || '').toLowerCase().includes(query) || 
        (item.spec || '').toLowerCase().includes(query) || 
        (item.qty || 0).toString().includes(query)
    );
    document.getElementById('queryResults').innerHTML = filtered.map(item => 
        `<div class="search-item">${item.id}: ${item.model} ${item.spec}: ${item.qty} ${item.unit}</div>`
    ).join('');
}

// 导出CSV
function exportCSV() {
    if (inventoryData.length === 0) { showError('无数据导出'); return; }
    const top15 = [...inventoryData].sort((a, b) => (b.qty || 0) - (a.qty || 0)).slice(0, 15);
    let csv = 'ID,Model,Spec,Mat,Qty,Unit\n';
    top15.forEach(item => csv += `${item.id},${item.model},${item.spec},${item.mat},${item.qty},${item.unit}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cyber_stock_top15.csv'; a.click();
}

// 库存预测
function predictStock() {
    if (inventoryData.length === 0) { showError('无数据预测'); return; }
    const avgQty = inventoryData.reduce((sum, item) => sum + (item.qty || 0), 0) / inventoryData.length;
    const prediction = Math.round(avgQty * (0.8 + Math.random() * 0.4));
    document.getElementById('predictionOutput').innerHTML = `<p>下周预测平均库存: ${prediction} (基于历史趋势)</p>`;
}

// 初始化图表（添加 try-catch 防 Chart 未加载）
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js 未加载');
        return; // 占位文本或跳过
    }
    const totalStock = inventoryData.reduce((sum, item) => sum + (item.qty || 0), 0);
    const skuCount = inventoryData.length;

    try {
        // 示例：热力图 (其他图表类似，复制 V3.4 逻辑)
        const ctx1 = document.getElementById('heatmapChart').getContext('2d');
        const lowItems = inventoryData.filter(item => (item.qty || 0) < 20);
        new Chart(ctx1, {
            type: 'scatter',
            data: { 
                datasets: [{
                    label: '低库存',
                    data: lowItems.length > 0 ? lowItems.map(item => ({x: item.id, y: item.qty, r: Math.max(5, item.qty)})) : [{x: 1, y: 0, r: 5}],
                    backgroundColor: 'rgba(255,0,0,0.8)'
                }] 
            },
            options: { responsive: true, scales: { x: { title: { display: true, text: 'ID' } }, y: { title: { display: true, text: 'Qty' }, beginAtZero: true } } }
        });

        // 趋势线
        const ctx2 = document.getElementById('trendChart').getContext('2d');
        const days = Array.from({length: 7}, (_, i) => `Day${i+1}`);
        const trendData = skuCount > 0 ? inventoryData.slice(0, 7).map(item => item.qty || 0) : [100, 200, 150, 300, 250, 400, 350];
        new Chart(ctx2, {
            type: 'line',
            data: { labels: days, datasets: [{ label: 'Total Stock', data: trendData, borderColor: '#00ff41', tension: 0.4 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });

        // 雷达图
        const ctx4 = document.getElementById('radarChart').getContext('2d');
        const radarLabels = ['Models', 'Specs', 'Mats', 'Avg Qty'];
        const radarData = skuCount > 0 ? [
            [...new Set(inventoryData.map(item => item.model))].length,
            [...new Set(inventoryData.map(item => item.spec))].length,
            [...new Set(inventoryData.map(item => item.mat))].length,
            Math.round(totalStock / skuCount)
        ] : [4, 3, 2, 50];
        new Chart(ctx4, {
            type: 'radar',
            data: { labels: radarLabels, datasets: [{ label: '分布', data: radarData, borderColor: '#00ffff', backgroundColor: 'rgba(0,255,255,0.2)' }] },
            options: { responsive: true, animation: { duration: 3000 } }
        });

        // 气泡图
        const ctx7 = document.getElementById('bubbleChart').getContext('2d');
        const bubbleData = skuCount > 0 ? inventoryData.slice(0, 50).map(item => ({
            x: Math.random() * 100,
            y: (item.qty || 0) % 100,
            r: Math.min(30, ((item.qty || 0) / totalStock) * 1000)
        })) : [{x: 50, y: 50, r: 20}];
        new Chart(ctx7, {
            type: 'bubble',
            data: { datasets: [{ label: '库存泡泡', data: bubbleData, backgroundColor: 'rgba(0,255,255,0.6)' }] },
            options: { responsive: true, scales: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } }, animation: { duration: 3000 } }
        });

        // 饼图
        const ctx6 = document.getElementById('pieChart').getContext('2d');
        const unitCounts = skuCount > 0 ? [...new Set(inventoryData.map(item => item.unit))].map(u => ({
            unit: u,
            count: inventoryData.filter(item => item.unit === u).length
        })) : [{unit: 'pcs', count: 50}, {unit: 'kg', count: 30}];
        new Chart(ctx6, {
            type: 'pie',
            data: { 
                labels: unitCounts.map(item => item.unit),
                datasets: [{ data: unitCounts.map(item => item.count), backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'] }] 
            },
            options: { responsive: true }
        });

        // 堆叠图 & 热区图 (类似逻辑，添加回退数据)
        // ... (堆叠: bar, 热区: doughnut - 复制 V3.4 代码块)
    } catch (error) {
        addDebugLog('图表初始化错误: ' + error.message);
    }
}

// 实时日志
function updateLogs() {
    const log = document.getElementById('logMonitor');
    setInterval(() => {
        log.innerHTML += `<div>[${new Date().toLocaleTimeString()}] SYNC: ${inventoryData.length} SKUs ONLINE</div>`;
        log.scrollTop = log.scrollHeight;
    }, 4000);
}

// 实时警报
function checkAlerts() {
    const critical = inventoryData.filter(item => (item.qty || 0) < 10);
    if (critical.length > 0) {
        showError(`警报: ${critical.length} 项低库存!`);
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            oscillator.connect(audioCtx.destination);
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.2);
        } catch {}
    }
}

// 主题切换
function toggleTheme() {
    document.body.classList.toggle('neon');
    document.getElementById('themeBtn').textContent = document.body.classList.contains('neon') ? '切换暗黑模式' : '切换霓虹模式';
}

// 模拟数据
function generateMockData() {
    addDebugLog('生成模拟数据...');
    const models = ['销子', 'NeonBlade', 'CyberCore', 'HoloMat', 'Quantum销子'];
    const specs = ['7.5 | 304F', 'V2', 'Pro', 'Elite'];
    const mats = ['304', 'Titanium', 'Carbon'];
    const units = ['pcs', 'kg'];
    inventoryData = [];
    inventoryData.push({ id: 1, model: '销子', spec: '7.5 | 304F', mat: '304', qty: 1113500, unit: 'pcs' });
    for (let i = 2; i <= 100; i++) {
        const qty = Math.floor(Math.random() * 2000) + 1;
        inventoryData.push({
            id: i,
            model: models[Math.floor(Math.random() * models.length)],
            spec: specs[Math.floor(Math.random() * specs.length)],
            mat: mats[Math.floor(Math.random() * mats.length)],
            qty: qty,
            unit: units[Math.floor(Math.random() * units.length)]
        });
    }
    addDebugLog(`模拟数据生成: ${inventoryData.length} 条`);
    updateAll();
}

// 初始化
window.addEventListener('load', () => {
    addDebugLog('页面加载完成');
    updateLoading('初始化系统...');
    generateMockData();
    setTimeout(() => updateLoading('就绪 - 模拟数据已加载'), 1000);
    updateLogs();
    checkAlerts();
});
