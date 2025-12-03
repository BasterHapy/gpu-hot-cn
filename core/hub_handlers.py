"""异步 WebSocket 处理程序，用于集群模式"""

import asyncio
import logging
import json
from fastapi import WebSocket

logger = logging.getLogger(__name__)

# 全局 WebSocket 连接
websocket_connections = set()

def register_hub_handlers(app, hub):
    """注册 FastAPI WebSocket 处理程序，用于集群模式"""
    
    @app.websocket("/socket.io/")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        websocket_connections.add(websocket)
        logger.debug('仪表盘客户端已连接')
        
        if not hub.running:
            hub.running = True
            asyncio.create_task(hub_loop(hub, websocket_connections))
        
        # 启动节点连接（如果尚未启动）
        if not hub._connection_started:
            hub._connection_started = True
            asyncio.create_task(hub._connect_all_nodes())
        
        try:
            # 保持连接活跃
            while True:
                await websocket.receive_text()
        except Exception as e:
            logger.debug(f'仪表盘客户端已断开连接: {e}')
        finally:
            websocket_connections.discard(websocket)


async def hub_loop(hub, connections):
    """异步后台循环，发送聚合的集群数据"""
    logger.info("集群监测循环已启动")
    
    while hub.running:
        try:
            cluster_data = await hub.get_cluster_data()
            
            # 发送数据到所有已连接的客户端
            if connections:
                disconnected = set()
                for websocket in connections:
                    try:
                        await websocket.send_text(json.dumps(cluster_data))
                    except:
                        disconnected.add(websocket)
                
                # 移除已断开连接的客户端
                connections -= disconnected
                
        except Exception as e:
            logger.error(f"集群循环中的错误: {e}")
        
        # 匹配节点更新速率以实现实时响应
        await asyncio.sleep(0.5)

