# pnm_dds_module.v

```verilog
`timescale 1ns/1ps
// =====================================================
// # 模块功能
// 本模块利用 DDS (直接数字合成, Direct Digital Synthesis) 思想，
// 在一个固定的时间片 (由 i_pnm_start 触发，例如1ms或100us) 内，
// 均匀地产生指定数量的脉冲。
// 输出为两位相位编码信号，适合用于步进电机全步驱动或其它需要
// A/B 相位脉冲的场景。
//
// # 功能特性
// - 支持在一个时间周期内指定脉冲数 (i_pnm_num)。
// - 支持方向控制 (i_pnm_dir=1 正转，0 反转)。
// - 周期起始时参数锁存 (i_pnm_start 有效时锁存 num/dir)。
// - 内部 DDS 累加器保证脉冲均匀分布，不会集中输出。
// - 输出为2位状态机序列：00→01→11→10→00 (正转)，反转则反向。
//
// # 使用方法
// 1. 参数写入：
//    - 将所需脉冲数输入 i_pnm_num。
//    - 将方向输入 i_pnm_dir (1=正转，0=反转)。
//    - 拉高 i_pnm_wr 一个时钟周期写入。
// 2. 周期触发：
//    - 每个周期开始时，拉高 i_pnm_start 一个时钟周期。
//    - 此时锁存参数，在本周期内保持不变。
// 3. 输出观察：
//    - o_pnm_out 为两位相位信号，每次 DDS 溢出时前进或后退一个状态。
//    - 每个周期内状态跳变次数 ≈ i_pnm_num。
// 4. 注意事项：
//    - P_ACC_MAX 决定累加器溢出阈值，影响脉冲密度。
//    - 脉冲实际速率 ≈ 时钟频率 × i_pnm_num ÷ P_ACC_MAX。
//    - i_pnm_num 建议小于 P_NUM_MAX。
//
// # 使用示例
// - 时钟 50 MHz, P_ACC_MAX=50000：
//   若 i_pnm_num=500 → 输出频率 ≈ 50e6 * 500 / 50000 = 500k 步/秒。
//   o_pnm_out 周期性序列：00→01→11→10 (正转)。
// =====================================================

module pnm_dds_module #(
    parameter integer P_SYSCLK_FREQ = 50_000_000, // Hz (for reference)
    parameter integer P_NUM_MAX     = 10_000,     // max input number (for reference)
    parameter integer P_ACC_MAX     = 50_000      // accumulator overflow threshold
)(
    input  wire        i_clk,
    input  wire        i_rst_n,          // async reset, active-low

    input  wire [15:0] i_pnm_num,        // requested “increment” (per tick)
    input  wire        i_pnm_dir,        // 1=forward, 0=backward
    input  wire        i_pnm_wr,         // write strobe for inputs above
    input  wire        i_pnm_start,      // period latch (e.g., 1ms / 100us)

    output wire [1:0]  o_pnm_out         // phased 2-bit output
);

    // =========================
    // Local widths
    // =========================
    localparam integer L_ACC_WIDTH = $clog2(P_ACC_MAX) + 2;

    // =========================
    // Staging registers (write domain)
    // =========================
    reg [15:0] r_pnm_num;
    reg        r_pnm_dir;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_pnm_num <= 16'd0;
            r_pnm_dir <= 1'b0;
        end else if (i_pnm_wr) begin
            r_pnm_num <= i_pnm_num;
            r_pnm_dir <= i_pnm_dir;
        end
    end

    // =========================
    // Latched config (per period)
    // =========================
    reg [15:0] r_pnm_num_locked;
    reg        r_pnm_dir_locked;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_pnm_num_locked <= 16'd0;
            r_pnm_dir_locked <= 1'b0;
        end else if (i_pnm_start) begin
            r_pnm_num_locked <= r_pnm_num;
            r_pnm_dir_locked <= r_pnm_dir;
        end
    end

    // =========================
    // DDS accumulator
    // - On i_pnm_start: load increment (start-of-period kick)
    // - Else: accumulate
    // - On overflow: wrap and produce a step event
    // =========================
    reg  [L_ACC_WIDTH-1:0] r_acc;
    wire [L_ACC_WIDTH-1:0] w_acc = i_pnm_start
                                 ? r_pnm_num_locked
                                 : (r_acc + r_pnm_num_locked);

    wire w_overflow = (w_acc >= P_ACC_MAX);

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_acc <= {L_ACC_WIDTH{1'b0}};
        end else if (w_overflow) begin
            r_acc <= w_acc - P_ACC_MAX;
        end else begin
            r_acc <= w_acc;
        end
    end

    // =========================
    // 2-bit phase state machine
    // - advance on overflow
    // - direction by r_pnm_dir_locked
    // =========================
    reg [1:0] r_state;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_state <= 2'b00;
        end else if (w_overflow) begin
            r_state <= r_pnm_dir_locked ? (r_state + 2'd1) : (r_state - 2'd1);
        end
    end

    // =========================
    // Output encoder (Gray-like)
    // 00 -> 01 -> 11 -> 10 -> 00
    // =========================
    reg [1:0] r_pnm_out;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_pnm_out <= 2'b00;
        end else begin
            case (r_state)
                2'b00: r_pnm_out <= 2'b00;
                2'b01: r_pnm_out <= 2'b01;
                2'b10: r_pnm_out <= 2'b11;
                2'b11: r_pnm_out <= 2'b10;
                default: r_pnm_out <= 2'b00;
            endcase
        end
    end

    assign o_pnm_out = r_pnm_out;

endmodule


```

# tb.sv
```verilog
`timescale 1ns/1ps
// =====================================================
// tb_pnm_dds_module.v — testbench for pnm_dds_module
// - 50MHz clock
// - periodic i_pnm_start pulse (1 us)
// - write configs via i_pnm_wr
// - count steps by monitoring o_pnm_out changes
// - pure English logs
// =====================================================
module tb;

    // =========================
    // Params & derived timing
    // =========================
    localparam integer P_CLK_FREQ    = 50_000_000;          // 50 MHz
    localparam real    P_CLK_PERIOD  = 1e9 / P_CLK_FREQ;    // ns per cycle

    // =========================
    // DUT ports
    // =========================
    reg                r_clk;
    reg                r_rst_n;

    reg  [15:0]        r_pnm_num_i;
    reg                r_pnm_dir_i;
    reg                r_pnm_wr_i;
    reg                r_pnm_start_i;

    wire [1:0]         w_pnm_out_o;

    // =========================
    // DUT instance
    // =========================
    pnm_dds_module #(
        .P_SYSCLK_FREQ (P_CLK_FREQ),
        .P_NUM_MAX     (10_000),
        .P_ACC_MAX     (50_000)
    ) u_pnm_dds_module (
        .i_clk         (r_clk),
        .i_rst_n       (r_rst_n),
        .i_pnm_num     (r_pnm_num_i),
        .i_pnm_dir     (r_pnm_dir_i),
        .i_pnm_wr      (r_pnm_wr_i),
        .i_pnm_start   (r_pnm_start_i),
        .o_pnm_out     (w_pnm_out_o)
    );

    // =========================
    // 50MHz clock
    // =========================
    initial begin
        r_clk = 1'b0;
        forever #(P_CLK_PERIOD/2) r_clk = ~r_clk;
    end

    // =========================
    // 1 us period i_pnm_start pulse
    // one-clock-wide pulse
    // =========================
    initial begin
        r_pnm_start_i = 1'b0;
        #(200);
        forever begin
            #(1000);                 // 1 us between start pulses
            r_pnm_start_i = 1'b1;    // assert for 1 clock
            @(posedge r_clk);
            r_pnm_start_i = 1'b0;
        end
    end

    // =========================
    // Helpers
    // =========================
    task t_write_cfg(input [15:0] num, input dir);
        begin
            @(posedge r_clk);
            r_pnm_num_i = num;
            r_pnm_dir_i = dir;
            r_pnm_wr_i  = 1'b1;
            @(posedge r_clk);
            r_pnm_wr_i  = 1'b0;
        end
    endtask

    task t_wait_clocks(input integer cycles);
        integer i;
        begin
            for (i = 0; i < cycles; i = i + 1) @(posedge r_clk);
        end
    endtask

    // Count steps by monitoring any change on 2-bit output
    reg  [1:0] r_last_out;
    integer    r_step_count;

    always @(posedge r_clk or negedge r_rst_n) begin
        if (!r_rst_n) begin
            r_last_out   <= 2'b00;
            r_step_count <= 0;
        end else begin
            if (w_pnm_out_o != r_last_out) begin
                r_last_out   <= w_pnm_out_o;
                r_step_count <= r_step_count + 1;
            end
        end
    end

    // =========================
    // Test notes:
    // step_rate ~= CLK * i_pnm_num / P_ACC_MAX
    // With CLK=50MHz and P_ACC_MAX=50_000:
    //   num=100  -> 100k steps/s  (~1 step / 500 clocks)
    //   num=500  -> 500k steps/s  (~1 step / 100 clocks)
    //   num=1000 ->   1M steps/s  (~1 step / 50 clocks)
    // =========================
    initial begin
        // init
        r_rst_n      = 1'b0;
        r_pnm_num_i  = 16'd0;
        r_pnm_dir_i  = 1'b0;
        r_pnm_wr_i   = 1'b0;
        r_last_out   = 2'b00;
        r_step_count = 0;

        // reset
        #(500);
        r_rst_n = 1'b1;

        // Case 1: dir=1, num=100
        t_write_cfg(16'd100, 1'b1);
        r_step_count = 0;
        t_wait_clocks(10_000); // ~200 us
        $display("[CASE1] dir=1 num=100 cycles=10000 steps=%0d", r_step_count);

        // Case 2: dir=1, num=500
        t_write_cfg(16'd500, 1'b1);
        r_step_count = 0;
        t_wait_clocks(10_000); // ~200 us
        $display("[CASE2] dir=1 num=500 cycles=10000 steps=%0d", r_step_count);

        // Case 3: dir=0, num=500 (reverse)
        t_write_cfg(16'd500, 1'b0);
        r_step_count = 0;
        t_wait_clocks(10_000); // ~200 us
        $display("[CASE3] dir=0 num=500 cycles=10000 steps=%0d", r_step_count);

        // Case 4: dir=1, num=1000
        t_write_cfg(16'd1000, 1'b1);
        r_step_count = 0;
        t_wait_clocks(10_000); // ~200 us
        $display("[CASE4] dir=1 num=1000 cycles=10000 steps=%0d", r_step_count);

        // done
        #(500);
        $stop;
    end

endmodule

```