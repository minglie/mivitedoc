# BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/0f8a0e08c2264ebc80eae40f3cfba2d1.png)
# 目标
1. 全局定时器产生时间戳
2. 私有定时器产生200ms中断回调,打印时间戳


# 裸机测试
```c
/************************************************************
 * SCU Timer 中断测试程序
 * - 使用 ARM Cortex-A9 的私有定时器 (SCU Timer)
 * - 定时周期 = 200ms
 * - 每次中断打印当前毫秒计数和翻转的状态位
 *
 * 硬件环境：
 *   - PS (Processing System) 内部的私有定时器
 *   - GIC (通用中断控制器)
 ************************************************************/

#include "xparameters.h"   // 包含器件的硬件参数 (Device ID、基地址等)
#include "xscutimer.h"     // SCU 定时器驱动函数声明
#include "xscugic.h"       // 中断控制器驱动函数声明
#include "xil_printf.h"    // 串口打印函数
#include "xtime_l.h"       // 全局计时器 (ARM Global Timer)

//========================= 硬件参数定义 =========================//

#define TIMER_DEVICE_ID   XPAR_XSCUTIMER_0_DEVICE_ID    // SCU 定时器 Device ID
#define INTC_DEVICE_ID    XPAR_SCUGIC_SINGLE_DEVICE_ID  // GIC Device ID
#define TIMER_IRPT_INTR   XPAR_SCUTIMER_INTR            // 定时器中断 ID

// SCU Timer 时钟频率 = CPU 时钟 / 2 = 333 MHz (假设 CPU = 666 MHz)
// 目标延时 = 200 ms
// 计算公式：LOAD_VALUE = T(s) * Freq - 1
//          = 0.2 * 333,000,000 - 1 ≈ 66,599,999
//          = 0x3F83C3F
#define TIMER_LOAD_VALUE  0x03F83C3F  // 定时器装载值，对应周期约 200ms

//========================= 全局实例 =========================//

XScuGic   Intc;    // 中断控制器实例
XScuTimer Timer;   // SCU 定时器实例

//========================= 工具函数 =========================//

/**
 * @brief 获取当前毫秒数 (基于 ARM 全局计数器)
 */
uint32_t BspGetMillis(void)
{
    XTime t;
    XTime_GetTime(&t);
    uint32_t ms = (uint32_t)(t / (COUNTS_PER_SECOND / 1000));
    return ms;
}

//========================= 定时器初始化 =========================//

/**
 * @brief 初始化 SCU 定时器
 */
int timer_init(XScuTimer *timer_ptr)
{
    int status;

    // 查找定时器配置
    XScuTimer_Config *timer_cfg_ptr = XScuTimer_LookupConfig(TIMER_DEVICE_ID);
    if (timer_cfg_ptr == NULL)
        return XST_FAILURE;

    // 初始化定时器实例
    status = XScuTimer_CfgInitialize(timer_ptr,
                                     timer_cfg_ptr,
                                     timer_cfg_ptr->BaseAddr);
    if (status != XST_SUCCESS)
        return XST_FAILURE;

    // 设置定时器周期
    XScuTimer_LoadTimer(timer_ptr, TIMER_LOAD_VALUE);

    // 设置为自动重载模式 (到期后自动重新装载)
    XScuTimer_EnableAutoReload(timer_ptr);

    return XST_SUCCESS;
}

//========================= 中断服务函数 =========================//

/**
 * @brief 定时器中断处理函数
 */
void timer_intr_handler(void *CallBackRef)
{
    static int toggle = 0;  // 翻转标志，用于显示状态
    XScuTimer *timer_ptr = (XScuTimer *)CallBackRef;

    // 打印当前时间和翻转状态
    xil_printf("%u ms  state=%d\r\n", BspGetMillis(), (toggle ^= 1));

    // 清除定时器中断标志位
    XScuTimer_ClearInterruptStatus(timer_ptr);
}

//========================= 中断初始化 =========================//

/**
 * @brief 初始化中断控制器并注册定时器中断
 */
void timer_intr_init(XScuGic *intc_ptr, XScuTimer *timer_ptr)
{
    // 查找 GIC 配置
    XScuGic_Config *intc_cfg_ptr = XScuGic_LookupConfig(INTC_DEVICE_ID);

    // 初始化 GIC
    XScuGic_CfgInitialize(intc_ptr,
                          intc_cfg_ptr,
                          intc_cfg_ptr->CpuBaseAddress);

    // 注册异常处理函数 (把 CPU 的中断入口指向 GIC 驱动)
    Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_INT,
                                 (Xil_ExceptionHandler)XScuGic_InterruptHandler,
                                 intc_ptr);
    Xil_ExceptionEnable();  // 使能 CPU 中断

    // 连接定时器中断到 GIC
    XScuGic_Connect(intc_ptr,
                    TIMER_IRPT_INTR,
                    (Xil_ExceptionHandler)timer_intr_handler,
                    (void *)timer_ptr);

    // 使能定时器中断 (GIC 和 SCU Timer 本身)
    XScuGic_Enable(intc_ptr, TIMER_IRPT_INTR);
    XScuTimer_EnableInterrupt(timer_ptr);
}

//========================= 主函数 =========================//
int main(void)
{
    int status;
    xil_printf("SCU Timer Interrupt Test Start\r\n");

    // 初始化定时器
    status = timer_init(&Timer);
    if (status != XST_SUCCESS) {
        xil_printf("Timer Initialization Failed\r\n");
        return XST_FAILURE;
    }
    // 初始化中断
    timer_intr_init(&Intc, &Timer);
    // 启动定时器
    XScuTimer_Start(&Timer);
    // 主循环空转，靠中断驱动
    while (1);
    return 0;
}
```
# 测试结果
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/a34fc1648d984f329ba51dc643aa938d.png)
