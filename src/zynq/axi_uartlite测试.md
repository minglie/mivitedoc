# axi_uartlite
[手册](https://docs.amd.com/v/u/en-US/axi_uartlite_ds741)
## BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/ab8cf225482e43fc913555b30961a09a.png)
## PS 直接操作寄存器
```c
#include "xparameters.h"
#include "xil_printf.h"
#include "sleep.h"
#include <stdint.h>

// 定义AXI UART Lite基地址（从xparameters.h获取）
#define UART_BASE_ADDR XPAR_AXI_UARTLITE_0_BASEADDR

// 寄存器地址（基地址 + 偏移）
#define UART_RX_FIFO   (*(volatile uint32_t *)(UART_BASE_ADDR + 0x00))  // 接收数据寄存器
#define UART_TX_FIFO   (*(volatile uint32_t *)(UART_BASE_ADDR + 0x04))  // 发送数据寄存器
#define UART_STATUS    (*(volatile uint32_t *)(UART_BASE_ADDR + 0x08))  // 状态寄存器
#define UART_CONTROL   (*(volatile uint32_t *)(UART_BASE_ADDR + 0x0C))  // 控制寄存器

// 状态寄存器位定义
#define RX_VALID       (1 << 0)  // 接收FIFO有数据
#define TX_FULL        (1 << 1)  // 发送FIFO满

// 控制寄存器位定义
#define RX_RESET       (1 << 0)  // 复位接收FIFO
#define TX_RESET       (1 << 1)  // 复位发送FIFO

// 初始化UART（复位FIFO）
void UART_Init() {
    // 复位接收和发送FIFO（写1生效，自动清零）
    UART_CONTROL = RX_RESET | TX_RESET;
    // 短暂延时确保复位完成
    usleep(100);
}

// 发送一个字节
void UART_SendByte(uint8_t data) {
    // 等待发送FIFO非满
    while (UART_STATUS & TX_FULL);
    // 写入发送FIFO
    UART_TX_FIFO = data;
}

// 接收一个字节（返回1表示成功，0表示无数据）
uint8_t UART_RecvByte(uint8_t *data) {
    // 检查接收FIFO是否有数据
    if (UART_STATUS & RX_VALID) {
        *data = (uint8_t)(UART_RX_FIFO & 0xFF);  // 只取低8位
        return 1;
    }
    return 0;
}

int main() {
    uint8_t recv_data;
    UART_Init();
    xil_printf("UART Direct Register Test (Echo Mode)\n\r");

    while (1) {
        // 尝试接收数据
        if (UART_RecvByte(&recv_data)) {
            // 收到数据后回传
            UART_SendByte(recv_data);
        }
        // 短暂延时，降低CPU占用
        usleep(1000);
    }

    return 0;
}

```

##  PS 用库函数
```c
#include "xparameters.h"
#include "xuartlite.h"
#include "xil_printf.h"
#include "sleep.h"

#define UART_DEVICE_ID XPAR_AXI_UARTLITE_0_DEVICE_ID
#define MAX_RECV_LEN   16

XUartLite UartInstance;

int main() {
    int status;
    u8 recv_buf[MAX_RECV_LEN];
    u32 recv_len;

    xil_printf("UART Library API Echo Example\r\n");

    // 初始化 UARTLite
    status = XUartLite_Initialize(&UartInstance, UART_DEVICE_ID);
    if (status != XST_SUCCESS) {
        xil_printf("UART Init Failed!\r\n");
        return -1;
    }

    XUartLite_ResetFifos(&UartInstance);

    while (1) {
        // 发送固定测试字节
        XUartLite_SendByte(UartInstance.RegBaseAddress, 0x55);

        // 批量接收
        recv_len = XUartLite_Recv(&UartInstance, recv_buf, MAX_RECV_LEN);
        if (recv_len > 0) {
            // 回显收到的全部内容
            for (u32 i = 0; i < recv_len; i++) {
                XUartLite_SendByte(UartInstance.RegBaseAddress, recv_buf[i]);
            }
        }

        usleep(1000);
    }

    return 0;
}

```

## PS 库函数  LookupConfig + CfgInitialize
```c
#include "xparameters.h"
#include "xuartlite.h"
#include "xil_printf.h"
#include "sleep.h"

#define UART_DEVICE_ID XPAR_AXI_UARTLITE_0_DEVICE_ID
#define MAX_RECV_LEN   16

XUartLite UartInstance;

int main() {
    int status;
    XUartLite_Config *Config;
    u8 recv_buf[MAX_RECV_LEN];
    u32 recv_len;

    xil_printf("UART Init using LookupConfig + CfgInitialize\r\n");

    // 🔍 手动查找 UART 配置结构体
    Config = XUartLite_LookupConfig(UART_DEVICE_ID);
    if (Config == NULL) {
        xil_printf("UART LookupConfig failed!\r\n");
        return -1;
    }

    // ⚙️ 手动初始化实例（相当于 Initialize）
    status = XUartLite_CfgInitialize(&UartInstance, Config, Config->RegBaseAddr);
    if (status != XST_SUCCESS) {
        xil_printf("UART CfgInitialize failed!\r\n");
        return -1;
    }

    // 清空 FIFO
    XUartLite_ResetFifos(&UartInstance);

    while (1) {
        // 发送固定测试字节
        XUartLite_SendByte(UartInstance.RegBaseAddress, 0x55);

        // 批量接收
        recv_len = XUartLite_Recv(&UartInstance, recv_buf, MAX_RECV_LEN);
        if (recv_len > 0) {
            for (u32 i = 0; i < recv_len; i++) {
                XUartLite_SendByte(UartInstance.RegBaseAddress, recv_buf[i]);
            }
        }

        usleep(1000);
    }

    return 0;
}

```
# axi_uart16550
[手册](https://docs.amd.com/v/u/en-US/ds748_axi_uart16550)
## BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/2e6e419703da4039825c4fccadaf09e7.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/004a58505c074261aabd5f195512b7a7.png)
## PS 直接操作寄存器
```c
#include "xparameters.h"
#include "xil_printf.h"
#include "xil_io.h"  // 用于 Xil_In32 / Xil_Out32

/**************************** 配置 ******************************/
#define UART_BASEADDR   XPAR_UARTNS550_0_BASEADDR
#define UART_CLK_FREQ   XPAR_PS7_UART_0_UART_CLK_FREQ_HZ
#define UART_BAUD_RATE  115200

/**************************** UART 寄存器偏移 ******************************/
// AXI UART 16550 寄存器偏移
#define UART_REG_RBR    0x00  // 接收缓冲寄存器 (读)
#define UART_REG_THR    0x00  // 发送保持寄存器 (写)
#define UART_REG_IER    0x04  // 中断使能寄存器
#define UART_REG_IIR    0x08  // 中断识别寄存器 (只读)
#define UART_REG_FCR    0x08  // FIFO 控制寄存器 (写)
#define UART_REG_LCR    0x0C  // 线路控制寄存器
#define UART_REG_MCR    0x10  // 调制控制寄存器
#define UART_REG_LSR    0x14  // 线路状态寄存器
#define UART_REG_MSR    0x18  // 调制状态寄存器
#define UART_REG_SCR    0x1C  // 用户自定义寄存器
#define UART_REG_DLL    0x00  // 除数锁存低字节 (DLAB=1)
#define UART_REG_DLM    0x04  // 除数锁存高字节 (DLAB=1)

/**************************** 宏定义 ******************************/
// LSR 寄存器标志位
#define UART_LSR_DR     0x01  // 数据就绪
#define UART_LSR_THRE   0x20  // 发送保持寄存器空

/***************** 寄存器操作辅助宏 ******************/
#define UART_READ(reg)      Xil_In8(UART_BASEADDR + (reg))
#define UART_WRITE(reg,val) Xil_Out8(UART_BASEADDR + (reg), (val))

/***************** 波特率计算 ******************/
static void uart_set_baud(u32 clk, u32 baud)
{
    u16 divisor;

    // 1️⃣ 使能 DLAB 位，才能访问 DLL/DLM
    u8 lcr = UART_READ(UART_REG_LCR);
    UART_WRITE(UART_REG_LCR, lcr | 0x80); // 设置 DLAB=1

    // 2️⃣ 计算除数: divisor = UART_CLK / (16 * baud)
    divisor = (u16)(clk / (16 * baud));

    UART_WRITE(UART_REG_DLL, divisor & 0xFF);       // 低字节
    UART_WRITE(UART_REG_DLM, (divisor >> 8) & 0xFF);// 高字节

    // 3️⃣ 清除 DLAB 位，设置数据格式 8N1
    UART_WRITE(UART_REG_LCR, 0x03); // 8 数据位，无校验，1 停止位
}

/***************** 发送单字节 ******************/
static void uart_send_byte(u8 c)
{
    // 等待发送寄存器空
    while (!(UART_READ(UART_REG_LSR) & UART_LSR_THRE));
    UART_WRITE(UART_REG_THR, c);
}

/***************** 接收单字节 ******************/
static u8 uart_recv_byte(void)
{
    // 等待接收寄存器有数据
    while (!(UART_READ(UART_REG_LSR) & UART_LSR_DR));
    return UART_READ(UART_REG_RBR);
}

/***************** 发送字符串 ******************/
static void uart_send_str(const char* str)
{
    while (*str) {
        uart_send_byte(*str++);
    }
}

/***************** 主函数 ******************/
int main(void)
{
    u8 c;

    // 1️⃣ 设置波特率 + 8N1 数据格式
    uart_set_baud(UART_CLK_FREQ, UART_BAUD_RATE);
    xil_printf("UART initialized at %d bps using pure registers\r\n", UART_BAUD_RATE);

    // 2️⃣ 发送 Hello World
    uart_send_str("Hello World\r\n");
    xil_printf("Entering echo loop...\r\n");

    // 3️⃣ 回环逻辑: 收到啥就发啥
    while (1) {
        c = uart_recv_byte();
        uart_send_byte(c);
    }

    return 0; // 永远不会到达
}

```
## PS 库函数
```c
#include "xparameters.h"
#include "xuartns550.h"
#include "xil_printf.h"

/**************************** 配置 ******************************/
#define UART_DEVICE_ID   XPAR_UARTNS550_0_DEVICE_ID
#define UART_BASEADDR    XPAR_UARTNS550_0_BASEADDR
#define UART_CLK_FREQ    XPAR_PS7_UART_0_UART_CLK_FREQ_HZ  // 注意 _HZ 结尾
#define UART_BAUD_RATE   115200

/**************************** 全局变量 **************************/
XUartNs550 UartNs550;  // UART 实例

/***************** 函数原型 ******************/
int UartNs550_HelloWorldAndEcho(u16 DeviceId);

/***************** 主函数 ******************/
int main(void)
{
    int Status;

    Status = UartNs550_HelloWorldAndEcho(UART_DEVICE_ID);
    if (Status == XST_FAILURE) {
        xil_printf("UART Example Failed\r\n");
        return XST_FAILURE;
    }

    xil_printf("UART Example Running\r\n");
    return XST_SUCCESS;
}

/***************** 示例函数 ******************/
int UartNs550_HelloWorldAndEcho(u16 DeviceId)
{
    int Status;
    u8 c;

    // 1️⃣ 初始化 UART
    Status = XUartNs550_Initialize(&UartNs550, DeviceId);
    if (Status != XST_SUCCESS) {
        return XST_FAILURE;
    }

    // 2️⃣ 设置波特率
    XUartNs550_SetBaud(UART_BASEADDR, UART_CLK_FREQ, UART_BAUD_RATE);
    xil_printf("UART initialized at %d bps\r\n", UART_BAUD_RATE);

    // 3️⃣ 发送 Hello World
    char HelloWorld[] = "Hello World\r\n";
    int SentCount = 0;
    while (SentCount < sizeof(HelloWorld) - 1) {
        SentCount += XUartNs550_Send(&UartNs550,
                                     (u8*)&HelloWorld[SentCount],
                                     1);
    }

    xil_printf("Entering echo loop...\r\n");

    // 4️⃣ 接收并回发逻辑
    while (1) {
        if (XUartNs550_IsReceiveData(UART_BASEADDR)) {
            XUartNs550_Recv(&UartNs550, &c, 1);
            XUartNs550_Send(&UartNs550, &c, 1);
        }
    }

    return XST_SUCCESS; // 永远不会到达
}
```

## PS 库函数+中断
>XUartNs550 是 Xilinx 提供的 “NS16550 兼容 UART” 的软件驱动（BSP 层）， 专门用来驱动 AXI UART16550 这个 IP。

这里axi_uart16550_0的中断号是62
>#define XPAR_UARTNS550_0_DEVICE_ID 0U
#define XPAR_UARTNS550_0_BASEADDR 0x42C00000U
#define XPAR_UARTNS550_0_HIGHADDR 0x42C0FFFFU
/* Definitions for Fabric interrupts connected to ps7_scugic_0 */
#define XPAR_FABRIC_AXI_UART16550_0_IP2INTC_IRPT_INTR 62U

```c
#include "xparameters.h"
#include "xuartns550.h"
#include "xil_printf.h"
#include "xil_exception.h"
#include "xscugic.h"

/**************************** 配置 ****************************/
#define UART_DEVICE_ID   XPAR_UARTNS550_0_DEVICE_ID
#define UART_BASEADDR    XPAR_UARTNS550_0_BASEADDR
#define UART_CLK_FREQ    XPAR_PS7_UART_0_UART_CLK_FREQ_HZ
#define UART_BAUD_RATE   115200

#define INTC_DEVICE_ID   XPAR_SCUGIC_0_DEVICE_ID
#define UART_INT_IRQ_ID  XPAR_FABRIC_AXI_UART16550_0_IP2INTC_IRPT_INTR

/**************************** 全局变量 ****************************/
XUartNs550 UartNs550;
XScuGic    Intc;

u8  RxChar;
volatile int RxFlag = 0;

/**************************** UART 中断回调 ****************************/
void UartNs550Handler(void *CallBackRef,
                      unsigned long Event,
                      unsigned int EventData)
{
    XUartNs550 *UartInstPtr = (XUartNs550 *)CallBackRef;

    switch (Event) {

    case XUN_EVENT_RECV_DATA:
        XUartNs550_Recv(UartInstPtr, &RxChar, 1);
        RxFlag = 1;
        break;

    case XUN_EVENT_SENT_DATA:
        /* 发送完成（EventData 是发送的字节数） */
        break;

    default:
        break;
    }
}

/**************************** 中断系统初始化 ****************************/
int SetupInterruptSystem(XScuGic *IntcInstPtr,
                         XUartNs550 *UartInstPtr)
{
    int Status;
    XScuGic_Config *IntcConfig;

    IntcConfig = XScuGic_LookupConfig(INTC_DEVICE_ID);
    if (!IntcConfig) return XST_FAILURE;

    Status = XScuGic_CfgInitialize(
        IntcInstPtr,
        IntcConfig,
        IntcConfig->CpuBaseAddress);
    if (Status != XST_SUCCESS) return XST_FAILURE;

    Xil_ExceptionInit();
    Xil_ExceptionRegisterHandler(
        XIL_EXCEPTION_ID_IRQ_INT,
        (Xil_ExceptionHandler)XScuGic_InterruptHandler,
        IntcInstPtr);

    Status = XScuGic_Connect(
        IntcInstPtr,
        UART_INT_IRQ_ID,
        (Xil_InterruptHandler)XUartNs550_InterruptHandler,
        (void *)UartInstPtr);
    if (Status != XST_SUCCESS) return XST_FAILURE;

    XScuGic_Enable(IntcInstPtr, UART_INT_IRQ_ID);
    Xil_ExceptionEnable();

    /* 注册 UART 回调 */
    XUartNs550_SetHandler(
        UartInstPtr,
        UartNs550Handler,
        (void *)UartInstPtr);

    /* 使能 RX / TX 中断（直接写 IER） */
    XUartNs550_WriteReg(
        UART_BASEADDR,
        XUN_IER_OFFSET,
        XUN_IER_RX_DATA | XUN_IER_TX_EMPTY);

    XUartNs550_EnableIntr(UART_BASEADDR);

    return XST_SUCCESS;
}

/**************************** 主函数 ****************************/
int main(void)
{
    int Status;

    Status = XUartNs550_Initialize(&UartNs550, UART_DEVICE_ID);
    if (Status != XST_SUCCESS) {
        xil_printf("UART init failed\r\n");
        return XST_FAILURE;
    }

    XUartNs550_SetBaud(
        UART_BASEADDR,
        UART_CLK_FREQ,
        UART_BAUD_RATE);

    Status = SetupInterruptSystem(&Intc, &UartNs550);
    if (Status != XST_SUCCESS) {
        xil_printf("Interrupt setup failed\r\n");
        return XST_FAILURE;
    }

    xil_printf("AXI UART16550 interrupt RX/TX ready\r\n");

    /* 主循环：完全不轮询 UART */
    while (1) {
        if (RxFlag) {
            XUartNs550_Send(&UartNs550, &RxChar, 1); // 回显
            RxFlag = 0;
        }
    }
}

```