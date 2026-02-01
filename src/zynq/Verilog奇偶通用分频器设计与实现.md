
# 💡 Verilog 实现奇偶分频的两种方法

在数字设计中，**时钟分频器**是一个非常常见的模块，用于生成比主时钟更低频率的时钟信号。  
特别地，当分频系数为**奇数**时，如何保持**接近 50% 占空比**成为一个挑战。


## 📌 分频原理概述

```bash
输入时钟： i_clk = x Hz
输出时钟： o_clk_div = i_clk / n

说明：
分频系数 n 表示：n 个 i_clk 周期构成 o_clk_div 的一个完整周期
当 n 为偶数：o_clk_div 占空比正好为 50%
当 n 为奇数：o_clk_div 占空比只能近似 50%，
比如高电平 k 或 k+1 个周期
```

# ✅ 1. 简单偶数分频器（不支持奇数）

📂 **文件名：** `clock_div.v`

```verilog
`timescale 1ns / 1ps
module clock_div#(
    parameter P_CLK_DIV_CNT = 2 //MAX = 65535
)(
    input    i_clk     ,
    input    i_rst_n     ,
    output   o_clk_div
    );
reg         ro_clk_div ;

reg  [15:0] r_cnt      ;
assign o_clk_div = ro_clk_div;

localparam L_COMPARE_CNT = P_CLK_DIV_CNT/2 - 1;

always @(posedge i_clk or negedge i_rst_n)begin
    if(!i_rst_n)
        r_cnt <= 'd0;
    else if(r_cnt == L_COMPARE_CNT)
        r_cnt <= 'd0;
    else
        r_cnt <= r_cnt + 1;
end

always @(posedge i_clk or negedge i_rst_n)begin
    if(!i_rst_n)
        ro_clk_div <= 'd0;
    else if(r_cnt == L_COMPARE_CNT)
        ro_clk_div <= ~ro_clk_div;
    else
        ro_clk_div <= ro_clk_div;
end

endmodule

```

#  ✅ 2. 奇偶通用分频器（双沿补偿法）
📂 文件名： clk_div_50duty.v
支持任意分频（奇数或偶数），自动切换逻辑。
```verilog
module clk_div_50duty #(
    parameter integer P_CLK_DIV_CNT = 3  // N ≥ 2
)(
    input  wire i_clk,       // 输入时钟
    input  wire i_rst_n,       // 同步复位，高有效
    output wire o_clk_div    // 输出分频时钟，占空比约 50%
);

    // ----------------------------------------
    // 判定奇偶
    // ----------------------------------------
    localparam L_IS_ODD   = P_CLK_DIV_CNT[0];           // 奇数为 1，偶数为 0
    localparam L_HALF_CNT = (P_CLK_DIV_CNT >> 1);       // N/2，用于偶数情况

    // ----------------------------------------
    // 偶数分频逻辑
    // ----------------------------------------
    reg [$clog2(P_CLK_DIV_CNT):0] r_cnt_even = 0;
    reg                           r_clk_even = 0;

    always @(posedge i_clk) begin
        if (!i_rst_n) begin
            r_cnt_even <= 0;
            r_clk_even <= 0;
        end else if (!L_IS_ODD) begin
            if (r_cnt_even == L_HALF_CNT - 1) begin
                r_cnt_even <= 0;
                r_clk_even <= ~r_clk_even;
            end else begin
                r_cnt_even <= r_cnt_even + 1;
            end
        end
    end

    // ----------------------------------------
    // 奇数分频逻辑（双沿互补法）
    // ----------------------------------------
    reg [$clog2(P_CLK_DIV_CNT):0] r_cnt_odd = 0;
    reg r_clk1 = 1, r_clk2 = 1;

    // 上升沿：clk1
    always @(posedge i_clk) begin
        if (!i_rst_n) begin
            r_cnt_odd <= 0;
            r_clk1    <= 1;
        end else if (L_IS_ODD) begin
            if (r_cnt_odd == P_CLK_DIV_CNT - 1)
                r_cnt_odd <= 0;
            else
                r_cnt_odd <= r_cnt_odd + 1;

            if (r_cnt_odd == (P_CLK_DIV_CNT >> 1))
                r_clk1 <= 0;
            else if (r_cnt_odd == P_CLK_DIV_CNT - 1)
                r_clk1 <= 1;
        end
    end

    // 下降沿：clk2
    always @(negedge i_clk) begin
        if (!i_rst_n)
            r_clk2 <= 1;
        else if (L_IS_ODD) begin
            if (r_cnt_odd == (P_CLK_DIV_CNT >> 1))
                r_clk2 <= 0;
            else if (r_cnt_odd == P_CLK_DIV_CNT - 1)
                r_clk2 <= 1;
        end
    end

    // ----------------------------------------
    // 输出选择
    // ----------------------------------------
    assign o_clk_div = (L_IS_ODD) ? (r_clk1 & r_clk2) : r_clk_even;

endmodule

```

# 🧪 仿真测试 tb.v
📂 文件名： tb.v
支持快速测试任意分频系数。
```verilog
`timescale 1ns / 1ps

module tb;

    // ---------------------------------
    // 参数：分频系数
    // 可尝试 3（奇数），4（偶数），5（奇数）等
    // ---------------------------------
    parameter P_CLK_DIV_CNT = 2;

    // ---------------------------------
    // 信号声明
    // ---------------------------------
    reg  i_clk;
    reg  i_rstn;
    wire o_clk_div;

    // ---------------------------------
    // 实例化被测模块
    // ---------------------------------
    clk_div_50duty #(
        .P_CLK_DIV_CNT(P_CLK_DIV_CNT)
    ) dut (
        .i_clk     (!i_clk),
        .i_rst_n     (i_rstn),
        .o_clk_div (o_clk_div)
    );

    // ---------------------------------
    // 生成时钟：50MHz (周期 = 20ns)
    // ---------------------------------
    initial i_clk = 0;
    always #10 i_clk = ~i_clk;

    // ---------------------------------
    // 复位过程
    // ---------------------------------
    initial begin
        i_rst_n = 0;
        #100;           // 保持复位 100ns
        i_rst_n = 1;
    end

    // ---------------------------------
    // 仿真时间控制
    // ---------------------------------
    initial begin
        $display("===== Start clk_div_50duty simulation (N = %0d) =====", P_CLK_DIV_CNT);
        #2000;          // 仿真 2000ns
        $display("===== End clk_div_50duty simulation =====");
        $stop;
    end

endmodule
```