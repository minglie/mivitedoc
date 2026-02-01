
# Zynq中级开发七项必修课-第二课：M_AXI_GP0 驱动 AXI-Lite 外设
[目录](Zynq中级开发七项必修课-第零课：目录.md)
# 目标

>- 1.0 设计 AXI-Lite Slave 外设（示例：写入 a，存储 a+1 的“自增 RAM”）  
>- 1.1 通过 `M_AXI_GP0` 在 PS 侧读写该外设，验证数据交互  
# BD图
![在这里插入图片描述](./img/34d94e53e6834b3fbe556b6e127a8877.png)


# 奇怪的RAM,写入的值a,存的却是a+1
```verilog
/**
*  写入的值a,存的却是a+1的奇怪RAM
 * @file axi_lite_slave.v
 * @brief AXI Lite Slave
**/

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
                        mem[write_addr[8:2]] <= s_axi_wdata+1;  // 写入数据
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
        end
    end



endmodule



```

# PS 裸机测试
```c
#include "xil_io.h"
#include "xil_printf.h"
#include <stdio.h>

#define BASE_ADDR       0x43c00000
#define MAX_INDEX       30



void test(u32 addrInx, u32 v) {
    Xil_Out32(BASE_ADDR + 4*addrInx, v);
    u32 retV= Xil_In32(BASE_ADDR + 4*addrInx);
    xil_printf("%d %d  %d\n", addrInx,v,retV);
}




int main() {
    xil_printf("axi_gp_ram test.\n");

    char cmd;
    int index;
    u32 value;


    while (1) {
        xil_printf("> ");
        if (scanf(" %c", &cmd) != 1)
            continue;

        if (cmd == 't' || cmd == 'T') {
        	test(1,2);
        	test(1,5);
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
## 测试结果
测试地址1 写入2 读出3
测试地址1 写入5 读出6
```markdown
[11:09:36.582]发→◇t
□
[11:09:36.584]收←◆1 2  3
1 5  6
> 

```