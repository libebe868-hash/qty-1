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

// 更新加载消息（同V3.3）
function updateLoading(msg) {
    document.getElementById('loadingMsg').textContent = msg;
    // 进度模拟同V3.3
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

// 显示错误弹窗（同V3.3）
function showError(msg) {
    const popup = document.createElement('div');
    popup.className = 'error-popup';
    popup.innerHTML = msg;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 5000);
}

// 显示调试日志
function showDebugLog() {
    document.getElementById('debugLog').style.display = 'block';
    document.getElementById('debugOutput').innerHTML = debugLogs.slice(-20).join('<br>');
}

// updateAll, updateMetrics, renderTable, switchTab, filterInventory, exportCSV, predictStock 同V3.3（略，复制即可）

// 初始化图表（添加气泡图）
function initCharts() {
    const totalStock = inventoryData.reduce((sum, item) => sum + (item.qty || 0), 0);
    const skuCount = inventoryData.length;
    // ... (热力图、趋势线、雷达、饼图、堆叠、热区 同V3.3)

    // 新增：气泡图
    const ctx7 = document.getElementById('bubbleChart').getContext('2d');
    const bubbleData = skuCount > 0 ? inventoryData.slice(0, 50).map(item => ({
        x: Math.random() * 100, // 随机Mat分布
        y: item.qty % 100, // Spec影响Y
        r: Math.min(30, (item.qty / totalStock) * 1000) // Qty大小
    })) : [{x: 50, y: 50, r: 20}];
    new Chart(ctx7, {
        type: 'bubble',
        data: { datasets: [{ label: '库存泡泡', data: bubbleData, backgroundColor: 'rgba(0,255,255,0.6)' }] },
        options: { responsive: true, scales: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } }, animation: { duration: 3000 } }
    });
}

// 模拟数据（增强赛博朋克 + 您的示例数据）
function generateMockData() {
    addDebugLog('生成模拟数据...');
    const models = ['销子', 'NeonBlade', 'CyberCore', 'HoloMat', 'Quantum销子'];
    const specs = ['7.5 | 304F', 'V2', 'Pro', 'Elite'];
    const mats = ['304', 'Titanium', 'Carbon'];
    const units = ['pcs', 'kg'];
    inventoryData = [];
    // 添加您的示例高Qty项
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

// 初始化（强制模拟）
window.addEventListener('load', () => {
    addDebugLog('页面加载完成');
    updateLoading('初始化系统...');
    generateMockData();
    setTimeout(() => updateLoading('就绪 - 模拟数据已加载'), 1000);
    updateLogs();
    checkAlerts();
});

// updateLogs, checkAlerts, toggleTheme 同V3.3
function updateLogs() {
    const log = document.getElementById('logMonitor');
    setInterval(() => {
        log.innerHTML += `<div>[${new Date().toLocaleTimeString()}] SYNC: ${inventoryData.length} SKUs ONLINE</div>`;
        log.scrollTop = log.scrollHeight;
    }, 4000);
}
function checkAlerts() {
    // 同V3.3
}
function toggleTheme() {
    // 同V3.3
}
