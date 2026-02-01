# Zynq中级开发七项必修课-第三课：S_AXI_GP0 主动访问 PS 地址空间


[目录](Zynq中级开发七项必修课-第零课：目录.md)

# 目标

> - 1.0 编写 AXI-Lite Master：按键计数 → 写入 PS 内存  
>  - 1.1 PL 触发中断 → PS 响应并串口打印按键计数值  



# BD图

![alt text](img/S_AXI_GP0.png)

# axi_lite_master.v
``` verilog
// =====================================================
// AXI4-Lite Simple Master (single-shot, non-pipelined)
// - Pure Verilog-2001
// - Robust to 0-cycle / very-fast responses (no miss)
// - Works with SmartConnect / Zynq PS S_AXI_GP*
// =====================================================
module axi_lite_master #(
    parameter ADDR_WIDTH = 32,
    parameter DATA_WIDTH = 32
)(
    input  wire                     clk,
    input  wire                     rst_n,          // active-low reset, sync to clk

    // ---------------- AXI4-Lite Master IF ----------------
    // Write address
    output reg  [ADDR_WIDTH-1:0]    m_axi_awaddr,
    output reg  [2:0]               m_axi_awprot,
    output reg                      m_axi_awvalid,
    input  wire                     m_axi_awready,

    // Write data
    output reg  [DATA_WIDTH-1:0]    m_axi_wdata,
    output reg  [(DATA_WIDTH/8)-1:0] m_axi_wstrb,
    output reg                      m_axi_wvalid,
    input  wire                     m_axi_wready,

    // Write response
    input  wire [1:0]               m_axi_bresp,   // 2'b00=OKAY
    input  wire                     m_axi_bvalid,
    output reg                      m_axi_bready,

    // Read address
    output reg  [ADDR_WIDTH-1:0]    m_axi_araddr,
    output reg  [2:0]               m_axi_arprot,
    output reg                      m_axi_arvalid,
    input  wire                     m_axi_arready,

    // Read data/resp
    input  wire [DATA_WIDTH-1:0]    m_axi_rdata,
    input  wire [1:0]               m_axi_rresp,   // 2'b00=OKAY
    input  wire                     m_axi_rvalid,
    output reg                      m_axi_rready,

    // ---------------- User Side (single request at a time) ---------------
    input  wire                     write_req,     // pulse: 1clk = start one write
    input  wire [ADDR_WIDTH-1:0]    write_addr,
    input  wire [DATA_WIDTH-1:0]    write_data,
    output reg                      write_done,    // pulse: 1clk when write completes
    output reg                      write_err,     // latched for 1clk at done

    input  wire                     read_req,      // pulse: 1clk = start one read
    input  wire [ADDR_WIDTH-1:0]    read_addr,
    output reg  [DATA_WIDTH-1:0]    read_data,
    output reg                      read_done,     // pulse: 1clk when read completes
    output reg                      read_err,      // latched for 1clk at done

    output wire                     busy           // 1=there's an in-flight txn
);

    // ---------------- Edge detect to make interface tolerant to level inputs
    reg wr_req_d, rd_req_d;
    wire wr_pulse = write_req & ~wr_req_d;
    wire rd_pulse = read_req  & ~rd_req_d;

    // In-flight markers (no full FSM needed)
    wire wr_inflight = m_axi_awvalid | m_axi_wvalid | m_axi_bready;
    wire rd_inflight = m_axi_arvalid | m_axi_rready;
    assign busy = wr_inflight | rd_inflight;

    // ---------------- Registers
    localparam [2:0] PROT_DEFAULT = 3'b000;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            wr_req_d       <= 1'b0;
            rd_req_d       <= 1'b0;

            m_axi_awaddr   <= {ADDR_WIDTH{1'b0}};
            m_axi_awprot   <= PROT_DEFAULT;
            m_axi_awvalid  <= 1'b0;

            m_axi_wdata    <= {DATA_WIDTH{1'b0}};
            m_axi_wstrb    <= {(DATA_WIDTH/8){1'b0}};
            m_axi_wvalid   <= 1'b0;

            m_axi_bready   <= 1'b0;

            m_axi_araddr   <= {ADDR_WIDTH{1'b0}};
            m_axi_arprot   <= PROT_DEFAULT;
            m_axi_arvalid  <= 1'b0;

            m_axi_rready   <= 1'b0;

            write_done     <= 1'b0;
            write_err      <= 1'b0;
            read_done      <= 1'b0;
            read_err       <= 1'b0;
            read_data      <= {DATA_WIDTH{1'b0}};
        end else begin
            // sample requests for edge detection
            wr_req_d <= write_req;
            rd_req_d <= read_req;

            // default: clear 1-cycle pulses
            write_done <= 1'b0;
            read_done  <= 1'b0;

            // ============================================================
            // WRITE: fire when wr_pulse && !busy
            // - AW/W raised together; BREADY asserted immediately
            // ============================================================
            if (wr_pulse && !busy) begin
                m_axi_awaddr  <= write_addr;
                m_axi_awprot  <= PROT_DEFAULT;
                m_axi_awvalid <= 1'b1;

                m_axi_wdata   <= write_data;
                m_axi_wstrb   <= {(DATA_WIDTH/8){1'b1}};
                m_axi_wvalid  <= 1'b1;

                m_axi_bready  <= 1'b1;   // ready to accept response ASAP
                write_err     <= 1'b0;   // clear error for new txn
            end

            // AW handshake completes -> drop AWVALID
            if (m_axi_awvalid && m_axi_awready)
                m_axi_awvalid <= 1'b0;

            // W handshake completes -> drop WVALID
            if (m_axi_wvalid && m_axi_wready)
                m_axi_wvalid <= 1'b0;

            // B response: complete write on any cycle handshake occurs
            if (m_axi_bvalid && m_axi_bready) begin
                m_axi_bready <= 1'b0;
                write_done   <= 1'b1;
                write_err    <= (m_axi_bresp != 2'b00); // OKAY=00
            end

            // ============================================================
            // READ: fire when rd_pulse && !busy
            // - AR raised; RREADY asserted immediately
            // ============================================================
            if (rd_pulse && !busy) begin
                m_axi_araddr  <= read_addr;
                m_axi_arprot  <= PROT_DEFAULT;
                m_axi_arvalid <= 1'b1;
                m_axi_rready  <= 1'b1;   // be ready for 0-cycle data
                read_err      <= 1'b0;
            end

            // AR handshake completes -> drop ARVALID
            if (m_axi_arvalid && m_axi_arready)
                m_axi_arvalid <= 1'b0;

            // R data: complete read on any cycle handshake occurs
            if (m_axi_rvalid && m_axi_rready) begin
                m_axi_rready <= 1'b0;
                read_data    <= m_axi_rdata;
                read_done    <= 1'b1;
                read_err     <= (m_axi_rresp != 2'b00); // OKAY=00
            end
        end
    end

endmodule

```

# key_debounce.v
``` verilog
// ============================================================================
// Module name : key_debounce
// Author      : ming
// Description : 按键消抖模块
//               - 按键持续按下超过设定时间后，输出一个时钟周期脉冲
//               - 累计按键按下次数
// Parameters  : P_CLK_FREQ_MHZ - 输入时钟频率 (MHz)
//               P_DEBOUNCE_MS  - 消抖时间 (ms)
//               L_CNT_WIDTH    - 计数器位宽
// ============================================================================

module key_debounce
#(
    parameter P_CLK_FREQ_MHZ = 50,  // 时钟频率 MHz
    parameter P_DEBOUNCE_MS  = 20,  // 消抖时间 ms
    parameter L_CNT_WIDTH    = 32   // 计数器位宽
)
(
    input   wire        i_clk,           // 系统时钟
    input   wire        i_rst_n,         // 全局复位，低有效
    input   wire        i_key,           // 按键输入（低有效）
    output  reg         o_key_pulse,     // 消抖脉冲
    output  reg [31:0]  o_key_pulse_cnt  // 按键次数
);

    // 根据时钟频率和消抖时间计算最大计数值
    localparam L_MAX_CNT = P_CLK_FREQ_MHZ * 1000 * P_DEBOUNCE_MS;
    reg [L_CNT_WIDTH-1:0] r_cnt;

    // 计数器：按键按下计时
    always@(posedge i_clk or negedge i_rst_n)
        if(!i_rst_n)
            r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
        else if(i_key == 1)
            r_cnt <= {(L_CNT_WIDTH+1){1'b0}};
        else if(i_key == 0 && r_cnt < L_MAX_CNT-1)
            r_cnt <= r_cnt + 1'b1;
        else
            r_cnt <= r_cnt;

    // 输出脉冲：稳定按下超过设定时间，输出 1 个时钟周期脉冲
    always@(posedge i_clk or negedge i_rst_n)
        if(!i_rst_n) begin 
            o_key_pulse     <= 1'b0;
            o_key_pulse_cnt <= 32'd0;
        end else if(r_cnt == L_MAX_CNT-2) begin 
            o_key_pulse     <= 1'b1;
            o_key_pulse_cnt <= o_key_pulse_cnt + 1;
        end else
            o_key_pulse <= 1'b0;

endmodule


```

# pulse_rise_counter.v
``` verilog
`timescale 1ns/1ps
// pulse_rise_counter.v — 上升沿计数器（简洁版）
// - 记录 i_sig 的上升沿个数到 o_count
// - 含两级同步，适合异步来源（IO/外设）
// - 计数回卷（溢出后从 0 重新计）
//
// 端口：
//   i_clk   : 时钟
//   i_rst_n : 低有效复位
//   i_sig   : 需要计数的脉冲/电平信号
//   o_count : 上升沿累计计数
module pulse_rise_counter #(
    parameter integer P_WIDTH = 32
)(
    input  wire                 i_clk,
    input  wire                 i_rst_n,
    input  wire                 i_sig,
    output reg  [P_WIDTH-1:0]   o_count
);

    // 两级同步，避免亚稳态
    reg r_sync1, r_sync2;

    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_sync1  <= 1'b0;
            r_sync2  <= 1'b0;
            o_count  <= {P_WIDTH{1'b0}};
        end else begin
            r_sync1 <= i_sig;
            r_sync2 <= r_sync1;

            // 上升沿检测：前一拍0，这一拍1
            if (r_sync1 & ~r_sync2)
                o_count <= o_count + 1'b1;
        end
    end

endmodule

```
# blink_led.v
``` verilog
module blink_led #(
    parameter P_CLK_FREQ  = 50_000_000,   // 时钟频率
    parameter P_BLINK_HZ  = 1             // 闪烁频率
)(
    input   i_clk,
    input   i_rst_n,
    output   o_led
);

    localparam integer L_HALF_CYCLES = P_CLK_FREQ / (2 * P_BLINK_HZ);
    reg [$clog2(L_HALF_CYCLES):0] r_cnt = 0;
    reg r_led;
    assign o_led = r_led;
    always @(posedge i_clk or negedge i_rst_n) begin
        if (!i_rst_n) begin
            r_cnt  <= 0;
            r_led <= 0;
        end else begin
            if (r_cnt == L_HALF_CYCLES - 1) begin
                r_cnt  <= 0;
                r_led <= ~r_led;
            end else begin
                r_cnt <= r_cnt + 1;
            end
        end
    end

endmodule
```

# system.xdc
``` shell

#开发板约束文件

#时序约束
create_clock -period 20.000 -name PL_GCLK [get_ports PL_GCLK]

#IO引脚约束
#----------------------系统时钟---------------------------
set_property -dict {PACKAGE_PIN U18 IOSTANDARD LVCMOS33} [get_ports PL_GCLK]

#----------------------系统复位---------------------------
set_property -dict {PACKAGE_PIN N16 IOSTANDARD LVCMOS33} [get_ports PL_RESET]

#----------------------PL_KEY---------------------------
set_property -dict {PACKAGE_PIN L14 IOSTANDARD LVCMOS33} [get_ports KEY0]
set_property -dict {PACKAGE_PIN K16 IOSTANDARD LVCMOS33} [get_ports KEY1]

#----------------------PL_LED---------------------------
#底板
set_property -dict {PACKAGE_PIN H15 IOSTANDARD LVCMOS33} [get_ports LED0]
set_property -dict {PACKAGE_PIN L15 IOSTANDARD LVCMOS33} [get_ports LED1]

#----------------------PL_UART(RS232)/RS485---------------------------
set_property -dict {PACKAGE_PIN K14 IOSTANDARD LVCMOS33} [get_ports PL_UART_RXD]
set_property -dict {PACKAGE_PIN M15 IOSTANDARD LVCMOS33} [get_ports PL_UART_TXD]



```


# PS 裸机测试
``` c
#include "xil_io.h"
#include "xil_mmu.h"
#include "xil_printf.h"


#include "xparameters.h"
#include "xscugic.h"
#include <stdio.h>
//共享内存基地址
#define SHARE_MEM_BASE  0x01000000U
//S_AXI_GP0 接口写入的集地址
#define BASE_ADDR       0x01000000U
#define MAX_INDEX       30


// ======= PL中断号 =======
#define PL_IRQ_ID61       61
#define GIC_DEVICE_ID 				XPAR_PS7_SCUGIC_0_DEVICE_ID
// GIC 控制器实例
XScuGic intc;
// =============================
// PL 中断服务函数
// 对应 PL 触发的 IRQ 信号 (IRQ_F2P)
// =============================
static void PL_IRQHandler(void *ctx) {
	uintptr_t irq_src = (uintptr_t)ctx;
	static int  irq_cnt=0;
	irq_cnt++;
	xil_printf("PL%d triggered %d!\r\n",irq_src,irq_cnt);


	int regInx=0;
	u32 read_val = Xil_In32(BASE_ADDR + 4 * regInx);
	xil_printf("[r %d] = 0x%08X / %u\r\n", regInx, read_val, read_val);
}

// =============================
// 中断控制器初始化函数
// 配置 GIC，用于使能 PL 触发的中断
// =============================
static int IRQ_Init(void)
{
    int status;
    XScuGic_Config *cfg = XScuGic_LookupConfig(GIC_DEVICE_ID);
    if (!cfg) return XST_FAILURE;
    // 1) 初始化 GIC（只此一次）
    status = XScuGic_CfgInitialize(&intc, cfg, cfg->CpuBaseAddress);
    if (status != XST_SUCCESS) return status;
    // 2) 顶层异常框架（只此一次）
    Xil_ExceptionInit();
    Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_INT,
                                 (Xil_ExceptionHandler)XScuGic_InterruptHandler,
                                 &intc);
    // 3) 触发方式 & 优先级（可选但推荐；数值越小优先级越高）
    // PL 直连 IRQ_F2P 通常上升沿(0x3)，示例优先级 0x80（高于 UART）
    XScuGic_SetPriorityTriggerType(&intc, PL_IRQ_ID61,     0x80, 0x3);
    // 4) 连接中断源
    status = XScuGic_Connect(&intc, PL_IRQ_ID61,
                             (Xil_ExceptionHandler)PL_IRQHandler, (void*)0);
    if (status != XST_SUCCESS) return status;
    // 5) 使能
    XScuGic_Enable(&intc, PL_IRQ_ID61);
    // 6) 全局开中断（只此一次）
    Xil_ExceptionEnable();
    return XST_SUCCESS;
}




int main() {
    xil_printf("S_AXI_GP0  test.\n");
    //直接把 Cortex-A9 的数据缓存（D-Cache）全局关闭。
   // Xil_DCacheDisable();
   //把指定的地址段（通常 1MB 对齐）标记为 “非缓存、可共享” 内存
    Xil_SetTlbAttributes(SHARE_MEM_BASE, NORM_NONCACHE | SHAREABLE);
    IRQ_Init();
    char cmd;
    int index;
    u32 value;
    while (1) {
        xil_printf("> ");
        if (scanf(" %c", &cmd) != 1)
            continue;
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

![alt text](img/S_AXI_GP0_0.png)