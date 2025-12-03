/**
 * WebSocket event handlers
 * 网络套接字事件处理程序
 */

// WebSocket connection with auto-reconnect
// 自动重连的网络套接字连接
let socket = null;
let reconnectInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000; // 2秒重连间隔

// 创建WebSocket连接
function createWebSocketConnection() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(protocol + '//' + window.location.host + '/socket.io/');
    return ws;
}


// 连接网络套接字
function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        return; // 已连接或正在连接
    }
    
    socket = createWebSocketConnection();
    setupWebSocketHandlers();
}

// 设置WebSocket事件处理程序
function setupWebSocketHandlers() {
    if (!socket) return;
    
    socket.onopen = handleSocketOpen;
    socket.onmessage = handleSocketMessage;
    socket.onclose = handleSocketClose;
    socket.onerror = handleSocketError;
}

// 处理网络套接字打开事件
function handleSocketOpen() {
    console.log('Connected to server');
    reconnectAttempts = 0;
    clearInterval(reconnectInterval);
    reconnectInterval = null;
    
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.textContent = 'Connected';
        statusEl.style.color = '#43e97b';
    }
}

// 处理网络套接字关闭事件
function handleSocketClose() {
    console.log('Disconnected from server');
    
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.textContent = 'Reconnecting...';
        statusEl.style.color = '#ffc107';
    }
    
    // 尝试重新连接
    attemptReconnect();
}

// 处理网络套接字错误事件
function handleSocketError(error) {
    console.error('WebSocket error:', error);
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        statusEl.textContent = 'Connection Error';
        statusEl.style.color = '#f5576c';
    }
}

// 尝试重新连接函数
function attemptReconnect() {
    if (reconnectInterval) return; // 已经在尝试重新连接
    
    reconnectInterval = setInterval(() => {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            const statusEl = document.getElementById('connection-status');
            if (statusEl) {
                statusEl.textContent = 'Disconnected - Tap to Reload';
                statusEl.style.color = '#f5576c';
                statusEl.style.cursor = 'pointer';
                statusEl.onclick = () => location.reload();
            }
            return;
        }
        
        reconnectAttempts++;
        console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
        connectWebSocket();
    }, RECONNECT_DELAY);
}

+// 初始化连接
connectWebSocket();

// 性能优化：滚动检测以在滚动期间暂停 DOM 更新
let isScrolling = false;
let scrollTimeout;
const SCROLL_PAUSE_DURATION = 100; // 滚动停止后等待多少毫秒再恢复更新
    

/**
 * Setup scroll event listeners to detect when user is scrolling
 * Uses passive listeners for better performance
 * 设置滚动事件监听器以检测用户何时滚动
 * 使用被动监听器以获得更好的性能
 */
function setupScrollDetection() {
    const handleScroll = () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, SCROLL_PAUSE_DURATION);
    };
    
    // 等待DOM准备好
    setTimeout(() => {
        // 监听窗口滚动（主要滚动容器）
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // 作为备用，也监听.container
        const container = document.querySelector('.container');
        if (container) {
            container.addEventListener('scroll', handleScroll, { passive: true });
        }
    }, 500);
}

// 初始化滚动检测
setupScrollDetection();

// Performance: Batched rendering system using requestAnimationFrame
// 性能：使用requestAnimationFrame的批量渲染系统
// 将所有DOM更新批量处理到单个帧中，以最小化重排/重绘
    
let pendingUpdates = new Map(); // 待处理的GPU/系统更新队列
let rafScheduled = false; // 防止重复调度RAF的标志

// Performance: Throttle text updates (less critical than charts)
// 性能：节流文本更新（比图表更新不那么关键）
const lastDOMUpdate = {}; // 跟踪每个GPU的最后更新时间
const DOM_UPDATE_INTERVAL = 1000; // 文本/卡片每1秒更新一次，图表每帧更新一次

// Handle incoming GPU data
// 处理传入的GPU数据
function handleSocketMessage(event) {
    const data = JSON.parse(event.data);
    // Hub mode: different data structure with nodes
    // 集群模式：具有节点的不同数据结构
    if (data.mode === 'hub') {
        handleClusterData(data);
        return;
    }
    
    const overviewContainer = document.getElementById('overview-container');

    // Clear loading state
    // 清除加载状态
    if (overviewContainer.innerHTML.includes('Loading GPU data')) {
        overviewContainer.innerHTML = '';
    }

    const gpuCount = Object.keys(data.gpus).length;
    const now = Date.now();
    
    // Performance: Skip ALL DOM updates during active scrolling
    // 性能：在滚动期间跳过所有DOM更新
    if (isScrolling) {

        // 在滚动时仍然更新图表数据数组（轻量级）以保持连续性
        // 这确保滚动结束时没有数据间隙
        Object.keys(data.gpus).forEach(gpuId => {
            const gpuInfo = data.gpus[gpuId];
            if (!chartData[gpuId]) {
                initGPUData(gpuId, {
                    utilization: gpuInfo.utilization,
                    temperature: gpuInfo.temperature,
                    memory: (gpuInfo.memory_used / gpuInfo.memory_total) * 100,
                    power: gpuInfo.power_draw,
                    fanSpeed: gpuInfo.fan_speed,
                    clockGraphics: gpuInfo.clock_graphics,
                    clockSm: gpuInfo.clock_sm,
                    clockMemory: gpuInfo.clock_memory
                });
            }
            updateAllChartDataOnly(gpuId, gpuInfo);
        });
        return; 
        // 在滚动期间退出 - 零DOM工作=平滑的60 FPS
    }
    
    // Process each GPU - queue updates for batched rendering
    // 处理每个GPU - 为批量渲染排队更新
    Object.keys(data.gpus).forEach(gpuId => {
        const gpuInfo = data.gpus[gpuId];

        // Initialize chart data structures if first time seeing this GPU
        // 如果是第一次看到此GPU，则初始化图表数据结构
        if (!chartData[gpuId]) {
            initGPUData(gpuId, {
                utilization: gpuInfo.utilization,
                temperature: gpuInfo.temperature,
                memory: (gpuInfo.memory_used / gpuInfo.memory_total) * 100,
                power: gpuInfo.power_draw,
                fanSpeed: gpuInfo.fan_speed,
                clockGraphics: gpuInfo.clock_graphics,
                clockSm: gpuInfo.clock_sm,
                clockMemory: gpuInfo.clock_memory
            });
        }

        // Determine if text/card DOM should update (throttled) or just charts (every frame)
        // 确定是否应更新文本/卡片DOM（节流）或仅更新图表（每帧）
        const shouldUpdateDOM = !lastDOMUpdate[gpuId] || (now - lastDOMUpdate[gpuId]) >= DOM_UPDATE_INTERVAL;

        // Queue this GPU's update instead of executing immediately
        // 将此GPU的更新排队，而不是立即执行
        pendingUpdates.set(gpuId, {
            gpuInfo,
            shouldUpdateDOM,
            now
        });

        // Handle initial card creation (can't be batched since we need the DOM element)
        // 处理初始卡片创建（不能批量处理，因为我们需要DOM元素）
        const existingOverview = overviewContainer.querySelector(`[data-gpu-id="${gpuId}"]`);
        if (!existingOverview) {
            overviewContainer.insertAdjacentHTML('beforeend', createOverviewCard(gpuId, gpuInfo));
            initOverviewMiniChart(gpuId, gpuInfo.utilization);
            lastDOMUpdate[gpuId] = now;
        }
    });
    
    // Queue system updates (processes/CPU/RAM) for batching
    // 将系统更新（进程/CPU/RAM）排队以进行批处理
    if (!lastDOMUpdate.system || (now - lastDOMUpdate.system) >= DOM_UPDATE_INTERVAL) {
        pendingUpdates.set('_system', {
            processes: data.processes,
            system: data.system,
            now
        });
    }
    
    // Schedule single batched render (if not already scheduled)
    // This ensures all updates happen in ONE animation frame
    // 安排单个批量渲染（如果尚未安排）
    // 这确保所有更新都发生在一个动画帧中
    if (!rafScheduled && pendingUpdates.size > 0) {
        rafScheduled = true;
        requestAnimationFrame(processBatchedUpdates);
    }
    
    // Auto-switch to single GPU view if only 1 GPU detected (first time only)
    // 如果只检测到1个GPU，则自动切换到单GPU视图（仅限第一次）
    autoSwitchSingleGPU(gpuCount, Object.keys(data.gpus));
}

/**
 * Process all batched updates in a single animation frame
 * Called by requestAnimationFrame at optimal timing (~60 FPS)
 * 
 * Performance benefit: All DOM updates execute in ONE layout/paint cycle
 * instead of multiple cycles, eliminating layout thrashing
 */
function processBatchedUpdates() {
    rafScheduled = false;
    
    // Execute all queued updates in a single batch
    // 在单个批处理中执行所有排队的更新
    pendingUpdates.forEach((update, gpuId) => {
        if (gpuId === '_system') {
            // System updates (CPU, RAM, processes)
            // 系统更新（CPU，RAM，进程）
            updateProcesses(update.processes);
            updateSystemInfo(update.system);
            lastDOMUpdate.system = update.now;
        } else {
            // GPU updates
            // GPU更新
            const { gpuInfo, shouldUpdateDOM, now } = update;
            
            // Update overview card (always for charts, conditionally for text)
            // 更新概览卡（图表始终更新，文本有条件更新）
            updateOverviewCard(gpuId, gpuInfo, shouldUpdateDOM);
            if (shouldUpdateDOM) {
                lastDOMUpdate[gpuId] = now;
            }
            
            // Performance: Only update detail view if tab is visible
            // 性能：仅在选项卡可见时更新详细视图
            // Invisible tabs = zero wasted processing
            // 不可见的选项卡=零浪费处理
            const isDetailTabVisible = currentTab === `gpu-${gpuId}`;
            if (isDetailTabVisible || !registeredGPUs.has(gpuId)) {
                ensureGPUTab(gpuId, gpuInfo, shouldUpdateDOM && isDetailTabVisible);
            }
        }
    });
    
    // Clear queue for next batch
    // 清除队列以进行下一批处理
    pendingUpdates.clear();
}

/**
 * Update chart data arrays without triggering any rendering (used during scroll)
 * 
 * This maintains data continuity during scroll by collecting metrics
 * but skips expensive DOM/canvas updates for smooth 60 FPS scrolling
 * 
 * @param {string} gpuId - GPU identifier
 * @param {object} gpuInfo - GPU metrics data
 */
function updateAllChartDataOnly(gpuId, gpuInfo) {
    if (!chartData[gpuId]) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const memory_used = gpuInfo.memory_used || 0;
    const memory_total = gpuInfo.memory_total || 1;
    const memPercent = (memory_used / memory_total) * 100;
    const power_draw = gpuInfo.power_draw || 0;
    
    // Prepare all metric updates
    // 准备所有指标更新
    const metrics = {
        utilization: gpuInfo.utilization || 0,
        temperature: gpuInfo.temperature || 0,
        memory: memPercent,
        power: power_draw,
        fanSpeed: gpuInfo.fan_speed || 0,
        efficiency: power_draw > 0 ? (gpuInfo.utilization || 0) / power_draw : 0
    };
    
    // Update single-line charts
    // 更新单线图表
    Object.entries(metrics).forEach(([chartType, value]) => {
        const data = chartData[gpuId][chartType];
        if (!data?.labels || !data?.data) return;
        
        data.labels.push(timestamp);
        data.data.push(Number(value) || 0);
        
        // Add threshold lines for specific charts
        // 为特定图表添加阈值线
        if (chartType === 'utilization' && data.thresholdData) {
            data.thresholdData.push(80);
        } else if (chartType === 'temperature') {
            if (data.warningData) data.warningData.push(75);
            if (data.dangerData) data.dangerData.push(85);
        } else if (chartType === 'memory' && data.thresholdData) {
            data.thresholdData.push(90);
        }
        
        // Maintain rolling window (120 points = 60s at 0.5s interval)
        // 保持滚动窗口（120点=0.5秒间隔的60秒）
        if (data.labels.length > 120) {
            data.labels.shift();
            data.data.shift();
            if (data.thresholdData) data.thresholdData.shift();
            if (data.warningData) data.warningData.shift();
            if (data.dangerData) data.dangerData.shift();
        }
    });
    
    // Update multi-line charts (clocks)
    // 更新多线图表（时钟）
    const clocksData = chartData[gpuId].clocks;
    if (clocksData?.labels) {
        clocksData.labels.push(timestamp);
        clocksData.graphicsData.push(gpuInfo.clock_graphics || 0);
        clocksData.smData.push(gpuInfo.clock_sm || 0);
        clocksData.memoryData.push(gpuInfo.clock_memory || 0);
        
        if (clocksData.labels.length > 120) {
            clocksData.labels.shift();
            clocksData.graphicsData.shift();
            clocksData.smData.shift();
            clocksData.memoryData.shift();
        }
    }
}

// Handle page visibility changes (phone lock/unlock, tab switch)
// 处理页面可见性更改（手机锁定/解锁，选项卡切换）
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Page became visible (phone unlocked or tab switched back)
        // 页面变为可见（手机解锁或选项卡切换回来）
        console.log('Page visible - checking connection');
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            // Connection is closed, reconnect immediately
            // 连接已关闭，立即重新连接
            reconnectAttempts = 0;
            clearInterval(reconnectInterval);
            reconnectInterval = null;
            connectWebSocket();
        }
    }
});

// Also handle page focus (additional safety)
// 也处理页面聚焦（额外的安全措施）
window.addEventListener('focus', () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.log('Window focused - checking connection');
        reconnectAttempts = 0;
        clearInterval(reconnectInterval);
        reconnectInterval = null;
        connectWebSocket();
    }
});

/**
 * Handle cluster/hub mode data
 * Data structure: { mode: 'hub', nodes: {...}, cluster_stats: {...} }
 */
// 处理集群/集线器模式数据
// 数据结构：{ mode: 'hub', nodes: {...}, cluster_stats: {...} }
function handleClusterData(data) {
    const overviewContainer = document.getElementById('overview-container');
    const now = Date.now();
    
    // Clear loading state
    // 清除加载状态
    if (overviewContainer.innerHTML.includes('Loading GPU data')) {
        overviewContainer.innerHTML = '';
    }
    
    // Skip DOM updates during scrolling
    // 滚动时跳过DOM更新
    if (isScrolling) {
        // Still update chart data for continuity
        // 仍然更新图表数据以保持连续性
        Object.entries(data.nodes).forEach(([nodeName, nodeData]) => {
            if (nodeData.status === 'online') {
                Object.entries(nodeData.gpus).forEach(([gpuId, gpuInfo]) => {
                    const fullGpuId = `${nodeName}-${gpuId}`;
                    if (!chartData[fullGpuId]) {
                        initGPUData(fullGpuId, {
                            utilization: gpuInfo.utilization,
                            temperature: gpuInfo.temperature,
                            memory: (gpuInfo.memory_used / gpuInfo.memory_total) * 100,
                            power: gpuInfo.power_draw,
                            fanSpeed: gpuInfo.fan_speed,
                            clockGraphics: gpuInfo.clock_graphics,
                            clockSm: gpuInfo.clock_sm,
                            clockMemory: gpuInfo.clock_memory
                        });
                    }
                    updateAllChartDataOnly(fullGpuId, gpuInfo);
                });
            }
        });
        return;
    }
    
    // Render GPUs grouped by node (minimal grouping)
    // 按节点分组渲染GPU（最小分组）
    Object.entries(data.nodes).forEach(([nodeName, nodeData]) => {
        // Get or create node group container
        // 获取或创建节点组容器
        let nodeGroup = overviewContainer.querySelector(`[data-node="${nodeName}"]`);
        if (!nodeGroup) {
            overviewContainer.insertAdjacentHTML('beforeend', `
                <div class="node-group" data-node="${nodeName}">
                    <div class="node-label">${nodeName}</div>
                    <div class="node-grid"></div>
                </div>
            `);
            nodeGroup = overviewContainer.querySelector(`[data-node="${nodeName}"]`);
        }
        
        const nodeGrid = nodeGroup.querySelector('.node-grid');
        
        if (nodeData.status === 'online') {
            // Node is online - process its GPUs normally
            // 节点在线 - 正常处理其GPU
            Object.entries(nodeData.gpus).forEach(([gpuId, gpuInfo]) => {
                const fullGpuId = `${nodeName}-${gpuId}`;
                
                // Initialize chart data with current values
                // 使用当前值初始化图表数据
                if (!chartData[fullGpuId]) {
                    initGPUData(fullGpuId, {
                        utilization: gpuInfo.utilization,
                        temperature: gpuInfo.temperature,
                        memory: (gpuInfo.memory_used / gpuInfo.memory_total) * 100,
                        power: gpuInfo.power_draw,
                        fanSpeed: gpuInfo.fan_speed,
                        clockGraphics: gpuInfo.clock_graphics,
                        clockSm: gpuInfo.clock_sm,
                        clockMemory: gpuInfo.clock_memory
                    });
                }
                
                // Queue update
                // 排队更新
                const shouldUpdateDOM = !lastDOMUpdate[fullGpuId] || (now - lastDOMUpdate[fullGpuId]) >= DOM_UPDATE_INTERVAL;
                pendingUpdates.set(fullGpuId, {
                    gpuInfo,
                    shouldUpdateDOM,
                    now,
                    nodeName
                });
                
                // Create card if doesn't exist
                // 如果不存在则创建卡片
                const existingCard = nodeGrid.querySelector(`[data-gpu-id="${fullGpuId}"]`);
                if (!existingCard) {
                    nodeGrid.insertAdjacentHTML('beforeend', createClusterGPUCard(nodeName, gpuId, gpuInfo));
                    initOverviewMiniChart(fullGpuId, gpuInfo.utilization);
                    lastDOMUpdate[fullGpuId] = now;
                }
            });
        } else {
            // Node is offline - remove entire node group
            // 节点离线 - 删除整个节点组
            const existingCards = nodeGrid.querySelectorAll('[data-gpu-id]');
            existingCards.forEach(card => {
                const gpuId = card.getAttribute('data-gpu-id');
                // Clean up chart data
                // 清理图表数据
                if (chartData[gpuId]) {
                    delete chartData[gpuId];
                }
                if (lastDOMUpdate[gpuId]) {
                    delete lastDOMUpdate[gpuId];
                }
                // Remove the GPU tab
                // 删除GPU选项卡
                removeGPUTab(gpuId);
            });
            
            // Remove the entire node group from the UI
            // 从UI中删除整个节点组
            nodeGroup.remove();
        }
    });
    
    // Update processes and system info (use first online node)
    // 更新进程和系统信息（使用第一个在线节点）
    const firstOnlineNode = Object.values(data.nodes).find(n => n.status === 'online');
    if (firstOnlineNode) {
        if (!lastDOMUpdate.system || (now - lastDOMUpdate.system) >= DOM_UPDATE_INTERVAL) {
            pendingUpdates.set('_system', {
                processes: firstOnlineNode.processes || [],
                system: firstOnlineNode.system || {},
                now
            });
        }
    }
    
    // Schedule batched render
    // 安排批量渲染
    if (!rafScheduled && pendingUpdates.size > 0) {
        rafScheduled = true;
        requestAnimationFrame(processBatchedUpdates);
    }
}

/**
 * Create GPU card for cluster view (includes node name)
 * 为集群视图创建GPU卡（包括节点名称）
 */
function createClusterGPUCard(nodeName, gpuId, gpuInfo) {
    const fullGpuId = `${nodeName}-${gpuId}`;
    const memory_used = getMetricValue(gpuInfo, 'memory_used', 0);
    const memory_total = getMetricValue(gpuInfo, 'memory_total', 1);
    const memPercent = (memory_used / memory_total) * 100;

    return `
        <div class="overview-gpu-card" data-gpu-id="${fullGpuId}" onclick="switchToView('gpu-${fullGpuId}')" style="pointer-events: auto;">
            <div class="overview-header">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 700; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 0.25rem;">
                        GPU ${gpuId}
                    </h2>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${getMetricValue(gpuInfo, 'name', 'Unknown GPU')}</p>
                </div>
                <div class="gpu-status-badge">
                    <span class="status-dot"></span>
                    <span class="status-text">ONLINE</span>
                </div>
            </div>

            <div class="overview-metrics">
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-util-${fullGpuId}">${getMetricValue(gpuInfo, 'utilization', 0)}%</div>
                    <div class="overview-metric-label">GPU 使用率</div>
                </div>
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-temp-${fullGpuId}">${getMetricValue(gpuInfo, 'temperature', 0)}°C</div>
                    <div class="overview-metric-label">温度</div>
                </div>
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-mem-${fullGpuId}">${Math.round(memPercent)}%</div>
                    <div class="overview-metric-label">内存使用率</div>
                </div>
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-power-${fullGpuId}">${getMetricValue(gpuInfo, 'power_draw', 0).toFixed(0)}W</div>
                    <div class="overview-metric-label">功率消耗</div>
                </div>
            </div>

            <div class="overview-chart-section">
                <div class="overview-mini-chart">
                    <canvas id="overview-chart-${fullGpuId}"></canvas>
                </div>
            </div>
        </div>
    `;
}
