"""
Configuration settings for GPU Hot
为GPU Hot 的配置设置
"""

import os
import socket

# FastAPI 配置
SECRET_KEY = 'gpu_hot_secret'
HOST = '0.0.0.0'
PORT = 1312
DEBUG = False

# 监测配置
UPDATE_INTERVAL = 0.5  # NVML 的更新间隔（亚秒监控）
NVIDIA_SMI_INTERVAL = 2.0  # nvidia-smi 回退更新间隔（较慢以减少开销）


# GPU 监测模式
# 可以通过环境变量设置 : NVIDIA_SMI=true
NVIDIA_SMI = os.getenv('NVIDIA_SMI', 'false').lower() == 'true'

# Multi-Node Configuration
# MODE: default (single node monitoring), hub (aggregate multiple nodes)
# 多节点配置 
# MODE: default 单节点模式 hub（聚合多个节点）
MODE = os.getenv('GPU_HOT_MODE', 'default')
NODE_NAME = os.getenv('NODE_NAME', socket.gethostname())
# NODE_URLS: comma-separated URLs for hub mode (e.g., http://node1:1312,http://node2:1312)
# 多个节点: 从http://node1:1321 开始
NODE_URLS = [url.strip() for url in os.getenv('NODE_URLS', '').split(',') if url.strip()]

