# BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/4696a8fa78374d5a822a656d18cd58d2.png)

```bash
#时序约束
create_clock -period 20.000 -name sys_clk [get_ports sys_clk]
#IO引脚约束
#----------------------系统时钟---------------------------
set_property -dict {PACKAGE_PIN U18 IOSTANDARD LVCMOS33} [get_ports sys_clk]
#----------------------系统复位---------------------------
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports sys_rst_n]

## 外部模拟信号 VAUXP0/VAUXN0
set_property PACKAGE_PIN C20 [get_ports vauxp0]
set_property IOSTANDARD LVCMOS33 [get_ports vauxp0]
set_property ANALOG true [get_ports vauxp0]
set_property PACKAGE_PIN B20 [get_ports vauxn0]
set_property IOSTANDARD LVCMOS33 [get_ports vauxn0]
set_property ANALOG true [get_ports vauxn0]
```

#  xadc_pl_reader.v
参考 [ug480_7Series_XADC](https://docs.amd.com/r/en-US/ug480_7Series_XADC/Status-Registers)
```verilog
module xadc_pl_reader (
    input  wire        i_clk,        // 50MHz 系统时钟
    input  wire        i_rst_n,      // 异步复位，低有效
    input  wire        i_vauxp0,     // VAUX0 正端输入
    input  wire        i_vauxn0,     // VAUX0 负端输入
    output reg  [11:0] o_adc_data,   // 12bit ADC 数据
    output reg         o_data_valid, // ADC 数据有效标志
    output wire        o_alm,        // 报警输出
    output wire        o_ot          // 过温报警输出
);

    // -------------------------------------------------
    // DRP 接口信号
    reg  [6:0]  r_drp_addr;
    reg         r_drp_en;
    reg         r_drp_we;
    reg  [15:0] r_drp_di;
    wire [15:0] w_drp_do;
    wire        w_drp_drdy;

    // -------------------------------------------------
    // 状态机状态
    reg [1:0] r_state;
    localparam S_IDLE  = 2'd0,
               S_START = 2'd1,
               S_WAIT  = 2'd2,
               S_READ  = 2'd3;

    // -------------------------------------------------
    // DCLK 分频到 50MHz（XADC DRP 时钟要求 <= 50MHz）
    reg r_dclk_50mhz = 1'b0;
    always @(posedge i_clk) begin
        r_dclk_50mhz <= ~r_dclk_50mhz;
    end

    // -------------------------------------------------
    // XADC IP 实例化
    XADC #(
        .INIT_40(16'h9000),  // 校准系数平均禁用
        .INIT_41(16'h2ef0),  // 外部通道平均16次，连续模式，启用校准
        .INIT_42(16'h0400),  // DCLK 分频4 → 50MHz
        .INIT_48(16'h4701),  // 使能温度、VCCINT、VCCAUX、VCCBRAM
        .INIT_49(16'h0001)   // 使能 VAUX0
    ) u_xadc (
        .CONVST(1'b0),
        .CONVSTCLK(1'b0),
        .DADDR(r_drp_addr),
        .DCLK(r_dclk_50mhz),
        .DEN(r_drp_en),
        .DI(r_drp_di),
        .DWE(r_drp_we),
        .RESET(~i_rst_n),
        .VAUXN({15'd0, i_vauxn0}),  // 只用 VAUX0
        .VAUXP({15'd0, i_vauxp0}),
        .ALM(o_alm),
        .BUSY(),
        .CHANNEL(),
        .DO(w_drp_do),
        .DRDY(w_drp_drdy),
        .EOC(),
        .EOS(),
        .JTAGBUSY(),
        .JTAGLOCKED(),
        .JTAGMODIFIED(),
        .OT(o_ot),
        .MUXADDR(),
        .VP(1'b0),
        .VN(1'b0)
    );

    // -------------------------------------------------
    // XADC DRP 状态机
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_state      <= S_IDLE;
            r_drp_addr   <= 7'd0;
            r_drp_en     <= 1'b0;
            r_drp_we     <= 1'b0;
            r_drp_di     <= 16'd0;
            o_adc_data   <= 12'd0;
            o_data_valid <= 1'b0;
        end else begin
            case (r_state)
                S_IDLE: begin
                    r_drp_en     <= 1'b0;
                    r_drp_we     <= 1'b0;
                    o_data_valid <= 1'b0;
                    r_state      <= S_START;
                end

                S_START: begin
                    r_drp_addr <= 7'h10; // VAUX0 DRP 地址
                    r_drp_en   <= 1'b1;
                    r_drp_we   <= 1'b0;
                    r_state    <= S_WAIT;
                end

                S_WAIT: begin
                    if (w_drp_drdy)
                        r_state <= S_READ;
                end

                S_READ: begin
                    o_adc_data   <= w_drp_do[11:0]; // 12bit ADC 数据
                    o_data_valid <= 1'b1;
                    r_drp_en     <= 1'b0;
                    r_state      <= S_IDLE;
                end
            endcase
        end
    end

endmodule

```

# 测试
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/b4869337a5fc42aaa56d67dee03fc867.png)
