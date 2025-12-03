#!/usr/bin/env python3
"""GPU Hot - Real-time NVIDIA GPU Monitoring Dashboard (FastAPI + AsyncIO)"""
"""GPU Hot - 实时 NVIDIA GPU 监控仪表盘 (FastAPI + AsyncIO)"""

# 导入异步IO,日志记录和异步HTTP客户端库
import asyncio
import logging
import aiohttp

# 导入FastAPI及相关模块
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse

# 导入配置和版本信息
from core import config
from version import __version__

# 设置日志记录 -> 根据配置的调试模式设置日志级别 -> 输出格式
logging.basicConfig(
    level=logging.DEBUG if config.DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建FastAPI应用实例 -> 设置标题和版本
app = FastAPI(title="GPU Hot", version=__version__)

# 提供静态文件服务 -> 指定静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 模式选择: 集线器模式或默认监控模式
if config.MODE == 'hub':
    # 集线器模式: 连接到多个节点
    if not config.NODE_URLS:
        # 如果未提供节点URL，则引发错误
        raise ValueError("Hub mode requires NODE_URLS environment variable")
    
    # 记录启动信息
    logger.info("Starting GPU Hot in HUB mode (FastAPI)")
    # 记录节点连接信息
    logger.info(f"Connecting to {len(config.NODE_URLS)} node(s): {config.NODE_URLS}")
    
    # 导入集线器相关模块 -> 集线器类和处理程序注册函数
    from core.hub import Hub
    from core.hub_handlers import register_hub_handlers
    
    # 创建集线器实例并注册处理程序
    hub = Hub(config.NODE_URLS)
    register_hub_handlers(app, hub)
    monitor_or_hub = hub

else:
    # 默认模式: 监控本地GPU并提供仪表盘
    logger.info("Starting GPU Hot (FastAPI)")
    logger.info(f"Node name: {config.NODE_NAME}")
    
    # 导入监控相关模块 -> GPU监控器和处理程序注册函数
    from core.monitor import GPUMonitor
    from core.handlers import register_handlers
    
    # 创建GPU监控器实例并注册处理程序
    monitor = GPUMonitor()
    register_handlers(app, monitor)
    monitor_or_hub = monitor

# 定义根路径路由 -> 提供主仪表盘页面
@app.get("/")
async def index():
    """提供主仪表盘页面"""
    # 读取并返回HTML内容
    with open("templates/index.html", "r") as f:
        return HTMLResponse(content=f.read())

# 定义GPU数据API端点 -> 提供GPU数据的REST API
@app.get("/api/gpu-data")
async def api_gpu_data():
    """提供GPU数据的REST API端点"""

    # 根据模式返回GPU数据
    if config.MODE == 'hub':
        return {"gpus": {}, "timestamp": "hub_mode"}
    
    # 默认监控模式下返回GPU数据
    if hasattr(monitor_or_hub, 'get_gpu_data'):
        return {"gpus": await monitor_or_hub.get_gpu_data(), "timestamp": "async"}
    
    # 如果没有数据则返回空
    return {"gpus": {}, "timestamp": "no_data"}


def compare_versions(current, latest):
    """比较语义版本。如果最新版本 > 当前版本则返回True"""

    # 拆分版本号为整数列表并比较
    try:
        current_parts = [int(x) for x in current.split('.')]
        latest_parts = [int(x) for x in latest.split('.')]
        
        # 补齐版本号长度
        max_len = max(len(current_parts), len(latest_parts))
        current_parts += [0] * (max_len - len(current_parts))
        latest_parts += [0] * (max_len - len(latest_parts))
        
        # 比较每个部分
        for c, l in zip(current_parts, latest_parts):
            if l > c:
                return True
            elif l < c:
                return False
        
        return False  # Versions are equal
    except (ValueError, AttributeError):
        return False

# 定义版本检查API端点 -> 检查GitHub上的最新版本
@app.get("/api/version")
async def api_version():
    """获取当前版本并检查GitHub上的更新"""
    current_version = __version__
    
    try:
        # 检查GitHub上的最新发布版本
        async with aiohttp.ClientSession() as session:
            async with session.get(
                "https://api.github.com/repos/psalias2006/gpu-hot/releases/latest",
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    latest_version = data.get("tag_name", "").lstrip("v")
                    
                    # 仅当最新版本 > 当前版本时显示更新
                    update_available = compare_versions(current_version, latest_version) if latest_version else False
                    
                    return JSONResponse({
                        "current": current_version,
                        "latest": latest_version,
                        "update_available": update_available,
                        "release_url": data.get("html_url", "")
                    })
    except Exception as e:
        logger.debug(f"Failed to check for updates: {e}")
    
    # GitHub检查失败返回当前版本
    return JSONResponse({
        "current": current_version,
        "latest": None,
        "update_available": False,
        "release_url": None
    })


if __name__ == '__main__':
    # 使用Uvicorn运行FastAPI应用
    import uvicorn
    try:
        logger.info(f"Server running on {config.HOST}:{config.PORT}")
        uvicorn.run(app, host=config.HOST, port=config.PORT, log_level="info")
    finally:
        if hasattr(monitor_or_hub, 'shutdown'):
            asyncio.run(monitor_or_hub.shutdown())
