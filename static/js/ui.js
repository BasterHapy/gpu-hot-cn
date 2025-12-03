/**
 * UI Interactions and navigation
 * 用户界面和导航
 */

// Global state
// 全局状态
let currentTab = 'overview';
let registeredGPUs = new Set();
let hasAutoSwitched = false; // 跟踪我们是否已经进行了初始自动切换

// 切换进程选项
function toggleProcesses() {
    const content = document.getElementById('processes-content');
    const header = document.querySelector('.processes-header');
    const icon = document.querySelector('.toggle-icon');

    content.classList.toggle('expanded');
    header.classList.toggle('expanded');
    icon.classList.toggle('expanded');
}

// Tab switching with smooth transitions
// 带平滑过渡的标签切换
function switchToView(viewName) {
    if (!viewName) {
        console.warn('switchToView: Missing viewName');
        return;
    }
    
    currentTab = viewName;

    // Update view selector states
    // 更新视图选择器状态
    document.querySelectorAll('.view-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === viewName) {
            btn.classList.add('active');
        }
    });

    // Switch tab content with animation
    // 切换标签内容并添加动画
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const targetContent = document.getElementById(`tab-${viewName}`);
    if (!targetContent) {
        console.warn(`switchToView: Tab content not found for "${viewName}"`);
        return;
    }
    
    targetContent.classList.add('active');

    // 立即触发可见图表的大小调整，无需动画
    // 切换 
    if (viewName.startsWith('gpu-')) {
        const gpuId = viewName.replace('gpu-', '');
        
        // Disable animations during resize to prevent glitchy transitions
        // 调整大小时禁用动画以防止过渡出现问题
        if (charts && charts[gpuId]) {
            Object.values(charts[gpuId]).forEach(chart => {
                if (!chart) return;
                
                try {
                    if (chart.options) {
                        // Store original animation setting
                        // 存储原始动画设置
                        const originalAnimation = chart.options.animation;
                        
                        // Temporarily disable all animations
                        // 暂时禁用所有动画
                        chart.options.animation = false;
                        
                        // Resize without animation
                        // 无动画调整大小
                        if (typeof chart.resize === 'function') {
                            chart.resize();
                        }
                        
                        // Force immediate update without animation
                        // 强制 立刻更新动画
                        if (typeof chart.update === 'function') {
                            chart.update('none');
                        }
                        
                        // Restore original animation setting
                        // 恢复原始动画设置
                        chart.options.animation = originalAnimation;
                    }
                } catch (error) {
                    console.error(`Error resizing chart for GPU ${gpuId}:`, error);
                }
            });
        }
    }
}

// Create or update GPU tab
// 创建或更新 GPU 选项卡
function ensureGPUTab(gpuId, gpuInfo, shouldUpdateDOM = true) {
    if (!registeredGPUs.has(gpuId)) {
        // Add view option
        // 添加视图选项
        const viewSelector = document.getElementById('view-selector');
        const viewOption = document.createElement('button');
        viewOption.className = 'view-option';
        viewOption.dataset.view = `gpu-${gpuId}`;
        viewOption.textContent = `GPU ${gpuId}`;
        viewOption.onclick = () => switchToView(`gpu-${gpuId}`);
        viewSelector.appendChild(viewOption);

        // Create tab content
        // 创建选项卡文本
        const tabContent = document.createElement('div');
        tabContent.id = `tab-gpu-${gpuId}`;
        tabContent.className = 'tab-content';
        tabContent.innerHTML = `<div class="detailed-view"></div>`;
        document.getElementById('tab-overview').after(tabContent);

        registeredGPUs.add(gpuId);
    }

    // Update or create detailed GPU card in tab
    // 更新或者创建 详细的显卡
    const detailedContainer = document.querySelector(`#tab-gpu-${gpuId} .detailed-view`);
    const existingCard = document.getElementById(`gpu-${gpuId}`);

    if (!existingCard && detailedContainer) {
        detailedContainer.innerHTML = createGPUCard(gpuId, gpuInfo);
        //不要在这里重新初始化 chartData；这会破坏现有的图表引用
        if (!chartData[gpuId]) initGPUData(gpuId);
        initGPUCharts(gpuId);
    } else if (existingCard) {
        updateGPUDisplay(gpuId, gpuInfo, shouldUpdateDOM);
    }
}

// Remove GPU tab
// 删除GPU选项卡
function removeGPUTab(gpuId) {
    if (!registeredGPUs.has(gpuId)) {
        return; // Tab doesn't exist
    }

    // If currently viewing this GPU's tab, switch to overview
    // 如果当前正在查看此 GPU 的标签，请切换到概览
    if (currentTab === `gpu-${gpuId}`) {
        switchToView('overview');
    }

    // Remove view option button
    // 删除视图选项按钮
    const viewOption = document.querySelector(`.view-option[data-view="gpu-${gpuId}"]`);
    if (viewOption) {
        viewOption.remove();
    }

    // Remove tab content
    // 删除选项卡文本
    const tabContent = document.getElementById(`tab-gpu-${gpuId}`);
    if (tabContent) {
        tabContent.remove();
    }

    // Destroy charts
    // 销毁图表
    if (charts[gpuId]) {
        Object.values(charts[gpuId]).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
        delete charts[gpuId];
    }

    // Remove from registered GPUs
    // 从已注册的 GPU 中删除
    registeredGPUs.delete(gpuId);
}

// Auto-switch to single GPU view if only 1 GPU detected
// 如果只检测到 1 个 GPU，则自动切换到单 GPU 视图
function autoSwitchSingleGPU(gpuCount, gpuIds) {
    if (gpuCount === 1 && !hasAutoSwitched) {
        const singleGpuId = gpuIds[0];
        setTimeout(() => {
            switchToView(`gpu-${singleGpuId}`);
        }, 300); // 小延迟以确保 DOM 准备就绪
        hasAutoSwitched = true;
    }
}

// Make switchToView globally available
// 使 switchToView 在全局可用
window.switchToView = switchToView;
