[官网文档](https://docs.amd.com/search/all?query=axi_gpio&content-lang=en-US)


除 ZYNQ7 Processing System 以外，大多数可启停的 IP 都可以用 testbench 做仿真测试。
通过一次完整仿真，能熟悉每个 IP 的接口名称，通过波形、数据模式和日志输出，掌握它的时序关系、采样时机、输出条件以及握手规则，为后续系统集成减少出错。
# Vivado常用IP核对照表
| IP 名称                       | 中文名称         | 主要用途与功能简介                           | 常见应用场景               | 关键配置项说明                                   |
|------------------------------|------------------|---------------------------------------------|----------------------------|--------------------------------------------------|
| [**ZYNQ7 Processing System**](https://docs.amd.com/v/u/en-US/pg082-processing-system7) | ZYNQ7处理系统    | 配置 Zynq 的 PS（ARM 核）与 PL 的连接、DDR、外设等 | SoC 工程起点             | DDR/IO 配置、MIO 分配、时钟源、USB/UART/I2C/SD 启用与否 |
| **AXI Interconnect**        | AXI 互联       | 将多个 AXI 主/从设备连接在一起，支持 Full/Lite 等接口 | 多外设挂载、主设备接多个从设备      | 主/从接口个数、时序优化选项                            |
| [**AXI GPIO**](https://docs.amd.com/v/u/1.01b-English/ds744_axi_gpio)                | AXI通用IO      | 通过 AXI 控制 GPIO 输入输出                 | LED 控制、按键输入          | IO方向、位宽、是否三态                              |
| [**AXI BRAM Controller**](https://docs.amd.com/v/u/en-US/ds777_axi_bram_ctrl)     | AXI BRAM 控制器 | AXI 接口访问 Block RAM                  | 内部数据缓存、共享数据区         | BRAM 位宽匹配、端口模式                            |
| **Block Memory Generator**  | BRAM生成器      | 生成片上 Block RAM，可读写、初始化、单/双口         | 存储 LUT、ROM、FIFO、缓存   | 存储深度、数据位宽、是否初始化、时序模型                      |
| [**AXI UART Lite**](https://docs.amd.com/v/u/en-US/axi_uartlite_ds741)           | AXI 串口（轻量版）  | 实现简单串口通信（无 FIFO，速率不可变）              | UART调试、串口命令交互        | 波特率设置、FIFO 深度、使能中断                        |
| **AXI UART 16550**          | AXI 串口（全功能）  | 兼容16550 UART，带 FIFO，可变速             | Linux 控制串口           | 中断使能、FIFO 深度、控制寄存器开放                      |
| [**AXI Timer**](https://docs.amd.com/v/u/en-US/axi_timer_ds764)               | AXI 定时器      | 提供可配置的定时器/计数器功能                     | 精准延时、定时中断            | 周期设置、自动重载、中断配置                            |
|[ **AXI DMA**](https://docs.amd.com/r/en-US/pg021_axi_dma/Introduction)                 | AXI直接存储访问    | 实现内存与设备之间高速数据传输                     | PS↔PL 数据流、高速采集       | Scatter-Gather 使能、MM2S/S2MM 配置            |
| [**Processor System Reset**](https://docs.amd.com/v/u/en-US/pg164-proc-sys-reset)  | PS复位控制器      | 提供对系统中复位信号的同步与管理                    | PS/PL同步复位、AXI复位链     | 是否同步复位、外部复位输入                             |
| **Clocking Wizard**         | 时钟配置向导       | 生成指定频率的时钟（基于 PLL/MMCM）              | 多模块供时、频率匹配           | 输入频率、输出频率、相位、锁定信号                         |
| [**FIFO Generator**](https://docs.amd.com/v/u/en-US/fifo_generator_ds317)          | FIFO 生成器     | 创建异步/同步 FIFO，支持独立读写时钟域              | 数据缓存、异步传输            | 深度、位宽、是否显示空满、时钟域独立                        |
| **AXI Stream FIFO**         | AXIS FIFO    | 支持 AXI4-Stream 接口的 FIFO，自动握手        | 图像/数据采集流处理           | FIFO 深度、是否使能 TLAST、TKEEP                  |
| **AXI Stream Data FIFO**    | AXIS 数据 FIFO | 简化 AXIS 通信，带有 AXI-Lite 控制通道         | PL ↔ PS 的 AXIS 流     | 是否带 AXI-Lite 寄存器、FIFO 深度                  |
| **Concat**                  | 信号拼接器        | 将多个信号拼接为一个向量                        | 多中断线合并、中断控制器输入       | 输入数量、输出位宽                                 |
| **Interrupt Controller**    | 中断控制器        | 管理多个中断源，通过 AXI 与处理器通信               | GPIO/UART/Timer 中断汇总 | 中断数量、边沿/电平触发类型                            |
| **XADC Wizard**             | 片上ADC配置向导    | 配置 Zynq 的 XADC 模块，采集模拟量             | 电压监测、温度检测            | 通道选择、采样模式、时钟来源                            |
| **Video Timing Controller** | 视频时序控制器      | 生成 VGA/HDMI 等视频时序信号                 | 视频显示、图像采集            | 分辨率、同步信号极性、帧率等                            |
| **AXI IIC**                 | AXI I²C 控制器  | 实现 AXI 总线控制的 I2C 通信                 | 摄像头配置、EEPROM         | 地址宽度、时钟频率、中断设置                            |
| **AXI SPI**                 | AXI SPI 控制器  | 实现 AXI 总线控制的 SPI 通信                 | Flash 通信、外设控制        | 主/从模式、频率、极性、数据帧宽度                         |
| **ILA**                     | 集成逻辑分析仪      | 插入调试逻辑，可在运行时观测信号                    | 时序调试、信号验证            | Probe 数量、触发条件、采样深度                        |
| **VIO**                     | 虚拟 IO        | 通过 JTAG 动态输入输出信号                    | 手动控制、调试使能            | 输入输出位宽、默认值                                |
| **System ILA**              | 总线事务分析仪      | 支持 AXI/AXIS 等协议的总线数据抓取与解码           | AXI 协议调试、DMA 验证      | 支持协议种类、触发条件、采样深度                          |
| **AXI Data Width Converter** | AXI 数据宽度转换器   | 实现不同数据位宽主从之间的数据转换                  | AXI 接口适配            | 输入/输出位宽、打包/解包策略          |
| **AXI Clock Converter**     | AXI 时钟域转换器    | 在不同时钟域间进行 AXI 协议的握手与同步转换           | 不同模块异时钟通信           | 时钟频率比、同步深度               |
| **AXI Protocol Converter**  | AXI 协议转换器     | 在 AXI3/AXI4/AXI4-Lite 协议之间进行协议转换   | 不同设备协议兼容            | 协议类型转换、地址/数据配置           |
| **DSP48 Macro**             | 数字信号处理单元宏     | 使用 DSP48 Slice 进行定制加法、乘法、MAC 等运算   | 高速乘法、滤波器、FFT 等      | 运算模式、数据路径、复位、使能设置        |
| **FFT (LogiCORE)**          | 快速傅里叶变换核      | 实现一维 FFT 运算，可配合 AXI Stream 使用      | 频谱分析、信号处理           | 点数、缩放方式、资源/性能平衡策略        |
| **CORDIC**                  | 三角函数计算核       | 基于旋转向量算法进行 sin/cos/角度/平方根等计算       | 雷达、姿态解算、数字解调        | 运算类型、输入格式、流水线深度          |
| **MIG (Memory Interface Generator)** | DDR控制器生成器 | 生成 DDR3/DDR4 等控制器，可用于 PL 访问外部 DRAM | 高速数据缓冲、DMA 传输       | 设备类型、速率、位宽、地址映射、PLL 设置等  |
| **HLS IP (via Vitis HLS)** | 高层次综合生成的 IP   | C/C++ 转换而成的自定义功能模块（如滤波器、图像处理等）     | 加速计算模块、图像滤波         | 时序约束、接口类型、并行级别等          |
| **ICAP (Internal Configuration Access Port)** | 内部配置访问口 | 实现 PL 区域动态部分重配置（PR）                | 部分重配置、FPGA自恢复机制     | 地址宽度、时钟域、使能管脚            |
| **AXI Video Direct Memory Access (VDMA)** | AXI 视频DMA | 用于视频流与内存帧缓存之间的数据搬运（MM2S/S2MM） | 视频播放、HDMI 输出        | 分辨率、帧缓存深度、地址自动更新等        |
| **Video In to AXI4-Stream** | 视频转 AXIS      | 将外部视频数据采集转换为 AXI Stream 格式         | 摄像头接口、图像处理          | 数据格式、颜色空间、同步信号配置         |
| **AXI4-Stream to Video Out** | AXIS 转 视频输出 | 将 AXI4-Stream 视频流转换为 HDMI/VGA 时序输出 | 图像显示、视频播放           | 像素格式、分辨率、同步信号生成          |
| **Color Space Converter**   | 颜色空间转换器       | RGB↔YUV 等格式转换                      | 图像编码/解码、视频处理        | 输入输出格式、精度、转换矩阵           |
| **Gamma Correction**        | 伽马校正          | 图像亮度非线性调整                          | 视频增强                | LUT 模式或公式配置              |
| **AXI Ethernet Subsystem**  | AXI 以太网子系统    | 实现千兆以太网通信，可与 DMA/Buffer 配合使用       | 网络通信、Zynq PS ↔ 外部网口 | MAC 设置、PHY 类型、FIFO 宽度、速率 |
| **AXI SmartConnect**        | AXI 智能互联      | 自动仲裁 + 地址映射的 AXI 通信互联                | 多主多从互连替代 AXI Interconnect | 主从端口数量、协议兼容性、优化策略        |
| **AXI Crossbar**            | AXI 交叉开关互联    | 类似 SmartConnect 的可定制互联，但更低层级         | AXI 协议分发、定制互联             | 主从接口数量、地址段分配             |
| **AXI Register Slice**      | AXI 寄存器切片     | 在 AXI 通道间插入 pipeline stage，优化时序      | 长路径打 timing、跨 SLR         | 插入位置、支持通道（AW/W/B/AR/R）   |
| **AXI DataMover**           | AXI 数据搬移器     | 类似 AXI DMA，可通过 AXI Lite 配置传输任务       | 自定义 DMA、图像分块读写            | MM2S/S2MM 启用、地址更新方式、缓存深度 |
| **AXI4-Stream Data Width Converter** | AXIS 宽度转换器    | 转换 AXIS 数据总线的位宽（如 24bit↔32bit）       | 不同模块对接                    | 输入/输出数据位宽、TLAST 处理       |
| **AXI4-Stream Broadcaster** | AXIS 广播器      | 将一路 AXIS 数据分发到多路输出（复制）               | 多核处理结构、数据并行               | 输出通道数、TID/TDEST 设置       |
| **AXI4-Stream Combiner**    | AXIS 合并器      | 将多路 AXIS 输入数据合并为一路                   | 多数据源整合                    | 输入通道数、顺序策略、TLAST 处理      |
| **AXI4-Stream Switch**      | AXIS 交换开关     | 动态切换 AXIS 通道来源                       | 视频处理路径选择、多输入多输出系统         | 路由规则、动态控制方式（TDEST/寄存器）   |
| **AXI4-Stream Subset Converter** | AXIS 子集转换器    | 简化 AXIS 信号线（去掉 TKEEP/TID 等）          | 简化外设接口、节省逻辑               | 保留哪些信号、默认值设置             |
| **AXI Interrupt Controller**| AXI 中断控制器     | 汇聚并分发多个中断信号到处理器（PS 或 NMI）            | 多中断来源接入 PS                | 中断触发模式、级联设置              |
| **Interrupt Combiner**     | 中断合并器         | 将多个中断线合并成一个输出                        | GPIO/定时器/用户模块中断聚合         | 输入位数                     |
| **Soft Reset Logic**       | 软件复位模块        | 可通过 AXI Lite 写入某寄存器，触发复位信号           | 系统自恢复、手动重置                | 复位保持时间、触发条件              |
| **Reset Synchronizer**     | 复位同步器         | 将复位信号安全同步到目标时钟域                      | 多时钟系统统一复位                 | 输出复位宽度、同步级数              |
| **BAMAC (AXIS Monitor)**   | AXIS 总线分析器    | 监控 AXI4-Stream 信号并生成 Vivado ILA 可读数据 | AXIS 调试、数据流监测             | 接口选择、采样深度、触发条件           |
| **BUFG / BUFH / BUFR / BUFIO** | 时钟缓冲器         | 提供局部或全局时钟缓冲                        | 多模块供时、时钟规整               | 使能、方向、时钟域配置              |
| **MMCM**                   | 混合模式时钟管理器  | 支持倍频、分频、相位调节                       | 多时钟域系统                      | 倍频/分频系数、相位偏移             |
| **PLL**                    | 锁相环            | 稳定高速频率输出                            | 串行通信、GT 串行接口               | 倍频系数、容差设置                 |
| **ICAP**                  | 内部配置访问口       | 与 Bitstream 动态重配置结合                   | 部分重配置 PR                     | 时钟域、启动逻辑                   |
| **util_vector_logic**      | 向量逻辑运算器      | 多输入 AND/OR/XOR/NOT 运算                    | 中断合并、复位判断等                | 运算类型、输入数、位宽              |
| **util_reduced_logic**     | 归约逻辑器         | 向量归约为单比特（AND/OR/XOR）                 | 判断“全部有效”信号                 | 运算类型（AND/OR/XOR）             |
| **xlconcat**               | 向量拼接器         | 多路拼接为一宽位向量                         | 中断线汇聚、信号拼接                | 输入数量、位宽                      |
| **xlslice**                | 向量切片器         | 截取向量中的部分位                           | 地址提取、信号解码                  | 起始位、终止位                      |
| **xlconstant**             | 常量生成器         | 输出固定值（0 或 1，可设置位宽）               | 默认使能、软连接、AXI使能            | 输出常量值、位宽                   |
| **axis_data_fifo**         | AXIS 数据 FIFO     | 带 tvalid/tready 的 AXIS FIFO             | AXI-Stream 缓冲、延迟同步           | 深度、数据宽度、TLAST 支持等         |

# Vivado常用IP配置
## 🔶 1. FIFO Generator IP

> 用于跨时钟、缓冲数据、速率调节等。

| 配置项 (英文)                  | 中文翻译               | 推荐值 / 说明 |
|-------------------------------|------------------------|----------------|
| Write Width                   | 写数据位宽             | 8 / 16 / 32    |
| Write Depth                   | 写深度（FIFO 容量）    | 256 / 1024     |
| Read Width                    | 读数据位宽             | 与写宽一致     |
| Read Mode                     | 读取模式               | ✅ FWFT（首字穿透）|
| Output Registers              | 输出寄存器             | ✅ 打开改善时序 |
| Reset Pin                     | 是否启用复位引脚       | ✅ 一般需要     |
| Reset Type                    | 复位类型               | Synchronous Reset（同步） |
| Dout Reset Value              | 输出复位值             | 0x00           |
| Valid Flag                    | 有效数据标志           | ✅ FWFT 模式建议打开 |
| Overflow / Underflow Flag    | 溢出 / 下溢标志        | 按需启用       |
| Almost Full / Empty Flag     | 接近满 / 空标志        | 可用于数据调度 |
| Programmable Full Type        | 可编程满标志类型       | 默认关闭       |
| Full Threshold Assert Value   | 满门限触发值           | 如 900         |
| Programmable Empty Type       | 可编程空标志类型       | 默认关闭       |
| Empty Threshold Assert Value  | 空门限触发值           | 如 4           |

---

## 💾 2. Block Memory Generator IP

> 片内 BRAM 存储器，用于缓存、状态寄存等。

| 配置项 (英文)             | 中文翻译               | 推荐值 / 说明 |
|--------------------------|------------------------|----------------|
| Memory Type              | 存储器类型             | Simple Dual Port RAM |
| Write Width              | 写数据位宽             | 8 / 16 / 32    |
| Write Depth              | 存储深度（字）         | 1024 / 2048    |
| Use Byte Write Enable    | 启用按字节写使能       | ✅ 多字节访问必开 |
| Load Init File           | 加载初始化数据文件     | 可选          |
| ECC                      | 启用错误纠正码         | ❌ 默认关闭     |

---

## ⏱ 3. Clocking Wizard IP

> 用于生成内部时钟，支持倍频、分频、锁相。

| 配置项 (英文)               | 中文翻译               | 推荐值 / 说明 |
|----------------------------|------------------------|----------------|
| Input Clock Frequency      | 输入时钟频率           | 板卡晶振频率，如 50MHz |
| Requested Output Frequency | 输出目标频率           | 如 100MHz      |
| Reset Type                 | 复位类型               | Active Low     |
| Feedback Type              | PLL反馈路径            | Auto（自动）    |
| Use Locked Output          | 输出锁定信号           | ✅ 用于判断时钟稳定 |

---

## 🔁 4. AXI Interconnect / SmartConnect

> 多个 AXI Master 与 Slave 之间的数据总线中枢。

| 配置项 (英文)             | 中文翻译               | 推荐值 / 说明 |
|--------------------------|------------------------|----------------|
| Number of Master Interfaces | 主接口数量           | 根据需求配置   |
| Number of Slave Interfaces  | 从接口数量           | 根据外设配置   |
| Data Width               | 数据宽度               | 32 / 64 / 128  |
| Clock Conversion         | 时钟转换               | 默认关闭       |
| Arbitration Scheme       | 仲裁策略               | Round Robin    |
| Pipeline Registers       | 插入流水线             | ✅ 提高时序性能 |

---

## 🔧 5. ZYNQ7 Processing System IP

> ZYNQ SoC 的 PS（处理系统）配置，连接 PL 逻辑。

| 配置项 (英文)             | 中文翻译               | 推荐值 / 说明 |
|--------------------------|------------------------|----------------|
| MIO Configuration        | 多功能引脚分配         | 勾选 UART/I2C/SPI 所需引脚 |
| DDR Configuration        | DDR 存储设置           | 默认即可       |
| Clock Configuration      | 时钟设置               | FCLK_CLK0 输出至 PL，通常为 100MHz |
| PS-PL Configuration      | PS ↔ PL 通信通道       | 启用 AXI GP0/HP0、IRQ F2P |
| Interrupts               | 中断                   | ✅ 启用 PL 触发 PS 中断 |
| I/O Peripherals          | 外设模块（UART 等）    | 按需勾选       |

---

## 📦 6. AXI BRAM Controller + BRAM

> 用于 AXI 总线访问片内 BRAM 存储器。

| 配置项 (英文)             | 中文翻译               | 推荐值 / 说明 |
|--------------------------|------------------------|----------------|
| AXI Interface Data Width | AXI 数据位宽           | 32bit          |
| Memory Depth             | BRAM 深度              | 2K ~ 16K       |
| Use ECC                  | 启用 ECC 错误校验      | ❌ 默认关闭     |
| Native Interface         | 本地端口类型           | AXI to Native  |

---

## 📎 补充建议

- ✅ 使用 `Output Registers` 几乎适用于所有高速 IP，有助于时序收敛。
- ⚠️ `ECC` 与 `Programmable Threshold` 类参数增加复杂度，新手默认关闭。
- ✅ 每个 IP 的 `Summary` 页签能看到最终接口信号，方便核对。
- 🧠 建议保存常用 IP 配置为 preset，方便今后工程快速复用。

---

## 🔌 7. AXI GPIO IP

> 用于控制 PL 中的 LED、按键、拨码等通用输入输出资源。

| 配置项 (英文)               | 中文翻译                 | 推荐值 / 说明 |
|----------------------------|--------------------------|----------------|
| GPIO Width                 | GPIO 宽度（位数）         | 如 1（单个按键）、8（LED） |
| All Inputs / All Outputs   | 设置端口方向             | 按实际硬件：输入/输出 |
| Tri-state Support          | 三态控制支持             | ❌ 默认关闭     |
| GPIO2 Enable               | 启用第二组 GPIO          | ❌ 默认关闭     |
| Interrupt Support          | 启用中断功能             | ✅ 如需中断触发 |
| Dual Channel Mode          | 双通道模式（输入+输出）   | 可选            |

---

## 📡 8. AXI UARTLite IP

> 轻量 UART 串口模块，用于调试串口、控制台输出。

| 配置项 (英文)             | 中文翻译                 | 推荐值 / 说明 |
|--------------------------|--------------------------|----------------|
| Baud Rate                | 波特率                   | 115200 / 9600  |
| Data Bits                | 数据位                   | 8              |
| Use Interrupt            | 是否启用中断             | ✅ 如需串口中断 |
| FIFO Depth               | 内部发送/接收 FIFO 深度  | 默认 16        |
| Include Parity           | 是否启用奇偶校验         | ❌ 默认关闭     |

📌 UARTLite 是非标准 UART，无 FIFO 水位可调，适用于简单场合（不适合高速大数据）。

---

## ⏲ 9. AXI Timer IP

> 多功能定时器，支持定时中断、PWM、脉冲测量等。

| 配置项 (英文)             | 中文翻译                 | 推荐值 / 说明 |
|--------------------------|--------------------------|----------------|
| Number of Timers         | 定时器数量（1 或 2）      | 1（简单场合）  |
| Enable Interrupt         | 启用中断                 | ✅ 计时用中断触发 |
| PWM Mode                 | 启用 PWM 模式            | ✅ 可选         |
| Capture Mode             | 捕获模式（边沿计数）     | ❌ 默认关闭     |
| Generate Mode            | 普通定时器计数模式        | ✅ 默认         |

---

## 📦 10. AXI Direct Memory Access (DMA) IP

> 实现 PS ↔ PL 的高速数据搬运，支持 Scatter-Gather 和 Simple 模式。

| 配置项 (英文)                  | 中文翻译                     | 推荐值 / 说明 |
|-------------------------------|------------------------------|----------------|
| Enable Scatter Gather Engine  | 启用 SG 模式（高级）         | ❌ 初学建议关闭 |
| Include MM2S Channel          | Memory → Stream 通道          | ✅ 打开         |
| Include S2MM Channel          | Stream → Memory 通道          | ✅ 打开         |
| Enable Data Realignment Engine| 启用数据对齐引擎             | ✅ 默认         |
| Address Width                 | 地址宽度                     | 32（常用）     |
| Use AXI Lite for Control      | 控制通道是否使用 AXI-Lite     | ✅ 默认         |
| Enable Interrupt              | 启用中断                     | ✅ 配合 PS 控制 |

📌 使用 AXI DMA 时，注意 Stream 端必须接 FIFO/Stream slave，内存端地址需软件配置。

![请添加图片描述](./img/b38c9471b63c4f3ea8d9af456faf002e.png)

---

## 📎 补充建议

- ✅ 使用 AXI GPIO 时，中断输入常配合 `Concat` 和 `AXI Interrupt Controller`。
- ✅ DMA 配合 VDMA 使用时注意 Stream 时序，FIFO 缓冲有必要。
- ✅ UARTLite 和 Timer 是 ZYNQ 常见裸机应用调试首选。


---

## 🧩 11. AXI Interrupt Controller

> 用于集中管理多个 PL 中断信号，连接至 ZYNQ PS 中断口。

| 配置项 (英文)             | 中文翻译                 | 推荐值 / 说明 |
|--------------------------|--------------------------|----------------|
| Number of Interrupts     | 输入中断数量             | 1 ~ 16（按需配置）|
| Kind of Intr             | 中断触发方式             | Edge / Level（默认为 Level）|
| Interrupt Type           | 单中断 / 多通道中断      | 默认单中断输出（连接至 ZYNQ F2P） |
| Has Interrupt Output     | 是否输出中断线           | ✅ 必须启用     |
| Synchronous Reset        | 同步复位                 | ✅ 保持默认     |

📌 通常配合 `Concat IP` 聚合多个 IP 的中断输出，最后送入 ZYNQ PS 的 IRQ_F2P。

---

## 🔗 12. Concat IP（中断聚合器）

> 将多个中断信号拼接成一个向量，送入中断控制器或 ZYNQ IRQ。

| 配置项 (英文)             | 中文翻译                 | 推荐值 / 说明 |
|--------------------------|--------------------------|----------------|
| Number of Ports          | 输入端口数量             | 如 4、8、16     |
| Width of Each Port       | 每个端口位宽             | 一般为 1       |
| Output Vector Width      | 输出向量宽度             | 自动生成       |

📌 用于收集多个 IP 的 interrupt 信号，简化布线，连接 `AXI Interrupt Controller` 的 `intr` 输入。

---

## ✂️ 13. Slice IP（向量切片器）

> 从 AXI GPIO、Concat、宽信号中提取指定 bit 范围。

| 配置项 (英文)             | 中文翻译                 | 推荐值 / 说明 |
|--------------------------|--------------------------|----------------|
| Data Width               | 输入数据总位宽           | 如 8、16、32   |
| Slice Type               | 切片方式                 | Fixed         |
| Slice From / To          | 起止位置（From/To）      | 如从 bit3 到 bit3，提取某个位 |
| Output Width             | 输出位宽                 | 自动计算       |

📌 与 Concat、GPIO 配合使用，提取某一路中断、标志、控制位。

---

## 📺 14. AXI Video Direct Memory Access (AXI VDMA)

> 用于图像/视频类应用，完成 DDR 与 AXI-Stream 视频数据的双向搬运。

| 配置项 (英文)               | 中文翻译                 | 推荐值 / 说明 |
|----------------------------|--------------------------|----------------|
| Enable Scatter Gather      | 是否启用 SG 模式         | ❌ 简单视频流建议关闭 |
| Enable Frame Sync          | 帧同步控制               | ✅ 视频同步建议启用 |
| Include MM2S / S2MM        | 开启 Memory → Stream / Stream → Memory 通道 | ✅ |
| Enable Circular Buffer     | 是否循环写入             | ✅ 视频帧循环 |
| Use 2D Transfer            | 启用二维传输             | ✅ 图像数据专用 |
| Enable GenLock             | 同步多路视频帧           | 按需启用       |
| Enable Interrupts          | 中断支持                 | ✅ 便于帧完成检测 |

📌 VDMA 的 AXI-Stream 接口通常接 `AXI Stream to Video Out` 或自定义图像处理模块。

---

## 🔄 15. AXI Stream Data FIFO

> 用于缓冲 AXI-Stream 数据流，解决接口不一致或速率不匹配问题。

| 配置项 (英文)             | 中文翻译                 | 推荐值 / 说明 |
|--------------------------|--------------------------|----------------|
| TDATA Width              | 数据位宽（bit）          | 8 / 24 / 32    |
| FIFO Depth               | FIFO 深度（单位：word）  | 512 / 1024     |
| Has TLAST                | 是否支持帧末标志         | ✅ 视频类流建议启用 |
| Has TKEEP                | 是否支持字节选择         | ✅ 按需         |
| Has TSTRB                | 是否支持字节有效标志     | 可选           |
| Packet Mode              | 是否使用包模式           | 默认关闭       |
| Enable TREADY            | 流控握手                 | ✅ 必须启用     |

📌 常用于 AXI DMA ↔ VDMA，或任意 AXI Stream 模块间做缓存与时序打拍。

---

## 📎 实用组合推荐（常见使用搭配）

| 场景类型       | 推荐 IP 组合 |
|----------------|--------------|
| PS ↔ FIFO 缓冲 | ZYNQ PS + AXI FIFO Generator + BRAM |
| PL 中断至 PS   | AXI GPIO（Interrupt） + Slice + Concat + AXI Interrupt Controller + ZYNQ |
| 视频 DMA       | AXI VDMA + Video In/Out + Stream FIFO + BRAM |
| 通用串口控制台 | AXI UARTLite + Timer + GPIO |
| 内存读写验证   | AXI BRAM Controller + BRAM + ILA |

---

---

## 🌀 16. AXI Quad SPI

> 提供标准 SPI 和 Quad SPI 接口，用于连接外部 Flash、传感器或 SPI 设备。

| 配置项 (英文)                 | 中文翻译                   | 推荐值 / 说明 |
|------------------------------|----------------------------|----------------|
| SPI Mode                     | SPI 模式（0~3）            | Mode 0 或按设备要求设置 |
| Use Start-Up Block           | 启用启动块（用于 QSPI Boot）| ❌ 若仅作为外设接口可关闭 |
| FIFO Depth                   | FIFO 深度（发送/接收）     | 16 / 64 / 128   |
| Include Slave Select         | 片选数量                   | 1 / 2 / 4       |
| Include Interrupt            | 是否启用中断               | ✅ 控制方便     |
| Use Quad Mode                | 启用 Quad SPI 模式         | ✅ 用于 Flash    |
| AXI Interface Width          | 数据位宽                   | 32（默认）      |

---

## 🧭 17. AXI IIC

> I²C 接口，用于连接 EEPROM、温度传感器、OLED 等常见 I²C 外设。

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Addressing Mode          | 地址模式（7-bit / 10-bit） | 7-bit（常用）  |
| FIFO Depth               | FIFO 深度（发送/接收）     | 16 / 64        |
| Input Clock Frequency    | 控制器时钟频率             | 100 MHz（默认）|
| I2C Clock Frequency      | I²C 时钟频率               | 100kHz / 400kHz |
| Enable Interrupt         | 启用中断                   | ✅ 推荐         |

---

## 🌐 18. AXI Ethernet / Ethernet Lite

> 用于实现 UDP/TCP 通信，ZYNQ PS 网络旁路或 PL 侧独立网络协议栈。

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Use Internal PHY         | 使用内部 PHY（Lite 模式）  | ✅ 可简化设计   |
| FIFO Depth               | 缓冲区深度                 | 512 / 1024     |
| PHY Interface Type       | PHY 接口类型               | MII / RMII / GMII |
| Enable Interrupt         | 启用中断                   | ✅ 建议开启     |
| MAC Address              | 自定义 MAC 地址            | 可填入          |

---

## 🎥 19. AXI Stream to Video Out / Video In to AXI

> 将 AXI4-Stream 图像数据转为 VGA/HDMI 信号或从摄像头采集图像。

| 配置项 (英文)                    | 中文翻译                       | 推荐值 / 说明 |
|---------------------------------|--------------------------------|----------------|
| Video Format                    | 视频格式                       | RGB / YUV / Grayscale |
| Enable Active Video             | 有效数据标志                   | ✅ HDMI 显示需要 |
| Enable Video Timing Signals     | 启用同步信号输出               | ✅ |
| Use Internal VTC                | 是否内嵌 VTC 控制器            | 可选（配合使用） |
| Include AXI4-Lite Control Interface | 控制接口                     | ✅ 可配置分辨率 |

---

## ⏱ 20. Video Timing Controller (VTC)

> 生成 VGA / HDMI 所需的同步信号（h_sync, v_sync 等）。

| 配置项 (英文)             | 中文翻译                     | 推荐值 / 说明 |
|--------------------------|------------------------------|----------------|
| Resolution               | 输出分辨率                   | 800x600 / 1024x768 等 |
| Frame Sync Input/Output  | 帧同步输入/输出              | 按显示链配置    |
| Generate Mode            | 主动生成（Master）            | ✅ HDMI 输出推荐 |
| Detect Mode              | 输入检测（Slave）             | 摄像头输入使用 |
| AXI4-Lite Control        | AXI 控制接口                 | ✅ 可调参数     |

---
---

## 🧠 21. MIG 7 Series DDR3/DDR4

> Memory Interface Generator，ZYNQ PL 侧接 DDR3/DDR4 SDRAM 时必须使用。

| 配置项 (英文)                 | 中文翻译                   | 推荐值 / 说明 |
|------------------------------|----------------------------|----------------|
| Memory Type                  | 存储器类型                 | DDR3 / DDR4    |
| Clock Period (tCK)           | 时钟周期（单位 ps）        | 如 2500ps 表示 400MHz |
| Memory Part Selection        | 存储器型号选择             | 按实际芯片选择 |
| Controller Data Width        | 控制器数据位宽             | 16 / 32 / 64   |
| ECC Support                  | 是否启用 ECC               | 可选（高可靠场景） |
| AXI Interface Enable         | 启用 AXI 接口              | ✅ 推荐        |
| Calibration Logic Location   | 校准逻辑位置               | Internal（默认）|

📌 MIG 会生成完整 RTL、xdc 和 example_design，可通过 `.xci` 配置文件集成进 Vivado 工程。

---

## 🔁 22. AXI Stream Broadcaster / Joiner / Switch

> Stream 数据路由控制类组件，用于拆分、合并或动态切换 AXI4-Stream 通道。

### Broadcaster（广播器）

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Number of Output Streams | 输出通道数量               | 2 / 4 / 8      |
| Replicate Data           | 数据是否复制               | ✅ 默认复制全部 |
| Include TKEEP/TLAST      | 保留流控制信号             | ✅ 建议保留     |

### Joiner（聚合器）

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Number of Input Streams  | 输入通道数量               | 2 / 4          |
| Arbitration Scheme       | 仲裁策略（轮询 / 优先级）  | Round Robin    |
| Packet Boundary Respect  | 包边界对齐                 | ✅ 若使用 TLAST |

### Switch（切换器）

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Control Type             | 控制方式（硬件/软件）      | Software（AXI Lite 控制） |
| Number of Inputs/Outputs | 输入/输出通道数            | 2 / 4          |
| Dynamic Routing Enable   | 动态路由                   | ✅ 灵活配置     |

---

## 🔁 23. Processor System Reset

> Vivado 自动生成的系统复位控制模块，通常接在 PS FCLK_CLK0 或主时钟下。

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Slowest Sync Clock       | 最慢的时钟（输入复位时基） | 通常为主时钟（FCLK_CLK0）|
| Ext Reset In             | 外部复位信号               | 接 PS 或 Button |
| Aux Reset In             | 辅助复位信号               | 选接其他复位源 |
| DCM Locked               | 时钟锁定输入               | 接 Clock Wizard 的 locked 输出 |
| Outputs                  | 生成的复位信号             | 可连接各模块的 `aresetn` 或 `resetn` |

---

## 🕒 24. Clock Divider / Clock Enable Generator

> 用于生成慢速时钟或分频使能信号（节拍信号），可作为低速模块时序控制。

| 配置项 (英文)             | 中文翻译                     | 推荐值 / 说明 |
|--------------------------|------------------------------|----------------|
| Division Factor          | 分频因子（如 N 分频）        | 如 4，表示 clk/4 |
| Output Mode              | 生成信号类型                 | Clock / Pulse |
| Reset Style              | 同步/异步复位                | 同步为主       |
| Glitch Free Enable       | 是否消抖输出                 | ✅ 推荐打开     |
| Initial Output State     | 初始输出电平                 | Low / High 可选 |

---

## 📟 25. XADC (ADC / 温度/电压传感器)

> ZYNQ 片上自带的 ADC 模块，可用于监测温度、电压或外部模拟信号。

| 配置项 (英文)             | 中文翻译                   | 推荐值 / 说明 |
|--------------------------|----------------------------|----------------|
| Channel Selection        | 通道选择                   | 内部温度、电压 / VP/VN（外部） |
| Sequencer Mode           | 通道扫描模式               | Continuous / Single |
| Alarm Outputs            | 报警输出                   | 可设置电压/温度阈值报警 |
| Average Enable           | 启用采样平均               | ✅ 降噪        |
| AXI4-Lite Interface      | 启用 AXI 控制接口          | ✅ 推荐         |

---
---

## 🧊 26. AXI BRAM Ping-Pong 双缓冲（手动构建）

> 利用 2 块 BRAM + AXI BRAM Controller 实现连续采样、读写分离的双缓冲结构。

| 模块组合                   | 说明 |
|----------------------------|------|
| 2 × BRAM                   | A/B 两块 RAM 交替工作 |
| 2 × AXI BRAM Controller    | 分别控制写入与读取     |
| GPIO/Timer 控制选择位     | 控制当前写哪块，读哪块 |
| ILA + VIO 可辅助调试验证  | 分析缓冲切换时机       |

📌 关键：保持写满后切换块，读空后切换，**避免冲突访问**。

---

## 🔁 27. AXI SmartConnect（高级 AXI 总线枢纽）

> 替代 AXI Interconnect，自动识别 AXI4/AXI4-Lite/AXI4-Stream 等协议，简化系统集成。

| 配置项 (英文)             | 中文翻译                     | 推荐值 / 说明 |
|--------------------------|------------------------------|----------------|
| Number of Masters        | 主端数量（如 DMA/PS）        | 自动侦测或手动指定 |
| Number of Slaves         | 从端数量（如 RAM、FIFO）     | 同上           |
| Protocol Conversion      | 自动协议转换（Lite ↔ Full）  | ✅ 推荐启用     |
| Data Width Adaptation    | 数据位宽自适应               | ✅ 可连接 32↔64 |
| Insert Pipeline Stages   | 自动插入流水线               | ✅ 时序更易满足 |

---

## 🧬 28. 多模块组合工程推荐结构（SoC 小系统范式）

> 基于 ZYNQ 搭建一个典型的 ARM+FPGA 小系统结构，模块划分如下：

| 模块分类     | 推荐 IP & 说明 |
|--------------|----------------|
| PS 控制区     | ZYNQ7 PS、AXI Interconnect、AXI Timer、UARTLite |
| RAM 映射缓存 | AXI BRAM Ctrl + BRAM（可多块） |
| 串口通信     | UARTLite / AXI UART16550 |
| 图像接口     | AXI VDMA + AXI4-Stream FIFO + AXI HDMI/VTC |
| 控制信号     | AXI GPIO、AXI Interrupt Controller、Concat、Slice |
| 显存/缓冲区  | 多 BRAM or DDR + DMA 或双缓冲方案 |
| 调试接口     | ILA、VIO、Debug Bridge（串口/Vivado） |

📌 建议使用 **Hierarchy** 将子模块分层封装，便于管理和调试。

---

## 🧰 29. IP Integrator 实用技巧

> 在 Vivado IP Integrator 图形界面中提高效率的技巧：

| 技巧                  | 说明 |
|-----------------------|------|
| ✅ 使用“Hierarchy”打包子模块 | 子系统逻辑清晰，如 GPIO 子模块、视频子模块 |
| ✅ Ctrl + T 调整布线自动布局 | 清晰整理 AXI、IRQ、Reset 线 |
| ✅ 使用 Interface 将 AXI/Lite/Stream 封装 | 高效复用和自动连线 |
| ✅ 使用 Block Design Container | 支持多 block_design 管理大型工程 |
| ✅ 尽量将 Reset、Clock、Interrupt 集中管理 | 避免连接混乱，统一复位逻辑 |

---

## 🔄 30. ZYNQ UltraScale+ MPSoC 配置（对比 ZYNQ-7000）

| 项目                 | ZYNQ-7000                     | ZU+ MPSoC                    |
|----------------------|-------------------------------|------------------------------|
| PS 架构              | ARM Cortex-A9 ×2              | Cortex-A53 ×4 + R5 ×2        |
| DDR 控制器           | DDR3 控制器                   | DDR4、LPDDR4 等多通道        |
| PL ↔ PS 接口         | AXI-GP, AXI-HP                | 更多 AXI-FPD/LPD/ACP         |
| 调试支持             | JTAG、串口                    | 支持 Trace、DAP、PS Debug    |
| 可用 Vivado IP       | 相同（额外支持高速接口）     | ✅ 包含 DisplayPort, SATA 等 |
| 工程复杂度           | 适中                          | ✅ 更强，但上手更难           |

---

