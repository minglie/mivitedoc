# Zynq中级开发七项必修课-第六课：AXI DMA (PS→PL) 数据下发


[目录](Zynq中级开发七项必修课-第零课：目录.md)

# 目标
>  - 1.0 编写一个axi_stream_slave 接收来自 ps 的数据
>  - 1.1 数据流入路径 ddr3>axi_dma>axis_data_fifo>axi_stream_slave
>  - 1.2 axi_stream_slave输出累计收到的数据个数
>  - 1.3  ps在MM2S的传输完成中断后,串口打印"TX done"
>  - 1.4  串口助手给PS发送 't'，PS收到't'后，发送新一轮的64个32位数据

# BD图
![](https://i-blog.csdnimg.cn/direct/axi_dma_ps_pl_bd.png)
![](https://i-blog.csdnimg.cn/direct/axi_dma_ps_pl_0.png)


# axi_stream_slave.v

```verilog
`timescale 1 ns / 1 ps

module axi_stream_slave #
(
    // AXI4Stream sink: Data Width
    parameter integer C_S_AXIS_TDATA_WIDTH = 32
)
(
    // ===== Users to add ports here =====
    input  wire        i_clr,                // 同步清零（打一拍即可）
    output reg [31:0]  o_total_beats,        // 累计 beat 数
    output reg [63:0]  o_total_bytes,        // 累计字节数（按 TSTRB 统计）
    output reg [31:0]  o_frame_bytes,        // 最近一帧字节数（在 TLAST 时更新）
    output reg         o_frame_done_pulse,   // 最近一帧结束脉冲（1 个 ACLK）
    // ===== Users ports ends =====

    // AXI4Stream sink: Clock
    input  wire                               S_AXIS_ACLK,
    // AXI4Stream sink: Reset (active-low)
    input  wire                               S_AXIS_ARESETN,
    // Ready to accept data in
    output wire                               S_AXIS_TREADY,
    // Data in
    input  wire [C_S_AXIS_TDATA_WIDTH-1 : 0]  S_AXIS_TDATA,
    // Byte qualifier
    input  wire [(C_S_AXIS_TDATA_WIDTH/8)-1:0] S_AXIS_TSTRB,
    // Indicates boundary of last packet
    input  wire                               S_AXIS_TLAST,
    // Data is in valid
    input  wire                               S_AXIS_TVALID
);

    // =========================
    // 简洁实现：始终就绪（无回压）
    // =========================
    assign S_AXIS_TREADY = 1'b1;

    // 本帧累计字节
    reg [31:0] r_frame_bytes_acc;

    // 计算本拍有效字节数 = popcount(TSTRB)
    function [8:0] f_popcount8;
        input [7:0] v;
        integer i;
        begin
            f_popcount8 = 0;
            for (i = 0; i < 8; i = i + 1)
                f_popcount8 = f_popcount8 + v[i];
        end
    endfunction

    // 根据数据宽度动态求本拍字节数
    wire [15:0] w_bytes_this_beat;
    generate
        if (C_S_AXIS_TDATA_WIDTH == 32) begin : G_PC_32
            assign w_bytes_this_beat = f_popcount8({4'b0, S_AXIS_TSTRB}); // 低 4 位有效
        end else if (C_S_AXIS_TDATA_WIDTH == 64) begin : G_PC_64
            wire [8:0] a = f_popcount8(S_AXIS_TSTRB[7:0]);
            assign w_bytes_this_beat = a;
        end else begin : G_PC_GEN // 通用：按每 8bit 分组做 popcount
            // 拆成多个 8bit 组累加
            integer gi;
            reg [15:0] sum;
            always @(*) begin
                sum = 0;
                for (gi = 0; gi < (C_S_AXIS_TDATA_WIDTH/8); gi = gi + 1)
                    sum = sum + S_AXIS_TSTRB[gi];
            end
            assign w_bytes_this_beat = sum;
        end
    endgenerate

    // 计数与帧逻辑
    always @(posedge S_AXIS_ACLK) begin
        if (!S_AXIS_ARESETN) begin
            o_total_beats        <= 32'd0;
            o_total_bytes        <= 64'd0;
            o_frame_bytes        <= 32'd0;
            o_frame_done_pulse   <= 1'b0;
            r_frame_bytes_acc    <= 32'd0;
        end else begin
            o_frame_done_pulse <= 1'b0; // 默认无脉冲

            // 同步清零
            if (i_clr) begin
                o_total_beats      <= 32'd0;
                o_total_bytes      <= 64'd0;
                o_frame_bytes      <= 32'd0;
                r_frame_bytes_acc  <= 32'd0;
            end

            // 正常接收（无回压：TREADY=1）
            if (S_AXIS_TVALID) begin
                o_total_beats     <= o_total_beats + 1;
                o_total_bytes     <= o_total_bytes + w_bytes_this_beat;
                r_frame_bytes_acc <= r_frame_bytes_acc + w_bytes_this_beat;

                if (S_AXIS_TLAST) begin
                    o_frame_bytes        <= r_frame_bytes_acc;
                    o_frame_done_pulse   <= 1'b1;
                    r_frame_bytes_acc    <= 32'd0;
                end
            end
        end
    end

endmodule

```

# PS 裸机测试
```c

// ============================================================
// dma_send_on_key_irq.c —— PS(DDR) -> AXI DMA(MM2S) -> PL(AXIS)
// - 功能：串口输入 't' 时，触发一次 DMA 发送；发送完成后在中断中打印提示
// - 环境：Zynq-7000 + Vivado AXI DMA (Simple mode, MM2S)
// - 注意：只用 MM2S，不使用 S2MM
// ============================================================

#include "xaxidma.h"
#include "xparameters.h"
#include "xil_cache.h"
#include "xil_printf.h"
#include "xscugic.h"
#include "xuartps_hw.h"   // for inbyte()
#include <stdint.h>

// ---------------------------- 常量定义 ----------------------------
#define DMA_DEV_ID      XPAR_AXIDMA_0_DEVICE_ID                   // AXI DMA IP 的设备 ID
#define TX_INTR_ID      XPAR_FABRIC_AXIDMA_0_MM2S_INTROUT_VEC_ID  // MM2S 通道中断号
#define INTC_DEVICE_ID  XPAR_SCUGIC_SINGLE_DEVICE_ID              // GIC 中断控制器 ID

#define MAX_PKT_LEN     0x100   // 发送数据长度 = 256 字节
                                // 若 AXIS 宽度=32bit，每次传输 4B -> 一共 64 个 beat

// ---------------------------- 全局变量 ----------------------------
static XAxiDma AxiDma;      // DMA 实例
static XScuGic Intc;        // GIC 实例
static volatile int g_txDone = 0;   // 发送完成标志（由中断置位）
static volatile int g_txErr  = 0;   // 出错标志（由中断置位）

// 64B 对齐的发送缓冲区（便于 DCache flush）
static uint8_t txBuf[MAX_PKT_LEN] __attribute__((aligned(64)));

// ============================================================
// 中断处理函数 —— 处理 MM2S 完成或错误
// ============================================================
static void TxIrqHandler(void *Callback)
{
    XAxiDma *DmaPtr = (XAxiDma *)Callback;
    u32 IrqStatus;

    // 读取并清除 MM2S 的中断状态
    IrqStatus = XAxiDma_IntrGetIrq(DmaPtr, XAXIDMA_DMA_TO_DEVICE);
    XAxiDma_IntrAckIrq(DmaPtr, IrqStatus, XAXIDMA_DMA_TO_DEVICE);

    // 出错处理
    if (IrqStatus & XAXIDMA_IRQ_ERROR_MASK) {
        g_txErr = 1;
        xil_printf("[IRQ] MM2S error, resetting DMA...\r\n");
        XAxiDma_Reset(DmaPtr);
        while (!XAxiDma_ResetIsDone(DmaPtr)) {}
        return;
    }

    // 正常完成
    if (IrqStatus & XAXIDMA_IRQ_IOC_MASK) {
        g_txDone = 1;
        xil_printf("[IRQ] MM2S TX done (%d bytes)\r\n", MAX_PKT_LEN);
    }
}

// ============================================================
// 中断系统初始化 —— 配置 GIC 并使能 AXI DMA 的 MM2S 中断
// ============================================================
static int SetupInterrupts(void)
{
    int Status;
    XScuGic_Config *Cfg;

    // 查找并初始化 GIC 配置
    Cfg = XScuGic_LookupConfig(INTC_DEVICE_ID);
    if (!Cfg) return XST_FAILURE;
    Status = XScuGic_CfgInitialize(&Intc, Cfg, Cfg->CpuBaseAddress);
    if (Status != XST_SUCCESS) return Status;

    // 初始化 CPU 异常/中断系统
    Xil_ExceptionInit();
    Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_INT,
                                 (Xil_ExceptionHandler)XScuGic_InterruptHandler,
                                 &Intc);
    Xil_ExceptionEnable();

    // 连接 DMA 的 MM2S 中断 -> TxIrqHandler
    Status = XScuGic_Connect(&Intc, TX_INTR_ID,
                             (Xil_InterruptHandler)TxIrqHandler,
                             &AxiDma);
    if (Status != XST_SUCCESS) return Status;

    // 设置优先级和触发方式（0xA0=优先级，0x3=边沿触发）
    XScuGic_SetPriorityTriggerType(&Intc, TX_INTR_ID, 0xA0, 0x3);
    XScuGic_Enable(&Intc, TX_INTR_ID);

    // 配置 AXI DMA 中断使能（仅开 IOC 和 ERR）
    XAxiDma_IntrDisable(&AxiDma, XAXIDMA_IRQ_ALL_MASK, XAXIDMA_DMA_TO_DEVICE);
    XAxiDma_IntrEnable(&AxiDma,
        XAXIDMA_IRQ_IOC_MASK | XAXIDMA_IRQ_ERROR_MASK,
        XAXIDMA_DMA_TO_DEVICE);

    return XST_SUCCESS;
}

// ============================================================
// 主函数 —— 输入 't' 触发 DMA 发送
// ============================================================
int main(void)
{
    int Status;
    XAxiDma_Config *Cfg;

    xil_printf("\r\n[MM2S] PS -> PL DMA send demo (press 't' to send)\r\n");

    // 1) 填充缓冲区数据（递增序列）
    for (uint32_t i = 0; i < MAX_PKT_LEN; i++) {
        txBuf[i] = (uint8_t)i;
    }

    // 2) 初始化 DMA
    Cfg = XAxiDma_LookupConfig(DMA_DEV_ID);
    if (!Cfg) {
        xil_printf("LookupConfig failed\r\n");
        return XST_FAILURE;
    }
    Status = XAxiDma_CfgInitialize(&AxiDma, Cfg);
    if (Status != XST_SUCCESS) {
        xil_printf("CfgInitialize failed: %d\r\n", Status);
        return XST_FAILURE;
    }
    if (XAxiDma_HasSg(&AxiDma)) {
        xil_printf("This demo expects Simple mode, but SG is enabled\r\n");
        return XST_FAILURE;
    }

    // 3) 初始化中断
    Status = SetupInterrupts();
    if (Status != XST_SUCCESS) {
        xil_printf("Interrupt setup failed\r\n");
        return XST_FAILURE;
    }

    // 4) 主循环：等待用户输入
    while (1) {
        char c = inbyte();   // 阻塞等待串口输入
        if (c == 't' || c == 'T') {
            xil_printf("Trigger received: start sending %d bytes...\r\n", MAX_PKT_LEN);

            // 清除标志
            g_txDone = 0;
            g_txErr  = 0;

            // 刷新 DCache 确保数据写回 DDR
            Xil_DCacheFlushRange((INTPTR)txBuf, MAX_PKT_LEN);

            // 启动一次传输
            Status = XAxiDma_SimpleTransfer(&AxiDma,
                                            (UINTPTR)txBuf,
                                            MAX_PKT_LEN,
                                            XAXIDMA_DMA_TO_DEVICE);
            if (Status != XST_SUCCESS) {
                xil_printf("DMA transfer failed: %d\r\n", Status);
                continue;
            }

            // 发送完成与错误的提示会在中断里打印
        } else {
            xil_printf("Ignored key '%c' (press 't' to send)\r\n", c);
        }
    }

    return XST_SUCCESS;
}

```

## 测试结果
![alt text](https://i-blog.csdnimg.cn/direct/axi_dma_ps_pl_1.png)