"""异步集群模式 - 聚合来自多个节点的数据"""

import asyncio
import logging
import json
import websockets
from datetime import datetime
from . import config

logger = logging.getLogger(__name__)


class Hub:
    """聚合来自多个节点的数据"""
    
    def __init__(self, node_urls):
        self.node_urls = node_urls
        self.nodes = {}  # node_name -> {client, data, status, last_update}
        self.url_to_node = {}  # url -> node_name mapping
        self.running = False
        self._connection_started = False
        
        # 初始化节点为离线状态
        for url in node_urls:
            self.nodes[url] = {
                'url': url,
                'websocket': None,
                'data': None,
                'status': 'offline',
                'last_update': None
            }
            self.url_to_node[url] = url
    
    async def _connect_all_nodes(self):
        """在后台连接所有节点并重试"""
        # 等待一段时间以确保 Docker 网络准备就绪
        await asyncio.sleep(2)
        
        # 并发连接所有节点
        tasks = [self._connect_node_with_retry(url) for url in self.node_urls]
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _connect_node_with_retry(self, url):
        """连接节点并重试"""
        max_retries = 5
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                await self._connect_node(url)
                return  # Success
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f'Connection attempt {attempt + 1}/{max_retries} failed for {url}: {str(e)}, retrying in {retry_delay}s...')
                    await asyncio.sleep(retry_delay)
                else:
                    logger.error(f'Failed to connect to node {url} after {max_retries} attempts: {str(e)}')
    
    async def _connect_node(self, url):
        """使用原生 WebSocket 连接到节点"""
        while self.running:
            try:
                # 将 HTTP URL 转换为 WebSocket URL
                ws_url = url.replace('http://', 'ws://').replace('https://', 'wss://') + '/socket.io/'
                
                logger.info(f'Connecting to node WebSocket: {ws_url}')
                
                async with websockets.connect(ws_url) as websocket:
                    logger.info(f'Connected to node: {url}')
                    
                    # 标记节点为在线
                    node_name = self.url_to_node.get(url, url)
                    self.nodes[node_name] = {
                        'url': url,
                        'websocket': websocket,
                        'data': None,
                        'status': 'online',
                        'last_update': datetime.now().isoformat()
                    }
                    
                    # 监听来自节点的数据
                    async for message in websocket:
                        try:
                            data = json.loads(message)
                            
                            # 从数据中提取节点名称，或使用 URL 作为回退
                            node_name = data.get('node_name', url)
                            
                            # 更新 URL 到节点名称的映射
                            self.url_to_node[url] = node_name
                            
                            # 使用接收到的数据更新节点条目
                            self.nodes[node_name] = {
                                'url': url,
                                'websocket': websocket,
                                'data': data,
                                'status': 'online',
                                'last_update': datetime.now().isoformat()
                            }
                            
                        except json.JSONDecodeError as e:
                            logger.error(f'Failed to parse message from {url}: {e}')
                        except Exception as e:
                            logger.error(f'Error processing message from {url}: {e}')
                            
            except websockets.exceptions.ConnectionClosed:
                logger.warning(f'WebSocket connection closed for node: {url}')
                # 标记节点为离线
                node_name = self.url_to_node.get(url, url)
                if node_name in self.nodes:
                    self.nodes[node_name]['status'] = 'offline'
                    logger.info(f'Marked node {node_name} as offline')
            except Exception as e:
                logger.error(f'Failed to connect to node {url}: {e}')
                # 标记节点为离线
                node_name = self.url_to_node.get(url, url)
                if node_name in self.nodes:
                    self.nodes[node_name]['status'] = 'offline'
                    logger.info(f'Marked node {node_name} as offline')
            
            # 在重试连接之前等待一段时间
            if self.running:
                await asyncio.sleep(5)
    
    async def get_cluster_data(self):
        """获取所有节点的聚合数据"""
        nodes = {}
        total_gpus = 0
        online_nodes = 0
        
        for node_name, node_info in self.nodes.items():
            if node_info['status'] == 'online' and node_info['data']:
                nodes[node_name] = {
                    'status': 'online',
                    'gpus': node_info['data'].get('gpus', {}),
                    'processes': node_info['data'].get('processes', []),
                    'system': node_info['data'].get('system', {}),
                    'last_update': node_info['last_update']
                }
                total_gpus += len(node_info['data'].get('gpus', {}))
                online_nodes += 1
            else:
                nodes[node_name] = {
                    'status': 'offline',
                    'gpus': {},
                    'processes': [],
                    'system': {},
                    'last_update': node_info.get('last_update')
                }
        
        return {
            'mode': 'hub',
            'nodes': nodes,
            'cluster_stats': {
                'total_nodes': len(self.nodes),
                'online_nodes': online_nodes,
                'total_gpus': total_gpus
            }
        }
    
    async def shutdown(self):
        """断开所有节点的连接"""
        self.running = False
        for node_info in self.nodes.values():
            if node_info.get('websocket'):
                try:
                    await node_info['websocket'].close()
                except:
                    pass

