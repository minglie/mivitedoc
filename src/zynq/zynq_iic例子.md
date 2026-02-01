# tb.v

```verilog

`timescale 1ns / 1ps

module tb;

  reg         Clk;
  reg         Rst_n;
  reg         wrreg_req;
  reg         rdreg_req;
  reg  [15:0] addr;
  reg         addr_mode;
  reg  [7:0]  wrdata;
  wire [7:0]  rddata;
  reg  [7:0]  device_id;
  wire        RW_Done;
  wire        ack;
  wire        i2c_sclk;
  wire        i2c_sdat;
  reg [7:0] last_wrdata;
  reg [7:0] last_rddata;
  reg [15:0] last_addr;
  reg [7:0] last_id;
  reg last_mode;
  reg [7:0] wr_mem [0:65535]; // 保存每个地址的写入数据

  pullup PUP(i2c_sdat);

  i2c_master u_i2c_master(
    .i_clk        (Clk      ),
    .i_rst_n      (Rst_n    ),
    .i_wrreg_req  (wrreg_req),
    .i_rdreg_req  (rdreg_req),
    .i_addr       (addr     ),
    .i_addr_mode  (addr_mode),
    .i_wrdata     (wrdata   ),
    .o_rddata     (rddata   ),
    .i_device_id  (device_id),
    .o_rw_done    (RW_Done  ),
    .o_ack        (ack      ),
    .i_dly_cnt_max(250-1    ),
    .o_i2c_sclk   (i2c_sclk ),
    .io_i2c_sdat  (i2c_sdat )
  );

  //总线上第一个从机，24LC04
  M24LC04B M24LC04B(
    .A0    (1'b0        ),
    .A1    (1'b0        ),
    .A2    (1'b0        ),
    .WP    (1'b0        ),
    .SDA   (i2c_sdat ),
    .SCL   (i2c_sclk ),
    .RESET (~Rst_n   )
  );

  //总线上第二个从机，24LC64
  M24LC64 M24LC64(
    .A0    (1'b1        ),
    .A1    (1'b0        ),
    .A2    (1'b0        ),
    .WP    (1'b0        ),
    .SDA   (i2c_sdat ),
    .SCL   (i2c_sclk ),
    .RESET (~Rst_n   )
  );

  initial Clk = 1;
  always #10 Clk = ~Clk;

  initial begin
    Rst_n = 0;
    rdreg_req = 0;
    wrreg_req = 0;
    #2001;
    Rst_n = 1;
    #2000;

    //读写24LC04,单字节存储地址器件
    write_one_byte(0,8'hA0,16'h0A,8'hd1);
    #50000;
    write_one_byte(0,8'hA0,16'h0B,8'h47);
    #50000;
    write_one_byte(0,8'hA0,16'h0C,8'hd3);
    #50000;
    write_one_byte(0,8'hA0,16'h0F,8'hd4);
    #50000;

    read_one_byte(0,8'hA0,16'h0A);
    read_one_byte(0,8'hA0,16'h0B);
    read_one_byte(0,8'hA0,16'h0C);
    read_one_byte(0,8'hA0,16'h0F);

    #2000000;
    //读写24LC64,2字节存储地址器件
    write_one_byte(1,8'hA2,16'h030A,8'hd1);
    #500000;
    write_one_byte(1,8'hA2,16'h030B,8'hd2);
    #500000;
    write_one_byte(1,8'hA2,16'h030C,8'hd3);
    #500000;
    write_one_byte(1,8'hA2,16'h030F,8'hd4);
    #500000;

    read_one_byte(1,8'hA2,16'h030A);
    read_one_byte(1,8'hA2,16'h030B);
    read_one_byte(1,8'hA2,16'h030C);
    read_one_byte(1,8'hA2,16'h030F);
    $stop;  
  end

  task write_one_byte;
    input mode;
    input [7:0]id;
    input [15:0]mem_address; 
    input [7:0]data;
    begin
      addr = mem_address;
      device_id = id;
      addr_mode = mode;
      wrdata = data;
      wrreg_req = 1;
      #20;
      wrreg_req = 0;
      @(posedge RW_Done);
      #5000000;
      wr_mem[mem_address] = data; // 记录写入数据
      last_wrdata = data;
      last_addr = mem_address;
      last_id = id;
      last_mode = mode;
      $display("WRITE: dev=0x%02X addr=0x%04X mode=%0d data=0x%02X", id, mem_address, mode, data);
    end
  endtask

  task read_one_byte;
    input mode;
    input [7:0]id;
    input [15:0]mem_address; 
    begin
      addr = mem_address;
      device_id = id;
      addr_mode = mode;
      rdreg_req = 1;
      #20;
      rdreg_req = 0;
      @(posedge RW_Done);
      #500000;
      last_rddata = rddata;
      last_addr = mem_address;
      last_id = id;
      last_mode = mode;
      $display("READ : dev=0x%02X addr=0x%04X mode=%0d data=0x%02X", id, mem_address, mode, rddata);
      if (rddata === wr_mem[mem_address])
        $display("PASS: dev=0x%02X addr=0x%04X mode=%0d write=0x%02X read=0x%02X", id, mem_address, mode, wr_mem[mem_address], rddata);
      else
        $display("FAIL: dev=0x%02X addr=0x%04X mode=%0d write=0x%02X read=0x%02X", id, mem_address, mode, wr_mem[mem_address], rddata);
    end
  endtask

endmodule


```

# i2c_master.v

```verilog
/////////////////////////////////////////////////////////////////////////////////
// Module Name   : i2c_master
// Description   : 通用I2C主控模块，支持标准I2C协议，适用于EEPROM等外设的单字节/多字节读写。
//                 采用分层状态机设计，主状态机负责整体流程，bitshift状态机负责I2C时序与数据移位。
//                 代码风格工程化，变量命名清晰，便于维护和扩展。
//
// 参数说明：
//   P_SYS_CLOCK  - 输入时钟频率（Hz），如50_000_000
//   P_SCL_CLOCK  - I2C SCL目标频率（Hz），如100_000
//
// 端口说明：
//   i_clk        - 输入时钟
//   i_rst_n      - 复位，低有效
//   i_wrreg_req  - 写请求，高有效
//   i_rdreg_req  - 读请求，高有效
//   i_addr       - 存储器/外设地址（支持16位）
//   i_addr_mode  - 地址模式，0:单字节，1:双字节
//   i_wrdata     - 待写入数据
//   o_rddata     - 读出数据
//   i_device_id  - I2C从设备ID（含R/W位）
//   o_rw_done    - 读写操作完成标志
//   o_ack        - I2C应答标志
//   i_dly_cnt_max- 读写完成后延迟计数最大值
//   o_i2c_sclk   - I2C SCL输出
//   io_i2c_sdat  - I2C SDA双向
//
// 设计要点：
//   - 支持标准I2C起始、停止、ACK/NACK、单/双字节地址
//   - SDA三态控制，兼容多主机/多从机
//   - SCL分频可调，适配不同速率
//   - 主状态机与bitshift状态机分离，便于维护
//   - 变量命名规范，便于团队协作
/////////////////////////////////////////////////////////////////////////////////
module i2c_master #(
  //系统时钟采用50MHz
  parameter P_SYS_CLOCK = 50_000_000,
  //SCL总线时钟采用100kHz
  parameter P_SCL_CLOCK = 100_000
)
(
  input            i_clk,
  input            i_rst_n,

  input            i_wrreg_req,
  input            i_rdreg_req,
  input     [15:0] i_addr,
  input            i_addr_mode,
  input     [7:0]  i_wrdata,
  output reg[7:0]  o_rddata,
  input     [7:0]  i_device_id,
  output reg       o_rw_done,

  output reg       o_ack,

  input     [31:0] i_dly_cnt_max,
  output reg       o_i2c_sclk,
  inout            io_i2c_sdat
);

  // ===================== 参数与常量 =====================
  localparam L_SCL_CNT_M = P_SYS_CLOCK/P_SCL_CLOCK/4 - 1; // SCL分频计数最大值

  // I2C命令常量
  localparam L_WR   = 6'b000001;   // 写请求
  localparam L_STA  = 6'b000010;   // 起始位请求
  localparam L_RD   = 6'b000100;   // 读请求
  localparam L_STO  = 6'b001000;   // 停止位请求
  localparam L_ACK  = 6'b010000;   // 应答位请求
  localparam L_NACK = 6'b100000;   // 无应答请求

  // Bitshift状态机状态
  localparam S_IDLE      = 8'b00000001; // 空闲
  localparam S_GEN_STA   = 8'b00000010; // 产生起始信号
  localparam S_WR_DATA   = 8'b00000100; // 写数据
  localparam S_RD_DATA   = 8'b00001000; // 读数据
  localparam S_CHECK_ACK = 8'b00010000; // 检查应答
  localparam S_GEN_ACK   = 8'b00100000; // 产生应答
  localparam S_GEN_STO   = 8'b01000000; // 产生停止信号

  // 主状态机状态
  localparam S_IDLE_CTRL         = 8'b0000_0001; // 控制器空闲
  localparam S_WR_REG            = 8'b0000_0010; // 写寄存器
  localparam S_WAIT_WR_DONE      = 8'b0000_0100; // 等待写完成
  localparam S_WR_REG_DONE       = 8'b0000_1000; // 写完成
  localparam S_RD_REG            = 8'b0001_0000; // 读寄存器
  localparam S_WAIT_RD_DONE      = 8'b0010_0000; // 等待读完成
  localparam S_RD_REG_DONE       = 8'b0100_0000; // 读完成
  localparam S_WAIT_DLY          = 8'b1000_0000; // 读写后延迟

  // ========== 变量声明及注释 ==========
  reg [5:0]  r_cmd;         // 当前I2C命令（WR/STA/RD/STO/ACK/NACK）
  reg [7:0]  r_tx_data;     // 待发送数据
  wire [7:0] w_rx_data;     // 接收数据
  wire       w_trans_done;  // bitshift操作完成标志
  wire       w_ack_o;       // bitshift应答信号
  reg        r_go;          // bitshift启动信号
  wire [15:0]w_reg_addr;    // 处理后的寄存器地址

  reg        r_i2c_sdat_oe; // SDA输出使能（1:驱动SDA，0:高阻）
  reg        r_i2c_sdat_o;  // SDA输出值
  reg [19:0] r_div_cnt;     // SCL分频计数器
  reg        r_en_div_cnt;  // SCL分频使能
  reg [7:0]  r_bitshift_state; // bitshift状态机当前状态
  reg [4:0]  r_bitshift_cnt;   // bitshift数据位计数
  reg [7:0]  r_rx_data_int;    // bitshift接收数据缓存
  reg        r_trans_done_int; // bitshift操作完成标志（内部）
  reg        r_ack_o_int;      // bitshift应答信号（内部）

  reg [7:0]  r_state;          // 主状态机当前状态
  reg [7:0]  r_cnt;            // 主状态机步骤计数
  reg [31:0] r_dly_cnt;        // 读写后延迟计数

  assign w_reg_addr = i_addr_mode ? i_addr : {i_addr[7:0], i_addr[15:8]};

  assign io_i2c_sdat = (!r_i2c_sdat_o) && r_i2c_sdat_oe ? 1'b0:1'bz;

  wire w_sclk_plus = r_div_cnt == L_SCL_CNT_M;

  // bitshift状态机
  always@(posedge i_clk or negedge i_rst_n) begin
    if(!i_rst_n) begin
      r_rx_data_int <= 0;
      r_i2c_sdat_oe <= 1'd0;
      r_en_div_cnt <= 1'b0;
      r_i2c_sdat_o <= 1'd1;
      o_i2c_sclk <= 1'd1;
      r_trans_done_int <= 1'b0;
      r_ack_o_int <= 0;
      r_bitshift_state <= S_IDLE;
      r_bitshift_cnt <= 0;
    end else begin
      case(r_bitshift_state)
        S_IDLE: begin
          r_trans_done_int <= 1'b0;
          r_i2c_sdat_oe <= 1'd1;
          if(r_go) begin
            r_en_div_cnt <= 1'b1;
            if(r_cmd & L_STA)
              r_bitshift_state <= S_GEN_STA;
            else if(r_cmd & L_WR)
              r_bitshift_state <= S_WR_DATA;
            else if(r_cmd & L_RD)
              r_bitshift_state <= S_RD_DATA;
            else
              r_bitshift_state <= S_IDLE;
          end else begin
            r_en_div_cnt <= 1'b0;
            r_bitshift_state <= S_IDLE;
          end
        end
        S_GEN_STA: begin
          if(w_sclk_plus) begin
            if(r_bitshift_cnt == 3)
              r_bitshift_cnt <= 0;
            else
              r_bitshift_cnt <= r_bitshift_cnt + 1'b1;
            case(r_bitshift_cnt)
              0:begin r_i2c_sdat_o <= 1; r_i2c_sdat_oe <= 1'd1;end
              1:begin o_i2c_sclk <= 1;end
              2:begin r_i2c_sdat_o <= 0; o_i2c_sclk <= 1;end
              3:begin o_i2c_sclk <= 0;end
              default:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
            endcase
            if(r_bitshift_cnt == 3) begin
              if(r_cmd & L_WR)
                r_bitshift_state <= S_WR_DATA;
              else if(r_cmd & L_RD)
                r_bitshift_state <= S_RD_DATA;
            end
          end
        end
        S_WR_DATA: begin
          if(w_sclk_plus) begin
            if(r_bitshift_cnt == 31)
              r_bitshift_cnt <= 0;
            else
              r_bitshift_cnt <= r_bitshift_cnt + 1'b1;
            case(r_bitshift_cnt)
              0,4,8,12,16,20,24,28:begin r_i2c_sdat_o <= r_tx_data[7-r_bitshift_cnt[4:2]]; r_i2c_sdat_oe <= 1'd1;end
              1,5,9,13,17,21,25,29:begin o_i2c_sclk <= 1;end
              2,6,10,14,18,22,26,30:begin o_i2c_sclk <= 1;end
              3,7,11,15,19,23,27,31:begin o_i2c_sclk <= 0;end
              default:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
            endcase
            if(r_bitshift_cnt == 31) begin
              r_bitshift_state <= S_CHECK_ACK;
            end
          end
        end
        S_RD_DATA: begin
          if(w_sclk_plus) begin
            if(r_bitshift_cnt == 31)
              r_bitshift_cnt <= 0;
            else
              r_bitshift_cnt <= r_bitshift_cnt + 1'b1;
            case(r_bitshift_cnt)
              0,4,8,12,16,20,24,28:begin r_i2c_sdat_oe <= 1'd0; o_i2c_sclk <= 0;end
              1,5,9,13,17,21,25,29:begin o_i2c_sclk <= 1;end
              2,6,10,14,18,22,26,30:begin o_i2c_sclk <= 1; r_rx_data_int <= {r_rx_data_int[6:0],io_i2c_sdat};end
              3,7,11,15,19,23,27,31:begin o_i2c_sclk <= 0;end
              default:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
            endcase
            if(r_bitshift_cnt == 31) begin
              r_bitshift_state <= S_GEN_ACK;
            end
          end
        end
        S_CHECK_ACK: begin
          if(w_sclk_plus) begin
            if(r_bitshift_cnt == 3)
              r_bitshift_cnt <= 0;
            else
              r_bitshift_cnt <= r_bitshift_cnt + 1'b1;
            case(r_bitshift_cnt)
              0:begin r_i2c_sdat_oe <= 1'd0; o_i2c_sclk <= 0;end
              1:begin o_i2c_sclk <= 1;end
              2:begin r_ack_o_int <= io_i2c_sdat; o_i2c_sclk <= 1;end
              3:begin o_i2c_sclk <= 0;end
              default:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
            endcase
            if(r_bitshift_cnt == 3) begin
              if(r_cmd & L_STO)
                r_bitshift_state <= S_GEN_STO;
              else begin
                r_bitshift_state <= S_IDLE;
                r_trans_done_int <= 1'b1;
              end
            end
          end
        end
        S_GEN_ACK: begin
          if(w_sclk_plus) begin
            if(r_bitshift_cnt == 3)
              r_bitshift_cnt <= 0;
            else
              r_bitshift_cnt <= r_bitshift_cnt + 1'b1;
            case(r_bitshift_cnt)
              0:begin 
                  r_i2c_sdat_oe <= 1'd1;
                  o_i2c_sclk <= 0;
                  if(r_cmd & L_ACK)
                    r_i2c_sdat_o <= 1'b0;
                  else if(r_cmd & L_NACK)
                    r_i2c_sdat_o <= 1'b1;
                end
              1:begin o_i2c_sclk <= 1;end
              2:begin o_i2c_sclk <= 1;end
              3:begin o_i2c_sclk <= 0;end
              default:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
            endcase
            if(r_bitshift_cnt == 3) begin
              if(r_cmd & L_STO)
                r_bitshift_state <= S_GEN_STO;
              else begin
                r_bitshift_state <= S_IDLE;
                r_trans_done_int <= 1'b1;
              end
            end
          end
        end
        S_GEN_STO: begin
          if(w_sclk_plus) begin
            if(r_bitshift_cnt == 3)
              r_bitshift_cnt <= 0;
            else
              r_bitshift_cnt <= r_bitshift_cnt + 1'b1;
            case(r_bitshift_cnt)
              0:begin r_i2c_sdat_o <= 0; r_i2c_sdat_oe <= 1'd1;end
              1:begin o_i2c_sclk <= 1;end
              2:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
              3:begin o_i2c_sclk <= 1;end
              default:begin r_i2c_sdat_o <= 1; o_i2c_sclk <= 1;end
            endcase
            if(r_bitshift_cnt == 3) begin
              r_trans_done_int <= 1'b1;
              r_bitshift_state <= S_IDLE;
            end
          end
        end
        default: r_bitshift_state <= S_IDLE;
      endcase
    end
  end

  // SCL分频计数器
  always@(posedge i_clk or negedge i_rst_n)
  if(!i_rst_n)
    r_div_cnt <= 20'd0;
  else if(r_en_div_cnt)begin
    if(r_div_cnt < L_SCL_CNT_M)
      r_div_cnt <= r_div_cnt + 1'b1;
    else
      r_div_cnt <= 0;
  end
  else
    r_div_cnt <= 0;

  // ========== bit_shift输出信号映射 ==========
  assign w_trans_done = r_trans_done_int;
  assign w_ack_o = r_ack_o_int;
  assign w_rx_data = r_rx_data_int;

  always@(posedge i_clk or negedge i_rst_n)
  if(!i_rst_n)begin
    r_cmd <= 6'd0;
    r_tx_data <= 8'd0;
    r_go <= 1'b0;
    o_rddata <= 0;
    r_state <= S_IDLE_CTRL;
    o_ack <= 0;
    r_dly_cnt <= 0;
    r_cnt <= 0;
    o_rw_done <= 1'b0;
  end
  else begin
    case(r_state)
      S_IDLE_CTRL:
        begin
          r_cnt <= 0;
          r_dly_cnt <= 0;
          o_ack <= 0;
          o_rw_done <= 1'b0;
          if(i_wrreg_req)
            r_state <= S_WR_REG;
          else if(i_rdreg_req)
            r_state <= S_RD_REG;
          else
            r_state <= S_IDLE_CTRL;
        end

      S_WR_REG:
        begin
          r_state <= S_WAIT_WR_DONE;
          case(r_cnt)
            0:begin r_cmd <= L_WR | L_STA; r_tx_data <= i_device_id; r_go <= 1'b1; end
            1:begin r_cmd <= L_WR; r_tx_data <= w_reg_addr[15:8]; r_go <= 1'b1; end
            2:begin r_cmd <= L_WR; r_tx_data <= w_reg_addr[7:0]; r_go <= 1'b1; end
            3:begin r_cmd <= L_WR | L_STO; r_tx_data <= i_wrdata; r_go <= 1'b1; end
            default:;
          endcase
        end

      S_WAIT_WR_DONE:
        begin
          r_go <= 1'b0; 
          if(w_trans_done)begin
            o_ack <= o_ack | w_ack_o;
            case(r_cnt)
              0: begin r_cnt <= 1; r_state <= S_WR_REG;end
              1: 
                begin 
                  r_state <= S_WR_REG;
                  if(i_addr_mode)
                    r_cnt <= 2; 
                  else
                    r_cnt <= 3;
                end
              2: begin
                  r_cnt <= 3;
                  r_state <= S_WR_REG;
                end
              3:r_state <= S_WR_REG_DONE;
              default:r_state <= S_IDLE_CTRL;
            endcase
          end
        end

      S_WR_REG_DONE:
        begin
          r_state <= S_WAIT_DLY;
        end

      S_RD_REG:
        begin
          r_state <= S_WAIT_RD_DONE;
          case(r_cnt)
            0:begin r_cmd <= L_WR | L_STA; r_tx_data <= i_device_id; r_go <= 1'b1; end
            1: begin
              if(i_addr_mode)
                begin r_cmd <= L_WR; r_tx_data <= w_reg_addr[15:8]; r_go <= 1'b1; end
              else 
                begin r_cmd <= L_WR | L_STO; r_tx_data <= w_reg_addr[15:8]; r_go <= 1'b1; end
            end
            2:begin r_cmd <= L_WR | L_STO; r_tx_data <= w_reg_addr[7:0]; r_go <= 1'b1; end
            3:begin r_cmd <= L_WR | L_STA; r_tx_data <= i_device_id | 8'd1; r_go <= 1'b1; end
            4:begin r_cmd <= L_RD | L_NACK | L_STO; r_go <= 1'b1; end
            default:;
          endcase
        end

      S_WAIT_RD_DONE:
        begin
          r_go <= 1'b0; 
          if(w_trans_done)begin
            if(r_cnt <= 3)
              o_ack <= o_ack | w_ack_o;
            case(r_cnt)
              0: begin r_cnt <= 1; r_state <= S_RD_REG;end
              1: 
                begin 
                  r_state <= S_RD_REG;
                  if(i_addr_mode)
                    r_cnt <= 2; 
                  else
                    r_cnt <= 3;
                end
              2: begin
                  r_cnt <= 3;
                  r_state <= S_RD_REG;
                end
              3:begin
                  r_cnt <= 4;
                  r_state <= S_RD_REG;
                end
              4:r_state <= S_RD_REG_DONE;
              default:r_state <= S_IDLE_CTRL;
            endcase
          end
        end

      S_RD_REG_DONE:
        begin
          o_rddata <= w_rx_data;
          r_state <= S_WAIT_DLY;
        end
      default:r_state <= S_IDLE_CTRL;
      S_WAIT_DLY:
        begin
          if(r_dly_cnt <= i_dly_cnt_max) begin
            r_dly_cnt <= r_dly_cnt + 1'b1;
            r_state <= S_WAIT_DLY;
          end
         else begin
           r_dly_cnt <= 0;
           o_rw_done <= 1'b1;
           r_state <= S_IDLE_CTRL;
         end
       end
    endcase
  end

endmodule 
```

# M24LC04B.v

```verilog
// *******************************************************************************************************
// **                                                                                                   **
// **   24LC04B.v - Microchip 24LC04B 4K-BIT I2C SERIAL EEPROM (VCC = +2.5V TO +5.5V)                   **
// **                                                                                                   **
// *******************************************************************************************************
// **                                                                                                   **
// **     This information is distributed under license from Young Engineering.                         **
// **                              COPYRIGHT (c) 2003 YOUNG ENGINEERING                                 **
// **                                      ALL RIGHTS RESERVED                                          **
// **                                                                                                   **
// **                                                                                                   **
// **   Young Engineering provides design expertise for the digital world                               **
// **   Started in 1990, Young Engineering offers products and services for your electronic design      **
// **   project.  We have the expertise in PCB, FPGA, ASIC, firmware, and software design.              **
// **   From concept to prototype to production, we can help you.                                       **
// **                                                                                                   **
// **   http://www.young-engineering.com/                                                               **
// **                                                                                                   **
// *******************************************************************************************************
// **   This information is provided to you for your convenience and use with Microchip products only.  **
// **   Microchip disclaims all liability arising from this information and its use.                    **
// **                                                                                                   **
// **   THIS INFORMATION IS PROVIDED "AS IS." MICROCHIP MAKES NO REPRESENTATION OR WARRANTIES OF        **
// **   ANY KIND WHETHER EXPRESS OR IMPLIED, WRITTEN OR ORAL, STATUTORY OR OTHERWISE, RELATED TO        **
// **   THE INFORMATION PROVIDED TO YOU, INCLUDING BUT NOT LIMITED TO ITS CONDITION, QUALITY,           **
// **   PERFORMANCE, MERCHANTABILITY, NON-INFRINGEMENT, OR FITNESS FOR PURPOSE.                         **
// **   MICROCHIP IS NOT LIABLE, UNDER ANY CIRCUMSTANCES, FOR SPECIAL, INCIDENTAL OR CONSEQUENTIAL      **
// **   DAMAGES, FOR ANY REASON WHATSOEVER.                                                             **
// **                                                                                                   **
// **   It is your responsibility to ensure that your application meets with your specifications.       **
// **                                                                                                   **
// *******************************************************************************************************
// **   Revision       : 1.3                                                                            **
// **   Modified Date  : 12/04/2006                                                                      **
// **   Revision History:                                                                               **
// **                                                                                                   **
// **   02/01/2003:  Initial design                                                                     **
// **   07/19/2004:  Fixed the timing checks and the open-drain modeling for SDA.                       **
// **   01/06/2006:  Changed the legal information in the header                                        **
// **   12/04/2006:  Corrected timing checks to reference proper clock edges                            **
// **                Added timing check for Tbuf (bus free time)                                        **
// **                                                                                                   **
// *******************************************************************************************************
// **                                       TABLE OF CONTENTS                                           **
// *******************************************************************************************************
// **---------------------------------------------------------------------------------------------------**
// **   DECLARATIONS                                                                                    **
// **---------------------------------------------------------------------------------------------------**
// **---------------------------------------------------------------------------------------------------**
// **   INITIALIZATION                                                                                  **
// **---------------------------------------------------------------------------------------------------**
// **---------------------------------------------------------------------------------------------------**
// **   CORE LOGIC                                                                                      **
// **---------------------------------------------------------------------------------------------------**
// **   1.01:  START Bit Detection                                                                      **
// **   1.02:  STOP Bit Detection                                                                       **
// **   1.03:  Input Shift Register                                                                     **
// **   1.04:  Input Bit Counter                                                                        **
// **   1.05:  Control Byte Register                                                                    **
// **   1.06:  Byte Address Register                                                                    **
// **   1.07:  Write Data Buffer                                                                        **
// **   1.08:  Acknowledge Generator                                                                    **
// **   1.09:  Acknowledge Detect                                                                       **
// **   1.10:  Write Cycle Timer                                                                        **
// **   1.11:  Write Cycle Processor                                                                    **
// **   1.12:  Read Data Multiplexor                                                                    **
// **   1.13:  Read Data Processor                                                                      **
// **   1.14:  SDA Data I/O Bufferv                                                                     **
// **                                                                                                   **
// **---------------------------------------------------------------------------------------------------**
// **   DEBUG LOGIC                                                                                     **
// **---------------------------------------------------------------------------------------------------**
// **   2.01:  Memory Data Bytes                                                                        **
// **   2.02:  Write Data Buffer                                                                        **
// **                                                                                                   **
// **---------------------------------------------------------------------------------------------------**
// **   TIMING CHECKS                                                                                   **
// **---------------------------------------------------------------------------------------------------**
// **                                                                                                   **
// *******************************************************************************************************


`timescale 1ns/10ps

module M24LC04B (A0, A1, A2, WP, SDA, SCL, RESET);

   input  A0;       // unconnected pin
   input  A1;       // unconnected pin
   input  A2;       // unconnected pin

   input  WP;       // write protect pin

   inout  SDA;      // serial data I/O
   input  SCL;      // serial data clock

   input  RESET;    // system reset


// *******************************************************************************************************
// **   DECLARATIONS                                                                                    **
// *******************************************************************************************************

   reg            SDA_DO;                 // serial data - output
   reg            SDA_OE;                 // serial data - output enable

   wire           SDA_DriveEnable;        // serial data output enable
   reg            SDA_DriveEnableDlyd;    // serial data output enable - delayed

   wire [02:00]   ChipAddress;            // hardwired chip address

   reg  [03:00]   BitCounter;             // serial bit counter

   reg            START_Rcvd;             // START bit received flag
   reg            STOP_Rcvd;              // STOP bit received flag
   reg            CTRL_Rcvd;              // control byte received flag
   reg            ADDR_Rcvd;              // byte address received flag
   reg            MACK_Rcvd;              // master acknowledge received flag

   reg            WrCycle;                // memory write cycle
   reg            RdCycle;                // memory read cycle

   reg  [07:00]   ShiftRegister;          // input data shift register

   reg  [07:00]   ControlByte;            // control byte register
   wire           BlockSelect;            // memory block select
   wire           RdWrBit;                // read/write control bit

   reg  [08:00]   StartAddress;           // memory access starting address
   reg  [03:00]   PageAddress;            // memory page address

   reg  [07:00]   WrDataByte [0:15];      // memory write data buffer
   wire [07:00]   RdDataByte;             // memory read data

   reg  [15:00]   WrCounter;              // write buffer counter

   reg  [03:00]   WrPointer;              // write buffer pointer
   reg  [08:00]   RdPointer;              // read address pointer

   reg            WriteActive;            // memory write cycle active

   reg  [07:00]   MemoryBlock0 [0:255];   // EEPROM data memory array
   reg  [07:00]   MemoryBlock1 [0:255];   // EEPROM data memory array

   integer        LoopIndex;              // iterative loop index

   integer        tAA;                    // timing parameter
   integer        tWC;                    // timing parameter


// *******************************************************************************************************
// **   INITIALIZATION                                                                                  **
// *******************************************************************************************************

   initial tAA = 900;                                   // SCL to SDA output delay
   initial tWC = 5000000;                               // memory write cycle time

   initial begin
      SDA_DO = 0;
      SDA_OE = 0;
   end

   initial begin
      START_Rcvd = 0;
      STOP_Rcvd  = 0;
      CTRL_Rcvd  = 0;
      ADDR_Rcvd  = 0;
      MACK_Rcvd  = 0;
   end

   initial begin
      BitCounter  = 0;
      ControlByte = 0;
   end

   initial begin
      WrCycle = 0;
      RdCycle = 0;

      WriteActive = 0;
   end
   
   assign ChipAddress = {A2,A1,A0};

// *******************************************************************************************************
// **   CORE LOGIC                                                                                      **
// *******************************************************************************************************
// -------------------------------------------------------------------------------------------------------
//      1.01:  START Bit Detection
// -------------------------------------------------------------------------------------------------------

   always @(negedge SDA) begin
      if (SCL == 1) begin
         START_Rcvd <= 1;
         STOP_Rcvd  <= 0;
         CTRL_Rcvd  <= 0;
         ADDR_Rcvd  <= 0;
         MACK_Rcvd  <= 0;

         WrCycle <= #1 0;
         RdCycle <= #1 0;

         BitCounter <= 0;
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.02:  STOP Bit Detection
// -------------------------------------------------------------------------------------------------------

   always @(posedge SDA) begin
      if (SCL == 1) begin
         START_Rcvd <= 0;
         STOP_Rcvd  <= 1;
         CTRL_Rcvd  <= 0;
         ADDR_Rcvd  <= 0;
         MACK_Rcvd  <= 0;

         WrCycle <= #1 0;
         RdCycle <= #1 0;

         BitCounter <= 10;
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.03:  Input Shift Register
// -------------------------------------------------------------------------------------------------------

   always @(posedge SCL) begin
      ShiftRegister[00] <= SDA;
      ShiftRegister[01] <= ShiftRegister[00];
      ShiftRegister[02] <= ShiftRegister[01];
      ShiftRegister[03] <= ShiftRegister[02];
      ShiftRegister[04] <= ShiftRegister[03];
      ShiftRegister[05] <= ShiftRegister[04];
      ShiftRegister[06] <= ShiftRegister[05];
      ShiftRegister[07] <= ShiftRegister[06];
   end

// -------------------------------------------------------------------------------------------------------
//      1.04:  Input Bit Counter
// -------------------------------------------------------------------------------------------------------

   always @(posedge SCL) begin
      if (BitCounter < 10) BitCounter <= BitCounter + 1;
   end

// -------------------------------------------------------------------------------------------------------
//      1.05:  Control Byte Register
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (START_Rcvd & (BitCounter == 8)) begin
         if (!WriteActive & (ShiftRegister[07:01] == {4'b1010,ChipAddress[02:00]})) begin
            if (ShiftRegister[00] == 0) WrCycle <= 1;
            if (ShiftRegister[00] == 1) RdCycle <= 1;

            ControlByte <= ShiftRegister[07:00];

            CTRL_Rcvd <= 1;
         end

         START_Rcvd <= 0;
      end
   end

   assign BlockSelect = ControlByte[01];
   assign RdWrBit     = ControlByte[00];

// -------------------------------------------------------------------------------------------------------
//      1.06:  Byte Address Register
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (CTRL_Rcvd & (BitCounter == 8)) begin
         if (RdWrBit == 0) begin
            StartAddress <= {BlockSelect,ShiftRegister[07:00]};
            RdPointer    <= {BlockSelect,ShiftRegister[07:00]};

            ADDR_Rcvd <= 1;
         end

         WrCounter <= 0;
         WrPointer <= 0;

         CTRL_Rcvd <= 0;
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.07:  Write Data Buffer
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (ADDR_Rcvd & (BitCounter == 8)) begin
         if ((WP == 0) & (RdWrBit == 0)) begin
            WrDataByte[WrPointer] <= ShiftRegister[07:00];

            WrCounter <= WrCounter + 1;
            WrPointer <= WrPointer + 1;
         end
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.08:  Acknowledge Generator
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (!WriteActive) begin
         if (BitCounter == 8) begin
            if (WrCycle | (START_Rcvd & (ShiftRegister[07:01] == {4'b1010,ChipAddress[02:00]}))) begin
               SDA_DO <= 0;
               SDA_OE <= 1;
            end 
         end
         if (BitCounter == 9) begin
            BitCounter <= 0;

            if (!RdCycle) begin
               SDA_DO <= 0;
               SDA_OE <= 0;
            end
         end
      end
   end 

// -------------------------------------------------------------------------------------------------------
//      1.09:  Acknowledge Detect
// -------------------------------------------------------------------------------------------------------

   always @(posedge SCL) begin
      if (RdCycle & (BitCounter == 8)) begin
         if ((SDA == 0) & (SDA_OE == 0)) MACK_Rcvd <= 1;
      end
   end

   always @(negedge SCL) MACK_Rcvd <= 0;

// -------------------------------------------------------------------------------------------------------
//      1.10:  Write Cycle Timer
// -------------------------------------------------------------------------------------------------------

   always @(posedge STOP_Rcvd) begin
      if (WrCycle & (WP == 0) & (WrCounter > 0)) begin
         WriteActive = 1;
         #(tWC);
         WriteActive = 0;
      end
   end

   always @(posedge STOP_Rcvd) begin
      #(1.0);
      STOP_Rcvd = 0;
   end

// -------------------------------------------------------------------------------------------------------
//      1.11:  Write Cycle Processor
// -------------------------------------------------------------------------------------------------------

   always @(negedge WriteActive) begin
      for (LoopIndex = 0; LoopIndex < WrCounter; LoopIndex = LoopIndex + 1) begin
         if (StartAddress[08] == 0) begin
            PageAddress = StartAddress[03:00] + LoopIndex;

            MemoryBlock0[{StartAddress[07:04],PageAddress[03:00]}] = WrDataByte[LoopIndex[03:00]];
         end
         if (StartAddress[08] == 1) begin
            PageAddress = StartAddress[03:00] + LoopIndex;

            MemoryBlock1[{StartAddress[07:04],PageAddress[03:00]}] = WrDataByte[LoopIndex[03:00]];
         end
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.12:  Read Data Multiplexor
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (BitCounter == 8) begin
         if (WrCycle & ADDR_Rcvd) begin
            RdPointer <= StartAddress + WrPointer + 1;
         end
         if (RdCycle) begin
            RdPointer <= RdPointer + 1;
         end
      end
   end

   assign RdDataByte = RdPointer[08] ? MemoryBlock1[RdPointer[07:00]] : MemoryBlock0[RdPointer[07:00]];

// -------------------------------------------------------------------------------------------------------
//      1.13:  Read Data Processor
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (RdCycle) begin
         if (BitCounter == 8) begin
            SDA_DO <= 0;
            SDA_OE <= 0;
         end
         else if (BitCounter == 9) begin
            SDA_DO <= RdDataByte[07];

            if (MACK_Rcvd) SDA_OE <= 1;
         end
         else begin
            SDA_DO <= RdDataByte[7-BitCounter];
         end
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.14:  SDA Data I/O Buffer
// -------------------------------------------------------------------------------------------------------

   bufif1 (SDA, 1'b0, SDA_DriveEnableDlyd);

   assign SDA_DriveEnable = !SDA_DO & SDA_OE;
   always @(SDA_DriveEnable) SDA_DriveEnableDlyd <= #(tAA) SDA_DriveEnable;


// *******************************************************************************************************
// **   DEBUG LOGIC                                                                   **
// *******************************************************************************************************
// -------------------------------------------------------------------------------------------------------
//      2.01:  Memory Data Bytes
// -------------------------------------------------------------------------------------------------------

   wire [07:00]  MemoryByte0_00 = MemoryBlock0[00];
   wire [07:00]  MemoryByte0_01 = MemoryBlock0[01];
   wire [07:00]  MemoryByte0_02 = MemoryBlock0[02];
   wire [07:00]  MemoryByte0_03 = MemoryBlock0[03];
   wire [07:00]  MemoryByte0_04 = MemoryBlock0[04];
   wire [07:00]  MemoryByte0_05 = MemoryBlock0[05];
   wire [07:00]  MemoryByte0_06 = MemoryBlock0[06];
   wire [07:00]  MemoryByte0_07 = MemoryBlock0[07];

   wire [07:00]  MemoryByte0_08 = MemoryBlock0[08];
   wire [07:00]  MemoryByte0_09 = MemoryBlock0[09];
   wire [07:00]  MemoryByte0_0A = MemoryBlock0[10];
   wire [07:00]  MemoryByte0_0B = MemoryBlock0[11];
   wire [07:00]  MemoryByte0_0C = MemoryBlock0[12];
   wire [07:00]  MemoryByte0_0D = MemoryBlock0[13];
   wire [07:00]  MemoryByte0_0E = MemoryBlock0[14];
   wire [07:00]  MemoryByte0_0F = MemoryBlock0[15];

   wire [07:00]  MemoryByte1_00 = MemoryBlock1[00];
   wire [07:00]  MemoryByte1_01 = MemoryBlock1[01];
   wire [07:00]  MemoryByte1_02 = MemoryBlock1[02];
   wire [07:00]  MemoryByte1_03 = MemoryBlock1[03];
   wire [07:00]  MemoryByte1_04 = MemoryBlock1[04];
   wire [07:00]  MemoryByte1_05 = MemoryBlock1[05];
   wire [07:00]  MemoryByte1_06 = MemoryBlock1[06];
   wire [07:00]  MemoryByte1_07 = MemoryBlock1[07];

   wire [07:00]  MemoryByte1_08 = MemoryBlock1[08];
   wire [07:00]  MemoryByte1_09 = MemoryBlock1[09];
   wire [07:00]  MemoryByte1_0A = MemoryBlock1[10];
   wire [07:00]  MemoryByte1_0B = MemoryBlock1[11];
   wire [07:00]  MemoryByte1_0C = MemoryBlock1[12];
   wire [07:00]  MemoryByte1_0D = MemoryBlock1[13];
   wire [07:00]  MemoryByte1_0E = MemoryBlock1[14];
   wire [07:00]  MemoryByte1_0F = MemoryBlock1[15];

// -------------------------------------------------------------------------------------------------------
//      2.02:  Write Data Buffer
// -------------------------------------------------------------------------------------------------------

   wire [07:00]  WriteData_0 = WrDataByte[00];
   wire [07:00]  WriteData_1 = WrDataByte[01];
   wire [07:00]  WriteData_2 = WrDataByte[02];
   wire [07:00]  WriteData_3 = WrDataByte[03];
   wire [07:00]  WriteData_4 = WrDataByte[04];
   wire [07:00]  WriteData_5 = WrDataByte[05];
   wire [07:00]  WriteData_6 = WrDataByte[06];
   wire [07:00]  WriteData_7 = WrDataByte[07];
   wire [07:00]  WriteData_8 = WrDataByte[08];
   wire [07:00]  WriteData_9 = WrDataByte[09];
   wire [07:00]  WriteData_A = WrDataByte[10];
   wire [07:00]  WriteData_B = WrDataByte[11];
   wire [07:00]  WriteData_C = WrDataByte[12];
   wire [07:00]  WriteData_D = WrDataByte[13];
   wire [07:00]  WriteData_E = WrDataByte[14];
   wire [07:00]  WriteData_F = WrDataByte[15];


// *******************************************************************************************************
// **   TIMING CHECKS                                                                 **
// *******************************************************************************************************

   wire TimingCheckEnable = (RESET == 0) & (SDA_OE == 0);

   specify
      specparam
         tHI = 600,                                     // SCL pulse width - high
         tLO = 1300,                                    // SCL pulse width - low
         tSU_STA = 600,                                 // SCL to SDA setup time
         tHD_STA = 600,                                 // SCL to SDA hold time
         tSU_DAT = 100,                                 // SDA to SCL setup time
         tSU_STO = 600,                                 // SCL to SDA setup time
         tBUF = 1300;                                   // Bus free time

      $width (posedge SCL, tHI);
      $width (negedge SCL, tLO);

      $width (posedge SDA &&& SCL, tBUF);

      $setup (posedge SCL, negedge SDA &&& TimingCheckEnable, tSU_STA);
      $setup (SDA, posedge SCL &&& TimingCheckEnable, tSU_DAT);
      $setup (posedge SCL, posedge SDA &&& TimingCheckEnable, tSU_STO);

      $hold  (negedge SDA &&& TimingCheckEnable, negedge SCL, tHD_STA);
   endspecify

endmodule

```
# M24LC64.v
```verilog
// *******************************************************************************************************
// **                                                                                                   **
// **   24LC64.v - Microchip 24LC64 64K-BIT I2C SERIAL EEPROM (VCC = +2.5V TO +5.5V)                    **
// **                                                                                                   **
// *******************************************************************************************************
// **                                                                                                   **
// **                   This information is distributed under license from Young Engineering.           **
// **                              COPYRIGHT (c) 2009 YOUNG ENGINEERING                                 **
// **                                      ALL RIGHTS RESERVED                                          **
// **                                                                                                   **
// **                                                                                                   **
// **   Young Engineering provides design expertise for the digital world                               **
// **   Started in 1990, Young Engineering offers products and services for your electronic design      **
// **   project.  We have the expertise in PCB, FPGA, ASIC, firmware, and software design.              **
// **   From concept to prototype to production, we can help you.                                       **
// **                                                                                                   **
// **   http://www.young-engineering.com/                                                               **
// **                                                                                                   **
// *******************************************************************************************************
// **   This information is provided to you for your convenience and use with Microchip products only.  **
// **   Microchip disclaims all liability arising from this information and its use.                    **
// **                                                                                                   **
// **   THIS INFORMATION IS PROVIDED "AS IS." MICROCHIP MAKES NO REPRESENTATION OR WARRANTIES OF        **
// **   ANY KIND WHETHER EXPRESS OR IMPLIED, WRITTEN OR ORAL, STATUTORY OR OTHERWISE, RELATED TO        **
// **   THE INFORMATION PROVIDED TO YOU, INCLUDING BUT NOT LIMITED TO ITS CONDITION, QUALITY,           **
// **   PERFORMANCE, MERCHANTABILITY, NON-INFRINGEMENT, OR FITNESS FOR PURPOSE.                         **
// **   MICROCHIP IS NOT LIABLE, UNDER ANY CIRCUMSTANCES, FOR SPECIAL, INCIDENTAL OR CONSEQUENTIAL      **
// **   DAMAGES, FOR ANY REASON WHATSOEVER.                                                             **
// **                                                                                                   **
// **   It is your responsibility to ensure that your application meets with your specifications.       **
// **                                                                                                   **
// *******************************************************************************************************
// **   Revision       : 1.4                                                                            **
// **   Modified Date  : 02/04/2009                                                                     **
// **   Revision History:                                                                               **
// **                                                                                                   **
// **   10/01/2003:  Initial design                                                                     **
// **   07/19/2004:  Fixed the timing checks and the open-drain modeling for SDA.                       **
// **   01/06/2006:  Changed the legal information in the header                                        **
// **   12/04/2006:  Corrected timing checks to reference proper clock edges                            **
// **                Added timing check for Tbuf (bus free time)                                        **
// **                Reduced memory blocks to single, monolithic array                                  **
// **   02/04/2009:  Added timing checks for tSU_WP and tHD_WP                                          **
// **                                                                                                   **
// *******************************************************************************************************
// **                                       TABLE OF CONTENTS                                           **
// *******************************************************************************************************
// **---------------------------------------------------------------------------------------------------**
// **   DECLARATIONS                                                                                    **
// **---------------------------------------------------------------------------------------------------**
// **---------------------------------------------------------------------------------------------------**
// **   INITIALIZATION                                                                                  **
// **---------------------------------------------------------------------------------------------------**
// **---------------------------------------------------------------------------------------------------**
// **   CORE LOGIC                                                                                      **
// **---------------------------------------------------------------------------------------------------**
// **   1.01:  START Bit Detection                                                                      **
// **   1.02:  STOP Bit Detection                                                                       **
// **   1.03:  Input Shift Register                                                                     **
// **   1.04:  Input Bit Counter                                                                        **
// **   1.05:  Control Byte Register                                                                    **
// **   1.06:  Byte Address Register                                                                    **
// **   1.07:  Write Data Buffer                                                                        **
// **   1.08:  Acknowledge Generator                                                                    **
// **   1.09:  Acknowledge Detect                                                                       **
// **   1.10:  Write Cycle Timer                                                                        **
// **   1.11:  Write Cycle Processor                                                                    **
// **   1.12:  Read Data Multiplexor                                                                    **
// **   1.13:  Read Data Processor                                                                      **
// **   1.14:  SDA Data I/O Buffer                                                                      **
// **                                                                                                   **
// **---------------------------------------------------------------------------------------------------**
// **   DEBUG LOGIC                                                                                     **
// **---------------------------------------------------------------------------------------------------**
// **   2.01:  Memory Data Bytes                                                                        **
// **   2.02:  Write Data Buffer                                                                        **
// **                                                                                                   **
// **---------------------------------------------------------------------------------------------------**
// **   TIMING CHECKS                                                                                   **
// **---------------------------------------------------------------------------------------------------**
// **                                                                                                   **
// *******************************************************************************************************


`timescale 1ns/10ps

module M24LC64 (A0, A1, A2, WP, SDA, SCL, RESET);

   input                A0;                             // chip select bit
   input                A1;                             // chip select bit
   input                A2;                             // chip select bit

   input                WP;                             // write protect pin

   inout                SDA;                            // serial data I/O
   input                SCL;                            // serial data clock

   input                RESET;                          // system reset


// *******************************************************************************************************
// **   DECLARATIONS                                                                                    **
// *******************************************************************************************************

   reg                  SDA_DO;                         // serial data - output
   reg                  SDA_OE;                         // serial data - output enable

   wire                 SDA_DriveEnable;                // serial data output enable
   reg                  SDA_DriveEnableDlyd;            // serial data output enable - delayed

   wire [02:00]         ChipAddress;                    // hardwired chip address

   reg  [03:00]         BitCounter;                     // serial bit counter

   reg                  START_Rcvd;                     // START bit received flag
   reg                  STOP_Rcvd;                      // STOP bit received flag
   reg                  CTRL_Rcvd;                      // control byte received flag
   reg                  ADHI_Rcvd;                      // byte address hi received flag
   reg                  ADLO_Rcvd;                      // byte address lo received flag
   reg                  MACK_Rcvd;                      // master acknowledge received flag

   reg                  WrCycle;                        // memory write cycle
   reg                  RdCycle;                        // memory read cycle

   reg  [07:00]         ShiftRegister;                  // input data shift register

   reg  [07:00]         ControlByte;                    // control byte register
   wire                 RdWrBit;                        // read/write control bit

   reg  [12:00]         StartAddress;                   // memory access starting address
   reg  [04:00]         PageAddress;                    // memory page address

   reg  [07:00]         WrDataByte [0:31];              // memory write data buffer
   wire [07:00]         RdDataByte;                     // memory read data

   reg  [15:00]         WrCounter;                      // write buffer counter

   reg  [04:00]         WrPointer;                      // write buffer pointer
   reg  [12:00]         RdPointer;                      // read address pointer

   reg                  WriteActive;                    // memory write cycle active

   reg  [07:00]         MemoryBlock [0:8191];           // EEPROM data memory array

   integer              LoopIndex;                      // iterative loop index

   integer              tAA;                            // timing parameter
   integer              tWC;                            // timing parameter


// *******************************************************************************************************
// **   INITIALIZATION                                                                                  **
// *******************************************************************************************************

   initial tAA = 900;                                   // SCL to SDA output delay
   initial tWC = 5000000;                               // memory write cycle time

   initial begin
      SDA_DO = 0;
      SDA_OE = 0;
   end

   initial begin
      START_Rcvd = 0;
      STOP_Rcvd  = 0;
      CTRL_Rcvd  = 0;
      ADHI_Rcvd  = 0;
      ADLO_Rcvd  = 0;
      MACK_Rcvd  = 0;
   end

   initial begin
      BitCounter  = 0;
      ControlByte = 0;
   end

   initial begin
      WrCycle = 0;
      RdCycle = 0;

      WriteActive = 0;
   end

   assign ChipAddress = {A2,A1,A0};


// *******************************************************************************************************
// **   CORE LOGIC                                                                                      **
// *******************************************************************************************************
// -------------------------------------------------------------------------------------------------------
//      1.01:  START Bit Detection
// -------------------------------------------------------------------------------------------------------

   always @(negedge SDA) begin
      if (SCL == 1) begin
         START_Rcvd <= 1;
         STOP_Rcvd  <= 0;
         CTRL_Rcvd  <= 0;
         ADHI_Rcvd  <= 0;
         ADLO_Rcvd  <= 0;
         MACK_Rcvd  <= 0;

         WrCycle <= #1 0;
         RdCycle <= #1 0;

         BitCounter <= 0;
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.02:  STOP Bit Detection
// -------------------------------------------------------------------------------------------------------

   always @(posedge SDA) begin
      if (SCL == 1) begin
         START_Rcvd <= 0;
         STOP_Rcvd  <= 1;
         CTRL_Rcvd  <= 0;
         ADHI_Rcvd  <= 0;
         ADLO_Rcvd  <= 0;
         MACK_Rcvd  <= 0;

         WrCycle <= #1 0;
         RdCycle <= #1 0;

         BitCounter <= 10;
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.03:  Input Shift Register
// -------------------------------------------------------------------------------------------------------

   always @(posedge SCL) begin
      ShiftRegister[00] <= SDA;
      ShiftRegister[01] <= ShiftRegister[00];
      ShiftRegister[02] <= ShiftRegister[01];
      ShiftRegister[03] <= ShiftRegister[02];
      ShiftRegister[04] <= ShiftRegister[03];
      ShiftRegister[05] <= ShiftRegister[04];
      ShiftRegister[06] <= ShiftRegister[05];
      ShiftRegister[07] <= ShiftRegister[06];
   end

// -------------------------------------------------------------------------------------------------------
//      1.04:  Input Bit Counter
// -------------------------------------------------------------------------------------------------------

   always @(posedge SCL) begin
      if (BitCounter < 10) BitCounter <= BitCounter + 1;
   end

// -------------------------------------------------------------------------------------------------------
//      1.05:  Control Byte Register
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (START_Rcvd & (BitCounter == 8)) begin
         if (!WriteActive & (ShiftRegister[07:01] == {4'b1010,ChipAddress[02:00]})) begin
            if (ShiftRegister[00] == 0) WrCycle <= 1;
            if (ShiftRegister[00] == 1) RdCycle <= 1;

            ControlByte <= ShiftRegister[07:00];

            CTRL_Rcvd <= 1;
         end

         START_Rcvd <= 0;
      end
   end

   assign RdWrBit = ControlByte[00];

// -------------------------------------------------------------------------------------------------------
//      1.06:  Byte Address Register
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (CTRL_Rcvd & (BitCounter == 8)) begin
         if (RdWrBit == 0) begin
            StartAddress[12:08] <= ShiftRegister[04:00];
            RdPointer[12:08]    <= ShiftRegister[04:00];

            ADHI_Rcvd <= 1;
         end

         WrCounter <= 0;
         WrPointer <= 0;

         CTRL_Rcvd <= 0;
      end
   end

   always @(negedge SCL) begin
      if (ADHI_Rcvd & (BitCounter == 8)) begin
         if (RdWrBit == 0) begin
            StartAddress[07:00] <= ShiftRegister[07:00];
            RdPointer[07:00]    <= ShiftRegister[07:00];

            ADLO_Rcvd <= 1;
         end

         WrCounter <= 0;
         WrPointer <= 0;

         ADHI_Rcvd <= 0;
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.07:  Write Data Buffer
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (ADLO_Rcvd & (BitCounter == 8)) begin
         if (RdWrBit == 0) begin
            WrDataByte[WrPointer] <= ShiftRegister[07:00];

            WrCounter <= WrCounter + 1;
            WrPointer <= WrPointer + 1;
         end
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.08:  Acknowledge Generator
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (!WriteActive) begin
         if (BitCounter == 8) begin
            if (WrCycle | (START_Rcvd & (ShiftRegister[07:01] == {4'b1010,ChipAddress[02:00]}))) begin
               SDA_DO <= 0;
               SDA_OE <= 1;
            end 
         end
         if (BitCounter == 9) begin
            BitCounter <= 0;

            if (!RdCycle) begin
               SDA_DO <= 0;
               SDA_OE <= 0;
            end
         end
      end
   end 

// -------------------------------------------------------------------------------------------------------
//      1.09:  Acknowledge Detect
// -------------------------------------------------------------------------------------------------------

   always @(posedge SCL) begin
      if (RdCycle & (BitCounter == 8)) begin
         if ((SDA == 0) & (SDA_OE == 0)) MACK_Rcvd <= 1;
      end
   end

   always @(negedge SCL) MACK_Rcvd <= 0;

// -------------------------------------------------------------------------------------------------------
//      1.10:  Write Cycle Timer
// -------------------------------------------------------------------------------------------------------

   always @(posedge STOP_Rcvd) begin
      if (WrCycle & (WP == 0) & (WrCounter > 0)) begin
         WriteActive = 1;
         #(tWC);
         WriteActive = 0;
      end
   end

   always @(posedge STOP_Rcvd) begin
      #(1.0);
      STOP_Rcvd = 0;
   end

// -------------------------------------------------------------------------------------------------------
//      1.11:  Write Cycle Processor
// -------------------------------------------------------------------------------------------------------

   always @(negedge WriteActive) begin
      for (LoopIndex = 0; LoopIndex < WrCounter; LoopIndex = LoopIndex + 1) begin
         PageAddress = StartAddress[04:00] + LoopIndex;

         MemoryBlock[{StartAddress[12:05],PageAddress[04:00]}] = WrDataByte[LoopIndex[04:00]];
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.12:  Read Data Multiplexor
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (BitCounter == 8) begin
         if (WrCycle & ADLO_Rcvd) begin
            RdPointer <= StartAddress + WrPointer + 1;
         end
         if (RdCycle) begin
            RdPointer <= RdPointer + 1;
         end
      end
   end

   assign RdDataByte = MemoryBlock[RdPointer[12:00]];

// -------------------------------------------------------------------------------------------------------
//      1.13:  Read Data Processor
// -------------------------------------------------------------------------------------------------------

   always @(negedge SCL) begin
      if (RdCycle) begin
         if (BitCounter == 8) begin
            SDA_DO <= 0;
            SDA_OE <= 0;
         end
         else if (BitCounter == 9) begin
            SDA_DO <= RdDataByte[07];

            if (MACK_Rcvd) SDA_OE <= 1;
         end
         else begin
            SDA_DO <= RdDataByte[7-BitCounter];
         end
      end
   end

// -------------------------------------------------------------------------------------------------------
//      1.14:  SDA Data I/O Buffer
// -------------------------------------------------------------------------------------------------------

   bufif1 (SDA, 1'b0, SDA_DriveEnableDlyd);

   assign SDA_DriveEnable = !SDA_DO & SDA_OE;
   always @(SDA_DriveEnable) SDA_DriveEnableDlyd <= #(tAA) SDA_DriveEnable;


// *******************************************************************************************************
// **   DEBUG LOGIC                                                                                     **
// *******************************************************************************************************
// -------------------------------------------------------------------------------------------------------
//      2.01:  Memory Data Bytes
// -------------------------------------------------------------------------------------------------------

   wire [07:00] MemoryByte_000 = MemoryBlock[00];
   wire [07:00] MemoryByte_001 = MemoryBlock[01];
   wire [07:00] MemoryByte_002 = MemoryBlock[02];
   wire [07:00] MemoryByte_003 = MemoryBlock[03];
   wire [07:00] MemoryByte_004 = MemoryBlock[04];
   wire [07:00] MemoryByte_005 = MemoryBlock[05];
   wire [07:00] MemoryByte_006 = MemoryBlock[06];
   wire [07:00] MemoryByte_007 = MemoryBlock[07];
   wire [07:00] MemoryByte_008 = MemoryBlock[08];
   wire [07:00] MemoryByte_009 = MemoryBlock[09];
   wire [07:00] MemoryByte_00A = MemoryBlock[10];
   wire [07:00] MemoryByte_00B = MemoryBlock[11];
   wire [07:00] MemoryByte_00C = MemoryBlock[12];
   wire [07:00] MemoryByte_00D = MemoryBlock[13];
   wire [07:00] MemoryByte_00E = MemoryBlock[14];
   wire [07:00] MemoryByte_00F = MemoryBlock[15];

// -------------------------------------------------------------------------------------------------------
//      2.02:  Write Data Buffer
// -------------------------------------------------------------------------------------------------------

   wire [07:00] WriteData_00 = WrDataByte[00];
   wire [07:00] WriteData_01 = WrDataByte[01];
   wire [07:00] WriteData_02 = WrDataByte[02];
   wire [07:00] WriteData_03 = WrDataByte[03];
   wire [07:00] WriteData_04 = WrDataByte[04];
   wire [07:00] WriteData_05 = WrDataByte[05];
   wire [07:00] WriteData_06 = WrDataByte[06];
   wire [07:00] WriteData_07 = WrDataByte[07];
   wire [07:00] WriteData_08 = WrDataByte[08];
   wire [07:00] WriteData_09 = WrDataByte[09];
   wire [07:00] WriteData_0A = WrDataByte[10];
   wire [07:00] WriteData_0B = WrDataByte[11];
   wire [07:00] WriteData_0C = WrDataByte[12];
   wire [07:00] WriteData_0D = WrDataByte[13];
   wire [07:00] WriteData_0E = WrDataByte[14];
   wire [07:00] WriteData_0F = WrDataByte[15];

   wire [07:00] WriteData_10 = WrDataByte[16];
   wire [07:00] WriteData_11 = WrDataByte[17];
   wire [07:00] WriteData_12 = WrDataByte[18];
   wire [07:00] WriteData_13 = WrDataByte[19];
   wire [07:00] WriteData_14 = WrDataByte[20];
   wire [07:00] WriteData_15 = WrDataByte[21];
   wire [07:00] WriteData_16 = WrDataByte[22];
   wire [07:00] WriteData_17 = WrDataByte[23];
   wire [07:00] WriteData_18 = WrDataByte[24];
   wire [07:00] WriteData_19 = WrDataByte[25];
   wire [07:00] WriteData_1A = WrDataByte[26];
   wire [07:00] WriteData_1B = WrDataByte[27];
   wire [07:00] WriteData_1C = WrDataByte[28];
   wire [07:00] WriteData_1D = WrDataByte[29];
   wire [07:00] WriteData_1E = WrDataByte[30];
   wire [07:00] WriteData_1F = WrDataByte[31];


// *******************************************************************************************************
// **   TIMING CHECKS                                                                                   **
// *******************************************************************************************************

   wire TimingCheckEnable = (RESET == 0) & (SDA_OE == 0);
   wire StopTimingCheckEnable = TimingCheckEnable && SCL;

//--------------------------------
//-------仿真时时序约束需改动--------
//--------------------------------
   specify
      specparam
         tHI = 600,                                     // SCL pulse width - high
         tLO = 1300,                                    // SCL pulse width - low
         tSU_STA = 600,                                 // SCL to SDA setup time
         tHD_STA = 600,                                 // SCL to SDA hold time
         tSU_DAT = 100,                                 // SDA to SCL setup time
         tSU_STO = 600,                                 // SCL to SDA setup time
         tSU_WP = 600,                                  // WP to SDA setup time
         tHD_WP = 1300,                                 // WP to SDA hold time
         tBUF = 1300;                                   // Bus free time

      $width (posedge SCL, tHI);
      $width (negedge SCL, tLO);

      $width (posedge SDA &&& SCL, tBUF);

      $setup (posedge SCL, negedge SDA &&& TimingCheckEnable, tSU_STA);
      $setup (SDA, posedge SCL &&& TimingCheckEnable, tSU_DAT);
      $setup (posedge SCL, posedge SDA &&& TimingCheckEnable, tSU_STO);
      $setup (WP, posedge SDA &&& StopTimingCheckEnable, tSU_WP);

      $hold  (negedge SDA &&& TimingCheckEnable, negedge SCL, tHD_STA);
      $hold  (posedge SDA &&& StopTimingCheckEnable, WP, tHD_WP);
   endspecify

endmodule

```