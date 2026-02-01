# Zynq高级开发七项必修课

# 目录
- [第一课：AMP 异构多核与 FreeRTOS 实践](#第一课amp-异构多核与-freertos-实践)  
- [第二课：OpenAMP 与 RPMsg 高效通信](#第二课openamp-与-rpmsg-高效通信)  
- [第三课：多通道 AXI DMA 与零拷贝优化](#第三课多通道-axi-dma-与零拷贝优化)  
- [第四课：PS–PL 高性能互联与缓存一致性](#第四课pspl-高性能互联与缓存一致性)  
- [第五课：Linux 高级驱动与动态外设管理](#第五课linux-高级驱动与动态外设管理)  
- [第六课：部分动态重配置 (PR) 工程实战](#第六课部分动态重配置-pr-工程实战)  
- [第七课：HLS 与 AI 加速应用](#第七课hls-与-ai-加速应用)  
- [自检规则](#自检规则)  
- [PS环境](#ps环境)  

---

## 第一课：AMP 异构多核与 FreeRTOS 实践
**目标**：掌握 ARM 双核异构运行，Linux+裸机/FreeRTOS 协同。  

1.0 配置 FSBL / u-boot，仅启动 CPU0（Linux），CPU1 保持挂起  
1.1 CPU1 运行裸机/FreeRTOS 程序，完成定时任务（如 LED 闪烁/串口打印）  
1.2 设置 DDR carve-out 内存，确保 Linux 与 FreeRTOS 内存独立  
1.3 验证 cache flush/invalidate，确保跨核数据一致  

---

## 第二课：OpenAMP 与 RPMsg 高效通信
**目标**：建立 Linux ↔ FreeRTOS 的高效消息机制。  

2.0 在 Linux 中启用 `remoteproc` 和 `rpmsg` 驱动  
2.1 CPU1 端移植 OpenAMP，运行 echo_test  
2.2 Linux 通过 `/dev/rpmsg*` 与 CPU1 双向通信  
2.3 测试消息延迟与吞吐，分析适合的应用场景（实时控制/日志传输等）  

---

## 第三课：多通道 AXI DMA 与零拷贝优化
**目标**：实现高速数据搬运与内存优化。  

3.0 配置多通道 AXI DMA，支持 MM2S+S2MM 并行  
3.1 使用 SG（Scatter-Gather）模式批量传输  
3.2 在 Linux 中实现 `udmabuf`/`dma-buf`，支持零拷贝 mmap 到用户态  
3.3 压测 DMA 吞吐量（≥800 MB/s），验证长时间稳定运行  

---

## 第四课：PS–PL 高性能互联与缓存一致性
**目标**：发挥 Zynq PS–PL 总线最大性能。  

4.0 使用 HP0~HP3 并行写入 DDR，测得实际带宽  
4.1 使用 ACP 接口，保持与 CPU cache 一致性，避免 flush  
4.2 启用 DDR QoS/仲裁，验证 CPU 与 DMA 并发不饥饿  
4.3 对比 HP vs ACP 带宽与延迟，理解场景适配  

---

## 第五课：Linux 高级驱动与动态外设管理
**目标**：掌握复杂驱动开发与动态加载技巧。  

5.0 编写 DMA+中断结合的驱动，支持异步回调  
5.1 使用 Device Tree Overlay，在部分重配置后动态加载外设驱动  
5.2 混合驱动模式：部分寄存器通过 UIO mmap，核心功能由驱动管理  
5.3 对比 UIO / platform driver / VFIO 在延迟与吞吐上的差异  

---

## 第六课：部分动态重配置 (PR) 工程实战
**目标**：实现不停机更换逻辑区域。  

6.0 在 Vivado 定义静态逻辑与 PR region  
6.1 生成多份 partial bitstream，Linux 下加载切换  
6.2 验证静态系统运行不中断，动态替换滤波/加速器模块  
6.3 测试重配置时间与系统稳定性  

---

## 第七课：HLS 与 AI 加速应用
**目标**：掌握高层次综合与 DPU 加速的结合。  

7.0 使用 Vitis HLS 将 C++ 算法转成 AXI4 IP 核  
7.1 设计 AXI Stream pipeline，结合 DMA 形成数据流处理  
7.2 部署 DPU Overlay，运行 TensorFlow Lite 模型  
7.3 对比 CPU-only 与 DPU 加速的延迟与吞吐差异  

---

# 自检规则

### 1) AMP/OpenAMP
- [ ] CPU0/CPU1 正确分离启动  
- [ ] RPMsg 通信稳定，丢包率 <0.1%  
- [ ] 内存 carve-out 与 cache 管理无异常  

### 2) AXI DMA
- [ ] 多通道并发 > 1 GB/s  
- [ ] SG 传输支持大批量包  
- [ ] 零拷贝 mmap 测试通过  

### 3) HP/ACP/QoS
- [ ] HP/ACP 带宽测试曲线清晰  
- [ ] QoS 仲裁有效，CPU 不被饿死  
- [ ] Cache 一致性验证成功  

### 4) Linux 驱动
- [ ] Overlay 动态加载驱动成功  
- [ ] 中断+Dma 回调正常触发  
- [ ] mmap 性能对比完成  

### 5) PR
- [ ] Partial bitstream 切换 < 100 ms  
- [ ] 静态逻辑完全不中断  
- [ ] 多个 PR 模块验证正确  

### 6) HLS/AI
- [ ] HLS IP 正确生成并集成  
- [ ] DPU Overlay 成功加载模型  
- [ ] 性能对比数据完整  

---

# PS环境

**A（AMP/FreeRTOS）**
- [ ] FreeRTOS 定时任务 jitter < 1%  
- [ ] RPMsg 延迟 < 50 µs  

**B（Linux）**
- [ ] remoteproc 驱动稳定加载 CPU1  
- [ ] AXI DMA 零拷贝接口可用  
- [ ] PR + Overlay 热插拔无系统崩溃  
- [ ] DPU 成功运行 AI Demo  
