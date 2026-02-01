# 🔌 `vio_uart` 

vio_uart 是一个基于串口通信的内存映射接口模块，其功能类似于 Vivado 中的 VIO IP。
它用于实现主从设备之间的数据采集与控制命令交互。

---
## 📌 两类寄存器
`vio_uart` 提供了 **采集寄存器** 和一个 **控制寄存器**
- `o_acq_gram_x`：模拟采集器寄存器（生成采样数据）
- `i_ctrl_gram_x`：模拟控制器寄存器（接收主控写入的控制命令）

---
## 📥 地址映射

| 类型         | 信号名           | 地址范围    | 描述             |
|--------------|------------------|-------------|------------------|
| 采集寄存器    | `o_acq_gram_x`    | `0 ~ 16`     | 主机读取数据使用   |
| 控制寄存器    | `i_ctrl_gram_x`   | `17 ~ 29`    | 主机写入控制指令   |

---

## 📦 帧格式

通信帧为 **定长 6 字节结构**，主机与从机共用如下格式：

| 字段名称   | 说明                          | 字节数 |
|------------|-------------------------------|--------|
| 读写标志   | `0x00` = 读，`0x01` = 写        | 1 字节 |
| 地址       | 寄存器地址（范围 `0 ~ 29`）     | 1 字节 |
| 数据       | 4 字节有效数据                 | 4 字节 |

> 💡 **说明：**  
> - 读操作时，数据字段可为占位值（无效）。  
> - 写操作时，数据字段为有效控制内容。

---

## 📚 示例帧格式

### ✅ 示例 1：读操作

读取地址 `0x01` 的数据：

| 读写标志 | 地址   | 数据            |
|:--------:|:------:|:----------------:|
| `0x00`   | `0x01` | `00 00 00 00`  |

> 📖 主机请求读取地址 `0x01` 的寄存器，数据字段为占位。

---

### ✅ 示例 2：写操作

向地址 `0x01` 写入 `01 02 03 04`：

| 读写标志 | 地址   | 数据             |
|:--------:|:------:|:----------------:|
| `0x01`   | `0x01` | `01 02 03 04`  |

> ✍️ 主机向地址 `0x01` 写入 4 字节控制数据。

---


# uart_tx.v
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

# uart_rx.v
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


# vio_uart.v
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
    output reg          o_recv_acq_done,  //采集完成
    output reg          o_recv_ctrl_done, //控制完成
    //0:禁用采集  1:启用采集
    input        i_acq_en,
    //采集完成的中断脉冲
    output  reg     o_acq_done_irq_pulse,
    /***  采集  ***/
    output [31:0] o_acq_gram_0,
    output [31:0] o_acq_gram_1,
    output [31:0] o_acq_gram_2,
    output [31:0] o_acq_gram_3,
    output [31:0] o_acq_gram_4,
    output [31:0] o_acq_gram_5,
    output [31:0] o_acq_gram_6,
    output [31:0] o_acq_gram_7,
    output [31:0] o_acq_gram_8,
    output [31:0] o_acq_gram_9,
    output [31:0] o_acq_gram_10,
    output [31:0] o_acq_gram_11,
    output [31:0] o_acq_gram_12,
    output [31:0] o_acq_gram_13,
    output [31:0] o_acq_gram_14,
    output [31:0] o_acq_gram_15,
    output [31:0] o_acq_gram_16,
     /***  控制  ***/
    input [31:0]  i_ctrl_gram_0,//17
    input [31:0]  i_ctrl_gram_1,//18
    input [31:0]  i_ctrl_gram_2,//19
    input [31:0]  i_ctrl_gram_3,//20
    input [31:0]  i_ctrl_gram_4,//21
    input [31:0]  i_ctrl_gram_5,//22
    input [31:0]  i_ctrl_gram_6,//23
    input [31:0]  i_ctrl_gram_7,//24
    input [31:0]  i_ctrl_gram_8,//25
    input [31:0]  i_ctrl_gram_9,//26
    input [31:0]  i_ctrl_gram_10,//27
    input [31:0]  i_ctrl_gram_11,//28
    input [31:0]  i_ctrl_gram_12//29

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
reg [7:0]   r_recv_buffer  [0:P_PACK_LEN-1];
reg [7:0]   r_tx_buffer   [0:P_PACK_LEN-1];
reg [3:0]   r_rx_cnt;
reg [3:0]   r_tx_cnt;
reg [2:0]   r_state;
reg         r_wait_busy;

localparam  S_IDLE = 3'd0,
            S_RECV = 3'd1,
            S_CMD  = 3'd2,
            S_RESP = 3'd3,
            S_SEND = 3'd4;
//0:16是采集,17:29是控制
reg [31:0]  r_gram [0:29];
reg [31:0]  r_resp_data;
reg [7:0]   r_cmd_type;
reg [7:0]   r_cmd_addr;
reg [31:0]  r_cmd_data;


reg [31:0] r_acq_gram_seq;



assign o_acq_gram_0  = r_gram[0];
assign o_acq_gram_1  = r_gram[1];
assign o_acq_gram_2  = r_gram[2];
assign o_acq_gram_3  = r_acq_gram_seq;
assign o_acq_gram_4  = r_gram[4];
assign o_acq_gram_5  = r_gram[5];
assign o_acq_gram_6  = r_gram[6];
assign o_acq_gram_7  = r_gram[7];
assign o_acq_gram_8  = r_gram[8];
assign o_acq_gram_9  = r_gram[9];
assign o_acq_gram_10 = r_gram[10];
assign o_acq_gram_11 = r_gram[11];
assign o_acq_gram_12 = r_gram[12];
assign o_acq_gram_13 = r_gram[13];
assign o_acq_gram_14 = r_gram[14];
assign o_acq_gram_15 = r_gram[15];
assign o_acq_gram_16 = r_gram[16];



integer     idx;
integer      i;
always @(posedge i_clk or negedge i_rst_n) begin
    if (!i_rst_n) begin
        r_rx_cnt    <= 0;
        r_tx_cnt    <= 0;
        r_state     <= S_IDLE;
        r_tx_en     <= 1'b0;
        r_tx_data   <= 8'd0;
        r_wait_busy <= 1'b0;
        o_recv_acq_done <= 1'b0;
        o_recv_ctrl_done <= 1'b0;
        r_gram[0]<=32'h00000002;
        r_gram[1]<=32'h08800040;
        r_gram[2]<=32'h02400007;
        for (i = 4; i <= 17; i = i + 1) begin
            r_gram[i] <= i>9?i-9:i;
        end
    end else begin
        r_tx_en <= 1'b0;
        o_recv_acq_done <=  1'b0;
        o_recv_ctrl_done<=  1'b0;
        case (r_state)
            S_IDLE: begin
                r_rx_cnt    <= 0;
                r_tx_cnt    <= 0;
                r_wait_busy <= 0;
                r_state     <= S_RECV;
                r_gram[3] <=r_acq_gram_seq;
                r_gram[17]<=i_ctrl_gram_0;
                r_gram[18]<=i_ctrl_gram_1;
                r_gram[19]<=i_ctrl_gram_2;
                r_gram[20]<=i_ctrl_gram_3;
                r_gram[21]<=i_ctrl_gram_4;
                r_gram[22]<=i_ctrl_gram_5;
                r_gram[23]<=i_ctrl_gram_6;
                r_gram[24]<=i_ctrl_gram_7;
                r_gram[25]<=i_ctrl_gram_8;
                r_gram[26]<=i_ctrl_gram_9;
                r_gram[27]<=i_ctrl_gram_10;
                r_gram[28]<=i_ctrl_gram_11;
                r_gram[29]<=i_ctrl_gram_12;
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
                        if (r_recv_buffer[0] == 8'h01) begin
                            r_gram[idx] <= {r_recv_buffer[5], r_recv_buffer[4], r_recv_buffer[3], r_recv_buffer[2]};
                            o_recv_acq_done<= 1'b1;
                            r_state <= S_RESP;
                        end else begin
                            r_resp_data <= r_gram[idx];
                            o_recv_ctrl_done<= 1'b1;
                            r_state <= S_SEND;
                       end
                   end
                   else begin
                        r_state <= S_IDLE;
                    end
                end else begin
                    r_state <= S_IDLE;
                end
            end

            S_RESP: begin
                r_resp_data <= r_gram[idx];
                r_state <= S_SEND;
            end

            S_SEND: begin
                r_tx_buffer[0] <= r_cmd_type;
                r_tx_buffer[1] <= r_cmd_addr;
                r_tx_buffer[2] <= r_resp_data[7:0];
                r_tx_buffer[3] <= r_resp_data[15:8];
                r_tx_buffer[4] <= r_resp_data[23:16];
                r_tx_buffer[5] <= r_resp_data[31:24];

                if (!w_tx_busy && !r_wait_busy) begin
                    r_tx_data   <= r_tx_buffer[r_tx_cnt];
                    r_tx_en     <= 1'b1;
                    r_tx_cnt    <= r_tx_cnt + 1;
                    r_wait_busy <= 1'b1;
                end else if (w_tx_busy) begin
                    r_wait_busy <= 1'b0;
                    if (r_tx_cnt == 6)
                        r_state <= S_IDLE;
                end
            end
        endcase
    end
end







    // 每毫秒需要的周期数
    localparam integer CNT_1MS_MAX = P_CLK_FREQ / 1000;

    // 1ms 计数器
    reg [$clog2(CNT_1MS_MAX):0] r_cnt_1ms;
    reg                         r_1ms_pulse;
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_cnt_1ms    <= 0;
            r_1ms_pulse  <= 0;
        end else if (r_cnt_1ms == CNT_1MS_MAX - 1) begin
            r_cnt_1ms    <= 0;
            r_1ms_pulse  <= 1;
        end else begin
            r_cnt_1ms    <= r_cnt_1ms + 1;
            r_1ms_pulse  <= 0;
        end
    end


    //采集序号
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n)
            r_acq_gram_seq <= 0;
        else if (r_1ms_pulse)
            r_acq_gram_seq <= r_acq_gram_seq + 1;
    end




  //产生采集完成的中断脉冲:20us宽的脉冲
  always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            o_acq_done_irq_pulse  <= 0;
        end else if (r_cnt_1ms > CNT_1MS_MAX - 1000 &&  r_cnt_1ms <= CNT_1MS_MAX - 1) begin
            o_acq_done_irq_pulse  <=i_acq_en ? 1:0;
        end else begin
            o_acq_done_irq_pulse  <= 0;
        end
  end



endmodule


```
# 串口回环仿真测试
```verilog
`timescale 1ns/1ps

module tb;
    // 参数
    parameter CLK_PERIOD = 20; // 50MHz
    parameter UART_BPS = 1152000;
    parameter CLK_FREQ = 50000000;

    // 信号定义
    reg i_sys_clk = 0;
    reg i_sys_reset_n = 0;
    reg i_uart_tx_en = 0;
    reg [7:0] i_uart_tx_data = 8'h00;
    wire o_uart_tx_busy;
    wire o_uart_txd;
    wire o_uart_rx_done;
    wire [7:0] o_uart_rx_data;

    // 生成时钟
    always #(CLK_PERIOD/2) i_sys_clk = ~i_sys_clk;

    // 复位
    initial begin
        i_sys_reset_n = 0;
        #200;
        i_sys_reset_n = 1;
    end

    // 实例化 uart_tx
    uart_tx #(
        .P_CLK_FREQ(CLK_FREQ),
        .P_UART_BPS(UART_BPS)
    ) u_uart_tx (
        .i_clk(i_sys_clk),
        .i_rst_n(i_sys_reset_n),
        .i_uart_tx_en(i_uart_tx_en),
        .i_uart_tx_data(i_uart_tx_data),
        .o_uart_tx_busy(o_uart_tx_busy),
        .o_uart_txd(o_uart_txd)
    );

    // 实例化 uart_rx
    uart_rx #(
        .P_CLK_FREQ(CLK_FREQ),
        .P_UART_BPS(UART_BPS)
    ) u_uart_rx (
        .i_clk(i_sys_clk),
        .i_rst_n(i_sys_reset_n),
        .i_uart_rxd(o_uart_txd),
        .o_uart_rx_done(o_uart_rx_done),
        .o_uart_rx_data(o_uart_rx_data)
    );

    // 发送任务
    task send_byte(input [7:0] data);
        begin
            @(negedge i_sys_clk);
            i_uart_tx_data = data;
            i_uart_tx_en = 1;
            @(negedge i_sys_clk);
            i_uart_tx_en = 0;
        end
    endtask

    // 主测试流程
    initial begin
        wait(i_sys_reset_n);
        #1000;
        send_byte(8'hA5);
        wait(o_uart_rx_done);
        #20;
        $display("Send: 0x%02X, Recv: 0x%02X", 8'hA5, o_uart_rx_data);
        if(o_uart_rx_data == 8'hA5)
            $display("UART loopback PASS");
        else
            $display("UART loopback FAIL");
        #100;
        $finish;
    end

endmodule

```

# vio_uart仿真测试
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
    wire [31:0] o_acq_gram_0;

    // 生成时钟
    always #(CLK_PERIOD/2) i_sys_clk = ~i_sys_clk;

    // 复位
    initial begin
        i_sys_reset_n = 0;
        #200;
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
        .i_ctrl_gram_0({KEY4, KEY3, KEY2, KEY1}),
        .o_acq_gram_0(o_acq_gram_0),
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
        // 发送 vio_uart 读命令（如读0x11）
        uart_send_byte(8'h00);
        uart_send_byte(8'h11);
        uart_send_byte(8'h00);
        uart_send_byte(8'h00);
        uart_send_byte(8'h00);
        uart_send_byte(8'h00);
        // 观测 o_uart_txd、o_acq_gram_0、o_recv_acq_done 等
        #60000;
        $finish;
    end
endmodule

```

# vio_uart真机测试
读取板子上的 4 个按键状态信号：
{KEY4, KEY3, KEY2, KEY1}，并将其映射到控制寄存器 i_ctrl_gram_0 中。

| 控制信号名称          | 说明                           |
| --------------- | ---------------------------- |
| `i_ctrl_gram_0` | 控制寄存器，地址为 `0x11`，其低 4 位映射如下： |

i_ctrl_gram_0[3]  ← KEY4  
i_ctrl_gram_0[2]  ← KEY3  
i_ctrl_gram_0[1]  ← KEY2  
i_ctrl_gram_0[0]  ← KEY1

发送 00 11 00  00 00 00
返回 00 11 0B  00 00 00
其中的0B低4位对应到{KEY4, KEY3, KEY2, KEY1}
vio_uart 的o_acq_gram_x 的值是电脑通过发送 00 01 01  02 03 04 写入的

```verilog
module top
(
    input   CLOCK_XTAL_50MHz,
	input   RESET,
	input   KEY4,
	input   KEY3,
	input   KEY2,
	input   KEY1,
    input   RXD,
    output  TXD
);

vio_uart u_vio_uart (
    .i_clk   (CLOCK_XTAL_50MHz),
    .i_rst_n(RESET),
    .i_uart_rxd  (RXD),
    .o_uart_txd  (TXD),
    .i_ctrl_gram_0({KEY4,KEY3,KEY2,KEY1})
);

endmodule
```