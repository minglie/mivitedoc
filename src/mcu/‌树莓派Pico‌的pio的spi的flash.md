![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/fb25b1d36c1848038fa687aeab7894e4.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/3e9bb8933f2c4f0a970f541793ea1913.png)
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
        pio_spi.c
        spi.pio
)

pico_generate_pio_header(pio_squarewave ${CMAKE_CURRENT_LIST_DIR}/spi.pio)

target_link_libraries(pio_squarewave pico_stdlib hardware_pio)

pico_add_extra_outputs(pio_squarewave)


```
# spi.pio
```c
;
; 版权所有 (c) 2020 Raspberry Pi (Trading) Ltd.
;
; SPDX-License-Identifier: BSD-3-Clause
;

; 本程序实现全双工 SPI，SCK 时钟周期为 4 个系统时钟周期。
; 针对 CPHA 的两个取值（0 或 1）分别提供不同的程序。
; CPOL 则依靠 GPIO 输出反相功能在硬件中实现，而无需修改 PIO 程序。
;
; 若只需要发送（TX only），SPI 可工作在两倍速度（参见 ST7789 示例）。

.program spi_cpha0
.side_set 1

; 引脚分配：
; - SCK 使用 side-set 引脚 0
; - MOSI 使用 OUT 引脚 0
; - MISO 使用 IN 引脚 0
;
; 必须启用 autopush/autopull（自动入栈/出栈），序列帧长度由推/拉阈值决定。
; 可选择左移或右移，但数据对齐需自行保证。
; 对于 8 位或 16 位帧，可利用 RP2040 IO 结构的窄存储复制/窄加载特性，方便数据对齐。

; CPHA = 0：数据在 SCK 上升沿采样，在下降沿改变；第一上升沿即有效。

    out pins, 1 side 0 [1]   ; 若 TX FIFO 为空则会停在这里（side-set 不受 out stall 影响，因此保持 SCK 为低）
    in  pins, 1 side 1 [1]   ; 读取 MISO，产生 SCK 上升沿


.program spi_cpha1
.side_set 1

; CPHA = 1：数据在 SCK 上升沿改变，在下降沿采样。

    out x, 1    side 0       ; 若 TX FIFO 为空则停在这里（保持 SCK 未拉高）
    mov pins, x side 1 [1]   ; 输出 MOSI 数据，并产生 SCK 上升沿（mov pins 使用 OUT 映射）
    in  pins, 1 side 0       ; 读取 MISO，并拉低 SCK

% c-sdk {
#include "hardware/gpio.h"

static inline void pio_spi_init(PIO pio, uint sm, uint prog_offs, uint n_bits,
        float clkdiv, bool cpha, bool cpol, uint pin_sck, uint pin_mosi, uint pin_miso) {

    // 根据 CPHA 选择对应的 PIO 程序
    pio_sm_config c = cpha ?
            spi_cpha1_program_get_default_config(prog_offs) :
            spi_cpha0_program_get_default_config(prog_offs);

    // 配置 MOSI（输出）、MISO（输入）、SCK（side-set）
    sm_config_set_out_pins(&c, pin_mosi, 1);
    sm_config_set_in_pins(&c, pin_miso);
    sm_config_set_sideset_pins(&c, pin_sck);

    // 本示例仅支持 MSB-first（移位方向固定）
    sm_config_set_out_shift(&c, false, true, n_bits);
    sm_config_set_in_shift(&c,  false, true, n_bits);

    // 设置 SPI 时钟分频
    sm_config_set_clkdiv(&c, clkdiv);

    // 将 MOSI、SCK 输出初始化为低，MISO 设为输入
    pio_sm_set_pins_with_mask(
        pio, sm, 0,
        (1u << pin_sck) | (1u << pin_mosi)
    );
    pio_sm_set_pindirs_with_mask(
        pio, sm,
        (1u << pin_sck) | (1u << pin_mosi),
        (1u << pin_sck) | (1u << pin_mosi) | (1u << pin_miso)
    );

    pio_gpio_init(pio, pin_mosi);
    pio_gpio_init(pio, pin_miso);
    pio_gpio_init(pio, pin_sck);

    // 通过 GPIO 输出反相实现 CPOL=1
    gpio_set_outover(pin_sck, cpol ? GPIO_OVERRIDE_INVERT : GPIO_OVERRIDE_NORMAL);

    // SPI 是同步接口，绕过输入同步器减少输入延迟
    hw_set_bits(&pio->input_sync_bypass, 1u << pin_miso);

    // 初始化并启动状态机
    pio_sm_init(pio, sm, prog_offs, &c);
    pio_sm_set_enabled(pio, sm, true);
}
%}

; ============================================================
; 带自动片选（CS）的 SPI
; ============================================================
;
; 功能说明：
; 一旦 TX FIFO 中有数据，CS 自动拉低；
; FIFO 读空后自动拉高；
; 并带有前沿/后沿延迟。
;
; Y 寄存器决定每帧 bit 数（2～32 bit）
;
; 引脚分配：
; - side-set bit0 = SCK
; - side-set bit1 = CSn（片选，低有效）
; - OUT bit0 = MOSI
; - IN bit0  = MISO
;
; 支持 1 个片选，如需多个请使用 GPIO 手动控制。
;
; CPOL 仍通过 GPIO 反相实现；以下仅区分 CPHA。

; ------------------------------------------------------------
; CPHA = 0：在 SCK 上升沿采样，在下降沿变化
; ------------------------------------------------------------

.program spi_cpha0_cs
.side_set 2

.wrap_target
bitloop:
    out pins, 1        side 0x0 [1]  ; 发送 MOSI，SCK=0
    in  pins, 1        side 0x1       ; 采样 MISO，SCK=1
    jmp x-- bitloop    side 0x1       ; 若 x>0，继续循环；SCK=1

    out pins, 1        side 0x0       ; 发送最后一位，SCK=0
    mov x, y           side 0x0       ; 重新装载 bit 计数器（来自 Y）
    in pins, 1         side 0x1       ; 采样 MISO，SCK=1

    jmp !osre bitloop  side 0x1       ; 如果 TX FIFO 未空，继续发送

    nop                side 0x0 [1]   ; 片选 CSn 后沿延迟

public entry_point:                  ; 启动前必须设置 X,Y = (bit数 - 2)
    pull ifempty       side 0x2 [1]   ; FIFO 空则阻塞，CSn=1（空闲）
.wrap


; ------------------------------------------------------------
; CPHA = 1：在 SCK 上升沿改变数据，在下降沿采样
; ------------------------------------------------------------

.program spi_cpha1_cs
.side_set 2

.wrap_target
bitloop:
    out pins, 1        side 0x1 [1]  ; SCK=1，输出 MOSI
    in  pins, 1        side 0x0      ; SCK=0，采样 MISO
    jmp x-- bitloop    side 0x0

    out pins, 1        side 0x1
    mov x, y           side 0x1
    in  pins, 1        side 0x0
    jmp !osre bitloop  side 0x0

public entry_point:
    pull ifempty       side 0x2 [1]   ; FIFO 空则阻塞，CSn=1
    nop                side 0x0 [1]   ; CSn 前沿延迟
.wrap

% c-sdk {
#include "hardware/gpio.h"

static inline void pio_spi_cs_init(PIO pio, uint sm, uint prog_offs, uint n_bits,
        float clkdiv, bool cpha, bool cpol,
        uint pin_sck, uint pin_mosi, uint pin_miso) {

    // 根据 CPHA 选择对应 PIO 程序
    pio_sm_config c = cpha ?
            spi_cpha1_cs_program_get_default_config(prog_offs) :
            spi_cpha0_cs_program_get_default_config(prog_offs);

    sm_config_set_out_pins(&c, pin_mosi, 1);
    sm_config_set_in_pins(&c, pin_miso);
    sm_config_set_sideset_pins(&c, pin_sck);

    sm_config_set_out_shift(&c, false, true, n_bits);
    sm_config_set_in_shift(&c,  false, true, n_bits);
    sm_config_set_clkdiv(&c, clkdiv);

    // 设置 SCK(2bit)，MOSI 输出
    pio_sm_set_pins_with_mask(
        pio, sm, (2u << pin_sck),
        (3u << pin_sck) | (1u << pin_mosi)
    );

    pio_sm_set_pindirs_with_mask(
        pio, sm,
        (3u << pin_sck) | (1u << pin_mosi),
        (3u << pin_sck) | (1u << pin_mosi) | (1u << pin_miso)
    );

    pio_gpio_init(pio, pin_mosi);
    pio_gpio_init(pio, pin_miso);
    pio_gpio_init(pio, pin_sck);
    pio_gpio_init(pio, pin_sck + 1);   // 片选 CSn

    gpio_set_outover(pin_sck, cpol ? GPIO_OVERRIDE_INVERT : GPIO_OVERRIDE_NORMAL);
    hw_set_bits(&pio->input_sync_bypass, 1u << pin_miso);

    uint entry_point =
        prog_offs +
        (cpha ? spi_cpha1_cs_offset_entry_point : spi_cpha0_cs_offset_entry_point);

    pio_sm_init(pio, sm, entry_point, &c);
    pio_sm_exec(pio, sm, pio_encode_set(pio_x, n_bits - 2));
    pio_sm_exec(pio, sm, pio_encode_set(pio_y, n_bits - 2));
    pio_sm_set_enabled(pio, sm, true);
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
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": -28.45, "left": 220.8, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "pico:GP18", "logic1:D0", "green", [ "h87.6", "v-172.8" ] ],
    [ "logic1:D1", "pico:GP19", "green", [ "h-67.2", "v163.2" ] ],
    [ "pico:GP16", "logic1:D2", "green", [ "v0", "h97.2", "v-192" ] ],
    [ "pico:GP17", "logic1:D3", "green", [ "h106.8", "v-172.8" ] ]
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
#include "pico/binary_info.h"
#include "pio_spi.h"

// This example uses PIO to erase, program and read back a SPI serial flash
// memory.

// ----------------------------------------------------------------------------
// Generic serial flash code

#define FLASH_PAGE_SIZE        256
#define FLASH_SECTOR_SIZE      4096

#define FLASH_CMD_PAGE_PROGRAM 0x02
#define FLASH_CMD_READ         0x03
#define FLASH_CMD_STATUS       0x05
#define FLASH_CMD_WRITE_EN     0x06
#define FLASH_CMD_SECTOR_ERASE 0x20

#define FLASH_STATUS_BUSY_MASK 0x01



// --- SPI ---
#ifndef PICO_DEFAULT_SPI
#define PICO_DEFAULT_SPI 0
#endif
#ifndef PICO_DEFAULT_SPI_SCK_PIN
#define PICO_DEFAULT_SPI_SCK_PIN 18
#endif
#ifndef PICO_DEFAULT_SPI_TX_PIN
#define PICO_DEFAULT_SPI_TX_PIN 19
#endif
#ifndef PICO_DEFAULT_SPI_RX_PIN
#define PICO_DEFAULT_SPI_RX_PIN 16
#endif
#ifndef PICO_DEFAULT_SPI_CSN_PIN
#define PICO_DEFAULT_SPI_CSN_PIN 17
#endif



void flash_read(const pio_spi_inst_t *spi, uint32_t addr, uint8_t *buf, size_t len) {
    uint8_t cmd[4] = {
            FLASH_CMD_READ,
            addr >> 16,
            addr >> 8,
            addr
    };
    gpio_put(spi->cs_pin, 0);
    pio_spi_write8_blocking(spi, cmd, 4);
    pio_spi_read8_blocking(spi, buf, len);
    gpio_put(spi->cs_pin, 1);
}


void flash_write_enable(const pio_spi_inst_t *spi) {
    uint8_t cmd = FLASH_CMD_WRITE_EN;
    gpio_put(spi->cs_pin, 0);
    pio_spi_write8_blocking(spi, &cmd, 1);
    gpio_put(spi->cs_pin, 1);
}

void flash_wait_done(const pio_spi_inst_t *spi) {
    uint8_t status;
    do {
        gpio_put(spi->cs_pin, 0);
        uint8_t cmd = FLASH_CMD_STATUS;
        pio_spi_write8_blocking(spi, &cmd, 1);
        pio_spi_read8_blocking(spi, &status, 1);
        gpio_put(spi->cs_pin, 1);
    } while (status & FLASH_STATUS_BUSY_MASK);
}

void flash_sector_erase(const pio_spi_inst_t *spi, uint32_t addr) {
    uint8_t cmd[4] = {
            FLASH_CMD_SECTOR_ERASE,
            addr >> 16,
            addr >> 8,
            addr
    };
    flash_write_enable(spi);
    gpio_put(spi->cs_pin, 0);
    pio_spi_write8_blocking(spi, cmd, 4);
    gpio_put(spi->cs_pin, 1);
    flash_wait_done(spi);
}

void flash_page_program(const pio_spi_inst_t *spi, uint32_t addr, uint8_t data[]) {
    flash_write_enable(spi);
    uint8_t cmd[4] = {
            FLASH_CMD_PAGE_PROGRAM,
            addr >> 16,
            addr >> 8,
            addr
    };
    gpio_put(spi->cs_pin, 0);
    pio_spi_write8_blocking(spi, cmd, 4);
    pio_spi_write8_blocking(spi, data, FLASH_PAGE_SIZE);
    gpio_put(spi->cs_pin, 1);
    flash_wait_done(spi);
}

// ----------------------------------------------------------------------------
// Example program

void printbuf(const uint8_t buf[FLASH_PAGE_SIZE]) {
    for (int i = 0; i < FLASH_PAGE_SIZE; ++i)
        printf("%02x%c", buf[i], i % 16 == 15 ? '\n' : ' ');
}

int main() {
    stdio_init_all();
#if !defined(PICO_DEFAULT_SPI_SCK_PIN) || !defined(PICO_DEFAULT_SPI_TX_PIN) || !defined(PICO_DEFAULT_SPI_RX_PIN) || !defined(PICO_DEFAULT_SPI_CSN_PIN)
    #warning pio/spi/spi_flash example requires a board with SPI pins
    puts("Default SPI pins were not defined");
#else

    puts("PIO SPI Example");

    pio_spi_inst_t spi = {
            .pio = pio0,
            .sm = 0,
            .cs_pin = PICO_DEFAULT_SPI_CSN_PIN
    };

    gpio_init(PICO_DEFAULT_SPI_CSN_PIN);
    gpio_put(PICO_DEFAULT_SPI_CSN_PIN, 1);
    gpio_set_dir(PICO_DEFAULT_SPI_CSN_PIN, GPIO_OUT);

    uint offset = pio_add_program(spi.pio, &spi_cpha0_program);
    printf("Loaded program at %d\n", offset);

    pio_spi_init(spi.pio, spi.sm, offset,
                 8,       // 8 bits per SPI frame
                 31.25f,  // 1 MHz @ 125 clk_sys
                 false,   // CPHA = 0
                 false,   // CPOL = 0
                 PICO_DEFAULT_SPI_SCK_PIN,
                 PICO_DEFAULT_SPI_TX_PIN,
                 PICO_DEFAULT_SPI_RX_PIN
    );
    // Make the 'SPI' pins available to picotool
    bi_decl(bi_4pins_with_names(PICO_DEFAULT_SPI_RX_PIN, "SPI RX", PICO_DEFAULT_SPI_TX_PIN, "SPI TX", PICO_DEFAULT_SPI_SCK_PIN, "SPI SCK", PICO_DEFAULT_SPI_CSN_PIN, "SPI CS"));

    uint8_t page_buf[FLASH_PAGE_SIZE];

    const uint32_t target_addr = 0;

    flash_sector_erase(&spi, target_addr);
    flash_read(&spi, target_addr, page_buf, FLASH_PAGE_SIZE);

    puts("After erase:");
    printbuf(page_buf);

    for (int i = 0; i < FLASH_PAGE_SIZE; ++i)
        page_buf[i] = i;
    flash_page_program(&spi, target_addr, page_buf);
    flash_read(&spi, target_addr, page_buf, FLASH_PAGE_SIZE);

    puts("After program:");
    printbuf(page_buf);

    flash_sector_erase(&spi, target_addr);
    flash_read(&spi, target_addr, page_buf, FLASH_PAGE_SIZE);

    puts("Erase again:");
    printbuf(page_buf);

    return 0;
#endif
}

```

# pio_spi.c
```c
/**
 * Copyright (c) 2020 Raspberry Pi (Trading) Ltd.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

#include "pio_spi.h"

// Just 8 bit functions provided here. The PIO program supports any frame size
// 1...32, but the software to do the necessary FIFO shuffling is left as an
// exercise for the reader :)
//
// Likewise we only provide MSB-first here. To do LSB-first, you need to
// - Do shifts when reading from the FIFO, for general case n != 8, 16, 32
// - Do a narrow read at a one halfword or 3 byte offset for n == 16, 8
// in order to get the read data correctly justified. 

void __time_critical_func(pio_spi_write8_blocking)(const pio_spi_inst_t *spi, const uint8_t *src, size_t len) {
    size_t tx_remain = len, rx_remain = len;
    // Do 8 bit accesses on FIFO, so that write data is byte-replicated. This
    // gets us the left-justification for free (for MSB-first shift-out)
    io_rw_8 *txfifo = (io_rw_8 *) &spi->pio->txf[spi->sm];
    io_rw_8 *rxfifo = (io_rw_8 *) &spi->pio->rxf[spi->sm];
    while (tx_remain || rx_remain) {
        if (tx_remain && !pio_sm_is_tx_fifo_full(spi->pio, spi->sm)) {
            *txfifo = *src++;
            --tx_remain;
        }
        if (rx_remain && !pio_sm_is_rx_fifo_empty(spi->pio, spi->sm)) {
            (void) *rxfifo;
            --rx_remain;
        }
    }
}

void __time_critical_func(pio_spi_read8_blocking)(const pio_spi_inst_t *spi, uint8_t *dst, size_t len) {
    size_t tx_remain = len, rx_remain = len;
    io_rw_8 *txfifo = (io_rw_8 *) &spi->pio->txf[spi->sm];
    io_rw_8 *rxfifo = (io_rw_8 *) &spi->pio->rxf[spi->sm];
    while (tx_remain || rx_remain) {
        if (tx_remain && !pio_sm_is_tx_fifo_full(spi->pio, spi->sm)) {
            *txfifo = 0;
            --tx_remain;
        }
        if (rx_remain && !pio_sm_is_rx_fifo_empty(spi->pio, spi->sm)) {
            *dst++ = *rxfifo;
            --rx_remain;
        }
    }
}

void __time_critical_func(pio_spi_write8_read8_blocking)(const pio_spi_inst_t *spi, uint8_t *src, uint8_t *dst,
                                                         size_t len) {
    size_t tx_remain = len, rx_remain = len;
    io_rw_8 *txfifo = (io_rw_8 *) &spi->pio->txf[spi->sm];
    io_rw_8 *rxfifo = (io_rw_8 *) &spi->pio->rxf[spi->sm];
    while (tx_remain || rx_remain) {
        if (tx_remain && !pio_sm_is_tx_fifo_full(spi->pio, spi->sm)) {
            *txfifo = *src++;
            --tx_remain;
        }
        if (rx_remain && !pio_sm_is_rx_fifo_empty(spi->pio, spi->sm)) {
            *dst++ = *rxfifo;
            --rx_remain;
        }
    }
}


```

# pio_spi.h
```c
/**
 * Copyright (c) 2020 Raspberry Pi (Trading) Ltd.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
#ifndef _PIO_SPI_H
#define _PIO_SPI_H

#include "hardware/pio.h"
#include "spi.pio.h"

typedef struct pio_spi_inst {
    PIO pio;
    uint sm;
    uint cs_pin;
} pio_spi_inst_t;

void pio_spi_write8_blocking(const pio_spi_inst_t *spi, const uint8_t *src, size_t len);

void pio_spi_read8_blocking(const pio_spi_inst_t *spi, uint8_t *dst, size_t len);

void pio_spi_write8_read8_blocking(const pio_spi_inst_t *spi, uint8_t *src, uint8_t *dst, size_t len);

#endif


```

# spi.pio.h
```c
// -------------------------------------------------- //
// This file is autogenerated by pioasm; do not edit! //
// -------------------------------------------------- //

#pragma once

#if !PICO_NO_HARDWARE
#include "hardware/pio.h"
#endif

// --------- //
// spi_cpha0 //
// --------- //

#define spi_cpha0_wrap_target 0
#define spi_cpha0_wrap 1

static const uint16_t spi_cpha0_program_instructions[] = {
            //     .wrap_target
    0x6101, //  0: out    pins, 1         side 0 [1] 
    0x5101, //  1: in     pins, 1         side 1 [1] 
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program spi_cpha0_program = {
    .instructions = spi_cpha0_program_instructions,
    .length = 2,
    .origin = -1,
};

static inline pio_sm_config spi_cpha0_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + spi_cpha0_wrap_target, offset + spi_cpha0_wrap);
    sm_config_set_sideset(&c, 1, false, false);
    return c;
}
#endif

// --------- //
// spi_cpha1 //
// --------- //

#define spi_cpha1_wrap_target 0
#define spi_cpha1_wrap 2

static const uint16_t spi_cpha1_program_instructions[] = {
            //     .wrap_target
    0x6021, //  0: out    x, 1            side 0     
    0xb101, //  1: mov    pins, x         side 1 [1] 
    0x4001, //  2: in     pins, 1         side 0     
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program spi_cpha1_program = {
    .instructions = spi_cpha1_program_instructions,
    .length = 3,
    .origin = -1,
};

static inline pio_sm_config spi_cpha1_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + spi_cpha1_wrap_target, offset + spi_cpha1_wrap);
    sm_config_set_sideset(&c, 1, false, false);
    return c;
}

#include "hardware/gpio.h"
static inline void pio_spi_init(PIO pio, uint sm, uint prog_offs, uint n_bits,
        float clkdiv, bool cpha, bool cpol, uint pin_sck, uint pin_mosi, uint pin_miso) {
    // 根据 CPHA 选择对应的 PIO 程序
    pio_sm_config c = cpha ?
            spi_cpha1_program_get_default_config(prog_offs) :
            spi_cpha0_program_get_default_config(prog_offs);
    // 配置 MOSI（输出）、MISO（输入）、SCK（side-set）
    sm_config_set_out_pins(&c, pin_mosi, 1);
    sm_config_set_in_pins(&c, pin_miso);
    sm_config_set_sideset_pins(&c, pin_sck);
    // 本示例仅支持 MSB-first（移位方向固定）
    sm_config_set_out_shift(&c, false, true, n_bits);
    sm_config_set_in_shift(&c,  false, true, n_bits);
    // 设置 SPI 时钟分频
    sm_config_set_clkdiv(&c, clkdiv);
    // 将 MOSI、SCK 输出初始化为低，MISO 设为输入
    pio_sm_set_pins_with_mask(
        pio, sm, 0,
        (1u << pin_sck) | (1u << pin_mosi)
    );
    pio_sm_set_pindirs_with_mask(
        pio, sm,
        (1u << pin_sck) | (1u << pin_mosi),
        (1u << pin_sck) | (1u << pin_mosi) | (1u << pin_miso)
    );
    pio_gpio_init(pio, pin_mosi);
    pio_gpio_init(pio, pin_miso);
    pio_gpio_init(pio, pin_sck);
    // 通过 GPIO 输出反相实现 CPOL=1
    gpio_set_outover(pin_sck, cpol ? GPIO_OVERRIDE_INVERT : GPIO_OVERRIDE_NORMAL);
    // SPI 是同步接口，绕过输入同步器减少输入延迟
    hw_set_bits(&pio->input_sync_bypass, 1u << pin_miso);
    // 初始化并启动状态机
    pio_sm_init(pio, sm, prog_offs, &c);
    pio_sm_set_enabled(pio, sm, true);
}

#endif

// ------------ //
// spi_cpha0_cs //
// ------------ //

#define spi_cpha0_cs_wrap_target 0
#define spi_cpha0_cs_wrap 8

#define spi_cpha0_cs_offset_entry_point 8u

static const uint16_t spi_cpha0_cs_program_instructions[] = {
            //     .wrap_target
    0x6101, //  0: out    pins, 1         side 0 [1] 
    0x4801, //  1: in     pins, 1         side 1     
    0x0840, //  2: jmp    x--, 0          side 1     
    0x6001, //  3: out    pins, 1         side 0     
    0xa022, //  4: mov    x, y            side 0     
    0x4801, //  5: in     pins, 1         side 1     
    0x08e0, //  6: jmp    !osre, 0        side 1     
    0xa142, //  7: nop                    side 0 [1] 
    0x91e0, //  8: pull   ifempty block   side 2 [1] 
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program spi_cpha0_cs_program = {
    .instructions = spi_cpha0_cs_program_instructions,
    .length = 9,
    .origin = -1,
};

static inline pio_sm_config spi_cpha0_cs_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + spi_cpha0_cs_wrap_target, offset + spi_cpha0_cs_wrap);
    sm_config_set_sideset(&c, 2, false, false);
    return c;
}
#endif

// ------------ //
// spi_cpha1_cs //
// ------------ //

#define spi_cpha1_cs_wrap_target 0
#define spi_cpha1_cs_wrap 8

#define spi_cpha1_cs_offset_entry_point 7u

static const uint16_t spi_cpha1_cs_program_instructions[] = {
            //     .wrap_target
    0x6901, //  0: out    pins, 1         side 1 [1] 
    0x4001, //  1: in     pins, 1         side 0     
    0x0040, //  2: jmp    x--, 0          side 0     
    0x6801, //  3: out    pins, 1         side 1     
    0xa822, //  4: mov    x, y            side 1     
    0x4001, //  5: in     pins, 1         side 0     
    0x00e0, //  6: jmp    !osre, 0        side 0     
    0x91e0, //  7: pull   ifempty block   side 2 [1] 
    0xa142, //  8: nop                    side 0 [1] 
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program spi_cpha1_cs_program = {
    .instructions = spi_cpha1_cs_program_instructions,
    .length = 9,
    .origin = -1,
};

static inline pio_sm_config spi_cpha1_cs_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + spi_cpha1_cs_wrap_target, offset + spi_cpha1_cs_wrap);
    sm_config_set_sideset(&c, 2, false, false);
    return c;
}

#include "hardware/gpio.h"
static inline void pio_spi_cs_init(PIO pio, uint sm, uint prog_offs, uint n_bits,
        float clkdiv, bool cpha, bool cpol,
        uint pin_sck, uint pin_mosi, uint pin_miso) {
    // 根据 CPHA 选择对应 PIO 程序
    pio_sm_config c = cpha ?
            spi_cpha1_cs_program_get_default_config(prog_offs) :
            spi_cpha0_cs_program_get_default_config(prog_offs);
    sm_config_set_out_pins(&c, pin_mosi, 1);
    sm_config_set_in_pins(&c, pin_miso);
    sm_config_set_sideset_pins(&c, pin_sck);
    sm_config_set_out_shift(&c, false, true, n_bits);
    sm_config_set_in_shift(&c,  false, true, n_bits);
    sm_config_set_clkdiv(&c, clkdiv);
    // 设置 SCK(2bit)，MOSI 输出
    pio_sm_set_pins_with_mask(
        pio, sm, (2u << pin_sck),
        (3u << pin_sck) | (1u << pin_mosi)
    );
    pio_sm_set_pindirs_with_mask(
        pio, sm,
        (3u << pin_sck) | (1u << pin_mosi),
        (3u << pin_sck) | (1u << pin_mosi) | (1u << pin_miso)
    );
    pio_gpio_init(pio, pin_mosi);
    pio_gpio_init(pio, pin_miso);
    pio_gpio_init(pio, pin_sck);
    pio_gpio_init(pio, pin_sck + 1);   // 片选 CSn
    gpio_set_outover(pin_sck, cpol ? GPIO_OVERRIDE_INVERT : GPIO_OVERRIDE_NORMAL);
    hw_set_bits(&pio->input_sync_bypass, 1u << pin_miso);
    uint entry_point =
        prog_offs +
        (cpha ? spi_cpha1_cs_offset_entry_point : spi_cpha0_cs_offset_entry_point);
    pio_sm_init(pio, sm, entry_point, &c);
    pio_sm_exec(pio, sm, pio_encode_set(pio_x, n_bits - 2));
    pio_sm_exec(pio, sm, pio_encode_set(pio_y, n_bits - 2));
    pio_sm_set_enabled(pio, sm, true);
}

#endif



```