# Zynq中级开发七项必修课-第七课-AXI_DMA(PL→PS)
[目录](Zynq中级开发七项必修课-第零课：目录.md)

# 目标
> - PC 端通过串口助手向 PL 发送 64 字节数据，PL 内部的串口接收模块将数据存入 BRAM；
> - axi_stream_master 从 BRAM 中读取这 64 字节数据，并在本地暂存为一帧待发数据；
> - 当数据准备就绪后，axi_stream_master 触发 PL→PS 中断，通知 PS 去配置 AXI DMA；
> - PS 收到中断后，对 AXI DMA 的 S2MM 通道进行配置并启动，使其进入 Ready 状态，随后通过 AXI-Lite (M_AXI_GP) 接口写控制寄存器，通知 axi_stream_master 可以开始吐流；
> - axi_stream_master 收到吐流通知 并且 TREADY=1, 则按 AXI-Stream 协议输出完整的 64 字节数据帧（末拍断言 TLAST），AXI DMA 将其写入 DDR，传输完成后产生 S2MM 完成中断；
> - PS 在 AXI DMA 的 S2MM 中断服务函数中打印 “RX done”，并对接收到的 64 字节数据进行校验，确认正确性。

目标中的流程是比较主流的使用流程,但为减少无关干扰,,故精简了测试,和简化了目标
# 简化目标
这个简化目标功能可以实现,但是数据很难对齐,所以后面,增加了启动信号并修正了目标。
> - axi_stream_master 用固定的64字节数据0x00 ~0x3F；
> - axi_stream_master等待 TREADY=1；
> -  用串口助手给PS发送字符't',让PS配置并启动DMA；
> - axi_stream_master 检测到TREADY=1,开始吐流固定的64字节数据0x00 ~0x3F；
> - PS 在 AXI DMA 的 S2MM 中断服务函数中打印 “RX done”，并打印收到的64字节数据。
# BD图
![请添加图片描述](./img/bf7007421aa64931b5f2ea07306662f1.png)
![在这里插入图片描述](./img/077ef344635b410994f207bb9bd802f0.png)
# axi_stream_master.v
```verilog
`timescale 1 ns / 1 ps

module axi_stream_master #
(
    // Width of M_AXIS data bus
    parameter integer C_M_AXIS_TDATA_WIDTH = 32,
    // Start count is the number of clock cycles the master will wait before initiating/issuing any transaction.
    parameter integer C_M_START_COUNT      = 32
)
(
    // Global ports
    input  wire                               M_AXIS_ACLK,
    input  wire                               M_AXIS_ARESETN,
    // Master Stream Ports
    output wire                               M_AXIS_TVALID,
    output wire [C_M_AXIS_TDATA_WIDTH-1 : 0]  M_AXIS_TDATA,
    output wire [(C_M_AXIS_TDATA_WIDTH/8)-1:0]M_AXIS_TSTRB,
    output wire                               M_AXIS_TLAST,
    input  wire                               M_AXIS_TREADY
);

    // ===== 每帧 64 字节（32bit 总线 -> 16 拍） =====
    localparam integer NUMBER_OF_OUTPUT_WORDS = 16;

    // clogb2
    function integer clogb2 (input integer bit_depth);
    begin
        for (clogb2 = 0; bit_depth > 0; clogb2 = clogb2 + 1)
            bit_depth = bit_depth >> 1;
    end
    endfunction

    localparam integer WAIT_COUNT_BITS = clogb2(C_M_START_COUNT-1);


    // ===== FSM =====
    localparam [1:0] IDLE = 2'b00,
                     INIT_COUNTER = 2'b01,
                     SEND_STREAM  = 2'b10;

    reg [1:0]                mst_exec_state;
    reg [WAIT_COUNT_BITS-1:0]count;

    // 读指针：0..NUMBER_OF_OUTPUT_WORDS
   (* mark_debug = "true" *)  reg  [4:0]       read_pointer;
    reg                      tx_done;


    // ===== 派生量 =====
    // 发送期间有效
    wire axis_tvalid = (mst_exec_state == SEND_STREAM) && (read_pointer < NUMBER_OF_OUTPUT_WORDS);
    // 最后一个 beat 置 TLAST
    wire axis_tlast  = (read_pointer == NUMBER_OF_OUTPUT_WORDS-1);

    // 对外握手同拍
    wire tx_en = M_AXIS_TVALID && M_AXIS_TREADY;

    // ===== 对外连线（不再使用延迟版）=====
    assign M_AXIS_TVALID = axis_tvalid;
    assign M_AXIS_TLAST  = axis_tlast;
    assign M_AXIS_TSTRB  = {(C_M_AXIS_TDATA_WIDTH/8){1'b1}};

    // ===== 数据：按字节递增 0x00..0x3F =====
    localparam integer WORD_BYTES = (C_M_AXIS_TDATA_WIDTH/8);//4
    // 本拍起始字节序号
    wire [15:0] base_byte = read_pointer * WORD_BYTES;//是4的倍数

       // 小端字节序：TDATA[7:0] 为最低地址字节
    wire [7:0] b0 = base_byte[7:0];
    wire [7:0] b1 = (base_byte + 8'd1);
    wire [7:0] b2 = (base_byte + 8'd2);
    wire [7:0] b3 = (base_byte + 8'd3);

    assign M_AXIS_TDATA = {b3, b2, b1, b0};

    // ===== FSM =====
    always @(posedge M_AXIS_ACLK) begin
        if (!M_AXIS_ARESETN) begin
            mst_exec_state <= IDLE;
            count          <= {WAIT_COUNT_BITS{1'b0}};
        end else begin
            case (mst_exec_state)
                IDLE: begin
                    mst_exec_state <= INIT_COUNTER;
                end

                INIT_COUNTER: begin
                    if (count == C_M_START_COUNT - 1) begin
                        mst_exec_state <= SEND_STREAM;
                    end else begin
                        count <= count + 1'b1;
                        mst_exec_state <= INIT_COUNTER;
                    end
                end

                SEND_STREAM: begin
                    if (tx_done) begin
                        mst_exec_state <= IDLE;
                    end else begin
                        mst_exec_state <= SEND_STREAM;
                    end
                end
            endcase
        end
    end

    // ===== 指针与完成标志 =====
    always @(posedge M_AXIS_ACLK) begin
        if (!M_AXIS_ARESETN) begin
            read_pointer <= {5{1'b0}};
            tx_done      <= 1'b0;
        end else begin
            // 回到 IDLE 视为一帧结束，准备下一帧
            if (mst_exec_state == IDLE) begin
                read_pointer <= {5{1'b0}};
                tx_done      <= 1'b0;
            end
            else if (axis_tvalid) begin
                if (tx_en) begin
                    read_pointer <= read_pointer + 1'b1;
                    tx_done      <= 1'b0;
                end
            end
            else if (read_pointer == NUMBER_OF_OUTPUT_WORDS) begin
                tx_done <= 1'b1;
            end
            else
              read_pointer <= {5{1'b0}};
        end
    end

endmodule

```

# PS 裸机测试
保留了axi_stream_master 数据就绪中断,但未使用
```c
/******************************************************************************
 * dma_s2mm_dual_triggers_uart_poll_irq_restart.c
 *
 * 行为：
 *  - 触发源①：串口轮询收到 't'/'T' -> 请求启动/重启 S2MM DMA 接收 64B
 *  - 触发源②：中断2(PL自定义IP，axi_stream_master 数据就绪) -> 请求启动/重启 DMA
 *  - 若 DMA 正在进行，则挂起一次“续跑”请求，待 S2MM 完成中断到来时立刻续跑
 *  - 中断1(AXI DMA S2MM 完成)：打印 "RX done"，Invalidate，校验 0x00~0x3F
 *  - PL Ready 中断配置为“上升沿触发”
 ******************************************************************************/

#include "xparameters.h"
#include "xaxidma.h"
#include "xscugic.h"
#include "xil_exception.h"
#include "xil_cache.h"
#include "xil_printf.h"
#include "xuartps_hw.h"     // XUartPs_IsReceiveData/XUartPs_RecvByte

/********* 设备/中断号（按你的 BSP 修改） *********/
#define DMA_DEV_ID               XPAR_AXIDMA_0_DEVICE_ID
#define DMA_S2MM_INTR_ID         61      // 中断1：AXI DMA S2MM 完成
#define MASTER_READY_INTR_ID     62      // 中断2：axi_stream_master 数据就绪
#define INTC_DEVICE_ID           XPAR_SCUGIC_SINGLE_DEVICE_ID

/********* AXI-Lite 清中断寄存器（示例地址，按你的IP改） *********/
#define AXIS_MASTER_BASEADDR     0x40400000U
#define AXIS_MASTER_ISR_OFFSET   0x00U     // 写1清
#define AXIS_MASTER_ISR_MASK     0x1U

/********* 缓冲区与长度 *********/
#define DDR_BASE_ADDR            XPAR_PS7_DDR_0_S_AXI_BASEADDR
#define MEM_BASE_ADDR            (DDR_BASE_ADDR + 0x01000000U)
#define RX_BUFFER_BASE           (MEM_BASE_ADDR + 0x00300000U)

#define MAX_PKT_LEN              64        // 固定 64 字节
#define TEST_START_VALUE         0x00

/********* 全局实例与标志 *********/
static XAxiDma AxiDma;
static XScuGic Intc;

volatile int g_RxDone        = 0;   // DMA 完成
volatile int g_Error         = 0;   // DMA 错误
volatile int g_DataReady     = 0;   // 仅日志
volatile int g_DmaInFlight   = 0;   // DMA 正在执行
volatile int g_PendingStart  = 0;   // 忙时来了新的“启动请求”，完成后续跑

/********* 前置声明 *********/
static int  SetupIntrSystem(XScuGic *IntcPtr);
static void DisableIntrSystem(XScuGic *IntcPtr);
static void S2mmDone_Isr(void *Callback);      // 中断1：DMA完成
static void MasterReady_Isr(void *Callback);   // 中断2：PL就绪
static int  CheckData(int length, u8 start_value);

/* 统一的启动请求入口（两种事件都调这个） */
static void RequestStartS2MM(u8 *RxBuf, int len);
/* 真实发起 DMA 的函数 */
static int  StartS2MM(u8 *RxBuf, int len);

/********* UART 轮询：尝试取1字节（有则返回1并写出*out） *********/
static inline int uart_try_getch(u8 *out)
{
    if (XUartPs_IsReceiveData(STDIN_BASEADDRESS)) {
        *out = XUartPs_RecvByte(STDIN_BASEADDRESS);
        return 1;
    }
    return 0;
}

/********* 主函数 *********/
int main(void)
{
    int Status;
    XAxiDma_Config *Cfg;
    u8 *RxBuf = (u8*)RX_BUFFER_BASE;

    xil_printf("\r\n==== DMA S2MM | Triggers: UART 't' OR PL Ready IRQ | Polling UART ====\r\n");

    /* 1) 初始化 DMA */
    Cfg = XAxiDma_LookupConfig(DMA_DEV_ID);
    if (!Cfg) { xil_printf("LookupConfig failed\r\n"); return XST_FAILURE; }

    Status = XAxiDma_CfgInitialize(&AxiDma, Cfg);
    if (Status != XST_SUCCESS) {
        xil_printf("DMA CfgInitialize failed: %d\r\n", Status);
        return XST_FAILURE;
    }
    if (XAxiDma_HasSg(&AxiDma)) {
        xil_printf("This demo expects Simple Mode, but SG is enabled\r\n");
        return XST_FAILURE;
    }

    /* 2) 建立中断系统 */
    Status = SetupIntrSystem(&Intc);
    if (Status != XST_SUCCESS) {
        xil_printf("Interrupt setup failed\r\n");
        return XST_FAILURE;
    }

    xil_printf("[PS] Waiting events: UART 't' or PL data-ready IRQ ...\r\n");

    /* 3) 主循环：非阻塞轮询 UART，其它任务也可放这儿 */
    u8 ch;
    while (1) {
        if (g_Error) {
            xil_printf("[PS] ERROR occurred, abort.\r\n");
            break;
        }

        /* 触发源：串口收到 't'/'T' -> 请求启动 DMA */
        if (uart_try_getch(&ch)) {
            if (ch == 't' || ch == 'T') {
                xil_printf("[PS] UART 't' -> request DMA start\r\n");
                RequestStartS2MM(RxBuf, MAX_PKT_LEN);
            } else {
                // 可忽略其他键
            }
        }

        /* TODO: 这里可做其它轮询任务 */
    }

    DisableIntrSystem(&Intc);
    xil_printf("==== Demo End ====\r\n");
    return 0;
}

/********* 实现：统一的启动请求入口 *********/
static void RequestStartS2MM(u8 *RxBuf, int len)
{
    if (g_DmaInFlight) {
        /* 正在跑，记一次“续跑”请求 */
        g_PendingStart = 1;
        return;
    }
    if (StartS2MM(RxBuf, len) == XST_SUCCESS) {
        xil_printf("[PS] DMA started (%d bytes)\r\n", len);
    }
}

/********* 实现：真正开始 DMA *********/
static int StartS2MM(u8 *RxBuf, int len)
{
    /* 若使用可缓存 DDR，接收前做 Invalidate；若不可缓存内存，可去掉 */
    Xil_DCacheInvalidateRange((UINTPTR)RxBuf, len);

    int Status = XAxiDma_SimpleTransfer(&AxiDma,
                                        (UINTPTR)RxBuf,
                                        len,
                                        XAXIDMA_DEVICE_TO_DMA);
    if (Status != XST_SUCCESS) {
        xil_printf("[PS] DMA start failed: %d\r\n", Status);
        g_Error = 1;
        return XST_FAILURE;
    }

    g_RxDone = 0;
    g_DmaInFlight = 1;
    return XST_SUCCESS;
}

/********* ISR：中断1——AXI DMA S2MM 完成 *********/
static void S2mmDone_Isr(void *Callback)
{
    XAxiDma *DmaPtr = (XAxiDma *)Callback;
    u32 IrqStatus = XAxiDma_IntrGetIrq(DmaPtr, XAXIDMA_DEVICE_TO_DMA);

    XAxiDma_IntrAckIrq(DmaPtr, IrqStatus, XAXIDMA_DEVICE_TO_DMA);

    if (IrqStatus & XAXIDMA_IRQ_ERROR_MASK) {
        xil_printf("[S2MM] ERROR interrupt\r\n");
        g_Error = 1;
        g_DmaInFlight = 0;
        return;
    }
    if (IrqStatus & XAXIDMA_IRQ_IOC_MASK) {
        xil_printf("[S2MM] RX done interrupt\r\n");
        g_RxDone = 1;
        g_DmaInFlight = 0;

        /* 可选：检测数据 */
        Xil_DCacheInvalidateRange((UINTPTR)RX_BUFFER_BASE, MAX_PKT_LEN);
        int ok = CheckData(MAX_PKT_LEN, TEST_START_VALUE);
        xil_printf(ok == XST_SUCCESS ? "[PS] Data OK (0x00~0x3F)\r\n"
                                     : "[PS] Data check FAILED\r\n");

        /* 若期间有新的启动请求，立即续跑 */
        if (g_PendingStart) {
            g_PendingStart = 0;
            xil_printf("[PS] Pending request -> restart DMA\r\n");
            StartS2MM((u8*)RX_BUFFER_BASE, MAX_PKT_LEN);
        }
    }
}

/********* ISR：中断2——axi_stream_master 数据就绪（直接触发启动请求） *********/
static void MasterReady_Isr(void *Callback)
{
    /* 清 PL IP 的中断挂起（按你的 IP 寄存器协议修改） */
    Xil_Out32(AXIS_MASTER_BASEADDR + AXIS_MASTER_ISR_OFFSET, AXIS_MASTER_ISR_MASK);

    g_DataReady = 1;  // 仅日志
    xil_printf("[PL IRQ] Data ready -> request DMA start\r\n");

    /* 与 UART 't' 同入口：谁来都能触发 DMA */
    RequestStartS2MM((u8*)RX_BUFFER_BASE, MAX_PKT_LEN);
}

/********* 中断系统装配（GIC 连接 + 触发类型配置） *********/
static int SetupIntrSystem(XScuGic *IntcPtr)
{
    int Status;
    XScuGic_Config *CfgPtr;

    CfgPtr = XScuGic_LookupConfig(INTC_DEVICE_ID);
    if (CfgPtr == NULL) return XST_FAILURE;

    Status = XScuGic_CfgInitialize(IntcPtr, CfgPtr, CfgPtr->CpuBaseAddress);
    if (Status != XST_SUCCESS) return XST_FAILURE;

    /* 连接：DMA S2MM 完成（中断1） */
    Status = XScuGic_Connect(IntcPtr, DMA_S2MM_INTR_ID,
                             (Xil_ExceptionHandler)S2mmDone_Isr, &AxiDma);
    if (Status != XST_SUCCESS) return XST_FAILURE;
    XScuGic_Enable(IntcPtr, DMA_S2MM_INTR_ID);

    /* 设置：PL Ready 中断为“上升沿触发”，优先级 0xA0 */
    XScuGic_SetPriorityTriggerType(IntcPtr, MASTER_READY_INTR_ID,
                                   0xA0, 0x3);   // 0x3 = rising edge

    /* 连接：axi_stream_master 数据就绪（中断2） */
    Status = XScuGic_Connect(IntcPtr, MASTER_READY_INTR_ID,
                             (Xil_ExceptionHandler)MasterReady_Isr, NULL);
    if (Status != XST_SUCCESS) return XST_FAILURE;
    XScuGic_Enable(IntcPtr, MASTER_READY_INTR_ID);

    /* 异常初始化并使能 */
    Xil_ExceptionInit();
    Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_INT,
                                 (Xil_ExceptionHandler)XScuGic_InterruptHandler,
                                 IntcPtr);
    Xil_ExceptionEnable();

    /* 使能 DMA S2MM 中断掩码（完成+错误） */
    XAxiDma_IntrEnable(&AxiDma, XAXIDMA_IRQ_ALL_MASK, XAXIDMA_DEVICE_TO_DMA);

    return XST_SUCCESS;
}

static void DisableIntrSystem(XScuGic *IntcPtr)
{
    XScuGic_Disconnect(IntcPtr, DMA_S2MM_INTR_ID);
    XScuGic_Disconnect(IntcPtr, MASTER_READY_INTR_ID);
}

/********* 数据校验（期望 0x00~0x3F） *********/
static int CheckData(int length, u8 start_value)
{
    volatile u8 *Rx = (volatile u8 *)RX_BUFFER_BASE;
    u8 v = start_value;
    for (int i = 0; i < length; i++) {
    	xil_printf("[CHECK] Mismatch @%d: got 0x%02X, exp 0x%02X\r\n", i, Rx[i], v);
        v++;
    }
    return XST_SUCCESS;
}

```

# 测试结果
![在这里插入图片描述](./img/5402adb7d91443b79cfea4149a4259d1.png)
# 观察波形
虽然实验结果正确, 但观察波形有问题, 推流数据不是用0x00开始的, 并且推流被截成了两段
![在这里插入图片描述](./img/7e0c39671b994364af10c69170a0bb94.png)
# 问题排查
## 先用modelsim单独测测 axi_stream_master
```verilog
`timescale 1ns/1ps

// =====================================================
// TB for axi_stream_master
// - No waveform dump
// - No backpressure during frame (TREADY=1 一直保持)
// - 但在复位释放后，TREADY 先延时 N 拍再置 1
// - 严格检查数据递增与 TLAST 位置
// =====================================================
module tb;

  // ---------- Params ----------
  localparam integer C_M_AXIS_TDATA_WIDTH = 32;
  localparam integer C_M_START_COUNT_TB   = 8;    // 加快仿真
  localparam integer WORDS_PER_FRAME      = 16;
  localparam integer READY_DELAY_CYCLES   = 20;   // 复位释放后 TREADY 延时拍数

  // ---------- Clock / Reset ----------
  reg clk = 0;
  always #5 clk = ~clk;     // 100 MHz

  reg rstn = 0;
  initial begin
    rstn = 0;
    repeat (10) @(posedge clk);
    rstn = 1;
  end

  // ---------- DUT I/F ----------
  wire                               M_AXIS_TVALID;
  wire [C_M_AXIS_TDATA_WIDTH-1:0]    M_AXIS_TDATA;
  wire [(C_M_AXIS_TDATA_WIDTH/8)-1:0]M_AXIS_TSTRB;
  wire                               M_AXIS_TLAST;
  reg                                M_AXIS_TREADY = 0;

  // 复位后延时 READY_DELAY_CYCLES 再把 TREADY 置 1，随后一直为 1（无背压）
  reg [15:0] ready_cnt = 0;
  always @(posedge clk) begin
    if (!rstn) begin
      M_AXIS_TREADY <= 1'b0;
      ready_cnt     <= 0;
    end else if (ready_cnt < READY_DELAY_CYCLES) begin
      ready_cnt     <= ready_cnt + 1'b1;
      M_AXIS_TREADY <= 1'b0;
    end else begin
      M_AXIS_TREADY <= 1'b1;
    end
  end

  // ---------- DUT ----------
  axi_stream_master #(
    .C_M_AXIS_TDATA_WIDTH(C_M_AXIS_TDATA_WIDTH),
    .C_M_START_COUNT     (C_M_START_COUNT_TB)
  ) dut (
    .M_AXIS_ACLK    (clk),
    .M_AXIS_ARESETN (rstn),
    .M_AXIS_TVALID  (M_AXIS_TVALID),
    .M_AXIS_TDATA   (M_AXIS_TDATA),
    .M_AXIS_TSTRB   (M_AXIS_TSTRB),
    .M_AXIS_TLAST   (M_AXIS_TLAST),
    .M_AXIS_TREADY  (M_AXIS_TREADY)
  );

  // ---------- Helpers ----------
  function [31:0] exp_word(input integer idx);
    reg [7:0] b0,b1,b2,b3;
    begin
      b0 = idx*4 + 0;
      b1 = idx*4 + 1;
      b2 = idx*4 + 2;
      b3 = idx*4 + 3;
      exp_word = {b3,b2,b1,b0};
    end
  endfunction

  // ---------- Monitors / Checks ----------
  integer rx_idx    = 0;    // 0..15
  integer frame_cnt = 0;
  wire tx_en = M_AXIS_TVALID && M_AXIS_TREADY;

  initial begin
    wait(rstn);
    // 等待首个握手开始（考虑到 TREADY 有延时）
    wait (M_AXIS_TVALID && M_AXIS_TREADY);

    // 接收 2 帧并检查
    while (frame_cnt < 2) begin
      @(posedge clk);

      // 无背压阶段：传输过程中 TVALID 不应掉
      if (M_AXIS_TREADY && !M_AXIS_TVALID && rx_idx != 0) begin
        $display("[%0t] ERROR: TVALID dropped in-frame (idx=%0d).", $time, rx_idx);
        $fatal;
      end

      if (tx_en) begin
        // 数据检查
        if (M_AXIS_TDATA !== exp_word(rx_idx)) begin
          $display("[%0t] ERROR: TDATA mismatch @idx=%0d, got=0x%08x exp=0x%08x",
                   $time, rx_idx, M_AXIS_TDATA, exp_word(rx_idx));
          $fatal;
        end

        // TLAST 检查
        if (rx_idx == WORDS_PER_FRAME-1) begin
          if (M_AXIS_TLAST !== 1'b1) begin
            $display("[%0t] ERROR: TLAST should be 1 at last beat (idx=15).", $time);
            $fatal;
          end
          rx_idx    = 0;
          frame_cnt = frame_cnt + 1;
          $display("[%0t] INFO : Frame %0d done.", $time, frame_cnt);
        end else begin
          if (M_AXIS_TLAST !== 1'b0) begin
            $display("[%0t] ERROR: TLAST asserted early @idx=%0d.", $time, rx_idx);
            $fatal;
          end
          rx_idx = rx_idx + 1;
        end
      end
    end

    $display("[%0t] PASS: %0d frames received. TREADY delayed %0d cycles then held high.",
             $time, frame_cnt, READY_DELAY_CYCLES);
    #20;
    $finish;
  end
endmodule
```
 观察波形传输时机不对
![在这里插入图片描述](./img/28b98f6f7bb34282aeb98d8173ca1661.png)
# 问题修正
![在这里插入图片描述](./img/480d3f51f3a54cafbd84daa6ed4472b0.png)
# 修正目标
>  - axi_stream_master 用固定的64字节数据0x00 ~0x3F；
> -  在axi_stream_master.o_rdy=1时 用串口助手给PS发送字符't',让PS配置并启动DMA；
> -  用按键触发axi_stream_master吐流固定的64字节数据0x00 ~0x3F；
> - PS 在 AXI DMA 的 S2MM 中断服务函数中打印 “RX done”，并打印收到的64字节数据。

# AXI DMA 寄存器位域表 (Simple Mode)

## 一、MM2S 通道（Memory → Stream）

### 1. MM2S_DMACR (偏移 0x00, 控制寄存器)

| 位   | 名称        | 默认 | 描述 |
|------|-------------|------|------|
| 0    | RS          | 0    | Run/Stop，1=运行，0=停止。写 0 会在当前传输完成后停机。 |
| 1    | Reset       | 0    | 复位（写 1 触发，自动清零）。 |
| 2–11 | 保留        | -    | - |
| 12   | IOC_IrqEn   | 0    | 传输完成中断使能 (Interrupt On Complete)。 |
| 13   | Dly_IrqEn   | 0    | 延迟中断使能（仅 SG 模式有效）。 |
| 14   | Err_IrqEn   | 0    | 错误中断使能。 |
| 31:15| 保留        | -    | - |

---

### 2. MM2S_DMASR (偏移 0x04, 状态寄存器)

| 位   | 名称        | 描述 |
|------|-------------|------|
| 0    | Halted      | 1=停机 (RS=0 或复位后)。 |
| 1    | Idle        | 1=空闲，无传输活动。 |
| 2    | SGIncld     | 0=Simple 模式，1=SG 模式。 |
| 3    | DMAIntErr   | 内部总线错误。 |
| 4    | DMADecErr   | 地址解码错误。 |
| 5    | DMASlvErr   | 外设 Slave 错误。 |
| 12   | IOC_Irq     | 完成中断标志（写 1 清零）。 |
| 13   | Dly_Irq     | 延迟中断标志（仅 SG 模式有效）。 |
| 14   | Err_Irq     | 错误中断标志（写 1 清零）。 |
| 31:15| 保留        | - |

---

### 3. 其他寄存器

- **MM2S_SA (0x18)** : 源地址低 32 位（DDR 起始地址，64B 对齐）  
- **MM2S_SA_MSB (0x1C)** : 源地址高 32 位（仅 64 位地址系统）  
- **MM2S_LENGTH (0x28)** : 传输长度（字节，4B 对齐，不可跨 4KB 边界）

---

## 二、S2MM 通道（Stream → Memory）

### 1. S2MM_DMACR (偏移 0x30, 控制寄存器)

| 位   | 名称        | 默认 | 描述 |
|------|-------------|------|------|
| 0    | RS          | 0    | Run/Stop，1=运行，0=停止。 |
| 1    | Reset       | 0    | 复位（写 1 触发，自动清零）。 |
| 2–11 | 保留        | -    | - |
| 12   | IOC_IrqEn   | 0    | 完成中断使能。 |
| 14   | Err_IrqEn   | 0    | 错误中断使能。 |
| 31:15| 保留        | -    | - |

---

### 2. S2MM_DMASR (偏移 0x34, 状态寄存器)

| 位   | 名称        | 描述 |
|------|-------------|------|
| 0    | Halted      | 1=停机 (RS=0 或复位后)。 |
| 1    | Idle        | 1=空闲。 |
| 2    | SGIncld     | 0=Simple 模式，1=SG 模式。 |
| 3    | DMAIntErr   | 内部总线错误。 |
| 4    | DMADecErr   | 地址解码错误。 |
| 5    | DMASlvErr   | 外设 Slave 错误。 |
| 12   | IOC_Irq     | 完成中断标志（写 1 清零）。 |
| 14   | Err_Irq     | 错误中断标志（写 1 清零）。 |
| 31:15| 保留        | - |

---

### 3. 其他寄存器

- **S2MM_DA (0x48)** : 目的地址低 32 位（DDR 起始地址，64B 对齐）  
- **S2MM_DA_MSB (0x4C)** : 目的地址高 32 位（仅 64 位地址系统）  
- **S2MM_LENGTH (0x58)** : 传输长度（字节，4B 对齐，不可跨 4KB 边界）


# AXI DMA S2MM 通道的 TREADY=0 / TREADY=1 时机

## 🔹 初始状态
- **DMA 没启动**（S2MM 通道 idle）：  
  - `M_AXIS_TREADY = 0`  
  - 因为 DMA 并没有在等数据。  

---

## 🔹 配置并启动 DMA
1. PS 端配置 **目标地址 + 长度 + 运行**（写 CR/DA/Length）。  
2. DMA S2MM 通道进入 **运行状态**：  
   - 内部 FIFO 打开  
   - **TREADY = 1**  
   - 表示“我已经准备好接收 AXI-Stream 数据”。  

---

## 🔹 传输进行中
- **正常情况下**：  
  - FIFO 有余量时：`TREADY = 1`，上游 master 可以源源不断推数据。  
  - FIFO 满了（比如 DDR 总线暂时被仲裁走、写入跟不上）：`TREADY = 0`，暂停接收。  
  - 等 FIFO 被清掉一些（DMA 写 DDR 成功），再恢复：`TREADY = 1`。  

⚡ **TREADY 在 `1 ↔ 0` 之间的抖动，本质上是流控 (backpressure)，由 DMA 内部 FIFO 状态决定。**

---

## 🔹 传输结束
- 当 DMA **接收字节数 == 配置长度**：  
  - S2MM 完成，置位 IOC 中断。  
  - **TREADY 拉低 = 0**，因为 DMA 已经停机，不会再接收。  

---

## 🔹 总结时机表

| 状态                | TREADY |
|---------------------|--------|
| DMA Idle（未启动）   | 0 |
| DMA 启动，FIFO 空闲 | 1 |
| DMA 运行，FIFO 满   | 0 |
| DMA 完成，停机      | 0 |

---

👉 **简记**：  
- 只有在 **DMA 被启动 & FIFO 有空间** 时，`TREADY = 1`。  
- 其他时候（没启动、满了、完成），`TREADY = 0`。

## 先启动吐流, 后启动DMA
数据容易对不齐
![在这里插入图片描述](./img/daed1ff93dca4d689b2de7ff42112448.png)
## 先启动DMA,后启动吐流
数据对齐,满足需求
![在这里插入图片描述](./img/2424a49c25b44c02a6fed247ef6111c4.png)
#  改正后的axi_stream_master.v
新增 i_start,o_done,o_rdy 三个信号, i_start和o_rdy 应当接入到PS。
PS轮询o_rdy 是否就绪, 然后启动DMA，再启动i_start, 接方式可以用
 emio，axi_gpio,和axi_lite 等
```verilog
`timescale 1 ns / 1 ps

module axi_stream_master #
(
    parameter integer C_M_AXIS_TDATA_WIDTH = 32,
    parameter integer C_M_START_COUNT      = 32,
    // 仅当 TREADY=1 才允许从 IDLE 启动
    parameter         GATE_START_BY_TREADY = 1
)
(
    input  wire                                M_AXIS_ACLK,
    input  wire                                M_AXIS_ARESETN,

    // 控制/状态
    input  wire                                i_start,   // 仅空闲时采样
    output reg                                 o_done,    // 完成脉冲（1拍）
    output wire                                o_rdy,     // 空闲就绪=1

    // AXI-Stream
    output wire                                M_AXIS_TVALID,
    output wire [C_M_AXIS_TDATA_WIDTH-1 : 0]   M_AXIS_TDATA,
    output wire [(C_M_AXIS_TDATA_WIDTH/8)-1:0] M_AXIS_TSTRB,
    output wire                                M_AXIS_TLAST,
    input  wire                                M_AXIS_TREADY
);

    localparam integer NUMBER_OF_OUTPUT_WORDS = 16;

    // clogb2
    function integer clogb2 (input integer bit_depth);
    begin
        for (clogb2 = 0; bit_depth > 0; clogb2 = clogb2 + 1)
            bit_depth = bit_depth >> 1;
    end
    endfunction
    localparam integer WAIT_COUNT_BITS = clogb2(C_M_START_COUNT-1);

    // FSM
    localparam [1:0] IDLE         = 2'b00,
                     INIT_COUNTER = 2'b01,
                     SEND_STREAM  = 2'b10;

    reg [1:0]                  mst_exec_state;
    reg [WAIT_COUNT_BITS-1:0]  count;

    // 指针与发送激活
    (* mark_debug = "true" *) reg [4:0] read_pointer;
    reg                        send_active; // 进入SEND_STREAM后一拍才拉起TVALID

    // 允许起跑（可选由 TREADY 门控）
    wire allow_start = (GATE_START_BY_TREADY==0) ? 1'b1 : M_AXIS_TREADY;

    // 空闲就绪
    assign o_rdy = (mst_exec_state == IDLE);

    // TVALID 只在 SEND_STREAM 且 send_active=1 时有效
    wire axis_tvalid = (mst_exec_state == SEND_STREAM) && send_active && (read_pointer < NUMBER_OF_OUTPUT_WORDS);
    wire axis_tlast  = (read_pointer == NUMBER_OF_OUTPUT_WORDS-1);
    wire tx_en       = M_AXIS_TVALID && M_AXIS_TREADY;

    assign M_AXIS_TVALID = axis_tvalid;
    assign M_AXIS_TLAST  = axis_tlast;
    assign M_AXIS_TSTRB  = {(C_M_AXIS_TDATA_WIDTH/8){1'b1}};

    // 数据 0x00..0x3F
    localparam integer WORD_BYTES = (C_M_AXIS_TDATA_WIDTH/8);
    wire [15:0] base_byte = read_pointer * WORD_BYTES;
    wire [7:0]  b0 = base_byte[7:0];
    wire [7:0]  b1 = (base_byte + 8'd1);
    wire [7:0]  b2 = (base_byte + 8'd2);
    wire [7:0]  b3 = (base_byte + 8'd3);
    assign M_AXIS_TDATA = {b3, b2, b1, b0};

    // ===== FSM =====
    always @(posedge M_AXIS_ACLK) begin
        if (!M_AXIS_ARESETN) begin
            mst_exec_state <= IDLE;
            count          <= {WAIT_COUNT_BITS{1'b0}};
        end else begin
            case (mst_exec_state)
                IDLE: begin
                    if (i_start && allow_start) begin
                        mst_exec_state <= INIT_COUNTER;
                        count          <= {WAIT_COUNT_BITS{1'b0}};
                    end
                end

                INIT_COUNTER: begin
                    if (count == C_M_START_COUNT - 1) begin
                        mst_exec_state <= SEND_STREAM;
                    end else begin
                        count <= count + 1'b1;
                    end
                end

                SEND_STREAM: begin
                    if (o_done) begin
                        mst_exec_state <= IDLE;
                    end
                end

                default: mst_exec_state <= IDLE;
            endcase
        end
    end

    // ===== 指针、完成脉冲、TVALID起跑对齐 =====
    always @(posedge M_AXIS_ACLK) begin
        if (!M_AXIS_ARESETN) begin
            read_pointer <= 5'd0;
            send_active  <= 1'b0;
            o_done       <= 1'b0;
        end else begin
            o_done <= 1'b0; // 默认拉低

            case (mst_exec_state)
                IDLE: begin
                    read_pointer <= 5'd0;
                    send_active  <= 1'b0;
                end

                INIT_COUNTER: begin
                    // **在进入 SEND_STREAM 的前一拍**把 read_pointer 预置为 0
                    // 为了严谨，也在 INIT 阶段保持清零
                    read_pointer <= 5'd0;
                    send_active  <= 1'b0;
                end

                SEND_STREAM: begin
                    // 进入 SEND_STREAM 的第 1 拍：send_active 置 1，让 TVALID 下一拍才有效
                    if (!send_active) begin
                        send_active  <= 1'b1;       // 下一拍TVAILD=1
                        read_pointer <= 5'd0;       // **确保首拍一定是 0**
                    end else if (axis_tvalid && tx_en) begin
                        if (axis_tlast) begin
                            read_pointer <= read_pointer + 1'b1; // 变为 16
                            o_done       <= 1'b1;                // 完成脉冲
                            send_active  <= 1'b0;                // 拉回，等待FSM退回IDLE
                        end else begin
                            read_pointer <= read_pointer + 1'b1;
                        end
                    end
                end
            endcase
        end
    end
endmodule
```

# key_debounce.v
```verilog
`timescale 1ns/1ps

module key_debounce #
(
    parameter P_CLK_FREQ_MHZ = 100,  // 时钟频率 MHz
    parameter P_DEBOUNCE_MS  = 20,   // 消抖时间 ms
    parameter L_CNT_WIDTH    = 32    // 计数器宽度
)
(
    input   wire    i_clk,           // 系统时钟
    input   wire    i_rst_n,         // 全局复位
    input   wire    i_key,           // 按键输入信号

    output  reg     o_key_pulse,     // 消抖后的单周期脉冲
    output  reg     o_key_toggle,    // 按键触发翻转信号
    output  reg [7:0] o_key_count,   // 按键次数计数器
    output  reg     o_sec_pulse,      // 每秒产生一个脉冲（1个时钟周期）
    output  reg [7:0] o_sec_count,   // 秒计数器
    output  reg     o_sec_toggle     // 每秒翻转一次
);

    // ==================================================
    // 消抖逻辑
    // ==================================================
    localparam L_MAX_CNT = P_CLK_FREQ_MHZ * 1000 * P_DEBOUNCE_MS;
    reg [L_CNT_WIDTH-1:0] r_cnt;

    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n)
            r_cnt <= 0;
        else if (i_key == 1)  // 松开清零
            r_cnt <= 0;
        else if (i_key == 0 && r_cnt < L_MAX_CNT-1)
            r_cnt <= r_cnt + 1'b1;
        else
            r_cnt <= r_cnt;

    // 输出消抖脉冲
    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n)
            o_key_pulse <= 1'b0;
        else if (r_cnt == L_MAX_CNT-3)
            o_key_pulse <= 1'b1;
        else
            o_key_pulse <= 1'b0;

    // ==================================================
    // 按键次数计数器 & 翻转信号
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n) begin
            o_key_count  <= 0;
            o_key_toggle <= 0;
        end else if (o_key_pulse) begin
            o_key_count  <= o_key_count + 1'b1;
            o_key_toggle <= ~o_key_toggle;  // 每次按键翻转
        end

    // ==================================================
    // 1 秒计数器（基于时钟频率）
    // ==================================================
    localparam L_ONE_SEC = P_CLK_FREQ_MHZ * 1_000_000; // 1秒对应的时钟数
    reg [31:0] r_1s_cnt;  // 需要足够位宽

    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n) begin
            r_1s_cnt    <= 0;
            o_sec_pulse  <= 0;
        end else if (r_1s_cnt == L_ONE_SEC-1) begin
            r_1s_cnt    <= 0;
            o_sec_pulse  <= 1'b1; // 1秒脉冲
        end else begin
            r_1s_cnt    <= r_1s_cnt + 1'b1;
            o_sec_pulse  <= 1'b0;
        end

    // ==================================================
    // 秒计数器 & 翻转信号
    // ==================================================
    always @(posedge i_clk or negedge i_rst_n)
        if (!i_rst_n) begin
            o_sec_count  <= 0;
            o_sec_toggle <= 0;
        end else if (o_sec_pulse) begin
            o_sec_count  <= o_sec_count + 1'b1;
            o_sec_toggle <= ~o_sec_toggle; // 每秒翻转
        end

endmodule
```

# PS 裸机测试代码和测试结果和上面一样