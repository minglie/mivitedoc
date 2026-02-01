# ILA 有两种用法
# 1. 不导出信号，直接在综合后用 “Set Up Debug”

- 代码里 mst_exec_state 和 read_pointer 都是寄存器信号。

- 不需要在 module 端口导出来，只要在 Vivado 里：

1. Open Synthesized Design

2. 菜单 Tools → Set Up Debug

3. 勾选你想观察的内部信号（比如 axi_stream_master_inst/mst_exec_state、axi_stream_master_inst/read_pointer）

4. Vivado 会自动在设计里插入 ILA，并把这些信号连进去。

这就是 网表探针，不会改变 RTL 端口,但会影响xdc文件
# 导出端口后再连 ILA
- 在 Block Design 里灵活连接，或者后期想同时用逻辑分析仪（ILA）和别的模块用同样的信号，那就要把 mst_exec_state、read_pointer 作为端口导出
- 这种方式更透明，但会改 RTL 接口。
# 对比
| 方法               | 是否要改 RTL | 添加信号的灵活性     | 常见用途        |
| ---------------- | -------- | ------------ | ----------- |
| **Set Up Debug** | ❌ 不改 RTL | ✅ 可以临时勾选内部信号 | 快速调试、一次性测试  |
| **导出口连 ILA**     | ✅ 改 RTL  | ❌ 每次要重综合     | 长期保留、配合外部模块 |

# axi信号 和自定义信号一起看的技巧
同一个 ILA 实例里，不能同时既是 AXI 接口监控，又是 Native Probe

Monitor Type 要么选 INTERFACE，要么选 NATIVE

解决方法：放两个 ILA

- ILA1：Monitor Type = Interface，专门抓 AXI 总线
- ILA2：Monitor Type = Native，抓自定义信号（状态机、read_pointer 等）
- 
但是 Vivado 硬件管理器里，每个 ILA 是一个独立的调试核，抓取的信号和触发条件是分开的。

ILA1 和 ILA2 的信号不会出现在同一个波形窗口里（除非你手工摆放），因为它们是两套独立的采样电路。

## 方案 1：都放在同一个 ILA 里

- 如果这些信号在 同一个时钟域，最简单的办法就是在 RTL 或 BD 里放 一个 ILA，

- 把 AXI 信号拆开（TVALID/TREADY/TDATA…）接到 Native Probe

- 同时再接上 mst_exec_state、read_pointer

- 这样所有信号就在一个 ILA 的波形窗口里，触发条件也能统一设置。

- 缺点：失去了 Vivado 自动解析 AXI 接口的便利（比如自动识别握手事务
- 
## 方案 2：保留两个 ILA，但让它们同时触发
- 使用 ILA 的 TRIG_OUT / TRIG_IN 端口，把 ILA1 的触发输出接到 ILA2 的触发输入
- 这样两个 ILA 会在同一事件触发并同时采样
- 虽然波形窗口还是分开两个，但波形时间线是同步的，你可以对齐观察。

## 方案 3：手动对齐波形
- 在 Vivado Hardware Manager 打开两个 ILA 的波形窗口
- 选择相同的采样时钟和触发条件
- 导出波形（CSV/VCD）后在外部工具（比如 GTKWave）里合并分析

推荐做法

-  如果信号都在一个时钟域 → 放在同一个 ILA（Native Probe）
- 如果必须分开（比如 AXI 总线想用 Interface 监控） → 两个 ILA + 触发级联