# 参考
[rp2040-freertos-project](https://github.com/LearnEmbeddedSystems/rp2040-freertos-project/tree/master/freertos)

# 目录结构
```bash
PS D:\workspace\gitee\2\rp2040-freertos-project> tree /F
卷 新加卷 的文件夹 PATH 列表
卷序列号为 64EF-5EB7
D:.
│  .gitignore
│  CMakeLists.txt
│  copy_uf2.bat
│  pico_sdk_import.cmake
│
├─freertos
│  │  CMakeLists.txt
│  │  FreeRTOSConfig.h
│  │
│  └─FreeRTOS-Kernel
│      │  .git-blame-ignore-revs
│      │  .gitattributes
│      │  .gitmodules
│      │  CMakeLists.txt
│      │  croutine.c
│      │  cspell.config.yaml
│      │  event_groups.c
│      │  History.txt
│      │  LICENSE.md
│      │  list.c
│      │  manifest.yml
│      │  MISRA.md
│      │  queue.c
│      │  README.md
│      │  stream_buffer.c
│      │  tasks.c
│      │  timers.c
│      │
│      ├─include
│      │      atomic.h
│      │      CMakeLists.txt
│      │      croutine.h
│      │      deprecated_definitions.h
│      │      event_groups.h
│      │      FreeRTOS.h
│      │      list.h
│      │      message_buffer.h
│      │      mpu_prototypes.h
│      │      mpu_syscall_numbers.h
│      │      mpu_wrappers.h
│      │      newlib-freertos.h
│      │      picolibc-freertos.h
│      │      portable.h
│      │      projdefs.h
│      │      queue.h
│      │      semphr.h
│      │      StackMacros.h
│      │      stack_macros.h
│      │      stdint.readme
│      │      stream_buffer.h
│      │      task.h
│      │      timers.h
│      │
│      └─portable
│          │  CMakeLists.txt
│          │  readme.txt
│          │
│          ├─GCC
│          │  └─ARM_CM0
│          │          mpu_wrappers_v2_asm.c
│          │          port.c
│          │          portasm.c
│          │          portasm.h
│          │          portmacro.h
│          │
│          ├─MemMang
│          │      heap_1.c
│          │      heap_2.c
│          │      heap_3.c
│          │      heap_4.c
│          │      heap_5.c
│          │      ReadMe.url
│          │
│          └─ThirdParty
│              └─GCC
│                  └─RP2040
│                      │  .gitignore
│                      │  CMakeLists.txt
│                      │  FreeRTOS_Kernel_import.cmake
│                      │  library.cmake
│                      │  LICENSE.md
│                      │  pico_sdk_import.cmake
│                      │  port.c
│                      │  README.md
│                      │
│                      └─include
│                              freertos_sdk_config.h
│                              portmacro.h
│                              rp2040_config.h
│
└─ProjectFiles
    CMakeLists.txt
    main.cpp

```
# CMakeLists.txt
```bash
cmake_minimum_required(VERSION 3.12)

include(pico_sdk_import.cmake)

project(Pico-FreeRTOS)

pico_sdk_init()

add_subdirectory(freertos)
add_subdirectory(ProjectFiles)

```

# pico_sdk_import.cmake
```bash
set(PICO_SDK_PATH "D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/pico-sdk")
if (DEFINED ENV{PICO_SDK_PATH} AND (NOT PICO_SDK_PATH))
    set(PICO_SDK_PATH $ENV{PICO_SDK_PATH})
    message("Using PICO_SDK_PATH from environment ('${PICO_SDK_PATH}')")
endif ()

if (DEFINED ENV{PICO_SDK_FETCH_FROM_GIT} AND (NOT PICO_SDK_FETCH_FROM_GIT))
    set(PICO_SDK_FETCH_FROM_GIT $ENV{PICO_SDK_FETCH_FROM_GIT})
    message("Using PICO_SDK_FETCH_FROM_GIT from environment ('${PICO_SDK_FETCH_FROM_GIT}')")
endif ()

if (DEFINED ENV{PICO_SDK_FETCH_FROM_GIT_PATH} AND (NOT PICO_SDK_FETCH_FROM_GIT_PATH))
    set(PICO_SDK_FETCH_FROM_GIT_PATH $ENV{PICO_SDK_FETCH_FROM_GIT_PATH})
    message("Using PICO_SDK_FETCH_FROM_GIT_PATH from environment ('${PICO_SDK_FETCH_FROM_GIT_PATH}')")
endif ()

set(PICO_SDK_PATH "${PICO_SDK_PATH}" CACHE PATH "Path to the PICO SDK")
set(PICO_SDK_FETCH_FROM_GIT "${PICO_SDK_FETCH_FROM_GIT}" CACHE BOOL "Set to ON to fetch copy of PICO SDK from git if not otherwise locatable")
set(PICO_SDK_FETCH_FROM_GIT_PATH "${PICO_SDK_FETCH_FROM_GIT_PATH}" CACHE FILEPATH "location to download SDK")

if (NOT PICO_SDK_PATH)
    if (PICO_SDK_FETCH_FROM_GIT)
        include(FetchContent)
        set(FETCHCONTENT_BASE_DIR_SAVE ${FETCHCONTENT_BASE_DIR})
        if (PICO_SDK_FETCH_FROM_GIT_PATH)
            get_filename_component(FETCHCONTENT_BASE_DIR "${PICO_SDK_FETCH_FROM_GIT_PATH}" REALPATH BASE_DIR "${CMAKE_SOURCE_DIR}")
        endif ()
        FetchContent_Declare(
                pico_sdk
                GIT_REPOSITORY https://github.com/raspberrypi/pico-sdk
                GIT_TAG master
        )
        if (NOT pico_sdk)
            message("Downloading PICO SDK")
            FetchContent_Populate(pico_sdk)
            set(PICO_SDK_PATH ${pico_sdk_SOURCE_DIR})
        endif ()
        set(FETCHCONTENT_BASE_DIR ${FETCHCONTENT_BASE_DIR_SAVE})
    else ()
        message(FATAL_ERROR
                "PICO SDK location was not specified. Please set PICO_SDK_PATH or set PICO_SDK_FETCH_FROM_GIT to on to fetch from git."
                )
    endif ()
endif ()

get_filename_component(PICO_SDK_PATH "${PICO_SDK_PATH}" REALPATH BASE_DIR "${CMAKE_BINARY_DIR}")
if (NOT EXISTS ${PICO_SDK_PATH})
    message(FATAL_ERROR "Directory '${PICO_SDK_PATH}' not found")
endif ()

set(PICO_SDK_INIT_CMAKE_FILE ${PICO_SDK_PATH}/pico_sdk_init.cmake)
if (NOT EXISTS ${PICO_SDK_INIT_CMAKE_FILE})
    message(FATAL_ERROR "Directory '${PICO_SDK_PATH}' does not appear to contain the PICO SDK")
endif ()

set(PICO_SDK_PATH ${PICO_SDK_PATH} CACHE PATH "Path to the PICO SDK" FORCE)

include(${PICO_SDK_INIT_CMAKE_FILE})

```

# copy_uf2.bat
```bash
@echo off
set "src=D:\workspace\gitee\2\rp2040-freertos-project\cmake-build-debug\ProjectFiles\blink.uf2"
set "dst=F:"

if not exist "%src%" (
    echo Error: UF2 file not found!
    pause
    exit 1
)
if not exist "%dst%" (
    echo Error: USB drive %dst% not found!
    pause
    exit 1
)

copy /Y "%src%" %dst%
if %errorlevel% equ 0 (
    echo Success! Pico is rebooting...
) else (
    echo Failed! Reconnect Pico and try again.
)
pause
```
# .gitignore
```bash
build
.idea
cmake-build-debug
```

# ProjectFiles/CMakeLists.txt
```bash
add_executable(blink
        main.cpp
)

target_link_libraries(blink
        pico_stdlib
        freertos
)
pico_add_extra_outputs(blink)

```
# ProjectFiles/main.cpp
```c
#include <FreeRTOS.h>
#include <task.h>
#include <stdio.h>
#include "pico/stdlib.h"

void led_task(void *pvParameters)
{
    const uint LED_PIN = PICO_DEFAULT_LED_PIN;
    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);

    while (true) {
        gpio_put(LED_PIN, 1);
        vTaskDelay(pdMS_TO_TICKS(1000));
        gpio_put(LED_PIN, 0);
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    // 理论上不会走到这里
    vTaskDelete(NULL);
}

int main()
{
    stdio_init_all();

    xTaskCreate(
            led_task,          // 任务函数
            "LED_Task",        // 名字
            256,               // 栈大小（words，不是 bytes）
            NULL,              // 参数
            1,                 // 优先级
            NULL               // 任务句柄
    );

    vTaskStartScheduler();

    while (1) {
        tight_loop_contents();
    }
}

```
# freertos/CMakeLists.txt
```bash
set(PICO_SDK_FREERTOS_SOURCE FreeRTOS-Kernel)

add_library(freertos
    ${PICO_SDK_FREERTOS_SOURCE}/event_groups.c
    ${PICO_SDK_FREERTOS_SOURCE}/list.c
    ${PICO_SDK_FREERTOS_SOURCE}/queue.c
    ${PICO_SDK_FREERTOS_SOURCE}/stream_buffer.c
    ${PICO_SDK_FREERTOS_SOURCE}/tasks.c
    ${PICO_SDK_FREERTOS_SOURCE}/timers.c
    ${PICO_SDK_FREERTOS_SOURCE}/portable/MemMang/heap_3.c
    ${PICO_SDK_FREERTOS_SOURCE}/portable/ThirdParty/GCC/RP2040/port.c
)

target_include_directories(freertos PUBLIC
    .
    ${PICO_SDK_FREERTOS_SOURCE}/include
    ${PICO_SDK_FREERTOS_SOURCE}/portable/ThirdParty/GCC/RP2040/include
)

target_link_libraries(freertos
        PUBLIC
        pico_stdlib
        hardware_irq
        hardware_timer
        hardware_sync
        hardware_clocks
        hardware_exception
        pico_multicore
)

```
# freertos/FreeRTOSConfig.h
```c

#ifndef FREERTOS_CONFIG_EXAMPLES_COMMON_H
#define FREERTOS_CONFIG_EXAMPLES_COMMON_H


/* Scheduler Related */
#define configUSE_PREEMPTION                    1
#define configUSE_TICKLESS_IDLE                 0
#define configUSE_IDLE_HOOK                     0
#define configUSE_TICK_HOOK                     0
#define configTICK_RATE_HZ                      ( ( TickType_t ) 1000 )
#define configMAX_PRIORITIES                    32
#define configMINIMAL_STACK_SIZE                ( configSTACK_DEPTH_TYPE ) 512
#define configUSE_16_BIT_TICKS                  0

#define configIDLE_SHOULD_YIELD                 1

/* Synchronization Related */
#define configUSE_MUTEXES                       1
#define configUSE_RECURSIVE_MUTEXES             1
#define configUSE_APPLICATION_TASK_TAG          0
#define configUSE_COUNTING_SEMAPHORES           1
#define configQUEUE_REGISTRY_SIZE               8
#define configUSE_QUEUE_SETS                    1
#define configUSE_TIME_SLICING                  1
#define configUSE_NEWLIB_REENTRANT              0
// todo need this for lwip FreeRTOS sys_arch to compile
#define configENABLE_BACKWARD_COMPATIBILITY     1
#define configNUM_THREAD_LOCAL_STORAGE_POINTERS 5

/* System */
#define configSTACK_DEPTH_TYPE                  uint32_t
#define configMESSAGE_BUFFER_LENGTH_TYPE        size_t

/* Memory allocation related definitions. */
#ifndef configSUPPORT_STATIC_ALLOCATION
#define configSUPPORT_STATIC_ALLOCATION         0
#endif
#ifndef configSUPPORT_DYNAMIC_ALLOCATION
#define configSUPPORT_DYNAMIC_ALLOCATION        1
#endif
#define configTOTAL_HEAP_SIZE                   (128*1024)
#define configAPPLICATION_ALLOCATED_HEAP        0

/* Hook function related definitions. */
#define configCHECK_FOR_STACK_OVERFLOW          0
#define configUSE_MALLOC_FAILED_HOOK            0
#define configUSE_DAEMON_TASK_STARTUP_HOOK      0

/* Run time and task stats gathering related definitions. */
#define configGENERATE_RUN_TIME_STATS           0
#define configUSE_TRACE_FACILITY                1
#define configUSE_STATS_FORMATTING_FUNCTIONS    0

/* Co-routine related definitions. */
#define configUSE_CO_ROUTINES                   0
#define configMAX_CO_ROUTINE_PRIORITIES         1

/* Software timer related definitions. */
#define configUSE_TIMERS                        1
#define configTIMER_TASK_PRIORITY               ( configMAX_PRIORITIES - 1 )
#define configTIMER_QUEUE_LENGTH                10
#define configTIMER_TASK_STACK_DEPTH            1024

/* Interrupt nesting behaviour configuration. */
/*
#define configKERNEL_INTERRUPT_PRIORITY         [dependent of processor]
#define configMAX_SYSCALL_INTERRUPT_PRIORITY    [dependent on processor and application]
#define configMAX_API_CALL_INTERRUPT_PRIORITY   [dependent on processor and application]
*/

#if FREE_RTOS_KERNEL_SMP // set by the RP2xxx SMP port of FreeRTOS
/* SMP port only */
#ifndef configNUMBER_OF_CORES
#define configNUMBER_OF_CORES                   2
#endif
#define configNUM_CORES                         configNUMBER_OF_CORES
#define configTICK_CORE                         0
#define configRUN_MULTIPLE_PRIORITIES           1
#if configNUMBER_OF_CORES > 1
#define configUSE_CORE_AFFINITY                 1
#endif
#define configUSE_PASSIVE_IDLE_HOOK             0
#endif

/* RP2040 specific */
#define configSUPPORT_PICO_SYNC_INTEROP         1
#define configSUPPORT_PICO_TIME_INTEROP         1

#include <assert.h>
/* Define to trap errors during development. */
#define configASSERT(x)                         assert(x)

/* Set the following definitions to 1 to include the API function, or zero
to exclude the API function. */
#define INCLUDE_vTaskPrioritySet                1
#define INCLUDE_uxTaskPriorityGet               1
#define INCLUDE_vTaskDelete                     1
#define INCLUDE_vTaskSuspend                    1
#define INCLUDE_vTaskDelayUntil                 1
#define INCLUDE_vTaskDelay                      1
#define INCLUDE_xTaskGetSchedulerState          1
#define INCLUDE_xTaskGetCurrentTaskHandle       1
#define INCLUDE_uxTaskGetStackHighWaterMark     1
#define INCLUDE_xTaskGetIdleTaskHandle          1
#define INCLUDE_eTaskGetState                   1
#define INCLUDE_xTimerPendFunctionCall          1
#define INCLUDE_xTaskAbortDelay                 1
#define INCLUDE_xTaskGetHandle                  1
#define INCLUDE_xTaskResumeFromISR              1
#define INCLUDE_xQueueGetMutexHolder            1

#if PICO_RP2350
#define configENABLE_MPU                        0
#define configENABLE_TRUSTZONE                  0
#define configRUN_FREERTOS_SECURE_ONLY          1
#define configENABLE_FPU                        1
#define configMAX_SYSCALL_INTERRUPT_PRIORITY    16
#endif

/* A header file that defines trace macro can be included here. */

#endif /* FREERTOS_CONFIG_H */


```

# FreeRTOS-Kernel
```bash
[submodule "freertos/FreeRTOS-Kernel"]
	path = freertos/FreeRTOS-Kernel
	url = https://github.com/FreeRTOS/FreeRTOS-Kernel
# 执行并删减没有的文件
cd freertos
git clone https://github.com/FreeRTOS/FreeRTOS-Kernel.git

```