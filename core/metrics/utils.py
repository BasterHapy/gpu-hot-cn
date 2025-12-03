"""GPU 指标实用工具"""

import pynvml


def safe_get(func, *args, default=None):
    """安全调用 NVML 函数，如果不支持则返回默认值"""
    try:
        result = func(*args)
        return result if result is not None else default
    except (pynvml.NVMLError, Exception):
        return default


def decode_bytes(value):
    """如果值是字节类型，则解码为字符串"""
    return value.decode('utf-8') if isinstance(value, bytes) else value


def to_mib(bytes_value):
    """将字节转换为 MiB"""
    return float(bytes_value / (1024 ** 2))


def to_watts(milliwatts):
    """将毫瓦转换为瓦特"""
    return float(milliwatts / 1000.0)

