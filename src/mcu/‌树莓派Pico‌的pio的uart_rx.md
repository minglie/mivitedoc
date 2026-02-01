[pico-sdk-api文档](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pio)

[rp2040-datasheet.pdf](https://pip-assets.raspberrypi.com/categories/814-rp2040/documents/RP-008371-DS-1-rp2040-datasheet.pdf?disposition=inline)

[getting-started-with-pico.pdf](https://pip-assets.raspberrypi.com/categories/610-raspberry-pi-pico/documents/RP-008276-DS-1-getting-started-with-pico.pdf?disposition=inline)

[树莓派 Pico 之可编程 IO（PIO）](https://pico.nxez.com/2023/11/06/programmable-io-on-raspberry-pi-pico.html)
# CMakeLists.txt
```bash
cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(pio_squarewave C CXX ASM)
pico_sdk_init()

add_executable(pio_squarewave
        main.c
        uart_rx.pio
)

pico_generate_pio_header(pio_squarewave ${CMAKE_CURRENT_LIST_DIR}/uart_rx.pio)

target_link_libraries(pio_squarewave  pico_multicore pico_async_context_threadsafe_background   pico_stdlib hardware_pio)

pico_add_extra_outputs(pio_squarewave)


```
# uart_rx.pio
```c
;
; 版权所有 (c) 2020 Raspberry Pi (Trading) Ltd.
;
; SPDX-License-Identifier: BSD-3-Clause
;

.program uart_rx_mini

; 最简化 8n1 UART 接收器：等待起始位，然后按正确时序采样 8 位。
; IN 引脚 0 映射到 UART RX 使用的 GPIO。
; 必须启用自动推送（autopush），阈值为 8。

    wait 0 pin 0        ; 等待起始位
    set x, 7 [10]       ; 预装位计数器，并延迟到达第一个数据位的中心
bitloop:                ; 循环采样 8 次
    in pins, 1          ; 采样 1 位数据
    jmp x-- bitloop [6] ; 每次循环共 8 个周期

% c-sdk {
#include "hardware/clocks.h"
#include "hardware/gpio.h"

static inline void uart_rx_mini_program_init(PIO pio, uint sm, uint offset, uint pin, uint baud) {
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, false);
    pio_gpio_init(pio, pin);
    gpio_pull_up(pin);

    pio_sm_config c = uart_rx_mini_program_get_default_config(offset);
    sm_config_set_in_pins(&c, pin); // 配置用于 WAIT 和 IN 的输入引脚
    sm_config_set_in_shift(&c, true, true, 8); // 向右移位，启用自动推送，8 位阈值
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_RX); // 仅使用 RX FIFO
    float div = (float)clock_get_hz(clk_sys) / (8 * baud); // 每 8 个周期采样 1 位
    sm_config_set_clkdiv(&c, div);

    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
}
%}

.program uart_rx

; 功能更完整的 8n1 UART 接收器，可更好处理帧错误与 BREAK 情况。
; IN 引脚 0 和 JMP 引脚均映射到 UART RX。

start:
    wait 0 pin 0        ; 等待起始位
    set x, 7    [10]    ; 预置位计数器，并延迟到达数据位中心
bitloop:                ; 共计 12 周期（包含 wait 和 set）
    in pins, 1          ; 将采样到的数据移入 ISR
    jmp x-- bitloop [6] ; 循环采样 8 位，每轮 8 个周期
    jmp pin good_stop   ; 检查停止位是否为高电平

    irq 4 rel           ; 帧错误或 BREAK：触发 IRQ 并设置标记
    wait 1 pin 0        ; 等待线路恢复到空闲态
    jmp start           ; 若帧错误，不推送数据，重新开始接收

good_stop:
    push                ; 推送 ISR（已包含 8 位数据）并返回开始
                        ; 不额外延时，以避免对端时钟略快时错过下一帧

% c-sdk {
static inline void uart_rx_program_init(PIO pio, uint sm, uint offset, uint pin, uint baud) {
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, false);
    pio_gpio_init(pio, pin);
    gpio_pull_up(pin);

    pio_sm_config c = uart_rx_program_get_default_config(offset);
    sm_config_set_in_pins(&c, pin); // 设置 WAIT 与 IN 的输入引脚
    sm_config_set_jmp_pin(&c, pin); // 设置用于跳转判断的 JMP 引脚
    sm_config_set_in_shift(&c, true, false, 32); // 向右移位，不自动推送，32 位深度
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_RX); // 使用更深的 RX FIFO
    float div = (float)clock_get_hz(clk_sys) / (8 * baud); // 每 8 个周期采样 1 位
    sm_config_set_clkdiv(&c, div);

    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
}

static inline char uart_rx_program_getc(PIO pio, uint sm) {
    io_rw_8 *rxfifo_shift = (io_rw_8*)&pio->rxf[sm] + 3; // 读 FIFO 最上方 8 位（数据左对齐）
    while (pio_sm_is_rx_fifo_empty(pio, sm))
        tight_loop_contents(); // 等待 FIFO 非空
    return (char)*rxfifo_shift;
}

%}

```
# diagram.json
```json
{
  "version": 1,
  "author": "wang minglie",
  "editor": "wokwi",
  "parts": [
    {
      "type": "wokwi-pi-pico",
      "id": "pico",
      "top": -3.15,
      "left": 3.6,
      "attrs": { "builder": "pico-sdk" }
    },
    { "type": "wokwi-gnd", "id": "gnd1", "top": 240, "left": 153, "attrs": {} },
    { "type": "wokwi-vcc", "id": "vcc1", "top": -133.64, "left": 240, "attrs": {} },
    {
      "type": "wokwi-resistor",
      "id": "r1",
      "top": -34.45,
      "left": 134.4,
      "rotate": 90,
      "attrs": { "value": "1000" }
    },
    { "type": "wokwi-slide-switch", "id": "sw1", "top": 71.6, "left": 300.7, "attrs": {} },
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": -143.65, "left": 326.4, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "vcc1:VCC", "r1:1", "red", [ "v0", "h-86.4" ] ],
    [ "sw1:1", "r1:2", "green", [ "h-48", "v-86.4", "h-95.45" ] ],
    [ "sw1:2", "pico:GP16", "green", [ "v57.6", "h-163.1", "v28.8", "h-76.8" ] ],
    [ "gnd1:GND", "sw1:3", "black", [ "v-38.4", "h153.6" ] ],
    [ "pico:GP3", "logic1:D0", "green", [ "h-48", "v-220.8", "h316.8", "v19.2" ] ],
    [ "sw1:2", "pico:GP3", "green", [ "v28.8", "h-211.1", "v-124.8", "h-134.4", "v28.8" ] ]
  ],
  "dependencies": {}
}
```
# wokwi.toml
```xml
[wokwi]
version = 1
firmware = "cmake-build-debug-pico/pio_squarewave.uf2"
elf = "cmake-build-debug-pico/pio_squarewave.elf"
```
# main.c
```c
/**
 * Copyright (c) 2020 Raspberry Pi (Trading) Ltd.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

#include <stdio.h>

#include "pico/stdlib.h"
#include "pico/multicore.h"
#include "hardware/pio.h"
#include "hardware/uart.h"
#include "uart_rx.pio.h"

// This program
// - Uses UART1 (the spare UART, by default) to transmit some text
// - Uses a PIO state machine to receive that text
// - Prints out the received text to the default console (UART0)
// This might require some reconfiguration on boards where UART1 is the
// default UART.

#define SERIAL_BAUD PICO_DEFAULT_UART_BAUD_RATE
#define HARD_UART_INST uart1

// You'll need a wire from GPIO4 -> GPIO3

#define PIO_RX_PIN 3



int main() {
    // Console output (also a UART, yes it's confusing)
    setup_default_uart();
    PIO pio = pio0;
    uint sm = 0;
    uint offset = pio_add_program(pio, &uart_rx_program);
    uart_rx_program_init(pio, sm, offset, PIO_RX_PIN, SERIAL_BAUD);
    while (true) {
        char c = uart_rx_program_getc(pio, sm);
        printf("%d \r\n",c);
    }
}

```

# uart_rx_intr_main.c
```c
/**
 * Copyright (c) 2023 Raspberry Pi (Trading) Ltd.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

#include <stdio.h>
#include <stdlib.h>

#include "pico/stdlib.h"
#include "pico/multicore.h"
#include "pico/util/queue.h"
#include "pico/async_context_threadsafe_background.h"

#include "hardware/pio.h"
#include "hardware/uart.h"
#include "uart_rx.pio.h"

// This program
// - Uses UART1 (the spare UART, by default) to transmit some text
// - Uses a PIO state machine to receive that text
// - Use an interrupt to determine when the PIO FIFO has some data
// - Saves characters in a queue
// - Uses an async context to perform work when notified by the irq
// - Prints out the received text to the default console (UART0)
// This might require some reconfiguration on boards where UART1 is the
// default UART.

#define SERIAL_BAUD PICO_DEFAULT_UART_BAUD_RATE
#define HARD_UART_INST uart1

// You'll need a wire from GPIO4 -> GPIO3
#define HARD_UART_TX_PIN 4
#define PIO_RX_PIN 3
#define FIFO_SIZE 64
#define MAX_COUNTER 10

static PIO pio;
static uint sm;
static int8_t pio_irq;
static queue_t fifo;
static uint offset;
static uint32_t counter;
static bool work_done;

// Ask core 1 to print a string, to make things easier on core 0
static void core1_main() {
    while(counter < MAX_COUNTER) {
        sleep_ms(1000 + (rand() % 1000));
        static char text[64];
        sprintf(text, "Hello, world from PIO with interrupts! %u\n", counter++);
        uart_puts(HARD_UART_INST, text);
    }
}

static void async_worker_func(async_context_t *async_context, async_when_pending_worker_t *worker);

// An async context is notified by the irq to "do some work"
static async_context_threadsafe_background_t async_context;
static async_when_pending_worker_t worker = { .do_work = async_worker_func };

// IRQ called when the pio fifo is not empty, i.e. there are some characters on the uart
// This needs to run as quickly as possible or else you will lose characters (in particular don't printf!)
static void pio_irq_func(void) {
    while(!pio_sm_is_rx_fifo_empty(pio, sm)) {
        char c = uart_rx_program_getc(pio, sm);
        if (!queue_try_add(&fifo, &c)) {
            panic("fifo full");
        }
    }
    // Tell the async worker that there are some characters waiting for us
    async_context_set_work_pending(&async_context.core, &worker);
}

// Process characters
static void async_worker_func(async_context_t *async_context, async_when_pending_worker_t *worker) {
    work_done = true;
    while(!queue_is_empty(&fifo)) {
        char c;
        if (!queue_try_remove(&fifo, &c)) {
            panic("fifo empty");
        }
        putchar(c); // Display character in the console
    }
}

// Find a free pio and state machine and load the program into it.
// Returns false if this fails
static bool init_pio(const pio_program_t *program, PIO *pio_hw, uint *sm, uint *offset) {
    // Find a free pio
    *pio_hw = pio1;
    if (!pio_can_add_program(*pio_hw, program)) {
        *pio_hw = pio0;
        if (!pio_can_add_program(*pio_hw, program)) {
            *offset = -1;
            return false;
        }
    }
    *offset = pio_add_program(*pio_hw, program);
    // Find a state machine
    *sm = (int8_t)pio_claim_unused_sm(*pio_hw, false);
    if (*sm < 0) {
        return false;
    }
    return true;
}

int main() {
    // Console output (also a UART, yes it's confusing)
    setup_default_uart();
    printf("Starting PIO UART RX interrupt example\n");

    // Set up the hard UART we're going to use to print characters
    uart_init(HARD_UART_INST, SERIAL_BAUD);
    gpio_set_function(HARD_UART_TX_PIN, GPIO_FUNC_UART);

    // create a queue so the irq can save the data somewhere
    queue_init(&fifo, 1, FIFO_SIZE);

    // Setup an async context and worker to perform work when needed
    if (!async_context_threadsafe_background_init_with_defaults(&async_context)) {
        panic("failed to setup context");
    }
    async_context_add_when_pending_worker(&async_context.core, &worker);

    // Set up the state machine we're going to use to receive them.
    // In real code you need to find a free pio and state machine in case pio resources are used elsewhere
    if (!init_pio(&uart_rx_program, &pio, &sm, &offset)) {
        panic("failed to setup pio");
    }
    uart_rx_program_init(pio, sm, offset, PIO_RX_PIN, SERIAL_BAUD);

    // Find a free irq
    static_assert(PIO0_IRQ_1 == PIO0_IRQ_0 + 1 && PIO1_IRQ_1 == PIO1_IRQ_0 + 1, "");
    pio_irq = (pio == pio0) ? PIO0_IRQ_0 : PIO1_IRQ_0;
    if (irq_get_exclusive_handler(pio_irq)) {
        pio_irq++;
        if (irq_get_exclusive_handler(pio_irq)) {
            panic("All IRQs are in use");
        }
    }

    // Enable interrupt
    irq_add_shared_handler(pio_irq, pio_irq_func, PICO_SHARED_IRQ_HANDLER_DEFAULT_ORDER_PRIORITY); // Add a shared IRQ handler
    irq_set_enabled(pio_irq, true); // Enable the IRQ
    const uint irq_index = pio_irq - ((pio == pio0) ? PIO0_IRQ_0 : PIO1_IRQ_0); // Get index of the IRQ
    pio_set_irqn_source_enabled(pio, irq_index, pis_sm0_rx_fifo_not_empty + sm, true); // Set pio to tell us when the FIFO is NOT empty

    // Tell core 1 to print text to uart1
    multicore_launch_core1(core1_main);

    // Echo characters received from PIO to the console
    while (counter < MAX_COUNTER || work_done) {
        // Note that we could just sleep here as we're using "threadsafe_background" that uses a low priority interrupt
        // But if we changed to use a "polling" context that wouldn't work. The following works for both types of context.
        // When using "threadsafe_background" the poll does nothing. This loop is just preventing main from exiting!
        work_done = false;
        async_context_poll(&async_context.core);
        async_context_wait_for_work_ms(&async_context.core, 2000);
    }

    // Disable interrupt
    pio_set_irqn_source_enabled(pio, irq_index, pis_sm0_rx_fifo_not_empty + sm, false);
    irq_set_enabled(pio_irq, false);
    irq_remove_handler(pio_irq, pio_irq_func);

    // Cleanup pio
    pio_sm_set_enabled(pio, sm, false);
    pio_remove_program(pio, &uart_rx_program, offset);
    pio_sm_unclaim(pio, sm);

    async_context_remove_when_pending_worker(&async_context.core, &worker);
    async_context_deinit(&async_context.core);
    queue_free(&fifo);

    uart_deinit(HARD_UART_INST);

    printf("Test complete\n");
    sleep_ms(100);
    return 0;
}

```
# uart_rx.pio.h
```c
// -------------------------------------------------- //
// This file is autogenerated by pioasm; do not edit! //
// -------------------------------------------------- //

#pragma once

#if !PICO_NO_HARDWARE
#include "hardware/pio.h"
#endif

// ------------ //
// uart_rx_mini //
// ------------ //

#define uart_rx_mini_wrap_target 0
#define uart_rx_mini_wrap 3

static const uint16_t uart_rx_mini_program_instructions[] = {
            //     .wrap_target
    0x2020, //  0: wait   0 pin, 0                   
    0xea27, //  1: set    x, 7                   [10]
    0x4001, //  2: in     pins, 1                    
    0x0642, //  3: jmp    x--, 2                 [6] 
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program uart_rx_mini_program = {
    .instructions = uart_rx_mini_program_instructions,
    .length = 4,
    .origin = -1,
};

static inline pio_sm_config uart_rx_mini_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + uart_rx_mini_wrap_target, offset + uart_rx_mini_wrap);
    return c;
}

#include "hardware/clocks.h"
#include "hardware/gpio.h"
static inline void uart_rx_mini_program_init(PIO pio, uint sm, uint offset, uint pin, uint baud) {
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, false);
    pio_gpio_init(pio, pin);
    gpio_pull_up(pin);
    pio_sm_config c = uart_rx_mini_program_get_default_config(offset);
    sm_config_set_in_pins(&c, pin); // 配置用于 WAIT 和 IN 的输入引脚
    sm_config_set_in_shift(&c, true, true, 8); // 向右移位，启用自动推送，8 位阈值
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_RX); // 仅使用 RX FIFO
    float div = (float)clock_get_hz(clk_sys) / (8 * baud); // 每 8 个周期采样 1 位
    sm_config_set_clkdiv(&c, div);
    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
}

#endif

// ------- //
// uart_rx //
// ------- //

#define uart_rx_wrap_target 0
#define uart_rx_wrap 8

static const uint16_t uart_rx_program_instructions[] = {
            //     .wrap_target
    0x2020, //  0: wait   0 pin, 0                   
    0xea27, //  1: set    x, 7                   [10]
    0x4001, //  2: in     pins, 1                    
    0x0642, //  3: jmp    x--, 2                 [6] 
    0x00c8, //  4: jmp    pin, 8                     
    0xc014, //  5: irq    nowait 4 rel               
    0x20a0, //  6: wait   1 pin, 0                   
    0x0000, //  7: jmp    0                          
    0x8020, //  8: push   block                      
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program uart_rx_program = {
    .instructions = uart_rx_program_instructions,
    .length = 9,
    .origin = -1,
};

static inline pio_sm_config uart_rx_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + uart_rx_wrap_target, offset + uart_rx_wrap);
    return c;
}

static inline void uart_rx_program_init(PIO pio, uint sm, uint offset, uint pin, uint baud) {
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, false);
    pio_gpio_init(pio, pin);
    gpio_pull_up(pin);
    pio_sm_config c = uart_rx_program_get_default_config(offset);
    sm_config_set_in_pins(&c, pin); // 设置 WAIT 与 IN 的输入引脚
    sm_config_set_jmp_pin(&c, pin); // 设置用于跳转判断的 JMP 引脚
    sm_config_set_in_shift(&c, true, false, 32); // 向右移位，不自动推送，32 位深度
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_RX); // 使用更深的 RX FIFO
    float div = (float)clock_get_hz(clk_sys) / (8 * baud); // 每 8 个周期采样 1 位
    sm_config_set_clkdiv(&c, div);
    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
}
static inline char uart_rx_program_getc(PIO pio, uint sm) {
    io_rw_8 *rxfifo_shift = (io_rw_8*)&pio->rxf[sm] + 3; // 读 FIFO 最上方 8 位（数据左对齐）
    while (pio_sm_is_rx_fifo_empty(pio, sm))
        tight_loop_contents(); // 等待 FIFO 非空
    return (char)*rxfifo_shift;
}

#endif


```