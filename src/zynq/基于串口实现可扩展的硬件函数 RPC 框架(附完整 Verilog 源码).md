
>本文介绍如何使用简单的串口协议搭建一个支持寄存器读写与硬件函数调用的通用交互框架，适用于 FPGA 调试、嵌入式接口、中小型控制系统等场合。
特性： 轻量协议、30 个32位寄存器、函数调用、状态反馈，源码清晰易扩展。
# [vio_uart.j2b.json](https://blog.csdn.net/qq_26074053/article/details/154620732)
```json
{
  "remark": "vio_uart定长6字节对称协议",
  "schema": {
    "CmdTypeEnum:bit[3]": {
        "000": "读",
        "001": "写",
        "010": "RPC",
        "011": "数据上报",
        "100": "读(不响应,vio_uart从机从其他方式发出要读的结果)",
        "101": "写(不响应)",
        "110": "RPC(不响应)"
        "111": "上报数据(不响应)"
      }
  },
  "agreement": [
    "1.用于fpga调试的6字节的定长协议",
    "2.数据字段（data）采用小端序（低字节存低地址）",
    "3.endpoint的含义有CmdTypeEnum[1:0]决定,[地址(读),地址(写),方法id(rpc),通道号(上报数据)]",
    "4.读操作（cmdType=0）的data字段填充0x00;写操作（cmdType=1）的data为32位写入数据;RPC（cmdType=2）的data为方法第一个32位参数",
    "5.主机发出的数据包从机必须响应,从机响应完后主机才能发新的数据包",
    "6.rpc调用主机请求的[cmdType,endpoint]和从机响应的[cmdType,endpoint]是一样的",
    "7.fpga测的rpc处理器请求和响应的参数固定为4个u32,但单次rpc只带了1个参数,如果要用到其他三个参数则要用到寄存器[1~3](请求)和[7~9](响应)",
    "8.vio_uart的输出寄存器是通用寄存器,而输入寄存器则和vio_uart的输入绑定了,上位机只能读,不可写(写也没用)"
  ],
  "content": {
    "cmdType:u8;命令类型":{
      "_[2:0]": "1:CmdTypeEnum:bit[3]",
      "_[7:3]": ":bit[5];选用,[序号sid,0~31循环,主机生成,从机复用]"
    },
    "endpoint": "1:u8;CmdTypeEnum[1:0]决定其含义[地址,地址,方法id,通道号]",
    "data": "6553147:u32;数据体"
  }
}
```
# 💡 背景与目标
在 FPGA 项目开发中，常常需要与主机通信，实现：

✅ 向 FPGA 写入控制参数

✅ 从 FPGA 读取处理结果

✅ 调用内部硬件函数（如加法器、滤波器、查表器）

本框架提供一种轻量、统一、可扩展的解决方案，通过 串口 + 6 字节帧协议实现对 FPGA 内部功能的调用与结果获取。
##  连续两次rpc调用仿真图
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/9f22f657b3794c38abaab94a4cbde2a2.png)

# 📦 串口通信协议格式（6 字节固定）
## 📨 发送帧格式
| 字节索引  | 含义         | 说明                                        |
| ----- | ---------- | ----------------------------------------- |
| `0`   | 命令类型       | `0x00=读`, `0x01=写`, `0x02=RPC`            |
| `1`   | 地址 / 方法 ID | `读/写`：寄存器地址（0\~29）；`RPC`：方法编号（Method ID）  |
| `2~5` | 数据 / 参数0   | `写`：写入数据；`读`：无意义；`RPC`：参数0（Little Endian） |
## 📤 响应帧格式
| 字节索引  | 含义         | 说明                                 |
| ----- | ---------- | ---------------------------------- |
| `0`   | 命令类型回显     | 与发送帧 `Byte0` 保持一致                  |
| `1`   | 地址 / 方法 ID | 与发送帧 `Byte1` 保持一致                  |
| `2~5` | 返回值 / 写确认  | `读`：返回寄存器数据；`写`：回显写入数据；`RPC`：返回结果0(有4个结果) |

# 📋 测试用例
| 用例描述         | 发送帧（→）              | 响应帧（←）              | 说明                   |
| ------------ | ------------------- | ------------------- | -------------------- |
| 写寄存器（地址 1）   | `01 01 44 33 22 11` | `01 01 44 33 22 11` | 向寄存器1写入 `0x11223344` |
| 读寄存器（地址 1）   | `00 01 00 00 00 00` | `00 01 44 33 22 11` | 读取寄存器1，返回上一步数据       |
| RPC：回显（方法 0） | `02 00 BE BA FE CA` | `02 00 BE BA FE CA` | 回显参数0 = `0xCAFEBABE` |
| RPC：加法（方法 1） | `02 01 04 03 02 01` | `02 01 05 05 05 05` | 每字节加法：+1,+2,+3,+4    |
| 非法地址读取       | `00 1E 00 00 00 00` | *无响应 / 忽略*          | 地址超出范围（>29）被忽略       |

# 🧩 模块说明

### vio_uart.v

- 基于 6 字节协议帧的串口控制模块
- 支持：
  - 读/写任意一个通用寄存器（地址 0~29）
  - 触发 RPC 调用（方法号 + 参数）
- 接口包含：
  - `i_uart_rxd`, `o_uart_txd` 串口收发
  - `i_mem_17 ~ i_mem_29` 输入寄存器映射
  - `o_mem_0 ~ o_mem_16` 输出寄存器映射
  - `o_done`：单次事务完成标志（读 / 写 / RPC）

模块逻辑结构：

- 接收串口帧 → 解析命令 → 执行操作 → 发回响应帧
- 调用 RPC 时，将方法号、参数送入子模块 `rpc_processor`
- 接收结果后写入通用寄存器 6~9，发回结果帧
-  rpc 调用的参数是4个32位寄存器,但只有参数0在请求帧里,其他的3个参数要预先写到寄存器1~3
-  rpc 调用的结果是4个32位寄存器,但只有结果0在响应帧里,其他的3个结果通过查寄存器7~9获取

---

### rpc_processor.v

- 硬件函数处理器模块，支持用户自定义多个“方法”
- 输入：
  - 方法编号（来自帧 Byte2）
  - 参数0（来自帧 Byte3到6）
  - 参数1到3（来自寄存器3到5）
- 输出：
  - 结果0到3→ 回写寄存器6到9

# 源文件
## vio_uart.v
```verilog
module vio_uart #(
    parameter P_PACK_LEN = 6, //一 帧字节数
    parameter P_CLK_FREQ = 50_000_000,
    parameter P_UART_BPS = 115200
)(
    input               i_clk       ,
    input               i_rst_n     ,
    input               i_uart_rxd  ,
    output              o_uart_txd  ,
    output reg          o_done,        //整个事务完成标志
    //直接映射到内部的寄存器
    output [31:0] o_mem_0,
    output [31:0] o_mem_1,
    output [31:0] o_mem_2,
    output [31:0] o_mem_3,
    output [31:0] o_mem_4,
    output [31:0] o_mem_5,
    output [31:0] o_mem_6,
    output [31:0] o_mem_7,
    output [31:0] o_mem_8,
    output [31:0] o_mem_9,
    output [31:0] o_mem_10,
    output [31:0] o_mem_11,
    output [31:0] o_mem_12,
    output [31:0] o_mem_13,
    output [31:0] o_mem_14,
    output [31:0] o_mem_15,
    output [31:0] o_mem_16,
    input [31:0]  i_mem_17,
    input [31:0]  i_mem_18,
    input [31:0]  i_mem_19,
    input [31:0]  i_mem_20,
    input [31:0]  i_mem_21,
    input [31:0]  i_mem_22,
    input [31:0]  i_mem_23,
    input [31:0]  i_mem_24,
    input [31:0]  i_mem_25,
    input [31:0]  i_mem_26,
    input [31:0]  i_mem_27,
    input [31:0]  i_mem_28,
    input [31:0]  i_mem_29

);

// ========== RX / TX 接口 ==========
wire        w_rx_done;
wire [7:0]  w_rx_data;

reg         r_tx_en;
reg [7:0]   r_tx_data;
wire        w_tx_busy;

uart_rx  #(
     .P_CLK_FREQ(P_CLK_FREQ),
     .P_UART_BPS(P_UART_BPS)
) uart_rx_inst(
    .i_clk       (i_clk),
    .i_rst_n     (i_rst_n),
    .i_uart_rxd  (i_uart_rxd),
    .o_uart_rx_done (w_rx_done),
    .o_uart_rx_data (w_rx_data)
);

uart_tx  #(
    .P_CLK_FREQ(P_CLK_FREQ),
    .P_UART_BPS(P_UART_BPS)
) uart_tx_inst(
    .i_clk        (i_clk),
    .i_rst_n      (i_rst_n),
    .i_uart_tx_en (r_tx_en),
    .i_uart_tx_data (r_tx_data),
    .o_uart_tx_busy  (w_tx_busy),
    .o_uart_txd      (o_uart_txd)
);


// ========== 内部信号 ==========
//接收缓冲区
reg [7:0]   r_recv_buffer  [0:P_PACK_LEN-1];
//发送缓冲区
reg [7:0]   r_tx_buffer   [0:P_PACK_LEN-1];
//接收计数器
reg [3:0]   r_rx_cnt;
//发送计数器
reg [3:0]   r_tx_cnt;
//状态
reg [2:0]   r_state,r_pre_state;
reg         r_wait_busy;

localparam  S_IDLE = 3'd0,
            S_RECV = 3'd1,
            S_CMD  = 3'd2,
            S_RESP = 3'd3,
            S_SEND = 3'd4,
            S_RPC_PROCESSING = 3'd5;

reg [31:0]  r_mem [0:29];
reg [31:0]  r_resp_data;
reg [7:0]   r_cmd_type;
reg [7:0]   r_cmd_addr;
reg [31:0]  r_cmd_data;

reg   r_rpc_start;
// RPC 处理器输出端口连接线
wire [31:0] w_res_reg_0, w_res_reg_1, w_res_reg_2, w_res_reg_3;
wire   w_rpc_busy,w_rpc_done;


assign o_mem_0  = r_mem[0];
assign o_mem_1  = r_mem[1];
assign o_mem_2  = r_mem[2];
assign o_mem_3  = r_mem[3];
assign o_mem_4  = r_mem[4];
assign o_mem_5  = r_mem[5];
assign o_mem_6  = r_mem[6];
assign o_mem_7  = r_mem[7];
assign o_mem_8  = r_mem[8];
assign o_mem_9  = r_mem[9];
assign o_mem_10 = r_mem[10];
assign o_mem_11 = r_mem[11];
assign o_mem_12 = r_mem[12];
assign o_mem_13 = r_mem[13];
assign o_mem_14 = r_mem[14];
assign o_mem_15 = r_mem[15];
assign o_mem_16 = r_mem[16];



integer     idx;
integer      i;
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        r_rx_cnt    <= 0;
        r_tx_cnt    <= 0;
        r_state     <= S_IDLE;
        r_pre_state <= S_IDLE;
        r_tx_en     <= 1'b0;
        r_tx_data   <= 8'd0;
        r_wait_busy <= 1'b0;
        o_done <= 1'b0;
        r_rpc_start<= 1'b0;
        r_resp_data<= 32'b0;
        for (i = 0; i <= 16; i = i + 1) begin
            r_mem[i] <= 0;
        end
        for (i = 0; i < P_PACK_LEN; i = i + 1) begin
              r_tx_buffer[i] <= 0;
        end
        for (i = 0; i < P_PACK_LEN; i = i + 1) begin
              r_recv_buffer[i] <= 0;
        end
    end else begin
        r_tx_en <= 1'b0;
        o_done <=  1'b0;
        r_pre_state<= r_state;
        case (r_state)
            S_IDLE: begin
                r_rx_cnt    <= 0;
                r_tx_cnt    <= 0;
                r_wait_busy <= 0;
                r_state     <= S_RECV;
                r_mem[17]<=i_mem_17;
                r_mem[18]<=i_mem_18;
                r_mem[19]<=i_mem_19;
                r_mem[20]<=i_mem_20;
                r_mem[21]<=i_mem_21;
                r_mem[22]<=i_mem_22;
                r_mem[23]<=i_mem_23;
                r_mem[24]<=i_mem_24;
                r_mem[25]<=i_mem_25;
                r_mem[26]<=i_mem_26;
                r_mem[27]<=i_mem_27;
                r_mem[28]<=i_mem_28;
                r_mem[29]<=i_mem_29;
                o_done <= 1'b0;
            end
            S_RECV: begin
                if (w_rx_done) begin
                    r_recv_buffer[r_rx_cnt] <= w_rx_data;
                    if (r_rx_cnt == P_PACK_LEN - 1) begin
                        r_state <= S_CMD;
                    end
                    r_rx_cnt <= r_rx_cnt + 1;
                end
            end
            S_CMD: begin
                r_cmd_type <= r_recv_buffer[0];
                r_cmd_addr <= r_recv_buffer[1];
                r_cmd_data <= {r_recv_buffer[5], r_recv_buffer[4], r_recv_buffer[3], r_recv_buffer[2]};
                if (r_recv_buffer[1]< 30) begin
                    idx = r_recv_buffer[1];
                    if(idx<30) begin
                        //写
                        if (r_recv_buffer[0] == 8'h01) begin
                            r_mem[idx] <= {r_recv_buffer[5], r_recv_buffer[4], r_recv_buffer[3], r_recv_buffer[2]};
                            r_state <= S_RESP;
                        end
                        //读
                        else if(r_recv_buffer[0] == 8'h00) begin
                            r_resp_data <= r_mem[idx];
                            r_state <= S_RESP;
                        end
                        //rpc调用
                        else if(r_recv_buffer[0] == 8'h02) begin
                            r_resp_data <= 32'b0;
                            r_rpc_start<= 1'b1;
                            r_state <= S_RPC_PROCESSING;
                       end
                   end
                   else begin
                        r_state <= S_IDLE;
                    end
                end else begin
                    r_state <= S_IDLE;
                end
            end
            S_RPC_PROCESSING: begin
                //上个状态也是处理RPC,且RPC处理完成
                if (r_pre_state==S_RPC_PROCESSING && w_rpc_busy==0 && w_rpc_done) begin
                   r_mem[6] <= w_res_reg_0;
                   r_mem[7] <= w_res_reg_1;
                   r_mem[8] <= w_res_reg_2;
                   r_mem[9] <= w_res_reg_3;
                   r_rpc_start<= 1'b0;
                   r_state <= S_RESP;
                end
            end
            S_RESP: begin
                r_tx_cnt<=0;
                if(r_recv_buffer[0] == 8'h00 || r_recv_buffer[0] == 8'h01) begin
                     r_resp_data <= r_mem[idx];
                     r_tx_buffer[0] <= r_cmd_type;
                     r_tx_buffer[1] <= r_cmd_addr;
                     r_tx_buffer[2] <= r_mem[idx][7:0];
                     r_tx_buffer[3] <= r_mem[idx][15:8];
                     r_tx_buffer[4] <= r_mem[idx][23:16];
                     r_tx_buffer[5] <= r_mem[idx][31:24];
                     r_state <= S_SEND;
                end
                else begin
                   r_resp_data<= w_res_reg_0;
                   r_tx_buffer[0] <= r_cmd_type;
                   r_tx_buffer[1] <= r_cmd_addr;
                   r_tx_buffer[2] <= w_res_reg_0[7:0];
                   r_tx_buffer[3] <= w_res_reg_0[15:8];
                   r_tx_buffer[4] <= w_res_reg_0[23:16];
                   r_tx_buffer[5] <= w_res_reg_0[31:24];
                   r_state <= S_SEND;
                end
            end
            S_SEND: begin
                if (!w_tx_busy && !r_wait_busy) begin
                    r_tx_data   <= r_tx_buffer[r_tx_cnt];
                    r_tx_en     <= 1'b1;
                    r_tx_cnt    <= r_tx_cnt + 1;
                    r_wait_busy <= 1'b1;
                end else if (w_tx_busy) begin
                    r_wait_busy <= 1'b0;
                    if (r_tx_cnt == 6) begin
                        r_state <= S_IDLE;
                        o_done <= 1'b1;
                    end
                end
            end
        endcase
    end
end



 // 实例化 RPC 处理器模块，连接输入参数和输出结果寄存器
    rpc_processor u_rpc (
        .i_clk        (i_clk),
        .i_rst_n      (i_rst_n),
        .i_method_reg ({24'b0,r_recv_buffer[1]}),        // 功能号寄存器
        .i_req_reg_0  ({r_recv_buffer[5],r_recv_buffer[4],r_recv_buffer[3],r_recv_buffer[2]}),        // 参数0
        .i_req_reg_1  (r_mem[3]),        // 参数1
        .i_req_reg_2  (r_mem[4]),        // 参数2
        .i_req_reg_3  (r_mem[5]),        // 参数3
        .o_res_reg_0  (w_res_reg_0),    // 返回值0
        .o_res_reg_1  (w_res_reg_1),    // 返回值1
        .o_res_reg_2  (w_res_reg_2),     // 返回值2
        .o_res_reg_3  (w_res_reg_3),     // 返回值3
        .i_rpc_start  (r_rpc_start),     // 启动标志
        .i_rpc_valid  (1),               //RPC主机方法和参数准备好了
        .o_rpc_done   (w_rpc_done),    // RPC处理完成（1=结果有效）
        .o_rpc_busy  (w_rpc_busy)   // RPC正忙（处理中保持高）
    );


endmodule



```

## rpc_processor.v
```verilog
`timescale 1ns/1ps

// 宏定义：RPC方法（32位功能码）
`define RPC_FUNC_ECHO    32'h00000000  // 回显功能（返回输入参数）
`define RPC_FUNC_ADD     32'h00000001  // 加法功能（参数相加）

module rpc_processor (
    input  wire        i_clk,         // 时钟信号
    input  wire        i_rst_n,       // 复位信号（低有效）

    // 寄存器接口（直接暴露）
    input  wire [31:0] i_method_reg,  // 方法选择寄存器
    input  wire [31:0] i_req_reg_0,   // 请求参数0
    input  wire [31:0] i_req_reg_1,   // 请求参数1
    input  wire [31:0] i_req_reg_2,   // 请求参数2
    input  wire [31:0] i_req_reg_3,   // 请求参数3
    output reg  [31:0] o_res_reg_0,   // 响应结果0
    output reg  [31:0] o_res_reg_1,   // 响应结果1
    output reg  [31:0] o_res_reg_2,   // 响应结果2
    output reg  [31:0] o_res_reg_3,   // 响应结果3

    // RPC控制信号（含启动信号）
    input  wire        i_rpc_start,   // RPC启动信号（1=触发处理，上升沿有效）
    output reg         o_rpc_busy,   //  RPC处理中（处理中保持高）
    input  wire        i_rpc_valid,   // 外部数据有效
    output reg         o_rpc_done     // RPC处理完成（1=结果有效）
);

    // --------------------------
    // 启动信号边沿检测（防止持续触发）
    // --------------------------
    reg r_rpc_start_dly;
    wire w_rpc_start_posedge;  // 启动信号上升沿（真正的触发点）

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_rpc_start_dly <= 1'b0;
        end else begin
            r_rpc_start_dly <= i_rpc_start;  // 延迟一拍用于边沿检测
        end
    end

    assign w_rpc_start_posedge = i_rpc_start && !r_rpc_start_dly;  // 上升沿检测

    // --------------------------
    // 内部锁存寄存器（处理期间保持参数稳定）
    // --------------------------
    reg [31:0] r_method_latch;
    reg [31:0] r_req_latch_0, r_req_latch_1, r_req_latch_2, r_req_latch_3;

    // --------------------------
    // RPC处理状态机
    // --------------------------
    localparam S_IDLE      = 2'b00;
    localparam S_PROCESSING = 2'b01;
    localparam S_DONE      = 2'b10;

    reg [1:0] r_state;
    reg [3:0] r_proc_cnt;  // 模拟处理延迟（0~15周期）

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_state <= S_IDLE;
            r_proc_cnt <= 4'h0;
            o_rpc_busy <= 1'b0;
            o_rpc_done <= 1'b0;
            r_method_latch <= 32'h0;
            r_req_latch_0 <= 32'h0;
            r_req_latch_1 <= 32'h0;
            r_req_latch_2 <= 32'h0;
            r_req_latch_3 <= 32'h0;
            o_res_reg_0 <= 32'h0;
            o_res_reg_1 <= 32'h0;
            o_res_reg_2 <= 32'h0;
            o_res_reg_3 <= 32'h0;
        end else begin
            case (r_state)
                S_IDLE: begin
                     // 检测到启动信号上升沿，且外部数据有效，启动处理
                    if (w_rpc_start_posedge && i_rpc_valid) begin
                        o_rpc_done <= 1'b0;  // 完成标志清0
                        // 锁存当前寄存器值（处理期间参数不变）
                        r_method_latch <= i_method_reg;
                        r_req_latch_0 <= i_req_reg_0;
                        r_req_latch_1 <= i_req_reg_1;
                        r_req_latch_2 <= i_req_reg_2;
                        r_req_latch_3 <= i_req_reg_3;

                        o_rpc_busy <= 1'b1;      // 置位请求有效
                        r_state <= S_PROCESSING;    // 进入处理状态
                        r_proc_cnt <= 4'h0;       // 重置延迟计数器
                    end else begin
                        o_rpc_busy <= 1'b0;
                        r_state <= S_IDLE;
                    end
                end

                S_PROCESSING: begin
                    // 模拟处理延迟（例如10个时钟周期，可修改）
                    if (r_proc_cnt >= 4'd9) begin
                        // 根据方法号执行不同处理（示例逻辑）
                        case (r_method_latch)
                            `RPC_FUNC_ECHO: begin  // 方法0：返回请求参数
                                o_res_reg_0 <= r_req_latch_0;
                                o_res_reg_1 <= r_req_latch_1;
                                o_res_reg_2 <= r_req_latch_2;
                                o_res_reg_3 <= r_req_latch_3;
                            end
                            `RPC_FUNC_ADD: begin  // 方法1：参数相加
                                o_res_reg_0[7:0] <=    r_req_latch_0[7:0]+1;
                                o_res_reg_0[15:8] <=   r_req_latch_0[15:8]+2;
                                o_res_reg_0[23:16] <=  r_req_latch_0[23:16]+3;
                                o_res_reg_0[31:24] <=  r_req_latch_0[31:24]+4;
                            end
                            default: begin
                                o_res_reg_0 <= 32'h0;
                                o_res_reg_1 <= 32'h0;
                                o_res_reg_2 <= 32'h0;
                                o_res_reg_3 <= 32'h0;
                            end
                        endcase
                        r_state <= S_DONE;
                    end else begin
                        r_proc_cnt <= r_proc_cnt + 1'b1;
                        r_state <= S_PROCESSING;
                    end
                end

                S_DONE: begin
                    o_rpc_busy <= 1'b0;      // 清除请求有效
                    o_rpc_done <= 1'b1;       // 置位完成标志（通知结果就绪）
                    r_state <= S_IDLE;          // 返回空闲状态，等待下一次启动
                end

                default: r_state <= S_IDLE;
            endcase
        end
    end

endmodule
```
## uart_rx.v
```verilog
module uart_rx #(
    parameter P_CLK_FREQ = 50_000_000,
    parameter P_UART_BPS = 115200
) (
    input           i_clk       ,
    input           i_rst_n   ,
    input           i_uart_rxd      ,
    output  reg     o_uart_rx_done ,
    output  reg [7:0] o_uart_rx_data
);

//parameter define
localparam   L_BAUD_CNT_MAX=   P_CLK_FREQ/P_UART_BPS   ;

//reg define
reg             r_uart_rxd0  ;
reg             r_uart_rxd1  ;
reg             r_uart_rxd2  ;
reg             r_rx_flag    ; //正在接收中的标志
reg     [3:0]   r_bit_cnt     ;
reg     [15:0]  r_baud_cnt   ;
reg     [7:0]   r_rx_data_t  ;

//wire define
wire            w_start_en;
////////////////////////////////////////////////////////////////////
//*************************main code******************************
////////////////////////////////////////////////////////////////////

//i_uart_rxd negedge
assign w_start_en = r_uart_rxd2 & (~r_uart_rxd1) & (~r_rx_flag);

//async signal input delay
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) begin
        r_uart_rxd0 <= 1'b0 ;
        r_uart_rxd1 <= 1'b0 ;
        r_uart_rxd2 <= 1'b0 ;
    end
    else begin
        r_uart_rxd0 <= i_uart_rxd ;
        r_uart_rxd1 <= r_uart_rxd0 ;
        r_uart_rxd2 <= r_uart_rxd1 ;
    end
end


//generate r_baud_cnt
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n)
        r_baud_cnt <= 16'd0;
    else if(r_rx_flag) begin
        if(r_baud_cnt == L_BAUD_CNT_MAX - 1'b1)
            r_baud_cnt <= 16'd0;
        else
            r_baud_cnt <= r_baud_cnt + 16'b1;
    end
    else
        r_baud_cnt <= 16'd0;
end

//generate r_bit_cnt
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) begin
        r_bit_cnt <= 4'd0;
    end
    else if(r_rx_flag) begin
        if(r_baud_cnt == L_BAUD_CNT_MAX - 1'b1)
            r_bit_cnt <= r_bit_cnt + 1'b1;
        else
            r_bit_cnt <= r_bit_cnt;
    end
    else
        r_bit_cnt <= 4'd0;
end

//generate r_rx_flag
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n)
        r_rx_flag <= 1'b0;
    else if(w_start_en)
        r_rx_flag <= 1'b1;
    else if((r_bit_cnt == 4'd9) && (r_baud_cnt == L_BAUD_CNT_MAX/2 - 1'b1))
        r_rx_flag <= 1'b0;
    else
        r_rx_flag <= r_rx_flag;
end

always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n)
        r_rx_data_t <= 8'b0;
    else if(r_rx_flag) begin
        if(r_baud_cnt == L_BAUD_CNT_MAX/2 - 1'b1) begin
            case(r_bit_cnt)
                4'd1 : r_rx_data_t[0] <= r_uart_rxd2;
                4'd2 : r_rx_data_t[1] <= r_uart_rxd2;
                4'd3 : r_rx_data_t[2] <= r_uart_rxd2;
                4'd4 : r_rx_data_t[3] <= r_uart_rxd2;
                4'd5 : r_rx_data_t[4] <= r_uart_rxd2;
                4'd6 : r_rx_data_t[5] <= r_uart_rxd2;
                4'd7 : r_rx_data_t[6] <= r_uart_rxd2;
                4'd8 : r_rx_data_t[7] <= r_uart_rxd2;
                default : ;
            endcase
        end
        else
            r_rx_data_t <= r_rx_data_t;
    end
    else
        r_rx_data_t <= 8'b0;
end


always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) begin
        o_uart_rx_done <= 1'b0;
        o_uart_rx_data <= 8'b0;
    end
    else if(r_bit_cnt == 4'd9 && r_baud_cnt == L_BAUD_CNT_MAX/2 - 1'b1) begin
        o_uart_rx_done <= 1'b1;
        o_uart_rx_data <= r_rx_data_t;
    end
    else begin
        o_uart_rx_done <= 1'b0;
        o_uart_rx_data <= o_uart_rx_data;
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
## 顶层 HC_FPGA_Demo_Top.v
```verilog
module HC_FPGA_Demo_Top
(
    input CLOCK_XTAL_50MHz,
	input RESET,
	input  KEY1,
	input  KEY2,
	input  KEY3,
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



vio_uart u_vio_uart (
    .i_clk   (CLOCK_XTAL_50MHz),
    .i_rst_n(RESET),
    .i_uart_rxd  (RXD),
    .o_uart_txd  (TXD),
    .i_mem_17({KEY4,KEY3,KEY2,KEY1})
);


endmodule

```
## 测试 tb.sv
```verilog
`timescale 1ns/1ps

module tb;
    parameter CLK_PERIOD = 20; // 50MHz
    parameter UART_BPS = 1152000;
    parameter CLK_FREQ = 50_000_000;
    parameter P_PACK_LEN = 6;

    // 信号定义，参考顶层
    reg i_sys_clk = 0;
    reg i_sys_reset_n = 0;
    reg KEY4 = 0, KEY3 = 0, KEY2 = 0, KEY1 = 0;
    reg i_uart_rxd;
    wire o_uart_txd;
    wire o_recv_acq_done, o_recv_ctrl_done;
    wire [31:0] o_mem_10;

    // 生成时钟
    always #(CLK_PERIOD/2) i_sys_clk = ~i_sys_clk;

    // 复位
    initial begin
        i_sys_reset_n = 0;
        #1000;
        i_sys_reset_n = 1;
    end

    // 实例化 vio_uart，端口参考顶层
    vio_uart #(
        .P_PACK_LEN(P_PACK_LEN),
        .P_CLK_FREQ(CLK_FREQ),
        .P_UART_BPS(UART_BPS)
    ) u_vio_uart (
        .i_clk(i_sys_clk),
        .i_rst_n(i_sys_reset_n),
        .i_uart_rxd(i_uart_rxd),
        .o_uart_txd(o_uart_txd),
        .i_mem_17({KEY4, KEY3, KEY2, KEY1}),
        .o_mem_10(o_mem_10),
        .o_recv_acq_done(o_recv_acq_done),
        .o_recv_ctrl_done(o_recv_ctrl_done)
    );

    parameter integer BIT_PERIOD = 1_000_000_000 / UART_BPS; // 单位ns

    // 串口发送任务
    task uart_send_byte(input [7:0] data);
        integer i;
        begin
            i_uart_rxd = 0; // 起始位
            #(BIT_PERIOD);
            for(i=0;i<8;i=i+1) begin
                i_uart_rxd = data[i];
                #(BIT_PERIOD);
            end
            i_uart_rxd = 1; // 停止位
            #(BIT_PERIOD);
        end
    endtask

    // 主测试流程
    initial begin
        $display("Start 111");
        i_uart_rxd = 1;
        KEY4 = 1; KEY3 = 0; KEY2 = 1; KEY1 = 0; // 可随意组合
        @(posedge i_sys_reset_n);
        #1000;
        // 发送rpc命令
        uart_send_byte(8'h02);
        uart_send_byte(8'h01);
        uart_send_byte(8'h02);
        uart_send_byte(8'h03);
        uart_send_byte(8'h04);
        uart_send_byte(8'h05);
        // 观测 o_uart_txd、o_mem_10、o_recv_acq_done 等
        #60000;
        
        // 发送rpc命令
        uart_send_byte(8'h02);
        uart_send_byte(8'h01);
        uart_send_byte(8'h02);
        uart_send_byte(8'h03);
        uart_send_byte(8'h04);
        uart_send_byte(8'h05);
        #60000;
        $finish;
    end
endmodule
```