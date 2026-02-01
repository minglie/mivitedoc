# linux PC机上  本地编译  或 交叉编译
## 工程目录
```bash
wpf@minglie:my_make_test$ tree
├── build
│   ├── my_program
│   └── obj
│       └── src
│           ├── add.o
│           └── main.o
├── Makefile
└── src
    ├── add.cpp
    ├── add.h
    └── main.c
```
## 本地编译  Makefile
```bash
# 编译器选择，这里假设用gcc/g++，可按需修改
CC = gcc
CXX = g++
# 编译选项，可按需调整优化等级、警告设置等
CFLAGS = -Wall -Wextra -g -Isrc/include
CXXFLAGS = -Wall -Wextra -g -std=c++11
# 链接选项
LDFLAGS = 

# 目标可执行文件名
TARGET = my_program
# 输出可执行文件的目录
BUILD_DIR = build
# 输出目标文件的目录
OBJ_DIR = $(BUILD_DIR)/obj

# 多个源码目录
SRC_DIRS := src

# 获取所有源文件列表
SRCS := $(foreach dir,$(SRC_DIRS),$(wildcard $(dir)/*.c))
CXX_SRCS := $(foreach dir,$(SRC_DIRS),$(wildcard $(dir)/*.cpp))

# 根据源文件生成对应的目标文件列表
OBJS := $(patsubst %.c,$(OBJ_DIR)/%.o,$(SRCS))
CXX_OBJS := $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(CXX_SRCS))

# 默认目标，通常是生成可执行文件
all: $(BUILD_DIR)/$(TARGET)

# 提前创建必要目录
$(BUILD_DIR) $(OBJ_DIR):
	mkdir -p $@

# 链接生成可执行文件规则
$(BUILD_DIR)/$(TARGET): $(OBJS) $(CXX_OBJS)
	$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

# C源文件编译规则
$(OBJ_DIR)/%.o: %.c
	@mkdir -p $(@D)
	$(CC) $(CFLAGS) -c $< -o $@

# C++源文件编译规则
$(OBJ_DIR)/%.o: %.cpp
	@mkdir -p $(@D)
	$(CXX) $(CXXFLAGS) -c $< -o $@

# 清理中间文件和目标文件
clean:
	rm -f $(OBJS) $(CXX_OBJS)
	rm -rf $(BUILD_DIR)

# 运行目标
run: $(BUILD_DIR)/$(TARGET)
	@$(BUILD_DIR)/$(TARGET)
```

## 交叉编译 Makefile
拷贝到目标板
```
sudo  scp   build/my_program  root@192.168.1.54:~/build/
```
```bash
# Petalinux交叉编译配置
# 编译器路径（请根据实际安装路径修改）
PETA_PATH := /opt/petalinux/2020.2
PETA_SYSROOT_X86 := $(PETA_PATH)/sysroots/x86_64-petalinux-linux
PETA_SYSROOT_ARM := $(PETA_PATH)/sysroots/cortexa9t2hf-neon-xilinx-linux-gnueabi

# 交叉编译器
CC = $(PETA_SYSROOT_X86)/usr/bin/arm-xilinx-linux-gnueabi/arm-xilinx-linux-gnueabi-gcc
CXX = $(PETA_SYSROOT_X86)/usr/bin/arm-xilinx-linux-gnueabi/arm-xilinx-linux-gnueabi-g++

# 编译选项
CFLAGS = -Wall -g -Isrc/include \
         -mthumb -mfpu=neon -mfloat-abi=hard -mcpu=cortex-a9 \
         --sysroot=$(PETA_SYSROOT_ARM)

CXXFLAGS = $(CFLAGS) -std=c++11

# 链接选项
LDFLAGS = --sysroot=$(PETA_SYSROOT_ARM)

# 目标文件和目录
TARGET = my_program
BUILD_DIR = build
OBJ_DIR = $(BUILD_DIR)/obj

# 源码文件（手动指定或简单匹配）
SRCS := $(wildcard src/*.c src/*/*.c)
CXX_SRCS := $(wildcard src/*.cpp src/*/*.cpp)

# 生成目标文件列表
OBJS := $(patsubst %.c,$(OBJ_DIR)/%.o,$(SRCS))
CXX_OBJS := $(patsubst %.cpp,$(OBJ_DIR)/%.o,$(CXX_SRCS))

# 默认目标
all: $(BUILD_DIR)/$(TARGET)

# 创建目录
$(BUILD_DIR) $(OBJ_DIR):
	mkdir -p $@

# 链接
$(BUILD_DIR)/$(TARGET): $(OBJS) $(CXX_OBJS) | $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $^ -o $@ $(LDFLAGS)

# 编译C文件
$(OBJ_DIR)/%.o: %.c | $(OBJ_DIR)
	mkdir -p $(dir $@)
	$(CC) $(CFLAGS) -c $< -o $@

# 编译C++文件
$(OBJ_DIR)/%.o: %.cpp | $(OBJ_DIR)
	mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) -c $< -o $@

# 清理
clean:
	rm -rf $(BUILD_DIR)

# 安装
install: $(BUILD_DIR)/$(TARGET)
	mkdir -p $(PETA_SYSROOT_ARM)/usr/bin
	cp $(BUILD_DIR)/$(TARGET) $(PETA_SYSROOT_ARM)/usr/bin/

.PHONY: all clean install
```
## main.c
```c
#include <stdio.h>
#include  "add.h"

int main() {
    printf("1+1=%d\n",add(1,1));
    return 0;
}

```

## add.cpp
```c
#include "add.h"
// 加法函数实现
int add(int a, int b) {
    return a + b;
}
```

## add.h
```c
#ifndef ADD_H
#define ADD_H

// 条件编译：如果是C++编译器，用extern "C"包裹函数声明
#ifdef __cplusplus
extern "C" {
#endif


int add(int a, int b);


#ifdef __cplusplus
}
#endif

#endif // ADD_H
    
```

# linux 交叉编译zynq linux 驱动
## Makefile 
```bash
KERN_DIR :=/home/wpf/workspace/kernel-driver/linux-xlnx-xlnx_rebase_v5.4_2020.2

obj-m :=pl_irq_notify.o

all:
	make -C $(KERN_DIR) M=`pwd` modules
clean:
	make -C $(KERN_DIR) M=`pwd` clean

```
## pl_irq_notify.c 
```c
// pl_irq_notify.c 
//insmod pl_irq_notify.ko irq_debug=0
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

static int irq_debug = 1;
module_param(irq_debug, int, 0644);
MODULE_PARM_DESC(irq_debug, "Enable IRQ debugging (0=disable, 1=enable)");


static DECLARE_WAIT_QUEUE_HEAD(wq_irq);
static int irq_flag = 0;

static irqreturn_t pl_irq_handler_0(int irq, void *dev_id)
{
    irq_flag = 1;
    wake_up_interruptible(&wq_irq);
    if(irq_debug){
        pr_info("[PL_IRQ] IRQ 1 triggered\n");
    }
    return IRQ_HANDLED;
}

static irqreturn_t pl_irq_handler_1(int irq, void *dev_id)
{
    irq_flag = 2;
    wake_up_interruptible(&wq_irq);
    if(irq_debug){
        pr_info("[PL_IRQ] IRQ 2 triggered\n");
    }
    return IRQ_HANDLED;
}

static ssize_t pl_irq_read(struct file *file, char __user *buf, size_t len, loff_t *ppos)
{
    wait_event_interruptible(wq_irq, irq_flag != 0);
    
    int val = irq_flag;
    irq_flag = 0;
    
    if (len < sizeof(int)) return -EINVAL;
    if (copy_to_user(buf, &val, sizeof(int))) return -EFAULT;
    return sizeof(int);
}

static __poll_t pl_irq_poll(struct file *file, poll_table *wait)
{
    poll_wait(file, &wq_irq, wait);
    if (irq_flag) return POLLIN | POLLRDNORM;
    return 0;
}

static const struct file_operations irq_fops = {
        .owner = THIS_MODULE,
        .read  = pl_irq_read,
        .poll  = pl_irq_poll,
};

static struct miscdevice irq_miscdev = {
        .minor = MISC_DYNAMIC_MINOR,
        .name  = "pl_irq_notify",
        .fops  = &irq_fops,
        .mode  = 0666,
};

static int pl_irq_probe(struct platform_device *pdev)
{
    int irq0 = platform_get_irq(pdev, 0);
    int irq1 = platform_get_irq(pdev, 1);
    int ret;

    if (irq0 < 0 || irq1 < 0) {
        dev_err(&pdev->dev, "Failed to get IRQs\n");
        return -EINVAL;
    }

    dev_info(&pdev->dev, "Requesting IRQs %d and %d\n", irq0, irq1);

    ret = devm_request_irq(&pdev->dev, irq0, pl_irq_handler_0, 0, "pl_irq0", NULL);
    if (ret) return ret;

    ret = devm_request_irq(&pdev->dev, irq1, pl_irq_handler_1, 0, "pl_irq1", NULL);
    if (ret) return ret;

    return misc_register(&irq_miscdev);
}

static int pl_irq_remove(struct platform_device *pdev)
{
    misc_deregister(&irq_miscdev);
    return 0;
}

static const struct of_device_id pl_irq_of_match[] = {
        { .compatible = "xlnx,pl-irqs" },
        {}
};
MODULE_DEVICE_TABLE(of, pl_irq_of_match);

static struct platform_driver pl_irq_driver = {
        .driver = {
                .name = "pl_irq_notify",
                .of_match_table = pl_irq_of_match,
        },
        .probe = pl_irq_probe,
        .remove = pl_irq_remove,
};

module_platform_driver(pl_irq_driver);

MODULE_LICENSE("GPL");
MODULE_AUTHOR("MingLie");
MODULE_DESCRIPTION("PL IRQ notify driver with user space interface (dual IRQ)");
```


# windows 编译stm32
## Makefile
```bash
##########################################################################################################################
# Supports C and C++ sources
# ------------------------------------------------

######################################
# target
######################################
TARGET = Nucleo-C031C6-FreeRTOS

######################################
# building variables
######################################
DEBUG = 1
OPT = -Og

######################################
# paths
######################################
BUILD_DIR = build
all: $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).hex
######################################
# sources
######################################
# C sources
C_SOURCES =  \
Core/Src/syscalls.c \
Core/Src/app_freertos.c \
Core/Src/stm32c0xx_it.c \
Core/Src/stm32c0xx_hal_msp.c \
Core/Src/stm32c0xx_hal_timebase_tim.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_usart_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_uart_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_tim.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_tim_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_cortex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_rcc.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_rcc_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_flash.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_flash_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_gpio.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_dma.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_dma_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_pwr.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_pwr_ex.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_exti.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_usart.c \
Drivers/STM32C0xx_HAL_Driver/Src/stm32c0xx_hal_uart.c \
Core/Src/system_stm32c0xx.c \
Middlewares/Third_Party/FreeRTOS/Source/croutine.c \
Middlewares/Third_Party/FreeRTOS/Source/event_groups.c \
Middlewares/Third_Party/FreeRTOS/Source/list.c \
Middlewares/Third_Party/FreeRTOS/Source/queue.c \
Middlewares/Third_Party/FreeRTOS/Source/stream_buffer.c \
Middlewares/Third_Party/FreeRTOS/Source/tasks.c \
Middlewares/Third_Party/FreeRTOS/Source/timers.c \
Middlewares/Third_Party/FreeRTOS/Source/CMSIS_RTOS_V2/cmsis_os2.c \
Middlewares/Third_Party/FreeRTOS/Source/portable/GCC/ARM_CM0/port.c \
Middlewares/Third_Party/FreeRTOS/Source/portable/MemMang/heap_4.c \
Drivers/BSP/STM32C0xx_Nucleo/stm32c0xx_nucleo.c

# C++ sources
CPP_SOURCES = \
Core/Src/main.cpp \
Core/Src/test.cpp  # 添加你的 C++ 文件

# ASM sources
ASM_SOURCES = startup_stm32c031xx.s
ASMM_SOURCES =

######################################
# binaries
######################################
PREFIX = arm-none-eabi-
ifdef GCC_PATH
CC = $(GCC_PATH)/$(PREFIX)gcc
CXX = $(GCC_PATH)/$(PREFIX)g++
AS = $(GCC_PATH)/$(PREFIX)gcc -x assembler-with-cpp
CP = $(GCC_PATH)/$(PREFIX)objcopy
SZ = $(GCC_PATH)/$(PREFIX)size
else
CC = $(PREFIX)gcc
CXX = $(PREFIX)g++
AS = $(PREFIX)gcc -x assembler-with-cpp
CP = $(PREFIX)objcopy
SZ = $(PREFIX)size
endif
HEX = $(CP) -O ihex
BIN = $(CP) -O binary -S

######################################
# MCU & flags
######################################
CPU = -mcpu=cortex-m0
MCU = $(CPU) -mthumb

# defines
C_DEFS = -DUSE_NUCLEO_64 -DUSE_HAL_DRIVER -DSTM32C031xx
AS_DEFS =

# includes
C_INCLUDES = \
-ICore/Inc \
-IDrivers/STM32C0xx_HAL_Driver/Inc \
-IDrivers/STM32C0xx_HAL_Driver/Inc/Legacy \
-IDrivers/BSP/STM32C0xx_Nucleo \
-IDrivers/CMSIS/Device/ST/STM32C0xx/Include \
-IDrivers/CMSIS/Include \
-IMiddlewares/Third_Party/FreeRTOS/Source/include/ \
-IMiddlewares/Third_Party/FreeRTOS/Source/CMSIS_RTOS_V2/ \
-IMiddlewares/Third_Party/CMSIS/RTOS2/Include/ \
-IMiddlewares/Third_Party/FreeRTOS/Source/portable/GCC/ARM_CM0/
AS_INCLUDES = -ICore/Inc

# C flags
CFLAGS = $(MCU) $(C_DEFS) $(C_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections
ifeq ($(DEBUG),1)
CFLAGS += -g -gdwarf-2
endif
CFLAGS += -MMD -MP -MF"$(@:%.o=%.d)"

# C++ flags
CXXFLAGS = $(MCU) $(C_DEFS) $(C_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections -fno-exceptions -fno-rtti
ifeq ($(DEBUG),1)
CXXFLAGS += -g -gdwarf-2
endif
CXXFLAGS += -MMD -MP -MF"$(@:%.o=%.d)"

# ASM flags
ASFLAGS = $(MCU) $(AS_DEFS) $(AS_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections

######################################
# linker
######################################
LDSCRIPT = STM32C031C6Tx_FLASH.ld
LIBS = -lc -lm -lnosys -lstdc++
LIBDIR =
LDFLAGS = $(MCU) -specs=nano.specs -T$(LDSCRIPT) $(LIBDIR) $(LIBS) -Wl,-Map=$(BUILD_DIR)/$(TARGET).map,--cref -Wl,--gc-sections

######################################
# build
######################################
OBJECTS = $(addprefix $(BUILD_DIR)/,$(notdir $(C_SOURCES:.c=.o)))
OBJECTS += $(addprefix $(BUILD_DIR)/,$(notdir $(CPP_SOURCES:.cpp=.o)))
OBJECTS += $(addprefix $(BUILD_DIR)/,$(notdir $(ASM_SOURCES:.s=.o)))
OBJECTS += $(addprefix $(BUILD_DIR)/,$(notdir $(ASMM_SOURCES:.S=.o)))

vpath %.c $(sort $(dir $(C_SOURCES)))
vpath %.cpp $(sort $(dir $(CPP_SOURCES)))
vpath %.s $(sort $(dir $(ASM_SOURCES)))
vpath %.S $(sort $(dir $(ASMM_SOURCES)))

$(BUILD_DIR)/%.o: %.c Makefile | $(BUILD_DIR)
	$(CC) -c $(CFLAGS) -Wa,-a,-ad,-alms=$(BUILD_DIR)/$(notdir $(<:.c=.lst)) $< -o $@

$(BUILD_DIR)/%.o: %.cpp Makefile | $(BUILD_DIR)
	$(CXX) -c $(CXXFLAGS) -Wa,-a,-ad,-alms=$(BUILD_DIR)/$(notdir $(<:.cpp=.lst)) $< -o $@

$(BUILD_DIR)/%.o: %.s Makefile | $(BUILD_DIR)
	$(AS) -c $(ASFLAGS) $< -o $@

$(BUILD_DIR)/%.o: %.S Makefile | $(BUILD_DIR)
	$(AS) -c $(ASFLAGS) $< -o $@

$(BUILD_DIR)/$(TARGET).elf: $(OBJECTS) Makefile
	$(CXX) $(OBJECTS) $(LDFLAGS) -o $@
	$(SZ) $@

$(BUILD_DIR)/%.hex: $(BUILD_DIR)/%.elf | $(BUILD_DIR)
	$(HEX) $< $@

$(BUILD_DIR)/%.bin: $(BUILD_DIR)/%.elf | $(BUILD_DIR)
	$(BIN) $< $@

$(BUILD_DIR):
	mkdir $@

######################################
# clean
######################################
clean:
ifeq ($(OS),Windows_NT)
	rd /S /Q $(subst /,\,$(BUILD_DIR))
else
	rm -rf $(BUILD_DIR)
endif

######################################
# dependencies
######################################
-include $(wildcard $(BUILD_DIR)/*.d)

# *** EOF ***

```


# emcc编译浏览器
## Makefile
```shell
# 编译器设置
CC = emcc

# 编译选项 - 添加精简选项和ES6模块支持
CFLAGS = -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1

# 生成目录
BUILD_DIR = .

# 头文件目录 - 集中管理所有头文件目录
INCLUDE_DIRS = -I./src

# 源文件 - 集中管理所有C++文件
CPP_SOURCES = \
    src/main.cpp \
    src/add.cpp \
    src/test.cpp 

# 目标文件
TARGET = $(BUILD_DIR)/ming_wasm
HTML_FILE = $(BUILD_DIR)/ming_wasm.html

# 生成目标
all: $(TARGET) $(HTML_FILE)

# 统一编译所有C++源文件生成JS/WASM
$(TARGET): $(CPP_SOURCES)
	$(CC) $(CFLAGS) $(INCLUDE_DIRS) -o $(TARGET).js $(CPP_SOURCES) -s EXPORTED_FUNCTIONS='["_myfib", "_main", "_add", "_test_function"]' -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' -s SINGLE_FILE=0

# 生成HTML文件，包含完整的WebAssembly运行环境
$(HTML_FILE): $(CPP_SOURCES)
	$(CC) -O3 -s WASM=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s ENVIRONMENT=web -s FILESYSTEM=0 -s NO_EXIT_RUNTIME=1 -s DETERMINISTIC=1 $(INCLUDE_DIRS) -o $(HTML_FILE) $(CPP_SOURCES) -s EXPORTED_FUNCTIONS='["_myfib", "_main", "_add", "_test_function"]' -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' -s SINGLE_FILE=0 -s NO_EXIT_RUNTIME=1

# 清理目标
clean:
	-rm -f $(BUILD_DIR)/*.js $(BUILD_DIR)/*.wasm $(HTML_FILE)

# 声明伪目标
.PHONY: all clean
```
## wasm测试
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <script type="module" >

    // ES6模块导入测试
import MingWasmModule from './ming_wasm.js';

// 使用异步函数处理WebAssembly初始化
async function testES6Import() {
  try {
    console.log('开始测试ES6模块导入');
    
    // 等待Module ready Promise完成
    const Module = await MingWasmModule();
     console.log('WebAssembly模块加载成功');
    
    // 测试暴露的函数
    console.log('测试加法函数: 5 + 3 =', Module._add(5, 3));
    console.log('测试斐波那契函数: fib(10) =', Module._myfib(10));
    console.log('测试test_function函数:', Module._test_function());
    console.log('测试main函数:', Module._main());
    
    console.log('ES6模块导入测试成功！');
  } catch (error) {
    console.error('ES6模块导入测试失败:', error);
  }
}

// 执行测试
testES6Import();


    </script>
</body>
</html>

```