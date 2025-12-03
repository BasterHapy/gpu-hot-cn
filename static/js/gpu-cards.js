/**
 * GPU Card creation and update functions
 * GPU卡片创建和更新函数
 */

// Create overview GPU card (compact view)
// 创建概览 GPU 卡片（紧凑视图）
function createOverviewCard(gpuId, gpuInfo) {
    const memory_used = getMetricValue(gpuInfo, 'memory_used', 0);
    const memory_total = getMetricValue(gpuInfo, 'memory_total', 1);
    const memPercent = (memory_used / memory_total) * 100;

    return `
        <div class="overview-gpu-card" data-gpu-id="${gpuId}" onclick="switchToView('gpu-${gpuId}')" style="pointer-events: auto;">
            <div class="overview-header">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 700; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 0.25rem;">
                        GPU ${gpuId}
                    </h2>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">${getMetricValue(gpuInfo, 'name', 'Unknown GPU')}</p>
                </div>
                <div class="gpu-status-badge">
                    <span class="status-dot"></span>
                    <span class="status-text">在线</span>
                </div>
            </div>

            <div class="overview-metrics">
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-util-${gpuId}">${getMetricValue(gpuInfo, 'utilization', 0)}%</div>
                    <div class="overview-metric-label">GPU 使用率</div>
                </div>
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-temp-${gpuId}">${getMetricValue(gpuInfo, 'temperature', 0)}°C</div>
                    <div class="overview-metric-label">温度</div>
                </div>
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-mem-${gpuId}">${Math.round(memPercent)}%</div>
                    <div class="overview-metric-label">内存</div>
                </div>
                <div class="overview-metric">
                    <div class="overview-metric-value" id="overview-power-${gpuId}">${getMetricValue(gpuInfo, 'power_draw', 0).toFixed(0)}W</div>
                    <div class="overview-metric-label">功率消耗</div>
                </div>
            </div>

            <div class="overview-chart-section">
                <div class="overview-mini-chart">
                    <canvas id="overview-chart-${gpuId}"></canvas>
                </div>
            </div>
        </div>
    `;
}

// Update overview card (throttled for DOM updates, always updates charts)
// 更新概览卡片（节流以减少 DOM 更新，但始终更新图表）
function updateOverviewCard(gpuId, gpuInfo, shouldUpdateDOM = true) {
    const memory_used = getMetricValue(gpuInfo, 'memory_used', 0);
    const memory_total = getMetricValue(gpuInfo, 'memory_total', 1);
    const memPercent = (memory_used / memory_total) * 100;

    // Only update DOM text when throttle allows
    // 仅在节流允许时更新 DOM 文本
    if (shouldUpdateDOM) {
        const utilEl = document.getElementById(`overview-util-${gpuId}`);
        const tempEl = document.getElementById(`overview-temp-${gpuId}`);
        const memEl = document.getElementById(`overview-mem-${gpuId}`);
        const powerEl = document.getElementById(`overview-power-${gpuId}`);

        if (utilEl) utilEl.textContent = `${getMetricValue(gpuInfo, 'utilization', 0)}%`;
        if (tempEl) tempEl.textContent = `${getMetricValue(gpuInfo, 'temperature', 0)}°C`;
        if (memEl) memEl.textContent = `${Math.round(memPercent)}%`;
        if (powerEl) powerEl.textContent = `${getMetricValue(gpuInfo, 'power_draw', 0).toFixed(0)}W`;
    }

    // ALWAYS update chart data for the mini chart (smooth animations)
    // 始终更新迷你图表数据（平滑动画）
    updateChart(gpuId, 'utilization', Number(getMetricValue(gpuInfo, 'utilization', 0)));

    // Update mini chart
    // 更新迷你图表
    if (charts[gpuId] && charts[gpuId].overviewMini) {
        charts[gpuId].overviewMini.update('none');
    }
}

// 创建详细的 GPU 卡片 HTML（用于单独的标签）
function createGPUCard(gpuId, gpuInfo) {
    const memory_used = getMetricValue(gpuInfo, 'memory_used', 0);
    const memory_total = getMetricValue(gpuInfo, 'memory_total', 1);
    const power_draw = getMetricValue(gpuInfo, 'power_draw', 0);
    const power_limit = getMetricValue(gpuInfo, 'power_limit', 1);
    const memPercent = (memory_used / memory_total) * 100;
    const powerPercent = (power_draw / power_limit) * 100;

    return `
        <div class="gpu-card" id="gpu-${gpuId}">
            <div class="gpu-header-enhanced">
                <div class="gpu-info-section">
                    <div class="gpu-title-large">GPU ${gpuId}</div>
                    <div class="gpu-name">${gpuInfo.name}</div>
                    <div class="gpu-specs">
                        <span class="spec-item">
                            <span id="fan-${gpuId}">${gpuInfo.fan_speed}%</span> 风扇
                        </span>
                        <span class="spec-item">
                            <span id="pstate-header-${gpuId}">${gpuInfo.performance_state || 'N/A'}</span>
                        </span>
                        <span class="spec-item">
                            PCIe Gen <span id="pcie-header-${gpuId}">${gpuInfo.pcie_gen || 'N/A'}</span>
                        </span>
                        <span class="spec-item">
                            Driver ${gpuInfo.driver_version || 'N/A'}
                        </span>
                        <span class="spec-item spec-mode">
                            ${gpuInfo._fallback_mode ? 'nvidia-smi' : 'NVML'}
                        </span>
                    </div>
                </div>
                <div class="gpu-status-badge">
                    <span class="status-dot"></span>
                    <span class="status-text">在线</span>
                </div>
            </div>

            <div class="metrics-grid-enhanced">
                <div class="metric-card metric-card-featured">
                    <canvas class="util-background-chart" id="util-bg-chart-${gpuId}"></canvas>
                    <div class="metric-header">
                        <span class="metric-label">GPU 利用率</span>
                    </div>
                    <div class="circular-progress-container">
                        <svg class="circular-progress" viewBox="0 0 120 120">
                            <defs>
                                <linearGradient id="util-gradient-${gpuId}" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" />
                                    <stop offset="100%" style="stop-color:#1e3a8a;stop-opacity:1" />
                                </linearGradient>
                            </defs>
                            <circle class="progress-ring-bg" cx="60" cy="60" r="50"/>
                            <circle class="progress-ring" id="util-ring-${gpuId}" cx="60" cy="60" r="50"
                                stroke="url(#util-gradient-${gpuId})"
                                style="stroke-dashoffset: ${314 - (314 * gpuInfo.utilization / 100)}"/>
                            <text x="60" y="60" class="progress-text" id="util-text-${gpuId}">${gpuInfo.utilization}%</text>
                        </svg>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="util-bar-${gpuId}" style="width: ${gpuInfo.utilization}%"></div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">温度</span>
                    </div>
                    <div class="temp-display">
                        <div class="metric-value-large" id="temp-${gpuId}">${gpuInfo.temperature}°C</div>
                        <div class="temp-gauge"></div>
                        <div class="temp-status" id="temp-status-${gpuId}">
                            ${gpuInfo.temperature < 60 ? '冷' : gpuInfo.temperature < 75 ? '正常' : '热'}
                        </div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">内存使用率</span>
                    </div>
                    <div class="metric-value-large" id="mem-${gpuId}">${formatMemory(gpuInfo.memory_used)}</div>
                    <div class="metric-sublabel" id="mem-total-${gpuId}">共 ${formatMemory(gpuInfo.memory_total)}</div>
                    <div class="progress-bar">
                        <div class="progress-fill mem-bar" id="mem-bar-${gpuId}" style="width: ${memPercent}%"></div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">功率消耗</span>
                    </div>
                    <div class="metric-value-large" id="power-${gpuId}">${gpuInfo.power_draw.toFixed(1)}W</div>
                    <div class="metric-sublabel" id="power-limit-${gpuId}">共 ${gpuInfo.power_limit.toFixed(0)}W</div>
                    <div class="progress-bar">
                        <div class="progress-fill power-bar" id="power-bar-${gpuId}" style="width: ${powerPercent}%"></div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">图形时钟</span>
                    </div>
                    <div class="metric-value-large" id="clock-gr-${gpuId}">${gpuInfo.clock_graphics || 0}</div>
                    <div class="metric-sublabel">MHz</div>
                </div}
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">内存时钟</span>
                    </div>
                    <div class="metric-value-large" id="clock-mem-${gpuId}">${gpuInfo.clock_memory || 0}</div>
                    <div class="metric-sublabel">MHz</div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Memory Utilization</span>
                    </div>
                    <div class="metric-value-large" id="mem-util-${gpuId}">${gpuInfo.memory_utilization || 0}%</div>
                    <div class="metric-sublabel">Controller Usage</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="mem-util-bar-${gpuId}" style="width: ${gpuInfo.memory_utilization || 0}%"></div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">PCIe 链接</span>
                    </div>
                    <div class="metric-value-large" id="pcie-${gpuId}">Gen ${gpuInfo.pcie_gen || 'N/A'}</div>
                    <div class="metric-sublabel">x${gpuInfo.pcie_width || 'N/A'} 条通道</div>
                </div}
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">性能状态</span>
                    </div>
                    <div class="metric-value-large" id="pstate-${gpuId}">${gpuInfo.performance_state || 'N/A'}</div>
                    <div class="metric-sublabel">电源模式</div>
                </div}
                ${hasMetric(gpuInfo, 'encoder_sessions') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">编码器会话</span>
                    </div>
                    <div class="metric-value-large" id="encoder-${gpuId}">${gpuInfo.encoder_sessions}</div>
                    <div class="metric-sublabel">${(gpuInfo.encoder_fps || 0).toFixed(1)} 平均FPS </div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'clock_sm') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">SM 时钟</span>
                    </div>
                    <div class="metric-value-large" id="clock-sm-${gpuId}">${gpuInfo.clock_sm}</div>
                    <div class="metric-sublabel">MHz${gpuInfo.clock_sm_max ? ` / ${gpuInfo.clock_sm_max} Max` : ''}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'temperature_memory') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">内存温度</span>
                    </div>
                    <div class="metric-value-large" id="temp-mem-${gpuId}">${gpuInfo.temperature_memory}°C</div>
                    <div class="metric-sublabel">VRAM 温度</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'memory_free') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">可用内存</span>
                    </div>
                    <div class="metric-value-large" id="mem-free-${gpuId}">${formatMemory(gpuInfo.memory_free)}</div>
                    <div class="metric-sublabel">可用 VRAM</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'decoder_sessions') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Decoder Sessions</span>
                    </div>
                    <div class="metric-value-large" id="decoder-${gpuId}">${gpuInfo.decoder_sessions}</div>
                    <div class="metric-sublabel">${(gpuInfo.decoder_fps || 0).toFixed(1)} FPS avg</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'clock_video') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">Video Clock</span>
                    </div>
                    <div class="metric-value-large" id="clock-video-${gpuId}">${gpuInfo.clock_video}</div>
                    <div class="metric-sublabel">MHz</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'compute_mode') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">计算模式</span>
                    </div>
                    <div class="metric-value-large" id="compute-mode-${gpuId}" style="font-size: 1.5rem;">${gpuInfo.compute_mode}</div>
                    <div class="metric-sublabel">执行模式</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'pcie_gen_max') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">最大 PCIe</span>
                    </div>
                    <div class="metric-value-large" id="pcie-max-${gpuId}">Gen ${gpuInfo.pcie_gen_max}</div>
                    <div class="metric-sublabel">x${gpuInfo.pcie_width_max || 'N/A'} 最大</div>
                </div>` : ''}

                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">节流状态</span>
                    </div>
                    <div class="metric-value-large" id="throttle-${gpuId}" style="font-size: 1.2rem;">${gpuInfo.throttle_reasons === 'Active' || gpuInfo.throttle_reasons !== 'None' ? 'Active' : 'None'}</div>
                    <div class="metric-sublabel">性能</div>
                </div>

                ${hasMetric(gpuInfo, 'energy_consumption_wh') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">总能量</span>
                    </div>
                    <div class="metric-value-large" id="energy-${gpuId}">${formatEnergy(gpuInfo.energy_consumption_wh)}</div>
                    <div class="metric-sublabel">自驱动加载以来</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'brand') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">品牌 / 架构</span>
                    </div>
                    <div class="metric-value-large" id="brand-${gpuId}" style="font-size: 1.3rem;">${gpuInfo.brand}</div>
                    <div class="metric-sublabel">${gpuInfo.architecture || '未知'}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'power_limit_min') && hasMetric(gpuInfo, 'power_limit_max') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">功率范围</span>
                    </div>
                    <div class="metric-value-large" id="power-range-${gpuId}" style="font-size: 1.3rem;">${gpuInfo.power_limit_min.toFixed(0)}W - ${gpuInfo.power_limit_max.toFixed(0)}W</div>
                    <div class="metric-sublabel">最小 / 最大限制</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'clock_graphics_app') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">目标图形时钟</span>
                    </div>
                    <div class="metric-value-large" id="clock-gr-app-${gpuId}">${gpuInfo.clock_graphics_app}</div>
                    <div class="metric-sublabel">MHz${gpuInfo.clock_graphics_default ? ` / ${gpuInfo.clock_graphics_default} 默认` : ''}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'clock_memory_app') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">目标内存时钟</span>
                    </div>
                    <div class="metric-value-large" id="clock-mem-app-${gpuId}">${gpuInfo.clock_memory_app}</div>
                    <div class="metric-sublabel">MHz${gpuInfo.clock_memory_default ? ` / ${gpuInfo.clock_memory_default} 默认` : ''}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'pcie_rx_throughput') || hasMetric(gpuInfo, 'pcie_tx_throughput') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">PCIe 吞吐量</span>
                    </div>
                    <div class="metric-value-large" id="pcie-throughput-${gpuId}" style="font-size: 1.3rem;">↓${(gpuInfo.pcie_rx_throughput || 0).toFixed(0)} KB/s</div>
                    <div class="metric-sublabel">↑${(gpuInfo.pcie_tx_throughput || 0).toFixed(0)} KB/s</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'bar1_memory_used') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">BAR1 内存</span>
                    </div>
                    <div class="metric-value-large" id="bar1-mem-${gpuId}">${formatMemory(gpuInfo.bar1_memory_used)}</div>
                    <div class="metric-sublabel">共 ${formatMemory(gpuInfo.bar1_memory_total || 0)}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'persistence_mode') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">持久模式</span>
                    </div>
                    <div class="metric-value-large" id="persistence-${gpuId}" style="font-size: 1.3rem;">${gpuInfo.persistence_mode}</div>
                    <div class="metric-sublabel">${gpuInfo.display_active ? '显示活动' : '无头'}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'reset_required') || hasMetric(gpuInfo, 'multi_gpu_board') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">GPU 状态</span>
                    </div>
                    <div class="metric-value-large" id="reset-required-${gpuId}" style="font-size: 1.3rem; color: ${gpuInfo.reset_required ? '#ff4444' : '#00ff88'};">${gpuInfo.reset_required ? '需要重置!' : '健康'}</div>
                    <div class="metric-sublabel">${gpuInfo.multi_gpu_board ? '多GPU' : '单GPU'}</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'nvlink_active_count') && gpuInfo.nvlink_active_count > 0 ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">NVLink 状态</span>
                    </div>
                    <div class="metric-value-large" id="nvlink-${gpuId}">${gpuInfo.nvlink_active_count}</div>
                    <div class="metric-sublabel">活动链接</div>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'compute_processes_count') || hasMetric(gpuInfo, 'graphics_processes_count') ? `
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-label">进程计数</span>
                    </div>
                    <div class="metric-value-large" id="process-counts-${gpuId}" style="font-size: 1.3rem;">C:${gpuInfo.compute_processes_count || 0} G:${gpuInfo.graphics_processes_count || 0}</div>
                    <div class="metric-sublabel">计算 / 图形</div>
                </div>` : ''}
            </div>

            <div class="charts-section">
                <div class="chart-container">
                    <div class="chart-header" data-value="0%">
                        <div class="chart-title">Utilization</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-utilization-current-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-utilization-min-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-utilization-max-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-utilization-avg-${gpuId}">0%</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-utilization-${gpuId}"></canvas>
                </div>

                <div class="chart-container">
                    <div class="chart-header" data-value="0°C">
                        <div class="chart-title">温度</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-temperature-current-${gpuId}">0°C</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-temperature-min-${gpuId}">0°C</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-temperature-max-${gpuId}">0°C</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-temperature-avg-${gpuId}">0°C</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-temperature-${gpuId}"></canvas>
                </div>

                <div class="chart-container">
                    <div class="chart-header" data-value="0%">
                        <div class="chart-title">内存</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-memory-current-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-memory-min-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-memory-max-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-memory-avg-${gpuId}">0%</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-memory-${gpuId}"></canvas>
                </div>

                <div class="chart-container">
                    <div class="chart-header" data-value="0W">
                        <div class="chart-title">Power</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-power-current-${gpuId}">0W</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-power-min-${gpuId}">0W</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-power-max-${gpuId}">0W</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-power-avg-${gpuId}">0W</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-power-${gpuId}"></canvas>
                </div>

                <div class="chart-container">
                    <div class="chart-header" data-value="0%">
                        <div class="chart-title">风扇速度</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-fanSpeed-current-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-fanSpeed-min-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-fanSpeed-max-${gpuId}">0%</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-fanSpeed-avg-${gpuId}">0%</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-fanSpeed-${gpuId}"></canvas>
                </div>

                <div class="chart-container">
                    <div class="chart-header" data-value="0 MHz">
                        <div class="chart-title">时钟</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-clocks-current-${gpuId}">0 MHz</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-clocks-min-${gpuId}">0 MHz</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-clocks-max-${gpuId}">0 MHz</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-clocks-avg-${gpuId}">0 MHz</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-clocks-${gpuId}"></canvas>
                </div>

                <div class="chart-container">
                    <div class="chart-header" data-value="0 %/W">
                        <div class="chart-title">Efficiency</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前</span>
                                <span class="chart-stat-value current" id="stat-efficiency-current-${gpuId}">0 %/W</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最小</span>
                                <span class="chart-stat-value min" id="stat-efficiency-min-${gpuId}">0 %/W</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大</span>
                                <span class="chart-stat-value max" id="stat-efficiency-max-${gpuId}">0 %/W</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">平均</span>
                                <span class="chart-stat-value avg" id="stat-efficiency-avg-${gpuId}">0 %/W</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-efficiency-${gpuId}"></canvas>
                </div>


                ${hasMetric(gpuInfo, 'pcie_rx_throughput') || hasMetric(gpuInfo, 'pcie_tx_throughput') ? `
                <div class="chart-container">
                    <div class="chart-header" data-value="0 KB/s">
                        <div class="chart-title">PCIe</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前 RX</span>
                                <span class="chart-stat-value current" id="stat-pcie-rx-current-${gpuId}">0 KB/s</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">当前 TX</span>
                                <span class="chart-stat-value current" id="stat-pcie-tx-current-${gpuId}">0 KB/s</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大 RX</span>
                                <span class="chart-stat-value max" id="stat-pcie-rx-max-${gpuId}">0 KB/s</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">最大 TX</span>
                                <span class="chart-stat-value max" id="stat-pcie-tx-max-${gpuId}">0 KB/s</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-pcie-${gpuId}"></canvas>
                </div>` : ''}

                ${hasMetric(gpuInfo, 'clock_graphics_app') || hasMetric(gpuInfo, 'clock_memory_app') ? `
                <div class="chart-container">
                    <div class="chart-header" data-value="0 MHz">
                        <div class="chart-title">应用时钟</div>
                        <div class="chart-stats">
                            <div class="chart-stat">
                                <span class="chart-stat-label">图形</span>
                                <span class="chart-stat-value current" id="stat-app-clock-gr-${gpuId}">0 MHz</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">内存</span>
                                <span class="chart-stat-value current" id="stat-app-clock-mem-${gpuId}">0 MHz</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">SM</span>
                                <span class="chart-stat-value current" id="stat-app-clock-sm-${gpuId}">0 MHz</span>
                            </div>
                            <div class="chart-stat">
                                <span class="chart-stat-label">视频</span>
                                <span class="chart-stat-value current" id="stat-app-clock-video-${gpuId}">0 MHz</span>
                            </div>
                        </div>
                    </div>
                    <canvas id="chart-appclocks-${gpuId}"></canvas>
                </div>` : ''}
            </div>
        </div>
    `;
}

// Helper function to format memory values
// 帮助函数格式化内存值 (MB 转 GB 当适用)
function formatMemory(mb) {
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(1)}GB`;
    }
    return `${Math.round(mb)}MB`;
}

// Helper function to format energy values (Wh to kWh when appropriate)
// 帮助函数格式化能量值 (Wh 转 kWh 当适用)
function formatEnergy(wh) {
    if (wh >= 1000) {
        return `${(wh / 1000).toFixed(2)}kWh`;
    }
    return `${wh.toFixed(2)}Wh`;
}

// Helper function to safely get metric value with default
// 帮助函数安全获取指标值，带默认值
function getMetricValue(gpuInfo, key, defaultValue = 0) {
    return (key in gpuInfo && gpuInfo[key] !== null && gpuInfo[key] !== undefined) ? gpuInfo[key] : defaultValue;
}

// Helper function to check if a metric is available (not null, undefined, or 'N/A')
// 帮助函数检查指标是否可用（非 null、undefined 或 'N/A'）
function hasMetric(gpuInfo, key) {
    const value = gpuInfo[key];
    return value !== null && value !== undefined && value !== 'N/A' && value !== 'Unknown' && value !== '';
}

// Helper function to create metric card HTML (returns empty string if not available)
// 帮助函数创建指标卡片 HTML（如果不可用则返回空字符串）
function createMetricCard(label, valueId, value, sublabel, gpuId, options = {}) {
    // Don't create card if value is not available and hideIfEmpty is true
    // 如果值不可用且 hideIfEmpty 为真，则不创建卡片
    if (options.hideIfEmpty && (!value || value === 'N/A' || value === 0 || value === '0')) {
        return '';
    }
    
    const progressBar = options.progressBar ? `
        <div class="progress-bar">
            <div class="progress-fill ${options.progressClass || ''}" id="${valueId}-bar" style="width: ${options.progressWidth || 0}%"></div>
        </div>
    ` : '';
    
    return `
        <div class="metric-card" data-metric="${valueId}">
            <div class="metric-header">
                <span class="metric-label">${label}</span>
            </div>
            <div class="metric-value-large" id="${valueId}" style="${options.style || ''}">${value}</div>
            <div class="metric-sublabel">${sublabel}</div>
            ${progressBar}
        </div>
    `;
}

// Update GPU display
// 更新 GPU 显示
function updateGPUDisplay(gpuId, gpuInfo, shouldUpdateDOM = true) {
    // Extract metric values
    // 提取指标值
    const utilization = getMetricValue(gpuInfo, 'utilization', 0);
    const temperature = getMetricValue(gpuInfo, 'temperature', 0);
    const memory_used = getMetricValue(gpuInfo, 'memory_used', 0);
    const memory_total = getMetricValue(gpuInfo, 'memory_total', 1);
    const power_draw = getMetricValue(gpuInfo, 'power_draw', 0);
    const power_limit = getMetricValue(gpuInfo, 'power_limit', 1);
    const fan_speed = getMetricValue(gpuInfo, 'fan_speed', 0);

    // Only update DOM text elements if throttle allows (reduce DOM thrashing during scroll)
    // 仅当节流允许时更新 DOM 文本元素（减少滚动时的 DOM 抖动）
    if (shouldUpdateDOM) {
        // Update metric values
        // 更新指标值
        const utilEl = document.getElementById(`util-${gpuId}`);
        const tempEl = document.getElementById(`temp-${gpuId}`);
        const memEl = document.getElementById(`mem-${gpuId}`);
        const powerEl = document.getElementById(`power-${gpuId}`);
        const fanEl = document.getElementById(`fan-${gpuId}`);

        if (utilEl) utilEl.textContent = `${utilization}%`;
        if (tempEl) tempEl.textContent = `${temperature}°C`;
        if (memEl) memEl.textContent = formatMemory(memory_used);
        if (powerEl) powerEl.textContent = `${power_draw.toFixed(1)}W`;
        if (fanEl) fanEl.textContent = `${fan_speed}%`;

        // Update temperature status
        // 更新温度状态
        const tempStatus = document.getElementById(`temp-status-${gpuId}`);
        if (tempStatus) {
            if (temperature < 60) {
                tempStatus.textContent = 'Cool';
            } else if (temperature < 75) {
                tempStatus.textContent = 'Normal';
            } else {
                tempStatus.textContent = 'Warm';
            }
        }

        // 更新圆形仪表盘
        const utilRing = document.getElementById(`util-ring-${gpuId}`);
        const utilText = document.getElementById(`util-text-${gpuId}`);
        if (utilRing) {
            const offset = 314 - (314 * utilization / 100);
            utilRing.style.strokeDashoffset = offset;
        }
        if (utilText) utilText.textContent = `${utilization}%`;

        // 更新进度条
        const utilBar = document.getElementById(`util-bar-${gpuId}`);
        const memBar = document.getElementById(`mem-bar-${gpuId}`);
        const powerBar = document.getElementById(`power-bar-${gpuId}`);

        const memPercent = (memory_used / memory_total) * 100;
        const powerPercent = (power_draw / power_limit) * 100;

        if (utilBar) utilBar.style.width = `${utilization}%`;
        if (memBar) memBar.style.width = `${memPercent}%`;
        if (powerBar) powerBar.style.width = `${powerPercent}%`;

        // 更新新指标（仅当存在时）
        const clockGrEl = document.getElementById(`clock-gr-${gpuId}`);
        const clockMemEl = document.getElementById(`clock-mem-${gpuId}`);
        const clockSmEl = document.getElementById(`clock-sm-${gpuId}`);
        const memUtilEl = document.getElementById(`mem-util-${gpuId}`);
        const memUtilBar = document.getElementById(`mem-util-bar-${gpuId}`);
        const pcieEl = document.getElementById(`pcie-${gpuId}`);
        const pstateEl = document.getElementById(`pstate-${gpuId}`);
        const encoderEl = document.getElementById(`encoder-${gpuId}`);

        if (clockGrEl) clockGrEl.textContent = `${getMetricValue(gpuInfo, 'clock_graphics', 0)}`;
        if (clockMemEl) clockMemEl.textContent = `${getMetricValue(gpuInfo, 'clock_memory', 0)}`;
        if (clockSmEl) clockSmEl.textContent = `${getMetricValue(gpuInfo, 'clock_sm', 0)}`;
        if (memUtilEl) memUtilEl.textContent = `${getMetricValue(gpuInfo, 'memory_utilization', 0)}%`;
        if (memUtilBar) memUtilBar.style.width = `${getMetricValue(gpuInfo, 'memory_utilization', 0)}%`;
        if (pcieEl) pcieEl.textContent = `Gen ${getMetricValue(gpuInfo, 'pcie_gen', 'N/A')}`;
        if (pstateEl) pstateEl.textContent = `${getMetricValue(gpuInfo, 'performance_state', 'N/A')}`;
        if (encoderEl) encoderEl.textContent = `${getMetricValue(gpuInfo, 'encoder_sessions', 0)}`;

        // 更新头部徽章
        const pstateHeaderEl = document.getElementById(`pstate-header-${gpuId}`);
        const pcieHeaderEl = document.getElementById(`pcie-header-${gpuId}`);
        if (pstateHeaderEl) pstateHeaderEl.textContent = `${getMetricValue(gpuInfo, 'performance_state', 'N/A')}`;
        if (pcieHeaderEl) pcieHeaderEl.textContent = `${getMetricValue(gpuInfo, 'pcie_gen', 'N/A')}`;

        // 更新内存总量子标签
        const memTotalEl = document.getElementById(`mem-total-${gpuId}`);
        if (memTotalEl) memTotalEl.textContent = `of ${formatMemory(memory_total)}`;

        // 更新新高级指标（仅当存在时）
        const tempMemEl = document.getElementById(`temp-mem-${gpuId}`);
        const memFreeEl = document.getElementById(`mem-free-${gpuId}`);
        const decoderEl = document.getElementById(`decoder-${gpuId}`);
        const clockVideoEl = document.getElementById(`clock-video-${gpuId}`);
        const computeModeEl = document.getElementById(`compute-mode-${gpuId}`);
        const pcieMaxEl = document.getElementById(`pcie-max-${gpuId}`);
        const throttleEl = document.getElementById(`throttle-${gpuId}`);

        if (tempMemEl) {
            const tempMem = getMetricValue(gpuInfo, 'temperature_memory', null);
            if (tempMem !== null) {
                tempMemEl.textContent = `${tempMem}°C`;
            } else {
                tempMemEl.textContent = 'N/A';
            }
        }
        if (memFreeEl) memFreeEl.textContent = formatMemory(getMetricValue(gpuInfo, 'memory_free', 0));
        if (decoderEl) {
            const decoderSessions = getMetricValue(gpuInfo, 'decoder_sessions', null);
            if (decoderSessions !== null) {
                decoderEl.textContent = `${decoderSessions}`;
            } else {
                decoderEl.textContent = 'N/A';
            }
        }
        if (clockVideoEl) {
            const clockVideo = getMetricValue(gpuInfo, 'clock_video', null);
            if (clockVideo !== null) {
                clockVideoEl.textContent = `${clockVideo}`;
            } else {
                clockVideoEl.textContent = 'N/A';
            }
        }
        if (computeModeEl) computeModeEl.textContent = `${getMetricValue(gpuInfo, 'compute_mode', 'N/A')}`;
        if (pcieMaxEl) pcieMaxEl.textContent = `Gen ${getMetricValue(gpuInfo, 'pcie_gen_max', 'N/A')}`;
        if (throttleEl) {
            const throttle_reasons = getMetricValue(gpuInfo, 'throttle_reasons', 'None');
            const isThrottling = throttle_reasons && throttle_reasons !== 'None' && throttle_reasons !== 'N/A';
            throttleEl.textContent = isThrottling ? throttle_reasons : 'None';
        }

        // 更新所有新指标（仅当元素存在 - 动态仪表盘）
        if (hasMetric(gpuInfo, 'energy_consumption_wh')) {
            const energyEl = document.getElementById(`energy-${gpuId}`);
            if (energyEl) energyEl.textContent = formatEnergy(gpuInfo.energy_consumption_wh);
        }
        
        if (hasMetric(gpuInfo, 'brand')) {
            const brandEl = document.getElementById(`brand-${gpuId}`);
            if (brandEl) brandEl.textContent = gpuInfo.brand;
        }
        
        if (hasMetric(gpuInfo, 'power_limit_min') && hasMetric(gpuInfo, 'power_limit_max')) {
            const powerRangeEl = document.getElementById(`power-range-${gpuId}`);
            if (powerRangeEl) powerRangeEl.textContent = `${gpuInfo.power_limit_min.toFixed(0)}W - ${gpuInfo.power_limit_max.toFixed(0)}W`;
        }
        
        if (hasMetric(gpuInfo, 'clock_graphics_app')) {
            const clockGrAppEl = document.getElementById(`clock-gr-app-${gpuId}`);
            if (clockGrAppEl) clockGrAppEl.textContent = gpuInfo.clock_graphics_app;
        }
        
        if (hasMetric(gpuInfo, 'clock_memory_app')) {
            const clockMemAppEl = document.getElementById(`clock-mem-app-${gpuId}`);
            if (clockMemAppEl) clockMemAppEl.textContent = gpuInfo.clock_memory_app;
        }
        
        if (hasMetric(gpuInfo, 'pcie_rx_throughput') || hasMetric(gpuInfo, 'pcie_tx_throughput')) {
            const pcieThroughputEl = document.getElementById(`pcie-throughput-${gpuId}`);
            if (pcieThroughputEl) {
                const rx = (gpuInfo.pcie_rx_throughput || 0).toFixed(0);
                const tx = (gpuInfo.pcie_tx_throughput || 0).toFixed(0);
                pcieThroughputEl.innerHTML = `↓${rx} KB/s`;
            }
        }
        
        if (hasMetric(gpuInfo, 'bar1_memory_used')) {
            const bar1MemEl = document.getElementById(`bar1-mem-${gpuId}`);
            if (bar1MemEl) bar1MemEl.textContent = formatMemory(gpuInfo.bar1_memory_used);
        }
        
        if (hasMetric(gpuInfo, 'persistence_mode')) {
            const persistenceEl = document.getElementById(`persistence-${gpuId}`);
            if (persistenceEl) persistenceEl.textContent = gpuInfo.persistence_mode;
        }
        
        if (hasMetric(gpuInfo, 'reset_required')) {
            const resetRequiredEl = document.getElementById(`reset-required-${gpuId}`);
            if (resetRequiredEl) {
                resetRequiredEl.textContent = gpuInfo.reset_required ? 'Reset Required!' : 'Healthy';
                resetRequiredEl.style.color = gpuInfo.reset_required ? '#ff4444' : '#00ff88';
            }
        }
        
        if (hasMetric(gpuInfo, 'nvlink_active_count') && gpuInfo.nvlink_active_count > 0) {
            const nvlinkEl = document.getElementById(`nvlink-${gpuId}`);
            if (nvlinkEl) nvlinkEl.textContent = gpuInfo.nvlink_active_count;
        }
        
        if (hasMetric(gpuInfo, 'compute_processes_count') || hasMetric(gpuInfo, 'graphics_processes_count')) {
            const processCountsEl = document.getElementById(`process-counts-${gpuId}`);
            if (processCountsEl) {
                const compute = gpuInfo.compute_processes_count || 0;
                const graphics = gpuInfo.graphics_processes_count || 0;
                processCountsEl.textContent = `C:${compute} G:${graphics}`;
            }
        }
    }
    // 结束 shouldUpdateDOM 检查

    // 始终更新图表（它们高效且需要高频数据）
    const memPercent = (memory_used / memory_total) * 100;

    // Update charts with available data
    updateChart(gpuId, 'utilization', utilization);
    updateChart(gpuId, 'temperature', temperature);
    updateChart(gpuId, 'memory', memPercent);
    updateChart(gpuId, 'power', power_draw);
    updateChart(gpuId, 'fanSpeed', fan_speed);
    updateChart(gpuId, 'clocks', 
        getMetricValue(gpuInfo, 'clock_graphics', 0), 
        getMetricValue(gpuInfo, 'clock_sm', 0), 
        getMetricValue(gpuInfo, 'clock_memory', 0)
    );
    
    // 计算并更新功率效率（每瓦特利用率）
    const efficiency = power_draw > 0 ? utilization / power_draw : 0;
    updateChart(gpuId, 'efficiency', efficiency);
    
    // 更新新图表（仅当指标可用时）
    if (hasMetric(gpuInfo, 'pcie_rx_throughput') || hasMetric(gpuInfo, 'pcie_tx_throughput')) {
        updateChart(gpuId, 'pcie',
            gpuInfo.pcie_rx_throughput || 0,
            gpuInfo.pcie_tx_throughput || 0
        );
    }
    
    if (hasMetric(gpuInfo, 'clock_graphics_app') || hasMetric(gpuInfo, 'clock_memory_app')) {
        updateChart(gpuId, 'appclocks',
            gpuInfo.clock_graphics_app || gpuInfo.clock_graphics || 0,
            gpuInfo.clock_memory_app || gpuInfo.clock_memory || 0,
            gpuInfo.clock_sm_app || gpuInfo.clock_sm || 0,
            gpuInfo.clock_video_app || gpuInfo.clock_video || 0
        );
    }

    // 更新背景利用率图表
    if (charts[gpuId] && charts[gpuId].utilBackground) {
        charts[gpuId].utilBackground.update('none');
    }
}

// 更新进程显示
function updateProcesses(processes) {
    const container = document.getElementById('processes-container');
    const countEl = document.getElementById('process-count');

    // 更新进程计数
    if (countEl) {
        countEl.textContent = processes.length === 0 ? 'No processes' :
                             processes.length === 1 ? '1 process' :
                             `${processes.length} processes`;
    }

    if (processes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No Active GPU Processes</div>
                <div class="empty-state-subtext">Your GPUs are currently idle</div>
            </div>
        `;
        return;
    }

    container.innerHTML = processes.map(proc => `
        <div class="process-item">
            <div class="process-name">
                <strong>${proc.name}</strong>
                <span style="color: var(--text-secondary); font-size: 0.85rem; margin-left: 0.5rem;">PID: ${proc.pid}</span>
            </div>
            <div class="process-memory">
                <span style="font-size: 1.1rem; font-weight: 700;">${formatMemory(proc.memory)}</span>
                <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 0.25rem;">VRAM</span>
            </div>
        </div>
    `).join('');
}
