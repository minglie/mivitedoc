>[vio_uart](https://blog.csdn.net/qq_26074053/article/details/149968390)是我在 FPGA 调试过程中设计的一种6字节定长的轻量通信协议。考虑到 [Tang-Nano-1K](https://wiki.sipeed.com/hardware/zh/tang/Tang-Nano-1K/Nano-1k.html) 的逻辑资源较为紧张，本文在原方案基础上进行了精简优化，保留核心调试功能，以适配该平台的资源约束。
# [vio_uart.j2b.json](https://blog.csdn.net/qq_26074053/article/details/154620732)
```json
{
  "remark": "vio_uart定长6字节对称协议",
  "schema": {
    "CmdTypeEnum:bit[2]": {
        "0": "读",
        "1": "写",
        "2": "RPC"
      }
  },
  "agreement": [
    "1.用于fpga调试的6字节的定长协议,必须一问一答",
    "2.数据字段（data）采用小端序（低字节存低地址）",
    "3.cmdType=0/1时，endpoint为寄存器地址（取值0~29）;cmdType=2时，endpoint为RPC方法ID（funcId）",
    "4.读操作（cmdType=0）的data字段填充0x00;写操作（cmdType=1）的data为32位写入数据;RPC（cmdType=2）的data为方法第一个32位参数",
    "5.主机发出的数据包从机必须响应,从机响应完后主机才能发新的数据包",
    "6.rpc调用主机请求的[cmdType,endpoint]和从机响应的[cmdType,endpoint]是一样的",
    "7.fpga测的rpc处理器请求和响应的参数固定为4个u32,但单次rpc只带了1个参数,如果要用到其他三个参数则要用到寄存器[1~3](请求)和[7~9](响应)",
    "8.vio_uart的输出寄存器是通用寄存器,而输入寄存器则和vio_uart的输入绑定了,上位机只能读,不可写(写也没用)"
  ],
  "content": {
    "cmdType:u8;命令类型":{
      "_[1:0]": "1:CmdTypeEnum:bit[2]",
      "_[7:2]": ":bit[6];选用,[序号sid,0~63循环,主机生成,从机复用]"
    },
    "endpoint": "1:u8;cmdType是2为funcId,cmdType是0,1则是地址",
    "data": "6553147:u32;数据体"
  }
}
```
# 📋 测试用例
| 用例描述         | 发送帧（→）              | 响应帧（←）              | 说明                   |
| ------------ | ------------------- | ------------------- | -------------------- |
| 写寄存器（地址 1）   | `01 01 07 00 00 00` | `01 01 07 00 00 00 ` | 三个灯都关闭 |
| 写寄存器（地址 1）   | `01 01 00 00 00 00` | `01 01 00 00 00 00 ` | 三个灯都打开 |
| 读寄存器（地址 1）   | `00 01 00 00 00 00` | `00 01 44 33 22 11` |读灯状态       |
| 读寄存器（地址 2）   | `00 02 00 00 00 00` | `00 02 01 00 00 00 ` |读按键状态       |
| RPC：回显（方法 0） | `02 00 BE BA FE CA` | `02 00 BE BA FE CA` | 回显参数0 = `0xCAFEBABE` |
| RPC：加法（方法 1） | `02 01 04 03 02 01` | `02 01 05 05 05 05` | 每字节加法：+1,+2,+3,+4    |
# [创建工程](https://blog.51cto.com/u_15468736/5807065)

# 目录结构
```bash
PS D:\workspace\gitee\0\ming_tang_nano_1k> tree /F
卷 新加卷 的文件夹 PATH 列表
卷序列号为 1E8A-2CFF
D:.
│  .gitignore    
└─vio_uart
    │  vio_uart.gprj
    └─src
        │  ReadMe.md
        │  vio_uart_prj.cst
        │  vio_uart_prj.sdc
        │
        └─rtl
                rpc_processor.v
                TANG_FPGA_Demo_Top.v
                uart_rx.v
                uart_tx.v
                vio_uart.v
```

## .gitignore
```bash
impl
.idea
*.user
```

## vio_uart.gprj
```bash
<?xml version="1" encoding="UTF-8"?>
<!DOCTYPE gowin-fpga-project>
<Project>
    <Template>FPGA</Template>
    <Version>5</Version>
    <Device name="GW1NZ-1" pn="GW1NZ-LV1QN48C6/I5">gw1nz1-015</Device>
    <FileList>
        <File path="src/rtl/TANG_FPGA_Demo_Top.v" type="file.verilog" enable="1"/>
        <File path="src/rtl/rpc_processor.v" type="file.verilog" enable="1"/>
        <File path="src/rtl/uart_rx.v" type="file.verilog" enable="1"/>
        <File path="src/rtl/uart_tx.v" type="file.verilog" enable="1"/>
        <File path="src/rtl/vio_uart.v" type="file.verilog" enable="1"/>
        <File path="src/vio_uart_prj.cst" type="file.cst" enable="1"/>
        <File path="src/vio_uart_prj.sdc" type="file.sdc" enable="1"/>
    </FileList>
</Project>

```
## src/ReadMe.md
```bash
# 导入文件
set src_dir "D:/workspace/gitee/0/ming_tang_nano_1k/vio_uart/src"
set rtl_dir "D:/workspace/gitee/0/ming_tang_nano_1k/vio_uart/src/rtl"
add_file  $rtl_dir/TANG_FPGA_Demo_Top.v
add_file  $rtl_dir/uart_rx.v
add_file  $rtl_dir/uart_tx.v
add_file  $rtl_dir/vio_uart.v
add_file  $rtl_dir/rpc_processor.v
add_file  $src_dir/vio_uart_prj.cst
add_file  $src_dir/vio_uart_prj.sdc
```
## src/vio_uart_prj.cst
```bash
IO_LOC "CLOCK_XTAL_27MHz" 47;
IO_PORT "CLOCK_XTAL_27MHz" IO_TYPE=LVCMOS33 PULL_MODE=UP;
IO_LOC "RESET" 13;
IO_PORT "RESET" IO_TYPE=LVCMOS33 PULL_MODE=UP;
IO_LOC "KEY1" 44;
IO_PORT "KEY1" IO_TYPE=LVCMOS33 PULL_MODE=UP;
IO_LOC "TXD" 40;
IO_PORT "TXD" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "RXD" 41;
IO_PORT "RXD" IO_TYPE=LVCMOS33 PULL_MODE=UP;
IO_LOC "LED[2]" 11;
IO_PORT "LED[2]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "LED[1]" 10;
IO_PORT "LED[1]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "LED[0]" 9;
IO_PORT "LED[0]" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
```
## src/vio_uart_prj.sdc
```bash
create_clock -name CLOCK_XTAL_27MHz -period 37.037 -waveform {0 18.518} [get_ports {CLOCK_XTAL_27MHz}]
```

## src/rtl/TANG_FPGA_Demo_Top.v
```verilog
module TANG_FPGA_Demo_Top
(
    input CLOCK_XTAL_27MHz,
	input RESET,
	input  KEY1,
    input  RXD,
    output TXD,
    output  [2:0] LED // 110 R, 101 B, 011 G
);



vio_uart u_vio_uart (
    .i_clk   (CLOCK_XTAL_27MHz),
    .i_rst_n(RESET),
    .i_uart_rxd  (RXD),
    .o_uart_txd  (TXD),
    .o_mem_1({LED[2],LED[1],LED[0]}),
    .i_mem_2({KEY1})
);
endmodule
```

## src/rtl/vio_uart.v
```verilog
module vio_uart #(
    parameter P_PACK_LEN = 6, //一 帧字节数
    parameter P_CLK_FREQ = 27_000_000,
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
    input  [31:0] i_mem_2
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

reg [31:0]  r_mem [0:2];
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
        for (i = 0; i <= 1; i = i + 1) begin
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
                r_mem[2]<=i_mem_2;
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
                    if(idx<3) begin
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
        .i_req_reg_1  (),        // 参数1
        .i_req_reg_2  (),        // 参数2
        .i_req_reg_3  (),        // 参数3
        .o_res_reg_0  (w_res_reg_0),    // 返回值0
        .o_res_reg_1  (),    // 返回值1
        .o_res_reg_2  (),     // 返回值2
        .o_res_reg_3  (),     // 返回值3
        .i_rpc_start  (r_rpc_start),     // 启动标志
        .i_rpc_valid  (1),               //RPC主机方法和参数准备好了
        .o_rpc_done   (w_rpc_done),    // RPC处理完成（1=结果有效）
        .o_rpc_busy  (w_rpc_busy)   // RPC正忙（处理中保持高）
    );
endmodule
```

## src/rtl/uart_rx.v
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
## src/rtl/uart_tx.v
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
## src/rtl/rpc_processor.v
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