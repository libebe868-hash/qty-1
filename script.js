let workbook = null;
let allData = {};
let flatData = [];
let currentSheet = '';

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadExcel();
  setupTabs();
  setupListeners();
});

// 加载 Excel (保持 CDN 链接逻辑以防本地缺失)
async function loadExcel() {
  const loadingLayer = document.getElementById('loadingLayer');
  try {
    const response = await fetch(`data.xlsx?t=${Date.now()}`);
    if (!response.ok) throw new Error("无法读取 data.xlsx");
    
    const arrayBuffer = await response.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    processData();
    
    // 隐藏Loading
    loadingLayer.style.opacity = '0';
    setTimeout(() => loadingLayer.style.display = 'none', 500);
    
    const now = new Date();
    document.getElementById('updateTime').textContent = `SYSTEM ONLINE: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

  } catch (error) {
    loadingLayer.innerHTML = `<h3 style="color:#ff003c;text-align:center">CONNECTION FAILED<br>${error.message}</h3>`;
  }
}

function processData() {
  allData = {};
  flatData = [];
  let totalStock = 0, totalItems = 0, lowStockItems = [];
  const chartCategories = {};

  workbook.SheetNames.forEach(sheetName => {
    if (['总汇', 'Sheet1'].some(n => sheetName.includes(n)) || sheetName.includes('空白')) return;
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    const sheetItems = [];
    for (let i = 4; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row[2]) continue;

      const stock = parseInt(row[6]) || parseInt(row[7]) || parseInt(row[5]) || 0;
      const item = {
        sheet: sheetName,
        type: (row[1] || sheetName).toString().trim(), // 型号
        spec: row[2].toString().trim(), // 规格
        material: (row[3] || '').toString().trim(),
        stock: stock,
        unit: row[5] || 'pcs'
      };

      sheetItems.push(item);
      if (stock > 0) {
        flatData.push(item);
        totalStock += stock;
        totalItems++;
        const catKey = item.type; // 饼图只看大类
        chartCategories[catKey] = (chartCategories[catKey] || 0) + stock;
        
        if (stock < 1000) lowStockItems.push(item);
      }
    }
    if (sheetItems.length > 0) allData[sheetName] = sheetItems;
  });

  // 更新数字
  animateValue("totalStock", totalStock);
  animateValue("totalItems", totalItems);
  document.getElementById("totalTypes").textContent = Object.keys(allData).length;
  document.getElementById("lowStockCount").textContent = lowStockItems.length;

  // 渲染新版图表
  renderCharts(chartCategories, flatData);
  
  // 渲染列表
  renderRanking(flatData);
  renderSelect();
  
  // 启动终端日志
  startTerminalLog(lowStockItems, flatData);
}

// 🔥 核心修改：图表渲染
function renderCharts(pieDataMap, listData) {
  // 1. 饼图配置 (赛博风)
  const pieData = Object.keys(pieDataMap)
    .map(k => ({ name: k, value: pieDataMap[k] }))
    .sort((a,b) => b.value - a.value);

  const pieChart = echarts.init(document.getElementById('pieChart'));
  pieChart.setOption({
    color: ['#00f3ff', '#bc13fe', '#ff003c', '#eab308', '#3b82f6'],
    tooltip: { trigger: 'item', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#00f3ff', textStyle: { color: '#fff' } },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#aaa' }, pageTextStyle: { color: '#fff' } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
      itemStyle: { borderColor: '#050b14', borderWidth: 2 },
      label: { color: '#fff' },
      data: pieData
    }]
  });

  // 2. 柱状图配置 (修复标签问题)
  const top15 = [...listData].sort((a,b) => b.stock - a.stock).slice(0, 15);
  
  // 💡 关键逻辑：Y轴标签 = 型号 + 规格
  const yLabels = top15.map(i => {
    // 如果型号已经包含在规格里，就不重复显示，否则拼接
    const label = i.spec.includes(i.type) ? i.spec : `${i.type} ${i.spec}`;
    return label.length > 20 ? label.substring(0, 20) + '..' : label;
  });

  const barChart = echarts.init(document.getElementById('barChart'));
  barChart.setOption({
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(0,0,0,0.9)', 
      borderColor: '#bc13fe',
      textStyle: { color: '#fff' },
      formatter: (params) => {
        const i = top15[params[0].dataIndex];
        return `<div style="font-weight:bold;color:#bc13fe">${i.type}</div>
                <div>${i.spec}</div>
                <div style="margin-top:5px">库存: <b style="color:#00f3ff">${i.stock.toLocaleString()}</b></div>`;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { 
      type: 'value', 
      splitLine: { lineStyle: { color: 'rgba(0, 243, 255, 0.1)' } }, 
      axisLabel: { color: '#557588' } 
    },
    yAxis: { 
      type: 'category', 
      data: yLabels, // 使用拼接好的标签
      axisLabel: { color: '#e0fbfc', fontSize: 11 } 
    },
    series: [{
      type: 'bar',
      data: top15.map(i => ({ 
        value: i.stock,
        itemStyle: {
          // 渐变色柱子
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#00f3ff' },
            { offset: 1, color: '#bc13fe' }
          ]),
          borderRadius: [0, 4, 4, 0]
        } 
      })),
      label: { show: true, position: 'right', color: '#00f3ff', fontWeight: 'bold' }
    }]
  });

  window.addEventListener('resize', () => { pieChart.resize(); barChart.resize(); });
}

// 🔥 新功能：终端日志模拟
function startTerminalLog(lowItems, allItems) {
  const container = document.getElementById('terminalContent');
  if(!container) return;
  
  const logs = [];
  // 生成低库存日志
  lowItems.forEach(i => logs.push({ type: 'warn', msg: `[警告] 库存不足: ${i.type} ${i.spec} (仅剩 ${i.stock})` }));
  // 生成一些随机的正常日志
  allItems.slice(0, 10).forEach(i => logs.push({ type: 'info', msg: `[系统] 数据同步: ${i.type} - OK` }));
  
  let index = 0;
  
  setInterval(() => {
    const item = logs[Math.floor(Math.random() * logs.length)]; // 随机取一条展示
    const div = document.createElement('div');
    div.className = `log-item ${item.type === 'info' ? 'normal' : ''}`;
    const time = new Date().toLocaleTimeString('en-GB');
    div.innerHTML = `<span class="time">${time}</span><span class="msg">${item.msg}</span>`;
    
    container.prepend(div);
    if (container.children.length > 15) container.lastChild.remove(); // 保持列表长度
  }, 1500); // 每1.5秒滚动一次
}

// 排行榜渲染 (适配新UI)
function renderRanking(data) {
  const container = document.getElementById('rankingList');
  const sorted = [...data].sort((a, b) => b.stock - a.stock).slice(0, 100);
  
  if (sorted.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#555">NO DATA FOUND</div>';
    return;
  }

  container.innerHTML = sorted.map((item, index) => {
    const isLow = item.stock < 1000;
    return `
      <div class="rank-item">
        <div class="rank-num">#${index + 1}</div>
        <div class="spec-info">
          <div class="spec-main">${item.type}</div>
          <div class="spec-sub">${item.spec} <span style="color:#666">| ${item.material}</span></div>
        </div>
        <div class="stock-val ${isLow ? 'low' : ''}">${item.stock.toLocaleString()}</div>
      </div>
    `;
  }).join('');
}

// 其他辅助函数 (保持不变)
function renderSelect() {
  const select = document.getElementById('sheetSelect');
  const sheets = Object.keys(allData).sort();
  select.innerHTML = sheets.map(s => `<option value="${s}">${s}</option>`).join('');
  if (sheets.length > 0) { currentSheet = sheets[0]; renderDetailTable(allData[currentSheet]); }
}

function renderDetailTable(data) {
  const tbody = document.querySelector('#detailTable tbody');
  document.getElementById('itemCount').textContent = data.length;
  tbody.innerHTML = data.map(item => `
    <tr>
      <td>${item.seq}</td><td style="color:#fff">${item.type}</td><td style="color:var(--primary)">${item.spec}</td>
      <td>${item.material}</td><td style="font-weight:bold;color:${item.stock<1000?'var(--warning)':'#fff'}">${item.stock}</td><td>${item.unit}</td>
    </tr>
  `).join('');
}

function setupListeners() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) { renderRanking(flatData); return; }
    const filtered = flatData.filter(i => `${i.type} ${i.spec} ${i.material}`.toLowerCase().includes(val));
    renderRanking(filtered);
  });
  
  document.getElementById('sheetSelect').addEventListener('change', (e) => {
    currentSheet = e.target.value; renderDetailTable(allData[currentSheet]);
  });
  
  document.getElementById('detailSearch').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    renderDetailTable(allData[currentSheet].filter(i => i.spec.toLowerCase().includes(val)));
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      window.dispatchEvent(new Event('resize'));
    });
  });
}

function animateValue(id, end) {
  const obj = document.getElementById(id);
  obj.innerHTML = end.toLocaleString();
}
