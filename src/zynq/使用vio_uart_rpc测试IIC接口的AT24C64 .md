# 用vio_uart_rpc协议,测试IIC接口的AT24C64

## 参考
[vio_uart基于串口实的RPC框架](https://blog.csdn.net/qq_26074053/article/details/149968390)

[vio_uart的浏览器版上位机](https://blog.csdn.net/qq_26074053/article/details/156460508)

[IO模拟IIC和SPI接口](https://blog.csdn.net/qq_26074053/article/details/156420728)

# BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/69f467356f3841398ce5c43dc734c929.png)
# IIC时序图
## 写时序
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/4713c2e089a04336a0966db3f3d8fce0.png)
## 读时序
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/b954506f88554bc49ca922bb47a8e126.png)


# 注意
在 Vivado 里，I²C 的 SDA 引脚如果你在 top-level HDL 里写成 inout，综合工具会自动在 IO 口推导出 IOBUF。
但如果你在 Block Design 里只拉出一个 output 或 input，Vivado 不会自动推导，必须你自己插入 IOBUF 这个 原语


# 测试用例
| 用例描述         | 发送帧（→）              | 响应帧（←）              | 说明                   |
| ------------ | ------------------- | ------------------- | -------------------- |
| 写寄存器（地址 1）   | `01 01 44 33 22 11` | `01 01 44 33 22 11` | 向寄存器1写入 `0x11223344` |
| 读寄存器（地址 1）   | `00 01 00 00 00 00` | `00 01 44 33 22 11` | 读取寄存器1，返回上一步数据       |
| RPC：回显（方法 0） | `02 00 BE BA FE CA` | `02 00 BE BA FE CA` | 回显参数0 = `0xCAFEBABE` |
| RPC：加法（方法 1） | `02 01 04 03 02 01` | `02 01 05 05 05 05` | 每字节加法：+1,+2,+3,+4    |
| RPC：读IIC AT24C64 | `02 02 09 00 00 00` | `02 02 89 00 00 00` | 读到地址9的数据为0x89    |
| RPC：写IIC AT24C64 | `02 03 09 34 00 00` | `02 03 09 00 00 00 ` | 地址9写入0x34    |
| 非法地址读取       | `00 1E 00 00 00 00` | *无响应 / 忽略*          | 地址超出范围（>29）被忽略       |

# Vivado 测试
## 源文件

### vio_uart.v
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
    //IIC
    output               o_scl    ,      //eeprom的时钟线scl
    input                i_sda_i,      // 从引脚读回来的 SDA (IOBUF.O)
    output               o_sda_o,      // 要驱动到引脚的 SDA 值 (IOBUF.I)
    output               o_sda_t,      // 三态控制 (IOBUF.T) 1=高阻, 0=驱动
    output               o_led               //led显示eeprom读写测试结果

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
        .o_rpc_busy  (w_rpc_busy),   // RPC正忙（处理中保持高）,
        .o_scl         (o_scl   ),  //I2C的SCL时钟信号
        .i_sda_i         (i_sda_i   ),
         .o_sda_o         (o_sda_o   ),
          .o_sda_t         (o_sda_t   )
    );
endmodule
```

###  uart_rx.v
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

###  uart_tx.v
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

###  rpc_processor.v

```verilog
`timescale 1ns/1ps

// 宏定义：RPC方法（32位功能码）
`define RPC_FUNC_ECHO          32'h00000000  // 回显功能（返回输入参数）
`define RPC_FUNC_ADD           32'h00000001  // 加法功能（参数相加）
`define RPC_FUNC_IIC_READ      32'h00000002  //  读IIC
`define RPC_FUNC_IIC_WRITE     32'h00000003  // 写IIC

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
    output reg         o_rpc_done,    // RPC处理完成（1=结果有效）

    // iic 接口
    output               o_scl    ,      //eeprom的时钟线scl
    input                i_sda_i,      // 从引脚读回来的 SDA (IOBUF.O)
    output               o_sda_o,      // 要驱动到引脚的 SDA 值 (IOBUF.I)
    output               o_sda_t     // 三态控制 (IOBUF.T) 1=高阻, 0=驱动
);

    //parameter define
    parameter    P_SLAVE_ADDR = 7'b1010000     ; //器件地址(P_SLAVE_ADDR)
    parameter    P_BIT_CTRL   = 1'b1           ; //字地址位控制参数(16b/8b)
    parameter    P_CLK_FREQ   = 26'd50_000_000 ; //i2c_dri模块的驱动时钟频率(P_CLK_FREQ)
    parameter    P_I2C_FREQ   = 18'd250_000    ; //I2C的SCL时钟频率
    parameter    P_L_TIME     = 17'd125_000    ; //led闪烁时间参数
    parameter    P_MAX_BYTE   = 16'd256        ; //读写测试的字节个数


    //wire define
    wire           w_dri_clk   ; //I2C操作时钟
    wire           w_i2c_exec  ; //I2C触发控制
    wire   [15:0]  w_i2c_addr  ; //I2C操作地址
    wire   [ 7:0]  w_i2c_data_w; //I2C写入的数据
    wire           w_i2c_done  ; //I2C操作结束标志
    wire           w_i2c_ack   ; //I2C应答标志 0:应答 1:未应答
    wire           w_i2c_rh_wl ; //I2C读写控制
    wire   [ 7:0]  w_i2c_data_r; //I2C读出的数据
    // reg  define
    reg [15:0] r_i2c_addr;
    reg [7:0] r_i2c_data_w;
    reg  r_i2c_exec;
    reg  r_i2c_rh_wl;
    reg  r_i2c_ack;
    // connect
    assign w_i2c_addr = r_i2c_addr;
    assign w_i2c_data_w = r_i2c_data_w;
    assign w_i2c_exec = r_i2c_exec;
    assign w_i2c_rh_wl = r_i2c_rh_wl;
    assign w_i2c_ack = r_i2c_ack;
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
    wire  w_iic_method= r_method_latch==`RPC_FUNC_IIC_READ||r_method_latch==`RPC_FUNC_IIC_WRITE;
    // --------------------------
    // RPC处理状态机
    // --------------------------
    localparam S_IDLE      = 2'b00;
    localparam S_INIT= 2'b01;
    localparam S_PROCESSING = 2'b10;
    localparam S_DONE      = 2'b11;

    reg [1:0] r_state;
    reg [15:0] r_proc_cnt;  // 模拟处理延迟（0~15周期）

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_state <= S_IDLE;
            r_proc_cnt <= 16'h0;
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
                        r_state <= S_INIT;    // 进入初始状态
                        r_proc_cnt <= 16'h0;       // 重置延迟计数器
                        r_i2c_exec <= 1'b0;
                    end else begin
                        o_rpc_busy <= 1'b0;
                        r_state <= S_IDLE;
                    end
                end
                S_INIT: begin
                   if(r_proc_cnt==16'h0) begin
                      if(r_method_latch==`RPC_FUNC_IIC_READ) begin
                           r_i2c_addr<={8'h00, r_req_latch_0[7:0]};  // 高8位补0，使用低8位作为地址
                           r_i2c_rh_wl<=1;
                           r_i2c_data_w<=8'b0;
                           r_i2c_exec<=1;
                        end
                        else if(r_method_latch==`RPC_FUNC_IIC_WRITE) begin
                           r_i2c_addr<={8'h00, r_req_latch_0[7:0]};  // 高8位补0，使用低8位作为地址
                           r_i2c_rh_wl<=0;
                           r_i2c_data_w<=r_req_latch_0[15:8];
                           r_i2c_exec<=1;
                        end
                    end
                    r_proc_cnt<=r_proc_cnt+1;
                    //让r_i2c_exec拉高久一些
                    if(r_proc_cnt==16'd52) begin
                        r_proc_cnt <= 16'h0;
                        r_i2c_exec <= 1'b0;
                        r_state <= S_PROCESSING;
                    end
                end
                S_PROCESSING: begin
                    // 模拟处理延迟（例如10个时钟周期，可修改）
                     if ((r_proc_cnt >= 16'd9 && !w_iic_method)||(r_proc_cnt >= 16'd4 &&  w_i2c_done && w_iic_method)) begin
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
                           `RPC_FUNC_IIC_READ: begin
                                o_res_reg_0[7:0] <=    w_i2c_data_r;
                                o_res_reg_0[15:8] <=   8'd0;
                                o_res_reg_0[23:16] <=  8'd0;
                                o_res_reg_0[31:24] <=  8'd0;
                            end
                            `RPC_FUNC_IIC_WRITE: begin
                                o_res_reg_0[7:0] <=     r_req_latch_0[7:0];
                                o_res_reg_0[15:8] <=    8'd0;
                                o_res_reg_0[23:16] <=   8'd0;
                                o_res_reg_0[31:24] <=   8'd0;
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



    //i2c驱动模块
    i2c_master_dri #(
        .P_SLAVE_ADDR  (P_SLAVE_ADDR),  //EEPROM从机地址
        .P_CLK_FREQ    (P_CLK_FREQ  ),  //模块输入的时钟频率
        .P_I2C_FREQ    (P_I2C_FREQ  )   //IIC_SCL的时钟频率
    ) u_i2c_master_dri(
        .i_clk         (i_clk   ),
        .i_rst_n       (i_rst_n ),
        //i2c interface
        .i_i2c_exec    (w_i2c_exec  ),  //I2C触发执行信号
        .i_bit_ctrl    (P_BIT_CTRL  ),  //器件地址位控制(16b/8b)
        .i_i2c_rh_wl   (w_i2c_rh_wl ),  //I2C读写控制信号
        .i_i2c_addr    (w_i2c_addr  ),  //I2C器件内地址
        .i_i2c_data_w  (w_i2c_data_w),  //I2C要写的数据
        .o_i2c_data_r  (w_i2c_data_r),  //I2C读出的数据
        .o_i2c_done    (w_i2c_done  ),  //I2C一次操作完成
        .o_i2c_ack     (w_i2c_ack   ),  //I2C应答标志
        .o_scl         (o_scl   ),  //I2C的SCL时钟信号
        .i_sda_i         (i_sda_i   ),
        .o_sda_o         (o_sda_o   ),
        .o_sda_t         (o_sda_t   )
    );



endmodule
```

###  i2c_master_dri.v
```verilog

module i2c_master_dri
    #(
      parameter   P_SLAVE_ADDR = 7'b1010000   ,  //EEPROM从机地址
      parameter   P_CLK_FREQ   = 26'd50_000_000, //模块输入的时钟频率
      parameter   P_I2C_FREQ   = 18'd250_000     //IIC_SCL的时钟频率250K
    )
   (
    input                i_clk        ,
    input                i_rst_n      ,

    // i2c interface (bus control)
    input                i_i2c_exec   ,  //I2C触发执行信号
    input                i_bit_ctrl   ,  //字地址位控制(16b/8b)
    input                i_i2c_rh_wl  ,  //I2C读写控制信号 (1=read 0=write) 原名 i2c_rh_wl 保持
    input        [15:0]  i_i2c_addr   ,  //I2C器件内地址
    input        [ 7:0]  i_i2c_data_w ,  //I2C要写的数据
    output  reg  [ 7:0]  o_i2c_data_r ,  //I2C读出的数据
    output  reg          o_i2c_done   ,  //I2C一次操作完成
    output  reg          o_i2c_ack    ,  //I2C应答标志 0:应答 1:未应答
    output  reg          o_scl        ,  //I2C的SCL时钟信号

    // SDA 三端口替换: 外部通过 IOBUF 连接到 top IO
    input                i_sda_i,      // 从引脚读回来的 SDA (IOBUF.O)
    output               o_sda_o,      // 要驱动到引脚的 SDA 值 (IOBUF.I)
    output               o_sda_t,      // 三态控制 (IOBUF.T) 1=高阻, 0=驱动

    // user interface
    output  reg          o_dri_clk     //驱动I2C操作的驱动时钟
     );


//localparam define
localparam  S_IDLE     = 8'b0000_0001; //空闲状态
localparam  S_SLADDR   = 8'b0000_0010; //发送器件地址(slave address)
localparam  S_ADDR16   = 8'b0000_0100; //发送16位字地址
localparam  S_ADDR8    = 8'b0000_1000; //发送8位字地址
localparam  S_DATA_WR  = 8'b0001_0000; //写数据(8 bit)
localparam  S_ADDR_RD  = 8'b0010_0000; //发送器件地址读
localparam  S_DATA_RD  = 8'b0100_0000; //读数据(8 bit)
localparam  S_STOP     = 8'b1000_0000; //结束I2C操作

//reg define
reg            r_sda_dir   ; //I2C数据(SDA)方向控制 (1=drive, 0=release)
reg            r_sda_out   ; //SDA输出信号 (内部驱动值)
reg            r_st_done   ; //状态结束
reg            r_wr_flag   ; //写标志
reg    [ 6:0]  r_cnt       ; //计数
reg    [ 7:0]  r_cur_state ; //状态机当前状态
reg    [ 7:0]  r_next_state; //状态机下一状态
reg    [15:0]  r_addr_t    ; //地址
reg    [ 7:0]  r_data_r    ; //读取的数据 (临时)
reg    [ 7:0]  r_data_wr_t ; //I2C需写的数据的临时寄存
reg    [ 9:0]  r_clk_cnt   ; //分频时钟计数

//wire define
wire          w_sda_in     ; //SDA输入信号 (来自外部 IO via IOBUF.O)
wire   [8:0]  w_clk_divide ; //模块驱动时钟的分频系数

//*****************************************************
//**                    main code
//*****************************************************

// ---- SDA 信号映射：把内部 r_sda_out/r_sda_dir 暴露为模块输出 o_sda_o/o_sda_t；w_sda_in 从外部输入
assign o_sda_o      = r_sda_out;        // 内部想输出到总线的值
assign o_sda_t      = ~r_sda_dir;       // r_sda_dir==1 表示驱动 -> T = 0; r_sda_dir==0 表示释放 -> T = 1
assign w_sda_in     = i_sda_i;          // 从外部引脚读回的值 (IOBUF.O)

// ---- 分频计算 (保持原逻辑)
assign  w_clk_divide = (P_CLK_FREQ/P_I2C_FREQ) >> 2'd2 ;  //模块驱动时钟的分频系数

//生成I2C的SCL的四倍频率的驱动时钟用于驱动i2c的操作
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) begin
        o_dri_clk <=  1'b0;
        r_clk_cnt <= 10'd0;
    end
    else if(r_clk_cnt == (w_clk_divide[8:1] - 9'd1)) begin
        r_clk_cnt <= 10'd0;
        o_dri_clk <= ~o_dri_clk;
    end
    else
        r_clk_cnt <= r_clk_cnt + 10'b1;
end

// 生成时钟使能信号，用于统一时钟域
reg r_dri_clk_en;
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) begin
        r_dri_clk_en <= 1'b0;
    end
    else if(r_clk_cnt == (w_clk_divide[8:1] - 9'd1)) begin
        r_dri_clk_en <= 1'b1;
    end
    else
        r_dri_clk_en <= 1'b0;
end

//(三段式状态机)同步时序描述状态转移
always @(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n)
        r_cur_state <= S_IDLE;
    else if(r_dri_clk_en)
        r_cur_state <= r_next_state;
end

//组合逻辑判断状态转移条件
always @(*) begin
    r_next_state = S_IDLE;
    case(r_cur_state)
        S_IDLE: begin                          //空闲状态
           if(i_i2c_exec) begin
               r_next_state = S_SLADDR;
           end
           else
               r_next_state = S_IDLE;
        end
        S_SLADDR: begin
            if(r_st_done) begin
                if(i_bit_ctrl)                    //判断是16位还是8位字地址
                   r_next_state = S_ADDR16;
                else
                   r_next_state = S_ADDR8 ;
            end
            else
                r_next_state = S_SLADDR;
        end
        S_ADDR16: begin                        //写16位字地址
            if(r_st_done) begin
                r_next_state = S_ADDR8;
            end
            else begin
                r_next_state = S_ADDR16;
            end
        end
        S_ADDR8: begin                         //8位字地址
            if(r_st_done) begin
                if(r_wr_flag==1'b0)               //读写判断 (注意原 r_wr_flag 用法)
                    r_next_state = S_DATA_WR;
                else
                    r_next_state = S_ADDR_RD;
            end
            else begin
                r_next_state = S_ADDR8;
            end
        end
        S_DATA_WR: begin                       //写数据(8 bit)
            if(r_st_done)
                r_next_state = S_STOP;
            else
                r_next_state = S_DATA_WR;
        end
        S_ADDR_RD: begin                       //写地址以进行读数据
            if(r_st_done) begin
                r_next_state = S_DATA_RD;
            end
            else begin
                r_next_state = S_ADDR_RD;
            end
        end
        S_DATA_RD: begin                       //读取数据(8 bit)
            if(r_st_done)
                r_next_state = S_STOP;
            else
                r_next_state = S_DATA_RD;
        end
        S_STOP: begin                          //结束I2C操作
            if(r_st_done)
                r_next_state = S_IDLE;
            else
                r_next_state = S_STOP ;
        end
        default: r_next_state= S_IDLE;
    endcase
end

//时序电路描述状态输出
always @(posedge i_clk or negedge i_rst_n) begin
    //复位初始化
    if(!i_rst_n) begin
        o_scl       <= 1'b1;
        r_sda_out   <= 1'b1;
        r_sda_dir   <= 1'b1;
        o_i2c_done  <= 1'b0;
        o_i2c_ack   <= 1'b0;
        r_cnt       <= 7'b0;
        r_st_done   <= 1'b0;
        r_data_r    <= 8'b0;
        o_i2c_data_r<= 8'b0;
        r_wr_flag   <= 1'b0;
        r_addr_t    <= 16'b0;
        r_data_wr_t <= 8'b0;
    end
    else if(r_dri_clk_en) begin
        r_st_done <= 1'b0 ;
        r_cnt     <= r_cnt +7'b1 ;
        case(r_cur_state)
             S_IDLE: begin                          //空闲状态
                o_scl     <= 1'b1;
                r_sda_out <= 1'b1;
                r_sda_dir <= 1'b1;
                o_i2c_done<= 1'b0;
                r_cnt     <= 7'b0;
                if(i_i2c_exec) begin
                    r_wr_flag   <= i_i2c_rh_wl ;
                    r_addr_t    <= i_i2c_addr  ;
                    r_data_wr_t <= i_i2c_data_w;
                    o_i2c_ack   <= 1'b0;
                end
            end
            S_SLADDR: begin                         //写地址(器件地址和字地址)
                case(r_cnt)
                    7'd1 : r_sda_out <= 1'b0;          //开始I2C
                    7'd3 : o_scl <= 1'b0;
                    7'd4 : r_sda_out <= P_SLAVE_ADDR[6]; //传送器件地址
                    7'd5 : o_scl <= 1'b1;
                    7'd7 : o_scl <= 1'b0;
                    7'd8 : r_sda_out <= P_SLAVE_ADDR[5];
                    7'd9 : o_scl <= 1'b1;
                    7'd11: o_scl <= 1'b0;
                    7'd12: r_sda_out <= P_SLAVE_ADDR[4];
                    7'd13: o_scl <= 1'b1;
                    7'd15: o_scl <= 1'b0;
                    7'd16: r_sda_out <= P_SLAVE_ADDR[3];
                    7'd17: o_scl <= 1'b1;
                    7'd19: o_scl <= 1'b0;
                    7'd20: r_sda_out <= P_SLAVE_ADDR[2];
                    7'd21: o_scl <= 1'b1;
                    7'd23: o_scl <= 1'b0;
                    7'd24: r_sda_out <= P_SLAVE_ADDR[1];
                    7'd25: o_scl <= 1'b1;
                    7'd27: o_scl <= 1'b0;
                    7'd28: r_sda_out <= P_SLAVE_ADDR[0];
                    7'd29: o_scl <= 1'b1;
                    7'd31: o_scl <= 1'b0;
                    7'd32: r_sda_out <= 1'b0;          //0:写
                    7'd33: o_scl <= 1'b1;
                    7'd35: o_scl <= 1'b0;
                    7'd36: begin
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd37: o_scl     <= 1'b1;
                    7'd38: begin                     //从机应答
                        r_st_done <= 1'b1;
                        if(w_sda_in == 1'b1)           //高电平表示未应答
                            o_i2c_ack <= 1'b1;         //拉高应答标志位
                    end
                    7'd39: begin
                        o_scl <= 1'b0;
                        r_cnt <= 7'b0;
                    end
                    default :  ;
                endcase
            end
            S_ADDR16: begin
                case(r_cnt)
                    7'd0 : begin
                        r_sda_dir <= 1'b1 ;
                        r_sda_out <= r_addr_t[15];       //传送字地址
                    end
                    7'd1 : o_scl <= 1'b1;
                    7'd3 : o_scl <= 1'b0;
                    7'd4 : r_sda_out <= r_addr_t[14];
                    7'd5 : o_scl <= 1'b1;
                    7'd7 : o_scl <= 1'b0;
                    7'd8 : r_sda_out <= r_addr_t[13];
                    7'd9 : o_scl <= 1'b1;
                    7'd11: o_scl <= 1'b0;
                    7'd12: r_sda_out <= r_addr_t[12];
                    7'd13: o_scl <= 1'b1;
                    7'd15: o_scl <= 1'b0;
                    7'd16: r_sda_out <= r_addr_t[11];
                    7'd17: o_scl <= 1'b1;
                    7'd19: o_scl <= 1'b0;
                    7'd20: r_sda_out <= r_addr_t[10];
                    7'd21: o_scl <= 1'b1;
                    7'd23: o_scl <= 1'b0;
                    7'd24: r_sda_out <= r_addr_t[9];
                    7'd25: o_scl <= 1'b1;
                    7'd27: o_scl <= 1'b0;
                    7'd28: r_sda_out <= r_addr_t[8];
                    7'd29: o_scl <= 1'b1;
                    7'd31: o_scl <= 1'b0;
                    7'd32: begin
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl  <= 1'b1;
                    7'd34: begin                     //从机应答
                        r_st_done <= 1'b1;
                        if(w_sda_in == 1'b1)           //高电平表示未应答
                            o_i2c_ack <= 1'b1;         //拉高应答标志位
                    end
                    7'd35: begin
                        o_scl <= 1'b0;
                        r_cnt <= 7'b0;
                    end
                    default :  ;
                endcase
            end
            S_ADDR8: begin
                case(r_cnt)
                    7'd0: begin
                       r_sda_dir <= 1'b1 ;
                       r_sda_out <= r_addr_t[7];         //字地址
                    end
                    7'd1 : o_scl <= 1'b1;
                    7'd3 : o_scl <= 1'b0;
                    7'd4 : r_sda_out <= r_addr_t[6];
                    7'd5 : o_scl <= 1'b1;
                    7'd7 : o_scl <= 1'b0;
                    7'd8 : r_sda_out <= r_addr_t[5];
                    7'd9 : o_scl <= 1'b1;
                    7'd11: o_scl <= 1'b0;
                    7'd12: r_sda_out <= r_addr_t[4];
                    7'd13: o_scl <= 1'b1;
                    7'd15: o_scl <= 1'b0;
                    7'd16: r_sda_out <= r_addr_t[3];
                    7'd17: o_scl <= 1'b1;
                    7'd19: o_scl <= 1'b0;
                    7'd20: r_sda_out <= r_addr_t[2];
                    7'd21: o_scl <= 1'b1;
                    7'd23: o_scl <= 1'b0;
                    7'd24: r_sda_out <= r_addr_t[1];
                    7'd25: o_scl <= 1'b1;
                    7'd27: o_scl <= 1'b0;
                    7'd28: r_sda_out <= r_addr_t[0];
                    7'd29: o_scl <= 1'b1;
                    7'd31: o_scl <= 1'b0;
                    7'd32: begin
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl     <= 1'b1;
                    7'd34: begin                     //从机应答
                        r_st_done <= 1'b1;
                        if(w_sda_in == 1'b1)           //高电平表示未应答
                            o_i2c_ack <= 1'b1;         //拉高应答标志位
                    end
                    7'd35: begin
                        o_scl <= 1'b0;
                        r_cnt <= 7'b0;
                    end
                    default :  ;
                endcase
            end
            S_DATA_WR: begin                        //写数据(8 bit)
                case(r_cnt)
                    7'd0: begin
                        r_sda_dir <= 1'b1;
                        r_sda_out <= r_data_wr_t[7];     //I2C写8位数据
                    end
                    7'd1 : o_scl <= 1'b1;
                    7'd3 : o_scl <= 1'b0;
                    7'd4 : r_sda_out <= r_data_wr_t[6];
                    7'd5 : o_scl <= 1'b1;
                    7'd7 : o_scl <= 1'b0;
                    7'd8 : r_sda_out <= r_data_wr_t[5];
                    7'd9 : o_scl <= 1'b1;
                    7'd11: o_scl <= 1'b0;
                    7'd12: r_sda_out <= r_data_wr_t[4];
                    7'd13: o_scl <= 1'b1;
                    7'd15: o_scl <= 1'b0;
                    7'd16: r_sda_out <= r_data_wr_t[3];
                    7'd17: o_scl <= 1'b1;
                    7'd19: o_scl <= 1'b0;
                    7'd20: r_sda_out <= r_data_wr_t[2];
                    7'd21: o_scl <= 1'b1;
                    7'd23: o_scl <= 1'b0;
                    7'd24: r_sda_out <= r_data_wr_t[1];
                    7'd25: o_scl <= 1'b1;
                    7'd27: o_scl <= 1'b0;
                    7'd28: r_sda_out <= r_data_wr_t[0];
                    7'd29: o_scl <= 1'b1;
                    7'd31: o_scl <= 1'b0;
                    7'd32: begin
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl <= 1'b1;
                    7'd34: begin                     //从机应答
                        r_st_done <= 1'b1;
                        if(w_sda_in == 1'b1)           //高电平表示未应答
                            o_i2c_ack <= 1'b1;         //拉高应答标志位
                    end
                    7'd35: begin
                        o_scl  <= 1'b0;
                        r_cnt  <= 7'b0;
                    end
                    default  :  ;
                endcase
            end
            S_ADDR_RD: begin                        //写地址以进行读数据
                case(r_cnt)
                    7'd0 : begin
                        r_sda_dir <= 1'b1;
                        r_sda_out <= 1'b1;
                    end
                    7'd1 : o_scl <= 1'b1;
                    7'd2 : r_sda_out <= 1'b0;          //重新开始
                    7'd3 : o_scl <= 1'b0;
                    7'd4 : r_sda_out <= P_SLAVE_ADDR[6]; //传送器件地址
                    7'd5 : o_scl <= 1'b1;
                    7'd7 : o_scl <= 1'b0;
                    7'd8 : r_sda_out <= P_SLAVE_ADDR[5];
                    7'd9 : o_scl <= 1'b1;
                    7'd11: o_scl <= 1'b0;
                    7'd12: r_sda_out <= P_SLAVE_ADDR[4];
                    7'd13: o_scl <= 1'b1;
                    7'd15: o_scl <= 1'b0;
                    7'd16: r_sda_out <= P_SLAVE_ADDR[3];
                    7'd17: o_scl <= 1'b1;
                    7'd19: o_scl <= 1'b0;
                    7'd20: r_sda_out <= P_SLAVE_ADDR[2];
                    7'd21: o_scl <= 1'b1;
                    7'd23: o_scl <= 1'b0;
                    7'd24: r_sda_out <= P_SLAVE_ADDR[1];
                    7'd25: o_scl <= 1'b1;
                    7'd27: o_scl <= 1'b0;
                    7'd28: r_sda_out <= P_SLAVE_ADDR[0];
                    7'd29: o_scl <= 1'b1;
                    7'd31: o_scl <= 1'b0;
                    7'd32: r_sda_out <= 1'b1;          //1:读
                    7'd33: o_scl <= 1'b1;
                    7'd35: o_scl <= 1'b0;
                    7'd36: begin
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd37: o_scl     <= 1'b1;
                    7'd38: begin                     //从机应答
                        r_st_done <= 1'b1;
                        if(w_sda_in == 1'b1)           //高电平表示未应答
                            o_i2c_ack <= 1'b1;         //拉高应答标志位
                    end
                    7'd39: begin
                        o_scl <= 1'b0;
                        r_cnt <= 7'b0;
                    end
                    default : ;
                endcase
            end
            S_DATA_RD: begin                        //读取数据(8 bit)
                case(r_cnt)
                    7'd0: r_sda_dir <= 1'b0;
                    7'd1: begin
                        r_data_r[7] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd3: o_scl  <= 1'b0;
                    7'd5: begin
                        r_data_r[6] <= w_sda_in ;
                        o_scl       <= 1'b1   ;
                    end
                    7'd7: o_scl  <= 1'b0;
                    7'd9: begin
                        r_data_r[5] <= w_sda_in;
                        o_scl       <= 1'b1  ;
                    end
                    7'd11: o_scl  <= 1'b0;
                    7'd13: begin
                        r_data_r[4] <= w_sda_in;
                        o_scl       <= 1'b1  ;
                    end
                    7'd15: o_scl  <= 1'b0;
                    7'd17: begin
                        r_data_r[3] <= w_sda_in;
                        o_scl       <= 1'b1  ;
                    end
                    7'd19: o_scl  <= 1'b0;
                    7'd21: begin
                        r_data_r[2] <= w_sda_in;
                        o_scl       <= 1'b1  ;
                    end
                    7'd23: o_scl  <= 1'b0;
                    7'd25: begin
                        r_data_r[1] <= w_sda_in;
                        o_scl       <= 1'b1  ;
                    end
                    7'd27: o_scl  <= 1'b0;
                    7'd29: begin
                        r_data_r[0] <= w_sda_in;
                        o_scl       <= 1'b1  ;
                    end
                    7'd31: o_scl  <= 1'b0;
                    7'd32: begin
                        r_sda_dir <= 1'b1;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl     <= 1'b1;
                    7'd34: r_st_done <= 1'b1;          //非应答
                    7'd35: begin
                        o_scl <= 1'b0;
                        r_cnt <= 7'b0;
                        o_i2c_data_r <= r_data_r;
                    end
                    default  :  ;
                endcase
            end
            S_STOP: begin                           //结束I2C操作
                case(r_cnt)
                    7'd0: begin
                        r_sda_dir <= 1'b1;             //结束I2C
                        r_sda_out <= 1'b0;
                    end
                    7'd1 : o_scl     <= 1'b1;
                    7'd3 : r_sda_out <= 1'b1;
                    7'd15: r_st_done <= 1'b1;
                    7'd16: begin
                        r_cnt      <= 7'b0;
                        o_i2c_done <= 1'b1;            //向上层模块传递I2C结束信号
                    end
                    default  : ;
                endcase
            end
        endcase
    end
end

endmodule

```

###  iobuf_wrapper.v
```verilog
module iobuf_wrapper (
    input  wire I,
    output wire O,
    inout  wire IO,
    input  wire T
);
    IOBUF u_iobuf (.I(I), .O(O), .IO(IO), .T(T));
endmodule

```

###  readme.md
```markdown
set rtl_dir "D:/workspace/gitee/ant_prj/ant/src/rtl/iic"
add_files $rtl_dir/rpc_processor.v
add_files $rtl_dir/uart_rx.v
add_files $rtl_dir/uart_tx.v
add_files $rtl_dir/vio_uart.v
add_files $rtl_dir/i2c_master_dri.v
add_files $rtl_dir/iobuf_wrapper.v
```
###  pin.xdc
```bash
#时序约束
create_clock -period 20.000 -name sys_clk [get_ports sys_clk]
#IO引脚约束
#----------------------系统时钟---------------------------
set_property -dict {PACKAGE_PIN U18 IOSTANDARD LVCMOS33} [get_ports sys_clk]
#----------------------系统复位---------------------------
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports sys_rst_n]
set_property -dict {PACKAGE_PIN K14 IOSTANDARD LVCMOS33} [get_ports uart_rxd]
set_property -dict {PACKAGE_PIN M15 IOSTANDARD LVCMOS33} [get_ports uart_txd]
set_property -dict {PACKAGE_PIN E18 IOSTANDARD LVCMOS33} [get_ports iic_scl]
set_property -dict {PACKAGE_PIN F17 IOSTANDARD LVCMOS33} [get_ports iic_sda]
set_property -dict {PACKAGE_PIN H15 IOSTANDARD LVCMOS33} [get_ports led]
```

#  GoWin  tang_nano_1k 测试
## 源文件
### top_e2prom.v
```verilog
module top_e2prom #(
    // I2C驱动模块参数
    parameter   P_SLAVE_ADDR        = 7'b1010000,    // EEPROM从机地址
    parameter   P_CLK_FREQ          = 26'd27_000_000,// 系统时钟频率(27MHz)
    parameter   P_I2C_FREQ          = 18'd250_000,   // I2C_SCL时钟频率(250KHz)
    parameter   P_BIT_CTRL          = 1'b1,          // 字地址位控制(1:16位 0:8位)
    // E2PROM读写测试参数
    parameter   P_MAX_BYTE          = 16'd256,       // 读写测试的字节总数(0~255)
    // LED指示模块参数
    parameter   P_LED_FLASH_CNT_MAX = 17'd125_000    // LED闪烁计数阈值(250ms@50MHz，实际随dri_clk变化)
) (
    // 系统信号
    input                   i_sys_clk       ,// 系统时钟输入(27MHz)
    input                   i_sys_rst_n     ,// 系统复位信号(低有效)
    // EEPROM物理接口
    output                  o_iic_scl       ,// EEPROM的SCL时钟线
    inout                   io_iic_sda      ,// EEPROM的SDA数据线(双向)
    // 用户接口
    output                  o_led           // LED状态输出(低亮高灭，指示测试结果)
);

// Wire define（模块间交互信号，按功能分组）
// I2C驱动模块 → 其他模块
wire            w_dri_clk          ;// I2C操作驱动时钟(I2C_SCL的4倍频率)
wire            w_i2c_done         ;// I2C单次操作完成标志
wire            w_i2c_ack          ;// I2C应答标志(0:应答 1:未应答)
wire    [7:0]   w_i2c_data_r       ;// I2C读出的数据
// E2PROM读写模块 → I2C驱动模块
wire            w_i2c_exec         ;// I2C触发执行信号
wire            w_i2c_rh_wl        ;// I2C读写控制信号(0:写 1:读)
wire    [15:0]  w_i2c_addr         ;// I2C器件内地址
wire    [7:0]   w_i2c_data_w       ;// I2C要写入的数据
// E2PROM读写模块 → LED指示模块
wire            w_rw_done          ;// E2PROM读写测试完成标志
wire            w_rw_result        ;// E2PROM读写测试结果(0:失败 1:成功)

// *****************************************************
// **                    模块例化
// *****************************************************

// 例化E2PROM读写测试模块
e2prom_rw #(
    .P_MAX_BYTE    (P_MAX_BYTE)      // 读写测试的字节总数
) u_e2prom_rw (
    // 系统信号
    .i_clk         (w_dri_clk)       ,// 时钟(I2C驱动时钟)
    .i_rst_n       (i_sys_rst_n)     ,// 复位信号
    // I2C控制接口（输出到I2C驱动）
    .o_i2c_exec    (w_i2c_exec)      ,// I2C触发执行信号
    .o_i2c_rh_wl   (w_i2c_rh_wl)     ,// I2C读写控制信号
    .o_i2c_addr    (w_i2c_addr)      ,// I2C器件内地址
    .o_i2c_data_w  (w_i2c_data_w)    ,// I2C要写的数据
    // I2C控制接口（输入来自I2C驱动）
    .i_i2c_data_r  (w_i2c_data_r)    ,// I2C读出的数据
    .i_i2c_done    (w_i2c_done)      ,// I2C单次操作完成
    .i_i2c_ack     (w_i2c_ack)       ,// I2C应答标志
    // 用户接口（输出到LED模块）
    .o_rw_done     (w_rw_done)       ,// E2PROM读写测试完成
    .o_rw_result   (w_rw_result)     // E2PROM读写测试结果
);

// 例化I2C主机驱动模块
i2c_master_dri #(
    .P_SLAVE_ADDR  (P_SLAVE_ADDR)    ,// EEPROM从机地址
    .P_CLK_FREQ    (P_CLK_FREQ)      ,// 模块输入时钟频率
    .P_I2C_FREQ    (P_I2C_FREQ)      // I2C_SCL时钟频率
) u_i2c_dri (
    // 系统信号
    .i_clk         (i_sys_clk)       ,// 系统时钟输入
    .i_rst_n       (i_sys_rst_n)     ,// 系统复位信号
    // I2C控制接口（输入来自E2PROM读写模块）
    .i_i2c_exec    (w_i2c_exec)      ,// I2C触发执行信号
    .i_bit_ctrl    (P_BIT_CTRL)      ,// 字地址位控制(16b/8b，直接绑定参数)
    .i_i2c_rh_wl   (w_i2c_rh_wl)     ,// I2C读写控制信号
    .i_i2c_addr    (w_i2c_addr)      ,// I2C器件内地址
    .i_i2c_data_w  (w_i2c_data_w)    ,// I2C要写的数据
    // I2C控制接口（输出到E2PROM读写模块）
    .o_i2c_data_r  (w_i2c_data_r)    ,// I2C读出的数据
    .o_i2c_done    (w_i2c_done)      ,// I2C单次操作完成标志
    .o_i2c_ack     (w_i2c_ack)       ,// I2C应答标志
    // I2C物理接口（连接到EEPROM）
    .o_scl         (o_iic_scl)       ,// I2C的SCL时钟信号
    .io_sda        (io_iic_sda)      ,// I2C的SDA双向信号
    // 用户接口（输出到E2PROM读写模块）
    .o_dri_clk     (w_dri_clk)       // 驱动I2C操作的时钟
);

// 例化LED测试结果指示模块
rw_result_led #(
    .P_LED_FLASH_CNT_MAX (P_LED_FLASH_CNT_MAX) // LED闪烁计数阈值
) u_rw_result_led (
    // 系统信号
    .i_clk         (w_dri_clk)       ,// 时钟(I2C驱动时钟)
    .i_rst_n       (i_sys_rst_n)     ,// 复位信号
    // 输入接口（来自E2PROM读写模块）
    .i_rw_done     (w_rw_done)       ,// E2PROM读写测试完成
    .i_rw_result   (w_rw_result)     ,// E2PROM读写测试结果
    // 输出接口（连接到LED硬件）
    .o_led         (o_led)           // LED状态输出
);

endmodule
```
### e2prom_rw.v
```verilog
module e2prom_rw #(
    parameter   P_WR_WAIT_TIME = 14'd5000,  // EEPROM写操作间隔时间(ms级)
    parameter   P_MAX_BYTE     = 16'd256    // 读写测试的字节总数(0~255)
) (
    // 系统信号
    input                   i_clk           ,// 系统时钟输入
    input                   i_rst_n         ,// 系统复位信号(低有效)
    // I2C控制接口（与i2c_master_dri交互）
    output  reg             o_i2c_rh_wl     ,// I2C读写控制信号(0:写 1:读)
    output  reg             o_i2c_exec      ,// I2C触发执行信号
    output  reg     [15:0]  o_i2c_addr      ,// I2C器件内地址
    output  reg     [7:0]   o_i2c_data_w    ,// I2C要写入的数据
    input           [7:0]   i_i2c_data_r    ,// I2C读出的数据
    input                   i_i2c_done      ,// I2C单次操作完成标志
    input                   i_i2c_ack       ,// I2C应答标志(0:应答 1:未应答)
    // 用户接口
    output  reg             o_rw_done       ,// E2PROM读写测试完成标志
    output  reg             o_rw_result     // E2PROM读写测试结果(0:失败 1:成功)
);

// Reg define
reg     [1:0]    r_flow_cnt  ; // 状态流控制寄存器(0:写等待 1:写完成 2:读触发 3:读校验)
reg     [13:0]   r_wait_cnt  ; // 写操作间隔延时计数器

// *****************************************************
// **                    main code
// *****************************************************

// E2PROM读写测试逻辑：先连续写入256字节数据，再读出校验，对比写入/读出值是否一致
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        // 复位初始化所有寄存器
        r_flow_cnt    <= 2'd0;
        o_i2c_rh_wl   <= 1'b0;
        o_i2c_exec    <= 1'b0;
        o_i2c_addr    <= 16'd0;
        o_i2c_data_w  <= 8'd0;
        r_wait_cnt    <= 14'd0;
        o_rw_done     <= 1'b0;
        o_rw_result   <= 1'b0;
    end
    else begin
        // 默认值赋值（避免综合器报警）
        o_i2c_exec <= 1'b0;
        o_rw_done  <= 1'b0;

        case (r_flow_cnt)
            2'd0 : begin  // 状态0：写操作间隔延时
                r_wait_cnt <= r_wait_cnt + 14'b1;  // 延时计数递增

                // 延时达到设定值，准备触发单次写操作
                if (r_wait_cnt == (P_WR_WAIT_TIME - 14'b1)) begin
                    r_wait_cnt <= 14'd0;  // 复位延时计数器

                    // 判断是否完成256字节写入
                    if (o_i2c_addr == P_MAX_BYTE) begin
                        o_i2c_addr  <= 16'd0;    // 复位地址，准备读操作
                        o_i2c_rh_wl <= 1'b1;     // 切换为读操作
                        r_flow_cnt  <= 2'd2;     // 跳转到读触发状态
                    end
                    else begin
                        r_flow_cnt <= r_flow_cnt + 2'b1;  // 跳转到写执行状态
                        o_i2c_exec <= 1'b1;               // 触发I2C写操作
                    end
                end
            end

            2'd1 : begin  // 状态1：等待单次写操作完成
                // I2C单次写操作完成
                if (i_i2c_done == 1'b1) begin
                    r_flow_cnt   <= 2'd0;                // 回到写延时状态
                    o_i2c_addr   <= o_i2c_addr + 16'b1;  // 地址递增(0~255)
                    o_i2c_data_w <= o_i2c_data_w + 8'b1; // 数据递增(0~255)
                end
            end

            2'd2 : begin  // 状态2：触发单次读操作
                r_flow_cnt <= r_flow_cnt + 2'b1;  // 跳转到读校验状态
                o_i2c_exec <= 1'b1;               // 触发I2C读操作
            end

            2'd3 : begin  // 状态3：校验读出数据并判断测试结果
                // I2C单次读操作完成
                if (i_i2c_done == 1'b1) begin
                    // 异常判断：读出数据与写入值不一致 或 I2C无应答 → 测试失败
                    if ((o_i2c_addr[7:0] != i_i2c_data_r) || (i_i2c_ack == 1'b1)) begin
                        o_rw_done   <= 1'b1;
                        o_rw_result <= 1'b0;
                    end
                    // 正常结束：完成256字节读写且全部校验正确 → 测试成功
                    else if (o_i2c_addr == (P_MAX_BYTE - 16'b1)) begin
                        o_rw_done   <= 1'b1;
                        o_rw_result <= 1'b1;
                    end
                    // 继续读下一个字节
                    else begin
                        r_flow_cnt <= 2'd2;                // 回到读触发状态
                        o_i2c_addr <= o_i2c_addr + 16'b1;  // 地址递增
                    end
                end
            end

            default : ;  // 默认状态（防止综合器报警）
        endcase
    end
end

endmodule
```
### rw_result_led.v
```verilog
module rw_result_led #(
    parameter   P_LED_FLASH_CNT_MAX = 17'd125_000  // LED闪烁计数阈值(对应250ms@50MHz)
) (
    // 系统信号
    input                   i_clk           ,// 系统时钟输入
    input                   i_rst_n         ,// 系统复位信号(低有效)
    // 输入接口（与e2prom_rw模块交互）
    input                   i_rw_done       ,// E2PROM读写测试完成标志
    input                   i_rw_result     ,// E2PROM读写测试结果(0:失败 1:成功)
    // 输出接口
    output  reg             o_led           // LED输出(低电平点亮，高电平熄灭)
);

// Reg define
reg             r_rw_done_flag  ; // 读写测试完成锁存标志(避免单次脉冲丢失)
reg     [16:0]  r_led_cnt       ; // LED闪烁计数器

// *****************************************************
// **                    main code
// *****************************************************

// 锁存读写测试完成标志（防止i_rw_done单次脉冲被漏采）
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        r_rw_done_flag <= 1'b0;
    end
    else if (i_rw_done) begin  // 检测到读写测试完成
        r_rw_done_flag <= 1'b1;
    end
end

// LED状态控制逻辑：
// - 测试完成前：LED熄灭(高电平)
// - 测试成功：LED常亮(低电平)
// - 测试失败：LED以2Hz频率闪烁(500ms周期，250ms亮/250ms灭)
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        r_led_cnt <= 17'd0;
        o_led     <= 1'b1;  // 复位后LED熄灭
    end
    else begin
        if (r_rw_done_flag) begin  // 读写测试已完成
            if (i_rw_result) begin // 测试成功：LED常亮
                o_led     <= 1'b0;
                r_led_cnt <= 17'd0; // 复位计数器
            end
            else begin             // 测试失败：LED闪烁
                r_led_cnt <= r_led_cnt + 17'd1;
                if (r_led_cnt == (P_LED_FLASH_CNT_MAX - 17'd1)) begin
                    r_led_cnt <= 17'd0;
                    o_led     <= ~o_led; // 翻转LED状态
                end
            end
        end
        else begin                // 测试未完成：LED熄灭
            o_led     <= 1'b1;
            r_led_cnt <= 17'd0;
        end
    end
end

endmodule
```
### i2c_master_dri.v
```verilog
module i2c_master_dri #(
    parameter   P_SLAVE_ADDR = 7'b1010000,    // EEPROM从机地址
    parameter   P_CLK_FREQ   = 26'd50_000_000,// 模块输入时钟频率
    parameter   P_I2C_FREQ   = 18'd250_000    // IIC_SCL时钟频率
) (
    // 系统信号
    input                   i_clk           ,// 系统时钟
    input                   i_rst_n         ,// 系统复位(低有效)
    // I2C控制接口
    input                   i_i2c_exec      ,// I2C触发执行信号
    input                   i_bit_ctrl      ,// 字地址位控制(16b/8b)
    input                   i_i2c_rh_wl     ,// I2C读写控制信号
    input           [15:0]  i_i2c_addr      ,// I2C器件内地址
    input           [7:0]   i_i2c_data_w    ,// I2C要写的数据
    output  reg     [7:0]   o_i2c_data_r    ,// I2C读出的数据
    output  reg             o_i2c_done      ,// I2C一次操作完成标志
    output  reg             o_i2c_ack       ,// I2C应答标志(0:应答 1:未应答)
    // I2C物理接口
    output  reg             o_scl           ,// I2C的SCL时钟信号
    inout                   io_sda          ,// I2C的SDA信号(双向)
    // 用户接口
    output  reg             o_dri_clk           // I2C操作驱动时钟
);

// Local parameter define (状态机/分频参数)
localparam  S_IDLE     = 8'b0000_0001;    // 空闲状态
localparam  S_SLADDR   = 8'b0000_0010;    // 发送器件地址
localparam  S_ADDR16   = 8'b0000_0100;    // 发送16位字地址
localparam  S_ADDR8    = 8'b0000_1000;    // 发送8位字地址
localparam  S_DATA_WR  = 8'b0001_0000;    // 写数据(8bit)
localparam  S_ADDR_RD  = 8'b0010_0000;    // 发送读操作器件地址
localparam  S_DATA_RD  = 8'b0100_0000;    // 读数据(8bit)
localparam  S_STOP     = 8'b1000_0000;    // 结束I2C操作



localparam  L_CLK_DIVIDE  = (P_CLK_FREQ / P_I2C_FREQ) >> 2'd2; // 驱动时钟分频系数

// Reg define
reg             r_sda_dir       ;// SDA方向控制(1:输出 0:输入)
reg             r_sda_out       ;// SDA输出寄存器
reg             r_st_done       ;// 状态完成标志
reg             r_wr_flag       ;// 读写标志(1:读 0:写)
reg     [6:0]   r_cnt           ;// 状态内计数寄存器
reg     [7:0]   r_cur_state     ;// 状态机当前状态
reg     [7:0]   r_next_state    ;// 状态机下一状态
reg     [15:0]  r_addr_t        ;// 地址临时寄存器
reg     [7:0]   r_data_r        ;// 读数据临时寄存器
reg     [7:0]   r_data_wr_t     ;// 写数据临时寄存器
reg     [9:0]   r_clk_cnt       ;// 分频时钟计数寄存器

// Wire define
wire            w_sda_in        ;// SDA输入信号

// *****************************************************
// **                    main code
// *****************************************************

// SDA双向信号控制
assign  io_sda  = r_sda_dir ? r_sda_out : 1'bz;  // 1:输出数据 0:高阻(输入)
assign  w_sda_in = io_sda;                       // 采集SDA输入信号

// 生成I2C操作的驱动时钟(dri_clk = SCL时钟的4倍频率)
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        o_dri_clk <= 1'b0;
        r_clk_cnt <= 10'd0;
    end
    else if (r_clk_cnt == (L_CLK_DIVIDE[8:1] - 9'd1)) begin
        r_clk_cnt <= 10'd0;
        o_dri_clk <= ~o_dri_clk;
    end
    else begin
        r_clk_cnt <= r_clk_cnt + 10'b1;
    end
end

// 三段式状态机：1.同步时序描述状态转移
always @(posedge o_dri_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        r_cur_state <= S_IDLE;
    end
    else begin
        r_cur_state <= r_next_state;
    end
end

// 三段式状态机：2.组合逻辑判断状态转移条件
always @(*) begin
    r_next_state = S_IDLE;
    case (r_cur_state)
        S_IDLE: begin                      // 空闲状态
            if (i_i2c_exec) begin
                r_next_state = S_SLADDR;
            end
            else begin
                r_next_state = S_IDLE;
            end
        end
        S_SLADDR: begin                    // 发送器件地址
            if (r_st_done) begin
                if (i_bit_ctrl) begin         // 16位字地址
                    r_next_state = S_ADDR16;
                end
                else begin                    // 8位字地址
                    r_next_state = S_ADDR8;
                end
            end
            else begin
                r_next_state = S_SLADDR;
            end
        end
        S_ADDR16: begin                    // 发送16位字地址高8位
            if (r_st_done) begin
                r_next_state = S_ADDR8;
            end
            else begin
                r_next_state = S_ADDR16;
            end
        end
        S_ADDR8: begin                     // 发送字地址低8位
            if (r_st_done) begin
                if (r_wr_flag == 1'b0) begin  // 写操作
                    r_next_state = S_DATA_WR;
                end
                else begin                    // 读操作
                    r_next_state = S_ADDR_RD;
                end
            end
            else begin
                r_next_state = S_ADDR8;
            end
        end
        S_DATA_WR: begin                   // 写8位数据
            if (r_st_done) begin
                r_next_state = S_STOP;
            end
            else begin
                r_next_state = S_DATA_WR;
            end
        end
        S_ADDR_RD: begin                   // 发送读操作器件地址
            if (r_st_done) begin
                r_next_state = S_DATA_RD;
            end
            else begin
                r_next_state = S_ADDR_RD;
            end
        end
        S_DATA_RD: begin                   // 读8位数据
            if (r_st_done) begin
                r_next_state = S_STOP;
            end
            else begin
                r_next_state = S_DATA_RD;
            end
        end
        S_STOP: begin                      // 停止I2C操作
            if (r_st_done) begin
                r_next_state = S_IDLE;
            end
            else begin
                r_next_state = S_STOP;
            end
        end
        default: r_next_state = S_IDLE;
    endcase
end

// 三段式状态机：3.时序电路描述状态输出
always @(posedge o_dri_clk or negedge i_rst_n) begin
    // 复位初始化
    if (!i_rst_n) begin
        o_scl        <= 1'b1;
        r_sda_out    <= 1'b1;
        r_sda_dir    <= 1'b1;
        o_i2c_done   <= 1'b0;
        o_i2c_ack    <= 1'b0;
        r_cnt        <= 7'd0;
        r_st_done    <= 1'b0;
        r_data_r     <= 8'd0;
        o_i2c_data_r <= 8'd0;
        r_wr_flag    <= 1'b0;
        r_addr_t     <= 16'd0;
        r_data_wr_t  <= 8'd0;
    end
    else begin
        r_st_done <= 1'b0;
        r_cnt     <= r_cnt + 7'b1;

        case (r_cur_state)
            S_IDLE: begin                  // 空闲状态
                o_scl        <= 1'b1;
                r_sda_out    <= 1'b1;
                r_sda_dir    <= 1'b1;
                o_i2c_done   <= 1'b0;
                r_cnt        <= 7'd0;

                if (i_i2c_exec) begin
                    r_wr_flag   <= i_i2c_rh_wl;
                    r_addr_t    <= i_i2c_addr;
                    r_data_wr_t <= i_i2c_data_w;
                    o_i2c_ack   <= 1'b0;
                end
            end

            S_SLADDR: begin               // 发送器件地址+写标志
                case (r_cnt)
                    7'd1 : r_sda_out <= 1'b0; // 起始信号:SDA拉低
                    7'd3 : o_scl     <= 1'b0; // SCL拉低准备发送数据
                    7'd4 : r_sda_out <= P_SLAVE_ADDR[6];
                    7'd5 : o_scl     <= 1'b1; // SCL拉高，从机采样
                    7'd7 : o_scl     <= 1'b0; // SCL拉低，准备下一位
                    7'd8 : r_sda_out <= P_SLAVE_ADDR[5];
                    7'd9 : o_scl     <= 1'b1;
                    7'd11: o_scl     <= 1'b0;
                    7'd12: r_sda_out <= P_SLAVE_ADDR[4];
                    7'd13: o_scl     <= 1'b1;
                    7'd15: o_scl     <= 1'b0;
                    7'd16: r_sda_out <= P_SLAVE_ADDR[3];
                    7'd17: o_scl     <= 1'b1;
                    7'd19: o_scl     <= 1'b0;
                    7'd20: r_sda_out <= P_SLAVE_ADDR[2];
                    7'd21: o_scl     <= 1'b1;
                    7'd23: o_scl     <= 1'b0;
                    7'd24: r_sda_out <= P_SLAVE_ADDR[1];
                    7'd25: o_scl     <= 1'b1;
                    7'd27: o_scl     <= 1'b0;
                    7'd28: r_sda_out <= P_SLAVE_ADDR[0];
                    7'd29: o_scl     <= 1'b1;
                    7'd31: o_scl     <= 1'b0;
                    7'd32: r_sda_out <= 1'b0; // 写操作标志(0:写)
                    7'd33: o_scl     <= 1'b1;
                    7'd35: o_scl     <= 1'b0;
                    7'd36: begin               // 切换为输入，等待应答
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd37: o_scl     <= 1'b1; // 采样应答信号
                    7'd38: begin               // 检测从机应答
                        r_st_done <= 1'b1;
                        if (w_sda_in == 1'b1) begin // 无应答
                            o_i2c_ack <= 1'b1;
                        end
                    end
                    7'd39: begin               // 复位计数，准备下状态
                        o_scl  <= 1'b0;
                        r_cnt  <= 7'd0;
                    end
                    default: ;
                endcase
            end

            S_ADDR16: begin               // 发送16位字地址高8位
                case (r_cnt)
                    7'd0 : begin              // 切换为输出，发送地址
                        r_sda_dir <= 1'b1;
                        r_sda_out <= r_addr_t[15];
                    end
                    7'd1 : o_scl     <= 1'b1;
                    7'd3 : o_scl     <= 1'b0;
                    7'd4 : r_sda_out <= r_addr_t[14];
                    7'd5 : o_scl     <= 1'b1;
                    7'd7 : o_scl     <= 1'b0;
                    7'd8 : r_sda_out <= r_addr_t[13];
                    7'd9 : o_scl     <= 1'b1;
                    7'd11: o_scl     <= 1'b0;
                    7'd12: r_sda_out <= r_addr_t[12];
                    7'd13: o_scl     <= 1'b1;
                    7'd15: o_scl     <= 1'b0;
                    7'd16: r_sda_out <= r_addr_t[11];
                    7'd17: o_scl     <= 1'b1;
                    7'd19: o_scl     <= 1'b0;
                    7'd20: r_sda_out <= r_addr_t[10];
                    7'd21: o_scl     <= 1'b1;
                    7'd23: o_scl     <= 1'b0;
                    7'd24: r_sda_out <= r_addr_t[9];
                    7'd25: o_scl     <= 1'b1;
                    7'd27: o_scl     <= 1'b0;
                    7'd28: r_sda_out <= r_addr_t[8];
                    7'd29: o_scl     <= 1'b1;
                    7'd31: o_scl     <= 1'b0;
                    7'd32: begin               // 切换为输入，等待应答
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl     <= 1'b1;
                    7'd34: begin               // 检测从机应答
                        r_st_done <= 1'b1;
                        if (w_sda_in == 1'b1) begin
                            o_i2c_ack <= 1'b1;
                        end
                    end
                    7'd35: begin
                        o_scl  <= 1'b0;
                        r_cnt  <= 7'd0;
                    end
                    default: ;
                endcase
            end

            S_ADDR8: begin                // 发送字地址低8位
                case (r_cnt)
                    7'd0 : begin              // 切换为输出，发送地址
                        r_sda_dir <= 1'b1;
                        r_sda_out <= r_addr_t[7];
                    end
                    7'd1 : o_scl     <= 1'b1;
                    7'd3 : o_scl     <= 1'b0;
                    7'd4 : r_sda_out <= r_addr_t[6];
                    7'd5 : o_scl     <= 1'b1;
                    7'd7 : o_scl     <= 1'b0;
                    7'd8 : r_sda_out <= r_addr_t[5];
                    7'd9 : o_scl     <= 1'b1;
                    7'd11: o_scl     <= 1'b0;
                    7'd12: r_sda_out <= r_addr_t[4];
                    7'd13: o_scl     <= 1'b1;
                    7'd15: o_scl     <= 1'b0;
                    7'd16: r_sda_out <= r_addr_t[3];
                    7'd17: o_scl     <= 1'b1;
                    7'd19: o_scl     <= 1'b0;
                    7'd20: r_sda_out <= r_addr_t[2];
                    7'd21: o_scl     <= 1'b1;
                    7'd23: o_scl     <= 1'b0;
                    7'd24: r_sda_out <= r_addr_t[1];
                    7'd25: o_scl     <= 1'b1;
                    7'd27: o_scl     <= 1'b0;
                    7'd28: r_sda_out <= r_addr_t[0];
                    7'd29: o_scl     <= 1'b1;
                    7'd31: o_scl     <= 1'b0;
                    7'd32: begin               // 切换为输入，等待应答
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl     <= 1'b1;
                    7'd34: begin               // 检测从机应答
                        r_st_done <= 1'b1;
                        if (w_sda_in == 1'b1) begin
                            o_i2c_ack <= 1'b1;
                        end
                    end
                    7'd35: begin
                        o_scl  <= 1'b0;
                        r_cnt  <= 7'd0;
                    end
                    default: ;
                endcase
            end

            S_DATA_WR: begin              // 写8位数据
                case (r_cnt)
                    7'd0 : begin              // 切换为输出，发送数据
                        r_sda_dir <= 1'b1;
                        r_sda_out <= r_data_wr_t[7];
                    end
                    7'd1 : o_scl     <= 1'b1;
                    7'd3 : o_scl     <= 1'b0;
                    7'd4 : r_sda_out <= r_data_wr_t[6];
                    7'd5 : o_scl     <= 1'b1;
                    7'd7 : o_scl     <= 1'b0;
                    7'd8 : r_sda_out <= r_data_wr_t[5];
                    7'd9 : o_scl     <= 1'b1;
                    7'd11: o_scl     <= 1'b0;
                    7'd12: r_sda_out <= r_data_wr_t[4];
                    7'd13: o_scl     <= 1'b1;
                    7'd15: o_scl     <= 1'b0;
                    7'd16: r_sda_out <= r_data_wr_t[3];
                    7'd17: o_scl     <= 1'b1;
                    7'd19: o_scl     <= 1'b0;
                    7'd20: r_sda_out <= r_data_wr_t[2];
                    7'd21: o_scl     <= 1'b1;
                    7'd23: o_scl     <= 1'b0;
                    7'd24: r_sda_out <= r_data_wr_t[1];
                    7'd25: o_scl     <= 1'b1;
                    7'd27: o_scl     <= 1'b0;
                    7'd28: r_sda_out <= r_data_wr_t[0];
                    7'd29: o_scl     <= 1'b1;
                    7'd31: o_scl     <= 1'b0;
                    7'd32: begin               // 切换为输入，等待应答
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl     <= 1'b1;
                    7'd34: begin               // 检测从机应答
                        r_st_done <= 1'b1;
                        if (w_sda_in == 1'b1) begin
                            o_i2c_ack <= 1'b1;
                        end
                    end
                    7'd35: begin
                        o_scl  <= 1'b0;
                        r_cnt  <= 7'd0;
                    end
                    default: ;
                endcase
            end

            S_ADDR_RD: begin              // 发送读操作器件地址
                case (r_cnt)
                    7'd0 : begin              // 重新起始
                        r_sda_dir <= 1'b1;
                        r_sda_out <= 1'b1;
                    end
                    7'd1 : o_scl     <= 1'b1;
                    7'd2 : r_sda_out <= 1'b0; // 重复起始信号
                    7'd3 : o_scl     <= 1'b0;
                    7'd4 : r_sda_out <= P_SLAVE_ADDR[6];
                    7'd5 : o_scl     <= 1'b1;
                    7'd7 : o_scl     <= 1'b0;
                    7'd8 : r_sda_out <= P_SLAVE_ADDR[5];
                    7'd9 : o_scl     <= 1'b1;
                    7'd11: o_scl     <= 1'b0;
                    7'd12: r_sda_out <= P_SLAVE_ADDR[4];
                    7'd13: o_scl     <= 1'b1;
                    7'd15: o_scl     <= 1'b0;
                    7'd16: r_sda_out <= P_SLAVE_ADDR[3];
                    7'd17: o_scl     <= 1'b1;
                    7'd19: o_scl     <= 1'b0;
                    7'd20: r_sda_out <= P_SLAVE_ADDR[2];
                    7'd21: o_scl     <= 1'b1;
                    7'd23: o_scl     <= 1'b0;
                    7'd24: r_sda_out <= P_SLAVE_ADDR[1];
                    7'd25: o_scl     <= 1'b1;
                    7'd27: o_scl     <= 1'b0;
                    7'd28: r_sda_out <= P_SLAVE_ADDR[0];
                    7'd29: o_scl     <= 1'b1;
                    7'd31: o_scl     <= 1'b0;
                    7'd32: r_sda_out <= 1'b1; // 读操作标志(1:读)
                    7'd33: o_scl     <= 1'b1;
                    7'd35: o_scl     <= 1'b0;
                    7'd36: begin               // 切换为输入，等待应答
                        r_sda_dir <= 1'b0;
                        r_sda_out <= 1'b1;
                    end
                    7'd37: o_scl     <= 1'b1;
                    7'd38: begin               // 检测从机应答
                        r_st_done <= 1'b1;
                        if (w_sda_in == 1'b1) begin
                            o_i2c_ack <= 1'b1;
                        end
                    end
                    7'd39: begin
                        o_scl  <= 1'b0;
                        r_cnt  <= 7'd0;
                    end
                    default: ;
                endcase
            end

            S_DATA_RD: begin              // 读8位数据
                case (r_cnt)
                    7'd0 : r_sda_dir <= 1'b0; // 切换为输入
                    7'd1 : begin              // 采样第7位
                        r_data_r[7] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd3 : o_scl     <= 1'b0;
                    7'd5 : begin              // 采样第6位
                        r_data_r[6] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd7 : o_scl     <= 1'b0;
                    7'd9 : begin              // 采样第5位
                        r_data_r[5] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd11: o_scl     <= 1'b0;
                    7'd13: begin              // 采样第4位
                        r_data_r[4] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd15: o_scl     <= 1'b0;
                    7'd17: begin              // 采样第3位
                        r_data_r[3] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd19: o_scl     <= 1'b0;
                    7'd21: begin              // 采样第2位
                        r_data_r[2] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd23: o_scl     <= 1'b0;
                    7'd25: begin              // 采样第1位
                        r_data_r[1] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd27: o_scl     <= 1'b0;
                    7'd29: begin              // 采样第0位
                        r_data_r[0] <= w_sda_in;
                        o_scl       <= 1'b1;
                    end
                    7'd31: o_scl     <= 1'b0;
                    7'd32: begin               // 主机发送非应答
                        r_sda_dir <= 1'b1;
                        r_sda_out <= 1'b1;
                    end
                    7'd33: o_scl     <= 1'b1;
                    7'd34: r_st_done <= 1'b1;  // 读数据完成
                    7'd35: begin               // 保存读数据
                        o_scl        <= 1'b0;
                        r_cnt        <= 7'd0;
                        o_i2c_data_r <= r_data_r;
                    end
                    default: ;
                endcase
            end

            S_STOP: begin                 // 停止I2C操作
                case (r_cnt)
                    7'd0 : begin              // 停止信号起始
                        r_sda_dir <= 1'b1;
                        r_sda_out <= 1'b0;
                    end
                    7'd1 : o_scl     <= 1'b1; // SCL拉高
                    7'd3 : r_sda_out <= 1'b1; // SDA拉高，停止信号
                    7'd15: r_st_done <= 1'b1; // 状态完成
                    7'd16: begin               // 操作完成标志
                        r_cnt        <= 7'd0;
                        o_i2c_done   <= 1'b1;
                    end
                    default: ;
                endcase
            end
        endcase
    end
end
endmodule
```
### vio_uart_prj.cst
```bash
IO_LOC "i_sys_clk" 47;
IO_PORT "i_sys_clk" IO_TYPE=LVCMOS33 PULL_MODE=UP;


IO_LOC "i_sys_rst_n" 13;
IO_PORT "i_sys_rst_n" IO_TYPE=LVCMOS33 PULL_MODE=UP;


IO_LOC "o_iic_scl" 40;
IO_PORT "o_iic_scl" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;
IO_LOC "io_iic_sda" 41;
IO_PORT "io_iic_sda" IO_TYPE=LVCMOS33 PULL_MODE=UP;


IO_LOC "o_led" 9;
IO_PORT "o_led" IO_TYPE=LVCMOS33 PULL_MODE=UP DRIVE=8;



```

### vio_uart_prj.sdc
```bash
create_clock -name i_sys_clk -period 37.037 -waveform {0 18.518} [get_ports {i_sys_clk}]
```