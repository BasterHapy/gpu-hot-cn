"""
GPU Hot 的核心包  
实时 NVIDIA GPU 监测应用
"""

__version__ = '1.0.0'

# 导入 GPU 监测器类和配置模块
from .monitor import GPUMonitor
from . import config

__all__ = ['GPUMonitor', 'config']

