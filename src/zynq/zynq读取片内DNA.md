# BD
![在这里插入图片描述](./img/049b9b8dc6844d949580e189cf14160c.png)
```bash
#时序约束
create_clock -period 20.000 -name sys_clk [get_ports sys_clk]
#IO引脚约束
set_property -dict {PACKAGE_PIN U18 IOSTANDARD LVCMOS33} [get_ports sys_clk]
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports sys_rst_n]
```

# dna_reader.v
```verilog
/**
    读取DNA的8字节数据
**/
module dna_reader (
    input wire i_clk,
    input wire i_rst_n,
    output reg [56:0] or_dna_value,
    output reg or_done
);

    // DNA_PORT 原语信号
    reg r_read_en;
    reg r_shift_en;
    wire w_dout;

    // 读取 bit 计数
    reg [5:0] r_bit_cnt;

    // 实例化 DNA_PORT 原语
    DNA_PORT #(
        .SIM_DNA_VALUE(57'h123456789ABCDE)  // 仿真用，综合时无效
    ) u_dna (
        .CLK(i_clk),
        .READ(r_read_en),
        .SHIFT(r_shift_en),
        .DOUT(w_dout),
        .DIN(1'b0)
    );

    // 状态机读取 DNA
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_read_en    <= 1'b1;
            r_shift_en   <= 1'b0;
            r_bit_cnt    <= 6'd0;
            or_dna_value  <= 57'd0;
            or_done       <= 1'b0;
        end else if (r_read_en) begin
            r_read_en    <= 1'b0;  // 只拉高一个周期启动读取
            r_shift_en   <= 1'b1;
        end else if (r_shift_en && r_bit_cnt < 57) begin
            or_dna_value <= {or_dna_value[55:0], w_dout};  // 左移一位
            r_bit_cnt   <= r_bit_cnt + 1;
        end else if (r_bit_cnt == 57) begin
            r_shift_en <= 1'b0;
            or_done <= 1'b1;
        end
    end

endmodule
```

# 测试
![在这里插入图片描述](./img/4b6f4ea8d71743eb9df41ce26cbe3258.png)
