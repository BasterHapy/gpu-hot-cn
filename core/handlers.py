"""Async WebSocket handlers for real-time monitoring"""
# 异步 WebSocket 处理程序，用于实时监测

# 导入 异步IO, 系统监测库, 日志记录和 JSON 库
import asyncio
import psutil
import logging
import json

from datetime import datetime
from fastapi import WebSocket # 导入 WebSocket 模块
from . import config # 导入配置模块

# 设置日志记录
logger = logging.getLogger(__name__)

# 全局 WebSocket 连接
websocket_connections = set()

def register_handlers(app, monitor):
    """注册 FastAPI WebSocket 处理程序"""
    
    @app.websocket("/socket.io/")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        websocket_connections.add(websocket)
        logger.debug('仪表盘客户端已连接')
        
        if not monitor.running:
            monitor.running = True
            asyncio.create_task(monitor_loop(monitor, websocket_connections))
        
        try:
            # 保持连接活跃
            while True:
                await websocket.receive_text()
        except Exception as e:
            logger.debug(f'仪表盘客户端已断开连接: {e}')
        finally:
            websocket_connections.discard(websocket)


async def monitor_loop(monitor, connections):
    """异步后台循环，收集并发送 GPU 数据"""
    # 根据是否有 GPU 使用 nvidia-smi 确定更新间隔
    uses_nvidia_smi = any(monitor.use_smi.values()) if hasattr(monitor, 'use_smi') else False
    update_interval = config.NVIDIA_SMI_INTERVAL if uses_nvidia_smi else config.UPDATE_INTERVAL
    
    if uses_nvidia_smi:
        logger.info(f"使用 nvidia-smi 轮询间隔: {update_interval}s")
    else:
        logger.info(f"使用 NVML 轮询间隔: {update_interval}s")
    
    while monitor.running:
        try:
            # 并发收集数据
            gpu_data, processes = await asyncio.gather(
                monitor.get_gpu_data(),
                monitor.get_processes()
            )
            
            system_info = {
                'cpu_percent': psutil.cpu_percent(percpu=False),
                'memory_percent': psutil.virtual_memory().percent,
                'timestamp': datetime.now().isoformat()
            }
            
            data = {
                'mode': config.MODE,
                'node_name': config.NODE_NAME,
                'gpus': gpu_data,
                'processes': processes,
                'system': system_info
            }
            
            # 发送数据到所有已连接的客户端
            if connections:
                disconnected = set()
                for websocket in connections:
                    try:
                        await websocket.send_text(json.dumps(data))
                    except:
                        disconnected.add(websocket)
                
                # 移除已断开连接的客户端
                connections -= disconnected
            
        except Exception as e:
            logger.error(f"监测循环中的错误: {e}")
        
        await asyncio.sleep(update_interval)

