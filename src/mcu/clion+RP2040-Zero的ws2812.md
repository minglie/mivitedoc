[pico-sdk-api文档](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pio)

[rp2040-datasheet.pdf](https://pip-assets.raspberrypi.com/categories/814-rp2040/documents/RP-008371-DS-1-rp2040-datasheet.pdf?disposition=inline)

[getting-started-with-pico.pdf](https://pip-assets.raspberrypi.com/categories/610-raspberry-pi-pico/documents/RP-008276-DS-1-getting-started-with-pico.pdf?disposition=inline)

[树莓派 Pico 之可编程 IO（PIO）](https://pico.nxez.com/2023/11/06/programmable-io-on-raspberry-pi-pico.html)
# CMakeLists.txt
```bash
# Set minimum CMake version required
cmake_minimum_required(VERSION 3.13)

# Set Pico SDK path
set(PICO_SDK_PATH "D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/pico-sdk")

# Include the Pico SDK CMake configuration
include(my_pico_sdk_import.cmake)

# Set project name and language
project(pipo_project C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# Initialize the Pico SDK
pico_sdk_init()

# Add executable target
add_executable(pipo_project
        main.cpp
)

# Link the Pico SDK libraries
target_link_libraries(pipo_project
    pico_stdlib
    hardware_pwm
    hardware_uart
    hardware_pio
)

# Enable USB output, disable UART output
pico_enable_stdio_usb(pipo_project 1)
pico_enable_stdio_uart(pipo_project 0)

# Create additional output files
pico_add_extra_outputs(pipo_project)

```

# my_pico_sdk_import.cmake
```bash
# This is a copy of <PICO_SDK_PATH>/external/pico_sdk_import.cmake

# This can be dropped into an external project to help locate this SDK
# It should be include()ed prior to project()

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

set(PICO_SDK_PATH "${PICO_SDK_PATH}" CACHE PATH "Path to the Raspberry Pi Pico SDK")
set(PICO_SDK_FETCH_FROM_GIT "${PICO_SDK_FETCH_FROM_GIT}" CACHE BOOL "Set to ON to fetch copy of SDK from git if not otherwise locatable")
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
            message("Downloading Raspberry Pi Pico SDK")
            FetchContent_Populate(pico_sdk)
            set(PICO_SDK_PATH ${pico_sdk_SOURCE_DIR})
        endif ()
        set(FETCHCONTENT_BASE_DIR ${FETCHCONTENT_BASE_DIR_SAVE})
    else ()
        message(FATAL_ERROR
                "SDK location was not specified. Please set PICO_SDK_PATH or set PICO_SDK_FETCH_FROM_GIT to on to fetch from git."
                )
    endif ()
endif ()

get_filename_component(PICO_SDK_PATH "${PICO_SDK_PATH}" REALPATH BASE_DIR "${CMAKE_BINARY_DIR}")
if (NOT EXISTS ${PICO_SDK_PATH})
    message(FATAL_ERROR "Directory '${PICO_SDK_PATH}' not found")
endif ()

set(PICO_SDK_INIT_CMAKE_FILE ${PICO_SDK_PATH}/pico_sdk_init.cmake)
if (NOT EXISTS ${PICO_SDK_INIT_CMAKE_FILE})
    message(FATAL_ERROR "Directory '${PICO_SDK_PATH}' does not appear to contain the Raspberry Pi Pico SDK")
endif ()

set(PICO_SDK_PATH ${PICO_SDK_PATH} CACHE PATH "Path to the Raspberry Pi Pico SDK" FORCE)

include(${PICO_SDK_INIT_CMAKE_FILE})

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
    { "type": "wokwi-neopixel", "id": "rgb1", "top": 54.1, "left": 152.6, "attrs": {} },
    { "type": "wokwi-vcc", "id": "vcc1", "top": 10.36, "left": 124.8, "attrs": {} },
    { "type": "wokwi-gnd", "id": "gnd1", "top": 105.6, "left": 133.8, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "rgb1:DIN", "pico:GP16", "green", [ "h28", "v134.4", "h-124.8" ] ],
    [ "rgb1:VDD", "vcc1:VCC", "green", [ "h0" ] ],
    [ "gnd1:GND", "rgb1:VSS", "black", [ "v-19.2", "h28.8" ] ]
  ],
  "dependencies": {}
}
```

# wokwi.toml
```xml
[wokwi]
version = 1
firmware = "cmake-build-debug/pipo_project.uf2"
elf = "cmake-build-debug/pipo_project.elf"
```

# copy_uf2.bat
```bash
@echo off
set "src=D:\workspace\gitee\0\pipocmake\cmake-build-debug\pipo_project.uf2"
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

# ws2812.pio
```bash
;
; Copyright (c) 2020 Raspberry Pi (Trading) Ltd.
;
; SPDX-License-Identifier: BSD-3-Clause
;

.program ws2812
.side_set 1

.define public T1 2
.define public T2 5
.define public T3 3

.lang_opt python sideset_init = pico.PIO.OUT_HIGH
.lang_opt python out_init     = pico.PIO.OUT_HIGH
.lang_opt python out_shiftdir = 1

.wrap_target
bitloop:
    out x, 1       side 0 [T3 - 1] ; Side-set still takes place when instruction stalls
    jmp !x do_zero side 1 [T1 - 1] ; Branch on the bit we shifted out. Positive pulse
do_one:
    jmp  bitloop   side 1 [T2 - 1] ; Continue driving high, for a long pulse
do_zero:
    nop            side 0 [T2 - 1] ; Or drive low, for a short pulse
.wrap

% c-sdk {
#include "hardware/clocks.h"

static inline void ws2812_program_init(PIO pio, uint sm, uint offset, uint pin, float freq, bool rgbw) {

    pio_gpio_init(pio, pin);
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, true);

    pio_sm_config c = ws2812_program_get_default_config(offset);
    sm_config_set_sideset_pins(&c, pin);
    sm_config_set_out_shift(&c, false, true, rgbw ? 32 : 24);
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_TX);

    int cycles_per_bit = ws2812_T1 + ws2812_T2 + ws2812_T3;
    float div = clock_get_hz(clk_sys) / (freq * cycles_per_bit);
    sm_config_set_clkdiv(&c, div);

    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
}
%}

```

# ws2812.pio.h
```c
// -------------------------------------------------- //
// This file is autogenerated by pioasm; do not edit! //
// -------------------------------------------------- //

#pragma once

#if !PICO_NO_HARDWARE
#include "hardware/pio.h"
#endif

// ------ //
// ws2812 //
// ------ //

#define ws2812_wrap_target 0
#define ws2812_wrap 3

#define ws2812_T1 2
#define ws2812_T2 5
#define ws2812_T3 3

static const uint16_t ws2812_program_instructions[] = {
            //     .wrap_target
    0x6221, //  0: out    x, 1            side 0 [2] 
    0x1123, //  1: jmp    !x, 3           side 1 [1] 
    0x1400, //  2: jmp    0               side 1 [4] 
    0xa442, //  3: nop                    side 0 [4] 
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program ws2812_program = {
    .instructions = ws2812_program_instructions,
    .length = 4,
    .origin = -1,
};

static inline pio_sm_config ws2812_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + ws2812_wrap_target, offset + ws2812_wrap);
    sm_config_set_sideset(&c, 1, false, false);
    return c;
}

#include "hardware/clocks.h"
static inline void ws2812_program_init(PIO pio, uint sm, uint offset, uint pin, float freq, bool rgbw) {
    pio_gpio_init(pio, pin);
    pio_sm_set_consecutive_pindirs(pio, sm, pin, 1, true);
    pio_sm_config c = ws2812_program_get_default_config(offset);
    sm_config_set_sideset_pins(&c, pin);
    sm_config_set_out_shift(&c, false, true, rgbw ? 32 : 24);
    sm_config_set_fifo_join(&c, PIO_FIFO_JOIN_TX);
    int cycles_per_bit = ws2812_T1 + ws2812_T2 + ws2812_T3;
    float div = clock_get_hz(clk_sys) / (freq * cycles_per_bit);
    sm_config_set_clkdiv(&c, div);
    pio_sm_init(pio, sm, offset, &c);
    pio_sm_set_enabled(pio, sm, true);
}

#endif


```

# main.cpp
默认打印到usb虚拟串口, wokwi 不打印，所以要手动指定串口引脚。
或者在CMakeLists.txt 添加 如下内容才行
```c
# Enable UART  output,disable USB output
pico_enable_stdio_usb(pipo_project 0)
pico_enable_stdio_uart(pipo_project 1)
```
```c
#include <stdio.h>
#include <stdlib.h>

#include "pico/stdlib.h"
#include "hardware/pio.h"
#include "hardware/clocks.h"
#include "ws2812.pio.h"

void put_pixel(uint32_t pixel_grb)
{
    pio_sm_put_blocking(pio0, 0, pixel_grb << 8u);
}
void put_rgb(uint8_t red, uint8_t green, uint8_t blue)
{
    uint32_t mask = (green << 16) | (red << 8) | (blue << 0);
    put_pixel(mask);
}

#define UART_ID uart0
#define BAUD_RATE 115200

// We are using pins 0 and 1, but see the GPIO function select table in the
// datasheet for information on which other pins can be used.
#define UART_TX_PIN 0
#define UART_RX_PIN 1


int main()
{
    //set_sys_clock_48();
    stdio_init_all();
    // Set up our UART with the required speed.
    uart_init(UART_ID, BAUD_RATE);

    // Set the TX and RX pins by using the function select on the GPIO
    // Set datasheet for more information on function select
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);



    PIO pio = pio0;
    int sm = 0;
    uint offset = pio_add_program(pio, &ws2812_program);
    uint8_t cnt = 0;

    uart_putc_raw(UART_ID, 'A');

    ws2812_program_init(pio, sm, offset, 16, 800000, true);

    while (1)
    {
        for (cnt = 0; cnt < 0xff; cnt++)
        {
            put_rgb(cnt, 0xff - cnt, 0);
            sleep_ms(3);
        }
        for (cnt = 0; cnt < 0xff; cnt++)
        {
            put_rgb(0xff - cnt, 0, cnt);
            sleep_ms(3);
        }
        for (cnt = 0; cnt < 0xff; cnt++)
        {
            put_rgb(0, cnt, 0xff - cnt);
            sleep_ms(3);
        }

        uart_puts(UART_ID,"\rABABAB \n");
    }
}

```
