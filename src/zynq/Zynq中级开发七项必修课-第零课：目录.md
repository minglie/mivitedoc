# Zynq中级开发七项必修课

这七项主要关注PL和PS如何进行通讯。
相关参考
- [vivado和quartus脚本](vivado和quartus脚本.md)

- [Zynq PL中断](zynq的PL中断.md)

- [FPGA中的亚稳态与跨时钟域数据撕裂现象](FPGA中的亚稳态与跨时钟域数据撕裂现象.md)

- [Zynq AXI-Lite 总线原理与实现](Zynq%20AXI-Lite%20总线原理与实现.md)

- [状态机顺序化描述——串口与 AXI4 协议流程建模](状态机顺序化描述——串口与%20AXI4%20协议流程建模.md)

- [基于 AXI-Lite 实现可扩展的硬件函数 RPC 框架](基于%20AXI-Lite%20实现可扩展的硬件函数%20RPC%20框架（附完整源码）.md)

- [基于串口实现可扩展的硬件函数 RPC 框架](基于串口实现可扩展的硬件函数%20RPC%20框架(附完整%20Verilog%20源码).md)

- [一种极简稳定的单线通讯协议—ming_msl](一种极简稳定的单线通讯协议---ming_msl.md)

- [基于rtdef.h的轻量级设备管理、终端、协程框架](基于%20rtdef.h%20的轻量级设备管理、终端、协程与应用管理框架设计.md)
- [Vivado常用IP](Vivado常用IP.md)


# 目录
- [第一课：事件采集与FIFO队列](Zynq中级开发七项必修课-第一课：事件采集与FIFO队列.md)
- [第二课：M_AXI_GP0 驱动 AXI-Lite 外设](Zynq中级开发七项必修课-第二课：M_AXI_GP0%20驱动%20AXI-Lite%20外设.md)
- [第三课：S_AXI_GP0 主动访问 PS 地址空间](Zynq中级开发七项必修课-第三课：S_AXI_GP0%20主动访问%20PS%20地址空间.md)
- [第四课：S_AXI_HP0 高速端口访问 DDR](Zynq中级开发七项必修课-第四课：S_AXI_HP0%20高速端口访问%20DDR.md)
- [第五课：S_AXI_ACP 一致性接口实践](Zynq中级开发七项必修课第五课：S_AXI_ACP%20一致性接口实践.md)
- [第六课：AXI DMA (PS→PL) 数据下发](Zynq中级开发七项必修课-第六课：AXI%20DMA%20(PS→PL)%20数据下发.md)
- [第七课：AXI DMA (PL→PS) 数据上传](Zynq中级开发七项必修课-第七课-AXI_DMA(PL-PS).md)
- [自检规则](#自检规则)
- [PS环境](#ps环境)



---


## 第一课：事件采集与FIFO队列
**目标**：掌握事件采集、队列缓存与可视化验证。  

1.0 实现 `mi_key` 按键模块，支持按下、松开、单击、双击、长按等事件  
1.1 搭建 `evt_fifo` 队列，存储 `[时间戳,事件]` (8字节)  
1.2 使用数码管显示 FIFO 元素个数及满/空状态（直观验证 FIFO 深度）  
1.3 独立按键触发：从 `evt_fifo` 取出事件，打包后串口发送  

---

## 第二课：M_AXI_GP0 驱动 AXI-Lite 外设
**目标**：理解 PS 通过 AXI-Lite 主接口访问 PL 外设的流程。  

1.0 设计 AXI-Lite Slave 外设（示例：写入 a，存储 a+1 的“自增 RAM”）  
1.1 通过 `M_AXI_GP0` 在 PS 侧读写该外设，验证数据交互  

---

## 第三课：S_AXI_GP0 主动访问 PS 地址空间
**目标**：掌握 PL 作为 AXI-Lite Master 主动访问 PS 内存的能力。  

1.0 编写 AXI-Lite Master：按键计数 → 写入 PS 内存  
1.1 PL 触发中断 → PS 响应并串口打印计数值  

---

## 第四课：S_AXI_HP0 高速端口访问 DDR
**目标**：理解 PL 通过 AXI-Full Master 高速写入 DDR 的方法。  

1.0 使用 AXI Master 将数据（如按键计数值）写入 DDR  
1.1 PL 触发中断 → PS 从 DDR 读取并串口打印结果  

---

## 第五课：S_AXI_ACP 一致性接口实践
**目标**：体验 ACP 端口与 PS Cache 一致性的特性。  

1.0 通过 ACP 端口写入 DDR，保持与 CPU 缓存一致性  
1.1 PS 直接读取 DDR 数据，验证一致性机制  

---

## 第六课：AXI DMA (PS→PL) 数据下发
**目标**：掌握 AXI DMA MM2S 通路，理解 PS→PL 数据搬运与外设驱动。  

1.0 使用 ESP32 GPIO 模拟 I²C，点亮 ASCII 字符（作为参考基准实验）  
1.1 在 Vitis 中调用 AXI IIC（PS 外设）驱动显示 ASCII  
1.2 在 PL 中用 Verilog 自写 I²C 控制器，驱动显示 ASCII  
1.3 构建 `stream2iic` 模块（AXIS Slave），实现流式 ASCII 输出  
1.4 验证完整链路：  
   PS(DDR buffer) → AXI DMA (MM2S) → AXIS Data FIFO → `stream2iic`(AXIS-S) → OLED 显示结果  

---

## 第七课：AXI DMA (PL→PS) 数据上传
**目标**：掌握 AXI DMA S2MM 通路，理解 PL→PS 数据搬运。  

1.0 串口数据包进入 PL → 转换为 AXIS 数据流 (32bit)  
1.1 AXI DMA (S2MM) 将数据写入 DDR  
1.2 PS 读取 DDR 数据并进行校验  

---

# 自检规则

## 1) AXI4-Lite（PS ↔ PL）
- [ ] 写/读握手正确：AW/W 独立或同时到来均可（无锁死/早拉 ready/多拍脉冲错误）  
- [ ] 非对齐/半字节写有策略（禁用或依据 WSTRB 正确掩码）  
- [ ] 复位后寄存器有可验证默认值；包含版本/ID 寄存器  
- [ ] 地址解码与位宽计算自动化（使用 `$clog2`，不越界）  

## 2) PL 发起访问（S_AXI_GP0 或自定义 AXI-Lite Master）
- [ ] 写/读路径均可用，错误/超时有处理或文档化限制  
- [ ] 不同时钟域可靠（CDC：双触发器/握手/灰码等方案明确）  
- [ ] 事务有完成指示/状态寄存器，便于调试与容错  

## 3) PL → PS 中断
- [ ] GIC 配置正确，电平/脉冲选择合理；不丢不重触发  
- [ ] 具备去抖/节流（写 1 清、事件计数/掩码等）  
- [ ] ILA/日志能复现实例并定位一次真实故障  

## 4) HP 口到 DDR（AXI4-Full）
- [ ] 突发 INCR 长度与地址对齐正确（无跨界/未对齐）  
- [ ] 连续大负载（≥数十 MB）写读校验零错误  
- [ ] 时序约束完整（`create_clock`/`set_false_path`/多域 CDC 标注），实现收敛  

## 5) AXI DMA（MM2S / S2MM）
- [ ] 明确两向数据流向与连接，完成双向闭环验证  
- [ ] 裸机/Linux 下缓存刷写/失效正确（无“偶发旧数据”）  
- [ ] 对包长/对齐/链式（非 SG 也可）有说明与测试用例  

## 6) ACP / 缓存一致性
- [ ] 说清 ACP 与 HP 差别与适用场景  
- [ ] 演示“一致性路径”用例或明确其限制与注意事项  

## 7) 工程化与可复现
- [ ] 一键重建（TCL/脚本/版本锁定）  
- [ ] 完整文档：寄存器表、地址映射、中断描述、测试步骤  
- [ ] 记录边界与失败场景（FIFO 溢出、DMA 错误响应、超时）  

---

# PS环境

**A（裸机）**
- [ ] PS → DMA → PL（轻处理/搬运）→ DMA → PS，双向连续≥100 次  
- [ ] 随机长度/对齐，零错误；中断驱动，无 busy-wait  

**B（Linux）**
- [ ] UIO 或简易驱动 + 设备树  
- [ ] 正确处理缓存与用户态校验工具闭环通过  
