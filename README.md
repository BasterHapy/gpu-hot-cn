<div align="center">

# GPU Hot

实时 NVIDIA GPU 监控仪表盘。基于 Web，无需 SSH。

[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![NVIDIA](https://img.shields.io/badge/NVIDIA-GPU-76B900?style=flat-square&logo=nvidia&logoColor=white)](https://www.nvidia.com/)

<img src="gpu-hot.png" alt="GPU Hot Dashboard" width="800" />

</div>

---
## 声明
[gpu-hot](https://github.com/psalias2006/gpu-hot)项目的中文分支

## 使用方法

使用相同的 Docker 镜像可监控单机或整个集群。

**单机：**
```bash
docker run -d --gpus all -p 1312:1312 ghcr.io/psalias2006/gpu-hot:latest
```

**多机：**
```bash
# 在每台 GPU 服务器上运行
docker run -d --gpus all -p 1312:1312 -e NODE_NAME=$(hostname) ghcr.io/psalias2006/gpu-hot:latest

# 在一个不需要 GPU 的汇聚机器上运行
docker run -d -p 1312:1312 -e GPU_HOT_MODE=hub -e NODE_URLS=http://server1:1312,http://server2:1312,http://server3:1312 ghcr.io/psalias2006/gpu-hot:latest
```

打开 `http://localhost:1312`

**旧款 GPU：** 如果指标未显示，请添加 `-e NVIDIA_SMI=true`。

**进程监控：** 添加 `--init --pid=host` 可查看进程名称。注意：这会允许容器访问宿主机进程信息。

**从源码运行：**
```bash
git clone https://github.com/psalias2006/gpu-hot
cd gpu-hot
docker-compose up --build
```

**依赖要求：** Docker + [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

---

## 功能

- 实时指标（亚秒级）
- 自动多 GPU 检测
- 进程监控（PID、内存占用）
- 历史图表（利用率、温度、功耗、频率）
- 系统指标（CPU、内存）
- 可扩展至 1 到 100+ GPUs

**采集指标：** 利用率、温度、显存、功耗、风扇转速、频率、PCIe 信息、P-State、节流状态、编码/解码会话

---

## 配置

**环境变量：**
```bash
NVIDIA_VISIBLE_DEVICES=0,1     # 指定的 GPU（默认：全部）
NVIDIA_SMI=true                # 为旧 GPU 强制使用 nvidia-smi 模式
GPU_HOT_MODE=hub               # 设置为 'hub' 以启用多节点聚合（默认：单节点）
NODE_NAME=gpu-server-1         # 节点显示名称（默认：hostname）
NODE_URLS=http://host:1312...  # 以逗号分隔的节点 URL（hub 模式下必填）
```

**后端（core/config.py）：**
```python
UPDATE_INTERVAL = 0.5  # 轮询间隔
PORT = 1312            # 服务器端口
```

---

## API

### HTTP
```bash
GET /              # 仪表盘
GET /api/gpu-data  # JSON 格式的指标数据
```

### WebSocket
```javascript
socket.on('gpu_data', (data) => {
  // 每 0.5s 更新（可配置）
  // 包含: data.gpus, data.processes, data.system
});
```
---

## 项目结构

```bash
gpu-hot/
├── app.py                      # Flask + WebSocket 服务器
├── core/
│   ├── config.py               # 配置
│   ├── monitor.py              # NVML GPU 监控
│   ├── handlers.py             # WebSocket 处理器
│   ├── routes.py               # HTTP 路由
│   └── metrics/
│       ├── collector.py        # 指标采集
│       └── utils.py            # 指标实用工具
├── static/
│   ├── js/
│   │   ├── charts.js           # 图表配置
│   │   ├── gpu-cards.js        # UI 组件
│   │   ├── socket-handlers.js  # WebSocket 与渲染
│   │   ├── ui.js               # 视图管理
│   │   └── app.js              # 初始化
│   └── css/styles.css
├── templates/index.html
├── Dockerfile
└── docker-compose.yml
```

---

## 故障排查

**未检测到 GPU：**
```bash
nvidia-smi  # 检查驱动是否正常
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi  # 测试 Docker 的 GPU 访问
```

**Hub 无法连接节点：**
```bash
curl http://node-ip:1312/api/gpu-data  # 测试连通性
sudo ufw allow 1312/tcp                # 检查防火墙
```

**性能问题：** 增大 core/config.py 中的 UPDATE_INTERVAL

---

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=psalias2006/gpu-hot&type=date&legend=top-left)](https://www.star-history.com/#psalias2006/gpu-hot&type=date&legend=top-left)

## 贡献

欢迎 PR。对重大变更请先打开 issue。

## 许可证

MIT - 参见 [LICENSE](LICENSE)

