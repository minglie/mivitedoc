在 Intel（原 Altera）FPGA 的设计流程中，如果使用 Qsys / Platform Designer 搭建系统，模块之间的互连往往会通过 Avalon-MM（Avalon Memory-Mapped） 协议完成。它类似于 Xilinx 的 AXI-Lite 协议，用于内存映射（Memory-Mapped）方式访问外设寄存器或存储器。
# 接口
| 信号名             | 方向(主机视角) | 作用                          |
| --------------- | -- | --------------------------- |
| `address`       | O  | 访问的目标地址                     |
| `read`          | O  | 读请求信号（1 表示发起一次读）            |
| `write`         | O  | 写请求信号（1 表示发起一次写）            |
| `writedata`     | O  | 写数据                         |
| `readdata`      | I  | 从机返回的读数据                    |
| `waitrequest`   | I  | 从机忙信号（1 表示不能接收新请求）          |
| `readdatavalid` | I  | 从机读数据有效标志（1 表示 readdata 有效） |

# 时序流程
### 写操作（Write）
1. **Master 拉高 `write` 并提供 `address`、`writedata`**  
   主机在总线上给出目标地址和写入数据，同时拉高 `write` 信号。
2. **等待从机 `waitrequest=0` 表示接受**  
   从机通过 `waitrequest` 信号告诉主机当前是否能接受请求，只有当该信号为 0 时，请求才会被采纳。
3. **可选：无返回数据，只有写完成确认**  
   Avalon-MM 的写操作通常没有返回数据，只是确认事务完成。  
   *注：你给的例子中，写完成后直接进入读流程。*

---

### 读操作（Read）
1. **Master 拉高 `read` 并提供 `address`**  
   主机在总线上给出目标地址，同时拉高 `read` 信号。
2. **等待 `waitrequest=0` 表示接受请求**  
   当从机将 `waitrequest` 拉低时，表示读请求已被采纳。
3. **如果 `USE_RDDV=1`，等待 `readdatavalid=1` 再取 `readdata`**  
   表示从机需要额外的周期准备数据，数据有效时 `readdatavalid` 会拉高。
4. **如果 `USE_RDDV=0`，在 `waitrequest=0` 的同一拍直接取 `readdata`**  
   表示数据在接受请求的同时就已经准备好，可以直接读取。

# avalon_mm_master.v
```verilog
// =====================================================
// Avalon-MM 主机（演示）
// - start=1 触发：先写 address_w <- data_w
//   再读 address_r，等待数据返回（支持有/无 readdatavalid 模式）
// - done=1 完成；error=1 表示读回值 != 期望
// - 可综合（演示控制用）
// =====================================================
module avalon_mm_master #(
    parameter integer ADDR_WIDTH = 8,
    parameter integer DATA_WIDTH = 32,
    parameter integer USE_RDDV   = 1   // 与从机保持一致
)(
    input  wire                       clk,
    input  wire                       reset_n,

    // 控制/配置
    input  wire                       start,
    input  wire [ADDR_WIDTH-1:0]      address_w,
    input  wire [ADDR_WIDTH-1:0]      address_r,
    input  wire [DATA_WIDTH-1:0]      data_w,
    input  wire [(DATA_WIDTH/8)-1:0]  byteenable,

    // 结果
    output reg                        done,
    output reg                        error,
    output reg  [DATA_WIDTH-1:0]      read_data_out,

    // Avalon-MM Master 端口（官方命名）
    output reg  [ADDR_WIDTH-1:0]      address,
    output reg                        read,
    output reg                        write,
    output reg  [DATA_WIDTH-1:0]      writedata,
    input  wire [DATA_WIDTH-1:0]      readdata,
    input  wire                       waitrequest,
    input  wire                       readdatavalid
);
    // 状态机（Verilog-2001 风格）
    localparam S_IDLE            = 3'd0;
    localparam S_WRITE_ADDR      = 3'd1;
    localparam S_WRITE_WAIT      = 3'd2;
    localparam S_READ_ADDR       = 3'd3;
    localparam S_READ_WAIT_ACC   = 3'd4;
    localparam S_READ_WAIT_DATA  = 3'd5;
    localparam S_DONE            = 3'd6;

    reg [2:0] state, nxt;

    // 输出默认组合逻辑
    always @(*) begin
        // 默认拉低
        read      = 1'b0;
        write     = 1'b0;
        address   = '0;
        writedata = '0;

        case (state)
            S_WRITE_ADDR: begin
                address   = address_w;
                writedata = data_w;
                write     = 1'b1; // 等待 waitrequest=0 接受
            end
            S_READ_ADDR: begin
                address = address_r;
                read    = 1'b1;   // 等待 waitrequest=0 接受
            end
            default: ;
        endcase
    end

    // 状态转移
    always @(*) begin
        nxt = state;
        case (state)
            S_IDLE:          nxt = (start ? S_WRITE_ADDR : S_IDLE);
            S_WRITE_ADDR:    nxt = (waitrequest ? S_WRITE_ADDR : S_WRITE_WAIT);
            S_WRITE_WAIT:    nxt = S_READ_ADDR;
            S_READ_ADDR:     nxt = (waitrequest ? S_READ_ADDR : S_READ_WAIT_ACC);
            S_READ_WAIT_ACC: nxt = (USE_RDDV!=0) ? S_READ_WAIT_DATA : S_DONE; // 无RDDV则接受拍即得数据
            S_READ_WAIT_DATA:nxt = (readdatavalid ? S_DONE : S_READ_WAIT_DATA);
            S_DONE:          nxt = S_IDLE;
            default:         nxt = S_IDLE;
        endcase
    end

    // 时序寄存
    reg [DATA_WIDTH-1:0] expect;  // 期望读回
    always @(posedge clk) begin
        if (!reset_n) begin
            state         <= S_IDLE;
            done          <= 1'b0;
            error         <= 1'b0;
            read_data_out <= '0;
            expect        <= '0;
        end else begin
            state <= nxt;
            if (state == S_IDLE && start) begin
                expect <= data_w;
                done   <= 1'b0;
                error  <= 1'b0;
            end

            // 无 readdatavalid 模式：在接受拍读取
            if ((state == S_READ_ADDR) && !waitrequest && (USE_RDDV==0)) begin
                read_data_out <= readdata;
                done          <= 1'b1;
                error         <= (readdata != expect);
            end

            // 有 readdatavalid 模式：在 rddv 上升拍读取
            if ((state == S_READ_WAIT_DATA) && readdatavalid) begin
                read_data_out <= readdata;
                done          <= 1'b1;
                error         <= (readdata != expect);
            end
        end
    end
endmodule

```

# avalon_mm_slavev.v
```verilog
// =====================================================
// Avalon-MM 从机（内存映射 RAM 示例）
// - 可综合
// - 支持 byteenable 局部写
// - 可配置读延迟 LATENCY (0=零延迟)
// - USE_RDDV=1 时输出 readdatavalid；=0 时在接受读的同拍给数据
// - waitrequest：只在读延迟期间拉高（写不阻塞）
// =====================================================
module avalon_mm_slave #(
    parameter integer ADDR_WIDTH  = 8,    // 字地址（每地址一字）
    parameter integer DATA_WIDTH  = 32,
    parameter integer DEPTH_WORDS = 256,
    parameter integer LATENCY     = 2,    // 读延迟拍数
    parameter integer USE_RDDV    = 1     // 1: 使能 readdatavalid
)(
    input  wire                       clk,
    input  wire                       reset_n,       // 低有效复位（常见用法）

    // Avalon-MM 接口（官方命名）
    input  wire [ADDR_WIDTH-1:0]      address,
    input  wire                       read,
    input  wire                       write,
    input  wire [DATA_WIDTH-1:0]      writedata,
    input  wire [(DATA_WIDTH/8)-1:0]  byteenable,
    output reg  [DATA_WIDTH-1:0]      readdata,
    output wire                       waitrequest,
    output reg                        readdatavalid
);
    localparam integer BE_W = (DATA_WIDTH/8);
    reg [DATA_WIDTH-1:0] mem [0:DEPTH_WORDS-1];

    // 读延迟计数器
    localparam CNT_W = (LATENCY==0) ? 1 : $clog2(LATENCY+1);
    reg [CNT_W-1:0] rd_cnt;
    wire rd_inflight = (LATENCY != 0) ? (rd_cnt != 0) : 1'b0;

    // 只有读延迟期间阻塞；接受读地址后才进入延迟阶段
    assign waitrequest = (read && rd_inflight);

    // 写：byteenable 局部写（不阻塞）
    integer b;
    always @(posedge clk) begin
        if (!reset_n) begin
            // 不清 RAM，保持综合可用
        end else if (write && !waitrequest) begin
            for (b = 0; b < BE_W; b = b + 1) begin
                if (byteenable[b]) begin
                    mem[address][8*b +: 8] <= writedata[8*b +: 8];
                end
            end
        end
    end

    // 读：可配置延迟/是否使用 readdatavalid
    reg [ADDR_WIDTH-1:0] r_addr;
    always @(posedge clk) begin
        if (!reset_n) begin
            rd_cnt        <= '0;
            readdata      <= '0;
            readdatavalid <= 1'b0;
        end else begin
            readdatavalid <= 1'b0;

            // 地址被接受（!waitrequest）时启动读
            if (read && !waitrequest) begin
                r_addr <= address;
                if (LATENCY == 0) begin
                    readdata      <= mem[address];
                    readdatavalid <= (USE_RDDV != 0) ? 1'b1 : 1'b0;
                end else begin
                    rd_cnt <= LATENCY[CNT_W-1:0];
                end
            end else if (rd_inflight) begin
                rd_cnt <= rd_cnt - 1'b1;
                if (rd_cnt == 1) begin
                    readdata      <= mem[r_addr];
                    readdatavalid <= (USE_RDDV != 0) ? 1'b1 : 1'b0;
                end
            end
        end
    end
endmodule

```
# tb.sv
```verilog
// =====================================================
// Testbench：Avalon-MM 主从互连仿真
// - 从机：LATENCY=2，USE_RDDV=1（输出 readdatavalid）
// - 主机：写0x12_34_56_78到地址0x10，再从地址0x10读回并校验
// =====================================================
`timescale 1ns/1ps

module tb;
    localparam ADDR_W   = 8;
    localparam DATA_W   = 32;
    localparam CLK_T    = 10; // 100MHz

    // 时钟/复位
    reg clk = 0;
    always #(CLK_T/2) clk = ~clk;

    reg reset_n;
    initial begin
        reset_n = 0;
        repeat(5) @(posedge clk);
        reset_n = 1;
    end

    // 主机配置/控制
    reg                      start;
    reg [ADDR_W-1:0]         address_w;
    reg [ADDR_W-1:0]         address_r;
    reg [DATA_W-1:0]         data_w;
    reg [(DATA_W/8)-1:0]     byteenable;

    wire                     done, error;
    wire [DATA_W-1:0]        read_data_out;

    // 互连总线
    wire [ADDR_W-1:0]        address;
    wire                     read, write;
    wire [DATA_W-1:0]        writedata;
    wire [DATA_W-1:0]        readdata;
    wire                     waitrequest;
    wire                     readdatavalid;

    // DUTs
    avalon_mm_master #(
        .ADDR_WIDTH (ADDR_W),
        .DATA_WIDTH (DATA_W),
        .USE_RDDV   (1)
    ) u_master (
        .clk           (clk),
        .reset_n       (reset_n),
        .start         (start),
        .address_w     (address_w),
        .address_r     (address_r),
        .data_w        (data_w),
        .byteenable    (byteenable),
        .done          (done),
        .error         (error),
        .read_data_out (read_data_out),
        // Avalon-MM
        .address       (address),
        .read          (read),
        .write         (write),
        .writedata     (writedata),
        .readdata      (readdata),
        .waitrequest   (waitrequest),
        .readdatavalid (readdatavalid)
    );

    avalon_mm_slave #(
        .ADDR_WIDTH  (ADDR_W),
        .DATA_WIDTH  (DATA_W),
        .DEPTH_WORDS (256),
        .LATENCY     (2),   // 读延迟2拍
        .USE_RDDV    (1)    // 输出 readdatavalid
    ) u_slave (
        .clk           (clk),
        .reset_n       (reset_n),
        .address       (address),
        .read          (read),
        .write         (write),
        .writedata     (writedata),
        .byteenable    (byteenable),
        .readdata      (readdata),
        .waitrequest   (waitrequest),
        .readdatavalid (readdatavalid)
    );

    // 激励
    initial begin
        start      = 0;
        address_w  = '0;
        address_r  = '0;
        data_w     = '0;
        byteenable = {DATA_W/8{1'b1}}; // 全字节有效

        @(posedge reset_n);
        @(posedge clk);

        // 写→读回一组
        address_w = 8'h10;
        address_r = 8'h10;
        data_w    = 32'h12_34_56_78;

        $display("[%0t] TB: kick", $time);
        start = 1;
        @(posedge clk);
        start = 0;

        // 等完成
        wait(done);
        $display("[%0t] TB: done=1, read=0x%08x, error=%0d",
                 $time, read_data_out, error);

        // 再来一组（验证 byteenable 半字写）
        repeat(5) @(posedge clk);
        address_w  = 8'h20;
        address_r  = 8'h20;
        data_w     = 32'hAB_CD_EF_00;   // 先写全字
        byteenable = 4'b1111;

        start = 1; @(posedge clk); start = 0;
        wait(done);
        $display("[%0t] TB: pass1 read=0x%08x, err=%0d",
                 $time, read_data_out, error);

        // 半字更新（高16位），期望=0x1234_EF00
        repeat(5) @(posedge clk);
        address_w  = 8'h20;
        address_r  = 8'h20;
        data_w     = 32'h12_34_00_00;
        byteenable = 4'b1100;

        start = 1; @(posedge clk); start = 0;
        wait(done);
        $display("[%0t] TB: pass2 read=0x%08x, err=%0d",
                 $time, read_data_out, error);

        $display("[%0t] TB: finished", $time);
        #50 $finish;
    end

endmodule

```