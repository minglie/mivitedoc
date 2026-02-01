# Zynq 与 Zynq UltraScale+ MPSoC 的的 AXI 接口对比

## 1. 总体架构差异
- **Zynq-7000**  
  - 双核 ARM Cortex-A9 (PS) + 7 系列 FPGA (PL)  
  - PS–PL 之间主要通过 **AXI 总线**通讯  
  - 提供 **GP (General Purpose)**、**HP (High Performance)**、**ACP (Accelerator Coherency Port)** 等接口  

- **ZynqMP (UltraScale+ MPSoC)**  
  - 四核 ARM Cortex-A53 + 双核 Cortex-R5 + Mali GPU + UltraScale+ FPGA  
  - AXI 接口更多，带宽更大，支持 **缓存一致性**  
  - 新增 **HPC (High Performance Coherent)** 等接口  

---

## 2. Zynq-7000 AXI 接口汇总

| 接口类型       | 数量 | 位宽   | 方向          | 用途 |
|----------------|------|--------|---------------|------|
| M_AXI_GP0/1    | 2    | 32-bit | PS → PL       | PS 发起访问 PL 外设 |
| S_AXI_GP0/1    | 2    | 32-bit | PL → PS       | PL 外设映射到 PS 地址空间 |
| S_AXI_ACP      | 1    | 64-bit | PL → PS       | PL 访问 PS 缓存一致的内存 |
| M_AXI_HP0~3    | 4    | 64-bit | PL → PS DDR   | PL 高速访问 PS DDR |
| AXI-DMA        | 外设 | AXI-MM / AXI-Stream | 双向 | PS 与 PL 通过 DMA 搬运数据 |
| AXI-Stream     | N/A  | 可配置 | 单向          | 数据流接口（ADC、DSP 等） |

---

## 3. ZynqMP (UltraScale+ MPSoC) AXI 接口汇总

| 接口类型            | 数量 | 位宽      | 方向        | 用途 |
|---------------------|------|-----------|-------------|------|
| M_AXI_GP0/1         | 2    | 32-bit    | PS → PL     | PS 发起访问 PL |
| S_AXI_GP0/1         | 2    | 32-bit    | PL → PS     | PL 外设映射到 PS |
| M_AXI_HPM0/1_FPD    | 2    | 128-bit   | PS → PL     | 高性能主机接口（A53 FPD 域） |
| S_AXI_HPC0/1_FPD    | 2    | 128-bit   | PL → PS     | 高性能缓存一致接口 |
| S_AXI_HP0~3_FPD     | 4    | 128-bit   | PL → PS DDR | 高性能接口（非缓存一致） |
| S_AXI_HPC0/1_LPD    | 2    | 32/64-bit | PL → PS     | 低功耗域 Cache-Coherent 接口（R5 域） |
| M_AXI_HPM0/1_LPD    | 2    | 32/64-bit | PS → PL     | R5 低功耗域 Master |
| ACP                 | 1    | 64/128-bit| PL → PS     | 加速器一致性端口 |
| AXI-DMA/CDMA/VDMA   | 外设 | AXI-MM / AXI-Stream | 双向 | 批量数据搬运 |
| AXI-Stream          | N/A  | 可配置    | 单向        | 数据流接口（视频、RF-ADC 等） |

---

## 4. 核心对比

| 特性           | Zynq-7000           | ZynqMP (UltraScale+)   |
|----------------|---------------------|------------------------|
| GP 接口        | 2×M + 2×S，32-bit   | 同样存在，但增强 HPM/HPC |
| HP 接口        | 4×HP，64-bit        | 4×HP_FPD，128-bit，带宽翻倍 |
| ACP 接口       | 1×64-bit            | 1×128-bit，更强一致性 |
| Cache 一致性   | 仅 ACP              | HPC/ACP 全面支持 |
| PS 主核        | Cortex-A9 (2核)     | Cortex-A53 (4核) + R5 (2核) |
| DDR            | DDR3，64-bit        | DDR4/LPDDR4，更快 |
| AXI-Stream     | 主要自定义          | 大量用于视频/高速数据流 |

---


# Zynq & ZynqMP AXI 总线框图

## 1. Zynq-7000

             +-------------------+
             |   Cortex-A9 (PS)  |
             +-------------------+
                  |   |   |   |
    --------------+   |   |   +---------------------------
    M_AXI_GP0/1 ------+   |                (PS → PL 32-bit)
    S_AXI_GP0/1 ----------+                (PL → PS 32-bit)
    S_AXI_ACP  --------------+             (PL → PS, Cache coherent 64-bit)
    M_AXI_HP0~3 ----------------------+    (PL → DDR, 64-bit High Perf)
                                         
             +-------------------+
             |       PL (FPGA)   |
             +-------------------+

    [AXI-DMA / AXI-Stream] : PS 与 PL 数据流搬运接口


---

## 2. Zynq UltraScale+ MPSoC (ZynqMP)

             +------------------------------------+
             |   Cortex-A53 (4x) + R5 (2x) (PS)   |
             +------------------------------------+
                  |     |     |     |     | 
    --------------+     |     |     |     +---------------------------
    M_AXI_GP0/1 --------+                         (PS → PL 32-bit)
    S_AXI_GP0/1 ----------+                       (PL → PS 32-bit)

    M_AXI_HPM0/1_FPD -----------+                 (PS A53 → PL, 128-bit High Perf)
    M_AXI_HPM0/1_LPD -----------+                 (PS R5 → PL, 32/64-bit Low Power)

    S_AXI_HPC0/1_FPD -----------+                 (PL → PS A53, Cache coherent 128-bit)
    S_AXI_HP0~3_FPD -------------+                (PL → DDR FPD, 128-bit High Perf)
    S_AXI_HPC0/1_LPD -----------+                 (PL → PS R5, Cache coherent 32/64-bit)

    ACP -------------------------+                (PL → PS, Cache coherent 128-bit)

             +-------------------+
             |        PL (FPGA)  |
             +-------------------+

    [AXI-DMA / CDMA / VDMA / Stream] : PS 与 PL 高速数据流接口（视频/信号处理）


---

## 3. 对比总结
- **Zynq-7000**：接口较少，HP = 64-bit，ACP = 64-bit  
- **ZynqMP**：接口更多，HP/HPC = 128-bit，高带宽 + Cache 一致性更强  
- **AXI-Stream**：两代都有，用于数据流（DMA/视频/ADC）


## 总结

- **Zynq-7000**：接口简洁，适合中等带宽和控制类任务。  
- **ZynqMP**：接口数量更多、位宽更大、缓存一致性更强，适合高带宽应用（视频处理、5G、AI 加速）。  
