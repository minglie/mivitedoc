
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/77051533ede4464aa4c4c50913898e3a.png)
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
        uart_tx.pio
)

pico_generate_pio_header(pio_squarewave ${CMAKE_CURRENT_LIST_DIR}/uart_tx.pio)

target_link_libraries(pio_squarewave pico_stdlib hardware_pio)

pico_add_extra_outputs(pio_squarewave)

```
# uart_tx.pio
```c
;
; Copyright (c) 2020 Raspberry Pi (Trading) Ltd.
;
; SPDX-License-Identifier: BSD-3-Clause
;

.program uart_tx
.side_set 1 opt       ; 使用一个 side-set 引脚，可选，用于发送起始/停止位

; 8n1 UART 发送程序
; OUT 引脚和 side-set 引脚都映射到同一个 UART TX

    pull       side 1 [7]  ; 从 TX FIFO 拉取一个字节到 OSR
                            ; side-set 输出高电平（停止位/空闲状态）
                            ; 延迟 7 个周期，总共 8 个周期完成

    set x, 7   side 0 [7]  ; 将寄存器 X 置为 7（用于位计数）
                            ; side-set 输出低电平，发送 UART 起始位
                            ; 延迟 7 个周期，使起始位持续 8 个周期

bitloop:                   ; 主循环，发送 8 个数据位
    out pins, 1            ; 将 OSR 的最低有效位输出到 TX 引脚
    jmp x-- bitloop   [6]  ; X 减 1，不为 0 则跳回 bitloop
                            ; 延迟 6 个周期，总循环每个位 8 个周期

% c-sdk {
#include "hardware/clocks.h"

static inline void uart_tx_program_init(PIO pio, uint sm, uint offset, uint pin_tx, uint baud) {
    // 初始化 TX 引脚为空闲高电平
    pio_sm_set_pins_with_mask(pio, sm, 1u << pin_tx, 1u << pin_tx);
    // 设置 TX 引脚为输出
    pio_sm_set_pindirs_with_mask(pio, sm, 1u << pin_tx, 1u << pin_tx);
    pio_gpio_init(pio, pin_tx);  // 初始化 GPIO

    pio_sm_config c = uart_tx_program_get_default_config(offset);

    // 配置 OUT 寄存器右移，禁用自动拉取
    sm_config_set_out_shift(&c, true, false, 32);

    // OUT 和 side-set 都映射到同一个 TX 引脚
    sm_config_set_out_pins(&c, pin_tx, 1);
    sm_config_set_sideset_pins(&c, pin_tx);

    // 仅 TX，使用 8 深 FIFO
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_TX);

    // 设置状态机时钟分频，使每位持续 8 个周期
    float div = (float)clock_get_hz(clk_sys) / (8 * baud);
    sm_config_set_clkdiv(&c, div);

    // 初始化状态机
    pio_sm_init(pio, sm, offset, &c);
    // 启用状态机
    pio_sm_set_enabled(pio, sm, true);
}

static inline void uart_tx_program_putc(PIO pio, uint sm, char c) {
    // 阻塞方式将一个字符写入 FIFO
    pio_sm_put_blocking(pio, sm, (uint32_t)c);
}

static inline void uart_tx_program_puts(PIO pio, uint sm, const char *s) {
    // 循环发送字符串
    while (*s)
        uart_tx_program_putc(pio, sm, *s++);
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
    [ "logic1:D0", "pico:GP0", "green", [ "h-57.6", "v-57.6", "h-288", "v192" ] ]
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
#include "pico/stdlib.h"
#include "hardware/pio.h"
#include "uart_tx.pio.h"

int main() {
    // We're going to use PIO to print "Hello, world!" on the same GPIO which we
    // normally attach UART0 to.
    const uint PIN_TX = 0;
    // This is the same as the default UART baud rate on Pico
    const uint SERIAL_BAUD = 115200;

    PIO pio = pio0;
    uint sm = 0;
    uint offset = pio_add_program(pio, &uart_tx_program);
    uart_tx_program_init(pio, sm, offset, PIN_TX, SERIAL_BAUD);

    while (true) {
        uart_tx_program_puts(pio, sm, "hello word\n");
        sleep_ms(1000);
    }
}

```