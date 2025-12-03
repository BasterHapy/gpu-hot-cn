"""使用 NVML 收集 GPU 指标"""

import time
import pynvml
from datetime import datetime
from .utils import safe_get, decode_bytes, to_mib, to_watts


class MetricsCollector:
    """通过 NVML 收集所有可用的 GPU 指标"""
    
    def __init__(self):
        self.previous_samples = {}
        self.last_sample_time = {}
    
    def collect_all(self, handle, gpu_id):
        """收集单个 GPU 的所有可用指标"""
        data = {
            'index': gpu_id,
            'timestamp': datetime.now().isoformat()
        }
        current_time = time.time()
        
        self._add_basic_info(handle, data)
        self._add_performance(handle, data)
        self._add_memory(handle, data, gpu_id, current_time)
        self._add_power_thermal(handle, data)
        self._add_clocks(handle, data)
        self._add_connectivity(handle, data)
        self._add_media_engines(handle, data)
        self._add_health_status(handle, data)
        self._add_advanced(handle, data)
        
        self.previous_samples[gpu_id] = data.copy()
        self.last_sample_time[gpu_id] = current_time
        
        return data
    
    def _add_basic_info(self, handle, data):
        """基础GPU信息"""
        if name := safe_get(pynvml.nvmlDeviceGetName, handle):
            data['name'] = decode_bytes(name)
        
        if uuid := safe_get(pynvml.nvmlDeviceGetUUID, handle):
            data['uuid'] = decode_bytes(uuid)
        
        if driver := safe_get(pynvml.nvmlSystemGetDriverVersion):
            data['driver_version'] = decode_bytes(driver)
        
        if vbios := safe_get(pynvml.nvmlDeviceGetVbiosVersion, handle):
            data['vbios_version'] = decode_bytes(vbios)
        
        # 品牌和架构，智能检测
        self._detect_brand(handle, data)
        self._detect_architecture(handle, data)
        
        # CUDA 计算能力
        if cap := safe_get(pynvml.nvmlDeviceGetCudaComputeCapability, handle):
            data['cuda_compute_capability'] = f"{cap[0]}.{cap[1]}"
        
        # 序列号
        if serial := safe_get(pynvml.nvmlDeviceGetSerial, handle):
            data['serial'] = decode_bytes(serial)
    
    def _detect_brand(self, handle, data):
        """从 NVML 检测 GPU 品牌"""
        BRAND_MAP = {
            1: 'GeForce', 2: 'Quadro', 3: 'Tesla',
            4: 'NVS', 5: 'GRID', 6: 'Titan',
            7: 'GeForce GTX', 8: 'GeForce RTX', 9: 'Titan RTX'
        }
        
        if brand := safe_get(pynvml.nvmlDeviceGetBrand, handle):
            data['brand'] = BRAND_MAP.get(brand, f'Brand {brand}')
    
    def _detect_architecture(self, handle, data):
        """检测 GPU 架构，回退到基于名称的检测"""
        ARCH_MAP = {
            0: 'Kepler', 1: 'Maxwell', 2: 'Pascal', 3: 'Volta',
            4: 'Turing', 5: 'Ampere', 6: 'Ada Lovelace', 7: 'Hopper',
            8: 'Ada Lovelace', 9: 'Ada Lovelace'  # Driver variations
        }
        
        # 尝试首先使用 NVML
        if arch := safe_get(pynvml.nvmlDeviceGetArchitecture, handle):
            data['architecture'] = ARCH_MAP.get(arch, self._detect_arch_from_name(data.get('name', '')))
        # 回退到基于名称的检测
        elif 'name' in data:
            data['architecture'] = self._detect_arch_from_name(data['name'])
    
    def _detect_arch_from_name(self, gpu_name):
        """从 GPU 型号名称检测架构"""
        name = gpu_name.upper()
        
        arch_patterns = [
            (['RTX 40', 'RTX 4', 'L40', 'L4'], 'Ada Lovelace'),
            (['H100', 'H200'], 'Hopper'),
            (['RTX 30', 'RTX 3', 'A100', 'A40', 'A30', 'A10', 'A6000', 'A5000', 'A4000', 'A2000'], 'Ampere'),
            (['RTX 20', 'RTX 2', 'GTX 16', 'T1000', 'T2000', 'T600'], 'Turing'),
            (['GTX 10', 'TITAN X', 'P100', 'P40', 'P6'], 'Pascal'),
            (['GTX 9', 'TITAN M', 'M60', 'M40'], 'Maxwell'),
            (['GTX 7', 'GTX 6', 'K80', 'K40'], 'Kepler'),
            (['V100'], 'Volta'),
        ]
        
        for patterns, arch in arch_patterns:
            if any(pattern in name for pattern in patterns):
                return arch
        
        return 'Unknown'
    
    def _add_performance(self, handle, data):
        """先进性能指标"""
        # 利用率
        if util := safe_get(pynvml.nvmlDeviceGetUtilizationRates, handle):
            data['utilization'] = float(util.gpu)
            data['memory_utilization'] = float(util.memory)
        
        # Performance state
        if pstate := safe_get(pynvml.nvmlDeviceGetPerformanceState, handle):
            data['performance_state'] = f'P{pstate}'
        
        # 计算模式
        if mode := safe_get(pynvml.nvmlDeviceGetComputeMode, handle):
            modes = {0: 'Default', 1: 'Exclusive Thread', 
                    2: 'Prohibited', 3: 'Exclusive Process'}
            data['compute_mode'] = modes.get(mode, 'Unknown')
    
    def _add_memory(self, handle, data, gpu_id, current_time):
        """内存指标"""
        if mem := safe_get(pynvml.nvmlDeviceGetMemoryInfo, handle):
            data['memory_used'] = to_mib(mem.used)
            data['memory_total'] = to_mib(mem.total)
            data['memory_free'] = to_mib(mem.free)
            
            # 计算变化率
            if gpu_id in self.previous_samples:
                prev = self.previous_samples[gpu_id]
                if 'memory_used' in prev:
                    dt = current_time - self.last_sample_time.get(gpu_id, current_time)
                    if dt > 0:
                        delta = data['memory_used'] - prev['memory_used']
                        data['memory_change_rate'] = float(delta / dt)
        
        # BAR1 内存
        if bar1 := safe_get(pynvml.nvmlDeviceGetBAR1MemoryInfo, handle):
            data['bar1_memory_used'] = to_mib(bar1.bar1Used)
            data['bar1_memory_total'] = to_mib(bar1.bar1Total)
    
    def _add_power_thermal(self, handle, data):
        """功率和温度指标"""
        self._add_temperature(handle, data)
        self._add_power(handle, data)
        self._add_fan_speeds(handle, data)
        self._add_throttling(handle, data)
    
    def _add_temperature(self, handle, data):
        """温度指标"""
        if temp := safe_get(pynvml.nvmlDeviceGetTemperature, handle, pynvml.NVML_TEMPERATURE_GPU):
            data['temperature'] = float(temp)
        
        if temp_mem := safe_get(pynvml.nvmlDeviceGetTemperature, handle, 1):
            if temp_mem > 0:
                data['temperature_memory'] = float(temp_mem)
    
    def _add_power(self, handle, data):
        """功率指标"""
        if power := safe_get(pynvml.nvmlDeviceGetPowerUsage, handle):
            data['power_draw'] = to_watts(power)
        
        if limit := safe_get(pynvml.nvmlDeviceGetPowerManagementLimit, handle):
            data['power_limit'] = to_watts(limit)
        
        if constraints := safe_get(pynvml.nvmlDeviceGetPowerManagementLimitConstraints, handle):
            if isinstance(constraints, tuple) and len(constraints) >= 2:
                data['power_limit_min'] = to_watts(constraints[0])
                data['power_limit_max'] = to_watts(constraints[1])
        
        if energy := safe_get(pynvml.nvmlDeviceGetTotalEnergyConsumption, handle):
            data['energy_consumption'] = float(energy) / 1000.0
            data['energy_consumption_wh'] = float(energy) / 3600000.0
    
    def _add_fan_speeds(self, handle, data):
        """风扇速度指标"""
        if fan := safe_get(pynvml.nvmlDeviceGetFanSpeed, handle):
            data['fan_speed'] = float(fan)
        
        if hasattr(pynvml, 'nvmlDeviceGetNumFans') and hasattr(pynvml, 'nvmlDeviceGetFanSpeed_v2'):
            if num_fans := safe_get(pynvml.nvmlDeviceGetNumFans, handle):
                fans = []
                for i in range(num_fans):
                    if speed := safe_get(pynvml.nvmlDeviceGetFanSpeed_v2, handle, i):
                        fans.append(float(speed))
                if fans:
                    data['fan_speeds'] = fans
    
    def _add_throttling(self, handle, data):
        """时钟节流指标"""
        if throttle := safe_get(pynvml.nvmlDeviceGetCurrentClocksThrottleReasons, handle):
            throttle_map = [
                (pynvml.nvmlClocksThrottleReasonGpuIdle, 'GPU 空闲'),
                (pynvml.nvmlClocksThrottleReasonApplicationsClocksSetting, '应用时钟设置'),
                (pynvml.nvmlClocksThrottleReasonSwPowerCap, '软件功率限制'),
                (pynvml.nvmlClocksThrottleReasonHwSlowdown, '硬件降速'),
                (pynvml.nvmlClocksThrottleReasonSwThermalSlowdown, '软件热降速'),
                (pynvml.nvmlClocksThrottleReasonHwThermalSlowdown, '硬件热降速'),
                (pynvml.nvmlClocksThrottleReasonHwPowerBrakeSlowdown, '功率刹车降速'),
            ]
            reasons = [label for flag, label in throttle_map if throttle & flag]
            data['throttle_reasons'] = ', '.join(reasons) if reasons else '无'
    
    def _add_clocks(self, handle, data):
        """时钟速度指标"""
        clock_types = [
            ('clock_graphics', pynvml.NVML_CLOCK_GRAPHICS),
            ('clock_sm', pynvml.NVML_CLOCK_SM),
            ('clock_memory', pynvml.NVML_CLOCK_MEM),
            ('clock_video', pynvml.NVML_CLOCK_VIDEO),
        ]
        
        for key, clock_type in clock_types:
            # 当前时钟
            if clock := safe_get(pynvml.nvmlDeviceGetClockInfo, handle, clock_type):
                data[key] = float(clock)
            
            # 最大时钟
            if max_clock := safe_get(pynvml.nvmlDeviceGetMaxClockInfo, handle, clock_type):
                data[f'{key}_max'] = float(max_clock)
            
            # 应用时钟（用户/驱动设置的目标时钟）
            if app_clock := safe_get(pynvml.nvmlDeviceGetApplicationsClock, handle, clock_type):
                data[f'{key}_app'] = float(app_clock)
            
            # 默认应用时钟
            if default_clock := safe_get(pynvml.nvmlDeviceGetDefaultApplicationsClock, handle, clock_type):
                data[f'{key}_default'] = float(default_clock)
        
        # 支持的内存时钟（所有可用时钟速度的列表）
        try:
            if mem_clocks := safe_get(pynvml.nvmlDeviceGetSupportedMemoryClocks, handle):
                if mem_clocks and len(mem_clocks) > 0:
                    data['supported_memory_clocks'] = [float(c) for c in mem_clocks[:10]]  # Limit to first 10
        except:
            pass
    
    def _add_connectivity(self, handle, data):
        """PCIe 连接指标"""
        
        pcie_metrics = [
            ('pcie_gen', pynvml.nvmlDeviceGetCurrPcieLinkGeneration),
            ('pcie_gen_max', pynvml.nvmlDeviceGetMaxPcieLinkGeneration),
            ('pcie_width', pynvml.nvmlDeviceGetCurrPcieLinkWidth),
            ('pcie_width_max', pynvml.nvmlDeviceGetMaxPcieLinkWidth),
        ]
        
        for key, func in pcie_metrics:
            if value := safe_get(func, handle):
                data[key] = str(value)
        
        # PCIe 吞吐量
        if tx := safe_get(pynvml.nvmlDeviceGetPcieThroughput, handle,
                         pynvml.NVML_PCIE_UTIL_TX_BYTES):
            data['pcie_tx_throughput'] = float(tx)
        
        if rx := safe_get(pynvml.nvmlDeviceGetPcieThroughput, handle,
                         pynvml.NVML_PCIE_UTIL_RX_BYTES):
            data['pcie_rx_throughput'] = float(rx)
        
        # PCI 信息
        if pci := safe_get(pynvml.nvmlDeviceGetPciInfo, handle):
            data['pci_bus_id'] = decode_bytes(pci.busId)
    
    def _add_media_engines(self, handle, data):
        """编码器/解码器指标"""
        # 编码器
        if enc := safe_get(pynvml.nvmlDeviceGetEncoderUtilization, handle):
            if isinstance(enc, tuple) and len(enc) >= 2:
                data['encoder_utilization'] = float(enc[0])
        
        try:
            if sessions := pynvml.nvmlDeviceGetEncoderSessions(handle):
                data['encoder_sessions'] = len(sessions)
                if fps := [s.averageFps for s in sessions if hasattr(s, 'averageFps')]:
                    data['encoder_fps'] = float(sum(fps) / len(fps))
        except:
            pass
        
        # 解码器
        if dec := safe_get(pynvml.nvmlDeviceGetDecoderUtilization, handle):
            if isinstance(dec, tuple) and len(dec) >= 2:
                data['decoder_utilization'] = float(dec[0])
        
        try:
            if sessions := pynvml.nvmlDeviceGetDecoderSessions(handle):
                data['decoder_sessions'] = len(sessions)
        except:
            pass
    
    def _add_health_status(self, handle, data):
        """ECC 和健康指标"""
        try:
            if ecc := pynvml.nvmlDeviceGetEccMode(handle):
                if ecc[0]:
                    data['ecc_enabled'] = True
                    
                    # ECC errors
                    if err := safe_get(pynvml.nvmlDeviceGetTotalEccErrors, handle,
                                      pynvml.NVML_MEMORY_ERROR_TYPE_CORRECTED,
                                      pynvml.NVML_VOLATILE_ECC):
                        data['ecc_errors_corrected'] = int(err)
        except:
            pass
        
        # Retired pages
        try:
            if pages := pynvml.nvmlDeviceGetRetiredPages(handle,
                        pynvml.NVML_PAGE_RETIREMENT_CAUSE_DOUBLE_BIT_ECC_ERROR):
                data['retired_pages'] = len(pages)
        except:
            pass
    
    def _add_advanced(self, handle, data):
        """高级指标"""
        if mode := safe_get(pynvml.nvmlDeviceGetPersistenceMode, handle):
            data['persistence_mode'] = 'Enabled' if mode else 'Disabled'
        
        if display := safe_get(pynvml.nvmlDeviceGetDisplayActive, handle):
            data['display_active'] = bool(display)
        
        if multi := safe_get(pynvml.nvmlDeviceGetMultiGpuBoard, handle):
            data['multi_gpu_board'] = bool(multi)
        
        if procs := safe_get(pynvml.nvmlDeviceGetGraphicsRunningProcesses, handle, default=[]):
            data['graphics_processes_count'] = len(procs)
        
        self._add_mig_mode(handle, data)
        self._add_nvlink(handle, data)
    
    def _add_mig_mode(self, handle, data):
        """MIG 模式指标"""
        if hasattr(pynvml, 'nvmlDeviceGetMigMode'):
            if mig := safe_get(pynvml.nvmlDeviceGetMigMode, handle):
                if isinstance(mig, tuple) and len(mig) >= 2:
                    data['mig_mode_current'] = 'Enabled' if mig[0] else 'Disabled'
                    data['mig_mode_pending'] = 'Enabled' if mig[1] else 'Disabled'
    
    def _add_nvlink(self, handle, data):
        """NVLink 指标"""
        if hasattr(pynvml, 'nvmlDeviceGetNvLinkState'):
            nvlinks = []
            active_count = 0
            
            for link_id in range(6):
                if state := safe_get(pynvml.nvmlDeviceGetNvLinkState, handle, link_id):
                    link_data = {'id': link_id, 'active': bool(state)}
                    
                    if hasattr(pynvml, 'nvmlDeviceGetNvLinkCapability'):
                        if hasattr(pynvml, 'NVML_NVLINK_CAP_P2P_SUPPORTED'):
                            if caps := safe_get(pynvml.nvmlDeviceGetNvLinkCapability, handle, 
                                              link_id, pynvml.NVML_NVLINK_CAP_P2P_SUPPORTED):
                                link_data['p2p_supported'] = bool(caps)
                    
                    nvlinks.append(link_data)
                    if state:
                        active_count += 1
                else:
                    break
            
            if nvlinks:
                data['nvlink_links'] = nvlinks
                data['nvlink_active_count'] = active_count

