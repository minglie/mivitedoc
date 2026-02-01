
# 📁 项目目录结构
```cs
prj/
├── tb.sv                  # 顶层测试平台
├── clock_div.v            # 分频
└── sims/
    ├── filelist.f         # 所有源文件清单
    ├── Makefile           # 一键编译与仿真脚本
    └── run.do             # ModelSim 自动运行脚本
```

# 📄 filelist.f
列出头文件和参与仿真的所有源文件路径：
```shell
+incdir+../
../clock_div.v
../tb.sv
```

# 📝 run.do（ModelSim 批处理脚本）
```shell
vsim -voptargs=+acc work.tb
add wave -position insertpoint sim:/tb/*
run 10ms
```

# 🛠️ Makefile 自动构建系统
```shell
# 设置变量
work     = work
output   = ./
vsimbatch0 = -do "run -all"

# 编译流程
all: compile vsim

lib:
	@echo "Start compile for Questasim 10.6c"
	vlib $(work)
	vmap work $(work)

vlog:
	vlog -f filelist.f -l $(output)/compile.log

compile: lib vlog

run:
	modelsim -do ./run.do

# 清理生成文件
clean:
	del *.wlf
	del vsim_stacktrace.vstf
	del transcript
	del compile.log
	del modelsim.ini
	rmdir /s /q work
```
# clock_div.v
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
# tb.sv 
```verilog
`timescale 1ns / 1ps

module tb;

    // ---------------------------------
    // 参数：分频系数
    // 可尝试 3（奇数），4（偶数），5（奇数）等
    // ---------------------------------
    parameter P_CLK_DIV_CNT = 2;

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
        .i_clk     (!i_clk),
        .i_rst_n     (i_rstn),
        .o_clk_div (o_clk_div)
    );

    // ---------------------------------
    // 生成时钟：50MHz (周期 = 20ns)
    // ---------------------------------
    initial i_clk = 0;
    always #10 i_clk = ~i_clk;

    // ---------------------------------
    // 复位过程
    // ---------------------------------
    initial begin
        i_rstn = 0;
        #100;           // 保持复位 100ns
        i_rstn = 1;
    end

    // ---------------------------------
    // 仿真时间控制
    // ---------------------------------
    initial begin
        $display("===== Start clk_div_50duty simulation (N = %0d) =====", P_CLK_DIV_CNT);
        #2000;          // 仿真 2000ns
        $display("===== End clk_div_50duty simulation =====");
        $stop;
    end

endmodule
```

# 🖥️ 编译与仿真流程
✅ 初次执行（Windows DOS 控制台）：
```shell
cd sims
make
make run

```
# 🔁 修改代码后，在 ModelSim 控制台执行：
```shell
vlog -f filelist.f; restart -f; run 1ms
```