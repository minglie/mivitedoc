本工程实现了一个完整的 6位动态扫描数码管显示系统。
将任意 30 位二进制整数（最大约10亿）实时显示在数码管上，支持带小数点控制。

# 模块构成

| 模块名                | 功能描述                                     |
| ------------------ | ---------------------------------------- |
| `HC_FPGA_Demo_Top` | 工程顶层模块，连接时钟、按键、串口、LED 与数码管等外设            |
| `smg`              | 数码管显示顶层模块，组合 `binary2bcd + digital_tube` |
| `binary2bcd`       | 使用 Shift-Add-3 算法将二进制转为 6 位 BCD 数字       |
| `digital_tube`     | 数码管扫描模块，实现段选/位选输出，支持小数点动态控制              |

# 顶层模块
```verilog
module HC_FPGA_Demo_Top
(
    input CLOCK_XTAL_50MHz,
	input RESET,
	input  KEY4,
	input  SIG_IN,
    input  RXD,
    output TXD,
    output LED0,
    output LED1,
    output LED2,
    output LED3,
    output  SIG_OUT1,
    output  SIG_OUT2,
    output  SIG_OUT3,
    output  SIG_OUT4,
    output  SIG_OUT5,
	output[7:0] DIG,
	output[5:0] SEL
);

parameter CLK_FREQ = 50000000;    //定义系统时钟频率


wire [29:0] smg_disp_data;



smg u_smg (
  .i_clk(CLOCK_XTAL_50MHz),
  .i_rst_n(RESET),
  .i_data(123456),
  .i_dp(0),
  .o_sel(SEL),
  .o_seg(DIG)
);


endmodule


```

# 数码管显示模块
```verilog
/**
 *  数码管显示模块
 * - 输入：30 位二进制数字
 * - 输出：6 位数码管段选与位选（带小数点）
 * - 结构：binary2bcd + digital_tube
 */
module smg (
    input   wire                i_clk       ,   // 时钟
    input   wire                i_rst_n     ,   // 异步复位，低有效
    input   wire [29:0]         i_data      ,   // 输入 30bit 二进制数据
    input   wire [5:0]          i_dp        ,   // 小数点控制（1亮）

    output  wire [5:0]          o_sel       ,   // 数码管位选（低有效）
    output  wire [7:0]          o_seg           // 数码管段选（负逻辑）
);

    // ==================================================
    // 中间信号定义
    // ==================================================
    wire        w_bcd_vld;
    wire [3:0]  w_bcd_d0, w_bcd_d1, w_bcd_d2, w_bcd_d3, w_bcd_d4, w_bcd_d5;

    // ==================================================
    // 二进制转BCD模块（显示6位十进制）
    // ==================================================
    binary2bcd u_binary2bcd (
        .i_clk       (i_clk),
        .i_rst_n     (i_rst_n),
        .i_data      (i_data),
        .o_data      ({w_bcd_d0, w_bcd_d1, w_bcd_d2, w_bcd_d3, w_bcd_d4, w_bcd_d5}),
        .o_data_vld  (w_bcd_vld)
    );

    // ==================================================
    // 数码管扫描显示模块
    // ==================================================
    digital_tube #(
        .P_CLK_FREQ   (50_000_000),
        .P_SCAN_FREQ  (1_000),
        .P_DIGIT_NUM  (6)
    ) u_digital_tube (
        .i_clk     (i_clk),
        .i_rst_n   (i_rst_n),
        .i_dig0    (w_bcd_d0),
        .i_dig1    (w_bcd_d1),
        .i_dig2    (w_bcd_d2),
        .i_dig3    (w_bcd_d3),
        .i_dig4    (w_bcd_d4),
        .i_dig5    (w_bcd_d5),
        .i_dp      (i_dp),
        .o_sel     (o_sel),
        .o_seg     (o_seg)
    );

endmodule


```

# 二进制转BCD
```verilog
/*
 * 二进制转BCD
 * Shift-Add-3 Algorithm
 * 输入：i_data（二进制）
 * 输出：o_data（BCD），o_data_vld（完成标志）
 */
module binary2bcd #(
    parameter P_DATA_WIDTH = 30,     // 输入数据位宽
    parameter P_CLK_FREQ   = 50_000_000 // 时钟频率（保留风格一致性）
) (
    input   wire                i_clk        , // 时钟
    input   wire                i_rst_n      , // 异步复位，低有效
    input   wire [P_DATA_WIDTH-1:0] i_data   , // 输入二进制数
    output  reg  [36:0]     o_data       , // 输出9位BCD码，共36位
    output  reg                o_data_vld    // 有效标志
);

    // ==================================================
    // Local Parameters
    // ==================================================
    localparam L_CNT_SHIFT_NUM = P_DATA_WIDTH;
    localparam L_SHIFT_WIDTH   = P_DATA_WIDTH + 36;  // BCD(9位) + 二进制

    // ==================================================
    // Registers
    // ==================================================
    reg [6:0]       r_cnt_shift;
    reg [L_SHIFT_WIDTH-1:0] r_data_shift;
    reg             r_shift_flag;

    // ==================================================
    // 移位控制计数器
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_cnt_shift <= 7'd0;
        else if ((r_cnt_shift == L_CNT_SHIFT_NUM + 1) && r_shift_flag)
            r_cnt_shift <= 7'd0;
        else if (r_shift_flag)
            r_cnt_shift <= r_cnt_shift + 1'b1;
    end

    // ==================================================
    // BCD移位转换逻辑
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_data_shift <= {L_SHIFT_WIDTH{1'b0}};
        else if (r_cnt_shift == 0)
            r_data_shift <= {{36{1'b0}}, i_data};
        else if ((r_cnt_shift <= L_CNT_SHIFT_NUM) && !r_shift_flag) begin
            if (r_data_shift[65:62] > 4) r_data_shift[65:62] <= r_data_shift[65:62] + 3;
            if (r_data_shift[61:58] > 4) r_data_shift[61:58] <= r_data_shift[61:58] + 3;
            if (r_data_shift[57:54] > 4) r_data_shift[57:54] <= r_data_shift[57:54] + 3;
            if (r_data_shift[53:50] > 4) r_data_shift[53:50] <= r_data_shift[53:50] + 3;
            if (r_data_shift[49:46] > 4) r_data_shift[49:46] <= r_data_shift[49:46] + 3;
            if (r_data_shift[45:42] > 4) r_data_shift[45:42] <= r_data_shift[45:42] + 3;
            if (r_data_shift[41:38] > 4) r_data_shift[41:38] <= r_data_shift[41:38] + 3;
            if (r_data_shift[37:34] > 4) r_data_shift[37:34] <= r_data_shift[37:34] + 3;
            if (r_data_shift[33:30] > 4) r_data_shift[33:30] <= r_data_shift[33:30] + 3;
        end else if ((r_cnt_shift <= L_CNT_SHIFT_NUM) && r_shift_flag)
            r_data_shift <= r_data_shift << 1;
    end

    // ==================================================
    // 交替控制加3/移位
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_shift_flag <= 1'b0;
        else
            r_shift_flag <= ~r_shift_flag;
    end

    // ==================================================
    // 结果输出
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            o_data     <= 36'd0;
            o_data_vld <= 1'b0;
        end else if (r_cnt_shift == L_CNT_SHIFT_NUM + 1) begin
            o_data     <= r_data_shift[65:30]; // 取出 BCD 码部分
            o_data_vld <= 1'b1;
        end else begin
            o_data_vld <= 1'b0;
        end
    end

endmodule

```
# 数码管扫描显示模块
```verilog
/**
 * ===============================================
 * 数码管扫描显示模块（Digital Tube Driver）
 * ===============================================
 */

module digital_tube #(
    parameter P_CLK_FREQ     = 50_000_000,     // 输入时钟频率（Hz）
    parameter P_SCAN_FREQ    = 1_000,          // 数码管刷新频率（Hz）
    parameter P_DIGIT_NUM    = 6               // 数码管位数
) (
    input   wire                i_clk       ,   // 时钟信号
    input   wire                i_rst_n     ,   // 异步复位，低有效

    input   wire    [3:0]       i_dig0      ,   // 各位数字输入（0~F）
    input   wire    [3:0]       i_dig1      ,
    input   wire    [3:0]       i_dig2      ,
    input   wire    [3:0]       i_dig3      ,
    input   wire    [3:0]       i_dig4      ,
    input   wire    [3:0]       i_dig5      ,
    input   wire    [P_DIGIT_NUM-1:0] i_dp  ,   // 小数点控制（1亮）

    output  reg     [P_DIGIT_NUM-1:0] o_sel ,   // 数码管位选（低有效）
    output  reg     [7:0]       o_seg           // 数码管段选（低有效）
);

    // ==================================================
    // 扫描频率计数器
    // ==================================================
    localparam integer L_SCAN_CNT_MAX = P_CLK_FREQ / P_SCAN_FREQ;

    reg [15:0] r_scan_cnt;
    wire       w_scan_cnt_end = (r_scan_cnt == L_SCAN_CNT_MAX - 1);

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_scan_cnt <= 0;
        else if (w_scan_cnt_end)
            r_scan_cnt <= 0;
        else
            r_scan_cnt <= r_scan_cnt + 1'b1;
    end

    // ==================================================
    //  位索引计数器
    // ==================================================
    reg [2:0] r_digit_idx;
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_digit_idx <= 0;
        else if (w_scan_cnt_end)
            r_digit_idx <= (r_digit_idx == P_DIGIT_NUM - 1) ? 0 : r_digit_idx + 1'b1;
    end

    // ==================================================
    // 数码管片选与数据选择
    // ==================================================
    reg  [3:0] r_hex;
    reg        r_dp;

    always @(*) begin
        case (r_digit_idx)
            3'd0: begin o_sel = 6'b111110; r_hex = i_dig0; r_dp = i_dp[0]; end
            3'd1: begin o_sel = 6'b111101; r_hex = i_dig1; r_dp = i_dp[1]; end
            3'd2: begin o_sel = 6'b111011; r_hex = i_dig2; r_dp = i_dp[2]; end
            3'd3: begin o_sel = 6'b110111; r_hex = i_dig3; r_dp = i_dp[3]; end
            3'd4: begin o_sel = 6'b101111; r_hex = i_dig4; r_dp = i_dp[4]; end
            default: begin o_sel = 6'b011111; r_hex = i_dig5; r_dp = i_dp[5]; end
        endcase
    end

    // ==================================================
    // 数码管段码定义（负逻辑）
    // ==================================================
    localparam [7:0] L_NUM0 = ~8'h3f;
    localparam [7:0] L_NUM1 = ~8'h06;
    localparam [7:0] L_NUM2 = ~8'h5b;
    localparam [7:0] L_NUM3 = ~8'h4f;
    localparam [7:0] L_NUM4 = ~8'h66;
    localparam [7:0] L_NUM5 = ~8'h6d;
    localparam [7:0] L_NUM6 = ~8'h7d;
    localparam [7:0] L_NUM7 = ~8'h07;
    localparam [7:0] L_NUM8 = ~8'h7f;
    localparam [7:0] L_NUM9 = ~8'h6f;
    localparam [7:0] L_NUMA = ~8'h77;
    localparam [7:0] L_NUMB = ~8'h7c;
    localparam [7:0] L_NUMC = ~8'h39;
    localparam [7:0] L_NUMD = ~8'h5e;
    localparam [7:0] L_NUME = ~8'h79;
    localparam [7:0] L_NUMF = ~8'h71;

    // ==================================================
    // 段选译码输出
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            o_seg <= 8'hff;
        else begin
            case (r_hex)
                4'h0: o_seg[6:0] <= L_NUM0[6:0];
                4'h1: o_seg[6:0] <= L_NUM1[6:0];
                4'h2: o_seg[6:0] <= L_NUM2[6:0];
                4'h3: o_seg[6:0] <= L_NUM3[6:0];
                4'h4: o_seg[6:0] <= L_NUM4[6:0];
                4'h5: o_seg[6:0] <= L_NUM5[6:0];
                4'h6: o_seg[6:0] <= L_NUM6[6:0];
                4'h7: o_seg[6:0] <= L_NUM7[6:0];
                4'h8: o_seg[6:0] <= L_NUM8[6:0];
                4'h9: o_seg[6:0] <= L_NUM9[6:0];
                4'ha: o_seg[6:0] <= L_NUMA[6:0];
                4'hb: o_seg[6:0] <= L_NUMB[6:0];
                4'hc: o_seg[6:0] <= L_NUMC[6:0];
                4'hd: o_seg[6:0] <= L_NUMD[6:0];
                4'he: o_seg[6:0] <= L_NUME[6:0];
                4'hf: o_seg[6:0] <= L_NUMF[6:0];
                default: o_seg[6:0] <= 7'b0000000;
            endcase
            o_seg[7] <= ~r_dp;  // 小数点控制：高亮 = 段信号为低
        end
    end

endmodule

```