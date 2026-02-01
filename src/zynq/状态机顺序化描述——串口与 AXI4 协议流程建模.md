

# 🧩 状态机顺序化描述 —— 串口与 AXI4 协议流程建模
> [状态机](https://blog.csdn.net/qq_26074053/article/details/149335857)是一种行为建模方式。我们可以将一个状态机拆解为若干条顺序化描述路径：每条路径聚焦一条关键任务的行为流程，抛弃无关跳转，使逻辑更线性、清晰、可读。本文将以 串口协议 和 AXI4-Full 协议 为例，展示其顺序化描述方式。

# [🔌串口](https://blog.csdn.net/qq_26074053/article/details/149358395)
### 🟦 串口发送流程（TX）
```markdown
wait (tx_start);          // 🟢 等待发送开始信号（如用户请求或发送缓存非空）
load tx_buf;              // 💾 加载要发送的 8 位数据到发送缓冲区（如 r_tx_buf <= i_tx_data）
tx_busy <= 1;             // 🚧 设置发送忙标志，防止重复触发

send start bit;           // 🔰 发送起始位（UART规定为低电平 0）
wait (bit_time);          // ⏳ 起始位持续一个比特周期

repeat (8 bits):          // 🔁 逐位发送数据（从最低位到最高位）
  shift_out_bit;          // ⏺ 输出当前最低位到 tx 引脚（如 txd <= tx_buf[0]）
  wait (bit_time);        // ⏳ 等待一个比特周期，再发送下一位

send stop bit;            // 🟨 发送停止位（UART规定为高电平 1）
tx_busy <= 0;             // ✅ 发送结束，清除忙标志，准备下一次传输
```

### 🟩 串口接收流程（RX）

```markdown
wait (rx_falling_edge);  // ⏬ 检测起始位下降沿
rx_done <= 0;            //🧼清除上次完成标志
wait (half_bit_time);   // 🕓 中心对齐采样
repeat (8 bits):      // 🔁 逐位接收数据（从最低位到最高位）
  sample_bit;     // ⏺ 从 rx 引脚采样当前位的电平（0或1）
  store_to_rx_buf; // 💾 将采样到的这 1bit 存入接收缓冲区的对应位
  wait (bit_time);  // ⏳ 等待一个完整的 bit 时间，再采样下一位
check stop bit;      // ✅ 检查停止位是否为高电平（1），用于校验帧结束是否正确
rx_done <= 1;          // ✅ 完成接收
```

# 🫀 [AXI4](https://blog.csdn.net/qq_26074053/article/details/149357754)

## ✅ 写事务（Write Transaction）

### 📤 Master（主设备）顺序流程：
```verilog
// ==============================================
// AXI 写事务 - 主机发起方（支持突发或单次写）
// ==============================================

// 1️⃣ 准备写地址通道
// 设置目标写地址和突发控制信息
m_axi_awaddr  <= write_addr;     // 📍 起始写地址
m_axi_awlen   <= burst_len - 1;  // 🧮 写突发长度（AXI4协议中为次数 - 1）
m_axi_awsize  <= 3'b010;         // 📦 每拍传输 4 字节（32 位）
m_axi_awburst <= 2'b01;          // 🔁 INCR 模式（地址线性递增）
m_axi_awvalid <= 1;              // 🚩 发起地址传输请求
wait (m_axi_awready);           // ⏳ 等待从机响应握手
m_axi_awvalid <= 0;              // ✅ 地址传输完成

// 2️⃣ 准备写数据通道
// 设置要写入的数据及掩码标志（单拍为例，突发可用循环）
m_axi_wdata   <= write_data;     // 📝 写入数据
m_axi_wstrb   <= 4'b1111;        // ✒️ 写掩码（4 字节全写）
m_axi_wlast   <= 1;              // 🟨 单次写需设置最后一拍标志
m_axi_wvalid  <= 1;              // 🚩 数据有效
wait (m_axi_wready);           // ⏳ 等待从机准备接收
m_axi_wvalid  <= 0;              // ✅ 写数据完成

// 3️⃣ 接收写响应通道
// 设置 bready 表示主机准备接收响应
m_axi_bready  <= 1;              // 🎯 表示主机已准备接收响应
wait (m_axi_bvalid);           // ⏳ 等待从机返回响应
write_bresp   = m_axi_bresp;     // 📋 读取写响应码（通常为 2'b00）
m_axi_bready  <= 0;              // ✅ 响应接收完成

// 💡 写事务完成，可置 done <= 1 进入下一轮状态

```

### 📥 Slave（从设备）顺序流程：
```verilog
// ==============================================
// AXI-LITE 写事务 - 从机响应方
// ==============================================

// 1️⃣ 等待地址有效
wait (s_axi_awvalid);             // 🔁 等待主机发来写地址
s_axi_awready <= 1;               // ✅ 表示准备接收地址
write_awaddr  = s_axi_awaddr;     // 💾 缓存写地址（注意必须在握手后使用）
s_axi_awready <= 0;               // 📴 完成地址握手

// 2️⃣ 等待写数据
wait (s_axi_wvalid);              // 🔁 等待主机发来数据
s_axi_wready <= 1;
write_mem[write_awaddr] <= s_axi_wdata;  // 📝 写入内部存储器
s_axi_wready <= 0;               // 📴 完成数据握手

// 3️⃣ 发送写响应
s_axi_bresp  <= 2'b00;            // ✅ OKAY 响应
s_axi_bvalid <= 1;                // 📢 写事务完成
wait (s_axi_bready);              // 🔁 等待主机接收响应
s_axi_bvalid <= 0;                // 📴 完成握手，返回空闲
```

## ✅ 读事务（Read Transaction）
### 📤 Master（主设备）顺序流程：
```verilog
// ==============================================
// AXI 读事务 - 主机发起方（支持突发读取）
// ==============================================
// 1️⃣ 准备读地址通道
m_axi_araddr  <= read_addr;         // 设置起始读地址
m_axi_arlen   <= burst_len - 1;     // 设置突发长度（注意：长度需减 1）
m_axi_arsize  <= 3'b010;            // 每次传输 4 字节（32 位）
m_axi_arburst <= 2'b01;             // INCR 模式：线性递增
m_axi_arvalid <= 1;                 // 发起读地址传输
wait (m_axi_arready);              // 🔁 等待从机握手响应
m_axi_arvalid <= 0;                 // 地址通道握手完成，拉低 valid

// 2️⃣ 接收数据通道（突发读取）
m_axi_rready <= 1;                  // 表示主机已准备好接收数据

for (i = 0; i < burst_len; i++) begin
    wait (m_axi_rvalid);           // 🔁 等待从机送出第 i 拍数据
    read_data[i]   = m_axi_rdata;  // 记录数据（可写入 buffer）
    read_rresp[i]  = m_axi_rresp;  // 可记录响应（一般为 2'b00）
    if (m_axi_rlast)               // 🔚 若从机标记为最后一拍，提前跳出
        break;
end

m_axi_rready <= 0;                 // 停止接收
```

### 📥 Slave（从设备）顺序流程：
```verilog
// ==============================================
// AXI 读事务 - 从机响应流程（适用于 AXI4-Lite）
// ==============================================

// 1️⃣ 等待主机发送读地址
wait (s_axi_arvalid);                 // 🔁 等待地址有效
s_axi_arready <= 1;                   // ✅ 表示从机已准备好接收地址
read_araddr   <= s_axi_araddr;       // 💾 保存地址
s_axi_arready <= 0;                   // 📴 拉低 ready，表示地址接收完毕

// 2️⃣ 准备并返回读数据
s_axi_rdata  <= mem[read_araddr];    // 📖 从内部 RAM 或寄存器读取数据
s_axi_rresp  <= 2'b00;               // ✅ OKAY 响应
s_axi_rvalid <= 1;                   // 📢 表示读数据有效

wait (s_axi_rready);                 // 🔁 等待主机接收
s_axi_rvalid <= 0;                   // 📴 传输完成，释放 rvalid

```
## 🧠 总结
| 点             | 写事务                   | 读事务              |
| ------------- | --------------------- | ---------------- |
| 发起方向          | 主机 ➜ 从机               | 主机 ➜ 从机          |
| 数据方向          | 主机 ➜ 从机               | 从机 ➜ 主机          |
| 响应信号          | `BRESP`    （写响应通道）           | `RRESP`（读数据通道）  |
| ready/valid配合 | `AW`, `W`, `B` 通道三段握手 | `AR`, `R` 通道两段握手 |
| 是否突发支持        | ✅ 支持突发（可调节 `len`）     | ✅ 支持突发           |

# ZYNQ  GP / HP / ACP 的个性特征
| 特征维度          | **GP 接口**                        | **HP 接口**                | **ACP 接口**                           |
| ------------- | -------------------------------- | ------------------------ | ------------------------------------ |
| 🌐 协议类型       | AXI4-Full                        | AXI4-Full                | AXI4-Full                            |
| 🎯 设计用途       | ⚙️ 通用控制 / 低带宽访问                  | 🚀 高速数据搬运（写入 DDR）        | 🤝 PL-PS 协同，**共享缓存一致的数据**            |
| 🔀 接口方向       | PS↔PL（双向都有）                      | PL → PS（写 DDR）           | PL → PS（可访问 Cache or DDR）            |
| 📦 数据位宽       | 32-bit                           | 64-bit                   | 64-bit                               |
| 📈 带宽优化       | ❌ 无专门优化                          | ✅ PS 端专门配了写缓冲 FIFO，优化高吞吐 | ✅ 带缓存一致性逻辑，适合协同小数据交换                 |
| 🧠 Cache一致性支持 | ❌ 无                              | ❌ 无                      | ✅ 有：支持 snoop cache，确保 CPU 看的最新       |
| 🚧 延迟表现       | 较低（用于控制）                         | 较低，高吞吐设计                 | ⚠️ 稍高（cache 路径更复杂）                   |
| 🔁 突发长度支持     | 最大 16                            | 最大 16（内部 FIFO 支持长 burst） | 最大 16                                |
| 🧭 常见用途       | 控制、状态寄存器、简单数据访问                  | 图像/视频/波形写 DDR，数据流处理      | AI 加速、共享 FeatureMap、协同滤波器等 CPU/PL 协作 |
| 🔌 外设连接示例     | PS GPIO、AXI-Lite IP、内存-mapped 设备 | AXI-DMA、DataMover 写 DDR  | 高性能共享缓冲区、Cacheable Buffer 接口         |
