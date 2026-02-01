# 🔧 可配置的PWM外设模块

基于FPGA的PWM信号发生器，支持 **动态周期与占空比配置**，无需外部控制信号，适用于 LED 呼吸灯、舵机控制、电机驱动等场景。
### 仿真波形
参数修改后会晚一个pwm周期才生效
![在这里插入图片描述](./img/c81c7913d2234f3b8e904bdeba8a862d.png)

---
## 📌 模块功能

- 🧮 支持以微秒为单位动态设置周期 `i_period_us`
- 💡 支持以微秒为单位动态设置高电平时间 `i_high_us`
- 🧠 自动检测参数变化，内部锁存、乘法，仅更新一次
---

## ⚙️ 参数定义

| 名称             | 默认值 | 说明                   |
|------------------|--------|------------------------|
| `P_CLK_FREQ_MHZ` | `50`   | 时钟频率（单位 MHz）  |
| `P_COUNTER_WIDTH     ` | `32`   |  位宽  |
| `P_DEFAULT_PERIOD_US` | `1000`   |  默认周期（1ms）  |
| `P_DEFAULT_HIGH_US` | `500`   | 默认高电平时间（0.5ms）  |
---

## 🧷 接口定义

| 信号名         | 方向 | 位宽   | 说明                         |
|----------------|------|--------|------------------------------|
| `i_clk`        | in   | 1 bit  | 系统时钟                     |
| `i_rst_n`      | in   | 1 bit  | 异步复位（启停PWM）           |
| `i_period_us`  | in   | 32 bit | PWM 周期（单位：微秒）       |
| `i_high_us`    | in   | 32 bit | 高电平时间（单位：微秒）     |
| `o_pwm_out`    | out  | 1 bit  | PWM 输出信号                 |
| `o_param_err   `    | out  | 1 bit  | 参数错误标志              |

---



### ⚠️ 使用注意事项

1. **参数更新顺序要求：**
   - ⚠️ 在动态修改 PWM 参数时，**务必先更新 `i_period_us`，再更新 `i_high_us`**,并保持一个pwm周期。
   - 原因是模块在每个pwm周期结束时检测参数变更并更新内部寄存器。
   - 若先设置高电平时间，可能导致短暂出现 `i_high_us > i_period_us` 将导致该周期输出恒为高电平，可能不是你想要的占空比

2. **参数变化生效时机：**
   - 模块在pwm周期结束时检测到参数变更后立即生效，无需显式控制信号。
   - 建议在两个周期之间或计数归零时刻修改参数，以避免中途跳变导致输出毛刺。

3. **默认输出行为：**
   - 若输入未初始化或刚上电，模块内部默认配置：
     - `i_period_us = 1000` → 周期 1ms
     - `i_high_us   = 500`  → 高电平 0.5ms（50% 占空比）

4. **停止输出：**
   - 将 `i_rst_n` 拉低，可立即停止 PWM 输出并复位内部状态。
   - 拉高 `i_rst_n`，PWM 将按当前配置重新开始输出。


# pwm.v
```verilog
module pwm #(
    parameter P_CLK_FREQ_MHZ      = 50,    // 输入时钟频率（单位 MHz）
    parameter P_COUNTER_WIDTH     = 32,    // 计数器位宽
    parameter P_DEFAULT_PERIOD_US = 1000,  // 默认周期（单位 us）
    parameter P_DEFAULT_HIGH_US   = 500    // 默认高电平时间（单位 us）
)(
    input  wire                         i_clk        , // 时钟
    input  wire                         i_rst_n      , // 异步复位，低有效
    input  wire [P_COUNTER_WIDTH-1:0]   i_period_us  , // PWM 周期（单位：us）
    input  wire [P_COUNTER_WIDTH-1:0]   i_high_us    , // 高电平时间（单位：us）
    output reg                          o_pwm_out    , // PWM 输出
    output reg                          o_param_err    // 参数错误标志
);

    // ==================================================
    // 常量与默认值（以 clock cycles 表示）
    // ==================================================
    localparam L_CYCLE_MAX_VAL         = (1 << P_COUNTER_WIDTH) - 1;
    localparam L_DEFAULT_PERIOD_CYCLES = P_CLK_FREQ_MHZ * P_DEFAULT_PERIOD_US;
    localparam L_DEFAULT_HIGH_CYCLES   = P_CLK_FREQ_MHZ * P_DEFAULT_HIGH_US;

    // ==================================================
    // 输入 us → clock cycles 转换（组合逻辑）
    // ==================================================
    wire [P_COUNTER_WIDTH-1:0] w_period_cycles = P_CLK_FREQ_MHZ * i_period_us;
    wire [P_COUNTER_WIDTH-1:0] w_high_cycles   = P_CLK_FREQ_MHZ * i_high_us;

    // ==================================================
    // 寄存器定义
    // ==================================================
    reg [P_COUNTER_WIDTH-1:0] r_cnt;             // 主计数器
    reg [P_COUNTER_WIDTH-1:0] r_period_cycles;   // 周期最大值（锁存）
    reg [P_COUNTER_WIDTH-1:0] r_high_cycles;     // 高电平持续周期数（锁存）
    reg [P_COUNTER_WIDTH-1:0] r_period_us_d;     // 上一次周期值（us）
    reg [P_COUNTER_WIDTH-1:0] r_high_us_d;       // 上一次高电平值（us）

    // ==================================================
    // 参数合法性检查
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            o_param_err <= 1'b0;
        end else begin
            o_param_err <= (i_period_us == 0) ||
                           (w_period_cycles > L_CYCLE_MAX_VAL) ||
                           (w_high_cycles   > L_CYCLE_MAX_VAL);
        end
    end

    // ==================================================
    // 周期结束时更新锁存周期/高电平（单位 clk）
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_period_us_d   <= P_DEFAULT_PERIOD_US;
            r_high_us_d     <= P_DEFAULT_HIGH_US;
            r_period_cycles <= L_DEFAULT_PERIOD_CYCLES;
            r_high_cycles   <= L_DEFAULT_HIGH_CYCLES;
        end else if (r_cnt == r_period_cycles - 1 && !o_param_err) begin
            if ((i_period_us != r_period_us_d) || (i_high_us != r_high_us_d)) begin
                r_period_us_d   <= i_period_us;
                r_high_us_d     <= i_high_us;
                r_period_cycles <= w_period_cycles;
                r_high_cycles   <= w_high_cycles;
            end
        end
    end

    // ==================================================
    // 主计数器逻辑
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_cnt <= 0;
        end else if (o_param_err) begin
            r_cnt <= r_cnt;  // 可省略
        end else if (r_cnt == r_period_cycles - 1) begin
            r_cnt <= 0;
        end else begin
            r_cnt <= r_cnt + 1;
        end
    end

    // ==================================================
    // PWM输出逻辑
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_pwm_out <= 1'b0;
        else if (o_param_err)
            o_pwm_out <= 1'b0;
        else if (r_high_cycles >= r_period_cycles)
            o_pwm_out <= 1'b1;
        else if (r_cnt < r_high_cycles)
            o_pwm_out <= 1'b1;
        else
            o_pwm_out <= 1'b0;
    end

endmodule

```

# tb.v
```verilog
`timescale 1ns/1ns

module tb;

    // ==================================================
    // 参数定义
    // ==================================================
    parameter P_CLK_FREQ_MHZ = 50;
    parameter CLK_PERIOD_NS  = 1000 / P_CLK_FREQ_MHZ;

    // ==================================================
    // 信号定义
    // ==================================================
    reg         i_clk;
    reg         i_rst_n;
    reg  [31:0] i_period_us;
    reg  [31:0] i_high_us;
    wire        o_pwm_out;
    wire        o_param_err;

    // ==================================================
    // 实例化 DUT
    // ==================================================
    pwm #(
        .P_CLK_FREQ_MHZ(P_CLK_FREQ_MHZ),
        .P_COUNTER_WIDTH(32),
        .P_DEFAULT_PERIOD_US(1000),
        .P_DEFAULT_HIGH_US(500)
    ) dut (
        .i_clk       (i_clk),
        .i_rst_n     (i_rst_n),
        .i_period_us (i_period_us),
        .i_high_us   (i_high_us),
        .o_pwm_out   (o_pwm_out),
        .o_param_err (o_param_err)
    );

    // ==================================================
    // 时钟生成
    // ==================================================
    always #(CLK_PERIOD_NS / 2) i_clk = ~i_clk;

    // ==================================================
    // 初始过程
    // ==================================================
    initial begin
        $display(">>> Start PWM Testbench");

        i_clk       = 0;
        i_rst_n     = 0;
        i_period_us = 1000;  // 1ms周期
        i_high_us   = 200;   // 初始20%

        #500;
        i_rst_n = 1;

        // 维持一段时间后改变占空比为 50%
        #(3000 * 1000);
        i_high_us = 500;

        // 再一段时间后改为 80%
        #(3000 * 1000);
        i_high_us = 800;

        // 再观察一段时间
        #(3000 * 1000);

        $display(">>> Finish PWM Testbench");
        $finish;
    end

endmodule

```
