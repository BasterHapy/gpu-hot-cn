/**
 * GPU Hot - Main Application
 * Initializes the application when the DOM is ready
 * GPU Hot - 主应用程序
 * 在DOM准备好时初始化应用程序
 */

// 应用初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('GPU Hot 应用已初始化');
    
    // 所有功能均从其他模块加载：
    // - charts.js: 图表配置和更新
    // - gpu-cards.js: GPU卡片渲染和更新
    // - ui.js: 用户界面交互和导航
    // - socket-handlers.js: 通过Socket.IO进行实时数据更新
    
    // 当socket-handlers.js加载时，套接字连接会自动建立
    
    // 检查版本更新
    checkVersion();
});
