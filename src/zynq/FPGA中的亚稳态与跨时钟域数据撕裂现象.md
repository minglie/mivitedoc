# 什么是亚稳态
在 数字电路里，亚稳态（Metastability） 是指 触发器在采样异步信号时，由于 setup/hold 时间被破坏，导致寄存器的输出进入既不是稳定的 0，也不是稳定的 1 的不确定状态。
## 亚稳态的最直观现象
其最明显的现象就是：同一个寄存器在短时间内不可重复读。
- 这里的***不可重复读*** 并不是因为寄存器内容被外部逻辑改写了；
而是因为该寄存器在采样异步信号时进入了亚稳态,输出值还没有稳定下来；
- 在解析过程中，它的电平可能在阈值附近晃动、延迟收敛，所以不同时间点读到的结果可能不同。
- 打两拍的最终效果是读了引脚值,等过个时钟周期再用
```verilog
`timescale 1ns / 1ps
///可能含亚稳态,别用最新的r_xxx,而用次新的r_xxx[1]
// Module Name: sync_2stage_bit_xxx
// Description: 单线异步信号双拍同步（打两拍获取稳定值）示例，占位符信号 xxx
/*
sync_2stage_bit_xxx u_sync (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_xxx(i_key),
    .o_xxx_sync(o_key_sync)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module sync_2stage_bit_xxx (
    input  wire i_clk,      // 时钟
    input  wire i_rst_n,    // 异步复位，低有效
    input  wire i_xxx,      // 异步输入信号
    output wire o_xxx_sync  // 双拍稳定输出
);

    // --------------------------
    // 双拍同步寄存器
    // --------------------------
    reg [1:0] r_xxx;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_xxx <= 2'b00;        // 复位输出
        else
            r_xxx <= {r_xxx[0], i_xxx};  // 打两拍
    end

    // --------------------------
    // 稳定输出
    // --------------------------
    assign o_xxx_sync = r_xxx[1];

endmodule

```
# 什么是 CDC

**CDC = Clock Domain Crossing**，中文通常叫 **时钟域交叉**。  
在 FPGA/ASIC 里，常常存在多个不同时钟域（例如 50 MHz 外设时钟、100 MHz 核心时钟、125 MHz 千兆网时钟）。  
当一个信号或数据从 **源时钟域** 传到 **目的时钟域** 时，就发生了 **CDC**。

## 为什么要关心 CDC？
- **异步关系**：两个时钟频率可能不同，或者相位不固定，无法保证采样点和数据稳定时间对齐。  
- **亚稳态 (Metastability)**：目的域触发器在采到不稳定电平时，可能进入亚稳状态，导致输出不可预期。  
- **多比特一致性问题**：单 bit 信号用双触发同步器基本能解决，但 **多比特总线** 如果直接采样，会出现“撕裂”现象。  

## 常见的 CDC 类型
1. **单 bit 信号跨域**  
   - 典型处理：双触发同步器（2-FF synchronizer）。  
   - 用途：复位、标志位、中断请求。  

2. **多比特总线跨域**  
   - 问题：多个比特不能保证同时到达目的域。  
   - 典型处理：握手协议 / 异步 FIFO / Gray 码编码。  

3. **数据流跨域**  
   - 大量连续数据（如音视频、网络数据）。  
   - 典型处理：异步 FIFO，读写两端独立时钟。  

### CDC 处理的目标
- **避免亚稳态**：降低亚稳态被扩散的概率。  
- **保证一致性**：目的域拿到的数据必须是源域的“一个合法快照”。  
- **系统可靠**：即使不同频率、不同相位，跨域传输也要稳定、可预测。  


# 什么是撕裂？
- **定义**：目的时钟域在源时钟域 **总线翻转的瞬间** 采样，捕获到“部分新值 + 部分旧值”的混合结果。  
- **特征**：这种混合结果在源域的逻辑里 **永远不会出现**。  
- 又叫 **混码**、**非原子采样**。

## 撕裂是如何产生的？
1. **源域：多比特计数器**  
   例如 4 位计数器从 `0111 (7)` → `1000 (8)`。  
2. **实际硬件：各位翻转有延迟差**  
   高位翻转慢一点，低位翻转快一点。  
3. **目的域：在翻转过程中采样**  
   - 可能采到 `1111 (15)` 或 `0000 (0)`。  
   - 这些数是源域计数器 **不可能生成的非法值**。  

## 撕裂的危害

- **数据错误**：比如地址总线撕裂 → 访问错误的存储单元。

-   **状态机异常**：非法状态进入 → 系统死锁。

- **调试困难**：RTL 仿真正常，上板波形偶发异常

---

# 撕裂仿真实验：
## 实验方案 
- **clk1 = 50 MHz**，16 位计数器，计数范围 0..1000。  
- **clk2 = 100 MHz**，异步采样该计数器。  

## 两种路径
- **理想直连**：RTL 仿真几乎看不到问题（所有位同时翻转）。  
- **带偏斜延迟**：人为给总线每位注入不同延迟，更容易复现撕裂。  

## 检测方法

因为 clk2 频率比 clk1 快，所以clk2不会漏检
故撕裂判据为:相邻采样差值 ∉ {0, 1} → 撕裂。  
当撕裂次数超过 3 次时，则结束仿真

#  撕裂测试

## counter_clk1.v
```verilog
`timescale 1ns/1ps

// ================== clk1 域：16位计数器，0~1000 循环 ==================
module counter_clk1 #(
    parameter MAX = 1000
)(
    input  wire        i_clk1,
    input  wire        i_rstn,
    output reg  [15:0] o_cnt
);
    always @(posedge i_clk1 or negedge i_rstn) begin
        if (!i_rstn) o_cnt <= 16'd0;
        else if (o_cnt == MAX) o_cnt <= 16'd0;
        else o_cnt <= o_cnt + 16'd1;
    end
endmodule
```
## unsafe_sampler_clk2.v
```verilog
`timescale 1ns/1ps

// ================== clk2 域：不安全直采样（统计撕裂次数） ==================
module unsafe_sampler_clk2 #(
    parameter MAX = 1000              // 计数器最大值
)(
    input  wire        i_clk2,        // 目的时钟
    input  wire        i_rstn,        // 复位，低有效
    input  wire [15:0] i_bus_async,   // 来自异步域的总线（危险）
    output reg  [31:0] o_tearing_cnt, // 撕裂次数（非法跳变）
    output reg  [15:0] o_last_sample  // 最近一次采样值
);
    reg [15:0] r_sample, r_prev;

    // 计算 (a - b) mod (MAX+1)
    function automatic [15:0] moddiff;
        input [15:0] a, b;
        reg [16:0] t;
        begin
            if (a >= b) t = a - b;
            else        t = a + (MAX+1) - b;
            moddiff = t[15:0];
        end
    endfunction

    always @(posedge i_clk2 or negedge i_rstn) begin
        if (!i_rstn) begin
            r_sample       <= 16'd0;
            r_prev         <= 16'd0;
            o_last_sample  <= 16'd0;
            o_tearing_cnt  <= 32'd0;
        end else begin
            r_prev   <= r_sample;
            r_sample <= i_bus_async;   // 危险：可能撕裂
            o_last_sample <= r_sample;

            // 合法跳变只能是 0 或 +1 (mod MAX+1)
            if (moddiff(r_sample, r_prev) != 0 &&
                moddiff(r_sample, r_prev) != 1) begin
                o_tearing_cnt <= o_tearing_cnt + 1;
                // 调试打印（可选）
                // $display("[%0t ns] Tear: prev=%0d -> now=%0d (diff=%0d)",
                //          $time, r_prev, r_sample, moddiff(r_sample,r_prev));
            end
        end
    end
endmodule
```

## bus_skew.v
```verilog
`timescale 1ns/1ps

// ================== 位间偏斜注入器（仿真用） ==================
// 功能：给每一位加不同固定延迟，模拟 FPGA 中布线/门延
// 例：BASE=0, STEP=2ns -> bit0=0ns, bit1=2ns, bit2=4ns ...
module bus_skew #(
    parameter integer W    = 16,  // 位宽
    parameter integer BASE = 0,   // 起始延迟 (ns)
    parameter integer STEP = 2    // 位间递增延迟 (ns) —— 建议 2ns 起步
)(
    input  wire [W-1:0] i_bus,
    output wire [W-1:0] o_bus
);
    genvar k;
    generate
        for (k = 0; k < W; k = k + 1) begin : g_skew
            localparam integer DLY = BASE + k*STEP;
            assign #(DLY) o_bus[k] = i_bus[k]; // 固定延迟（连续赋值延迟）
        end
    endgenerate
endmodule
```

## tb.sv

```verilog
`timescale 1ns/1ps

// ================== Testbench ==================
module tb;
    // ====== 时钟与复位 ======
    reg clk1 = 0, clk2 = 0, rstn = 0;

    // clk1: 50MHz -> 周期 20ns
    always #10 clk1 = ~clk1;

    // clk2: 100MHz -> 周期 10ns，但添加 3ns 相位偏移（关键）
    initial begin
        clk2 = 0;
        #3;               // 相位偏移 3ns，让采样点卡进翻转传播窗口
        forever #5 clk2 = ~clk2;
    end

    // 复位流程：先保持若干个 clk1 周期的低电平
    initial begin
        rstn = 0;
        repeat (5) @(posedge clk1);
        rstn = 1;
    end

    // ====== 源域计数器 ======
    wire [15:0] w_cnt_clk1;
    counter_clk1 #(.MAX(1000)) u_cnt (
        .i_clk1 (clk1),
        .i_rstn (rstn),
        .o_cnt  (w_cnt_clk1)
    );

    // ====== 路径A：理想直连（无位间偏斜）用于对比 ======
    wire [31:0] w_tearing_ideal;
    wire [15:0] w_last_ideal;
    unsafe_sampler_clk2 #(.MAX(1000)) u_ideal (
        .i_clk2        (clk2),
        .i_rstn        (rstn),
        .i_bus_async   (w_cnt_clk1),
        .o_tearing_cnt (w_tearing_ideal),
        .o_last_sample (w_last_ideal)
    );

    // ====== 路径B：带位间偏斜（稳稳复现撕裂） ======
    wire [15:0] w_cnt_skewed;
    // 提示：若你一开始仍看不到撕裂，可把 STEP 再加大到 3 或 4
    bus_skew #(.W(16), .BASE(0), .STEP(2)) u_skew (
        .i_bus (w_cnt_clk1),
        .o_bus (w_cnt_skewed)
    );

    wire [31:0] w_tearing_skew;
    wire [15:0] w_last_skew;
    unsafe_sampler_clk2 #(.MAX(1000)) u_skewed (
        .i_clk2        (clk2),
        .i_rstn        (rstn),
        .i_bus_async   (w_cnt_skewed),
        .o_tearing_cnt (w_tearing_skew),
        .o_last_sample (w_last_skew)
    );



    // 2) 限时运行；也可在命中多次撕裂后提前结束
    initial begin
        // 运行 30 ms（按需调整）
        #30000_000;

        $display("\n================= SUMMARY =================");
        $display("Ideal path   : tearing=%0d, last=%0d",
                 w_tearing_ideal, w_last_ideal);
        $display("Skewed path  : tearing=%0d, last=%0d",
                 w_tearing_skew , w_last_skew );
        $display("===========================================\n");

        $finish;
    end

    // 3) 命中多次撕裂后提前退出（例如 >= 3 次）
    initial begin
        wait (rstn == 1'b1);
        wait (w_tearing_skew >= 3);
        $display("[%0t ns] Enough tearing hits (>=3). Stopping...", $time);
        $finish;
    end
endmodule

```

## 仿真结果
```shell
# [1388000 ns] Enough tearing hits (>=3). Stopping...
# ** Note: $finish    : ../tb.sv(84)
#    Time: 1388 ns  Iteration: 2  Instance: /tb
```

#  亚稳态测试
亚稳态现象只能在真机上复现。
- 用一个按键作为异步输入信号
- 用一个指示灯显示是否发生了亚稳态
- 为增加亚稳态概率,可将按键换成一个异步方波输入
## meta_one_led_demo .v
其中d1,d2 表面上是连在一起的, 但在综合/布局后会被保留为两条物理上不同的网，形成皮秒~纳秒级延迟差
```verilog
`timescale 1ns/1ps
// ============================================================
// Metastability Demo (50MHz)
// 亚稳态演示电路
// ------------------------------------------------------------
// 思路：
//   - 使用 FPGA 的 50MHz 时钟，对一个异步输入信号进行采样
//   - 将同一个异步输入通过两条“不同路径”送到两个触发器
//   - 因为路径差异，两个触发器可能在同一个时钟边沿采到不同结果
//   - 一旦检测到差异（分歧），点亮 LED 并保持
// ------------------------------------------------------------
// 注意：
//   1. 真正的亚稳态是概率事件，需要高频异步输入源（MHz 级方波）
//   2. 为了增加采样差异，这里插入了小延迟链，并用 /* synthesis keep */
//      保证 Quartus 不会优化掉这些中间信号
//   3. 此电路仅用于演示，不能用于实际设计（工程中要用同步器消除亚稳态）
// ============================================================
module meta_one_led_demo (
    input  wire i_clk50,   // 50MHz 时钟源
    input  wire i_btn_n,   // 异步输入 (例如外部按钮或信号发生器方波)
    output reg  o_led      // 指示灯：检测到分歧后常亮
);

    // --------------------------------------------------------
    // 延迟链：人为制造两条不同采样路径
    // --------------------------------------------------------
    // synthesis keep 属性告诉 Quartus：
    //   “不要优化掉这个中间节点，一定要保留”
    // 这样布线工具会给它们分配实际逻辑资源，形成细微延迟差
    wire d1 /* synthesis keep */;
    wire d2 /* synthesis keep */;
    assign d1 = i_btn_n;  // 路径1：直接连接
    assign d2 = d1;       // 路径2：多绕一级

    // --------------------------------------------------------
    // 并行采样：两个触发器同时采样异步输入的不同路径
    // --------------------------------------------------------
    reg q1, q2;
    always @(posedge i_clk50) begin
        q1 <= d1;   // 第一条路径
        q2 <= d2;   // 第二条路径
    end

    // --------------------------------------------------------
    // 分歧检测：当两个寄存器采样值不一致时，说明发生了亚稳态/采样分歧
    // --------------------------------------------------------
    wire diverge = q1 ^ q2;

    // --------------------------------------------------------
    // 锁存机制：一旦检测到分歧，LED 常亮
    // --------------------------------------------------------
    initial o_led = 1'b0; // 上电默认灭
    always @(posedge i_clk50) begin
        if (diverge)
            o_led <= 1'b1;  // 检测到分歧就点亮
    end
endmodule

```

## HC_FPGA_Demo_Top.v
```verilog
`timescale 1ns/1ps
module HC_FPGA_Demo_Top
(
    input  CLOCK_XTAL_50MHz,
    input  RESET,
    input  KEY4,
    input  KEY3,
    input  KEY2,
    input  SIG_IN1,//esp32 生成
    input SIG_IN2,
    output LED0,
    output LED1,
    output LED2
);

 meta_one_led_demo  u_meta_one_led_demo (
	  .i_clk50   (CLOCK_XTAL_50MHz), 
	  .i_btn_n   (SIG_IN1 & KEY2),
	  .o_led   (LED0)                  
 );
assign LED1 = SIG_IN1;
endmodule
```
## main.py
生成一个高速异步信号
```python
from machine import Pin, PWM
import time
p = PWM(Pin(2))      # 选择 GPIO2，ESP32 上常用测试口
p.freq(30_000_000)   # 设置频率 30 MHz
p.duty(512)          # 占空比 ≈ 50%（范围 0~1023）
while True:
    time.sleep(2)
```
## 测试结果
```shell
指示灯亮了,说明发生了亚稳态
```

