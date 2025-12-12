// 模拟数据生成（替换为真实API）
let inventoryData = [];
function generateMockData() {
    const models = ['CyberBlade', 'NeonCore', 'HoloShield', 'QuantumDrive'];
    const specs = ['V1', 'Pro', 'Elite', 'X'];
    const mats = ['Steel', 'Carbon', 'Titanium'];
    const units = ['pcs', 'kg', 'L'];
    for (let i = 1; i <= 50; i++) {
        inventoryData.push({
            id: i,
            model: models[Math.floor(Math.random() * models.length)],
            spec: specs[Math.floor(Math.random() * specs.length)],
            mat: mats[Math.floor(Math.random() * mats.length)],
            qty: Math.floor(Math.random() * 100),
            unit: units[Math.floor(Math.random() * units.length)]
        });
    }
    updateMetrics();
    renderTable();
    initCharts();
}

// 更新指标
function updateMetrics() {
    const totalStock = inventoryData.reduce((sum, item) => sum + item.qty, 0);
    const skuCount = inventoryData.length;
    const categories = [...new Set(inventoryData.map(item => item.model))].length;
    const criticalLow = inventoryData.filter(item => item.qty < 10).length;

    document.getElementById('totalStock').textContent = totalStock;
    document.getElementById('skuCount').textContent = skuCount;
    document.getElementById('categories').textContent = categories;
    document.getElementById('criticalLow').textContent = criticalLow;

    if (criticalLow > 0) alert('警报：检测到低库存项！'); // 实时警报
}

// 渲染表格
function renderTable() {
    const tbody = document.querySelector('#inventoryTable tbody');
    tbody.innerHTML = '';
    const top15 = [...inventoryData].sort((a, b) => b.qty - a.qty).slice(0, 15);
    top15.forEach(item => {
        const row = tbody.insertRow();
        row.innerHTML = `<td>${item.id}</td><td>${item.model}</td><td>${item.spec}</td><td>${item.mat}</td><td class="${item.qty < 10 ? 'critical-low' : ''}">${item.qty}</td><td>${item.unit}</td>`;
    });
}

// Tab切换
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
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
        `<div>${item.model} ${item.spec}: ${item.qty} ${item.unit}</div>`
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

// 库存预测（简单线性回归模拟）
function predictStock() {
    const avgQty = inventoryData.reduce((sum, item) => sum + item.qty, 0) / inventoryData.length;
    const prediction = avgQty * 0.9; // 模拟下周下降10%
    document.getElementById('predictionOutput').innerHTML = `<p>下周预测平均库存: ${Math.round(prediction)}</p>`;
}

// 初始化图表
function initCharts() {
    // 热力图 (使用scatter模拟热力)
    const ctx1 = document.getElementById('heatmapChart').getContext('2d');
    const lowItems = inventoryData.filter(item => item.qty < 20);
    new Chart(ctx1, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '低库存点',
                data: lowItems.map(item => ({x: item.id, y: item.qty, r: item.qty / 2})),
                backgroundColor: 'rgba(255,0,0,0.6)'
            }]
        },
        options: { scales: { x: { title: { display: true, text: 'ID' } }, y: { title: { display: true, text: 'Qty' } } } }
    });

    // 趋势线图 (模拟7天数据)
    const ctx2 = document.getElementById('trendChart').getContext('2d');
    const days = ['Day1', 'Day2', 'Day3', 'Day4', 'Day5', 'Day6', 'Day7'];
    const trendData = days.map(() => Math.floor(Math.random() * 1000 + 500));
    new Chart(ctx2, {
        type: 'line',
        data: { labels: days, datasets: [{ label: 'Total Stock', data: trendData, borderColor: '#00ff41', tension: 0.4 }] },
        options: { scales: { y: { beginAtZero: true } } }
    });

    // 3D堆叠柱图 (使用bar + stack)
    const ctx3 = document.getElementById('stackChart').getContext('2d');
    const categories = [...new Set(inventoryData.map(item => item.model))];
    const stackData = categories.map(cat => inventoryData.filter(item => item.model === cat).reduce((sum, item) => sum + item.qty, 0));
    new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{ label: '库存量', data: stackData, backgroundColor: '#ff00ff' }]
        },
        options: { scales: { x: { stacked: true }, y: { stacked: true } }, animation: { duration: 2000 } } // 旋转动画效果
    });
}

// 实时日志更新 (模拟)
function updateLogs() {
    const log = document.getElementById('logMonitor');
    setInterval(() => {
        log.innerHTML += `<div>[${new Date().toLocaleTimeString()}] DATA SYNC COMPLETE</div>`;
        log.scrollTop = log.scrollHeight;
    }, 5000);
}

// 初始化
generateMockData();
updateLogs();
