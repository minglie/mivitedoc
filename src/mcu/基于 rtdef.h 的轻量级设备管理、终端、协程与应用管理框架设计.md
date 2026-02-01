# 背景

- [**FreeRTOS** ](https://www.freertos.org/zh-cn-cmn-s/Documentation/02-Kernel/04-API-references/01-Task-creation/00-TaskHandle)内核轻量，但原生欠缺 **设备管理 / Shell / 应用管理** 等上层能力。  
-  [**RT-Thread**](https://github.com/RT-Thread/rt-thread/blob/master/README_zh.md)的  [rtdef.h](https://github.com/RT-Thread/rt-thread/blob/master/include/rtdef.h) 提供了大量**类型和宏**，值得借鉴。

# wokwi 在线演示
[wokwi演示](https://wokwi.com/projects/441090423922851841)
# 目标
在 **FreeRTOS / 裸机** 下，借鉴 RT-Thread的 `rtdef.h`，做一套**轻量可移植**的设备访问框架。  
- 用**统一的数据类型/宏/函数名**。  
- 应用层 API 保持不变；移植新平台仅改 **BSP** 与 **设备抽象层**，改动最小。
- 功能即文件,增删模块只需增删文件，应用层零改动。



# 📌 分层设计

> 设计目标：**上层稳定、下层可换**——跨平台仅需替换 **BSP** 与 **设备抽象层**，应用层零改动。

| 层级 | 主要职责 | 通用示例/模块 | STM32 生态示例 | Zynq/Vitis 生态示例 | 目的 |
|---|---|---|---|---|---|
| **硬件层** | 芯片与外设，提供基础硬件资源 | MCU/SoC，GPIO，UART，I²C，SPI，定时器，中断控制器 | STM32 芯片、外设寄存器 | Zynq SoC（PS+PL）、外设 IP 核 | 提供最底层算力与外设能力，构建系统物理基础 |
| **BSP 层（硬件驱动层）** | 板级支持包，封装硬件初始化与底层驱动 | 时钟/串口初始化，引脚配置，启动文件 | **HAL/LL** 官方驱动与启动代码（CubeMX 生成） | **BSP 工程**（Vitis 生成：驱动、启动文件、`xparameters.h`） | 屏蔽同公司,同类型的芯片差异，为上层提供一致的底层接口 |
| **内核层** | 任务调度、同步、内存管理、（可选）设备管理 | FreeRTOS：task、queue、semaphore、heap | FreeRTOS（task/queue/semaphore 等） | FreeRTOS / standalone runtime（Vitis 可选） | 提供调度与资源管理的通用能力 |
| **设备抽象层（Device）** | 基于对象的设备抽象与统一接口管理 | `rt_device` 风格：注册/查找/控制（open/read/write/ioctl） | `adc_dev.cpp`、`led_dev.cpp` 等（基于 HAL 的封装） |  `adc_dev.cpp`基于Platform 驱动封装 | 将 BSP 非统一接口**适配为一致 API**，提升可移植性与可维护性 |
| **应用层** | 业务逻辑、任务/协程、Shell | 命令行 Shell，应用加载/调度，协程框架 | 传感器采集、协议栈、Shell | SDK C 应用、RPC 框架、Shell | 提供最终功能与交互，支撑业务扩展 |


## 🔗 调用关系说明

| 层级        | 谁调用它      | 它调用谁            | 关系说明                                                   |
| --------- | --------- | --------------- | ------------------------------------------------------ |
| **硬件层**   | BSP 层     | 无               | 最底层，只提供寄存器和外设功能                                        |
| **BSP层** | 设备抽象层、内核层 | 硬件层             | 提供初始化和最原始的驱动函数接口                                       |
| **内核层**   | 设备抽象层、应用层 | BSP 层（启动时）、硬件中断 | 提供调度、内存、同步机制；处理硬件中断并向上通知                               |
| **设备抽象层** | 应用层       | 内核层、BSP 层       | 将 BSP 驱动包装为统一对象接口（open/read/write/control），依赖内核完成同步与调度 |
| **应用层**   | 用户交互      | 设备抽象层、内核层       | 通过设备接口访问硬件，通过内核接口管理任务、队列、协程                            |

### 自上而下：功能调用链
```markdown
应用层 → 设备抽象层 → BSP层 → 硬件层
```
### 自下而上：事件/中断 回调反向传递
```markdown
硬件层 → BSP 层 → 内核层（中断处理、调度唤醒） → 设备抽象层 → 应用层
```
## 应用层如何调用设备抽象层
- 为了移植方便,应用层只能用固定的方法调用设备层,
- 应用层不能直接调用bsp层,bsp层更不能调用应用层。
- 如果嫌麻烦,可以对下面接口进行封装
### 在应用层设备查找,初始化和读写和命令执行
```c
rt_device_t rt_device_find(const char* name);
rt_err_t  rt_device_open(rt_device_t dev, rt_uint16_t oflag);
rt_err_t  rt_device_close(rt_device_t dev);
rt_size_t rt_device_read(rt_device_t dev,  rt_off_t   pos, void* buffer, rt_size_t   size);
rt_size_t rt_device_write(rt_device_t dev, rt_off_t    pos, const void* buffer, rt_size_t   size);
rt_err_t  rt_device_control(rt_device_t dev, int cmd, void* arg);
```
### 应用层给设备层传递回调函数
我习惯把“硬件关联密切”的队列（如 **UART RX** 环形缓冲）放在**设备抽象层**； 
应用层**不注册回调**，直接用 `rt_device_read()` **轮询**读取数据。
如果非要传递回调可用下面方法，设备抽象层再把应用层的回调函数传给BSP层
```c
rt_err_t rt_device_set_rx_indicate(rt_device_t dev, rt_err_t(*rx_ind)(rt_device_t dev, rt_size_t size));
//或者
rt_device_control(dev,SET_RECV_CB,cb)
```
# 内核层
这是个不完善的内核层，仅用于向应用层提供统一的设备访问接口；
跨平台时仅需替换 BSP 层 与 设备抽象层，应用层代码保持不变。之所以需要改动设备抽象层，是因为它要适配各平台 BSP 的非统一接口
## 基础定义
 ### [参考rtdef.h](https://github.com/RT-Thread/rt-thread/blob/master/include/rtdef.h)

### rtdef.h
```c

#ifndef __RT_DEF_H__
#define __RT_DEF_H__

/* include rtconfig header to import configuration */

#define RT_USING_DEVICE 

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @addtogroup BasicDef
 */

/*@{*/

/* RT-Thread version information */
#define RT_VERSION                      3L              /**< major version number */
#define RT_SUBVERSION                   1L              /**< minor version number */
#define RT_REVISION                     0L              /**< revise version number */

/* RT-Thread version */
#define RTTHREAD_VERSION                ((RT_VERSION * 10000) + \
                                         (RT_SUBVERSION * 100) + RT_REVISION)

/* RT-Thread basic data type definitions */
typedef signed   char                   rt_int8_t;      /**<  8bit integer type */
typedef signed   short                  rt_int16_t;     /**< 16bit integer type */
typedef signed   long                   rt_int32_t;     /**< 32bit integer type */
typedef unsigned char                   rt_uint8_t;     /**<  8bit unsigned integer type */
typedef unsigned short                  rt_uint16_t;    /**< 16bit unsigned integer type */
typedef unsigned long                   rt_uint32_t;    /**< 32bit unsigned integer type */
typedef int                             rt_bool_t;      /**< boolean type */

/* 32bit CPU */
typedef long                            rt_base_t;      /**< Nbit CPU related date type */
typedef unsigned long                   rt_ubase_t;     /**< Nbit unsigned CPU related data type */

typedef rt_base_t                       rt_err_t;       /**< Type for error number */
typedef rt_uint32_t                     rt_time_t;      /**< Type for time stamp */
typedef rt_uint32_t                     rt_tick_t;      /**< Type for tick count */
typedef rt_base_t                       rt_flag_t;      /**< Type for flags */
typedef rt_ubase_t                      rt_size_t;      /**< Type for size number */
typedef rt_ubase_t                      rt_dev_t;       /**< Type for device */
typedef rt_base_t                       rt_off_t;       /**< Type for offset */

/* boolean type definitions */
#define RT_TRUE                         1               /**< boolean true  */
#define RT_FALSE                        0               /**< boolean fails */

/*@}*/

/* maximum value of base type */
#define RT_UINT8_MAX                    0xff            /**< Maxium number of UINT8 */
#define RT_UINT16_MAX                   0xffff          /**< Maxium number of UINT16 */
#define RT_UINT32_MAX                   0xffffffff      /**< Maxium number of UINT32 */
#define RT_TICK_MAX                     RT_UINT32_MAX   /**< Maxium number of tick */

/* Compiler Related Definitions */
#ifdef __CC_ARM                         /* ARM Compiler */
    #include <stdarg.h>
    #define SECTION(x)                  __attribute__((section(x)))
    #define RT_UNUSED                   __attribute__((unused))
    #define RT_USED                     __attribute__((used))
    #define ALIGN(n)                    __attribute__((aligned(n)))
    #define RT_WEAK                     __weak
    #define rt_inline                   static __inline
    /* module compiling */
    #ifdef RT_USING_MODULE
        #define RTT_API                 __declspec(dllimport)
    #else
        #define RTT_API                 __declspec(dllexport)
    #endif

#elif defined (__IAR_SYSTEMS_ICC__)     /* for IAR Compiler */
    #include <stdarg.h>
    #define SECTION(x)                  @ x
    #define RT_UNUSED
    #define RT_USED                     __root
    #define PRAGMA(x)                   _Pragma(#x)
    #define ALIGN(n)                    PRAGMA(data_alignment=n)
    #define RT_WEAK                     __weak
    #define rt_inline                   static inline
    #define RTT_API

#elif defined (__GNUC__)                /* GNU GCC Compiler */
    #ifdef RT_USING_NEWLIB
        #include <stdarg.h>
    #else
        /* the version of GNU GCC must be greater than 4.x */
        typedef __builtin_va_list   __gnuc_va_list;
        typedef __gnuc_va_list      va_list;
        #define va_start(v,l)       __builtin_va_start(v,l)
        #define va_end(v)           __builtin_va_end(v)
        #define va_arg(v,l)         __builtin_va_arg(v,l)
    #endif

    #define SECTION(x)                  __attribute__((section(x)))
    #define RT_UNUSED                   __attribute__((unused))
    #define RT_USED                     __attribute__((used))
    #define ALIGN(n)                    __attribute__((aligned(n)))
    #define RT_WEAK                     __attribute__((weak))
    #define rt_inline                   static __inline
    #define RTT_API
#elif defined (__ADSPBLACKFIN__)        /* for VisualDSP++ Compiler */
    #include <stdarg.h>
    #define SECTION(x)                  __attribute__((section(x)))
    #define RT_UNUSED                   __attribute__((unused))
    #define RT_USED                     __attribute__((used))
    #define ALIGN(n)                    __attribute__((aligned(n)))
    #define RT_WEAK                     __attribute__((weak))
    #define rt_inline                   static inline
    #define RTT_API
#elif defined (_MSC_VER)
    #include <stdarg.h>
    #define SECTION(x)
    #define RT_UNUSED
    #define RT_USED
    #define ALIGN(n)                    __declspec(align(n))
    #define RT_WEAK
    #define rt_inline                   static __inline
    #define RTT_API
#elif defined (__TI_COMPILER_VERSION__)
    #include <stdarg.h>
    /* The way that TI compiler set section is different from other(at least
     * GCC and MDK) compilers. See ARM Optimizing C/C++ Compiler 5.9.3 for more
     * details. */
    #define SECTION(x)
    #define RT_UNUSED
    #define RT_USED
    #define PRAGMA(x)                   _Pragma(#x)
    #define ALIGN(n)
    #define RT_WEAK
    #define rt_inline                   static inline
    #define RTT_API
#else
    #error not supported tool chain
#endif

/* initialization export */
#ifdef RT_USING_COMPONENTS_INIT
typedef int (*init_fn_t)(void);
#ifdef _MSC_VER /* we do not support MS VC++ compiler */
    #define INIT_EXPORT(fn, level)
#else
    #if RT_DEBUG_INIT
        struct rt_init_desc
        {
            const char* fn_name;
            const init_fn_t fn;
        };
        #define INIT_EXPORT(fn, level)                                                       \
            const char __rti_##fn##_name[] = #fn;                                            \
            RT_USED const struct rt_init_desc __rt_init_desc_##fn SECTION(".rti_fn."level) = \
            { __rti_##fn##_name, fn};
    #else
        #define INIT_EXPORT(fn, level)                                                       \
            RT_USED const init_fn_t __rt_init_##fn SECTION(".rti_fn."level) = fn
    #endif
#endif
#else
#define INIT_EXPORT(fn, level)
#endif

/* board init routines will be called in board_init() function */
#define INIT_BOARD_EXPORT(fn)           INIT_EXPORT(fn, "1")

/* pre/device/component/env/app init routines will be called in init_thread */
/* components pre-initialization (pure software initilization) */
#define INIT_PREV_EXPORT(fn)            INIT_EXPORT(fn, "2")
/* device initialization */
#define INIT_DEVICE_EXPORT(fn)          INIT_EXPORT(fn, "3")
/* components initialization (dfs, lwip, ...) */
#define INIT_COMPONENT_EXPORT(fn)       INIT_EXPORT(fn, "4")
/* environment initialization (mount disk, ...) */
#define INIT_ENV_EXPORT(fn)             INIT_EXPORT(fn, "5")
/* appliation initialization (rtgui application etc ...) */
#define INIT_APP_EXPORT(fn)             INIT_EXPORT(fn, "6")

#if !defined(RT_USING_FINSH)
/* define these to empty, even if not include finsh.h file */
#define FINSH_FUNCTION_EXPORT(name, desc)
#define FINSH_FUNCTION_EXPORT_ALIAS(name, alias, desc)
#define FINSH_VAR_EXPORT(name, type, desc)

#define MSH_CMD_EXPORT(command, desc)
#define MSH_CMD_EXPORT_ALIAS(command, alias, desc)
#elif !defined(FINSH_USING_SYMTAB)
#define FINSH_FUNCTION_EXPORT_CMD(name, cmd, desc)
#endif

/* event length */
#define RT_EVENT_LENGTH                 32

/* memory management option */
#define RT_MM_PAGE_SIZE                 4096
#define RT_MM_PAGE_MASK                 (RT_MM_PAGE_SIZE - 1)
#define RT_MM_PAGE_BITS                 12

/* kernel malloc definitions */
#ifndef RT_KERNEL_MALLOC
#define RT_KERNEL_MALLOC(sz)            rt_malloc(sz)
#endif

#ifndef RT_KERNEL_FREE
#define RT_KERNEL_FREE(ptr)             rt_free(ptr)
#endif

#ifndef RT_KERNEL_REALLOC
#define RT_KERNEL_REALLOC(ptr, size)    rt_realloc(ptr, size)
#endif

/**
 * @addtogroup Error
 */

/*@{*/

/* RT-Thread error code definitions */
#define RT_EOK                          0               /**< There is no error */
#define RT_ERROR                        1               /**< A generic error happens */
#define RT_ETIMEOUT                     2               /**< Timed out */
#define RT_EFULL                        3               /**< The resource is full */
#define RT_EEMPTY                       4               /**< The resource is empty */
#define RT_ENOMEM                       5               /**< No memory */
#define RT_ENOSYS                       6               /**< No system */
#define RT_EBUSY                        7               /**< Busy */
#define RT_EIO                          8               /**< IO error */
#define RT_EINTR                        9               /**< Interrupted system call */
#define RT_EINVAL                       10              /**< Invalid argument */

/*@}*/

/**
 * @ingroup BasicDef
 *
 * @def RT_ALIGN(size, align)
 * Return the most contiguous size aligned at specified width. RT_ALIGN(13, 4)
 * would return 16.
 */
#define RT_ALIGN(size, align)           (((size) + (align) - 1) & ~((align) - 1))

/**
 * @ingroup BasicDef
 *
 * @def RT_ALIGN_DOWN(size, align)
 * Return the down number of aligned at specified width. RT_ALIGN_DOWN(13, 4)
 * would return 12.
 */
#define RT_ALIGN_DOWN(size, align)      ((size) & ~((align) - 1))

/**
 * @ingroup BasicDef
 *
 * @def RT_NULL
 * Similar as the \c NULL in C library.
 */
#define RT_NULL                         (0)

/**
 * Double List structure
 */
struct rt_list_node
{
    struct rt_list_node *next;                          /**< point to next node. */
    struct rt_list_node *prev;                          /**< point to prev node. */
};
typedef struct rt_list_node rt_list_t;                  /**< Type for lists. */

/**
 * Single List structure
 */
struct rt_slist_node
{
    struct rt_slist_node *next;                         /**< point to next node. */
};
typedef struct rt_slist_node rt_slist_t;                /**< Type for single list. */

/**
 * @addtogroup KernelObject
 */

/*@{*/

/*
 * kernel object macros
 */
#define RT_OBJECT_FLAG_MODULE           0x80            /**< is module object. */

/**
 * Base structure of Kernel object
 */
struct rt_object
{
    char       name[16];                       /**< name of kernel object */
    rt_uint8_t type;                                    /**< type of kernel object */
    rt_uint8_t flag;                                    /**< flag of kernel object */

#ifdef RT_USING_MODULE
    void      *module_id;                               /**< id of application module */
#endif
    rt_list_t  list;                                    /**< list node of kernel object */
};
typedef struct rt_object *rt_object_t;                  /**< Type for kernel objects. */

/**
 *  The object type can be one of the follows with specific
 *  macros enabled:
 *  - Thread
 *  - Semaphore
 *  - Mutex
 *  - Event
 *  - MailBox
 *  - MessageQueue
 *  - MemHeap
 *  - MemPool
 *  - Device
 *  - Timer
 *  - Module
 *  - Unknown
 *  - Static
 */
enum rt_object_class_type
{
    RT_Object_Class_Thread = 0,                         /**< The object is a thread. */
    RT_Object_Class_Semaphore,                          /**< The object is a semaphore. */
    RT_Object_Class_Mutex,                              /**< The object is a mutex. */
    RT_Object_Class_Event,                              /**< The object is a event. */
    RT_Object_Class_MailBox,                            /**< The object is a mail box. */
    RT_Object_Class_MessageQueue,                       /**< The object is a message queue. */
    RT_Object_Class_MemHeap,                            /**< The object is a memory heap */
    RT_Object_Class_MemPool,                            /**< The object is a memory pool. */
    RT_Object_Class_Device,                             /**< The object is a device */
    RT_Object_Class_Timer,                              /**< The object is a timer. */
    RT_Object_Class_Module,                             /**< The object is a module. */
    RT_Object_Class_Unknown,                            /**< The object is unknown. */
    RT_Object_Class_Static = 0x80                       /**< The object is a static object. */
};

/**
 * The information of the kernel object
 */
struct rt_object_information
{
    enum rt_object_class_type type;                     /**< object class type */
    rt_list_t                 object_list;              /**< object list */
    rt_size_t                 object_size;              /**< object size */
};

/**
 * The hook function call macro
 */
#ifdef RT_USING_HOOK
#define RT_OBJECT_HOOK_CALL(func, argv) \
    do { if ((func) != RT_NULL) func argv; } while (0)
#else
#define RT_OBJECT_HOOK_CALL(func, argv)
#endif

/*@}*/

/**
 * @addtogroup Clock
 */

/*@{*/

/**
 * clock & timer macros
 */
#define RT_TIMER_FLAG_DEACTIVATED       0x0             /**< timer is deactive */
#define RT_TIMER_FLAG_ACTIVATED         0x1             /**< timer is active */
#define RT_TIMER_FLAG_ONE_SHOT          0x0             /**< one shot timer */
#define RT_TIMER_FLAG_PERIODIC          0x2             /**< periodic timer */

#define RT_TIMER_FLAG_HARD_TIMER        0x0             /**< hard timer,the timer's callback function will be called in tick isr. */
#define RT_TIMER_FLAG_SOFT_TIMER        0x4             /**< soft timer,the timer's callback function will be called in timer thread. */

#define RT_TIMER_CTRL_SET_TIME          0x0             /**< set timer control command */
#define RT_TIMER_CTRL_GET_TIME          0x1             /**< get timer control command */
#define RT_TIMER_CTRL_SET_ONESHOT       0x2             /**< change timer to one shot */
#define RT_TIMER_CTRL_SET_PERIODIC      0x3             /**< change timer to periodic */

#ifndef RT_TIMER_SKIP_LIST_LEVEL
#define RT_TIMER_SKIP_LIST_LEVEL          1
#endif

/* 1 or 3 */
#ifndef RT_TIMER_SKIP_LIST_MASK
#define RT_TIMER_SKIP_LIST_MASK         0x3
#endif

/**
 * timer structure
 */
struct rt_timer
{
    struct rt_object parent;                            /**< inherit from rt_object */

    rt_list_t        row[RT_TIMER_SKIP_LIST_LEVEL];

    void (*timeout_func)(void *parameter);              /**< timeout function */
    void            *parameter;                         /**< timeout function's parameter */

    rt_tick_t        init_tick;                         /**< timer timeout tick */
    rt_tick_t        timeout_tick;                      /**< timeout tick */
};
typedef struct rt_timer *rt_timer_t;

/*@}*/

/**
 * @addtogroup Signal
 */
#ifdef RT_USING_SIGNALS
#include <libc/libc_signal.h>
typedef unsigned long rt_sigset_t;
typedef void (*rt_sighandler_t)(int signo);
typedef siginfo_t rt_siginfo_t;

#define RT_SIG_MAX          32
#endif
/*@}*/

/**
 * @addtogroup Thread
 */

/*@{*/

/*
 * Thread
 */

/*
 * thread state definitions
 */
#define RT_THREAD_INIT                  0x00                /**< Initialized status */
#define RT_THREAD_READY                 0x01                /**< Ready status */
#define RT_THREAD_SUSPEND               0x02                /**< Suspend status */
#define RT_THREAD_RUNNING               0x03                /**< Running status */
#define RT_THREAD_BLOCK                 RT_THREAD_SUSPEND   /**< Blocked status */
#define RT_THREAD_CLOSE                 0x04                /**< Closed status */
#define RT_THREAD_STAT_MASK             0x0f

#define RT_THREAD_STAT_SIGNAL           0x10
#define RT_THREAD_STAT_SIGNAL_READY     (RT_THREAD_STAT_SIGNAL | RT_THREAD_READY)
#define RT_THREAD_STAT_SIGNAL_WAIT      0x20
#define RT_THREAD_STAT_SIGNAL_MASK      0xf0

/**
 * thread control command definitions
 */
#define RT_THREAD_CTRL_STARTUP          0x00                /**< Startup thread. */
#define RT_THREAD_CTRL_CLOSE            0x01                /**< Close thread. */
#define RT_THREAD_CTRL_CHANGE_PRIORITY  0x02                /**< Change thread priority. */
#define RT_THREAD_CTRL_INFO             0x03                /**< Get thread information. */

/**
 * Thread structure
 */
struct rt_thread
{
    /* rt object */
    char        name[16];                      /**< the name of thread */
    rt_uint8_t  type;                                   /**< type of object */
    rt_uint8_t  flags;                                  /**< thread's flags */

#ifdef RT_USING_MODULE
    void       *module_id;                              /**< id of application module */
#endif

    rt_list_t   list;                                   /**< the object list */
    rt_list_t   tlist;                                  /**< the thread list */

    /* stack point and entry */
    void       *sp;                                     /**< stack point */
    void       *entry;                                  /**< entry */
    void       *parameter;                              /**< parameter */
    void       *stack_addr;                             /**< stack address */
    rt_uint32_t stack_size;                             /**< stack size */

    /* error code */
    rt_err_t    error;                                  /**< error code */

    rt_uint8_t  stat;                                   /**< thread status */

    /* priority */
    rt_uint8_t  current_priority;                       /**< current priority */
    rt_uint8_t  init_priority;                          /**< initialized priority */
#if RT_THREAD_PRIORITY_MAX > 32
    rt_uint8_t  number;
    rt_uint8_t  high_mask;
#endif
    rt_uint32_t number_mask;

#if defined(RT_USING_EVENT)
    /* thread event */
    rt_uint32_t event_set;
    rt_uint8_t  event_info;
#endif

#if defined(RT_USING_SIGNALS)
    rt_sigset_t     sig_pending;                        /**< the pending signals */
    rt_sigset_t     sig_mask;                           /**< the mask bits of signal */

    void            *sig_ret;                           /**< the return stack pointer from signal */
    rt_sighandler_t *sig_vectors;                       /**< vectors of signal handler */
    void            *si_list;                           /**< the signal infor list */
#endif

    rt_ubase_t  init_tick;                              /**< thread's initialized tick */
    rt_ubase_t  remaining_tick;                         /**< remaining tick */

    struct rt_timer thread_timer;                       /**< built-in thread timer */

    void (*cleanup)(struct rt_thread *tid);             /**< cleanup function when thread exit */

    /* light weight process if present */
#ifdef RT_USING_LWP
    void        *lwp;
#endif

    rt_uint32_t user_data;                             /**< private user data beyond this thread */
};
typedef struct rt_thread *rt_thread_t;

/*@}*/

/**
 * @addtogroup IPC
 */

/*@{*/

/**
 * IPC flags and control command definitions
 */
#define RT_IPC_FLAG_FIFO                0x00            /**< FIFOed IPC. @ref IPC. */
#define RT_IPC_FLAG_PRIO                0x01            /**< PRIOed IPC. @ref IPC. */

#define RT_IPC_CMD_UNKNOWN              0x00            /**< unknown IPC command */
#define RT_IPC_CMD_RESET                0x01            /**< reset IPC object */

#define RT_WAITING_FOREVER              -1              /**< Block forever until get resource. */
#define RT_WAITING_NO                   0               /**< Non-block. */

/**
 * Base structure of IPC object
 */
struct rt_ipc_object
{
    struct rt_object parent;                            /**< inherit from rt_object */

    rt_list_t        suspend_thread;                    /**< threads pended on this resource */
};

#ifdef RT_USING_SEMAPHORE
/**
 * Semaphore structure
 */
struct rt_semaphore
{
    struct rt_ipc_object parent;                        /**< inherit from ipc_object */

    rt_uint16_t          value;                         /**< value of semaphore. */
};
typedef struct rt_semaphore *rt_sem_t;
#endif

#ifdef RT_USING_MUTEX
/**
 * Mutual exclusion (mutex) structure
 */
struct rt_mutex
{
    struct rt_ipc_object parent;                        /**< inherit from ipc_object */

    rt_uint16_t          value;                         /**< value of mutex */

    rt_uint8_t           original_priority;             /**< priority of last thread hold the mutex */
    rt_uint8_t           hold;                          /**< numbers of thread hold the mutex */

    struct rt_thread    *owner;                         /**< current owner of mutex */
};
typedef struct rt_mutex *rt_mutex_t;
#endif

#ifdef RT_USING_EVENT
/**
 * flag defintions in event
 */
#define RT_EVENT_FLAG_AND               0x01            /**< logic and */
#define RT_EVENT_FLAG_OR                0x02            /**< logic or */
#define RT_EVENT_FLAG_CLEAR             0x04            /**< clear flag */

/*
 * event structure
 */
struct rt_event
{
    struct rt_ipc_object parent;                        /**< inherit from ipc_object */

    rt_uint32_t          set;                           /**< event set */
};
typedef struct rt_event *rt_event_t;
#endif

#ifdef RT_USING_MAILBOX
/**
 * mailbox structure
 */
struct rt_mailbox
{
    struct rt_ipc_object parent;                        /**< inherit from ipc_object */

    rt_uint32_t         *msg_pool;                      /**< start address of message buffer */

    rt_uint16_t          size;                          /**< size of message pool */

    rt_uint16_t          entry;                         /**< index of messages in msg_pool */
    rt_uint16_t          in_offset;                     /**< input offset of the message buffer */
    rt_uint16_t          out_offset;                    /**< output offset of the message buffer */

    rt_list_t            suspend_sender_thread;         /**< sender thread suspended on this mailbox */
};
typedef struct rt_mailbox *rt_mailbox_t;
#endif

#ifdef RT_USING_MESSAGEQUEUE
/**
 * message queue structure
 */
struct rt_messagequeue
{
    struct rt_ipc_object parent;                        /**< inherit from ipc_object */

    void                *msg_pool;                      /**< start address of message queue */

    rt_uint16_t          msg_size;                      /**< message size of each message */
    rt_uint16_t          max_msgs;                      /**< max number of messages */

    rt_uint16_t          entry;                         /**< index of messages in the queue */

    void                *msg_queue_head;                /**< list head */
    void                *msg_queue_tail;                /**< list tail */
    void                *msg_queue_free;                /**< pointer indicated the free node of queue */
};
typedef struct rt_messagequeue *rt_mq_t;
#endif

/*@}*/

/**
 * @addtogroup MM
 */

/*@{*/

/*
 * memory management
 * heap & partition
 */

#ifdef RT_USING_MEMHEAP
/**
 * memory item on the heap
 */
struct rt_memheap_item
{
    rt_uint32_t             magic;                      /**< magic number for memheap */
    struct rt_memheap      *pool_ptr;                   /**< point of pool */

    struct rt_memheap_item *next;                       /**< next memheap item */
    struct rt_memheap_item *prev;                       /**< prev memheap item */

    struct rt_memheap_item *next_free;                  /**< next free memheap item */
    struct rt_memheap_item *prev_free;                  /**< prev free memheap item */
};

/**
 * Base structure of memory heap object
 */
struct rt_memheap
{
    struct rt_object        parent;                     /**< inherit from rt_object */

    void                   *start_addr;                 /**< pool start address and size */

    rt_uint32_t             pool_size;                  /**< pool size */
    rt_uint32_t             available_size;             /**< available size */
    rt_uint32_t             max_used_size;              /**< maximum allocated size */

    struct rt_memheap_item *block_list;                 /**< used block list */

    struct rt_memheap_item *free_list;                  /**< free block list */
    struct rt_memheap_item  free_header;                /**< free block list header */

    struct rt_semaphore     lock;                       /**< semaphore lock */
};
#endif

#ifdef RT_USING_MEMPOOL
/**
 * Base structure of Memory pool object
 */
struct rt_mempool
{
    struct rt_object parent;                            /**< inherit from rt_object */

    void            *start_address;                     /**< memory pool start */
    rt_size_t        size;                              /**< size of memory pool */

    rt_size_t        block_size;                        /**< size of memory blocks */
    rt_uint8_t      *block_list;                        /**< memory blocks list */

    rt_size_t        block_total_count;                 /**< numbers of memory block */
    rt_size_t        block_free_count;                  /**< numbers of free memory block */

    rt_list_t        suspend_thread;                    /**< threads pended on this resource */
    rt_size_t        suspend_thread_count;              /**< numbers of thread pended on this resource */
};
typedef struct rt_mempool *rt_mp_t;
#endif

/*@}*/

#ifdef RT_USING_DEVICE
/**
 * @addtogroup Device
 */

/*@{*/

/**
 * device (I/O) class type
 */
enum rt_device_class_type
{
    RT_Device_Class_Char = 0,                           /**< character device */
    RT_Device_Class_Block,                              /**< block device */
    RT_Device_Class_NetIf,                              /**< net interface */
    RT_Device_Class_MTD,                                /**< memory device */
    RT_Device_Class_CAN,                                /**< CAN device */
    RT_Device_Class_RTC,                                /**< RTC device */
    RT_Device_Class_Sound,                              /**< Sound device */
    RT_Device_Class_Graphic,                            /**< Graphic device */
    RT_Device_Class_I2CBUS,                             /**< I2C bus device */
    RT_Device_Class_USBDevice,                          /**< USB slave device */
    RT_Device_Class_USBHost,                            /**< USB host bus */
    RT_Device_Class_SPIBUS,                             /**< SPI bus device */
    RT_Device_Class_SPIDevice,                          /**< SPI device */
    RT_Device_Class_SDIO,                               /**< SDIO bus device */
    RT_Device_Class_PM,                                 /**< PM pseudo device */
    RT_Device_Class_Pipe,                               /**< Pipe device */
    RT_Device_Class_Portal,                             /**< Portal device */
    RT_Device_Class_Timer,                              /**< Timer device */
    RT_Device_Class_Miscellaneous,                      /**< Miscellaneous device */
    RT_Device_Class_Unknown                             /**< unknown device */
};

/**
 * device flags defitions
 */
#define RT_DEVICE_FLAG_DEACTIVATE       0x000           /**< device is not not initialized */

#define RT_DEVICE_FLAG_RDONLY           0x001           /**< read only */
#define RT_DEVICE_FLAG_WRONLY           0x002           /**< write only */
#define RT_DEVICE_FLAG_RDWR             0x003           /**< read and write */

#define RT_DEVICE_FLAG_REMOVABLE        0x004           /**< removable device */
#define RT_DEVICE_FLAG_STANDALONE       0x008           /**< standalone device */
#define RT_DEVICE_FLAG_ACTIVATED        0x010           /**< device is activated */
#define RT_DEVICE_FLAG_SUSPENDED        0x020           /**< device is suspended */
#define RT_DEVICE_FLAG_STREAM           0x040           /**< stream mode */

#define RT_DEVICE_FLAG_INT_RX           0x100           /**< INT mode on Rx */
#define RT_DEVICE_FLAG_DMA_RX           0x200           /**< DMA mode on Rx */
#define RT_DEVICE_FLAG_INT_TX           0x400           /**< INT mode on Tx */
#define RT_DEVICE_FLAG_DMA_TX           0x800           /**< DMA mode on Tx */

#define RT_DEVICE_OFLAG_CLOSE           0x000           /**< device is closed */
#define RT_DEVICE_OFLAG_RDONLY          0x001           /**< read only access */
#define RT_DEVICE_OFLAG_WRONLY          0x002           /**< write only access */
#define RT_DEVICE_OFLAG_RDWR            0x003           /**< read and write */
#define RT_DEVICE_OFLAG_OPEN            0x008           /**< device is opened */
#define RT_DEVICE_OFLAG_MASK            0xf0f           /**< mask of open flag */

/**
 * general device commands
 */
#define RT_DEVICE_CTRL_RESUME           0x01            /**< resume device */
#define RT_DEVICE_CTRL_SUSPEND          0x02            /**< suspend device */
#define RT_DEVICE_CTRL_CONFIG           0x03            /**< configure device */

#define RT_DEVICE_CTRL_SET_INT          0x10            /**< set interrupt */
#define RT_DEVICE_CTRL_CLR_INT          0x11            /**< clear interrupt */
#define RT_DEVICE_CTRL_GET_INT          0x12            /**< get interrupt status */

/**
 * special device commands
 */
#define RT_DEVICE_CTRL_CHAR_STREAM      0x10            /**< stream mode on char device */
#define RT_DEVICE_CTRL_BLK_GETGEOME     0x10            /**< get geometry information   */
#define RT_DEVICE_CTRL_BLK_SYNC         0x11            /**< flush data to block device */
#define RT_DEVICE_CTRL_BLK_ERASE        0x12            /**< erase block on block device */
#define RT_DEVICE_CTRL_BLK_AUTOREFRESH  0x13            /**< block device : enter/exit auto refresh mode */
#define RT_DEVICE_CTRL_NETIF_GETMAC     0x10            /**< get mac address */
#define RT_DEVICE_CTRL_MTD_FORMAT       0x10            /**< format a MTD device */
#define RT_DEVICE_CTRL_RTC_GET_TIME     0x10            /**< get time */
#define RT_DEVICE_CTRL_RTC_SET_TIME     0x11            /**< set time */
#define RT_DEVICE_CTRL_RTC_GET_ALARM    0x12            /**< get alarm */
#define RT_DEVICE_CTRL_RTC_SET_ALARM    0x13            /**< set alarm */
#define RT_DEVICE_CTRL_BYTES_AVAILABLE  0x10            /**< get bytes available */

typedef struct rt_device *rt_device_t;
/**
 * operations set for device object
 */
struct rt_device_ops
{
    /* common device interface */
    rt_err_t  (*init)   (rt_device_t dev);
    rt_err_t  (*open)   (rt_device_t dev, rt_uint16_t oflag);
    rt_err_t  (*close)  (rt_device_t dev);
    rt_size_t (*read)   (rt_device_t dev, rt_off_t pos, void *buffer, rt_size_t size);
    rt_size_t (*write)  (rt_device_t dev, rt_off_t pos, const void *buffer, rt_size_t size);
    rt_err_t  (*control)(rt_device_t dev, int cmd, void *args);
};

/**
 * WaitQueue structure
 */
struct rt_wqueue
{
    rt_uint32_t flag;
    rt_list_t waiting_list;
};
typedef struct rt_wqueue rt_wqueue_t;

/**
 * Device structure
 */
struct rt_device
{
    struct rt_object          parent;                   /**< inherit from rt_object */

    enum rt_device_class_type type;                     /**< device type */
    rt_uint16_t               flag;                     /**< device flag */
    rt_uint16_t               open_flag;                /**< device open flag */

    rt_uint8_t                ref_count;                /**< reference count */
    rt_uint8_t                device_id;                /**< 0 - 255 */

    /* device call back */
    rt_err_t (*rx_indicate)(rt_device_t dev, rt_size_t size);
    rt_err_t (*tx_complete)(rt_device_t dev, void *buffer);

#ifdef RT_USING_DEVICE_OPS
    const struct rt_device_ops *ops;
#else
    /* common device interface */
    rt_err_t  (*init)   (rt_device_t dev);
    rt_err_t  (*open)   (rt_device_t dev, rt_uint16_t oflag);
    rt_err_t  (*close)  (rt_device_t dev);
    rt_size_t (*read)   (rt_device_t dev, rt_off_t pos, void *buffer, rt_size_t size);
    rt_size_t (*write)  (rt_device_t dev, rt_off_t pos, const void *buffer, rt_size_t size);
    rt_err_t  (*control)(rt_device_t dev, int cmd, void *args);
#endif

#if defined(RT_USING_POSIX)
    const struct dfs_file_ops *fops;
    struct rt_wqueue wait_queue;
#endif

    void                     *user_data;                /**< device private data */
};

/**
 * block device geometry structure
 */
struct rt_device_blk_geometry
{
    rt_uint32_t sector_count;                           /**< count of sectors */
    rt_uint32_t bytes_per_sector;                       /**< number of bytes per sector */
    rt_uint32_t block_size;                             /**< number of bytes to erase one block */
};

/**
 * sector arrange struct on block device
 */
struct rt_device_blk_sectors
{
    rt_uint32_t sector_begin;                           /**< begin sector */
    rt_uint32_t sector_end;                             /**< end sector   */
};

/**
 * cursor control command
 */
#define RT_DEVICE_CTRL_CURSOR_SET_POSITION  0x10
#define RT_DEVICE_CTRL_CURSOR_SET_TYPE      0x11

/**
 * graphic device control command
 */
#define RTGRAPHIC_CTRL_RECT_UPDATE      0
#define RTGRAPHIC_CTRL_POWERON          1
#define RTGRAPHIC_CTRL_POWEROFF         2
#define RTGRAPHIC_CTRL_GET_INFO         3
#define RTGRAPHIC_CTRL_SET_MODE         4
#define RTGRAPHIC_CTRL_GET_EXT          5

/* graphic deice */
enum
{
    RTGRAPHIC_PIXEL_FORMAT_MONO = 0,
    RTGRAPHIC_PIXEL_FORMAT_GRAY4,
    RTGRAPHIC_PIXEL_FORMAT_GRAY16,
    RTGRAPHIC_PIXEL_FORMAT_RGB332,
    RTGRAPHIC_PIXEL_FORMAT_RGB444,
    RTGRAPHIC_PIXEL_FORMAT_RGB565,
    RTGRAPHIC_PIXEL_FORMAT_RGB565P,
    RTGRAPHIC_PIXEL_FORMAT_BGR565 = RTGRAPHIC_PIXEL_FORMAT_RGB565P,
    RTGRAPHIC_PIXEL_FORMAT_RGB666,
    RTGRAPHIC_PIXEL_FORMAT_RGB888,
    RTGRAPHIC_PIXEL_FORMAT_ARGB888,
    RTGRAPHIC_PIXEL_FORMAT_ABGR888,
    RTGRAPHIC_PIXEL_FORMAT_ARGB565,
    RTGRAPHIC_PIXEL_FORMAT_ALPHA,
};

/**
 * build a pixel position according to (x, y) coordinates.
 */
#define RTGRAPHIC_PIXEL_POSITION(x, y)  ((x << 16) | y)

/**
 * graphic device information structure
 */
struct rt_device_graphic_info
{
    rt_uint8_t  pixel_format;                           /**< graphic format */
    rt_uint8_t  bits_per_pixel;                         /**< bits per pixel */
    rt_uint16_t reserved;                               /**< reserved field */

    rt_uint16_t width;                                  /**< width of graphic device */
    rt_uint16_t height;                                 /**< height of graphic device */

    rt_uint8_t *framebuffer;                            /**< frame buffer */
};

/**
 * rectangle information structure
 */
struct rt_device_rect_info
{
    rt_uint16_t x;                                      /**< x coordinate */
    rt_uint16_t y;                                      /**< y coordinate */
    rt_uint16_t width;                                  /**< width */
    rt_uint16_t height;                                 /**< height */
};

/**
 * graphic operations
 */
struct rt_device_graphic_ops
{
    void (*set_pixel) (const char *pixel, int x, int y);
    void (*get_pixel) (char *pixel, int x, int y);

    void (*draw_hline)(const char *pixel, int x1, int x2, int y);
    void (*draw_vline)(const char *pixel, int x, int y1, int y2);

    void (*blit_line) (const char *pixel, int x, int y, rt_size_t size);
};
#define rt_graphix_ops(device)          ((struct rt_device_graphic_ops *)(device->user_data))



/**************** ming_def start ********************************/

struct rt_nbuffer
{
    rt_uint32_t len;
    rt_uint8_t* buffer;
};

typedef struct rt_nbuffer  rt_nbuffer_t;


typedef struct {
    void (*apply)(void * sender,void* eventArgs,void* owner);
    void * owner;						
}RtEventHandler;

typedef	union
{
    struct {
        rt_uint16_t arg;
        rt_uint8_t	inx;
        rt_uint8_t	evtCode;
    }one;
    rt_uint32_t	all;
} RtEventCode;

typedef	union
{
    rt_uint32_t	ms;
    RtEventCode code;

} RtEvent;


#define RT_EVENT_BUILD(g,inx,arg)	  (g << 24) & 0xff000000 |inx<<16 & 0x00ff0000|arg &0xffff

void rt_hw_us_delay(rt_uint32_t us);
void rt_hw_ms_delay(rt_uint32_t ms);
/*************** ming_def end   *********************************/

/*@}*/
#endif



#ifdef __cplusplus
}
#endif

#ifdef __cplusplus
/* RT-Thread definitions for C++ */
namespace rtthread {

enum TICK_WAIT {
    WAIT_NONE = 0,
    WAIT_FOREVER = -1,
};

}

#endif /* end of __cplusplus */

#endif

```

## 设备管理
 [参考device.c](https://github.com/RT-Thread/rt-thread/blob/master/components/drivers/core/device.c)
[参考rtthread.h](https://github.com/RT-Thread/rt-thread/blob/893ae7d7ba4daecfe4732cb51db8f140dc7211ff/include/rtthread.h#L720)

### 注册设备
```c
rt_err_t rt_device_register(rt_device_t dev, const char* name, rt_uint16_t flags);
```

### AtShell 访问设备
可通过 AtShell 查看和测试设备
```sh
$:0
AtShell commands:
 0.help                 - list cmd 
 1.c                    - (55,01 02) 
 2.clean                - clean screen 
 3.ld                   - list device 
 4.td                   - test device 
 5.la                   - list app 
 6.ta                   - test app 
 7.test01               - "" 
```
#### ld 命令
列举设备,返回设备名和被引用次数
```sh
 $:ld
device                ref count
-------------------- ----------
 0.demo_dev               0
 1.led                    2
 2.adc                    1
 3.at_uart                2
```

#### td 命令
测试设备,调用设备的control方法。
这里是读取adc设备的值
```sh
$:td adc  0
adc value:1073741824
                    ok

```


### RtDeviceManage.h
```c
/*
 设备管理 ---- rtt接口
*/

#ifndef __RtDeviceManage_H__
#define __RtDeviceManage_H__
#include "stdbool.h"
#include "stdint.h"
#include "rtdef.h"

#define CON_TOTAL_DEVICE_NUM    10

#ifdef __cplusplus
extern "C" {
#endif
    void at_rt_device_init();
    int rt_device_total();
    rt_device_t rt_device_find_by_inx(int inx);
    rt_device_t rt_device_find(const char* name);
    rt_err_t rt_device_register(rt_device_t dev, const char* name, rt_uint16_t flags);
    rt_err_t rt_device_unregister(rt_device_t dev);
    rt_device_t rt_device_create(int type, int attach_size);
    void    rt_device_destroy(rt_device_t device);
    rt_err_t rt_device_init_all(void);
    rt_err_t rt_device_set_rx_indicate(rt_device_t dev, rt_err_t(*rx_ind)(rt_device_t dev, rt_size_t size));
    rt_err_t rt_device_set_tx_complete(rt_device_t dev, rt_err_t  (*tx_done)(rt_device_t dev, void* buffer));
    rt_err_t  rt_device_init(rt_device_t dev);
    rt_err_t  rt_device_open(rt_device_t dev, rt_uint16_t oflag);
    rt_err_t  rt_device_close(rt_device_t dev);
    rt_size_t rt_device_read(rt_device_t dev,  rt_off_t   pos, void* buffer, rt_size_t   size);
    rt_size_t rt_device_write(rt_device_t dev, rt_off_t    pos, const void* buffer, rt_size_t   size);
    rt_err_t  rt_device_control(rt_device_t dev, int cmd, void* arg);
#ifdef __cplusplus
}
#endif
#endif
```

### RtDeviceManage.cpp
```c


#include "AtShell.h"
#include "RtDeviceManage.h"
#include "stdio.h"
#include "string.h"



class RtDeviceManage {
private:
    rt_device_t* m_devList;
    uint32_t    m_devSize;
    int         m_devNum;

public:
    RtDeviceManage();
    virtual ~RtDeviceManage();
    virtual int   GetDevNum() { return m_devNum; };
    virtual  rt_device* Find(const char* str, bool isRef = true);
    virtual  rt_device* FindByInx(int inx, bool isRef = true);
    virtual  rt_device* FindByDeviceId(uint8_t deviceId, bool isRef = true);
    virtual  bool Register(rt_device* dev, const char* devName, rt_uint16_t flags = 0);
    virtual  rt_err_t  Init(rt_device_t dev);
    virtual  rt_err_t  Open(rt_device_t dev, rt_uint16_t oflag);
    virtual  rt_err_t  Control(rt_device_t dev, int cmd, void* arg);
    virtual  rt_err_t  SetRxIndicate(rt_device_t dev, rt_err_t(*rx_ind)(rt_device_t dev, rt_size_t size));
    virtual  rt_err_t  SetTxComplete(rt_device_t dev, rt_err_t(*tx_done)(rt_device_t dev, void* buffer));
    virtual  rt_size_t Read(rt_device_t dev, rt_off_t  pos, void* buffer, rt_size_t   size);
    virtual  rt_size_t Write(rt_device_t dev, rt_off_t  pos, const void* buffer, rt_size_t   size);
    virtual  rt_size_t Close(rt_device_t dev);

};




/**
 * AtShell访问设备
 */
static int at_ls_device(int argc, char** argv) {
    int devNum = rt_device_total();
    AT_printf("%.10s                ref count\r\n", "device");
    AT_printf("-------------------- ----------\r\n");
    for (int i = 0; i < devNum; i++) {
        rt_device* dp = rt_device_find_by_inx(i);
        AT_printf("%2d.%-20s   %d\r\n", i, dp->parent.name, dp->ref_count);
    }
    return 0;
}

static int at_device_test(int argc, char** argv) {
    //eerom_dev
  //led_dev
    if (argc < 2) {
        AT_info("input a device \n\r");
        return 0;
    }
    rt_device_t dv = rt_device_find(argv[1]);
    if (dv == NULL) {
        AT_info("%s not exeist \n\r", argv[1]);
        return 0;
    }
    rt_device_control(dv, 0, &argv[2]);
    return 0;
}


static AT_CMD_ENTRY_TypeDef s_at_cmd_list[] = {
    { AT_FUN(ld),"list device",at_ls_device},
    { AT_FUN(td),"test device",at_device_test}
};



/**
 * 全局唯一的设备管理器
 */
static RtDeviceManage g_dm;


/**
 * 一个demo设备
 */
static rt_device demo_dev;
static rt_err_t  dev_init(rt_device_t dev) {
    return RT_EOK;
}

static rt_err_t  dev_close(rt_device_t dev) {
    return RT_EOK;
}

static rt_size_t dev_read(rt_device_t dev, rt_off_t pos, void* buffer, rt_size_t size) {
    printf("dev_read");
    ((uint8_t*)buffer)[0] = 0xf1;
    return 1;
}

static rt_size_t  dev_write(rt_device_t dev, rt_off_t pos, const void* buffer, rt_size_t size) {
    printf("dev_write");
    return 1;
}
static rt_err_t dev_control(rt_device_t dev, int cmd, void* args) {

    switch (cmd)
    {
        //test
    case 0: {

        return RT_EOK;
    }
    case RT_DEVICE_CTRL_RESUME: {

        return RT_EOK;
    }
    case RT_DEVICE_CTRL_SET_INT: {

        return RT_EOK;
    }
    case RT_DEVICE_CTRL_GET_INT: {

        return RT_EOK;
    }
    case RT_DEVICE_CTRL_RTC_SET_ALARM: {

        return RT_EOK;
    }
    default:
        break;
    }
    return RT_EOK;
}

static rt_err_t dev_rx_indicate(rt_device_t dev, rt_size_t size) {
    return RT_EOK;
}

static rt_err_t tx_complete(rt_device_t dev, void* buffer) {
    return RT_EOK;
}
static void s_demoDev_build() {
    demo_dev.init = dev_init;
    demo_dev.close = dev_close;
    demo_dev.read = dev_read;
    demo_dev.write = dev_write;
    demo_dev.control = dev_control;
    demo_dev.rx_indicate = dev_rx_indicate;
    demo_dev.tx_complete = tx_complete;
    demo_dev.user_data = NULL;
}

static rt_device_t s_dev_array[CON_TOTAL_DEVICE_NUM];


void at_rt_device_init() {
    at_register_many(s_at_cmd_list, sizeof(s_at_cmd_list) / sizeof(AT_CMD_ENTRY_TypeDef));
}



RtDeviceManage::RtDeviceManage() {
    m_devList = s_dev_array;
    m_devSize = CON_TOTAL_DEVICE_NUM;
    m_devNum = 0;
    s_demoDev_build();
    Register(&demo_dev, "demo_dev");
}

RtDeviceManage::~RtDeviceManage() {


}


rt_device* RtDeviceManage::Find(const char* devName, bool isRef) {

    rt_device* retDev = NULL;
    for (int i = 0; i < m_devNum; i++)
    {
        if (!strcmp(devName, m_devList[i]->parent.name)) {
            if (isRef) {
                m_devList[i]->ref_count++;
            }
            return m_devList[i];
        }
    }
    return NULL;
}


rt_device* RtDeviceManage::FindByDeviceId(uint8_t deviceId, bool isRef) {

    rt_device* retDev = NULL;
    for (int i = 0; i < m_devNum; i++)
    {
        if (deviceId == m_devList[i]->device_id) {
            if (isRef) {
                m_devList[i]->ref_count++;
            }
            return m_devList[i];
        }
    }
    return NULL;
}


rt_device* RtDeviceManage::FindByInx(int inx, bool isRef) {
    if (inx < m_devNum) {
        if (isRef) {
            m_devList[inx]->ref_count++;
        }
        return m_devList[inx];
    }
    return NULL;
}




bool RtDeviceManage::Register(rt_device* dev, const char* devName, rt_uint16_t flags) {
    if (dev == NULL || m_devNum > CON_TOTAL_DEVICE_NUM) {
        return false;
    }
    if (Find(devName) != NULL) {
        return false;
    }
    sprintf(dev->parent.name, devName);
    dev->flag = flags;
    dev->device_id = m_devNum;
    dev->ref_count = 0;
    m_devList[m_devNum] = dev;
    m_devNum++;
    return true;
}


rt_err_t  RtDeviceManage::Init(rt_device_t dev) {
    if (dev != NULL && dev->init != NULL) {
        return dev->init(dev);
    }
    return RT_ERROR;

}

rt_err_t  RtDeviceManage::Open(rt_device_t dev, rt_uint16_t oflag) {
    if (dev != NULL && dev->open != NULL) {
        return dev->open(dev, oflag);
    }
    return RT_ERROR;

}
rt_err_t  RtDeviceManage::Control(rt_device_t dev, int cmd, void* arg) {
    if (dev != NULL && dev->control != NULL) {
        return dev->control(dev, cmd, arg);
    }
    return RT_ERROR;
}

rt_err_t  RtDeviceManage::SetRxIndicate(rt_device_t dev, rt_err_t(*rx_ind)(rt_device_t dev, rt_size_t size)) {
    dev->rx_indicate = rx_ind;
    return RT_EOK;
}

rt_err_t  RtDeviceManage::SetTxComplete(rt_device_t dev, rt_err_t(*tx_done)(rt_device_t dev, void* buffer)) {
    dev->tx_complete = tx_done;
    return RT_EOK;
}

rt_size_t RtDeviceManage::Read(rt_device_t dev, rt_off_t  pos, void* buffer, rt_size_t   size) {
    if (dev != NULL && dev->read != NULL) {
        return dev->read(dev, pos, buffer, size);
    }
    return 0;

}

rt_size_t RtDeviceManage::Write(rt_device_t dev, rt_off_t  pos, const void* buffer, rt_size_t   size) {
    if (dev->write != NULL) {
        return dev->write(dev, pos, buffer, size);
    }
    return 0;

}

rt_size_t RtDeviceManage::Close(rt_device_t dev) {
    if (dev->close != NULL) {
        return dev->close(dev);
    }
    return RT_ERROR;
}


int rt_device_total() {
    return g_dm.GetDevNum();
}


rt_device_t rt_device_find_by_inx(int inx) {
    return  g_dm.FindByInx(inx, false);
}

rt_device_t rt_device_find(const char* name) {
    return  g_dm.Find(name);
}
rt_err_t rt_device_register(rt_device_t dev, const char* name, rt_uint16_t flags) {
    return  !g_dm.Register(dev, name, flags);
}

rt_err_t rt_device_unregister(rt_device_t dev) {
    return RT_EOK;
}

rt_device_t rt_device_create(int type, int attach_size) {
    return RT_EOK;
}

void rt_device_destroy(rt_device_t device) {
    return;
}

rt_err_t rt_device_init_all(void) {
    rt_device* itemDev = NULL;
    for (int i = 0; i < g_dm.GetDevNum(); i++)
    {
        rt_device_init(g_dm.FindByInx(i, false));
    }
    return RT_EOK;
}

rt_err_t rt_device_set_rx_indicate(rt_device_t dev, rt_err_t(*rx_ind)(rt_device_t dev, rt_size_t size)) {
    dev->rx_indicate = rx_ind;
    return RT_EOK;
}

rt_err_t rt_device_set_tx_complete(rt_device_t dev, rt_err_t(*tx_done)(rt_device_t dev, void* buffer)) {
    dev->tx_complete = tx_done;
    return RT_EOK;
}


rt_err_t  rt_device_init(rt_device_t dev) {
    rt_err_t result = RT_EOK;
    if (dev != RT_NULL && dev->init != RT_NULL) {
        result = dev->init(dev);
    }
    return result;
}

rt_err_t  rt_device_open(rt_device_t dev, rt_uint16_t oflag) {

    return g_dm.Open(dev, oflag);
}

rt_err_t  rt_device_close(rt_device_t dev) {
    return g_dm.Close(dev);
}

rt_size_t rt_device_read(rt_device_t dev, rt_off_t   pos, void* buffer, rt_size_t   size) {
    return g_dm.Read(dev, pos, buffer, size);
}

rt_size_t rt_device_write(rt_device_t dev, rt_off_t    pos, const void* buffer, rt_size_t   size) {
    return g_dm.Write(dev, pos, buffer, size);
}

rt_err_t  rt_device_control(rt_device_t dev, int cmd, void* arg) {
    return g_dm.Control(dev, cmd, arg);
}

RT_WEAK void rt_hw_us_delay(rt_uint32_t us) {
    while (us-- > 0);
}

RT_WEAK void rt_hw_ms_delay(rt_uint32_t ms) {
    while (ms-- > 0);
}
```

### rt_device.h
这个方法需要用户实现
```c
#ifndef _RT_DEVICE_H
#define _RT_DEVICE_H

#include "RtDeviceManage.h"

#ifdef __cplusplus
extern "C" {
#endif
	void rt_device_register_all();
#ifdef __cplusplus
}
#endif

#endif



```

## 应用管理
[参考thread.c](https://github.com/RT-Thread/rt-thread/blob/master/src/thread.c)
### 注册应用
```c
rt_err_t rt_thread_register(rt_thread* thread, const char* name, void (*exec)(void* parameter), void (*loop)(void* parameter));
```
### AtShell 访问应用
```sh
$:0
AtShell commands:
 0.help                 - list cmd 
 1.c                    - (55,01 02) 
 2.clean                - clean screen 
 3.ld                   - list device 
 4.td                   - test device 
 5.la                   - list app
 6.ta                   - test app
```
#### la 命令
列举应用,显示应用tick和应用状态，
这里的应用指的是用户线程
```sh
$:la
app                      tick    state
-------------------- ---------- ------
 0.led                       0      0
```

#### ta 命令
测试led应用，调用应用的exec方法
```sh
$:ta led 
led  
```

### RtThreadAppManage.h
```c
#ifndef __RtThreadManager_H__
#define __RtThreadManager_H__
#include "stdbool.h"
#include "stdint.h"
#include "rtdef.h"

#define CON_TOTAL_RT_THREAD_APP_NUM    3

#define RT_THREAD_TICK_MS    5


#ifdef __cplusplus
extern "C" {
#endif

    void at_rt_thread_app_init();
    void     rt_tick_increase();
    rt_err_t rt_thread_register(rt_thread* thread, const char* name, void (*exec)(void* parameter), void (*loop)(void* parameter));
    rt_err_t rt_thread_startup( rt_thread_t thread);
    rt_thread_t rt_thread_find(char* name);
    rt_thread_t rt_thread_find_by_inx(int inx);
    rt_err_t rt_thread_control( rt_thread_t thread, int cmd, void* arg);
    rt_err_t rt_thread_delay(rt_tick_t tick);
    rt_err_t rt_thread_mdelay(uint32_t ms);
    rt_thread_t rt_thread_self(void);
    rt_err_t rt_thread_suspend(rt_thread_t thread);
    rt_err_t rt_thread_resume( rt_thread_t thread);
    rt_tick_t rt_tick_get(void);
    int rt_thread_total();

#ifdef __cplusplus
}
#endif





#endif
```
### RtThreadAppManage.cpp
```c
#include "AtShell.h"
#include "RtThreadAppManage.h"
#include "stdio.h"
#include "string.h"


static int  s_rt_thread_num = 0;
static rt_thread_t s_rt_list[CON_TOTAL_RT_THREAD_APP_NUM];
struct rt_thread* rt_current_thread;
static uint32_t rt_tick = 0;



static int run_at_ls_app(int argc, char** argv) {
    int appNum = rt_thread_total();
    rt_kprintf("%.10s                      tick    state\r\n", "app");
    rt_kprintf("-------------------- ---------- ------\r\n");
    for (int i = 0; i < appNum; i++) {
        rt_thread_t tp = rt_thread_find_by_inx(i);
         rt_kprintf("%2d.%-20s  %5lu   %4lu\r\n", i, tp->name, tp->thread_timer.timeout_tick, tp->stat);
    }
    return 0;
}

static int run_at_exec_app(int argc, char** argv) {
    if (argc < 2) {
        AT_info("input a app \n\r");
        return 0;
    }
    rt_thread_t tp = rt_thread_find(argv[1]);
    if (tp == NULL) {
        AT_info("%s not exeist \n\r", argv[1]);
        return 0;
    }
    rt_current_thread = tp;
    ((void (*)(void*))tp->entry)(&argv[2]);
    return 0;
}



static AT_CMD_ENTRY_TypeDef s_at_cmd_list[] = {
    { AT_FUN(la),"list app",run_at_ls_app},
    { AT_FUN(ta),"test app",run_at_exec_app}
};




void at_rt_thread_app_init() {
    at_register_many(s_at_cmd_list, sizeof(s_at_cmd_list) / sizeof(AT_CMD_ENTRY_TypeDef));
}





int rt_thread_total() {
    return s_rt_thread_num;
}

void rt_tick_increase(void) {
    rt_thread_t tp = NULL;
    ++rt_tick;
    for (int i = 0; i < s_rt_thread_num; i++)
    {
        tp = s_rt_list[i];
        if (tp->thread_timer.timeout_func == NULL || tp->stat != RT_THREAD_READY) {
            continue;
        }
        if (tp->thread_timer.timeout_tick > 0) {
            tp->thread_timer.timeout_tick--;
        }
        if (tp->thread_timer.timeout_tick == 0) {
            rt_current_thread = tp;
            ((void (*)(void *))tp->thread_timer.timeout_func)(tp->thread_timer.parameter);
        }
    }

}

rt_err_t rt_thread_register(rt_thread* thread, const char* name, void (*exec)(void* parameter),void (*loop)(void* parameter)) {
    sprintf(thread->name, name);
    thread->stat = RT_THREAD_INIT;
    thread->entry =(void *) exec;
    thread->thread_timer.timeout_func = loop;
    s_rt_list[s_rt_thread_num] = thread;
    s_rt_thread_num++;
    return 0;
}


rt_err_t rt_thread_startup(rt_thread_t thread) {
    thread->stat = RT_THREAD_READY;
    thread->thread_timer.timeout_tick = 0;
    return 0;
}


rt_thread_t rt_thread_find(char* name) {
    rt_thread_t tp = NULL;
    for (int i = 0; i < s_rt_thread_num; i++)
    {
        if (!strcmp(name, s_rt_list[i]->name)) {
         
            return s_rt_list[i];
        }
    }
    return NULL;
}



rt_thread_t rt_thread_find_by_inx(int inx) {
    return s_rt_list[inx];
}

rt_err_t rt_thread_control(rt_thread_t thread, int cmd, void* arg) {
    thread->user_data = cmd;
	  thread->thread_timer.parameter=arg;
    return 0;
}

rt_err_t rt_thread_delay(rt_tick_t tick) {
    rt_current_thread->thread_timer.timeout_tick = tick;
    return 0;
}

rt_err_t rt_thread_mdelay(uint32_t ms) {
    rt_current_thread->thread_timer.timeout_tick = ms/ RT_THREAD_TICK_MS;
    return 0;
}

rt_thread_t rt_thread_self(void) {
    return rt_current_thread;
}
rt_err_t rt_thread_suspend(rt_thread_t thread) {
    if (thread == NULL) {
        thread = rt_current_thread;
    }
    thread->stat = RT_THREAD_SUSPEND;
    return 0;
}

rt_err_t rt_thread_resume(rt_thread_t thread) {
    if (thread == NULL) {
        thread=  rt_current_thread;
    }
    thread->stat = RT_THREAD_READY;
    thread->thread_timer.timeout_tick = 0;
    return 0;
}

rt_tick_t rt_tick_get(void)
{
    return rt_tick;
}




//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
static void loop(void* args) {
    printf("demo run: %d \n",55);
    rt_thread_delay(10000);
}

static void exec(void* args) {
    char** argv = (char**)args;
    printf("demo %s \n", argv[0]);
    if (!strcmp(argv[0], "set")) {
        rt_kprintf("speed %d \n", argv[0]);
    }
    else if (!strcmp(argv[0], "stop")) {
        rt_thread_suspend(NULL);
    }
    else if (!strcmp(argv[0], "run")) {
        rt_thread_resume(NULL);
    }
}
void  demo_app_register() {
    static rt_thread demo_thread;
    rt_thread_register(&demo_thread, "demo", exec, loop);
    rt_thread_startup(&demo_thread);
    return;
}

```
###  rt_thread_app.h
```c
#ifndef _RtThreadApp_H
#define _RtThreadApp_H
#include "RtThreadAppManage.h"
#ifdef __cplusplus
extern "C" {
#endif
void rt_thread_app_register_all();
#ifdef __cplusplus
}
#endif
#endif
```

## 终端
[参考shell.c](https://github.com/RT-Thread/rt-thread/blob/master/components/finsh/shell.c)
[嵌入式终端AtShell](https://blog.csdn.net/qq_26074053/article/details/149534940)
### AtShell.h
```c
/*
 CON_AT_MSH=0: AT模式: 配合 Xmodem1K 更新固件
=>: AT+fun(a,b,c)\r\n
CON_AT_MSH=1: MSH模式: 调试
=>: fun a b \n
**/

#ifndef _AT_SHELL_H
#define _AT_SHELL_H

#include "stdint.h"
#include "string.h"
#include "stdbool.h"

//模式  0:AT    1:MSH
#define  CON_AT_MSH 1
//机器Hex通讯 AT+c(55,01 02)
#define  CON_AT_USE_CALLBACK 1
//数据监控
#define  CON_AT_USE_CycleMonitorData 1
//监控总数量
#define CON_CYCLE_MONITOR_DATA_PACK_NUM  10

//方法数
#define  CON_AT_METHOD_NUM     10//  10
#define  FINSH_CMD_SIZE       20  //20             //最长命令尺寸
#define  RT_FINSH_ARG_MAX      3// 6        //参数个数
#define  FINSH_HISTORY_LINES    3       //历史命令条数
#define  CON_AT_R_SUCCESS   0    // 成功
#define  CON_AT_R_ERR_ARG   1    // 参数错误
#define  CON_AT_R_ERR_NO_CMD   2  //无此命令
#define  CON_AT_R_ERR_EXEC_FAIL 3  //执行失败
#define  CON_AT_WRITE_TIMEOUT   100
//一种异步发送的实现
#define  CON_AT_USE_EXPORT    0
#define  CON_AT_OUT_BUF_SIZE     200
#define CON_METHOD_NAME_SIZE 8
#define CON_HELP_INFO_SIZE  20


typedef int (*ATServerFun)(int argc, char **argv);
typedef int (*ATWriteFun)(uint8_t *buf, uint32_t len,uint32_t timeout);

#if CON_AT_USE_CALLBACK == 1
typedef void (*ATCallBackFun)(uint32_t code, uint8_t *buf, uint32_t len);
#endif

typedef struct {
    char methodName[CON_METHOD_NAME_SIZE];
    char helpInfo[CON_HELP_INFO_SIZE];
    ATServerFun atFun;
    void *userData;
} AT_CMD_ENTRY_TypeDef;


typedef struct {
    char     tag[CON_CYCLE_MONITOR_DATA_PACK_NUM][10];
    uint8_t  buffer[CON_CYCLE_MONITOR_DATA_PACK_NUM][100];
    uint8_t  bufferLen[CON_CYCLE_MONITOR_DATA_PACK_NUM];
    uint8_t  curInx;
} AT_CycleMonitorDataTypeDef;
#ifdef __cplusplus


class AtShell {
private:
    AT_CMD_ENTRY_TypeDef *m_cmdList;
    uint32_t m_cmdSize;
    int m_cmdNum;
    char m_buf[FINSH_CMD_SIZE];
    uint32_t m_bufLen;
    uint32_t m_importMs;
    uint32_t m_lock;
    int m_argc;
    char m_method[CON_METHOD_NAME_SIZE];
    char *m_argv[RT_FINSH_ARG_MAX];
    ATWriteFun m_initWriteFun;
    ATWriteFun m_writeFun;
    virtual bool Parse(char *str);

public:
    AtShell();
    virtual ~AtShell();
    AT_CMD_ENTRY_TypeDef *ctx;
#if CON_AT_USE_CALLBACK == 1
    ATCallBackFun m_atCallBackFun;
#endif
#if CON_AT_USE_EXPORT == 1
    char m_out_buf[CON_AT_OUT_BUF_SIZE];
    uint32_t m_out_bufLen;
    virtual void Export();
#endif

    virtual void Init(ATWriteFun writeFun);
    virtual void SetWriteFun(ATWriteFun writeFun);
    virtual void ResetWriteFun();
    virtual char *GetBuf() { return m_buf; };
    virtual int GetCmdNum() { return m_cmdNum; };
    virtual bool Regist(AT_CMD_ENTRY_TypeDef cmd);
    virtual bool Regist(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen);
    virtual bool Exec(char *str);
    virtual int Import(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual int ImportForAt(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual int  AsyncPrintf(const char *format, ...);
    virtual int  Printf(const char *format, ...);
    virtual int Output(long nLevel, const char *pszFileName, int nLineNo, const char *pszFmt, ...);
    virtual int PrintfBs(uint8_t *buf, uint32_t len);
    virtual int Write(uint8_t *buf, uint32_t len,uint32_t timeout);
    virtual int Write(uint8_t data);
    virtual void AtCall(uint32_t code, uint8_t *buf, uint32_t len);
    virtual int Reply(uint8_t errCode);
    virtual void ShowVersion();
#if CON_AT_USE_CycleMonitorData==1
    AT_CycleMonitorDataTypeDef m_monitorData;
    virtual int MonitorDataPush(const char *tag, uint8_t * buffer, int len);
    virtual int MonitorDataViewInfo();
#endif

#if CON_AT_MSH == 1
    uint16_t m_currentHistory;
    uint16_t m_historyCount;
    char m_cmdHistory[FINSH_HISTORY_LINES][FINSH_CMD_SIZE];
    int m_stat;
    char m_line[FINSH_CMD_SIZE];
    uint8_t m_linePosition;
    uint8_t m_lineCurpos;

    virtual int ImportForMsh(uint8_t *buf, uint32_t len, uint32_t ms = 0);
    virtual void MshAddChar(char ch);
    virtual void ShellPushHistory();
    virtual void ShellAutoComplete(char *prefix);
    virtual void MshAutoComplete(char *prefix);
    virtual bool ShellHandleHistory();
#endif
};

extern AtShell g_atShell;

enum AT_LOG_LEVEL {
    AT_LOG_LEVEL_TRACE,
    AT_LOG_LEVEL_DEBUG,
    AT_LOG_LEVEL_INFO,
    AT_LOG_LEVEL_WARNING,
    AT_LOG_LEVEL_ERROR
};

extern AtShell g_atShell;

#define AT_m_buf  g_atShell.GetBuf()

#if CON_AT_MSH == 1
#define AT_FUN(fun)    #fun
#else
#define AT_FUN(fun)    "AT+"#fun
#endif
#define CONCAT(a, b) a ## b
#define AT_FILE_NAME(x)   strrchr(x,'\\')?strrchr(x,'\\')+1:x
#define AT_info(...)      g_atShell.Output(AT_LOG_LEVEL_INFO,__func__, __LINE__,__VA_ARGS__)
#define AT_debug(...)     g_atShell.Output(AT_LOG_LEVEL_DEBUG,AT_FILE_NAME(__FILE__), __LINE__,__VA_ARGS__)
#define AT_debug1(...)    g_atShell.Output(AT_LOG_LEVEL_DEBUG,__func__,__LINE__,__VA_ARGS__)
#define AT_error(...)     g_atShell.Output(AT_LOG_LEVEL_ERROR,__PRETTY_FUNCTION__,__LINE__,__VA_ARGS__)
#define AT_printf(format, ...)  g_atShell.Printf(format,##__VA_ARGS__)
#define AT_println(format, ...)  g_atShell.Printf(format,##__VA_ARGS__);AT_printf("\r\n")
#define AT_aprintf(format, ...)    g_atShell.AsyncPrintf(format,##__VA_ARGS__)
#define AT_aprintln(format, ...)  g_atShell.AsyncPrintf(format,##__VA_ARGS__);AT_aprintf("\r\n")

#define AT_printfBs(buf, len)  g_atShell.PrintfBs(buf,len)
#define rt_kprintf                  AT_printf
#define ATX_info(w, ...)             g_atShell.SetWriteFun(w);AT_info(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_debug(w, ...)            g_atShell.SetWriteFun(w);AT_debug(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_error(w, ...)            g_atShell.SetWriteFun(w);AT_error(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_printf(w, ...)           g_atShell.SetWriteFun(w);AT_printf(__VA_ARGS__);g_atShell.ResetWriteFun();
#define ATX_printfBs(w, buf, len)     g_atShell.SetWriteFun(w);g_atShell.PrintfBs(buf,len);g_atShell.ResetWriteFun();
#endif

#if CON_AT_USE_CALLBACK == 1
#define AT_SET_CALL_BACK(fun)          g_atShell.m_atCallBackFun=fun
#endif


#define AT_SHELL_EXPORT(cmdName, desc, fun, ...)  AT_CMD_ENTRY_TypeDef fun##entrycmd={AT_FUN(cmdName),#desc,fun,__VA_ARGS__}; at_register(fun##entrycmd)
#define AT_EXEC(cmd)    g_atShell.Exec(cmd)


#ifdef __cplusplus
extern "C" {
#endif
void at_init(ATWriteFun writeFun);
int  at_import(uint8_t *buf, uint32_t len, uint32_t ms);
#if CON_AT_USE_EXPORT == 1
void  at_export();
#endif
#if CON_AT_USE_CycleMonitorData == 1
void  at_monitor_init();
void  at_monitor_push(const char *tag, uint8_t * buffer, int len);
void  at_monitor_viewInfo();
#endif
bool at_try_import(uint8_t *buf, uint32_t len, uint32_t ms);
bool at_register(AT_CMD_ENTRY_TypeDef cmd);
bool at_register_many(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen);
int  at_write(uint8_t *buf, uint32_t len,uint32_t timeout);
int  at_awrite(uint8_t *buf, uint32_t len);
int  at_printf(const char *format, ...);
int  at_aprintf(const char *format, ...);
int  at_reply(uint8_t errCode);
int  at_hexStringToByteArray(const char *hexStr, unsigned char *bs);
long at_str_to_int(char* str);
void at_show_version();
#ifdef __cplusplus
}
#endif

#endif





/*
*
#include <iostream>
#include "AtShell.h"
#include "stdio.h"
int shell_write(uint8_t* buf, uint32_t len,uint32_t timeout) {
	return  printf("%s", buf);
}
static int test01(int argc, char** argv) {
	AT_printf("argc %d:\r\n", argc);
	return 0;
}
int main() {
	at_init(shell_write);
	AT_SHELL_EXPORT(test01, "", test01);
	while (1) {
		char a = getchar();
		uint8_t bs[1] = { a };
		at_import(bs, 1, 0);
	}
	return 0;
}
**/
```

### AtShell.cpp
```c
#include "AtShell.h"
#include "stdio.h"
#include "stdlib.h"
#include "stdarg.h"
#include "string.h"
#include <ctype.h>
#include <limits.h>

#define CON_AT_DELIMITER   "(,)"
#define CON_AT_DELIMITER_BANK   " "
#define FINSH_PROMPT        "$:"

static int __help(int argc, char **argv);


AtShell g_atShell;


#if CON_AT_MSH == 1

static int __clean(int argc, char **argv) {
    AT_printf("\033c");
    return 0;
}

#else
static int __at(int argc, char** argv) {
    at_reply(CON_AT_R_SUCCESS);
    return 0;
}
#endif


#if CON_AT_USE_CALLBACK == 1
static int __call(int argc, char **argv) {
    if (argc <= 2) {
        return 0;
    }
    char *hexStr = argv[2];
    uint32_t code = strtol(argv[1], NULL, 16);
    char *bs = g_atShell.GetBuf();
    int len = at_hexStringToByteArray(hexStr, (unsigned char *) bs);
    if (g_atShell.m_atCallBackFun != NULL) {
        g_atShell.m_atCallBackFun(code, (uint8_t *) bs, len);
    }
    return 0;
}

#endif

static AT_CMD_ENTRY_TypeDef s_ap_cmd_entry[CON_AT_METHOD_NUM] = {
        {AT_FUN(help), "list cmd", __help, 0},
#if CON_AT_USE_CALLBACK == 1
        {AT_FUN(c), "(55,01 02)", __call, 0},
#endif
#if CON_AT_MSH == 1
        {"clean", "clean screen", __clean, 0},
#else
        { "AT","",__at, 0 },
#endif
};

static int __help(int argc, char **argv) {
    int cmdInx = g_atShell.GetCmdNum();
    AT_printf("AtShell commands:\r\n");
    for (int i = 0; i < cmdInx; i++) {
        AT_printf("%2d.%-20s - %s \r\n", i, s_ap_cmd_entry[i].methodName, s_ap_cmd_entry[i].helpInfo);
    }
    return 0;
}


AtShell::AtShell() {
    m_cmdList = s_ap_cmd_entry;
    m_cmdSize = CON_AT_METHOD_NUM;
    m_cmdNum = 0;
    m_writeFun = NULL;
    m_bufLen = 0;
    m_importMs = 0;
#if CON_AT_USE_EXPORT == 1
    m_out_bufLen=0;
#endif
    for (size_t i = 0; i < m_cmdSize; i++) {
        if (m_cmdList[i].atFun == NULL) {
            m_cmdNum = i;
            break;
        }
    }
}


AtShell::~AtShell() {

}


bool AtShell::Regist(AT_CMD_ENTRY_TypeDef cmd) {
    if (m_cmdNum >= CON_AT_METHOD_NUM) {
        return false;
    }
    m_cmdList[m_cmdNum] = cmd;
    m_cmdNum++;
    return true;
}

bool AtShell::Regist(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen) {
    if (m_cmdNum + cmdLen > CON_AT_METHOD_NUM) {
        return false;
    }
    for (int i = 0; i < cmdLen; i++) {
        AtShell::Regist(cmdList[i]);
    }
    return true;
}

void AtShell::Init(ATWriteFun writeFun) {
    m_writeFun = writeFun;
    m_initWriteFun = writeFun;
}


void AtShell::SetWriteFun(ATWriteFun writeFun) {
    m_writeFun = writeFun;
}

void AtShell::ResetWriteFun() {
    m_writeFun = m_initWriteFun;
}

bool AtShell::Parse(char *str) {
    if (m_buf != str) {
        strcpy(m_buf, str);
    }
    m_argv[0] = m_buf;
    char *token;
    char delimiter[16] = CON_AT_DELIMITER;
    if (strstr((char *) str, "AT") != (char *) str) {
        sprintf(delimiter, CON_AT_DELIMITER_BANK);
    }
    token = strtok(m_buf, delimiter);
    int i = 0;
    while (token != NULL) {
        if (i == 0) {
            snprintf(m_method, sizeof(m_method), "%s", token);
            snprintf(m_argv[0], sizeof(m_method), "%s", token);
            m_argv[1] = &m_buf[strlen(m_argv[0]) + 1];
        } else if (i < RT_FINSH_ARG_MAX) {
            sprintf(m_argv[i], "%s", token);
            m_argv[i + 1] = m_argv[i] + strlen(m_argv[i]) + 1;
        }
        token = strtok(NULL, delimiter);
        i++;
        m_argc = i;
    }
    return true;
}


bool AtShell::Exec(char *str) {
    m_lock = 1;
    bool r = Parse(str);
    if (r == false) {
        m_lock = 0;
        return r;
    }
    bool cmd_ret = false;
    //methodName match
    for (int i = 0; i < m_cmdNum; i++) {
        if (strcmp(m_cmdList[i].methodName, m_method) == 0) {
            this->ctx = &m_cmdList[i];
            m_cmdList[i].atFun(m_argc, m_argv);
            cmd_ret = true;
            break;
        }
    }
    //inx match
    if (!cmd_ret) {
        int inx = strtol(m_method, NULL, 10);
        if ('0' <= m_method[0] && m_method[0] <= '9' && inx < m_cmdNum) {
            this->ctx = &m_cmdList[inx];
            m_cmdList[inx].atFun(m_argc, m_argv);
            cmd_ret = true;
        }
    }
    if (!cmd_ret) {
        char *tcmd;
        tcmd = str;
        while (*tcmd != ' ' && *tcmd != '\0') {
            tcmd++;
        }
        *tcmd = '\0';
        this->Printf("%s: command not found.\n", str);
    }
    m_bufLen = 0;
    m_lock = 0;
    return cmd_ret;
}

int AtShell::Import(uint8_t *buf, uint32_t len, uint32_t ms) {
#if CON_AT_MSH == 1
    return this->ImportForMsh(buf, len, ms);
#else
    return  this->ImportForAt(buf, len, ms);
#endif
}



int AtShell::ImportForAt(uint8_t *buf, uint32_t len, uint32_t ms) {
    if (m_lock == 1 || len == 0 || len > sizeof(m_buf)) {
        return 0;
    }
    if (buf == NULL || ms - m_importMs > 10 || m_bufLen + len >= sizeof(m_buf)) {
        m_bufLen = 0;
    }
    if (buf != NULL) {
        memcpy(m_buf + m_bufLen, buf, len);
    }
    m_bufLen = m_bufLen + len;
    m_importMs = ms;
    if (m_bufLen < 3) {
        return 0;
    }
    if (m_buf[m_bufLen - 2] == 0x0d && m_buf[m_bufLen - 1] == 0x0a) {
        if (strstr((char *) m_buf, "AT") == (char *) m_buf) {
            m_buf[m_bufLen - 1] = 0;
            m_buf[m_bufLen - 2] = 0;
        } else {
            m_buf[m_bufLen - 1] = 0;
            m_buf[m_bufLen - 2] = 0;
        }
        this->Exec(m_buf);
        return m_bufLen;
    }
    return 0;
}


int AtShell::Printf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}


int AtShell::Output(long nLevel, const char *pszFileName, int nLineNo, const char *format, ...) {
    char log_buf[256];
    snprintf(log_buf, sizeof(log_buf), "[%s:%d]", pszFileName, nLineNo);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}

int AtShell::PrintfBs(uint8_t *buf, uint32_t len) {
    char log_buf[256];
    if (len == 0 || len > 80) {
        return 0;
    }
    for (size_t i = 0; i < len; i++) {
        sprintf(&log_buf[3 * i], "%02X ", buf[i]);
    }
    log_buf[3 * len - 1] = '\n';
    this->Write((uint8_t *) log_buf, 3 * len,CON_AT_WRITE_TIMEOUT);
    return 3 * len;
}


int AtShell::Write(uint8_t *buf, uint32_t len,uint32_t timeout) {
    return m_writeFun(buf, len,timeout);
}

int AtShell::Write(uint8_t data) {
    uint8_t temp[1] = {data};
    return m_writeFun(temp, 1,CON_AT_WRITE_TIMEOUT);
}


void AtShell::AtCall(uint32_t code, uint8_t *buf, uint32_t len) {
    char log_buf[256];
    if (len == 0 || len > 80) {
        return;
    }
    for (size_t i = 0; i < len; i++) {
        sprintf(&log_buf[3 * i], "%02X ", buf[i]);
    }
    log_buf[3 * len - 1] = 0;
    this->Printf("AT+c(%d,%s)\r\n", code, log_buf);
}


int AtShell::Reply(uint8_t errCode) {
    if (errCode) {
        this->Printf("NG:%d\r\n", errCode);
        return errCode;
    }
    this->Printf("OK\r\n");
    return errCode;
}


void AtShell::ShowVersion() {
    this->Printf(" \\ | /\r\n");
    this->Printf("- AT_SHELL - %s  msh:%d \r\n", __DATE__, CON_AT_MSH);
    this->Printf(" / | \\\r\n");
#if CON_AT_MSH == 1
    char s[1] = {""};
    ShellAutoComplete(s);
#endif
}


#if CON_AT_MSH == 1
#if 0
/*
void msh_split_test(){
    char* argv[RT_FINSH_ARG_MAX];
    char test_cmd[100] = { "funcname arg0 \"arg1 arg1\"" };
    msh_split(test_cmd, sizeof(test_cmd), argv);
}
*/
static int msh_split(char* cmd, uint32_t length, char* argv[RT_FINSH_ARG_MAX])
{
    char* ptr;
    uint32_t position;
    uint32_t argc;
    uint32_t i;
    /* strim the beginning of command */
    while (*cmd == ' ' || *cmd == '\t')
    {
        cmd++;
        length--;
    }
    if (length == 0)
        return 0;
    ptr = cmd;
    position = 0; argc = 0;
    while (position < length)
    {
        /* strip bank and tab */
        while ((*ptr == ' ' || *ptr == '\t') && position < length)
        {
            *ptr = '\0';
            ptr++; position++;
        }

        if (argc >= RT_FINSH_ARG_MAX)
        {
            rt_kprintf("Too many args ! We only Use:\n");
            for (i = 0; i < argc; i++)
            {
                rt_kprintf("%s ", argv[i]);
            }
            rt_kprintf("\n");
            break;
        }

        if (position >= length) break;

        /* handle string */
        if (*ptr == '"')
        {
            ptr++; position++;
            argv[argc] = ptr; argc++;

            /* skip this string */
            while (*ptr != '"' && position < length)
            {
                if (*ptr == '\\')
                {
                    if (*(ptr + 1) == '"')
                    {
                        ptr++; position++;
                    }
                }
                ptr++; position++;
            }
            if (position >= length) break;

            /* skip '"' */
            *ptr = '\0'; ptr++; position++;
        }
        else
        {
            argv[argc] = ptr;
            argc++;
            while ((*ptr != ' ' && *ptr != '\t') && position < length)
            {
                ptr++; position++;
            }
            if (position >= length) break;
        }
    }
    return argc;
}
#endif


static void *rt_memmove(void *dest, const void *src, uint32_t n) {
    char *tmp = (char *) dest, *s = (char *) src;

    if (s < tmp && tmp < s + n) {
        tmp += n;
        s += n;

        while (n--)
            *(--tmp) = *(--s);
    } else {
        while (n--)
            *tmp++ = *s++;
    }

    return dest;
}

static char *rt_strncpy(char *dst, const char *src, uint32_t n) {
    if (n != 0) {
        char *d = dst;
        const char *s = src;

        do {
            if ((*d++ = *s++) == 0) {
                /* NUL pad the remaining n-1 bytes */
                while (--n != 0)
                    *d++ = 0;
                break;
            }
        } while (--n != 0);
    }

    return (dst);
}

static int str_common(const char *str1, const char *str2) {
    const char *str = str1;
    while ((*str != 0) && (*str2 != 0) && (*str == *str2)) {
        str++;
        str2++;
    }
    return (str - str1);
}


int AtShell::ImportForMsh(uint8_t *buf, uint32_t len, uint32_t ms) {
    for (size_t i = 0; i < len; i++) {
        MshAddChar(buf[i]);
    }
    return len;
}


void AtShell::ShellAutoComplete(char *prefix) {
    this->Printf("\r\n");
    MshAutoComplete(prefix);
    this->Printf("%s%s", FINSH_PROMPT, prefix);
}


void AtShell::MshAutoComplete(char *prefix) {
    int length, min_length;
    const char *name_ptr, *cmd_name;
    int index;
    min_length = 0;
    name_ptr = 0;
    if (*prefix == '\0') {
        return;
    }
    for (index = 0; index < g_atShell.GetCmdNum(); index++) {
        /* skip finsh shell function */
        cmd_name = s_ap_cmd_entry[index].methodName;
        if (strncmp(prefix, cmd_name, strlen(prefix)) == 0) {
            if (min_length == 0) {
                /* set name_ptr */
                name_ptr = cmd_name;
                /* set initial length */
                min_length = strlen(name_ptr);
            }
            length = str_common(name_ptr, cmd_name);
            if (length < min_length)
                min_length = length;

            this->Printf("%s\r\n", cmd_name);
        }
    }


    /* auto complete string */
    if (name_ptr != NULL) {
        rt_strncpy(prefix, name_ptr, min_length);
    }
    return;
}

void AtShell::MshAddChar(char ch) {
    enum input_stat {
        WAIT_NORMAL = 0,
        WAIT_SPEC_KEY,
        WAIT_FUNC_KEY,
    };
    /*
     * handle control key
     * up key  : 0x1b 0x5b 0x41
     * down key: 0x1b 0x5b 0x42
     * right key:0x1b 0x5b 0x43
     * left key: 0x1b 0x5b 0x44
     */
    if (ch == 0x1b) {
        m_stat = WAIT_SPEC_KEY;
        return;
    } else if (m_stat == WAIT_SPEC_KEY) {
        if (ch == 0x5b) {
            m_stat = WAIT_FUNC_KEY;
            return;
        }
        m_stat = WAIT_NORMAL;
    } else if (m_stat == WAIT_FUNC_KEY) {
        m_stat = WAIT_NORMAL;
        if (ch == 0x41) /* up key */
        {
            /* prev history */
            if (m_currentHistory > 0)
                m_currentHistory--;
            else {
                m_currentHistory = 0;
                return;
            }

            /* copy the history command */
            memcpy(m_line, &m_cmdHistory[m_currentHistory][0], FINSH_CMD_SIZE);
            m_lineCurpos = m_linePosition = strlen(m_line);
            ShellHandleHistory();
            return;
        } else if (ch == 0x42) {
            /* next history */
            if (m_currentHistory < m_historyCount - 1)
                m_currentHistory++;
            else {
                /* set to the end of history */
                if (m_historyCount != 0)
                    m_currentHistory = m_historyCount - 1;
                else
                    return;
            }

            memcpy(m_line, &m_cmdHistory[m_currentHistory][0],
                   FINSH_CMD_SIZE);
            m_lineCurpos = m_linePosition = strlen(m_line);
            ShellHandleHistory();
            return;
        } else if (ch == 0x44) /* left key */
        {
            if (m_lineCurpos) {
                this->Printf("\b");
                m_lineCurpos--;
            }

            return;
        } else if (ch == 0x43) /* right key */
        {
            if (m_lineCurpos < m_linePosition) {
                this->Printf("%c", m_line[m_lineCurpos]);
                m_lineCurpos++;
            }

            return;
        }
    }
    /* received null or error */
    if (ch == '\0' || ch == 0xFF) return;
        /* handle tab key */
    else if (ch == '\t') {
        int i;
        /* move the cursor to the beginning of line */
        for (i = 0; i < m_lineCurpos; i++)
            this->Printf("\b");

        /* auto complete */
        ShellAutoComplete(&m_line[0]);
        /* re-calculate position */
        m_lineCurpos = m_linePosition = strlen(m_line);
        return;
    }
        /* handle backspace key */
    else if (ch == 0x7f || ch == 0x08) {
        /* note that line_curpos >= 0 */
        if (m_lineCurpos == 0)
            return;

        m_linePosition--;
        m_lineCurpos--;
        if (m_linePosition > m_lineCurpos) {
            int i;
            rt_memmove(&m_line[m_lineCurpos],
                       &m_line[m_lineCurpos + 1],
                       m_linePosition - m_lineCurpos);
            m_line[m_linePosition] = 0;
            this->Printf("\b%s  \b", &m_line[m_lineCurpos]);

            /* move the cursor to the origin position */
            for (i = m_lineCurpos; i <= m_linePosition; i++)
                this->Printf("\b");
        } else {
            this->Printf("\b \b");
            m_line[m_linePosition] = 0;
        }

        return;
    }

    /* handle end of line, break */
    if (ch == '\r' || ch == '\n') {
        ShellPushHistory();

        this->Printf("\r\n");
        // printf("%s", line);
        m_line[m_linePosition] = '\0';
        g_atShell.Exec(m_line);
        this->Printf("\r\n%s", FINSH_PROMPT);
        memset(m_line, 0, sizeof(m_line));
        m_lineCurpos = m_linePosition = 0;
        return;
    }

    /* it's a large line, discard it */
    if (m_linePosition >= FINSH_CMD_SIZE)
        m_linePosition = 0;

    /* normal character */
    if (m_lineCurpos < m_linePosition) {
        int i;
        rt_memmove(&m_line[m_lineCurpos + 1], &m_line[m_lineCurpos], m_linePosition - m_lineCurpos);
        m_line[m_lineCurpos] = ch;
        this->Printf("%s", &m_line[m_lineCurpos]);
        /* move the cursor to new position */
        for (i = m_lineCurpos; i < m_linePosition; i++)
            this->Printf("\b");
    } else {
        m_line[m_linePosition] = ch;
        this->Printf("%c", ch);
    }

    ch = 0;
    m_linePosition++;
    m_lineCurpos++;
    if (m_linePosition >= FINSH_CMD_SIZE) {
        /* clear command line */
        m_linePosition = 0;
        m_lineCurpos = 0;
    }
}


void AtShell::ShellPushHistory() {
    if (m_linePosition != 0) {
        /* push history */
        if (m_historyCount >= FINSH_HISTORY_LINES) {
            /* if current cmd is same as last cmd, don't push */
            if (memcmp(&m_cmdHistory[FINSH_HISTORY_LINES - 1], m_line, FINSH_CMD_SIZE)) {
                /* move history */
                int index;
                for (index = 0; index < FINSH_HISTORY_LINES - 1; index++) {
                    memcpy(&m_cmdHistory[index][0],
                           &m_cmdHistory[index + 1][0], FINSH_CMD_SIZE);
                }
                memset(&m_cmdHistory[index][0], 0, FINSH_CMD_SIZE);
                memcpy(&m_cmdHistory[index][0], m_line, m_linePosition);
                m_historyCount = FINSH_HISTORY_LINES;
            }
        } else {
            /* if current cmd is same as last cmd, don't push */
            if (m_historyCount == 0 || memcmp(&m_cmdHistory[m_historyCount - 1], m_line, FINSH_CMD_SIZE)) {
                m_currentHistory = m_historyCount;
                memset(&m_cmdHistory[m_historyCount][0], 0, FINSH_CMD_SIZE);
                memcpy(&m_cmdHistory[m_historyCount][0], m_line, m_linePosition);
                m_historyCount++;
            }
        }
    }
    m_currentHistory = m_historyCount;
}


bool AtShell::ShellHandleHistory() {
#if defined(_WIN32)
    int i;
    this->Printf("\r");

    for (i = 0; i <= 60; i++)
      this->Write(' ');
      this->Printf("\r");

#else
    rt_kprintf("\033[2K\r");
#endif
    this->Printf("%s%s", FINSH_PROMPT, m_line);
    return 0;
}

#endif


#if CON_AT_USE_EXPORT == 1
void AtShell::Export(){
    if(m_out_bufLen>0){
        m_writeFun((uint8_t *) m_out_buf, m_out_bufLen,CON_AT_WRITE_TIMEOUT);
    }
    m_out_bufLen=0;
}

#endif

#if CON_AT_USE_EXPORT == 1
int AtShell::AsyncPrintf(const char *format, ...){
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    if(m_out_bufLen+len < CON_AT_OUT_BUF_SIZE){
        memcpy(m_out_buf + m_out_bufLen, log_buf, len);
        m_out_bufLen=m_out_bufLen+len;
    } else{
        AT_error("error \r\n");
    }
    va_end(args);
    return len;
}
#else
int AtShell::AsyncPrintf(const char *format, ...){
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    m_writeFun((uint8_t *) log_buf, len,0);
    va_end(args);
    return len;
}
#endif

#if CON_AT_USE_CycleMonitorData==1
static uint8_t _sum(uint8_t * buffer, int len){
    uint8_t sum = 0;
    for (int i = 0; i < len; i++) {
        sum += buffer[i];
    }
    return(sum);
}
int AtShell::MonitorDataPush(const char *tag, uint8_t * buffer, int len){
    if(m_monitorData.curInx==CON_CYCLE_MONITOR_DATA_PACK_NUM){
        m_monitorData.curInx=0;
    }
    sprintf(m_monitorData.tag[m_monitorData.curInx], "%s", tag);
    memcpy(m_monitorData.buffer[m_monitorData.curInx],buffer,len);
    m_monitorData.bufferLen[m_monitorData.curInx]=len;
    m_monitorData.curInx++;
    return 0;
}

int AtShell::MonitorDataViewInfo(){
    int inx=m_monitorData.curInx-1;
    for(int i=0;i<CON_CYCLE_MONITOR_DATA_PACK_NUM;i++){
        if(inx==-1){
            inx=9;
        }
        this->Printf("%s:%3d.%3d@",m_monitorData.tag[inx],m_monitorData.bufferLen[inx],_sum(m_monitorData.buffer[inx],m_monitorData.bufferLen[inx]));
        AT_printfBs( m_monitorData.buffer[inx],m_monitorData.bufferLen[inx]);
        this->Printf("\r\n");
        inx--;
    }
    return 0;
}
#endif



void at_init(ATWriteFun writeFun) {
    g_atShell.Init(writeFun);
}


int at_import(uint8_t *buf, uint32_t len, uint32_t ms) {
    return g_atShell.Import(buf, len, ms);
}
bool at_try_import(uint8_t *buf, uint32_t len, uint32_t ms) {
    if (CON_AT_MSH || strstr((char*)buf, "AT") == (char*)buf || strstr((char*)buf, "\r\n") == (char*)buf) {
        g_atShell.Import(buf, len, ms);
        return true;
    }
    return false;
}

#if CON_AT_USE_EXPORT == 1
void at_export() {
    g_atShell.Export();
}
#endif

bool at_register(AT_CMD_ENTRY_TypeDef cmd) {
    return g_atShell.Regist(cmd);
}

bool at_register_many(AT_CMD_ENTRY_TypeDef *cmdList, int cmdLen) {
    return g_atShell.Regist(cmdList, cmdLen);
}



int at_write(uint8_t *buf, uint32_t len,uint32_t timeout){
    return  g_atShell.Write(buf,len,timeout);
}

int at_printf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    g_atShell.Write((uint8_t *) log_buf, len,CON_AT_WRITE_TIMEOUT);
    va_end(args);
    return len;
}



int at_awrite(uint8_t *buf, uint32_t len){
#if CON_AT_USE_EXPORT == 1
    if(g_atShell.m_out_bufLen+len < CON_AT_OUT_BUF_SIZE){
            memcpy(g_atShell.m_out_buf + g_atShell.m_out_bufLen, buf, len);
            g_atShell.m_out_bufLen=g_atShell.m_out_bufLen+len;
            return len;
        }
        return 0;
#else
    return g_atShell.Write(buf,len,0);;
#endif
}


int at_aprintf(const char *format, ...) {
    char log_buf[256];
    va_list args;
    va_start(args, format);
    vsprintf(log_buf, format, args);
    uint32_t len = strlen(log_buf);
    at_awrite((uint8_t *) log_buf, len);
    va_end(args);
    return len;
}





int at_reply(uint8_t errCode) {
    return g_atShell.Reply(errCode);
}


void at_show_version() {
    g_atShell.ShowVersion();
}


int at_hexStringToByteArray(const char *hexStr, unsigned char *bs) {
    char token[3];
    int i = 0;
    long int byteValue;
    const int byteArrayLen = (strlen(hexStr) + 1) / 3;
    while (*hexStr && i < byteArrayLen) {
        if (isspace(*hexStr)) {
            hexStr++;
            continue;
        }

        if (!isxdigit(*hexStr)) {
            return i;
        }
        token[0] = *hexStr++;
        token[1] = *hexStr++;
        token[2] = '\0';
        byteValue = strtol(token, NULL, 16);
        bs[i] = (unsigned char) byteValue;
        i++;
    }
    return i;
}

long at_str_to_int(char* str) {
    char* endptr;
    int base = 10;
    if (str == 0) {
        return 0;
    }
    if (str[0] == '0') {
        if (str[1] == 'x' || str[1] == 'X') {
            base = 16;
            str += 2;
        }
        else {
            base = 8;
        }
    }
    long result = strtol(str, &endptr, base);
    if (*endptr != '\0') {

        return 0;
    }
    return result;
}

#if CON_AT_USE_CycleMonitorData == 1

void  at_monitor_init(){
    g_atShell.m_monitorData.curInx=0;
}
void  at_monitor_push(const char *tag, uint8_t * buffer, int len){
    g_atShell.MonitorDataPush(tag, buffer, len);
}
void  at_monitor_viewInfo(){
    g_atShell.MonitorDataViewInfo();
}

#endif
```

## 协程
这个协程库是线程的替代品,它是独立的
### Protothread.h
```c
#ifndef __PROTOTHREAD_H__
#define __PROTOTHREAD_H__
#include "stdint.h"
#define  PT_MAX_THREAD_NUM      5
#define  PT_THREAD_TICK_MS      10
/**
class LEDFlasher : public Protothread
{
    void Init(){
        AT_println("dd");
    }
    bool Run() {
        WHILE(1){
            AT_println("dd");
            PT_DELAY_MS(1000);
        }
        PT_END();
    }

    bool _Run() {
        AT_println("d33d");
        PtOsDelayMs(1000);
        return true;
    }
};

 void let_test(Protothread * pt) {
    LED_TOGGLE();
    PT_OS_DELAY_MS(10);
}

Protothread::Create(let_test);
LEDFlasher ledFlasher;
ledFlasher.Start();
**/


typedef struct {
    uint32_t	 code;
    uint32_t	 ms;
    void *       args;
} ProtothreadNotifyEvent;


class Protothread;
typedef  void (*PtRunFun)(Protothread * pt);
class Protothread
{
public:
    static Protothread* M_pts[PT_MAX_THREAD_NUM];
    //for start
    static int M_nspt;
    static int M_npt;
    //for cycle
    static uint32_t M_ms_tick;
    Protothread();
    virtual ~Protothread() { }
    virtual const char* Name(void) 	{ return("");}
    void Restart() { _ptLine = 0; }
    void Stop() { _ptLine = LineNumberInvalid; }
    bool IsRunning() { return _ptLine != LineNumberInvalid; }
    void PtOsDelay(uint32_t tick);
    void PtOsDelayMs(uint32_t ms);
    void PtOsDelayResume();
    virtual void OnTick();
    virtual void Init();
    virtual bool Run();
    virtual unsigned int Start();
    virtual void   Notify(Protothread * target,ProtothreadNotifyEvent evt);
    virtual void   OnRecvNotify(Protothread * source,ProtothreadNotifyEvent evt);
    static  void   OnRecvNotify(Protothread * source, Protothread * target,ProtothreadNotifyEvent evt);
    static void  AllStart();
    static void  OnTickAll();
    static int   PollAndRun(uint32_t tsMs);
    static Protothread* Create(PtRunFun run);
protected:
    PtRunFun m_run;
    unsigned int  m_id;
    uint32_t m_delay;
    typedef unsigned short LineNumber;
    static const LineNumber LineNumberInvalid = (LineNumber)(-1);
    LineNumber _ptLine;
public:
    uint32_t  m_state;
    uint32_t  m_indata;
    uint32_t  m_outdata;
    uint32_t GetDelay();
    uint32_t GetInData();
    void SetOutData(uint32_t outdata);
    uint32_t PopInData();
    bool  PushOutData(uint32_t outdata);
    static void SetInData(Protothread * pt,uint32_t indata);
    static bool PushIndata(Protothread * pt,uint32_t indata);
    static uint32_t GetOutData(Protothread * pt);
    static uint32_t  PopOutData(Protothread * pt);
};

#define PT_BEGIN() bool ptYielded = true; (void) ptYielded; switch (_ptLine) { case 0:
#define PT_END() default: ; } Stop(); return false;
#define PT_WAIT_UNTIL(condition) \
    do { _ptLine = __LINE__; case __LINE__: \
    if (!(condition)) return true; } while (0)
#define PT_WAIT_WHILE(condition) PT_WAIT_UNTIL(!(condition))
#define PT_WAIT_THREAD(child) PT_WAIT_WHILE((child).Run())
#define PT_SPAWN(child) \
    do { (child).Restart(); PT_WAIT_THREAD(child); } while (0)

#define PT_RESTART() do { Restart(); return true; } while (0)

#define PT_EXIT() do { Stop(); return false; } while (0)

#define PT_YIELD() \
    do { ptYielded = false; _ptLine = __LINE__; case __LINE__: \
    if (!ptYielded) return true; } while (0)

#define PT_YIELD_UNTIL(condition) \
    do { ptYielded = false; _ptLine = __LINE__; case __LINE__: \
    if (!ptYielded || !(condition)) return true; } while (0)

#define PT_DELAY(v)				\
  do {						\
    m_delay = v;			\
    PT_WAIT_UNTIL(m_delay == 0);		\
  } while(0)

#define PT_DELAY_MS(v)				\
  do {						\
    m_delay = v/PT_THREAD_TICK_MS;			\
    PT_WAIT_UNTIL(m_delay == 0);		\
  } while(0)

#define WHILE(a)   PT_BEGIN(); \
  while(1)

#define PT_OS_DELAY(tick)        pt->PtOsDelay(tick)
#define PT_OS_DELAY_MS(ms)       pt->PtOsDelayMs(ms)
//free time slice
#define PT_FREE_TIME_SLICE(tsMs)   PT_THREAD_TICK_MS-(tsMs-Protothread::M_ms_tick)
#endif
```
### Protothread.cpp
```c
#include "Protothread.h"

int  Protothread::M_nspt = 0;
int  Protothread::M_npt = 0;


uint32_t  Protothread::M_ms_tick = 0;

Protothread * Protothread::M_pts[PT_MAX_THREAD_NUM];

Protothread::Protothread(): _ptLine(0){
    m_delay = 0;
    m_indata=0;
    m_outdata=0;
    m_state=0;
    m_run=0;
    M_pts[Protothread::M_nspt++]= this;
}

void Protothread::PtOsDelay(uint32_t tick) {
    m_delay=tick;
}

void Protothread::PtOsDelayMs(uint32_t ms) {
    m_delay=ms/PT_THREAD_TICK_MS;
}

void Protothread::PtOsDelayResume() {
    m_delay=0;
}

void Protothread::Init() {

}

void Protothread::OnTick(){
    if (m_delay > 0)
        m_delay--;
    if(m_delay==0){
        this->Run();
    }
}

uint32_t Protothread::GetDelay(){
    return m_delay;
}

uint32_t Protothread::GetInData(){
    return m_indata;
}
void Protothread::SetInData(Protothread * pt,uint32_t indata){
    pt->m_indata=indata;
}

uint32_t Protothread::PopInData(){
    uint32_t v = m_indata;
    m_indata = 0;
    return v;
}

bool Protothread::PushIndata(Protothread * pt,uint32_t indata){
    if (pt->m_indata == 0) {
        pt->m_indata = indata;
        return true;
    }
    return false;
}

uint32_t Protothread::GetOutData(Protothread * pt){
    return pt->m_outdata;
}

void Protothread::SetOutData(uint32_t outdata){
    m_outdata=outdata;
}

uint32_t  Protothread::PopOutData(Protothread * pt){
    uint32_t v=pt->m_outdata;
    pt->m_outdata=0;
    return v;
}

bool  Protothread::PushOutData(uint32_t outdata){
    if(m_outdata==0) {
        m_outdata=outdata;
        return true;
    }
    return false;
}

unsigned int Protothread::Start() {
    this->Init();
    m_id=Protothread::M_npt++;
    M_pts[m_id]= this;
    return m_id;
}

bool Protothread::Run() {
    if(m_run!=0){
        m_run(this);
    }
    return true;
}

Protothread* Protothread::Create(PtRunFun run) {
    Protothread* pt= new Protothread();
    pt->m_run=run;
    return pt;
}



void Protothread::AllStart() {
    for (int i=0;i<M_nspt;i++){
        M_pts[i]->Start();
    }
}


void Protothread::OnTickAll() {
    for (int i=0;i<M_npt;i++){
        M_pts[i]->OnTick();
    }
}


int Protothread::PollAndRun(uint32_t tsMs) {
    #if PT_THREAD_TICK_MS==1
        Protothread::OnTickAll();
        return 1;
    #else
        if(tsMs-Protothread::M_ms_tick>=PT_THREAD_TICK_MS){
            Protothread::M_ms_tick=tsMs;
            Protothread::OnTickAll();
            return 1;
        }
        return 0;
    #endif
}

void  Protothread::Notify(Protothread * target,ProtothreadNotifyEvent evt){
    Protothread::OnRecvNotify(this,target,evt);
    if(target== nullptr){
          for(int i=0;i<Protothread::M_npt;i++){
              Protothread::M_pts[i]->OnRecvNotify(target,evt);
          }
          return;
      } else{
          target->OnRecvNotify(target,evt);
      }
}


void  Protothread::OnRecvNotify(Protothread * source,ProtothreadNotifyEvent evt){
    // nothing
}

void  Protothread::OnRecvNotify(Protothread * source, Protothread * target,ProtothreadNotifyEvent evt){
   // nothing
}
```

#  设备抽象层
正常来说设备抽象层是不能直接函数调用的方式调用应用层的,但我为了调试方便,在驱动层使用了Atshell

## ADC设备
### adc_dev.cpp
```c
#include "rt_device.h"
#include "main.h"
#include "esp32_adc_bsp.h"
#include "AtShell.h"


static rt_device s_dev;
const int adcPin = 34;


static rt_err_t  dev_init(rt_device_t dev) {
    bsp_adc_init(adcPin);
    return RT_EOK;
}


static rt_size_t  dev_read(rt_device_t dev, rt_off_t pos, void* buffer, rt_size_t size) {
    float adcValue = bsp_adc_read_voltage();
    *(float *)buffer=adcValue;
    return size;
}


static rt_err_t  dev_control(rt_device_t dev, int cmd, void* args) {
	if(cmd==0){
        rt_device_t dev=rt_device_find("adc");
        float val=0;
        rt_device_read(dev,0,&val,sizeof(val));
        g_atShell.Printf("adc value:%d\n",val);
	}
	g_atShell.Printf("ok\n");
	return RT_EOK;
}


void  adc_dev_register() {
    s_dev.init=dev_init;
    s_dev.control=dev_control;
    s_dev.read=dev_read;
	rt_device_register(&s_dev, "adc",0);
	return;
}

```
## 串口设备
这个驱动为AtSHell提供了读写串口的方法
### at_uart.cpp
```c
#include "rt_device.h"
#include "main.h"

static rt_device s_dev;


static rt_err_t  dev_init(rt_device_t dev) {

    return RT_EOK;
}

static rt_size_t  dev_read(rt_device_t dev, rt_off_t pos, void* buffer, rt_size_t size) {
    size_t readBytesSize = SHELL_SERIAL.readBytes((uint8_t *)buffer, size);
    return readBytesSize;
}

static rt_size_t  dev_write(rt_device_t dev, rt_off_t pos, const void* buffer, rt_size_t size) {
    int  writeResult = SHELL_SERIAL.write((uint8_t *)buffer, size);
    return writeResult;
}


static rt_err_t  dev_control(rt_device_t dev, int cmd, void* args) {
    switch (cmd) {
        case RT_DEVICE_CTRL_BYTES_AVAILABLE:{
            int *available = (int *)args;
            *available =SHELL_SERIAL.available();
            break;
        }
        default:{
            return -RT_ERROR;
        }

    }
	return RT_EOK;
}


void  at_uart_dev_register() {
    s_dev.init=dev_init;
    s_dev.control=dev_control;
    s_dev.read=dev_read;
    s_dev.write=dev_write;
	rt_device_register(&s_dev, "at_uart",0);
	return;
}

```

## led设备
### led_dev.cpp
```c
#include "rt_device.h"
#include "main.h"
#include "AtShell.h"
#include "esp32_led_bsp.h"


static rt_device s_dev;

static rt_err_t  dev_init(rt_device_t dev) {
    bsp_led_init(LED);
    return RT_EOK;
}


static rt_size_t  dev_write(rt_device_t dev, rt_off_t pos, const void* buffer, rt_size_t size) {
	
	if (*(uint8_t *)buffer == 1) {
        bsp_led_on();
	}
	else {
        bsp_led_off();
	}
	return size;
}

static rt_err_t  dev_control(rt_device_t dev, int cmd, void* args) {
	if(cmd==0){
        if (args != nullptr) {
            char * argStr=*(char **)args;
            AT_println("args %s", argStr);
        }
        bsp_led_toggle();
	}
	return RT_EOK;
}


void  led_dev_register() {
    s_dev.init=dev_init;
    s_dev.control=dev_control;
    s_dev.write=dev_write;
	rt_device_register(&s_dev, "led",0);
	return;
}

```

## 设备注册
### rt_device.cpp
```c
#include "rt_device.h"

#ifdef __cplusplus
extern "C" {
#endif

#ifdef __cplusplus
}
#endif

void  adc_dev_register();
void  led_dev_register();
void  at_uart_dev_register();

void rt_device_register_all() {
    at_rt_device_init();
    led_dev_register();
    adc_dev_register();
    at_uart_dev_register();
    rt_device_init_all();
}
```

# 应用层
## led应用
### led_app.cpp
```c
#include "rt_thread_app.h"
#include "Arduino.h"
#include "AtShell.h"



static int delayms = 1000;

//循环调用
static void loop(void* args) {
    printf("T: %d \n",micros());
    rt_thread_mdelay(delayms);
}

//atShell调用
static void exec(void * args) {
    char** argv = (char**)args;
    printf("led %s \n", argv[0]);

    if (!strcmp(argv[0], "set")) {
        int speed = 22;
        delayms = speed;
        rt_kprintf("speed %d \n", speed);
    }else if(!strcmp(argv[0], "stop")) {
        rt_thread_suspend(NULL);
    }
    else if (!strcmp(argv[0], "run")) {
        rt_thread_resume(NULL);

    }
}

//应用注册
void  led_app_register() {
    static rt_thread led_thread;
    rt_thread_register(&led_thread, "led", exec, loop);
    //rt_thread_startup(&led_thread);
    return;
}

```
## 应用注册
### rt_thread_app.cpp
```c
#include "rt_thread_app.h"


void  led_app_register();


void rt_thread_app_register_all() {
    at_rt_thread_app_init();
    led_app_register();
}
```

# BSP层
这里只是对Arduino库进行了封装

## esp32_adc_bsp.h
```c
#ifndef ESP32_ADC_BSP_H
#define ESP32_ADC_BSP_H
// 初始化 ADC 引脚
void bsp_adc_init(int pin);
// 读取 ADC 值
int bsp_adc_read_value();
// 读取 ADC 对应的电压值
float bsp_adc_read_voltage();
#endif    
```
## esp32_adc_bsp.cpp
```c
#include "esp32_adc_bsp.h"
#include "Arduino.h"

static int adc_pin=34;

// 初始化 ADC 引脚
void bsp_adc_init(int pin) {
    adc_pin = pin;
}

// 读取 ADC 值
int bsp_adc_read_value() {
    return analogRead(adc_pin);
}

// 读取 ADC 对应的电压值
float bsp_adc_read_voltage() {
    int adcValue = bsp_adc_read_value();
    return adcValue * (3.3 / 4095.0);
}      
```

## esp32_led_bsp.h
```c
#ifndef ESP32_LED_BSP_H
#define ESP32_LED_BSP_H

// 初始化 LED 引脚
void bsp_led_init(int pin);

// 点亮 LED
void bsp_led_on();

// 熄灭 LED
void bsp_led_off();

// 切换 LED 状态
void bsp_led_toggle();

#endif    
```

## esp32_led_bsp.cpp
```c
#include "esp32_led_bsp.h"
#include "Arduino.h"

static int led_pin;
static bool led_state = false;

// 初始化 LED 引脚
void bsp_led_init(int pin) {
    led_pin = pin;
    pinMode(led_pin, OUTPUT);
    bsp_led_off();
}

// 点亮 LED
void bsp_led_on() {
    digitalWrite(led_pin, HIGH);
    led_state = true;
}

// 熄灭 LED
void bsp_led_off() {
    digitalWrite(led_pin, LOW);
    led_state = false;
}

// 切换 LED 状态
void bsp_led_toggle() {
    digitalWrite(led_pin, !digitalRead(led_pin));
}    
```

# 顶层
将上面的所有代码在 esp32的arduion平台中运行起来,
只截取了部分代码
## PT线程：运行协程和应用
### CThreadPt.h
```c
#ifndef CTHREADPT_H_INC
#define CTHREADPT_H_INC
#include "cxthread.h"
class CThreadPt:public CxThread {
	public:
		void Run(void);
};
#endif
```
### CThreadPt.cpp
```c
#include "CThreadPt.h"
#include "main.h"
#include "Protothread.h"
#include "RtThreadAppManage.h"

//裸机环境用这个
void CThreadPt::Run(void)
{
    Protothread::AllStart();
	while(true) {
        static uint32_t s_ms_tick=0;
        static uint32_t s_ms_s=0;
        long ms= millis();
        if(ms-s_ms_tick>=PT_THREAD_TICK_MS){
            s_ms_tick=ms;
            s_ms_s=1;
        }
        if(s_ms_s){
            Protothread::OnTickAll();
            s_ms_s=0;
        }
    }
}

//RTOS环境用这个
void CThreadPt::Run(void)
{
    TickType_t xLastWakeTime;
    const TickType_t xDelay3ms = pdMS_TO_TICKS( 10 );
    xLastWakeTime = xTaskGetTickCount();
    Protothread::AllStart();
    while(true) {
        //周期调用协程
        Protothread::OnTickAll();
        //周期调用应用
        rt_tick_increase();
        vTaskDelayUntil( &xLastWakeTime, xDelay3ms );
    }
}
```

## 主线程：解析并处理AtShell命令
### CThreadMain.h
```c
#ifndef CLIONARDUINO_MAINTASK_H
#define CLIONARDUINO_MAINTASK_H
#include "cxthread.h"
#include "EventType.h"
using namespace Common;
class CThreadMain:public CxThread {
public:
    CThreadMain();
    void OnRecvRobotEvent(EventType eventType, void* data);
    virtual	void Run(void);
};
#endif
```


### CThreadMain.cpp
```c
#include "main.h"
#include "CThreadMain.h"
#include "AtShell.h"
#include "EventBus.h"
#include "rt_device.h"
#include "CThreadAd.h"
#include "WiFi.h"

static rt_device * s_ad_dev;
static rt_device * s_shell_uart_dev;
extern  CThreadAd *  __ctAd;



CThreadMain::CThreadMain(){
    EventSubscribe(EventType::ROBOT_OUT_ONLINE, this, &CThreadMain::OnRecvRobotEvent);
}


void CThreadMain::OnRecvRobotEvent(EventType eventType, void* data){
    AT_info("hello word \r\n");
    Serial.println(WiFi.localIP());
}

void CThreadMain::Run(void){
    m_runningState = true;
    s_ad_dev=rt_device_find("adc");
    if (!s_ad_dev) {
        AT_error("ADC device not found!\n");
        return;
    }
    s_shell_uart_dev=rt_device_find("at_uart");
    if (!s_shell_uart_dev) {
        AT_error("at_uart device not found!\n");
        return;
    }
    uint32_t lastReadMs=0;
    int available_bytes =0;
    char* atRecvBuffer = g_atShell.GetBuf();
    while(true) {
        uint32_t ms= GetRtxMs();
        rt_device_control(s_shell_uart_dev, RT_DEVICE_CTRL_BYTES_AVAILABLE, &available_bytes);
        if(available_bytes>0) {
            available_bytes= rt_device_read(s_shell_uart_dev, 0,  atRecvBuffer, available_bytes);
            if (available_bytes > 0) {
                at_import((uint8_t *)atRecvBuffer, available_bytes, ms);
            }
        }
        if(ms -lastReadMs>5000){
            lastReadMs=ms;
            float val=0;
            rt_device_read(s_ad_dev,0,&val,sizeof(val));
            EventPublish(EventType::ROBOT_OUT_WEBSOCKET_DATA, &val);
        }
        RtxSleep(20);
    }
}

```
## main启动
### main.h
```c
#pragma once
#include <Arduino.h>
#include "Main_constant.h"
#define  SHELL_SERIAL  Serial
#define  LED  2
#define  KEY   0

```
### main.cpp
```c
#include <App.h>

void setup() {
   App::Init();
   App::Start();
}

void loop() {
    App::Loop();
}
```
### App.h
```c
#ifndef rttPROJECT_APP_H
#define rttPROJECT_APP_H

#include "stdint.h"


class App {
public:
    static  bool Init(void);
    static  void Start(void);
    static  void Loop();
};

#endif
```
### App.cpp
```c
#include "App.h"
#include "main.h"
#include "Arduino.h"
#include "CThreadMain.h"
#include "CThreadPt.h"
#include "CThreadAd.h"
#include "MingWebServer.h"
#include "EventBus.h"
#include "Bsp.h"
#include "HttpUtils.h"
#include "rt_device.h"
#include "rt_thread_app.h"
#include "AtShell.h"

CThreadMain __ctMain;
CThreadPt    __ctPt;
MingWebServer *  __ctWeb;
CThreadAd *  __ctAd;

static int  _defaultServerProcess(WebRequest * req, WebResponse * res){
    printf("%d \n\r",req->intVal("tets"));
    String s= HttpUtils::Get("https://www.baidu.com/");
    res->str(s.c_str());
    return 0;
}


static int test01(int argc, char** argv) {
    AT_printf("argc %d:\r\n", argc);
    int a=0;
    EventPublish(EventType::ROBOT_OUT_ONLINE,&a);
    return 0;
}
static int user_at_write(uint8_t* srcBuf, uint32_t toSendLen,uint32_t timeout) {
    static rt_device_t at_uart_dev=rt_device_find("at_uart");
    int  writeResult = at_uart_dev->write(nullptr,0,srcBuf, toSendLen);
    return writeResult;
}

bool App::Init() {
    bspInit();
    rt_device_register_all();
    rt_thread_app_register_all();
    at_init(user_at_write);
    at_show_version();
    AT_SHELL_EXPORT(test01, "", test01);
    __ctWeb=new MingWebServer(9999,_defaultServerProcess);
    __ctAd=new CThreadAd();
    return true;
}


void App::Loop() {
    RtxSleep(100);
}


void App::Start() {
    __ctMain.Start();
    __ctPt.Start();
    __ctWeb->Start();
    __ctAd->Start();
}

```

