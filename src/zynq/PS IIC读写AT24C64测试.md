# BD
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/fbed06d45a2842e9be81a5b1be1fbb94.png)
```bash
set_property PACKAGE_PIN E18 [get_ports IIC_EMIO_scl_io]
set_property PACKAGE_PIN F17 [get_ports IIC_EMIO_sda_io]
set_property IOSTANDARD LVCMOS33 [get_ports IIC_EMIO_scl_io]
set_property IOSTANDARD LVCMOS33 [get_ports IIC_EMIO_sda_io]
```
# 目标
1.  写一页32字节,读出校验

# 裸机测试
```c
/*
 * i2c_eeprom_intr_example.c
 *
 * I2C (XIicPs) EEPROM 中断示例代码
 * 目标平台：Xilinx Zynq (XIicPs 驱动和 XScuGic 中断控制器)
 *
 * 功能概述：
 *  - 在总线上检测板载 EEPROM（Slave Monitor 模式）
 *  - 向 EEPROM 写入一页数据（page write）
 *  - 从 EEPROM 读取一页数据并验证读写一致性
 *  - 使用中断驱动的主机发送/接收（非阻塞），通过回调更新完成标志
 *
 * 说明：该文件保持与 Xilinx XIicPs API 的兼容性，示例仅用于参考与学习，
 * 在生产环境中应添加更完备的错误处理与超时机制。
 */

/***************************** Include Files *********************************/
#include "xparameters.h"
#include "sleep.h"
#include "xiicps.h"
#include "xscugic.h"
#include "xil_exception.h"
#include "xil_printf.h"
#include "xplatform_info.h"
#include "xil_types.h" /* 提供 u8/u16/u32/TRUE/FALSE 等类型定义 */

/************************** Constant Definitions *****************************/
/* 中断控制器和 I2C 设备在 xparameters.h 中的定义 */
#define INTC_DEVICE_ID      XPAR_SCUGIC_SINGLE_DEVICE_ID
#define I2C0_DEVICE_ID      XPAR_XIICPS_0_DEVICE_ID
#define I2C0_INT_ID         XPAR_XIICPS_0_INTR

/* I2C（SCL）频率 (Hz) */
#define IIC_SCLK_RATE       100000U

/* 从监控（slave monitor）等待循环最大计数（用于简易超时） */
#define SLV_MON_LOOP_COUNT  0x0001FFFFU

/* EEPROM 相关常量：页大小与默认起始地址（根据板卡实际器件调整） */
#define PAGE_SIZE_32        32U
#define EEPROM_START_ADDRESS 0U

/**************************** Type Definitions *******************************/
typedef u16 AddressType; /* EEPROM 内部地址类型（2 字节地址） */

/************************** Function Prototypes ******************************/
int IicPsEepromIntrExample(void);
static int EepromWriteData(XIicPs *IicInstance, u16 ByteCount);
static int EepromReadData(XIicPs *IicInstance, u8 *BufferPtr, u16 ByteCount);
static void Handler(void *CallBackRef, u32 Event);
static int IicPsSlaveMonitor(u16 Address, u16 DeviceId, u32 Int_Id);
static int SetupInterruptSystem(XIicPs *IicPsPtr, u32 Int_Id);
static int IicPsFindEeprom(u16 *EepromSlvAddr, u32 *PageSize);
static int IicPsConfig(u16 DeviceId, u32 Int_Id);

/************************** Variable Definitions *****************************/
static XIicPs IicInstance;      /* XIicPs 驱动实例（静态作用域） */
static XScuGic GicInstance;     /* 中断控制器驱动实例 */

/* 写、读缓冲区。
 * 写缓冲区前面保留两个字节用于 EEPROM 内部地址（高字节、低字节）
 */
static u8 WriteBuffer[sizeof(AddressType) + PAGE_SIZE_32];
static u8 ReadBuffer[PAGE_SIZE_32];

/* 由中断回调维护的状态标志（volatile：在中断/主循环间共享） */
static volatile u8 TransmitComplete = FALSE; /* 主发送完成 */
static volatile u8 ReceiveComplete = FALSE;  /* 主接收完成 */
static volatile u32 TotalErrorCount = 0U;    /* 错误计数（例如 NACK） */
static volatile u32 SlaveResponse = FALSE;   /* 从机在 slave-monitor 模式下响应 */

/* EEPROM 地址与页大小信息（可根据板卡调整） */
static u16 EepromAddr = 0x50U; /* 设备的 7-bit 地址（常见板载 EEPROM 示例） */
static u16 EepromSlvAddr = 0U; /* 通过探测得到的实际从机地址 */
static u32 PageSize = PAGE_SIZE_32; /* 通过探测得到的页大小 */

/************************** Function Definitions *****************************/
/**
 * main - 程序入口
 * 调用 I2C EEPROM 中断示例并打印读取的数据
 */
int main(void)
{
    int Status;
    int Index;

    xil_printf("IIC EEPROM Interrupt Example Test \r\n");

    /* 运行 EEPROM 中断示例，返回 XST_SUCCESS 表示成功 */
    Status = IicPsEepromIntrExample();
    if (Status != XST_SUCCESS) {
        xil_printf("IIC EEPROM Interrupt Example Test Failed\r\n");
        return XST_FAILURE;
    }

    xil_printf("Successfully ran IIC EEPROM Interrupt Example Test\r\n");

    /* 打印读取回来的数据（按字节） */
    for (Index = 0; Index < (int)PageSize; Index++) {
        xil_printf("eeprom word address is %d\t, Data is %d\n", Index, ReadBuffer[Index]);
    }

    return XST_SUCCESS;
}

/**
 * IicPsEepromIntrExample - 示例的主逻辑
 * 1) 探测 EEPROM
 * 2) 准备写入缓冲区并写入一页数据
 * 3) 读取该页并比对验证
 */
int IicPsEepromIntrExample()
{
    u32 Index;
    int Status;
    AddressType Address = (AddressType)EEPROM_START_ADDRESS;
    int WrBfrOffset;

    /* 查找并确认 EEPROM 是否存在，以及页大小 */
    Status = IicPsFindEeprom(&EepromSlvAddr, &PageSize);
    if (Status != XST_SUCCESS) {
        xil_printf("Failed to find EEPROM on I2C bus\n");
        return XST_FAILURE;
    }

    /* 初始化写缓冲区：前两个字节为 EEPROM 内部地址（高字节、低字节） */
    WriteBuffer[0] = (u8)(Address >> 8);
    WriteBuffer[1] = (u8)(Address & 0xFFU);
    WrBfrOffset = 2;

    /* 构造测试数据并清空读取缓冲区 */
    for (Index = 0; Index < PageSize; Index++) {
        WriteBuffer[WrBfrOffset + Index] = (u8)Index; /* 测试数据：0..PageSize-1 */
        ReadBuffer[Index] = 0U;
    }

    /* 将一页数据写入 EEPROM（中断驱动） */
    Status = EepromWriteData(&IicInstance, (u16)(WrBfrOffset + PageSize));
    if (Status != XST_SUCCESS) {
        xil_printf("EepromWriteData failed\n");
        return XST_FAILURE;
    }

    /* 从 EEPROM 读取数据（中断驱动） */
    Status = EepromReadData(&IicInstance, ReadBuffer, (u16)PageSize);
    if (Status != XST_SUCCESS) {
        xil_printf("EepromReadData failed\n");
        return XST_FAILURE;
    }

    /* 验证读取的数据是否与写入的数据一致 */
    for (Index = 0; Index < PageSize; Index++) {
        if (ReadBuffer[Index] != WriteBuffer[WrBfrOffset + Index]) {
            xil_printf("Data mismatch at index %d: wrote %d, read %d\n",
                       Index, WriteBuffer[WrBfrOffset + Index], ReadBuffer[Index]);
            return XST_FAILURE;
        }
    }

    return XST_SUCCESS;
}

/**
 * IicPsFindEeprom - 查找并确认板载 EEPROM
 * @param EepromSlvAddr: OUT，找到的 EEPROM 从机地址
 * @param PageSize: OUT，EEPROM 页大小（字节）
 *
 * 这里简单使用板载固定地址（EepromAddr）进行从机监控检测。
 */
static int IicPsFindEeprom(u16 *EepromSlvAddr, u32 *PageSize)
{
    int Status;

    /* 使用从机监控检测 EEPROM 是否在总线上响应 */
    Status = IicPsSlaveMonitor(EepromAddr, I2C0_DEVICE_ID, I2C0_INT_ID);
    if (Status == XST_SUCCESS) {
        *EepromSlvAddr = EepromAddr;
        *PageSize = PAGE_SIZE_32;
        return XST_SUCCESS;
    }

    return XST_FAILURE;
}

/**
 * SetupInterruptSystem - 建立并初始化中断系统，使能 XIicPs 的中断
 * @param IicPsPtr: 指向 XIicPs 实例的指针（用于中断处理参数）
 * @param Int_Id: 来自 xparameters.h 的外设中断 ID
 *
 * 步骤：
 *  - 初始化 GIC
 *  - 注册 IRQ 异常处理器
 *  - 将 XIicPs 的 MasterInterruptHandler 关联到指定中断源
 */
static int SetupInterruptSystem(XIicPs *IicPsPtr, u32 Int_Id)
{
    XScuGic_Config *IntcConfig;

    /* 查找中断控制器配置并初始化 */
    IntcConfig = XScuGic_LookupConfig(INTC_DEVICE_ID);
    if (IntcConfig == NULL) {
        xil_printf("XScuGic_LookupConfig failed\n");
        return XST_FAILURE;
    }

    XScuGic_CfgInitialize(&GicInstance, IntcConfig, IntcConfig->CpuBaseAddress);

    /* 注册外部中断异常处理并使能 */
    Xil_ExceptionInit();
    Xil_ExceptionRegisterHandler(XIL_EXCEPTION_ID_IRQ_INT,
                                 (Xil_ExceptionHandler)XScuGic_InterruptHandler,
                                 &GicInstance);
    Xil_ExceptionEnable();

    /* 将 XIicPs 的中断处理程序（MasterInterruptHandler）关联到中断控制器 */
    XScuGic_Connect(&GicInstance, Int_Id,
                    (Xil_InterruptHandler)XIicPs_MasterInterruptHandler,
                    (void *)IicPsPtr);

    /* 使能该中断 ID */
    XScuGic_Enable(&GicInstance, Int_Id);

    return XST_SUCCESS;
}

/**
 * Handler - IIC 中断回调（由 XIicPs 调用）
 * @param CallBackRef: 回调时传入的引用（这里传入 XIicPs 实例指针）
 * @param Event: XIicPs 事件掩码，包含发送/接收完成、从机就绪、错误等
 *
 * 该函数只更新状态标志量，实际的长期等待/处理在主线程中完成。
 */
static void Handler(void *CallBackRef, u32 Event)
{
    /* 完成发送 */
    if ((Event & XIICPS_EVENT_COMPLETE_SEND) != 0U) {
        TransmitComplete = TRUE;
        return;
    }

    /* 完成接收 */
    if ((Event & XIICPS_EVENT_COMPLETE_RECV) != 0U) {
        ReceiveComplete = TRUE;
        return;
    }

    /* 从机在 slave-monitor 下就绪（被检测到） */
    if ((Event & XIICPS_EVENT_SLAVE_RDY) != 0U) {
        SlaveResponse = TRUE;
        return;
    }

    /* 其他错误（例如 NACK） */
    if ((Event & XIICPS_EVENT_ERROR) != 0U) {
        TotalErrorCount++;
        return;
    }
}

/**
 * IicPsConfig - 初始化 XIicPs 驱动并设置中断回调
 * @param DeviceId: XIicPs 设备 ID
 * @param Int_Id: 中断 ID
 *
 * 执行：
 *  - 查找并初始化 XIicPs
 *  - 配置中断系统
 *  - 注册 status handler
 *  - 设置串行时钟
 */
static int IicPsConfig(u16 DeviceId, u32 Int_Id)
{
    XIicPs_Config *ConfigPtr;

    ConfigPtr = XIicPs_LookupConfig(DeviceId);
    if (ConfigPtr == NULL) {
        xil_printf("XIicPs_LookupConfig failed\n");
        return XST_FAILURE;
    }

    XIicPs_CfgInitialize(&IicInstance, ConfigPtr, ConfigPtr->BaseAddress);

    /* 初始化中断系统并与 XIicPs 关联 */
    if (SetupInterruptSystem(&IicInstance, Int_Id) != XST_SUCCESS) {
        xil_printf("SetupInterruptSystem failed\n");
        return XST_FAILURE;
    }

    /* 设置 XIicPs 的状态处理回调，当发生事件时调用 Handler */
    XIicPs_SetStatusHandler(&IicInstance, (void *)&IicInstance,
                            (XIicPs_IntrHandler)Handler);

    /* 设置 I2C 时钟频率 */
    XIicPs_SetSClk(&IicInstance, IIC_SCLK_RATE);

    return XST_SUCCESS;
}

/**
 * IicPsSlaveMonitor - 使用从监控模式检测从机是否在总线上
 * @param Address: 从机 7-bit 地址
 * @param DeviceId: XIicPs 设备 ID
 * @param Int_Id: 中断 ID
 *
 * 流程：
 *  - 初始化 IIC
 *  - 禁用所有外部中断（在探测期间）
 *  - 开启从机监控并等待 SlaveResponse 或错误/超时
 */
static int IicPsSlaveMonitor(u16 Address, u16 DeviceId, u32 Int_Id)
{
    u32 Index = 0U;
    XIicPs *IicPtr;

    SlaveResponse = FALSE;
    TotalErrorCount = 0U;

    /* 初始化 IIC（并建立中断） */
    if (IicPsConfig(DeviceId, Int_Id) != XST_SUCCESS) {
        return XST_FAILURE;
    }

    IicPtr = &IicInstance;

    /* 禁用所有 IIC 中断（在进入 slave monitor 前），再启动 slave monitor */
    XIicPs_DisableAllInterrupts(IicPtr->Config.BaseAddress);
    XIicPs_EnableSlaveMonitor(&IicInstance, Address);

    /* 等待 slave 在 slave-monitor 模式下响应，或发生错误、超时 */
    while ((!SlaveResponse) && (Index < SLV_MON_LOOP_COUNT)) {
        Index++;
        if (TotalErrorCount != 0U) {
            xil_printf("Test error unexpected NACK\n");
            /* 在检测到错误后，可选择禁用 slave monitor 并返回失败 */
            XIicPs_DisableSlaveMonitor(&IicInstance);
            return XST_FAILURE;
        }
    }

    if (Index >= SLV_MON_LOOP_COUNT) {
        /* 超时，未检测到从机响应 */
        XIicPs_DisableSlaveMonitor(&IicInstance);
        return XST_FAILURE;
    }

    XIicPs_DisableSlaveMonitor(&IicInstance);
    return XST_SUCCESS;
}

/**
 * EepromWriteData - 将缓冲区中的 ByteCount 字节写入 EEPROM
 * @param IicInstance: XIicPs 实例指针
 * @param ByteCount: 要写入的字节数（含前导地址字节）
 *
 * 说明：
 *  - 使用中断驱动方式发送数据（XIicPs_MasterSend）
 *  - 等待 TransmitComplete 标志被回调置位
 *  - 等待总线空闲
 *  - 在写入 EEPROM 后等待器件内部写入延时（这里使用 10ms）
 */
static int EepromWriteData(XIicPs *IicInstance, u16 ByteCount)
{
    TransmitComplete = FALSE;

    /* 发起主发送（中断驱动） */
    XIicPs_MasterSend(IicInstance, WriteBuffer, ByteCount, EepromSlvAddr);

    /* 等待发送完成或出现错误 */
    while (TransmitComplete == FALSE) {
        if (TotalErrorCount != 0U) {
            xil_printf("EepromWriteData: TotalErrorCount != 0\n");
            return XST_FAILURE;
        }
    }

    /* 等待 I2C 总线空闲，确保传输已完成 */
    while (XIicPs_BusIsBusy(IicInstance)) {
        /* 自旋等待；在实际代码中可加入超时保护 */
    }

    /* EEPROM 内部写入需要时间，常见器件最大写入延时为 10ms（AT24Cxx） */
    usleep(10000);

    return XST_SUCCESS;
}

/**
 * EepromReadData - 读取 EEPROM 中的 ByteCount 字节并写入 BufferPtr
 * @param IicInstance: XIicPs 实例指针
 * @param BufferPtr: 输出缓冲区指针（至少 ByteCount 大小）
 * @param ByteCount: 要读取的字节数
 *
 * 说明：读取流程为：先写入 2 字节的内部地址（随机读设置地址指针），
 * 然后执行主接收以获取数据。
 */
static int EepromReadData(XIicPs *IicInstance, u8 *BufferPtr, u16 ByteCount)
{
    AddressType Address = (AddressType)EEPROM_START_ADDRESS;
    int WrBfrOffset = 2; /* 地址占用 2 字节 */

    /* 将内部地址写入写缓冲区（高字节、低字节） */
    WriteBuffer[0] = (u8)(Address >> 8);
    WriteBuffer[1] = (u8)(Address & 0xFFU);

    /* 通过写入地址触发内部地址指针设置（这次写操作不携带实际数据） */
    if (EepromWriteData(IicInstance, (u16)WrBfrOffset) != XST_SUCCESS) {
        xil_printf("EepromReadData: set address pointer failed\n");
        return XST_FAILURE;
    }

    ReceiveComplete = FALSE;

    /* 发起主接收（中断驱动） */
    XIicPs_MasterRecv(IicInstance, BufferPtr, ByteCount, EepromSlvAddr);

    /* 等待接收完成或错误 */
    while (ReceiveComplete == FALSE) {
        if (TotalErrorCount != 0U) {
            xil_printf("EepromReadData: TotalErrorCount != 0\n");
            return XST_FAILURE;
        }
    }

    /* 等待总线空闲 */
    while (XIicPs_BusIsBusy(IicInstance)) {
        /* 自旋等待；在实际代码中可加入超时保护 */
    }

    return XST_SUCCESS;
}

```
# 测试结果
串口打印
```c
[10:37:31.880]收←◆IIC EEPROM Interrupt Example Test 
Successfully ran IIC EEPROM Interrupt Example Test
eeprom word address is 0	, Data is 0
eeprom word address is 1	, Data is 1
eeprom word address is 2	, Data is 2
eeprom word address is 3	, Data is 3
eeprom word address is 4	, Data is 4
eeprom word address is 5	, Data is 5
eeprom word address is 6	, Data is 6
eeprom word address is 7	, Data is 7
eeprom word address is 8	, Data is 8
eeprom word address is 9	, Data is 9
eeprom word address is 10	, Data is 10
eeprom word address is 11	, Data is 11
eeprom word address is 12	, Data is 12
eeprom word address is 13	, Data is 13
eeprom word address is 14	, Data is 14
eeprom word address is 15	, Data is 15
eeprom word address is 16	, Data is 16
eeprom word address is 17	, Data is 17
eeprom word address is 18	, Data is 18
eeprom word address is 19	, Data is 19
eeprom word address is 20	, Data is 20
eeprom word address is 21	, Data is 21
eeprom word address is 22	, Data is 22
eeprom word address is 23	, Data is 23
eeprom word address is 24	, Data is 24
eeprom word address is 25	, Data is 25
eeprom word address is 26	, Data is 26
eeprom word address is 27	, Data is 27
eeprom word address is 28	, Data is 28
eeprom word address is 29	, Data is 29
eeprom word address is 30	, Data is 30
eeprom word address is 31	, Data is 31
```