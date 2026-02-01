
# AXI-Lite 实现RPC调用硬件函数服务


> 👋 **本文介绍如何基于 AXI-Lite 总线设计一个通用的“硬件函数调用框架”**。主机端（PS）只需通过寄存器写入参数与启动标志，即可触发 PL 模块执行指定算法逻辑，并将结果返回。  
>
> 该机制本质上是一种**硬件层的远程过程调用（RPC）**，在嵌入式/FPGA 系统中具有广泛应用价值，特别适用于：
>
> - 💡 自定义算法逻辑（如加法、乘法、查表）
> - ⚡ 硬件加速模块（如滤波、压缩、比对）
> - 🧱 基于寄存器映射的服务型模块自定义外设
>
AXI-Lite的原理和使用可参考我的另一篇文章：  
> 👉 [《Zynq AXI-Lite 总线原理与实现》](Zynq%20AXI-Lite%20总线原理与实现.md)


---



# BD图
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/0dc97a87778441e29460e706fd034ee5.png)

---

## 📦 系统结构

         ┌──────────────┐
         │   PS 主机    │
         │  (ARM/Linux) │
         └──────┬───────┘
                │AXI-Lite
         ┌──────▼───────┐
         │ axi_lite_slave │ ← 提供寄存器读写接口
         └──────┬───────┘
                │
         ┌──────▼──────────┐
         │  rpc_processor │ ← 执行“函数”调用（如加法）
         └────────────────┘


---

## 🧠 功能简介

- ✅ PS 主机通过 AXI-Lite 写入参数、选择方法、触发执行  
- ✅ PL 模块 `rpc_processor` 根据方法编号执行对应处理（如参数加法）  
- ✅ 支持多个返回值（最多 4 个）  
- ✅ 通过仿真 testbench + PS 代码两种方式调用与验证  

---

## 📐 寄存器定义

| 地址偏移 | 名称           | 作用                      | 位说明                                  |
|----------|----------------|---------------------------|------------------------------------------|
| 0x00     | REG_CTRL       | 控制与状态寄存器          | [0]=start，[1]=ready，[2]=done，[3]=valid |
| 0x04     | REG_METHOD     | 方法编号（功能码）        | 0 = 回显（ECHO），1 = 加法（ADD）        |
| 0x08~0x14| REG_ARG0~3     | 输入参数（共4个）         | 32-bit 输入                              |
| 0x18~0x24| REG_RES0~3     | 输出结果（共4个）         | 32-bit 输出                              |

> 📌 所有寄存器均为 32-bit，支持通过 AXI-Lite 接口进行读写访问。

---
# 寄存器映射表
| mem索引 | 地址偏移 | 寄存器名称 | 说明               |
|---------|----------|-------------|--------------------|
| mem[0]  | 0x00     | REG_CTRL    | 控制/状态          |
| mem[1]  | 0x04     | REG_METHOD  | 方法编号           |
| mem[2]  | 0x08     | REG_ARG0    | 请求参数0          |
| mem[3]  | 0x0C     | REG_ARG1    | 请求参数1          |
| mem[4]  | 0x10     | REG_ARG2    | 请求参数2          |
| mem[5]  | 0x14     | REG_ARG3    | 请求参数3          |
| mem[6]  | 0x18     | REG_RES0    | 响应结果0          |
| mem[7]  | 0x1C     | REG_RES1    | 响应结果1          |
| mem[8]  | 0x20     | REG_RES2    | 响应结果2          |
| mem[9]  | 0x24     | REG_RES3    | 响应结果3          |



# rpc_processor.v
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
    output reg         o_rpc_busy,   // RPC请求有效（处理中保持高）
    input  wire        i_rpc_valid,   // 外部数据有效（1=可接收请求）
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
                    // 检测到启动信号上升沿，且外部数据有效时，启动处理
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
                                o_res_reg_0 <= r_req_latch_0 + r_req_latch_1;
                                o_res_reg_1 <= r_req_latch_2 + r_req_latch_3;
                                o_res_reg_2 <= r_req_latch_0 + r_req_latch_2;
                                o_res_reg_3 <= r_req_latch_1 + r_req_latch_3;
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
# tb_rpc_processor.sv
```verilog
`timescale 1ns/1ps

// 接口定义：抽象DUT的所有信号
interface rpc_if;
    logic         i_clk;
    logic         i_rst_n;
    logic [31:0]  i_method_reg;
    logic [31:0]  i_req_reg_0;
    logic [31:0]  i_req_reg_1;
    logic [31:0]  i_req_reg_2;
    logic [31:0]  i_req_reg_3;
    logic         i_rpc_start;
    logic         i_rpc_valid;
    logic [31:0]  o_res_reg_0;
    logic [31:0]  o_res_reg_1;
    logic [31:0]  o_res_reg_2;
    logic [31:0]  o_res_reg_3;
    logic         o_rpc_busy;
    logic         o_rpc_done;

    // 时钟生成（50MHz，周期20ns）
    initial begin
        i_clk = 1'b0;
        forever #10 i_clk = ~i_clk;
    end
endinterface

// RPC测试类：封装所有测试逻辑
class rpc_tester;
    // 虚拟接口：用于连接DUT
    virtual rpc_if vif;
    
    // 宏定义：RPC方法（与DUT保持一致）
    localparam RPC_FUNC_ECHO = 32'h00000000;
    localparam RPC_FUNC_ADD  = 32'h00000001;

    // 构造函数：绑定接口
    function new(virtual rpc_if ifc);
        vif = ifc;
    endfunction

    // 初始化所有信号
    task initialize();
        vif.i_rst_n = 1'b0;
        vif.i_method_reg = 32'h0;
        vif.i_req_reg_0 = 32'h0;
        vif.i_req_reg_1 = 32'h0;
        vif.i_req_reg_2 = 32'h0;
        vif.i_req_reg_3 = 32'h0;
        vif.i_rpc_start = 1'b0;
        vif.i_rpc_valid = 1'b0;
    endtask

    // 执行复位并等待稳定
    task reset();
        @(posedge vif.i_clk);
        vif.i_rst_n = 1'b0;
        #100;  // 保持复位100ns
        @(posedge vif.i_clk);
        vif.i_rst_n = 1'b1;  // 释放复位
        #20;   // 等待复位释放稳定
    endtask

    // 发送RPC请求并等待完成
    task send_rpc(
        input logic [31:0] method,
        input logic [31:0] req0,
        input logic [31:0] req1,
        input logic [31:0] req2,
        input logic [31:0] req3,
        input logic        ready
    );
        // 设置请求参数
        @(posedge vif.i_clk);
        vif.i_method_reg = method;
        vif.i_req_reg_0 = req0;
        vif.i_req_reg_1 = req1;
        vif.i_req_reg_2 = req2;
        vif.i_req_reg_3 = req3;
        vif.i_rpc_valid = ready;

        // 产生start上升沿
        @(posedge vif.i_clk);
        vif.i_rpc_start = 1'b1;
        @(posedge vif.i_clk);
        vif.i_rpc_start = 1'b0;

        // 等待处理完成（如果ready为1）
        if (ready) begin
            wait(vif.o_rpc_done == 1'b1);
            @(posedge vif.i_clk);
        end
    endtask

    // 验证ADD方法结果
    task verify_add_result(
        input logic [31:0] exp0,
        input logic [31:0] exp1,
        input logic [31:0] exp2,
        input logic [31:0] exp3
    );
        @(posedge vif.i_clk);
        if (vif.o_res_reg_0 == exp0 && vif.o_res_reg_1 == exp1 &&
            vif.o_res_reg_2 == exp2 && vif.o_res_reg_3 == exp3) begin
            $display("ADD method test passed %d",exp0);
        end else begin
            $display("ADD method test failed, Expected: %h %h %h %h, Actual: %h %h %h %h",
                     exp0, exp1, exp2, exp3,
                     vif.o_res_reg_0, vif.o_res_reg_1, vif.o_res_reg_2, vif.o_res_reg_3);
        end
    endtask

    // 运行完整测试序列
    task run_test();
        // 初始化并复位
        initialize();
        reset();

        // 执行ADD方法测试
        send_rpc(
            RPC_FUNC_ADD,
            32'h00000001,  // req0
            32'h00000002,  // req1
            32'h00000003,  // req2
            32'h00000004,  // req3
            1'b1           // ready
        );

        // 验证结果（1+2=3, 3+4=7, 1+3=4, 2+4=6）
        verify_add_result(
            32'h00000003,
            32'h00000007,
            32'h00000004,
            32'h00000006
        );


           // 执行ADD方法测试
        send_rpc(
            RPC_FUNC_ADD,
            32'h00000001,  // req0
            32'h00000002,  // req1
            32'h00000003,  // req2
            32'h00000004,  // req3
            1'b1           // ready
        );

        // 验证结果（1+2=3, 3+4=7, 1+3=4, 2+4=6）
        verify_add_result(
            32'h00000003,
            32'h00000007,
            32'h00000004,
            32'h00000006
        );

        // 测试完成
        #100;
        $display("All tests completed");
        $finish;
    endtask
endclass

// 顶层测试平台
module tb;

    wire w_test;
    // 实例化接口
    rpc_if rpc_ifc();

    // 实例化DUT并连接接口
    rpc_processor uut (
        .i_clk         (rpc_ifc.i_clk),
        .i_rst_n       (rpc_ifc.i_rst_n),
        .i_method_reg  (rpc_ifc.i_method_reg),
        .i_req_reg_0   (rpc_ifc.i_req_reg_0),
        .i_req_reg_1   (rpc_ifc.i_req_reg_1),
        .i_req_reg_2   (rpc_ifc.i_req_reg_2),
        .i_req_reg_3   (rpc_ifc.i_req_reg_3),
        .o_res_reg_0   (rpc_ifc.o_res_reg_0),
        .o_res_reg_1   (rpc_ifc.o_res_reg_1),
        .o_res_reg_2   (rpc_ifc.o_res_reg_2),
        .o_res_reg_3   (rpc_ifc.o_res_reg_3),
        .i_rpc_start   (rpc_ifc.i_rpc_start),
        .o_rpc_busy   (rpc_ifc.o_rpc_busy),
        .i_rpc_valid   (rpc_ifc.i_rpc_valid),
        .o_rpc_done    (rpc_ifc.o_rpc_done)
    );

    // 启动测试
    initial begin
        // 创建测试实例并运行测试
        rpc_tester tester = new(rpc_ifc);
        tester.run_test();
    end
endmodule


```

# axi_lite_slave.v
```verilog
module axi_lite_slave #(
    parameter ADDR_WIDTH = 32,             // 地址总线位宽 Address width
    parameter DATA_WIDTH = 32,             // 数据总线位宽 Data width
    parameter MEM_SIZE   = 1024            // 内部存储器大小（单位：字节） Memory size in bytes
)(
    input  wire                     clk,           // 时钟 Clock
    input  wire                     rst_n,         // 异步复位，低有效 Asynchronous reset, active-low

    // AXI 写地址通道（Write Address Channel）
    input  wire [ADDR_WIDTH-1:0]    s_axi_awaddr,  // 写地址 Write address
    input  wire                     s_axi_awvalid, // 写地址有效 Write address valid
    output reg                      s_axi_awready, // 写地址就绪 Write address ready

    // AXI 写数据通道（Write Data Channel）
    input  wire [DATA_WIDTH-1:0]    s_axi_wdata,   // 写数据 Write data
    input  wire [(DATA_WIDTH/8)-1:0] s_axi_wstrb,  // 写字节使能 Byte enable
    input  wire                     s_axi_wvalid,  // 写数据有效 Write data valid
    output reg                      s_axi_wready,  // 写数据就绪 Write data ready

    // AXI 写响应通道（Write Response Channel）
    output reg  [1:0]               s_axi_bresp,   // 写响应 Write response
    output reg                      s_axi_bvalid,  // 写响应有效 Write response valid
    input  wire                     s_axi_bready,  // 写响应就绪 Write response ready

    // AXI 读地址通道（Read Address Channel）
    input  wire [ADDR_WIDTH-1:0]    s_axi_araddr,  // 读地址 Read address
    input  wire                     s_axi_arvalid, // 读地址有效 Read address valid
    output reg                      s_axi_arready, // 读地址就绪 Read address ready

    // AXI 读数据通道（Read Data Channel）
    output reg  [DATA_WIDTH-1:0]    s_axi_rdata,   // 读数据 Read data
    output reg  [1:0]               s_axi_rresp,   // 读响应 Read response
    output reg                      s_axi_rvalid,  // 读数据有效 Read data valid
    input  wire                     s_axi_rready   // 读数据就绪 Read data ready
);

    // 内部寄存器（寄存器文件，32-bit对齐）
    reg [DATA_WIDTH-1:0] mem [0:(MEM_SIZE/DATA_WIDTH)-1];

    // RPC 处理器输出端口连接线
    wire [31:0] w_res_reg_0, w_res_reg_1, w_res_reg_2, w_res_reg_3;
    wire        w_rpc_done, w_rpc_busy;

    // 状态定义（State definitions）
    localparam IDLE        = 3'd0;
    localparam WRITE_ADDR  = 3'd1;
    localparam WRITE_DATA  = 3'd2;
    localparam WRITE_RESP  = 3'd3;
    localparam READ_ADDR   = 3'd4;
    localparam READ_DATA   = 3'd5;

    reg [2:0] state, next_state;              // 状态寄存器
    reg [ADDR_WIDTH-1:0] write_addr;         // 写地址寄存器
    reg [ADDR_WIDTH-1:0] read_addr;          // 读地址寄存器

    // 状态机：状态跳转逻辑
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            state <= IDLE;
        else
            state <= next_state;
    end

    // 状态机：下一状态逻辑
    always @(*) begin
        next_state = state;
        case (state)
            IDLE: begin
                if (s_axi_awvalid)
                    next_state = WRITE_ADDR;
                else if (s_axi_arvalid)
                    next_state = READ_ADDR;
            end
            WRITE_ADDR: next_state = WRITE_DATA;
            WRITE_DATA: if (s_axi_wvalid) next_state = WRITE_RESP;
            WRITE_RESP: if (s_axi_bready) next_state = IDLE;
            READ_ADDR : next_state = READ_DATA;
            READ_DATA : if (s_axi_rready) next_state = IDLE;
            default   : next_state = IDLE;
        endcase
    end

    // 输出逻辑：AXI 信号 + 寄存器读写
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            // 所有输出复位
            s_axi_awready <= 0;
            s_axi_wready  <= 0;
            s_axi_bresp   <= 0;
            s_axi_bvalid  <= 0;
            s_axi_arready <= 0;
            s_axi_rdata   <= 0;
            s_axi_rresp   <= 0;
            s_axi_rvalid  <= 0;
            write_addr    <= 0;
            read_addr     <= 0;
            //mem 初始化
            mem[0][0] <= 1'b0;
            mem[0][2] <= 1'b0;
            mem[0][3] <= 1'b0;
            mem[6]    <= 32'd0;
            mem[7]    <= 32'd0;
            mem[8]    <= 32'd0;
            mem[9]    <= 32'd0;
            // 模块重编译生效测试
            mem[20]   <= 7624;
        end else begin
            case (state)
                IDLE: begin
                    // 清除所有 ready/valid 信号
                    s_axi_awready <= 0;
                    s_axi_wready  <= 0;
                    s_axi_bvalid  <= 0;
                    s_axi_arready <= 0;
                    s_axi_rvalid  <= 0;
                    // 接收写地址或读地址
                    if (s_axi_awvalid) begin
                        s_axi_awready <= 1;
                        write_addr    <= s_axi_awaddr;
                    end else if (s_axi_arvalid) begin
                        s_axi_arready <= 1;
                        read_addr     <= s_axi_araddr;
                    end
                end
                WRITE_ADDR: begin
                    s_axi_awready <= 0;
                    s_axi_wready  <= 1;   // 等待写数据
                end
                WRITE_DATA: begin
                    if (s_axi_wvalid) begin
                        s_axi_wready <= 0;
                        mem[write_addr[8:2]] <= s_axi_wdata;  // 写入数据
                        s_axi_bresp  <= 2'b00;                // OKAY
                        s_axi_bvalid <= 1;
                    end
                end
                WRITE_RESP: begin
                    if (s_axi_bready)
                        s_axi_bvalid <= 0;
                end
                READ_ADDR: begin
                    s_axi_arready <= 0;
                    s_axi_rdata   <= mem[read_addr[8:2]];     // 读取数据
                    s_axi_rresp   <= 2'b00;                   // OKAY
                    s_axi_rvalid  <= 1;
                end
                READ_DATA: begin
                    if (s_axi_rready)
                        s_axi_rvalid <= 0;
                end
            endcase

            // 每个时钟周期更新 RPC 输出值到寄存器（6~9）
            mem[6] <= w_res_reg_0;
            mem[7] <= w_res_reg_1;
            mem[8] <= w_res_reg_2;
            mem[9] <= w_res_reg_3;
            mem[0][2] <= w_rpc_done;
            mem[0][3] <= w_rpc_busy;
        end
    end

    // 实例化 RPC 处理器模块，连接输入参数和输出结果寄存器
    rpc_processor u_rpc (
        .i_clk        (clk),
        .i_rst_n      (rst_n),
        .i_method_reg (mem[1]),        // 功能号寄存器
        .i_req_reg_0  (mem[2]),        // 参数0
        .i_req_reg_1  (mem[3]),        // 参数1
        .i_req_reg_2  (mem[4]),        // 参数2
        .i_req_reg_3  (mem[5]),        // 参数3
        .o_res_reg_0  (w_res_reg_0),   // 返回值0
        .o_res_reg_1  (w_res_reg_1),   // 返回值1
        .o_res_reg_2  (w_res_reg_2),   // 返回值2
        .o_res_reg_3  (w_res_reg_3),   // 返回值3
        .i_rpc_start  (mem[0][0]),     // 启动标志
        .i_rpc_valid  (mem[0][1]),     // RPC主机方法和参数准备好了
        .o_rpc_done   (w_rpc_done),    // RPC处理完成（1=结果有效）
        .o_rpc_busy  (w_rpc_busy)    // RPC请求有效（处理中保持高）
    );

endmodule

```

# PS 裸机测试
```c
#include "xil_io.h"
#include "xil_printf.h"
#include <stdio.h>

#define BASE_ADDR       0x43c00000
#define MAX_INDEX   30
#define REG_CTRL        (BASE_ADDR + 4*0)
#define REG_METHOD      (BASE_ADDR + 4*1)
#define REG_ARG0        (BASE_ADDR + 4*2)
#define REG_ARG1        (BASE_ADDR + 4*3)
#define REG_ARG2        (BASE_ADDR + 4*4)
#define REG_ARG3        (BASE_ADDR + 4*5)
#define REG_RES0        (BASE_ADDR + 4*6)
#define REG_RES1        (BASE_ADDR + 4*7)
#define REG_RES2        (BASE_ADDR + 4*8)
#define REG_RES3        (BASE_ADDR + 4*9)

#define BIT_RPC_START   (1 << 0)
#define BIT_RPC_READY   (1 << 1)
#define BIT_RPC_DONE    (1 << 2)
#define BIT_RPC_VALID   (1 << 3)

void rpc_call(u32 method, u32 a0, u32 a1, u32 a2, u32 a3) {
    Xil_Out32(REG_METHOD, method);
    Xil_Out32(REG_ARG0, a0);
    Xil_Out32(REG_ARG1, a1);
    Xil_Out32(REG_ARG2, a2);
    Xil_Out32(REG_ARG3, a3);
    Xil_Out32(REG_CTRL, BIT_RPC_READY | BIT_RPC_START);
    int timeout_cnt = 0;
    const int TIMEOUT_MAX = 100;
    while (Xil_In32(REG_CTRL) & BIT_RPC_DONE == 0) {
        if (++timeout_cnt > TIMEOUT_MAX) {
            xil_printf("Timeout: RPC method %d failed.\n", method);
            Xil_Out32(REG_CTRL, 0x00);
            return;
        }
    }
    Xil_Out32(REG_CTRL, 0x00);
    u32 r0 = Xil_In32(REG_RES0);
    u32 r1 = Xil_In32(REG_RES1);
    u32 r2 = Xil_In32(REG_RES2);
    u32 r3 = Xil_In32(REG_RES3);
    xil_printf("RPC method %d result:\n", method);
    xil_printf("  res0 : %d=%d+%d\n", r0,a0,a1);
    xil_printf("  res1 : %d=%d+%d\n", r1,a2,a3);
    xil_printf("  res2 : %d=%d+%d\n", r2,a0,a2);
    xil_printf("  res3 : %d=%d+%d\n", r3,a1,a3);
}


void dump_registers() {
    u32 val;

    xil_printf("AXI Register Dump (HEX + DEC):\n");

    val = Xil_In32(REG_CTRL);
    xil_printf("  mem[0]  REG_CTRL   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_METHOD);
    xil_printf("  mem[1]  REG_METHOD = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_ARG0);
    xil_printf("  mem[2]  REG_ARG0   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_ARG1);
    xil_printf("  mem[3]  REG_ARG1   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_ARG2);
    xil_printf("  mem[4]  REG_ARG2   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_ARG3);
    xil_printf("  mem[5]  REG_ARG3   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_RES0);
    xil_printf("  mem[6]  REG_RES0   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_RES1);
    xil_printf("  mem[7]  REG_RES1   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_RES2);
    xil_printf("  mem[8]  REG_RES2   = 0x%08X  (%10u)\n", val, val);

    val = Xil_In32(REG_RES3);
    xil_printf("  mem[9]  REG_RES3   = 0x%08X  (%10u)\n", val, val);
}


int main() {
    xil_printf("AXI RPC Test Console. Type 't' and press Enter to test.\n");

    char cmd;
    int index;
    u32 value;
    static int p=0;

    while (1) {
        xil_printf("> ");
        if (scanf(" %c", &cmd) != 1)
            continue;

        if (cmd == 't' || cmd == 'T') {

            rpc_call(1, 1, 2, 3, 4);

            rpc_call(1, 10, 20, 30, 40);

            continue;
        }

        switch (cmd)
                {
                    case 'r':
                        if (scanf("%d", &index) == 1)
                        {
                            if (index < 0 || index > MAX_INDEX)
                            {
                                xil_printf("Error: index out of range [0 ~ %d]\r\n", MAX_INDEX);
                                while (getchar() != '\n');
                                continue;
                            }

                            u32 read_val = Xil_In32(BASE_ADDR + 4 * index);
                            xil_printf("[r %d] = 0x%08X / %u\r\n", index, read_val, read_val);
                        }
                        else
                        {
                            xil_printf("Invalid input. Use: r <index>\r\n");
                            while (getchar() != '\n');
                        }
                        break;

                    case 'w':
                        if (scanf("%d %u", &index, &value) == 2)
                        {
                            if (index < 0 || index > MAX_INDEX)
                            {
                                xil_printf("Error: index out of range [0 ~ %d]\r\n", MAX_INDEX);
                                while (getchar() != '\n');
                                continue;
                            }

                            Xil_Out32(BASE_ADDR + 4 * index, value);
                            xil_printf("[w %d] = 0x%08X / %u\r\n", index, value, value);
                        }
                        else
                        {
                            xil_printf("Invalid input. Use: w <index> <value>\r\n");
                            while (getchar() != '\n');
                        }
                        break;
                    case 'l':{
                    	dump_registers();
                    	break;
                    }
                    default:
                        xil_printf("Unknown command '%c'. Use 'r' or 'w'.\r\n", cmd);
                        while (getchar() != '\n');
                        break;
                }
    }

    return 0;
}

```

# 测试结果
```markdown
[16:27:01.812]发→◇t
□
[16:27:01.815]收←◆RPC method 1 result:
  res0 : 3=1+2
  res1 : 7=3+4
  res2 : 4=1+3
  res3 : 6=2+4
RPC method 1 result:
  res0 : 30=10+20
  res1 : 70=30+40
  res2 : 40=10+30
  res3 : 60=20+40
> 
```

# 移植 [AtShell ](https://blog.csdn.net/qq_26074053/article/details/149534940) 测试
###  bsp.h
```h
#ifndef __BSP_H
#define __BSP_H
#include "stdint.h"
#ifdef __cplusplus
extern "C" {
#endif
void BspInit(void);
void BspUartInit();
int  BspUartRead(uint8_t* buf, uint32_t len);
void BspUartWrite(uint8_t* buf, uint32_t len);
uint32_t BspGetMillis();
int Bsp_shell_write(uint8_t* buf, uint32_t len,uint32_t timeout);
#ifdef __cplusplus
}
#endif

#endif
```

### bsp.cpp
```c
#include "bsp.h"
#include "xuartps.h"
#include "xparameters.h"
#include "xscugic.h"
#include "sleep.h"
#include "xtime_l.h"

////////////FifoBuffer开始///////////////
class FifoBuffer
{
protected:
	uint8_t* m_bBuffer;
	uint32_t m_capacity;
	uint8_t  m_iPush;
	uint8_t  m_iPop;


public:
	FifoBuffer(uint16_t   capacity);
	virtual ~FifoBuffer();
	virtual uint32_t  Write(uint8_t* pbuf, uint32_t size);
	virtual uint32_t  Read(uint8_t* pbuf, uint32_t size);
	virtual uint32_t  TotalSize();
	virtual uint32_t  FreeSize();
	virtual void  Reset();
	virtual uint32_t  OccupySize();
};


#include <stdlib.h>
#include <string.h>


FifoBuffer::FifoBuffer(uint16_t   capacity) {
	m_bBuffer = new uint8_t[capacity];
	m_capacity = capacity;
	m_iPush = 0;
	m_iPop = 0;
}

FifoBuffer::~FifoBuffer() {

	delete[] m_bBuffer;
}

uint32_t FifoBuffer::Write(uint8_t* pbuf, uint32_t size) {
	uint32_t w_size = 0, free_size = 0;

	if ((size == 0) || (pbuf == NULL))
	{
		return 0;
	}

	free_size = FreeSize();
	if (free_size == 0)
	{
		return 0;
	}

	if (free_size < size)
	{
		size = free_size;
	}
	w_size = size;
	while (w_size-- > 0)
	{
		m_bBuffer[m_iPush++] = *pbuf++;
		if (m_iPush >= m_capacity)
		{
			m_iPush = 0;
		}
	}
	return size;
}

uint32_t FifoBuffer::Read(uint8_t* pbuf, uint32_t size)
{
	uint32_t r_size = 0, occupy_size = 0;

	if ((size == 0) || (pbuf == NULL))
	{
		return 0;
	}

	occupy_size = OccupySize();
	if (occupy_size == 0)
	{
		return 0;
	}

	if (occupy_size < size)
	{
		size = occupy_size;
	}
	r_size = size;
	while (r_size-- > 0)
	{
		*pbuf++ = m_bBuffer[m_iPop++];
		if (m_iPop >= m_capacity)
		{
			m_iPop = 0;
		}
		occupy_size--;
	}
	return size;
}


void FifoBuffer::Reset()
{
	m_iPush = 0;
	m_iPop = 0;
}


uint32_t FifoBuffer::TotalSize()
{

	return m_capacity;
}

uint32_t FifoBuffer::FreeSize()
{
	uint32_t size;
	size = m_capacity - OccupySize() - 1;
	return size;
}


uint32_t FifoBuffer::OccupySize()
{
	if (m_iPush == m_iPop) {
		return 0;
	}
	if (m_iPush > m_iPop) {
		return m_iPush - m_iPop;
	}
	else {
		return m_iPush + m_capacity - m_iPop;
	}
}

////////////FifoBuffer结束///////////////

static FifoBuffer s_fifoBuffer(512);
#define	UART1_RXBUF_SIZE		256
#define	UART1_TXBUF_SIZE		256

#define GIC_ID 				XPAR_PS7_SCUGIC_0_DEVICE_ID
#define UART_DEVICE_ID		XPAR_XUARTPS_0_DEVICE_ID
#define UART1INIR 			XPAR_XUARTPS_0_INTR

XScuGic xInterruptController;
static XUartPs UartPs;



static u8 UART1_RecBuf[UART1_RXBUF_SIZE];
static u8 UART1_SendBuf[UART1_TXBUF_SIZE];


static void onUartRead(uint8_t* buf, uint32_t len)
{
	s_fifoBuffer.Write(buf, len);
}



static int initSwIntr(){
	int status;
	Xil_ExceptionInit();
	static XScuGic_Config * ScuGicCfgPtr;
	ScuGicCfgPtr = XScuGic_LookupConfig(GIC_ID);
	status = XScuGic_CfgInitialize(&xInterruptController,ScuGicCfgPtr,ScuGicCfgPtr->CpuBaseAddress);
	if(status != XST_SUCCESS){
		return status;
	}
	Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_INT,(Xil_ExceptionHandler)XScuGic_InterruptHandler,&xInterruptController);
	status = XScuGic_Connect(&xInterruptController,UART1INIR,(Xil_ExceptionHandler)XUartPs_InterruptHandler,&UartPs);
	if(status != XST_SUCCESS){
			return status;
	}
	XScuGic_Enable(&xInterruptController,UART1INIR);
	Xil_ExceptionEnable();
	return XST_SUCCESS;
}



static void UartHandler(void *CallBackRef, u32 Event, unsigned int EventData){
	   u32 TotalReceivedCount;
	   int i;
	   if (Event == XUARTPS_EVENT_RECV_DATA) {
			TotalReceivedCount = EventData;
			if(TotalReceivedCount == UART1_RXBUF_SIZE) {
				onUartRead(UART1_RecBuf,TotalReceivedCount);
				XUartPs_Recv(&UartPs, UART1_RecBuf, UART1_RXBUF_SIZE);
				TotalReceivedCount=0;
			}
		}
		if (Event == XUARTPS_EVENT_RECV_TOUT) {
			TotalReceivedCount = EventData;
			onUartRead(UART1_RecBuf,TotalReceivedCount);
			XUartPs_Recv(&UartPs, UART1_RecBuf, UART1_RXBUF_SIZE);
			TotalReceivedCount=0;
		}

	 XUartPs_Recv(&UartPs, UART1_RecBuf, UART1_RXBUF_SIZE);
}


static int inituart(){
	int status;
	u32 IntrMask;
	IntrMask = XUARTPS_IXR_TOUT | XUARTPS_IXR_PARITY | XUARTPS_IXR_FRAMING |
	XUARTPS_IXR_OVER | XUARTPS_IXR_TXEMPTY | XUARTPS_IXR_RXFULL |
	XUARTPS_IXR_RXOVR;
	XUartPs_Config *Config;
	Config = XUartPs_LookupConfig(UART_DEVICE_ID);
	status = XUartPs_CfgInitialize(&UartPs, Config, Config->BaseAddress);
	status = XUartPs_SelfTest(&UartPs);
	XUartPs_SetBaudRate(&UartPs,115200);
	XUartPs_SetHandler(&UartPs,(XUartPs_Handler)UartHandler,&UartPs);
	XUartPs_SetInterruptMask(&UartPs, IntrMask);
	XUartPs_SetOperMode(&UartPs, XUARTPS_OPER_MODE_NORMAL);
	XUartPs_SetRecvTimeout(&UartPs, 20);
	XUartPs_Recv(&UartPs, UART1_RecBuf, 32);
	return status;
}

void BspUartWrite(uint8_t* buf, uint32_t len)
{
  int SentCount = 0;
  while (SentCount < len) {
    SentCount += XUartPs_Send(&UartPs, &buf[SentCount], 1);
  }
  return ;
}

int BspUartRead(uint8_t* buf, uint32_t len){
	uint32_t len1 = s_fifoBuffer.Read(buf, 200);
     return len1;
}

void BspUartInit() {
	int status;
	status = initSwIntr();
	status = inituart();
	if(status != XST_SUCCESS){
		return ;
	}

}

void BspInit(void){
	BspUartInit();
}

int Bsp_shell_write(uint8_t* buf, uint32_t len,uint32_t timeout) {
	 BspUartWrite(buf,len);
	 return 0;
}

uint32_t BspGetMillis(){
	XTime t;
	XTime_GetTime(&t);
	uint32_t ms = (uint32_t)(t / (COUNTS_PER_SECOND / 1000));
	return ms;
}
```
### at_app_write.cpp
```c

#include "AtShell.h"
#include "Bsp.h"
#include "xil_io.h"
#include <stdint.h>
#include <stdlib.h>
#include <ctype.h>

#define BASE_ADDR 0x43c00000u

static inline void wr32(uint32_t idx, uint32_t v){
    Xil_Out32(BASE_ADDR + 4u*idx, v);
}
static inline uint32_t rd32(uint32_t idx){
    return Xil_In32(BASE_ADDR + 4u*idx);
}





static int parse_u32_any(const char* s, uint32_t* out){
    if(!s || !*s) return 0;

    // 支持 0b/0B 二进制
    if( (s[0]=='0') && (s[1]=='b' || s[1]=='B') ){
        uint32_t v = 0;
        const char* p = s+2;
        if(!*p) return 0;
        while(*p){
            if(*p=='_'){ ++p; continue; }      // 允许下划线分隔
            if(*p!='0' && *p!='1') return 0;
            v = (v<<1) | (uint32_t)(*p - '0');
            ++p;
        }
        *out = v;
        return 1;
    }
    // 其余交给 strtoul，base=0 支持 0x.. / 十进制（注意前导 0 可能按八进制）
    char* end = NULL;
    unsigned long ul = strtoul(s, &end, 0);
    if(end==s || *end!='\0') return 0;
    *out = (uint32_t)ul;
    return 1;
}








int at_app_write(int argc, char** argv) {
	    if(argc < 3){
	        AT_printf("Usage: write <idx(dec)> <value(dec|0xhex|0bbin)>\r\n");
	        AT_printf("  eg: write 35 0b101 | write 35 0x1235   | write 35 1235\r\n");
	        return -1;
	    }

	    // 第一个参数：十进制索引
	    char* end = NULL;
	    unsigned long idx_ul = strtoul(argv[1], &end, 10);
	    if(end==argv[1] || *end!='\0'){
	        AT_printf("ERR: bad index (expect decimal): %s\r\n", argv[1]);
	        return -2;
	    }
	    uint32_t idx = (uint32_t)idx_ul;

	    // 第二个参数：值（支持 dec/0x/0b）
	    uint32_t value = 0;
	    if(!parse_u32_any(argv[2], &value)){
	        AT_printf("ERR: bad value: %s\r\n", argv[2]);
	        return -3;
	    }

	    // 写入 + 回读校验
	    wr32(idx, value);
	    uint32_t rb = rd32(idx);
	    AT_printf("W [%u] <= 0x%08X (%u); Rb=0x%08X%s\r\n",
	              (unsigned)idx, value, value, rb,
	              (rb==value ? "" : "  [WARN: mismatch]"));
	    return 0;

}

```

### main.cpp
```c
#include "bsp.h"
#include "AtShell.h"

extern int at_app_write(int argc, char** argv);
extern int at_app_read(int argc, char** argv);

void at_app_init(void)
{
	AT_SHELL_EXPORT(read,read reg, at_app_read);
    AT_SHELL_EXPORT(write,write reg, at_app_write);
}






int main(){
	static uint32_t s_ms_tick=0;
	BspInit();
	at_init(Bsp_shell_write);
    at_app_init();
    at_show_version();
	bool r= PsOpen();
	while (1) {
		uint32_t ms= BspGetMillis();
		if(ms-s_ms_tick>=2){
		   s_ms_tick=ms;
		   int len= BspUartRead((uint8_t *)AT_m_buf, -1);
		   at_import((uint8_t *)AT_m_buf, len, ms);
		}
	}
	return 0;
}

```
### 测试
```
$:0
AtShell commands:
 0.help                 - list cmd
 1.clean                - clean screen
 2.read                 - read reg
 3.write                - write reg
$:3
Usage: write <idx(dec)> <value(dec|0xhex|0bbin)>
  eg: write 35 0b101 | write 35 0x1235   | write 35 1235
$:
```
