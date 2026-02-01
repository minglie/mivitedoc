# verilog规则
## 规则1：

>任何“作为输入信号”的信号，必须是 net 类型。
无论它是当前模块的 input 端口，
还是子模块 output 回连到本模块的信号（本模块视角的输入）

## 规则2：
>一个同步寄存器信号，只应由一个 always 块里 用 <= 赋值，
且 最多只会在一个时钟上升沿更新一次（取最后一次赋值）。
更新后的值在该上升沿之后即可被组合逻辑使用；
但若要被另一个寄存器作为条件采样，必须等到下一个上升沿。
## 规则3：
>一个 reg 信号，只应由一个 always 块赋值（单一驱动原则）。
>* 若该 always 为 时钟边沿敏感（posedge / negedge），
→ 综合为 D 触发器（寄存器）
>* 若该 always 为 组合敏感（@(*)）且  所有路径均赋值，
→ 综合为 纯组合逻辑
>* 若该 always 为 组合敏感，但 赋值不完整（缺 else / default），
→ 综合为 锁存器（latch）
# 单拍上升沿检测模块
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: edge_detect_pos_xxx
// Description: 上升沿检测模块（单拍触发），信号占位符为 xxx
/*
edge_detect_pos_xxx u_edge_rpc_start (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_xxx(i_rpc_start),
    .o_xxx_pos(w_rpc_start_posedge)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module edge_detect_pos_xxx (
    input  wire i_clk,       // 时钟
    input  wire i_rst_n,     // 异步复位，低有效
    input  wire i_xxx,       // 待检测信号
    output wire o_xxx_pos    // 上升沿脉冲输出（宽度1拍）
);

    // --------------------------
    // 延迟一拍寄存器，用于检测上升沿
    // --------------------------
    reg r_xxx_dly;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_xxx_dly <= 1'b0;
        else
            r_xxx_dly <= i_xxx;
    end

    // --------------------------
    // 上升沿检测输出
    // --------------------------
    assign o_xxx_pos = i_xxx && !r_xxx_dly;

endmodule


```

# 单拍下降沿检测模块
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: edge_detect_neg_xxx
// Description: 下降沿检测模块（单拍触发），信号占位符为 xxx
/*
edge_detect_neg_xxx u_edge_signal (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_xxx(i_signal),
    .o_xxx_neg(w_signal_negedge)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module edge_detect_neg_xxx (
    input  wire i_clk,
    input  wire i_rst_n,
    input  wire i_xxx,
    output wire o_xxx_neg
);

    // --------------------------
    // 延迟一拍寄存器
    // --------------------------
    reg r_xxx_dly;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_xxx_dly <= 1'b0;
        else
            r_xxx_dly <= i_xxx;
    end

    // --------------------------
    // 下降沿检测输出
    // --------------------------
    assign o_xxx_neg = !i_xxx && r_xxx_dly;

endmodule

```
# 三拍下降沿检测
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: sync_3stage_neg_edge_xxx
// Description: 三拍同步 + 下降沿检测（单拍脉冲）
/*
sync_3stage_neg_edge_xxx u_edge_neg (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_xxx(i_xxx_async),
    .o_xxx_sync(o_xxx_sync),
    .o_xxx_neg(o_xxx_neg)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module sync_3stage_neg_edge_xxx (
    input  wire i_clk,       // 时钟
    input  wire i_rst_n,     // 异步复位，低有效
    input  wire i_xxx,       // 异步输入信号
    output wire o_xxx_sync,  // 同步后的稳定信号
    output wire o_xxx_neg    // 下降沿脉冲（1 clk）
);

    // --------------------------
    // 三拍同步寄存器
    // --------------------------
    reg [2:0] r_xxx;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_xxx <= 3'b000;
        else
            r_xxx <= {r_xxx[1:0], i_xxx};
    end

    // --------------------------
    // 稳定同步输出（第二拍）
    // --------------------------
    assign o_xxx_sync = r_xxx[1];

    // --------------------------
    // 下降沿检测：1 -> 0
    // r_xxx[2] : 上一稳定态
    // r_xxx[1] : 当前稳定态
    // --------------------------
    assign o_xxx_neg = r_xxx[2] & ~r_xxx[1];

endmodule

```

# 单比特双拍同步模块1
```verilog

`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: sync_2stage_bit_xxx
// Description: 单线（单比特）双拍同步模块，占位符信号 xxx
/*
sync_2stage_bit_xxx u_sync_signal (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_xxx(i_async_sig),
    .o_xxx_sync(w_sig_sync)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module sync_2stage_bit_xxx (
    input  wire i_clk,       // 时钟
    input  wire i_rst_n,     // 异步复位，低有效
    input  wire i_xxx,       // 异步输入信号
    output reg  o_xxx_sync   // 同步输出信号
);

    // --------------------------
    // 两拍同步寄存器
    // --------------------------
    reg r_xxx_stage1;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_xxx_stage1 <= 1'b0;
            o_xxx_sync   <= 1'b0;
        end else begin
            r_xxx_stage1 <= i_xxx;
            o_xxx_sync   <= r_xxx_stage1;
        end
    end

endmodule

```


# 单比特双拍同步模块2
 可能含亚稳态,别用最新的r_xxx[0],应次新的r_xxx[1]
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
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

# 多比特总线双拍同步模块
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: sync_2stage_bus_xxx
// Description: 多比特总线双拍同步模块，占位符信号 xxx
/*
sync_2stage_bus_xxx #(
    .WIDTH(8)
) u_sync_bus (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_xxx(i_async_bus),
    .o_xxx_sync(w_bus_sync)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module sync_2stage_bus_xxx #(
    parameter WIDTH = 8           // 总线宽度
)(
    input  wire             i_clk,           // 时钟
    input  wire             i_rst_n,         // 异步复位，低有效
    input  wire [WIDTH-1:0] i_xxx,          // 异步输入总线
    output reg  [WIDTH-1:0] o_xxx_sync      // 同步输出总线
);

    // --------------------------
    // 两拍同步寄存器
    // --------------------------
    reg [WIDTH-1:0] r_xxx_stage1;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_xxx_stage1 <= {WIDTH{1'b0}};
            o_xxx_sync   <= {WIDTH{1'b0}};
        end else begin
            r_xxx_stage1 <= i_xxx;
            o_xxx_sync   <= r_xxx_stage1;
        end
    end

endmodule

```

# 参数化计数器
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: counter_xxx
// Description: 参数化计数器，可回绕计数，占位符信号 xxx
/*
counter_xxx #(
    .WIDTH(8),
    .MAX(255)
) u_counter (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_en(i_cnt_en),
    .o_cnt(o_cnt),
    .o_tc(w_tc)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module counter_xxx #(
    parameter WIDTH = 8,
    parameter MAX   = 255
)(
    input  wire           i_clk,   // 时钟
    input  wire           i_rst_n, // 异步复位，低有效
    input  wire           i_en,    // 计数使能
    output reg  [WIDTH-1:0] o_cnt, // 当前计数值
    output wire           o_tc     // 终点触发信号
);

    // --------------------------
    // 终点触发
    // --------------------------
    assign o_tc = (o_cnt == MAX);

    // --------------------------
    // 计数器逻辑
    // --------------------------
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_cnt <= {WIDTH{1'b0}};
        else if (i_en) begin
            if (o_cnt == MAX)
                o_cnt <= {WIDTH{1'b0}};
            else
                o_cnt <= o_cnt + 1'b1;
        end
    end

endmodule

```

# Moore 状态机
只依赖 当前状态，与输入无关
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: fsm_moore_xxx
// Description: Moore 状态机模板，占位符信号 xxx
/*
fsm_moore_xxx u_fsm (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_start(i_start),
    .o_state(o_state),
    .o_done(w_done)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module fsm_moore_xxx #(
    parameter WIDTH = 3           // 状态编码宽度
)(
    input  wire           i_clk,    // 时钟
    input  wire           i_rst_n,  // 异步复位，低有效
    input  wire           i_start,  // 启动信号
    output reg  [WIDTH-1:0] o_state,// 状态输出
    output reg            o_done    // 完成信号
);

    // --------------------------
    // 状态定义（S_开头）
    // --------------------------
    localparam S_IDLE  = 3'b000,
               S_RUN   = 3'b001,
               S_WAIT  = 3'b010,
               S_FIN   = 3'b011,
               S_ERROR = 3'b100; // 可扩展其他状态

    // --------------------------
    // 状态寄存器逻辑
    // --------------------------
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_state <= S_IDLE;
        else begin
            case(o_state)
                S_IDLE:  o_state <= i_start ? S_RUN : S_IDLE;
                S_RUN:   o_state <= S_WAIT;
                S_WAIT:  o_state <= S_FIN;
                S_FIN:   o_state <= S_IDLE;
                S_ERROR: o_state <= S_IDLE;
                default: o_state <= S_IDLE;
            endcase
        end
    end

    // --------------------------
    // 输出逻辑
    // --------------------------
    always @(*) begin
        o_done = (o_state == S_FIN);
    end

endmodule

```
# Mealy 状态机
依赖 当前状态 + 当前输入
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: fsm_mealy_xxx
// Description: Mealy 状态机模板，占位符信号 xxx
/*
fsm_mealy_xxx u_fsm_mealy (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_start(i_start),
    .i_ack(i_ack),
    .o_state(o_state),
    .o_done(o_done)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module fsm_mealy_xxx #(
    parameter WIDTH = 3           // 状态编码宽度
)(
    input  wire           i_clk,     // 时钟
    input  wire           i_rst_n,   // 异步复位，低有效
    input  wire           i_start,   // 启动信号
    input  wire           i_ack,     // 输入信号（影响输出）
    output reg  [WIDTH-1:0] o_state, // 当前状态
    output wire           o_done     // Mealy 输出
);

    // --------------------------
    // 状态定义（S_开头）
    // --------------------------
    localparam S_IDLE  = 3'b000,
               S_RUN   = 3'b001,
               S_WAIT  = 3'b010,
               S_FIN   = 3'b011,
               S_ERROR = 3'b100; // 可扩展其他状态

    // --------------------------
    // 状态寄存器逻辑
    // --------------------------
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_state <= S_IDLE;
        else begin
            case(o_state)
                S_IDLE:  o_state <= i_start ? S_RUN : S_IDLE;
                S_RUN:   o_state <= S_WAIT;
                S_WAIT:  o_state <= i_ack ? S_FIN : S_WAIT;
                S_FIN:   o_state <= S_IDLE;
                S_ERROR: o_state <= S_IDLE;
                default: o_state <= S_IDLE;
            endcase
        end
    end

    // --------------------------
    // Mealy 输出逻辑（依赖状态 + 输入）
    // --------------------------
    assign o_done = (o_state == S_WAIT) && i_ack; // 当 WAIT 状态且 i_ack=1 时输出脉冲
endmodule
```


# PWM 波生
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: pwm_gen_xxx
// Description: 占空比可调 PWM 生成，占位符信号 xxx
/*
pwm_gen_xxx #(
    .WIDTH(8)
) u_pwm (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_duty(i_duty),
    .o_pwm(o_pwm)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module pwm_gen_xxx #(
    parameter WIDTH = 8
)(
    input  wire           i_clk,
    input  wire           i_rst_n,
    input  wire [WIDTH-1:0] i_duty, // 占空比
    output reg            o_pwm
);

    reg [WIDTH-1:0] r_cnt;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_cnt <= {WIDTH{1'b0}};
        else
            r_cnt <= r_cnt + 1'b1;
    end

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_pwm <= 1'b0;
        else
            o_pwm <= (r_cnt < i_duty);
    end

endmodule

```

# 单拍脉冲生成
```verilog
`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Module Name: pulse_gen_xxx
// Description: 单拍脉冲生成模块，占位符信号 xxx
/*
pulse_gen_xxx u_pulse_gen (
    .i_clk(i_clk),
    .i_rst_n(i_rst_n),
    .i_trig(i_trig),
    .o_pulse(w_pulse)
);
*/
//////////////////////////////////////////////////////////////////////////////////
module pulse_gen_xxx (
    input  wire i_clk,
    input  wire i_rst_n,
    input  wire i_trig,
    output wire o_pulse
);

    // --------------------------
    // 延迟一拍
    // --------------------------
    reg r_trig_dly;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_trig_dly <= 1'b0;
        else
            r_trig_dly <= i_trig;
    end

    // --------------------------
    // 输出单拍脉冲
    // --------------------------
    assign o_pulse = i_trig && !r_trig_dly;

endmodule
```

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/fc2b0556fcc242d19d652972480a316e.jpeg)
