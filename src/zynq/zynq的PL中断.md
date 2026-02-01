# Zynq PL中断

在 Zynq 系统中，**PL 中断**是 PL向PS发出事件通知的重要机制。  
常见应用场景为 **中断通知**、**定时信号** 等。  
本文将详细介绍如何从 **Vivado 配置 → 裸机使用 → Device Tree 配置 → Linux 驱动 → Linux 应用**，一步步实现一个 PL 中断。
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/5ed91f7b38144e5da951f5dffc5f48be.png)


---



# 快速认知和中断编号映射
## ARM GIC 中断类型
ARM GIC 把中断分成三类：

- SGI – Software Generated Interrupt (0~15)
软件触发的中断，只在 CPU 核内传递

- PPI – Private Peripheral Interrupt (16~31)
每个 CPU 核独有的外设中断（如私有定时器）

- SPI – Shared Peripheral Interrupt (32 及以上)
所有 CPU 核共享的外设中断（如 PL 发过来的 IRQ、UART、以太网等）

## IRQ_F2P 中断

- **IRQ_F2P[n]（PL→PS）**：Zynq-7000 提供最多 16 路（n=0..15）。
- **GIC ID（裸机/UG 文档中看到的号）**：`IRQ_F2P[n]` → 61 + n。
- **Device Tree 的 `interrupts = <type num flags>`**：
  - `type=0` 表示 SPI；
  - `num = GIC_ID - 32`（因为 SPI 从 32 开始）；
  - `flags`：常用 1 = 上升沿，4 = 高电平。

  num 其实是该类型（type）下的中断号索引，而不是全局的 GIC ID
- **例子**：
  - `IRQ_F2P[0]` → GIC=61 → DTS 写 `<0 29 1>`；
  - `IRQ_F2P[1]` → GIC=62 → DTS 写 `<0 30 1>`。


# Vivado 配置（PL→PS 接线）

1. **启用 Fabric 中断**  
   双击 **ZYNQ7 Processing System** → *Interrupts* → 勾选 `IRQ_F2P[0:15]` 需要的通道。

2. **连接中断信号**  
   - 将你的 PL IP 的 `irq` 接到 `IRQ_F2P[n]`。  
   - 多路中断可先接入 Concat IP 再到 `IRQ_F2P` 的对应位。

3. **导出硬件**  
   生成 bitstream → **Export Hardware (include bitstream)**，供 Vitis/Linux 使用。


#  裸机环境使用 PL 中断

这里实际上是串口中断和PL中断的结合

## bsp.h
```c
#ifndef __BSP_H
#define __BSP_H
#include "stdint.h"
#ifdef __cplusplus
extern "C" {
#endif
void BspInit(void);
int  BspUartRead(uint8_t* buf, uint32_t len);
void BspUartWrite(uint8_t* buf, uint32_t len);
uint32_t BspGetMillis();
// 给 atshell用
int Bsp_shell_write(uint8_t* buf, uint32_t len,uint32_t timeout);
#ifdef __cplusplus
}
#endif
#endif 
```

## bsp.cpp
```c
#include "bsp.h"
#include "xuartps.h"
#include "xparameters.h"
#include "xscugic.h"
#include "sleep.h"
#include "xtime_l.h"
#include "FifoBuffer.h"


static FifoBuffer s_fifoBuffer(1024);

#define	UART1_RXBUF_SIZE		256
#define GIC_DEVICE_ID 				XPAR_PS7_SCUGIC_0_DEVICE_ID
#define UART0_DEVICE_ID		XPAR_XUARTPS_0_DEVICE_ID
#define UART0_INTR_ID 			XPAR_XUARTPS_0_INTR

// ======= 配置区：根据你的接线改这里 =======
#define PL_IRQ_ID61       61
#define PL_IRQ_ID62       62



// GIC 控制器实例
XScuGic intc;
static XUartPs UartPs;
static u8 UART1_RecBuf[UART1_RXBUF_SIZE];


static void HAL_UART_RxCpltCallback(uint8_t* buf, uint32_t len)
{
	s_fifoBuffer.Write(buf, len);
}


static void PL_IRQHandler(void *ctx) {
	uintptr_t irq_src = (uintptr_t)ctx;
	static int  irq_cnt=0;
	irq_cnt++;
	xil_printf("PL%d triggered %d!\r\n",irq_src,irq_cnt);
}



static void USART_IRQHandler(void *CallBackRef, u32 Event, unsigned int EventData){
	   u32 TotalReceivedCount;
	   int i;
	   if (Event == XUARTPS_EVENT_RECV_DATA) {
			TotalReceivedCount = EventData;
			if(TotalReceivedCount == UART1_RXBUF_SIZE) {
				HAL_UART_RxCpltCallback(UART1_RecBuf,TotalReceivedCount);
				XUartPs_Recv(&UartPs, UART1_RecBuf, UART1_RXBUF_SIZE);
				TotalReceivedCount=0;
			}
		}
		if (Event == XUARTPS_EVENT_RECV_TOUT) {
			TotalReceivedCount = EventData;
			HAL_UART_RxCpltCallback(UART1_RecBuf,TotalReceivedCount);
			XUartPs_Recv(&UartPs, UART1_RecBuf, UART1_RXBUF_SIZE);
			TotalReceivedCount=0;
		}

	 XUartPs_Recv(&UartPs, UART1_RecBuf, UART1_RXBUF_SIZE);
}




static int Irq_Init_All(void)
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
    // UART 常用电平触发(0x1)，示例优先级 0xA0
    XScuGic_SetPriorityTriggerType(&intc, UART0_INTR_ID, 0xA0, 0x1);
    // PL 直连 IRQ_F2P 通常上升沿(0x3)，示例优先级 0x80（高于 UART）
    XScuGic_SetPriorityTriggerType(&intc, PL_IRQ_ID61,     0x80, 0x3);
    XScuGic_SetPriorityTriggerType(&intc, PL_IRQ_ID62,     0x80, 0x3);
    // 4) 连接两个中断源
    status = XScuGic_Connect(&intc, UART0_INTR_ID,
                             (Xil_ExceptionHandler)XUartPs_InterruptHandler, &UartPs);
    if (status != XST_SUCCESS) return status;

    status = XScuGic_Connect(&intc, PL_IRQ_ID61,
                             (Xil_ExceptionHandler)PL_IRQHandler, (void*)0);
    status = XScuGic_Connect(&intc, PL_IRQ_ID62,
                                (Xil_ExceptionHandler)PL_IRQHandler, (void*)1);
    if (status != XST_SUCCESS) return status;

    // 5) 使能
    XScuGic_Enable(&intc, UART0_INTR_ID);
    XScuGic_Enable(&intc, PL_IRQ_ID61);
    XScuGic_Enable(&intc, PL_IRQ_ID62);
    // 6) 全局开中断（只此一次）
    Xil_ExceptionEnable();
    return XST_SUCCESS;
}






static int BspUartInit(){
	int status;
	u32 IntrMask;
	IntrMask = XUARTPS_IXR_TOUT | XUARTPS_IXR_PARITY | XUARTPS_IXR_FRAMING |
	XUARTPS_IXR_OVER | XUARTPS_IXR_TXEMPTY | XUARTPS_IXR_RXFULL |
	XUARTPS_IXR_RXOVR;
	XUartPs_Config *Config;
	Config = XUartPs_LookupConfig(UART0_DEVICE_ID);
	status = XUartPs_CfgInitialize(&UartPs, Config, Config->BaseAddress);
	status = XUartPs_SelfTest(&UartPs);
	XUartPs_SetBaudRate(&UartPs,115200);
	XUartPs_SetHandler(&UartPs,(XUartPs_Handler)USART_IRQHandler,&UartPs);
	XUartPs_SetInterruptMask(&UartPs, IntrMask);
	XUartPs_SetOperMode(&UartPs, XUARTPS_OPER_MODE_NORMAL);
	XUartPs_SetRecvTimeout(&UartPs, 20);
	XUartPs_Recv(&UartPs, UART1_RecBuf, 32);
	return status;
}



void BspUartWrite(uint8_t* buf, uint32_t len)
{

    u32 sent = 0;
	while (sent < len) {
		sent += XUartPs_Send(&UartPs, (u8*)buf + sent, len - sent);
	}
	return ;
}

int BspUartRead(uint8_t* buf, uint32_t len){
	uint32_t len1 = s_fifoBuffer.Read(buf, 1);
     return len1;
}


void BspInit(void){
	int status;
	status = Irq_Init_All();
	if(status != XST_SUCCESS){
		xil_printf("Irq_Init init error!\r\n");
		return ;
	}
	status = BspUartInit();
	if(status != XST_SUCCESS){
		xil_printf("uart init error !\r\n");
		return ;
	}
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
## FifoBuffer.h
```c
#ifndef _FifoBuffer
#define _FifoBuffer
#include "stdint.h"
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
#endif
```

## FifoBuffer.cpp
```c
#include "FifoBuffer.h"
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

```

## main.c
```c
#include "bsp.h"
int main(){
	static uint32_t s_ms_tick=0;
	BspInit();
	while (1) {
		uint32_t ms= BspGetMillis();
		if(ms-s_ms_tick>=10){
		   s_ms_tick=ms;
		   int len= BspUartRead((uint8_t *)AT_m_buf, -1);
		   //at_import((uint8_t *)AT_m_buf, len, ms);
		}
	}
	return 0;
}
```

# Device Tree 配置
## system-user.dtsi
```c
#include <dt-bindings/gpio/gpio.h>
#include <dt-bindings/input/input.h>
#include <dt-bindings/media/xilinx-vip.h>
#include <dt-bindings/phy/phy.h>

/ {
	model = "ant zynq Board";
	compatible = "xlnx,zynq-zc702", "xlnx,zynq-7000";
	chosen {
		bootargs = "console=ttyPS0,115200 earlycon root=/dev/mmcblk0p2 rw rootwait";
		stdout-path = "serial0:115200n8";
	};

    amba_pl {
        #address-cells = <1>;
        #size-cells = <1>;
        compatible = "simple-bus";
        ranges;
        pl_data@43c00000 {
            compatible = "xlnx,pl-data";
            reg = <0x43c00000 0x1000>;
        };
        pl_irqs@0 {
            compatible = "xlnx,pl-irqs";
            interrupt-parent = <&intc>;
            //对应的中断号是61,62
            interrupts = <0 29 1>,<0 30 1>;
        };
    };
};


```

# Linux驱动
## PL中断驱动
### pl_irq_notify.c 
```c
// pl_irq_notify.c
// 加载模块时可设置调试参数，例如： insmod pl_irq_notify.ko irq_debug=0
// 该驱动用于接收来自 PL（FPGA）侧的两个中断，并通过字符设备接口通知用户空间。

#include <linux/module.h>
#include <linux/init.h>
#include <linux/of.h>
#include <linux/of_irq.h>
#include <linux/interrupt.h>
#include <linux/platform_device.h>
#include <linux/fs.h>
#include <linux/miscdevice.h>
#include <linux/wait.h>
#include <linux/poll.h>
#include <linux/uaccess.h>

// 模块参数：irq_debug = 1 表示打印调试信息，0 表示不打印
static int irq_debug = 1;
module_param(irq_debug, int, 0644);
MODULE_PARM_DESC(irq_debug, "Enable IRQ debugging (0=disable, 1=enable)");

// 定义一个等待队列头，用于阻塞/唤醒用户进程
static DECLARE_WAIT_QUEUE_HEAD(wq_irq);

// 中断标志位：
//  0 表示无中断
//  1 表示 IRQ1 触发
//  2 表示 IRQ2 触发
static int irq_flag = 0;

/**
 * PL IRQ0 的中断处理函数
 * irq      - 中断号
 * dev_id   - 设备 ID，这里未使用（NULL）
 */
static irqreturn_t pl_irq_handler_0(int irq, void *dev_id)
{
    irq_flag = 1; // 标记 IRQ1 触发
    wake_up_interruptible(&wq_irq); // 唤醒等待队列上的进程
    if (irq_debug) {
        pr_info("[PL_IRQ] IRQ 1 triggered\n");
    }
    return IRQ_HANDLED; // 表示该中断已被正确处理
}

/**
 * PL IRQ1 的中断处理函数
 */
static irqreturn_t pl_irq_handler_1(int irq, void *dev_id)
{
    irq_flag = 2; // 标记 IRQ2 触发
    wake_up_interruptible(&wq_irq); // 唤醒等待队列上的进程
    if (irq_debug) {
        pr_info("[PL_IRQ] IRQ 2 triggered\n");
    }
    return IRQ_HANDLED;
}

/**
 * 用户空间 read() 接口
 * 当用户调用 read() 读取中断状态时，如果当前无中断（irq_flag=0），则阻塞等待
 */
static ssize_t pl_irq_read(struct file *file, char __user *buf, size_t len, loff_t *ppos)
{
    // 阻塞等待直到 irq_flag != 0（有中断发生）
    wait_event_interruptible(wq_irq, irq_flag != 0);

    int val = irq_flag; // 读取中断标志
    irq_flag = 0;       // 清除标志（防止重复读取）

    // 检查用户缓冲区大小
    if (len < sizeof(int))
        return -EINVAL;

    // 将中断编号写入用户空间
    if (copy_to_user(buf, &val, sizeof(int)))
        return -EFAULT;

    return sizeof(int);
}

/**
 * poll() / select() 接口
 * 支持用户使用 poll/select/epoll 等非阻塞方式检测中断
 */
static __poll_t pl_irq_poll(struct file *file, poll_table *wait)
{
    // 将等待队列添加到 poll 监控列表
    poll_wait(file, &wq_irq, wait);

    // 如果有中断数据可读，则返回可读标志
    if (irq_flag)
        return POLLIN | POLLRDNORM;

    return 0;
}

// 文件操作接口定义
static const struct file_operations irq_fops = {
    .owner = THIS_MODULE,
    .read  = pl_irq_read, // read() 系统调用
    .poll  = pl_irq_poll, // poll/select/epoll 调用
};

// 定义一个 misc 设备（/dev/pl_irq_notify）
static struct miscdevice irq_miscdev = {
    .minor = MISC_DYNAMIC_MINOR, // 自动分配次设备号
    .name  = "pl_irq_notify",    // 设备节点名：/dev/pl_irq_notify
    .fops  = &irq_fops,          // 文件操作函数
    .mode  = 0666,               // 设备权限（可读写）
};

/**
 * probe()：驱动与设备匹配成功后调用
 */
static int pl_irq_probe(struct platform_device *pdev)
{
    // 从设备树获取两个中断号
    int irq0 = platform_get_irq(pdev, 0);
    int irq1 = platform_get_irq(pdev, 1);
    int ret;

    if (irq0 < 0 || irq1 < 0) {
        dev_err(&pdev->dev, "Failed to get IRQs\n");
        return -EINVAL;
    }

    dev_info(&pdev->dev, "Requesting IRQs %d and %d\n", irq0, irq1);

    // 注册 IRQ0 处理函数
    ret = devm_request_irq(&pdev->dev, irq0, pl_irq_handler_0, 0, "pl_irq0", NULL);
    if (ret)
        return ret;

    // 注册 IRQ1 处理函数
    ret = devm_request_irq(&pdev->dev, irq1, pl_irq_handler_1, 0, "pl_irq1", NULL);
    if (ret)
        return ret;

    // 注册字符设备
    return misc_register(&irq_miscdev);
}

/**
 * remove()：设备移除时调用
 */
static int pl_irq_remove(struct platform_device *pdev)
{
    misc_deregister(&irq_miscdev);
    return 0;
}

// 设备树匹配表
static const struct of_device_id pl_irq_of_match[] = {
    { .compatible = "xlnx,pl-irqs" }, // 设备树中 compatible 属性
    {}
};
MODULE_DEVICE_TABLE(of, pl_irq_of_match);

// 平台驱动结构
static struct platform_driver pl_irq_driver = {
    .driver = {
        .name = "pl_irq_notify",
        .of_match_table = pl_irq_of_match,
    },
    .probe = pl_irq_probe,
    .remove = pl_irq_remove,
};

// 注册平台驱动入口
module_platform_driver(pl_irq_driver);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Ming");
MODULE_DESCRIPTION("PL IRQ notify driver with user space interface (dual IRQ)");



```
### Makefile
```
KERN_DIR :=/home/wpf/workspace/kernel-driver/zynq-xlnx

obj-m :=pl_irq_notify.o

all:
	make -C $(KERN_DIR) M=`pwd` modules
clean:
	make -C $(KERN_DIR) M=`pwd` clean

```
## PL寄存器驱动
### pl_data.c
```c
/**
 * test
 * hexdump -v -e '4/4 "%11u "' -e '"\n"' /dev/pl_data
 */

#include <linux/module.h>
#include <linux/init.h>
#include <linux/of.h>
#include <linux/platform_device.h>
#include <linux/fs.h>
#include <linux/uaccess.h>
#include <linux/io.h>
#include <linux/cdev.h>

#define DEVICE_NAME "pl_data"
#define DATA_REG_NUM 4  

static struct {
    void __iomem *regs_base;
    struct cdev cdev;
    dev_t devt;
    struct class *class;
} pl_dev;

static int pl_data_open(struct inode *inode, struct file *file)
{
    return 0;
}

static ssize_t pl_data_read(struct file *file, char __user *buf, size_t len, loff_t *off)
{
u32 values[DATA_REG_NUM];
int i;

if (*off != 0)
return 0;

for (i = 0; i < DATA_REG_NUM; i++)
values[i] = ioread32(pl_dev.regs_base + i * 4);

if (copy_to_user(buf, values, sizeof(values)))
return -EFAULT;

*off += sizeof(values);
return sizeof(values);
}

static const struct file_operations pl_data_fops = {
        .owner = THIS_MODULE,
        .open = pl_data_open,
        .read = pl_data_read,
};

static int pl_data_probe(struct platform_device *pdev)
{
    struct resource *res;
    int ret;

    res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
    pl_dev.regs_base = devm_ioremap_resource(&pdev->dev, res);
    if (IS_ERR(pl_dev.regs_base))
        return PTR_ERR(pl_dev.regs_base);

    ret = alloc_chrdev_region(&pl_dev.devt, 0, 1, DEVICE_NAME);
    if (ret)
        return ret;

    cdev_init(&pl_dev.cdev, &pl_data_fops);
    pl_dev.cdev.owner = THIS_MODULE;
    ret = cdev_add(&pl_dev.cdev, pl_dev.devt, 1);
    if (ret)
        goto unregister_region;

    pl_dev.class = class_create(THIS_MODULE, "pl_class");
    device_create(pl_dev.class, NULL, pl_dev.devt, NULL, DEVICE_NAME);

    dev_info(&pdev->dev, "pl_data driver loaded\n");
    return 0;

    unregister_region:
    unregister_chrdev_region(pl_dev.devt, 1);
    return ret;
}

static int pl_data_remove(struct platform_device *pdev)
{
    device_destroy(pl_dev.class, pl_dev.devt);
    class_destroy(pl_dev.class);
    cdev_del(&pl_dev.cdev);
    unregister_chrdev_region(pl_dev.devt, 1);
    return 0;
}

static const struct of_device_id pl_data_of_match[] = {
        { .compatible = "xlnx,pl-data", },
        {},
};
MODULE_DEVICE_TABLE(of, pl_data_of_match);

static struct platform_driver pl_data_driver = {
        .driver = {
                .name = "pl_data",
                .of_match_table = pl_data_of_match,
        },
        .probe = pl_data_probe,
        .remove = pl_data_remove,
};

module_platform_driver(pl_data_driver);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Ming");
MODULE_DESCRIPTION("Simple PL data access driver (4 registers)");

```
### Makefile
```
KERN_DIR :=/home/wpf/workspace/kernel-driver/zynq-xlnx

obj-m :=pl_data.o

all:
	make -C $(KERN_DIR) M=`pwd` modules
clean:
	make -C $(KERN_DIR) M=`pwd` clean
```

# Linux应用
## IrqThread.h
```c
#pragma once
#include <string>
#include <functional>
#include "pthread.h"

class ThreadBase {
public:
    ThreadBase() : thread_() {}
    virtual ~ThreadBase() {}

    void Start() {
        pthread_create(&thread_, nullptr, &ThreadBase::threadEntry, this);
    }
protected:
    virtual void Run() = 0; // 派生类实现
private:
    static void* threadEntry(void* arg) {
        ThreadBase* self = static_cast<ThreadBase*>(arg);
        self->Run();
        return nullptr;
    }

    pthread_t thread_;
};


class IrqThread : public ThreadBase {
public:
    using InterruptCallback = std::function<void()>;
    explicit IrqThread();
    static IrqThread *  m_instance;
    static IrqThread *  GetInstance();
    ~IrqThread() ;
    bool Init();
    void RegisterIRQ1Callback(InterruptCallback callback);
    void RegisterIRQ2Callback(InterruptCallback callback);
    uint32_t GetInterruptCount() const;

protected:
    void Run() ;

private:
    int m_fd;
    bool m_isInitialized;
    std::uint32_t m_interruptCount;
    InterruptCallback m_irq1Callback;
    InterruptCallback m_irq2Callback;
    IrqThread(const IrqThread&) = delete;
    IrqThread& operator=(const IrqThread&) = delete;
};
```
## IrqThread.cpp
```c
#include "IrqThread.h"
#include <fcntl.h>
#include <unistd.h>
#include <poll.h>
#include <iostream>
#include <chrono>
#include <cstring>


IrqThread * IrqThread::m_instance=nullptr;
IrqThread::IrqThread():m_fd(-1), m_isInitialized(false), m_interruptCount(0) {
    IrqThread::m_instance= this;
}

IrqThread::~IrqThread() {
    if (m_isInitialized && m_fd >= 0) {
        close(m_fd);
    }
}

IrqThread *IrqThread::GetInstance() {
    return IrqThread::m_instance;
}

bool IrqThread::Init() {
    if (m_isInitialized) {
        return true;
    }
    m_fd = open("/dev/pl_irq_notify", O_RDONLY);
    if (m_fd < 0) {
        std::cerr << "Cannot open " << "/dev/pl_irq_notify" << ": " << strerror(errno) << std::endl;
        return false;
    }
    m_isInitialized = true;
    return true;
}

void IrqThread::RegisterIRQ1Callback(InterruptCallback callback) {
    m_irq1Callback = callback;
}

void IrqThread::RegisterIRQ2Callback(InterruptCallback callback) {
    m_irq2Callback = callback;
}

uint32_t IrqThread::GetInterruptCount() const {
    return m_interruptCount;
}


void IrqThread::Run() {
        Init();
        struct pollfd pfd;
        pfd.fd = m_fd;
        pfd.events = POLLIN;
        struct sched_param param;
        param.sched_priority = 80;  // 取值范围通常为 1~99，越高优先级越高
        int err = pthread_setschedparam(pthread_self(), SCHED_FIFO, &param);
        if (err != 0) {
            std::cerr << "Failed to set SCHED_FIFO: " << strerror(err) << std::endl;
        }
        while (true) {
            int ret = poll(&pfd, 1, -1);
            if (ret < 0) {
                if (errno == EINTR) {
                    continue; // 被信号中断，继续等待
                }
                std::cerr << "Poll error: " << strerror(errno) << std::endl;
                break;
            }
            if (ret > 0 && (pfd.revents & POLLIN)) {
                //中断号
                int irq_val;
                ssize_t len = read(m_fd, &irq_val, sizeof(irq_val));
                if (len == sizeof(irq_val)) {
                    m_interruptCount++;
                    std::cout << "IRQ: " << irq_val << std::endl;
                    if (m_irq1Callback && irq_val==1) {
                        m_irq1Callback();
                    }
                } else if (len < 0) {
                    std::cerr << "Read error: " << strerror(errno) << std::endl;
                }
            }
        }
    }

```