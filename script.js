// 全局变量
let workbook = null;
let allData = {};      // 按 Sheet 分类的原始数据
let flatData = [];     // 扁平化的所有数据（用于全局排行）
let currentSheet = ''; // 当前选中的 Sheet

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadExcel();
  setupTabs();
  setupListeners();
});

// 1. 加载 Excel 数据
async function loadExcel() {
  const loadingLayer = document.getElementById('loadingLayer');
  const filename = 'data.xlsx'; // 请确保你的文件名是这个
  
  try {
    // 加上时间戳防止缓存，但 Cloudflare 缓存可能较强，建议配合 ETags
    const response = await fetch(`${filename}?t=${new Date().getTime()}`);
    
    if (!response.ok) throw new Error("无法读取 data.xlsx");
    
    const arrayBuffer = await response.arrayBuffer();
    workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    processData();
    
    // 更新时间显示 (如果有 LastModified 头部则使用，否则使用当前时间)
    const lastMod = response.headers.get('Last-Modified');
    const updateTime = lastMod ? new Date(lastMod).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN');
    document.getElementById('updateTime').textContent = `数据更新: ${updateTime}`;
    
    // 关闭 Loading
    loadingLayer.style.opacity = '0';
    setTimeout(() => loadingLayer.style.display = 'none', 500);

  } catch (error) {
    loadingLayer.innerHTML = `<div style="color:#ff4757;text-align:center"><h3>数据加载失败</h3><p>请确保 data.xlsx 已上传到仓库根目录。</p><p>${error.message}</p></div>`;
  }
}

// 2. 数据处理核心逻辑
function processData() {
  allData = {};
  flatData = [];
  let totalStock = 0, totalItems = 0, activeTypes = 0, lowStock = 0;
  
  const chartCategories = {};

  workbook.SheetNames.forEach(sheetName => {
    // 过滤掉不需要的 Sheet
    if (['总汇', 'Sheet1'].some(n => sheetName.includes(n)) || sheetName.includes('空白')) return;

    const worksheet = workbook.Sheets[sheetName];
    // 使用 SheetJS 的工具转 JSON，从第4行开始（根据你之前的逻辑）
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    const sheetItems = [];
    
    // 遍历行 (假设数据从第4行开始，即索引4)
    for (let i = 4; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row[2]) continue; // 没有规格名称则跳过

      // 智能识别库存列：尝试第 6, 7, 5 列
      const stock = parseInt(row[6]) || parseInt(row[7]) || parseInt(row[5]) || 0;
      
      const item = {
        sheet: sheetName,
        seq: row[0] || '',
        type: (row[1] || sheetName).toString().trim(),
        spec: row[2].toString().trim(),
        material: (row[3] || '').toString().trim(),
        stock: stock,
        unit: row[5] || 'pcs'
      };

      sheetItems.push(item);
      
      if (stock > 0) {
        flatData.push(item);
        totalStock += stock;
        totalItems++; // 这是一个 SKU
        
        // 低库存统计
        if (stock < 1000) lowStock++; // 阈值可调整

        // 图表数据聚合
        const catKey = item.type || sheetName;
        chartCategories[catKey] = (chartCategories[catKey] || 0) + stock;
      }
    }

    if (sheetItems.length > 0) {
      allData[sheetName] = sheetItems;
    }
  });

  // 更新总览面板
  animateValue("totalStock", totalStock);
  animateValue("totalItems", totalItems);
  document.getElementById("totalTypes").textContent = Object.keys(allData).length;
  document.getElementById("lowStockCount").textContent = lowStock;

  // 渲染图表
  renderCharts(chartCategories, flatData);
  
  // 渲染初始排行榜 (Top 100)
  renderRanking(flatData);

  // 渲染下拉菜单
  renderSelect();
}

// 3. 渲染图表 (ECharts)
function renderCharts(pieDataMap, listData) {
  // 饼图
  const pieData = Object.keys(pieDataMap)
    .map(k => ({ name: k, value: pieDataMap[k] }))
    .sort((a,b) => b.value - a.value); // 排序

  const pieChart = echarts.init(document.getElementById('pieChart'));
  pieChart.setOption({
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#94a3b8' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      itemStyle: { borderRadius: 5, borderColor: '#161824', borderWidth: 2 },
      data: pieData
    }]
  });

  // 柱状图 (Top 15)
  const top15 = [...listData].sort((a,b) => b.stock - a.stock).slice(0, 15);
  const barChart = echarts.init(document.getElementById('barChart'));
  barChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#2d3748' } }, axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'category', data: top15.map(i => i.spec.length > 15 ? i.spec.substring(0,15)+'..' : i.spec), axisLabel: { color: '#94a3b8' } },
    series: [{
      type: 'bar',
      data: top15.map(i => ({ value: i.stock, itemStyle: { color: i.stock < 1000 ? '#ff4757' : '#00d4ff' } })),
      label: { show: true, position: 'right', color: '#fff' }
    }]
  });

  // 窗口大小改变时重绘
  window.addEventListener('resize', () => {
    pieChart.resize();
    barChart.resize();
  });
}

// 4. 渲染排行榜 (支持搜索高亮)
function renderRanking(data) {
  const container = document.getElementById('rankingList');
  // 默认按库存降序
  const sorted = [...data].sort((a, b) => b.stock - a.stock).slice(0, 100); // 性能优化：只展示前100

  if (sorted.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#666">未找到相关数据</div>';
    return;
  }

  container.innerHTML = sorted.map((item, index) => {
    const isLow = item.stock < 1000;
    return `
      <div class="rank-item">
        <div class="rank-num">${index + 1}</div>
        <div class="info-col">
          <div style="font-weight:bold">${item.type}</div>
          <div class="mat-text" style="font-size:0.85em;color:#666">${item.material || '-'}</div>
        </div>
        <div class="spec-text">${item.spec}</div>
        <div class="mat-text-pc" style="color:#aaa">${item.material || '-'}</div>
        <div>
          <span class="stock-badge ${isLow ? 'low' : ''}">${item.stock.toLocaleString()}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // 手机端隐藏多余列通过 CSS 控制
}

// 5. 渲染明细表格
function renderDetailTable(data) {
  const tbody = document.querySelector('#detailTable tbody');
  document.getElementById('itemCount').textContent = data.length;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">无数据</td></tr>';
    return;
  }

  // 性能优化：构建 HTML 字符串一次性插入
  const rows = data.map(item => `
    <tr>
      <td>${item.seq}</td>
      <td>${item.type}</td>
      <td style="color:var(--primary)">${item.spec}</td>
      <td>${item.material || '-'}</td>
      <td style="font-weight:bold;color:${item.stock<1000?'var(--danger)':'var(--success)'}">${item.stock.toLocaleString()}</td>
      <td>${item.unit}</td>
    </tr>
  `).join('');
  
  tbody.innerHTML = rows;
}

// 6. 交互逻辑
function setupListeners() {
  // 全局搜索 (支持多词空格)
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    if (!val) {
      renderRanking(flatData);
      return;
    }
    const keywords = val.split(/\s+/); // 按空格拆分
    
    const filtered = flatData.filter(item => {
      const str = `${item.type} ${item.spec} ${item.material}`.toLowerCase();
      // 所有关键词都必须匹配
      return keywords.every(k => str.includes(k));
    });
    
    renderRanking(filtered);
  });

  // 明细面板 Sheet 切换
  const sheetSelect = document.getElementById('sheetSelect');
  sheetSelect.addEventListener('change', (e) => {
    currentSheet = e.target.value;
    const data = allData[currentSheet] || [];
    renderDetailTable(data);
    document.getElementById('detailSearch').value = ''; // 清空搜索
  });

  // 明细页内筛选
  document.getElementById('detailSearch').addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase();
    const sourceData = allData[currentSheet] || [];
    const filtered = sourceData.filter(item => 
      item.spec.toLowerCase().includes(val) || item.seq.toString().includes(val)
    );
    renderDetailTable(filtered);
  });
  
  // 导出功能
  document.getElementById('exportBtn').onclick = () => exportToCSV(flatData, '总库存导出.csv');
  document.getElementById('detailExportBtn').onclick = () => {
    const currentData = allData[currentSheet] || [];
    exportToCSV(currentData, `${currentSheet}-库存明细.csv`);
  };
}

function renderSelect() {
  const select = document.getElementById('sheetSelect');
  const sheets = Object.keys(allData).sort();
  select.innerHTML = sheets.map(s => `<option value="${s}">${s} (${allData[s].length})</option>`).join('');
  
  // 默认选中第一个
  if (sheets.length > 0) {
    currentSheet = sheets[0];
    renderDetailTable(allData[currentSheet]);
  }
}

// 通用 Tabs 切换
function setupTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const target = btn.dataset.tab;
      document.getElementById(target).classList.add('active');
      
      // 如果切换回图表页，可能需要resize
      if(target === 'overview') {
        window.dispatchEvent(new Event('resize'));
      }
    });
  });
}

// 辅助：数字滚动动画
function animateValue(id, end) {
  const obj = document.getElementById(id);
  const duration = 1000;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * end).toLocaleString();
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// 辅助：导出 CSV
function exportToCSV(data, filename) {
  const headers = ['序号', '型号', '规格', '材质', '库存', '单位'];
  const csvContent = [
    headers.join(','),
    ...data.map(i => `${i.seq},${i.type},${i.spec},${i.material || ''},${i.stock},${i.unit}`)
  ].join('\n');
  
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
