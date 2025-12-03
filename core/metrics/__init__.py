"""
GPU 指标收集
有组织地收集来自 NVML 的 GPU 指标

"""

from .collector import MetricsCollector

__all__ = ['MetricsCollector']

