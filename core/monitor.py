"""异步 GPU 监测，使用 NVML"""


import asyncio
import pynvml
import psutil
import logging

from .metrics import MetricsCollector
from .nvidia_smi_fallback import parse_nvidia_smi
from .config import NVIDIA_SMI

logger = logging.getLogger(__name__)


class GPUMonitor:
    """异步 GPU 监测，使用 NVML"""

    def __init__(self):
        self.running = False
        self.gpu_data = {}
        self.collector = MetricsCollector()
        self.use_smi = {}  # 跟踪哪些 GPU 使用 nvidia-smi（在启动时决定）

        try:
            pynvml.nvmlInit()
            self.initialized = True
            version = pynvml.nvmlSystemGetDriverVersion()
            if isinstance(version, bytes):
                version = version.decode('utf-8')
            logger.info(f"NVML initialized - Driver: {version}")

            # 检测哪些 GPU 需要 nvidia-smi（启动时调用一次）
            self._detect_smi_gpus()

        except Exception as e:
            logger.error(f"Failed to initialize NVML: {e}")
            self.initialized = False

    def _detect_smi_gpus(self):
        """检测哪些 GPU 需要 nvidia-smi（启动时调用一次）"""
        try:
            device_count = pynvml.nvmlDeviceGetCount()
            logger.info(f"Detected {device_count} GPU(s)")

            if NVIDIA_SMI:
                logger.warning("NVIDIA_SMI=True - Forcing nvidia-smi for all GPUs")
                for i in range(device_count):
                    self.use_smi[str(i)] = True
                return

            # 自动检测每个 GPU
            for i in range(device_count):
                gpu_id = str(i)
                try:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                    data = self.collector.collect_all(handle, gpu_id)
                    gpu_name = data.get('name', 'Unknown')

                    if 'utilization' not in data or data.get('utilization') is None:
                        self.use_smi[gpu_id] = True
                        logger.warning(f"GPU {i} ({gpu_name}): Utilization metric not available via NVML")
                        logger.warning(f"GPU {i} ({gpu_name}): Switching to nvidia-smi mode")
                    else:
                        self.use_smi[gpu_id] = False
                        logger.info(f"GPU {i} ({gpu_name}): Using NVML (utilization: {data.get('utilization')}%)")

                except Exception as e:
                    self.use_smi[gpu_id] = True
                    logger.error(f"GPU {i}: NVML detection failed - {e}")
                    logger.warning(f"GPU {i}: Falling back to nvidia-smi")

            # 总结检测结果
            nvml_count = sum(1 for use_smi in self.use_smi.values() if not use_smi)
            smi_count = sum(1 for use_smi in self.use_smi.values() if use_smi)
            if smi_count > 0:
                logger.info(f"Boot detection complete: {nvml_count} GPU(s) using NVML, {smi_count} GPU(s) using nvidia-smi")
            else:
                logger.info(f"Boot detection complete: All {nvml_count} GPU(s) using NVML")

        except Exception as e:
            logger.error(f"Failed to detect GPUs: {e}")

    async def get_gpu_data(self):
        """异步收集所有检测到的 GPU 的指标"""
        if not self.initialized:
            logger.error("Cannot get GPU data - NVML not initialized")
            return {}

        try:
            device_count = pynvml.nvmlDeviceGetCount()
            gpu_data = {}

            # 如果有任何 GPU 需要 nvidia-smi，则获取一次 nvidia-smi 数据
            smi_data = None
            if any(self.use_smi.values()):
                try:
                    # 在线程池中运行 nvidia-smi 以避免阻塞
                    smi_data = await asyncio.get_event_loop().run_in_executor(
                        None, parse_nvidia_smi
                    )
                except Exception as e:
                    logger.error(f"nvidia-smi failed: {e}")

            # 并发收集 GPU 数据
            tasks = []
            for i in range(device_count):
                gpu_id = str(i)
                if self.use_smi.get(gpu_id, False):
                    # 使用 nvidia-smi 数据
                    if smi_data and gpu_id in smi_data:
                        gpu_data[gpu_id] = smi_data[gpu_id]
                    else:
                        logger.warning(f"GPU {i}: No data from nvidia-smi")
                else:
                    # 使用 NVML - 在线程池中运行以避免阻塞
                    task = asyncio.get_event_loop().run_in_executor(
                        None, self._collect_single_gpu, i
                    )
                    tasks.append((gpu_id, task))

            # 等待所有 NVML 任务完成
            if tasks:
                results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
                for (gpu_id, _), result in zip(tasks, results):
                    if isinstance(result, Exception):
                        logger.error(f"GPU {gpu_id}: Error - {result}")
                    else:
                        gpu_data[gpu_id] = result

            if not gpu_data:
                logger.error("No GPU data collected from any source")

            self.gpu_data = gpu_data
            return gpu_data

        except Exception as e:
            logger.error(f"Failed to get GPU data: {e}")
            return {}

    def _collect_single_gpu(self, gpu_index):
        """收集单个 GPU 的数据（在线程池中运行）"""
        try:
            handle = pynvml.nvmlDeviceGetHandleByIndex(gpu_index)
            return self.collector.collect_all(handle, str(gpu_index))
        except Exception as e:
            logger.error(f"GPU {gpu_index}: Error - {e}")
            return {}

    async def get_processes(self):
        """异步获取 GPU 进程信息"""
        if not self.initialized:
            return []

        try:
            # 在线程池中运行进程收集
            return await asyncio.get_event_loop().run_in_executor(
                None, self._get_processes_sync
            )
        except Exception as e:
            logger.error(f"Error getting processes: {e}")
            return []

    def _get_processes_sync(self):
        """同步进程收集（在线程池中运行）"""
        try:
            device_count = pynvml.nvmlDeviceGetCount()
            all_processes = []
            gpu_process_counts = {}

            for i in range(device_count):
                try:
                    handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                    uuid = pynvml.nvmlDeviceGetUUID(handle)
                    if isinstance(uuid, bytes):
                        uuid = uuid.decode('utf-8')

                    gpu_id = str(i)
                    gpu_process_counts[gpu_id] = {'compute': 0, 'graphics': 0}

                    try:
                        procs = pynvml.nvmlDeviceGetComputeRunningProcesses(handle)
                        gpu_process_counts[gpu_id]['compute'] = len(procs)

                        for proc in procs:
                            all_processes.append({
                                'pid': str(proc.pid),
                                'name': self._get_process_name(proc.pid),
                                'gpu_uuid': uuid,
                                'gpu_id': gpu_id,
                                'memory': float(proc.usedGpuMemory / (1024 ** 2))
                            })
                    except pynvml.NVMLError:
                        pass

                except pynvml.NVMLError:
                    continue

            for gpu_id, counts in gpu_process_counts.items():
                if gpu_id in self.gpu_data:
                    self.gpu_data[gpu_id]['compute_processes_count'] = counts['compute']
                    self.gpu_data[gpu_id]['graphics_processes_count'] = counts['graphics']

            return all_processes

        except Exception as e:
            logger.error(f"Error getting processes: {e}")
            return []

    def _get_process_name(self, pid):
        """从 PID 提取可读的进程名称，改进逻辑"""
        try:
            p = psutil.Process(pid)

            # 首先尝试获取进程名称
            try:
                process_name = p.name()
                if process_name and process_name not in ['python', 'python3', 'sh', 'bash']:
                    return process_name
            except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
                pass

            # 尝试获取命令行以更好地提取名称
            try:
                cmdline = p.cmdline()
                if cmdline:
                    # 查找实际的可执行文件或脚本名称
                    for i, arg in enumerate(cmdline):
                        if not arg or arg.startswith('-'):
                            continue

                        # 跳过常见的解释器和 shell
                        if arg in ['python', 'python3', 'node', 'java', 'sh', 'bash', 'zsh']:
                            continue

                        # 从路径中提取文件名
                        filename = arg.split('/')[-1].split('\\')[-1]

                        # 如果仍然是通用名称，则跳过
                        if filename in ['python', 'python3', 'node', 'java', 'sh', 'bash']:
                            continue

                        # 找到有意义的名称
                        if filename:
                            return filename

                    # 如果以上都不行，回退到第一个参数
                    if cmdline[0]:
                        return cmdline[0].split('/')[-1].split('\\')[-1]

            except (psutil.AccessDenied, psutil.NoSuchProcess, psutil.ZombieProcess):
                pass

            # 最终回退到 PID
            return f'PID:{pid}'

        except (psutil.NoSuchProcess, psutil.ZombieProcess):
            return f'PID:{pid}'
        except Exception as e:
            logger.debug(f"Error getting process name for PID {pid}: {e}")
            return f'PID:{pid}'

    async def shutdown(self):
        """异步关闭"""
        if self.initialized:
            try:
                pynvml.nvmlShutdown()
                self.initialized = False
                logger.info("NVML shutdown")
            except Exception as e:
                logger.error(f"Error shutting down NVML: {e}")

