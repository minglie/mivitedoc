
# Zynq中级开发七项必修课-第一课：事件采集与FIFO队列
[目录](Zynq中级开发七项必修课-第零课：目录.md)
# 目标
>- 一个事件有8个字节{事件源(1个字节),事件类型(1个字节）,arg(事件参数2个字节),ms_time(时间戳4个字节)};
> - 轻按 KEY5：依次产生 3 个事件 (DOWN -> CLICK -> UP)，数码管显示 3
> - 按下 KEY6：从 FIFO 取出并串口发送 1 条事件给串口助手，数码管更新为 2(队列中的剩余事件数)



# 目录结构
```markdown
HC_FPGA_Demo_Top (顶层模块)
├── 输入接口
│   ├── CLOCK_XTAL_50MHz (50MHz时钟)
│   ├── RESET (复位信号低有效)
│   ├── KEY5 (生成事件的按键)
|   └── KEY6 (发送出事件的按键)
│
├── 输出接口
│   ├── TXD (UART发送)
│   ├── DIG[7:0] (数码管段选)
│   └── SEL[5:0] (数码管位选)
│
├── 子模块
│   ├── key_debounce (KEY6生成读取事件和发送事件的脉冲)
│   │   ├── 输入: KEY6
│   │   └── 输出: w_read_evt_pulse, w_send_evt_pulse
│   │
│   ├── mi_key_fifo (KEY5按键事件写入FIFO)
│   │   ├── 输入: KEY5, w_read_evt_pulse
│   │   ├── 输出: w_evt, w_empty, w_data_count
│   │   └── 子模块
│   │       ├── mi_key (按键事件生成)
│   │       └── evt_fifo (事件队列)
│   │
│   ├── smg (数码管显示FIFO的满空状态和事件个数)
│   │   ├── 输入显示: i_data=w_full, w_empty, w_data_count
│   │   ├── 输出: DIG, SEL
│   │   └── 子模块
│   │       ├──binary2bcd (二进制转BCD)
|   |       └──digital_tube(数码管扫描显示模块)
│   │
│   └── evt_uart_tx (UART发送队列里的事件出去)
│       ├── 输入: i_start, i_evt, i_evt_remain_cnt
│       └── 输出: TXD
│       └── 子模块
│           └──uart_tx (串口发送)
|          
│
└── 内部信号连接
    ├── w_read_evt_pulse → mi_key_fifo.i_rd_en
    ├── w_send_evt_pulse → evt_uart_tx.i_start
    ├── w_evt → evt_uart_tx.i_evt
    └── w_data_count → smg.i_data, evt_uart_tx.i_evt_remain_cnt
```

# HC_FPGA_Demo_Top.v
```verilog
module HC_FPGA_Demo_Top
(
    input CLOCK_XTAL_50MHz,
	input RESET,
	input  KEY1,
	input  KEY2,
	input  KEY3,
	input  KEY4,
	input  KEY5,//生成事件的按键
	input  KEY6,//发送事件的按键
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

//生成读取事件和发送事件的脉冲
wire w_read_evt_pulse;
wire w_send_evt_pulse;
key_debounce u_key_debounce(
    .i_clk     (CLOCK_XTAL_50MHz),
    .i_rst_n   (RESET),
    .i_key     (KEY6),
    .o_key_pulse1(w_read_evt_pulse),
    .o_key_pulse2(w_send_evt_pulse)
);

// 按键事件写入FIFO
wire [63:0] w_evt;
wire [7:0] w_data_count;
wire  w_empty;
wire  w_full;
mi_key_fifo  u_mi_key_fifo (
    .i_clk        (CLOCK_XTAL_50MHz),
    .i_rst_n      (RESET),
    .i_key        (KEY5),
    .i_rd_en      (w_read_evt_pulse),
    .o_dout       (w_evt),
    .o_empty      (w_empty),
    .o_full       (),
    .o_data_count (w_data_count)
);

//数码管显示FIFO的满空状态和事件个数
smg u_smg (
  .i_clk(CLOCK_XTAL_50MHz),
  .i_rst_n(RESET),
  .i_data(w_full*100000+w_empty*10000+w_data_count),
  .i_dp(0),
  .o_sel(SEL),
  .o_seg(DIG)
);


// UART把FIFO中的事件发送出去
evt_uart_tx #(
    .P_CLK_FREQ (50_000_000),
    .P_UART_BPS (115200)
) u_vio_uart (
    .i_clk           (CLOCK_XTAL_50MHz),
    .i_rst_n         (RESET),
    .i_start (w_send_evt_pulse),
    .i_evt           (w_evt),
    .i_evt_remain_cnt  (w_data_count),
    .o_uart_txd      (TXD),
    .o_done          ()  //
);

endmodule


```
# key_debounce.v

```verilog
// -----------------------------------------------------
// key_debounce —— 按键消抖（按下=低）
// - 按下持续达到 P_DEBOUNCE_MS 后，产生两个相近的单周期脉冲：o_key_pulse1,o_key_pulse2
// 用于读取事件和发送事件
// -----------------------------------------------------
module  key_debounce
#(
    parameter P_CLK_FREQ_MHZ = 50,  // 时钟频率，单位MHz，默认50MHz
    parameter P_DEBOUNCE_MS  = 20,   // 消抖时间，单位ms，默认20ms
    parameter L_CNT_WIDTH    = 32  // 需要外部计算后传入
)
(
    input   wire    i_clk     ,    //系统时钟50Mhz
    input   wire    i_rst_n   ,    //全局复位
    input   wire    i_key      ,   //按键输入信号
    output  reg     o_key_pulse1,  //消抖后的脉冲信号1
    output  reg     o_key_pulse2   //消抖后的脉冲信号2
);

// 根据时钟频率和消抖时间计算需要计数的最大值
localparam L_MAX_CNT = P_CLK_FREQ_MHZ * 1000 * P_DEBOUNCE_MS;
reg     [L_CNT_WIDTH-1:0]  r_cnt  ;

// ==================================================
//  r_cnt ：记录按键按键的时间
// ==================================================
always@(posedge i_clk or negedge i_rst_n)
    if(i_rst_n == 1'b0)
        r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
     //按键松开,计数器清零
    else if(i_key == 1)
        r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
     //按键按下时，计数器计数
    else if(i_key == 1'b0 && r_cnt < L_MAX_CNT-1)
        r_cnt <= r_cnt + 1'b1;
    else
    //如果按键一直不释放,则r_cnt维持最大值,防止多次触发
        r_cnt <= r_cnt;

// ==================================================
//  输出两个脉冲信号触发其他模块
// ==================================================
always@(posedge i_clk or negedge i_rst_n)
    if(i_rst_n == 1'b0) begin
        o_key_pulse1 <= 1'b0;
        o_key_pulse2 <= 1'b0;
    end
     //计数快满时,产生一个时钟周期的脉冲,因为按住不松手时,计数器会维持在L_MAX_CNT-1
    else if(r_cnt ==  L_MAX_CNT-6)
        o_key_pulse1 <= 1'b1;
    else if(r_cnt ==  L_MAX_CNT-3)
        o_key_pulse2 <= 1'b1;
    else begin
        o_key_pulse1 <= 1'b0;
        o_key_pulse2 <= 1'b0;
    end
endmodule

```

# mi_key_fifo.v
```verilog
`timescale 1ns/1ps
// =====================================================
// mi_key_fifo.v — mi_key + evt_fifo 整合层
// - 按键低电平按下
// - 事件统一入 FIFO（64-bit）
// - FIFO 接口对齐 Vivado 风格（带 o_data_count）
// =====================================================
module mi_key_fifo #(
    // man_key 参数（与你最终版 mi_key_01.v 对齐）
    parameter integer P_CLK_FREQ           = 50_000_000,
    parameter integer P_KEY_INX            = 0,
    parameter integer P_LONG_MS            = 300,
    parameter integer P_DBL_MS             = 400,
    parameter integer P_PRESSING_STEP_MS   = 100,
    // FIFO 参数
    parameter integer P_FIFO_DEPTH         = 16  // 建议 2^N
)(
    // 全局
    input  wire                        i_clk,
    input  wire                        i_rst_n,       // 低有效复位

    // 按键输入（低电平按下）
    input  wire                        i_key,

    // FIFO 读侧接口（由上层消费事件）
    input  wire                        i_rd_en,
    output wire [63:0]                 o_dout,        // 事件字 {arg, inx, code}
    output wire                        o_empty,
    output wire                        o_full,
    output wire [$clog2(P_FIFO_DEPTH):0] o_data_count // 当前事件数量
);

    // -----------------------------
    // man_key 输出事件
    // -----------------------------
    wire        w_evt_valid;
    wire [63:0] w_evt;

    mi_key #(
        .P_CLK_FREQ         (P_CLK_FREQ),
        .P_KEY_INX          (P_KEY_INX),
        .P_LONG_MS          (P_LONG_MS),
        .P_DBL_MS           (P_DBL_MS),
        .P_PRESSING_STEP_MS (P_PRESSING_STEP_MS)
    ) u_man_key (
        .i_clk      (i_clk),
        .i_rst_n    (i_rst_n),
        .i_key      (i_key),        // 低电平=按下

        .o_evt_valid(w_evt_valid),
        .o_evt      (w_evt)         // {arg[15:0], inx[7:0], code[7:0]}
    );

    // -----------------------------
    // 事件 FIFO（64-bit）
    evt_fifo #(
        .P_DATA_WIDTH (64),
        .P_DEPTH      (P_FIFO_DEPTH)
    ) u_evt_fifo (
        .i_clk        (i_clk),
        .i_rst_n      (i_rst_n),
        // 写侧：每有事件就写入；FIFO 自身会在满时抑制写指针前进
        .i_wr_en      (w_evt_valid),
        .i_din        (w_evt),
        .o_full       (o_full),
        // 读侧：由上层拉走事件
        .i_rd_en      (i_rd_en),
        .o_dout       (o_dout),
        .o_empty      (o_empty),
        // 按键的事件个数
        .o_data_count (o_data_count)
    );






endmodule

```

## mi_key.v
```verilog
`timescale 1ns/1ps
// =====================================================
// mi_key.v
// -----------------------------------------------------
// 功能说明：
// - 输入 i_key 为物理按键（低电平 = 按下,高电平 = 松开）
// - 内部完成同步、消抖、状态机事件识别
// - 输出 o_evt_valid/o_evt 表示产生的按键事件
// - 支持事件：DOWN、UP、CLICK、DBL_CLICK、PRESSING、LONG_CLICK
// - 时序基准：1ms（由 P_CLK_FREQ 计算分频器）
// =====================================================
module mi_key #(
    parameter integer P_CLK_FREQ           = 50_000_000, // 输入时钟频率 Hz（例：50MHz）
    parameter integer P_KEY_INX            = 0,          // 按键编号，输出事件带上该索引
    parameter integer P_LONG_MS            = 300,        // 长按判定阈值（ms）
    parameter integer P_DBL_MS             = 400,        // 双击窗口时间（ms）
    parameter integer P_PRESSING_STEP_MS   = 100,        // 长按期间 PRESSING 周期（ms）
    parameter integer P_DEBOUNCE_MS        = 20          // 消抖时间（ms）
)(
    input  wire        i_clk,       // 系统时钟
    input  wire        i_rst_n,     // 异步复位（低有效）
    input  wire        i_key,       // 按键输入（低电平=按下，高电平=松开）
    output reg         o_evt_valid, // 输出事件有效标志
    output reg  [63:0] o_evt        // 事件编码{P_KEY_INX[7:0],code,arg,r_ms_time};
);

    // =====================================================
    // 事件编码定义（8bit code）
    // =====================================================
    localparam [7:0] L_EVT_DOWN       = 8'h01; // 按下
    localparam [7:0] L_EVT_UP         = 8'h02; // 松开
    localparam [7:0] L_EVT_CLICK      = 8'h03; // 单击
    localparam [7:0] L_EVT_DBL_CLICK  = 8'h04; // 双击
    localparam [7:0] L_EVT_PRESSING   = 8'h05; // 长按中周期触发
    localparam [7:0] L_EVT_LONG_CLICK = 8'h06; // 长按松开

    // =====================================================
    // 1ms 定时基准（分频器）
    // -----------------------------------------------------
    // 例如 50MHz 输入 → L_TCK_1MS = 50000
    // 每到 49999 时输出 w_tick_1ms = 1
    // =====================================================
    localparam integer L_TCK_1MS = (P_CLK_FREQ/1000);

    reg  [31:0] r_ms_div;          // 分频计数器
    wire        w_tick_1ms = (r_ms_div == L_TCK_1MS-1); // 1ms 到期脉冲

    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n)
            r_ms_div <= 32'd0;
        else if(w_tick_1ms)
            r_ms_div <= 32'd0;
        else
            r_ms_div <= r_ms_div + 1'b1;
    end


    //全局毫秒时间戳（自复位起）
    reg [31:0] r_ms_time;
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n)          r_ms_time <= 32'd0;
        else if(w_tick_1ms)   r_ms_time <= r_ms_time + 1'b1;
    end
    // =====================================================
    // 输入同步 + 消抖处理
    // -----------------------------------------------------
    // - 两拍同步避免亚稳态
    // - 基于 1ms 计时的消抖
    // - r_key_stable = 最终稳定后的电平
    // =====================================================
    reg  r_key_meta, r_key_sync;  // 两级同步寄存器
    reg  [31:0] r_db_cnt;         // 消抖计数器
    reg  [7:0]  r_pre_evt_code;          // 预发事件码
    reg         r_pre_evt_code_rdy;      // 预发事件码准备好了
    reg         r_key_stable;     // 稳定后的按键电平

    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n) begin
            r_key_meta   <= 1'b1; // 初始为松开状态
            r_key_sync   <= 1'b1;
            r_key_stable <= 1'b1;
            r_db_cnt     <= 32'd0;
        end else begin
            // 两拍同步（防亚稳）
            r_key_meta <= i_key;
            r_key_sync <= r_key_meta;

            // 基于 1ms tick 的消抖逻辑
            if(w_tick_1ms) begin
                if(r_key_sync != r_key_stable) begin
                    // 输入与稳定状态不一致 → 开始计数
                    if(r_db_cnt >= P_DEBOUNCE_MS-1) begin
                        // 超过阈值 → 认定为有效翻转
                        r_key_stable <= r_key_sync;
                        r_db_cnt     <= 32'd0;
                    end else begin
                        // 继续累计
                        r_db_cnt <= r_db_cnt + 1'b1;
                    end
                end else begin
                    // 一致则清零计数
                    r_db_cnt <= 32'd0;
                end
            end
        end
    end

    // =====================================================
    // 按键按下状态信号派生
    // -----------------------------------------------------
    // - w_keyPressState = 1 表示处于按下
    // - w_keyPressRise  = 检测到按下上升沿
    // =====================================================
    wire w_keyPressState = ~r_key_stable; // 输入低电平=按下 → 取反后“按下=1”
    reg  r_keyPressState_d1;              // 延迟一拍
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n)
            r_keyPressState_d1 <= 1'b0;
        else
            r_keyPressState_d1 <= w_keyPressState;
    end
    wire w_keyPressRise = ( w_keyPressState & ~r_keyPressState_d1 ); // 按键按下瞬间的脉冲信号

    // =====================================================
    // 状态机定义
    // -----------------------------------------------------
    // IDLE → 等待按下
    // WAIT_CLICK_UP → 按下中，等待松开或长按
    // WAIT_DBL_DOWN → 已单击，等待双击
    // WAIT_DBL_UP   → 第二次按下中，等待松开形成双击
    // LONG_PRESSING → 长按中，周期触发 PRESSING
    // =====================================================
    localparam [2:0] S_IDLE            = 3'd0,
                     S_WAIT_CLICK_UP   = 3'd1,
                     S_WAIT_DBL_DOWN   = 3'd2,
                     S_WAIT_DBL_UP     = 3'd3,
                     S_LONG_PRESSING   = 3'd4;

    reg [2:0]  r_state;
    reg [31:0] r_since_down_ms;     // 自按下累计的时间
    reg [31:0] r_pressing_step_ms;  // 长按期间 step 时间
    reg [15:0] r_pressing_count;    // 已产生的 PRESSING 次数

    // =====================================================
    // 事件触发任务
    // sendEvent：产生事件，填充 o_evt
    // =====================================================
    task sendEvent;
        input [7:0]  code;  // 事件编码
        input [15:0] arg;   // 附加参数（如 PRESSING 次数）
        begin
            o_evt_valid <= 1'b1;
            o_evt       <= {P_KEY_INX[7:0],code,arg,r_ms_time};
        end
    endtask
    // =====================================================
    // 预发送
    // preSendEvent 空闲时再发
    // =====================================================
    task preSendEvent;
        input [7:0]  code;
        begin
            r_pre_evt_code  <= code;
            r_pre_evt_code_rdy<= 1'b1;
        end
    endtask
    // =====================================================
    // 清除事件
    // =====================================================
    task clearEvt;
    begin
        o_evt_valid <= 1'b0;
        o_evt       <= 64'd0;
    end
    endtask

    // =====================================================
    // 状态机主逻辑
    // =====================================================
    always @(posedge i_clk or negedge i_rst_n) begin
        if(!i_rst_n) begin
            // 复位初始化
            r_state            <= S_IDLE;
            r_since_down_ms    <= 32'd0;
            r_pressing_step_ms <= 32'd0;
            r_pressing_count   <= 16'd0;
            r_pre_evt_code_rdy<= 1'b0;
            clearEvt();
        end else begin
            // 默认先清空事件
            clearEvt();
            if(w_tick_1ms) begin
                r_since_down_ms    <= (r_state != S_IDLE)          ? (r_since_down_ms + 1)     : 32'd0;
                r_pressing_step_ms <= (r_state == S_LONG_PRESSING) ? (r_pressing_step_ms + 1) : 32'd0;
            end

            // FSM 状态转移
            case (r_state)
                // 空闲 → 等待按下
                S_IDLE: begin
                    if (w_keyPressRise) begin
                        sendEvent(L_EVT_DOWN, 16'd0);
                        r_since_down_ms  <= 32'd0;
                        r_state          <= S_WAIT_CLICK_UP;
                    end
                    else  begin
                        if(r_pre_evt_code_rdy) begin
                            sendEvent(r_pre_evt_code, 16'd0);
                            r_pre_evt_code_rdy <= 1'b0;
                        end
                    end
                end
                // 已按下 → 等待松开或长按
                S_WAIT_CLICK_UP: begin
                    if ((r_since_down_ms >= P_LONG_MS) && w_tick_1ms) begin
                        // 达到长按阈值 → 转长按中
                        r_pressing_count   <= 16'd1;
                        r_pressing_step_ms <= 32'd0;
                        sendEvent(L_EVT_PRESSING, 16'd0);
                        r_state <= S_LONG_PRESSING;
                    end
                    else if (!w_keyPressState) begin
                        // 松开 → 进入等待双击
                        r_state <= S_WAIT_DBL_DOWN;
                    end
                end

                // 等待第二次按下形成双击
                S_WAIT_DBL_DOWN: begin
                    if ((r_since_down_ms >= P_DBL_MS) && w_tick_1ms) begin
                        // 超时 → 认定为单击
                        sendEvent(L_EVT_CLICK, 16'd0);
                        preSendEvent(L_EVT_UP);
                        r_state <= S_IDLE;
                    end
                    else if (w_keyPressRise) begin
                        // 第二次按下
                        r_state <= S_WAIT_DBL_UP;
                    end
                end

                // 第二次按下中，等待松开确认双击
                S_WAIT_DBL_UP: begin
                    if (!w_keyPressState) begin
                        sendEvent(L_EVT_DBL_CLICK, 16'd0);
                        preSendEvent(L_EVT_UP);
                        r_state <= S_IDLE;
                    end
                end

                // 长按期间
                S_LONG_PRESSING: begin
                    if (!w_keyPressState) begin
                        // 松开 → 产生 LONG_CLICK
                        sendEvent(L_EVT_LONG_CLICK, r_pressing_count);
                        preSendEvent(L_EVT_UP);
                        r_state <= S_IDLE;
                    end
                    else if ((r_pressing_step_ms >= P_PRESSING_STEP_MS) && w_tick_1ms) begin
                        // 周期性 PRESSING 事件
                        r_pressing_step_ms <= 32'd0;
                        r_pressing_count   <= r_pressing_count + 1'b1;
                        sendEvent(L_EVT_PRESSING, r_pressing_count);
                    end
                end
                default: r_state <= S_IDLE;
            endcase
        end
    end
endmodule

```
## evt_fifo.v
```verilog
// =====================================================
// evt_fifo.v — 简单双口同步 FIFO（单时钟）
// - 结构：双端口（同一时钟）RAM + 写/读指针 + 计数器
// - 时序：非 FWFT（First-Word-Fall-Through）；读使能后下一拍输出有效数据
// 复位说明：i_rst_n 为**异步**低有效复位（always 块里用 negedge i_rst_n）
// 深度要求：当前实现默认“指针自然回绕”，**推荐 P_DEPTH 为 2 的幂**；
// =====================================================
module evt_fifo #(
    parameter P_DATA_WIDTH = 64,    // 数据位宽
    parameter P_DEPTH      = 1024   // FIFO 深度（元素个数）
)(
    input  wire                    i_clk,
    input  wire                    i_rst_n,        // 异步复位，低有效（0=复位，1=工作）

    // ---------------- 写端口 ----------------
    input  wire                    i_wr_en,        // 写请求（高有效）
    input  wire [P_DATA_WIDTH-1:0] i_din,          // 待写入的数据
    output wire                    o_full,         // FIFO 满标志（1=满，不再接受写）

    // ---------------- 读端口 ----------------
    input  wire                    i_rd_en,        // 读请求（高有效）
    output reg  [P_DATA_WIDTH-1:0] o_dout,         // 读出的数据（注册输出）
    output wire                    o_empty,        // FIFO 空标志（1=空，不能再读）

    // ---------------- 状态 ------------------
    // 计数范围：0 ~ P_DEPTH
    // 宽度说明：$clog2(P_DEPTH) 计算可寻址深度的位数；再 +1 表示能数到 P_DEPTH
    output reg  [$clog2(P_DEPTH):0] o_data_count   // 当前队列中元素数量
);

    // ============== 本地常量与存储器 ==============
    // 地址位宽：能覆盖 [0 .. P_DEPTH-1]
    localparam L_ADDR_WIDTH = $clog2(P_DEPTH);

    // 存储体：综合器根据容量自动推断为 LUTRAM/BRAM。
    // 建议在 Xilinx 平台上大容量时使用 BRAM（可加属性约束）：
    // (* ram_style = "block" *) reg [P_DATA_WIDTH-1:0] r_mem [0:P_DEPTH-1];
    reg [P_DATA_WIDTH-1:0] r_mem [0:P_DEPTH-1];

    // 写指针、读指针（环形地址）
    reg [L_ADDR_WIDTH-1:0] w_ptr, r_ptr;

    // ============== 满/空标志 ==============
    // 注意：这里用“计数器”来判断满/空，而不是用“指针对比”。
    //       好处是语义直观；缺点是需要一组加/减逻辑。
    assign o_full  = (o_data_count == P_DEPTH);
    assign o_empty = (o_data_count == 0);

    // ============== 写逻辑 ==============
    // 触发：时钟上升沿 或 复位下降沿
    // 语义：
    // - 复位时：写指针清零
    // - 工作时：当写使能有效 且 非满 时，把 i_din 写入 r_mem[w_ptr]，写指针 +1
    // - 若满：忽略写（丢弃本次 i_wr_en，保护队列不溢出）
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            w_ptr <= {L_ADDR_WIDTH{1'b0}};
        end else if (i_wr_en && !o_full) begin
            r_mem[w_ptr] <= i_din;
            // 指针自增：这里依赖位宽自然回绕（推荐 P_DEPTH 为 2 的幂）
            // 若 P_DEPTH 非 2 的幂，请参见文末“指针回绕处理”小节。
            w_ptr <= w_ptr + 1'b1;
        end
        // else: 维持不变
    end

    // ============== 读逻辑 ==============
    // 触发：时钟上升沿 或 复位下降沿
    // 语义：
    // - 复位时：读指针清零，o_dout 清零（仿真友好）
    // - 工作时：当读使能有效 且 非空 时，从 r_mem[r_ptr] 读出到 o_dout，读指针 +1
    // - 注意：此实现为“非 FWFT”（需要 i_rd_en 的这个周期打拍，下一拍数据到 o_dout）
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_ptr  <= {L_ADDR_WIDTH{1'b0}};
            o_dout <= {P_DATA_WIDTH{1'b0}};
        end else if (i_rd_en && !o_empty) begin
            o_dout <= r_mem[r_ptr];
            r_ptr  <= r_ptr + 1'b1;  // 同写指针，依赖自然回绕
        end
        else begin
            o_dout <= o_dout;  // 仿真友好：维持不变
        end
    end

    // ============== 计数逻辑 ==============
    // 触发：时钟上升沿 或 复位下降沿
    // 语义：
    // - 复位时：计数清零
    // - 工作时：
    //    * 只写（且非满）：计数 +1
    //    * 只读（且非空）：计数 -1
    //    * 同时读写（都有效且不违例）：计数不变（同周期补偿）
    //    * 都不使能：维持不变
    //
    // 注意：这里用 {条件写, 条件读} 的拼接 case，能清晰覆盖四种情况。
    // “条件写 = i_wr_en && !o_full”，“条件读 = i_rd_en && !o_empty”
    // 从而避免无谓地在满/空状态下改变计数。
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            o_data_count <= {($clog2(P_DEPTH)+1){1'b0}};
        end else begin
            case ({i_wr_en && !o_full, i_rd_en && !o_empty})
                2'b10: o_data_count <= o_data_count + 1'b1; // 只写
                2'b01: o_data_count <= o_data_count - 1'b1; // 只读
                default: /*2'b00 或 2'b11*/                 // 空闲 或 同时读写
                    o_data_count <= o_data_count;           // 计数不变
            endcase
        end
    end

    // =====================================================
    // 可选：静态检查/提示（仿真期有用；综合器会忽略 initial $error）
    // - 若希望“自然回绕”严格安全，P_DEPTH 最好是 2 的幂。
    // - 若不是 2 的幂，请在指针更新处做显式模运算（见下文注释）。
    // =====================================================
    // localparam L_IS_POW2 = (P_DEPTH & (P_DEPTH - 1)) == 0;
    // initial begin
    //   if (!L_IS_POW2) begin
    //     $error("evt_fifo: P_DEPTH=%0d 不是 2 的幂。请确保指针回绕做显式处理，或将深度改为 2^k。", P_DEPTH);
    //   end
    // end

endmodule

```

# smg.v
```verilog
/**
 *  数码管显示顶层模块
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

## binary2bcd.v
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

## digital_tube.v
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

# evt_uart_tx.v
```verilog
`timescale 1ns/1ps
// -----------------------------------------------------
// 模块名称：evt_uart_tx
// 功能描述：将事件信息通过UART协议发送出去
// 封包格式：共9字节，具体为
//           [时间戳(4字节), 事件参数编码索引(4字节), 事件队列剩余事件个数(1字节)]
// 触发机制：i_start为单周期脉冲触发，触发时锁存i_evt和i_evt_remain_cnt的值
// 完成标志：每发送完一帧数据后，o_done输出一个单周期脉冲
// -----------------------------------------------------
module evt_uart_tx #(
    parameter P_CLK_FREQ = 50_000_000,  // 时钟频率，默认50MHz
    parameter P_UART_BPS = 115200       // UART波特率，默认115200
)(
    input         i_clk,                // 系统时钟
    input         i_rst_n,              // 异步复位，低电平有效

    // 发送控制信号
    input         i_start,              // 发送触发（单周期脉冲）：触发时发送当前i_evt和剩余事件数
    input  [63:0] i_evt,                // 事件数据（64位）：高32位为时间戳，低32位为事件参数编码索引
    input  [7:0]  i_evt_remain_cnt,     // 事件队列中剩余的事件个数

    // UART接口
    output        o_uart_txd,           // UART发送数据输出

    // 状态反馈
    output reg    o_done                // 一帧数据发送完成（单周期脉冲）
);

    // ===== UART发送器实例化 =====
    reg        r_tx_en;                 // UART发送使能（单周期有效）
    reg [7:0]  r_tx_data;               // 待发送的8位数据
    wire       w_tx_busy;               // UART发送忙状态（高电平表示正在发送）

    // 例化UART发送模块
    uart_tx #(
        .P_CLK_FREQ(P_CLK_FREQ),
        .P_UART_BPS(P_UART_BPS)
    ) u_tx (
        .i_clk          (i_clk),
        .i_rst_n        (i_rst_n),
        .i_uart_tx_en   (r_tx_en),       // 发送使能
        .i_uart_tx_data (r_tx_data),     // 发送数据
        .o_uart_tx_busy (w_tx_busy),     // 发送忙状态
        .o_uart_txd     (o_uart_txd)     // UART发送引脚
    );

    // ===== 内部状态与缓冲 =====
    reg [7:0] r_tx_buffer [0:8];   // 发送缓冲区：存储9字节待发送数据（0~7为i_evt拆分，8为剩余事件数）
    reg [3:0] r_tx_cnt;            // 发送计数：当前正在发送的字节索引（0~8）
    reg       r_wait_busy;         // 等待忙状态标记：用于避免重复触发同一字节发送
    reg       r_evt_pending;       // 事件待处理标记：标记有新的发送请求未处理

    // 状态机定义
    localparam S_IDLE     = 2'd0,  // 空闲状态：等待发送请求
               S_EVT_LOAD = 2'd1,  // 数据装载状态：将事件数据存入发送缓冲区
               S_SEND     = 2'd2;  // 发送状态：逐字节发送缓冲区数据

    reg [1:0] r_state;             // 状态机寄存器

    // 整数变量：用于初始化数组
    integer i;

    // 主状态机逻辑
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            // 复位时初始化所有寄存器
            r_state       <= S_IDLE;                  // 回到空闲状态
            r_tx_en       <= 1'b0;                    // 关闭发送使能
            r_tx_data     <= 8'd0;                    // 发送数据清零
            r_tx_cnt      <= 4'd0;                    // 发送计数清零
            r_wait_busy   <= 1'b0;                    // 清除等待标记
            r_evt_pending <= 1'b0;                    // 清除待处理标记
            o_done        <= 1'b0;                    // 清除完成标记
            for (i=0; i<9; i=i+1) r_tx_buffer[i] <= 8'd0;  // 清空发送缓冲区
        end else begin
            // 默认值：单周期信号自动清零
            r_tx_en  <= 1'b0;   // 发送使能仅在当前周期有效
            o_done   <= 1'b0;   // 完成标记仅在当前周期有效

            // 检测到发送触发信号时，标记有事件待处理
            if (i_start)
                r_evt_pending <= 1'b1;

            // 状态机切换逻辑
            case (r_state)
                // 空闲状态：等待新的发送请求
                S_IDLE: begin
                    r_tx_cnt    <= 0;                  // 重置发送计数
                    r_wait_busy <= 0;                  // 清除等待标记
                    // 若有事件待处理，进入数据装载状态
                    if (r_evt_pending)
                        r_state <= S_EVT_LOAD;
                end

                // 数据装载状态：将输入数据存入发送缓冲区
                S_EVT_LOAD: begin
                    // 将64位i_evt拆分为8个字节存入缓冲区（小端序：低字节存低地址）
                    {r_tx_buffer[7], r_tx_buffer[6], r_tx_buffer[5], r_tx_buffer[4],
                     r_tx_buffer[3], r_tx_buffer[2], r_tx_buffer[1], r_tx_buffer[0]} <= i_evt;
                    r_tx_buffer[8] <= i_evt_remain_cnt;  // 第9字节存入剩余事件数
                    r_tx_cnt       <= 0;                  // 重置发送计数
                    r_wait_busy    <= 0;                  // 清除等待标记
                    r_evt_pending  <= 0;                  // 清除待处理标记（当前请求已受理）
                    r_state        <= S_SEND;             // 进入发送状态
                end

                // 发送状态：逐字节发送缓冲区数据
                S_SEND: begin
                    // 若UART不忙且未处于等待状态，触发当前字节发送
                    if (!w_tx_busy && !r_wait_busy) begin
                        r_tx_data   <= r_tx_buffer[r_tx_cnt];  // 取出当前要发送的字节
                        r_tx_en     <= 1'b1;                    // 触发UART发送
                        r_tx_cnt    <= r_tx_cnt + 1;            // 发送计数+1（准备下一字节）
                        r_wait_busy <= 1'b1;                    // 标记为"已触发发送，等待UART忙"
                    end
                    // 若UART已进入忙状态，清除等待标记（表示当前发送已被UART受理）
                    else if (w_tx_busy) begin
                        r_wait_busy <= 1'b0;
                    end

                    // 发送完成判断：所有9字节发送完毕且UART已空闲
                    if (!w_tx_busy && (r_tx_cnt == 9)) begin
                        o_done <= 1'b1;  // 输出完成标记（单周期）
                        // 若有新的待处理事件，直接进入下一轮装载；否则回到空闲
                        if (r_evt_pending)
                            r_state <= S_EVT_LOAD;
                        else
                            r_state <= S_IDLE;
                    end
                end
            endcase
        end
    end

endmodule
```
## uart_tx.v
```verilog
module uart_tx #(
    parameter P_CLK_FREQ = 50_000_000,
    parameter P_UART_BPS = 115200
) (
    // from system
    input                   i_clk       ,
    input                   i_rst_n   ,
    input                   i_uart_tx_en    ,
    input           [7 : 0] i_uart_tx_data  ,
    output  reg             o_uart_tx_busy , // 发送中标志
    // output
    output  reg             o_uart_txd
);

// parameter define
localparam  L_BAUD_CNT_MAX = P_CLK_FREQ / P_UART_BPS;

// reg define
reg [3:0]   r_bit_cnt;
reg [15:0]  r_baud_cnt;
reg [7 :0]  r_tx_data_t;
reg         r_uart_tx_en_d;

//i_uart_tx_en的上升沿
wire        w_uart_tx_en_posedge;

// detect i_uart_tx_en rising edge
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n)
        r_uart_tx_en_d <= 1'b0;
    else
        r_uart_tx_en_d <= i_uart_tx_en;
end

assign w_uart_tx_en_posedge = i_uart_tx_en && !r_uart_tx_en_d;

// baud rate counter
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n)
        r_baud_cnt <= 16'd0;
    else if (o_uart_tx_busy) begin
        if (r_baud_cnt == L_BAUD_CNT_MAX - 1)
            r_baud_cnt <= 16'd0;
        else
            r_baud_cnt <= r_baud_cnt + 1'b1;
    end else begin
        r_baud_cnt <= 16'd0;
    end
end

// tx bit counter
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n)
        r_bit_cnt <= 4'd0;
    else if (o_uart_tx_busy && (r_baud_cnt == L_BAUD_CNT_MAX - 1))
        r_bit_cnt <= r_bit_cnt + 1'b1;
    else if (!o_uart_tx_busy)
        r_bit_cnt <= 4'd0;
end

// control busy and latch data
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        r_tx_data_t     <= 8'd0;
        o_uart_tx_busy <= 1'b0;
    end
    else if (w_uart_tx_en_posedge && !o_uart_tx_busy) begin
        r_tx_data_t     <= i_uart_tx_data;
        o_uart_tx_busy <= 1'b1;
    end
    else if (o_uart_tx_busy && r_bit_cnt == 4'd9 && r_baud_cnt == L_BAUD_CNT_MAX - 1) begin
        o_uart_tx_busy <= 1'b0;
    end
end

// generate txd signal
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n)
        o_uart_txd <= 1'b1;
    else if (o_uart_tx_busy) begin
        case(r_bit_cnt)
            4'd0 : o_uart_txd <= 1'b0;               // start bit
            4'd1 : o_uart_txd <= r_tx_data_t[0];
            4'd2 : o_uart_txd <= r_tx_data_t[1];
            4'd3 : o_uart_txd <= r_tx_data_t[2];
            4'd4 : o_uart_txd <= r_tx_data_t[3];
            4'd5 : o_uart_txd <= r_tx_data_t[4];
            4'd6 : o_uart_txd <= r_tx_data_t[5];
            4'd7 : o_uart_txd <= r_tx_data_t[6];
            4'd8 : o_uart_txd <= r_tx_data_t[7];
            4'd9 : o_uart_txd <= 1'b1;               // stop bit
            default : o_uart_txd <= 1'b1;
        endcase
    end
    else
        o_uart_txd <= 1'b1;
end

endmodule



```

# tb_evt_fifo.v
```verilog
`timescale 1ns/1ps

module tb_evt_fifo;

  // 时钟和复位
  logic clk;
  logic rst_n;
  
  // FIFO接口信号
  logic wr_en;
  logic [63:0] din;
  logic rd_en;
  logic [63:0] dout;
  logic full;
  logic empty;
  logic [4:0] data_count;  // 16深度需要5位计数

  // 实例化evt_fifo模块
  evt_fifo #(
    .P_DATA_WIDTH(64),
    .P_DEPTH(16)
  ) u_evt_fifo (
    .i_clk(clk),
    .i_rst_n(rst_n),
    .i_wr_en(wr_en),
    .i_din(din),
    .o_full(full),
    .i_rd_en(rd_en),
    .o_dout(dout),
    .o_empty(empty),
    .o_data_count(data_count)
  );

  // 时钟生成
  initial begin
    clk = 0;
    forever #10 clk = ~clk; // 50MHz时钟
  end

  // 测试序列
  initial begin
    // 初始化
    rst_n = 0;
    wr_en = 0;
    rd_en = 0;
    din = 64'h0;
    
    // 复位
    #100;
    rst_n = 1;
    #100;
    
    $display("=== FIFO Test Started ===");
    $display("Time=%0t: Reset released", $time);
    
    // 测试1：写入数据
    $display("=== Test 1: Write data ===");
    repeat(5) begin
      @(posedge clk);
      wr_en = 1;
      din = $random; // 随机数据
      $display("Time=%0t: Writing data=%h, count=%0d", $time, din, data_count);
      @(posedge clk);
      wr_en = 0;
      #100;
    end
    
    // 测试2：读取数据
    $display("=== Test 2: Read data ===");
    repeat(3) begin
      @(posedge clk);
      rd_en = 1;
      $display("Time=%0t: Reading data, count=%0d", $time, data_count);
      @(posedge clk);
      rd_en = 0;
      $display("Time=%0t: Read data=%h", $time, dout);
      #100;
    end
    
    // 测试3：同时读写
    $display("=== Test 3: Simultaneous read/write ===");
    @(posedge clk);
    wr_en = 1;
    rd_en = 1;
    din = 64'hA5A5A5A5A5A5A5A5;
    $display("Time=%0t: Simultaneous R/W, count=%0d", $time, data_count);
    @(posedge clk);
    wr_en = 0;
    rd_en = 0;
    $display("Time=%0t: R/W completed, count=%0d", $time, data_count);
    
    // 测试4：边界条件
    $display("=== Test 4: Boundary conditions ===");
    // 写满FIFO
    repeat(20) begin
      @(posedge clk);
      if (!full) begin
        wr_en = 1;
        din = $random;
        $display("Time=%0t: Writing to full FIFO, count=%0d, full=%b", $time, data_count, full);
      end else begin
        wr_en = 0;
        $display("Time=%0t: FIFO is full, count=%0d", $time, data_count);
        break;
      end
      @(posedge clk);
      wr_en = 0;
    end
    
    // 读空FIFO
    repeat(20) begin
      @(posedge clk);
      if (!empty) begin
        rd_en = 1;
        $display("Time=%0t: Reading from FIFO, count=%0d, empty=%b", $time, data_count, empty);
      end else begin
        rd_en = 0;
        $display("Time=%0t: FIFO is empty, count=%0d", $time, data_count);
        break;
      end
      @(posedge clk);
      rd_en = 0;
    end
    
    #1000;
    $display("=== FIFO Test Completed ===");
    $finish;
  end

  // 监控FIFO状态变化
  always @(posedge clk) begin
    if (wr_en && !full) begin
      $display("Time=%0t: Write successful, new count=%0d", $time, data_count);
    end
    if (rd_en && !empty) begin
      $display("Time=%0t: Read successful, new count=%0d", $time, data_count);
    end
  end

endmodule

```


# quartus导入文件
```shell
set rtl_dir "D:/workspace/gitee/0/ming-verilog_prj/ming-verilog/src/freq"
set_global_assignment -name VERILOG_FILE  $rtl_dir/smg.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/HC_FPGA_Demo_Top.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/digital_tube.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/binary2bcd.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/evt_uart_tx.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/uart_tx.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/evt_fifo.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/mi_key.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/mi_key_fifo.v
set_global_assignment -name VERILOG_FILE  $rtl_dir/key_debounce.v
```



# quartus引脚绑定
```shell
#时钟引脚 50M
set_location_assignment PIN_E1 -to CLOCK_XTAL_50MHz
#复位引脚
set_location_assignment PIN_E15 -to RESET

#LED对应的引脚
set_location_assignment PIN_G15 -to LED0
set_location_assignment PIN_F16 -to LED1
set_location_assignment PIN_F15 -to LED2
set_location_assignment PIN_D16 -to LED3

#按键对应的引脚 KEY1已作为复位按键
#set_location_assignment PIN_E15 -to KEY1
set_location_assignment	PIN_E16	-to KEY2
set_location_assignment	PIN_M16 -to KEY3
set_location_assignment	PIN_M15 -to KEY4
set_location_assignment	PIN_F7 -to KEY5
set_location_assignment	PIN_E9 -to KEY6
#IIC
set_location_assignment	PIN_L2  -to SDA
set_location_assignment	PIN_L1  -to SCL

set_location_assignment	PIN_N14 -to SIG_IN
set_location_assignment	PIN_M12 -to SIG_OUT1
set_location_assignment	PIN_L12 -to SIG_OUT2
set_location_assignment	PIN_K12 -to SIG_OUT3
set_location_assignment	PIN_K11 -to SIG_OUT4
set_location_assignment	PIN_J13 -to SIG_OUT5

#串口对应的引脚
set_location_assignment	PIN_M2	-to RXD
set_location_assignment	PIN_G1	-to TXD


#数码管
set_location_assignment PIN_B7 -to DIG[0]
set_location_assignment PIN_A8 -to DIG[1]
set_location_assignment PIN_A6 -to DIG[2]
set_location_assignment PIN_B5 -to DIG[3]
set_location_assignment PIN_B6 -to DIG[4]
set_location_assignment PIN_A7 -to DIG[5]
set_location_assignment PIN_B8 -to DIG[6]
set_location_assignment PIN_A5 -to DIG[7]
set_location_assignment PIN_A4 -to SEL[0]
set_location_assignment PIN_B4 -to SEL[1]
set_location_assignment PIN_A3 -to SEL[2]
set_location_assignment PIN_B3 -to SEL[3]
set_location_assignment PIN_A2 -to SEL[4]
set_location_assignment PIN_B1 -to SEL[5]
```