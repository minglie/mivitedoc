# 相关参考
[ModelSim 配合 Makefile 搭建 Verilog 仿真工程](https://blog.csdn.net/qq_26074053/article/details/149445944)

[iverilog-v11-20190809-x64_setup.exe](http://bleyer.org/icarus/iverilog-v11-20190809-x64_setup.exe) 安装

# 目录结构
```bash
PS D:\test\ax301> tree  /f
卷 新加卷 的文件夹 PATH 列表
卷序列号为 1E8A-2CFF
D:.
│  clock_div.v
│  Makefile
│  tb.sv
```
# 命令
## 手动执行
```bash
Windows PowerShell
版权所有（C） Microsoft Corporation。保留所有权利。

安装最新的 PowerShell，了解新功能和改进！https://aka.ms/PSWindows

PS D:\test\ax301> iverilog -g2012 -o sim tb.sv clock_div.v
PS D:\test\ax301> vvp sim
VCD info: dumpfile clock_div.vcd opened for output.
===== Start clk_div simulation (N = 2) =====
===== End clk_div simulation =====
PS D:\test\ax301> gtkwave clock_div.vcd

GTKWave Analyzer v3.3.71 (w)1999-2016 BSI

[0] start time.
[2000000] end time.
```
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/608ffb79228f4b6db5cc66f84b8636a3.png)
## 一步到位
```bash
 make run
```
## 代码更改重新编译
```bash
make clean
make 
# 手动刷新GTKWave
```

## 要保存gtkwave工程,防止选择的信号丢失
```bash
# 打开gtkwave工程文件
make viewGtk
```

# 文件
## clock_div.v
```verilog
`timescale 1ns / 1ps
module clock_div#(
    parameter P_CLK_DIV_CNT = 2 //MAX = 65535
)(
    input    i_clk     ,
    input    i_rst_n     ,
    output   o_clk_div
    );
reg         ro_clk_div ;

reg  [15:0] r_cnt      ;
assign o_clk_div = ro_clk_div;

localparam L_COMPARE_CNT = P_CLK_DIV_CNT/2 - 1;

always @(posedge i_clk or negedge i_rst_n)begin
    if(!i_rst_n)
        r_cnt <= 'd0;
    else if(r_cnt == L_COMPARE_CNT)
        r_cnt <= 'd0;
    else
        r_cnt <= r_cnt + 1;
end

always @(posedge i_clk or negedge i_rst_n)begin
    if(!i_rst_n)
        ro_clk_div <= 'd0;
    else if(r_cnt == L_COMPARE_CNT)
        ro_clk_div <= ~ro_clk_div;
    else
        ro_clk_div <= ro_clk_div;
end

endmodule


```
## tb.sv （生成vcd文件）
```verilog
`timescale 1ns / 1ps

module tb;

    // ---------------------------------
    // 参数：分频系数
    // ---------------------------------
    parameter int P_CLK_DIV_CNT = 2;

    // ---------------------------------
    // 信号声明
    // ---------------------------------
    reg  i_clk;
    reg  i_rstn;
    wire o_clk_div;

    // ---------------------------------
    // 实例化被测模块
    // ---------------------------------
    clock_div #(
        .P_CLK_DIV_CNT(P_CLK_DIV_CNT)
    ) dut (
        .i_clk     (i_clk),
        .i_rst_n   (i_rstn),
        .o_clk_div (o_clk_div)
    );

    // ---------------------------------
    // 生成时钟：50MHz (20ns)
    // ---------------------------------
    initial i_clk = 1'b0;
    always  #10 i_clk = ~i_clk;

    // ---------------------------------
    // 复位过程
    // ---------------------------------
    initial begin
        i_rstn = 1'b0;
        #100;
        i_rstn = 1'b1;
    end

    // ---------------------------------
    // VCD 波形输出（关键）
    // ---------------------------------
    initial begin
        $dumpfile("clock_div.vcd"); // 生成的波形文件名
        $dumpvars(0, tb);           // dump 整个 tb 层级
    end

    // ---------------------------------
    // 仿真时间控制
    // ---------------------------------
    initial begin
        $display("===== Start clk_div simulation (N = %0d) =====",
                  P_CLK_DIV_CNT);

        #2000;

        $display("===== End clk_div simulation =====");
        $finish;
    end

endmodule
```

## Makefile
```bash
# =========================
# Icarus Verilog + GTKWave
# =========================

# 工具
IVERILOG = iverilog
VVP      = vvp
GTKWAVE  = gtkwave

# 文件
TOP_TB   = tb.sv
SRCS     = clock_div.v
SIM      = sim
WAVE     = clock_div.vcd
GTK_PRJ  = clock_div.gtkw

# 默认目标
all: sim wave

# 编译
sim:
	$(IVERILOG) -g2012 -o $(SIM) $(TOP_TB) $(SRCS)

# 仿真（生成 VCD）
wave: sim
	$(VVP) $(SIM)

# 打开 GTKWave
view:
	$(GTKWAVE) $(WAVE)

# 打开GTK工程,防止选择的信号丢失
viewGtk:
	$(GTKWAVE) $(GTK_PRJ)

# 一步到位
run: sim wave view

# 清理
clean:
	del /Q $(SIM) $(WAVE) 2>nul || exit 0

```