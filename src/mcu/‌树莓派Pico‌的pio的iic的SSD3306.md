![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/684fb6c0703a40338bb487f3fe4c5cf3.png)

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/8495841efde54a66bcecb137a4b558e5.png)


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
        pio_i2c.c
        iic.pio
)
pico_generate_pio_header(pio_squarewave ${CMAKE_CURRENT_LIST_DIR}/iic.pio)
target_link_libraries(pio_squarewave pico_stdlib hardware_pio)
pico_add_extra_outputs(pio_squarewave)

```
# iic.pio
```c
;
; 版权 (c) 2020 Raspberry Pi (Trading) Ltd.
;
; SPDX-License-Identifier: BSD-3-Clause
;

.program i2c
.side_set 1 opt pindirs

;===============================
;  TX FIFO 数据格式（16 bit）
;===============================
; | 15:10 |  9   | 8:1  | 0   |
; | Instr | Final | Data | NAK |
;
; Instr > 0 ：表示此 FIFO 项为“指令计数”，无数据字节，
;             接下来的 Instr + 1 个 FIFO 项将被解析为指令序列。
;
; Instr = 0 ：表示此 FIFO 项为“数据字节”，需移出 Data[7:0] 并处理 ACK。
;
; Final = 1 ：表示这是本次传输的最后一个字节，若收到 NAK 不会中断。
; Final = 0 ：收到 NAK 则触发 IRQ 并暂停 SM。
;
; 自动拉取（autopull）需启用，阈值 16 bit。
; 自动推送（autopush）需启用，阈值 8 bit。
; 主机应使用半字（16bit）写入 TX FIFO，使 OSR 立即获得数据。
;
;===============================
;  引脚映射关系
;===============================
; SDA = 输入引脚 0, 输出 0, set pin 0, jmp pin
; SCL = 输入引脚 1 (用于 clock stretching)
; side-set 引脚 0 = SCL
; OUT 输出引脚 0 = SDA
;
; 等待（wait pin）要求：SCL 必须为 SDA + 1
;
; 注意：系统层需将 OE（输出使能）反相！
; 因 I²C 总线要求：OE=0 时驱动低电平，OE=1 时释放为上拉。
;

do_nack:
    jmp y-- entry_point        ; 若 y>0 表示允许 NAK，则继续执行
    irq wait 0 rel             ; 否则立即触发 IRQ，请求上层软件处理

;===============================
;  发送/接收一个完整字节（8bit + ACK）
;===============================
do_byte:
    set x, 7                   ; X = 7，表示需要循环 8 次（8 bit）
bitloop:
    out pindirs, 1         [7] ; 输出数据位（若是读操作则为全1表示释放）
    nop             side 1 [2] ; SCL 拉高（上升沿）
    wait 1 pin, 1          [4] ; 等待从机（支持 clock stretching）
    in pins, 1             [7] ; 在 SCL 高电平中间采样 SDA
    jmp x-- bitloop side 0 [7] ; SCL 拉低（下降沿），继续下一位

    ;===============
    ; 处理 ACK/NAK
    ;===============
    out pindirs, 1         [7] ; 读操作时，此处发送 ACK
    nop             side 1 [7] ; SCL 拉高
    wait 1 pin, 1          [7] ; 允许从机拉住 SCL（时钟延展）
    jmp pin do_nack side 0 [2] ; 若 SDA 高=NAK → 跳转 do_nack，否则继续

;=========================================
;  主执行入口
;=========================================
public entry_point:
.wrap_target
    out x, 6                   ; 从 OSR 取出 Instr（高 6 bits）
    out y, 1                   ; 取出 Final 位（是否忽略 NAK）
    jmp !x do_byte             ; 若 Instr = 0 → 处理数据字节
    out null, 32               ; Instr > 0 时，丢弃 OSR 其余数据位
do_exec:
    out exec, 16               ; 执行 1 条指令（从 FIFO 获取）
    jmp x-- do_exec            ; 循环 Instr + 1 次
.wrap


% c-sdk {

#include "hardware/clocks.h"
#include "hardware/gpio.h"


//=======================================================
//  初始化 PIO I²C 状态机
//  参数：
//      pio      - PIO 控制器
//      sm       - 状态机编号
//      offset   - 程序偏移地址
//      pin_sda  - SDA 引脚
//      pin_scl  - SCL 引脚（必须是 SDA+1）
//=======================================================
static inline void i2c_program_init(PIO pio, uint sm, uint offset, uint pin_sda, uint pin_scl) {
    assert(pin_scl == pin_sda + 1);
    pio_sm_config c = i2c_program_get_default_config(offset);

    // 配置 IO 功能：OUT/SET/IN/SIDESET/JMP PIN
    sm_config_set_out_pins(&c, pin_sda, 1);
    sm_config_set_set_pins(&c, pin_sda, 1);
    sm_config_set_in_pins(&c, pin_sda);
    sm_config_set_sideset_pins(&c, pin_scl);
    sm_config_set_jmp_pin(&c, pin_sda);

    // 配置移位寄存器
    sm_config_set_out_shift(&c, false, true, 16); // 自动拉取 16bit
    sm_config_set_in_shift(&c, false, true, 8);   // 自动推送 8bit

    // 设置 I²C 时钟：系统时钟 / (32 * 100kHz)
    float div = (float)clock_get_hz(clk_sys) / (32 * 100000);
    sm_config_set_clkdiv(&c, div);

    //----------------------------------------
    // 启动前避免“毛刺”影响 I²C 总线
    //----------------------------------------
    gpio_pull_up(pin_scl);
    gpio_pull_up(pin_sda);
    uint32_t both_pins = (1u << pin_sda) | (1u << pin_scl);
    pio_sm_set_pins_with_mask(pio, sm, both_pins, both_pins);
    pio_sm_set_pindirs_with_mask(pio, sm, both_pins, both_pins);

    pio_gpio_init(pio, pin_sda);
    gpio_set_oeover(pin_sda, GPIO_OVERRIDE_INVERT); // 反向 OE 以符合 I²C 开漏性质

    pio_gpio_init(pio, pin_scl);
    gpio_set_oeover(pin_scl, GPIO_OVERRIDE_INVERT);

    pio_sm_set_pins_with_mask(pio, sm, 0, both_pins);

    //----------------------------------------
    // 清除 IRQ 防止错误触发系统中断
    //----------------------------------------
    pio_set_irq0_source_enabled(pio, (enum pio_interrupt_source)((uint) pis_interrupt0 + sm), false);
    pio_set_irq1_source_enabled(pio, (enum pio_interrupt_source)((uint) pis_interrupt0 + sm), false);
    pio_interrupt_clear(pio, sm);

    //----------------------------------------
    // 初始化并启动 PIO 状态机
    //----------------------------------------
    pio_sm_init(pio, sm, offset + i2c_offset_entry_point, &c);
    pio_sm_set_enabled(pio, sm, true);
}

%}


.program set_scl_sda
.side_set 1 opt

;=======================================================
;  简单的 GPIO 控制指令表，用于生成 I²C 的
;  START、STOP、RESTART 等序列。
;  本程序不作为独立程序运行，只作为指令模板。
;=======================================================

    set pindirs, 0 side 0 [7] ; SCL=0, SDA=0
    set pindirs, 1 side 0 [7] ; SCL=0, SDA=1
    set pindirs, 0 side 1 [7] ; SCL=1, SDA=0
    set pindirs, 1 side 1 [7] ; SCL=1, SDA=1

% c-sdk {
// 指令表索引定义
enum {
    I2C_SC0_SD0 = 0,
    I2C_SC0_SD1,
    I2C_SC1_SD0,
    I2C_SC1_SD1
};
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
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": -28.45, "left": 220.8, "attrs": {} },
    {
      "type": "board-ssd1306",
      "id": "oled1",
      "top": 108.74,
      "left": 134.63,
      "attrs": { "i2cAddress": "0x3c" }
    },
    { "type": "wokwi-vcc", "id": "vcc1", "top": -18.44, "left": 105.6, "attrs": {} },
    { "type": "wokwi-gnd", "id": "gnd1", "top": 153.6, "left": 105, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "oled1:SDA", "pico:GP2", "green", [ "v0" ] ],
    [ "oled1:SCL", "pico:GP3", "green", [ "v0" ] ],
    [ "logic1:D0", "oled1:SDA", "green", [ "h0" ] ],
    [ "logic1:D1", "oled1:SCL", "green", [ "h0" ] ],
    [ "gnd1:GND", "oled1:GND", "black", [ "v-57.6", "h-9.6" ] ],
    [ "oled1:VCC", "vcc1:VCC", "red", [ "v-38.4", "h-67.05" ] ]
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
#include <stdio.h>
#include "pico/stdlib.h"
#include "pio_i2c.h"
#include <string.h>

#define PIN_SDA 2
#define PIN_SCL 3

// 假设已初始化 PIO I2C（pio0, sm0），以下是初始化指令序列
#define SSD3306_ADDR 0x3C
#define CMD_MODE 0x00  // 指令模式控制字节
#define DATA_MODE 0x40 // 数据模式控制字节

// SSD3306 屏幕参数（128x64 像素）
#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 64
#define PAGE_COUNT    8   // 64行 / 8行 per page = 8页


// 发送单字节指令
void ssd3306_send_cmd(uint8_t cmd) {
    uint sm = 0;
    uint8_t data[] = {CMD_MODE, cmd};
    pio_i2c_write_blocking(pio0, sm, SSD3306_ADDR, data, sizeof(data));
}

// 发送带参数的指令
void ssd3306_send_cmd_with_param(uint8_t cmd, uint8_t param) {
    uint sm = 0;
    uint8_t data[] = {CMD_MODE, cmd, param};
    pio_i2c_write_blocking(pio0, sm, SSD3306_ADDR, data, sizeof(data));
}

// 发送带2个参数的指令（如设置地址范围）
void ssd3306_send_cmd_with_2params(uint8_t cmd, uint8_t param1, uint8_t param2) {
    uint sm = 0;
    uint8_t data[] = {CMD_MODE, cmd, param1, param2};
    pio_i2c_write_blocking(pio0, sm, SSD3306_ADDR, data, sizeof(data));
}

// 初始化函数
void ssd3306_init() {
    ssd3306_send_cmd(0xAE);        // 关闭显示
    ssd3306_send_cmd_with_param(0xA8, 0x3F); // 多路复用比=64（128x64 屏）
    ssd3306_send_cmd_with_param(0xD3, 0x00); // 显示偏移=0
    ssd3306_send_cmd(0x40);        // 显示起始行=0
    ssd3306_send_cmd_with_param(0xA1, 0x00); // 段重映射=正常（0xA1 可改为 0xA0 翻转）
    ssd3306_send_cmd_with_param(0xDA, 0x12); // COM 引脚配置=0x12（128x64 屏）
    ssd3306_send_cmd_with_param(0x81, 0x7F); // 对比度=默认 0x7F（可调整 0x00~0xFF）
    ssd3306_send_cmd_with_param(0xA4, 0x00); // 正常显示（非全亮）
    ssd3306_send_cmd_with_param(0xA6, 0x00); // 正常极性（非反显）
    ssd3306_send_cmd_with_param(0xD5, 0x80); // 时钟分频=默认
    ssd3306_send_cmd_with_param(0xD9, 0x22); // 预充电周期=0x22（3.3V 供电）
    ssd3306_send_cmd_with_param(0xDB, 0x20); // VCOM 电压=0.77V
    ssd3306_send_cmd_with_param(0xAD, 0x8A); // 开启内置 DC-DC 转换器
    ssd3306_send_cmd_with_param(0x20, 0x02); // 显存寻址模式=页寻址（默认）
    ssd3306_send_cmd(0xAF);        // 开启显示
}

// 清屏（填充全黑）
void ssd3306_clear() {
    uint sm = 0;
    // 设置地址范围：全屏幕（列0~127，页0~7）
    ssd3306_send_cmd_with_2params(0x21, 0x00, SCREEN_WIDTH - 1);  // 列地址范围
    ssd3306_send_cmd_with_2params(0x22, 0x00, PAGE_COUNT - 1);    // 页地址范围

    // 填充 128*8=1024 字节的 0x00（全黑）
    uint8_t clear_buf[SCREEN_WIDTH + 1]; // 控制字节 + 128个数据字节
    clear_buf[0] = DATA_MODE;           // 数据模式控制字节
    memset(&clear_buf[1], 0x00, SCREEN_WIDTH); // 数据部分填充0

    for (int page = 0; page < PAGE_COUNT; page++) {
        pio_i2c_write_blocking(pio0, sm, SSD3306_ADDR, clear_buf, sizeof(clear_buf));
    }
}

/**
 * 画水平线
 * @param x1: 起始X坐标（0~127）
 * @param x2: 结束X坐标（0~127，需 ≥x1）
 * @param y: Y坐标（0~63）
 */
void ssd3306_draw_hline(uint8_t x1, uint8_t x2, uint8_t y) {
    if (x1 > x2 || y >= SCREEN_HEIGHT) return;

    // 计算当前Y坐标所在的页（page = y / 8）和页内偏移（bit = y % 8）
    uint8_t page = y / 8;
    uint8_t bit = y % 8;
    uint8_t pixel_data = 1 << bit; // 该Y坐标对应的像素位（1=点亮，0=熄灭）

    // 设置地址范围：列x1~x2，页page~page（仅操作当前页）
    ssd3306_send_cmd_with_2params(0x21, x1, x2);  // 列范围
    ssd3306_send_cmd_with_2params(0x22, page, page); // 页范围

    // 构造数据：控制字节 + (x2-x1+1)个像素数据
    uint8_t data_len = x2 - x1 + 1;
    uint8_t *line_buf = malloc(data_len + 1); // 动态分配缓冲区
    if (!line_buf) return;

    line_buf[0] = DATA_MODE; // 数据模式控制字节
    for (int i = 0; i < data_len; i++) {
        line_buf[i + 1] = pixel_data; // 每个X坐标都点亮对应Y位
    }

    // 写入显存
    pio_i2c_write_blocking(pio0, 0, SSD3306_ADDR, line_buf, data_len + 1);
    free(line_buf); // 释放缓冲区
}

/**
 * 画垂直线
 * @param x: X坐标（0~127）
 * @param y1: 起始Y坐标（0~63）
 * @param y2: 结束Y坐标（0~63，需 ≥y1）
 */
void ssd3306_draw_vline(uint8_t x, uint8_t y1, uint8_t y2) {
    if (x >= SCREEN_WIDTH || y1 > y2) return;

    // 遍历Y1到Y2对应的所有页
    for (uint8_t y = y1; y <= y2; y++) {
        uint8_t page = y / 8;
        uint8_t bit = y % 8;
        uint8_t pixel_data = 1 << bit;

        // 设置地址：列x~x，页page~page（仅操作当前X和页）
        ssd3306_send_cmd_with_2params(0x21, x, x);
        ssd3306_send_cmd_with_2params(0x22, page, page);

        // 写入单个像素数据
        uint8_t data[] = {DATA_MODE, pixel_data};
        pio_i2c_write_blocking(pio0, 0, SSD3306_ADDR, data, sizeof(data));
    }
}




int main() {
    // 初始化串口和PIO I2C
    stdio_init_all();
    sleep_ms(2000);  // Wait for UART connection (USB serial enumeration)

    PIO pio = pio0;
    uint sm = 0;
    uint offset = pio_add_program(pio, &i2c_program);
    i2c_program_init(pio, sm, offset, PIN_SDA, PIN_SCL);

    // 仅扫描 0x3C 地址
    printf("=== PIO I2C Single Address Scan ===\n");
    printf("Scanning target address: 0x%02X\n", SSD3306_ADDR);
    printf("SDA Pin: GPIO%d, SCL Pin: GPIO%d\n\n", PIN_SDA, PIN_SCL);

    // 检测 0x3C 地址（跳过保留地址判断，直接检测）
    int result = pio_i2c_read_blocking(pio, sm, SSD3306_ADDR, NULL, 0);

    // 输出检测结果（纯英文，无汉字）
    if (result >= 0) {
        printf("SUCCESS: Device found at 0x%02X\n", SSD3306_ADDR);
        printf("Status: I2C ACK received, bus communication normal\n");

        ssd3306_init();   // 初始化SSD3306
        ssd3306_clear();  // 清屏（避免乱码）
        // 画2条示例线
        ssd3306_draw_hline(10, 15, 32);  // 水平线：X1=10, X2=15, Y=32（屏幕中间的小短线）
        printf("Lines drawn successfully!\n");

    } else {
        printf("FAILED: No device found at 0x%02X\n", SSD3306_ADDR);
        printf("Possible reasons:\n");
        printf("  1. Device not powered on\n");
        printf("  2. Wrong wiring (SDA/SCL reversed?)\n");
        printf("  3. Missing 4.7K-10K pull-up resistors on SDA/SCL\n");
        printf("  4. Device actual address is not 0x%02X (e.g., 0x3D)\n", SSD3306_ADDR);
        printf("  5. GPIO pin definition mismatch with wiring\n");
    }

    // 循环保持程序运行
    while (true) {
        sleep_ms(1000);
    }

    return 0;
}

```

# pio_i2c.c
```c
/**
 * Copyright (c) 2021 Raspberry Pi (Trading) Ltd.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

#include "pio_i2c.h"

const int PIO_I2C_ICOUNT_LSB = 10;
const int PIO_I2C_FINAL_LSB  = 9;
const int PIO_I2C_DATA_LSB   = 1;
const int PIO_I2C_NAK_LSB    = 0;


bool pio_i2c_check_error(PIO pio, uint sm) {
    return pio_interrupt_get(pio, sm);
}

void pio_i2c_resume_after_error(PIO pio, uint sm) {
    pio_sm_drain_tx_fifo(pio, sm);
    pio_sm_exec(pio, sm, (pio->sm[sm].execctrl & PIO_SM0_EXECCTRL_WRAP_BOTTOM_BITS) >> PIO_SM0_EXECCTRL_WRAP_BOTTOM_LSB);
    pio_interrupt_clear(pio, sm);
}

void pio_i2c_rx_enable(PIO pio, uint sm, bool en) {
    if (en)
        hw_set_bits(&pio->sm[sm].shiftctrl, PIO_SM0_SHIFTCTRL_AUTOPUSH_BITS);
    else
        hw_clear_bits(&pio->sm[sm].shiftctrl, PIO_SM0_SHIFTCTRL_AUTOPUSH_BITS);
}

static inline void pio_i2c_put16(PIO pio, uint sm, uint16_t data) {
    while (pio_sm_is_tx_fifo_full(pio, sm))
        ;
    // some versions of GCC dislike this
#ifdef __GNUC__
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wstrict-aliasing"
#endif
    *(io_rw_16 *)&pio->txf[sm] = data;
#ifdef __GNUC__
#pragma GCC diagnostic pop
#endif
}


// If I2C is ok, block and push data. Otherwise fall straight through.
void pio_i2c_put_or_err(PIO pio, uint sm, uint16_t data) {
    while (pio_sm_is_tx_fifo_full(pio, sm))
        if (pio_i2c_check_error(pio, sm))
            return;
    if (pio_i2c_check_error(pio, sm))
        return;
    // some versions of GCC dislike this
#ifdef __GNUC__
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wstrict-aliasing"
#endif
    *(io_rw_16 *)&pio->txf[sm] = data;
#ifdef __GNUC__
#pragma GCC diagnostic pop
#endif
}

uint8_t pio_i2c_get(PIO pio, uint sm) {
    return (uint8_t)pio_sm_get(pio, sm);
}

void pio_i2c_start(PIO pio, uint sm) {
    pio_i2c_put_or_err(pio, sm, 1u << PIO_I2C_ICOUNT_LSB); // Escape code for 2 instruction sequence
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC1_SD0]);    // We are already in idle state, just pull SDA low
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC0_SD0]);    // Also pull clock low so we can present data
}

void pio_i2c_stop(PIO pio, uint sm) {
    pio_i2c_put_or_err(pio, sm, 2u << PIO_I2C_ICOUNT_LSB);
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC0_SD0]);    // SDA is unknown; pull it down
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC1_SD0]);    // Release clock
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC1_SD1]);    // Release SDA to return to idle state
};

void pio_i2c_repstart(PIO pio, uint sm) {
    pio_i2c_put_or_err(pio, sm, 3u << PIO_I2C_ICOUNT_LSB);
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC0_SD1]);
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC1_SD1]);
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC1_SD0]);
    pio_i2c_put_or_err(pio, sm, set_scl_sda_program_instructions[I2C_SC0_SD0]);
}

static void pio_i2c_wait_idle(PIO pio, uint sm) {
    // Finished when TX runs dry or SM hits an IRQ
    pio->fdebug = 1u << (PIO_FDEBUG_TXSTALL_LSB + sm);
    while (!(pio->fdebug & 1u << (PIO_FDEBUG_TXSTALL_LSB + sm) || pio_i2c_check_error(pio, sm)))
        tight_loop_contents();
}

int pio_i2c_write_blocking(PIO pio, uint sm, uint8_t addr, uint8_t *txbuf, uint len) {
    int err = 0;
    pio_i2c_start(pio, sm);
    pio_i2c_rx_enable(pio, sm, false);
    pio_i2c_put16(pio, sm, (addr << 2) | 1u);
    while (len && !pio_i2c_check_error(pio, sm)) {
        if (!pio_sm_is_tx_fifo_full(pio, sm)) {
            --len;
            pio_i2c_put_or_err(pio, sm, (*txbuf++ << PIO_I2C_DATA_LSB) | ((len == 0) << PIO_I2C_FINAL_LSB) | 1u);
        }
    }
    pio_i2c_stop(pio, sm);
    pio_i2c_wait_idle(pio, sm);
    if (pio_i2c_check_error(pio, sm)) {
        err = -1;
        pio_i2c_resume_after_error(pio, sm);
        pio_i2c_stop(pio, sm);
    }
    return err;
}

int pio_i2c_read_blocking(PIO pio, uint sm, uint8_t addr, uint8_t *rxbuf, uint len) {
    int err = 0;
    pio_i2c_start(pio, sm);
    pio_i2c_rx_enable(pio, sm, true);
    while (!pio_sm_is_rx_fifo_empty(pio, sm))
        (void)pio_i2c_get(pio, sm);
    pio_i2c_put16(pio, sm, (addr << 2) | 3u);
    uint32_t tx_remain = len; // Need to stuff 0xff bytes in to get clocks

    bool first = true;

    while ((tx_remain || len) && !pio_i2c_check_error(pio, sm)) {
        if (tx_remain && !pio_sm_is_tx_fifo_full(pio, sm)) {
            --tx_remain;
            pio_i2c_put16(pio, sm, (0xffu << 1) | (tx_remain ? 0 : (1u << PIO_I2C_FINAL_LSB) | (1u << PIO_I2C_NAK_LSB)));
        }
        if (!pio_sm_is_rx_fifo_empty(pio, sm)) {
            if (first) {
                // Ignore returned address byte
                (void)pio_i2c_get(pio, sm);
                first = false;
            }
            else {
                --len;
                *rxbuf++ = pio_i2c_get(pio, sm);
            }
        }
    }
    pio_i2c_stop(pio, sm);
    pio_i2c_wait_idle(pio, sm);
    if (pio_i2c_check_error(pio, sm)) {
        err = -1;
        pio_i2c_resume_after_error(pio, sm);
        pio_i2c_stop(pio, sm);
    }
    return err;
}


```

# pio_i2c.h
```c
/**
 * Copyright (c) 2021 Raspberry Pi (Trading) Ltd.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
#ifndef _PIO_I2C_H
#define _PIO_I2C_H

#include "iic.pio.h"

// ----------------------------------------------------------------------------
// Low-level functions

void pio_i2c_start(PIO pio, uint sm);
void pio_i2c_stop(PIO pio, uint sm);
void pio_i2c_repstart(PIO pio, uint sm);

bool pio_i2c_check_error(PIO pio, uint sm);
void pio_i2c_resume_after_error(PIO pio, uint sm);

// If I2C is ok, block and push data. Otherwise fall straight through.
void pio_i2c_put_or_err(PIO pio, uint sm, uint16_t data);
uint8_t pio_i2c_get(PIO pio, uint sm);

// ----------------------------------------------------------------------------
// Transaction-level functions

int pio_i2c_write_blocking(PIO pio, uint sm, uint8_t addr, uint8_t *txbuf, uint len);
int pio_i2c_read_blocking(PIO pio, uint sm, uint8_t addr, uint8_t *rxbuf, uint len);

#endif


```

# iic.pio.h
```c
// -------------------------------------------------- //
// This file is autogenerated by pioasm; do not edit! //
// -------------------------------------------------- //

#pragma once

#if !PICO_NO_HARDWARE
#include "hardware/pio.h"
#endif

// --- //
// i2c //
// --- //

#define i2c_wrap_target 12
#define i2c_wrap 17

#define i2c_offset_entry_point 12u

static const uint16_t i2c_program_instructions[] = {
    0x008c, //  0: jmp    y--, 12                    
    0xc030, //  1: irq    wait 0 rel                 
    0xe027, //  2: set    x, 7                       
    0x6781, //  3: out    pindirs, 1             [7] 
    0xba42, //  4: nop                    side 1 [2] 
    0x24a1, //  5: wait   1 pin, 1               [4] 
    0x4701, //  6: in     pins, 1                [7] 
    0x1743, //  7: jmp    x--, 3          side 0 [7] 
    0x6781, //  8: out    pindirs, 1             [7] 
    0xbf42, //  9: nop                    side 1 [7] 
    0x27a1, // 10: wait   1 pin, 1               [7] 
    0x12c0, // 11: jmp    pin, 0          side 0 [2] 
            //     .wrap_target
    0x6026, // 12: out    x, 6                       
    0x6041, // 13: out    y, 1                       
    0x0022, // 14: jmp    !x, 2                      
    0x6060, // 15: out    null, 32                   
    0x60f0, // 16: out    exec, 16                   
    0x0050, // 17: jmp    x--, 16                    
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program i2c_program = {
    .instructions = i2c_program_instructions,
    .length = 18,
    .origin = -1,
};

static inline pio_sm_config i2c_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + i2c_wrap_target, offset + i2c_wrap);
    sm_config_set_sideset(&c, 2, true, true);
    return c;
}

#include "hardware/clocks.h"
#include "hardware/gpio.h"
//=======================================================
//  初始化 PIO I²C 状态机
//  参数：
//      pio      - PIO 控制器
//      sm       - 状态机编号
//      offset   - 程序偏移地址
//      pin_sda  - SDA 引脚
//      pin_scl  - SCL 引脚（必须是 SDA+1）
//=======================================================
static inline void i2c_program_init(PIO pio, uint sm, uint offset, uint pin_sda, uint pin_scl) {
    assert(pin_scl == pin_sda + 1);
    pio_sm_config c = i2c_program_get_default_config(offset);
    // 配置 IO 功能：OUT/SET/IN/SIDESET/JMP PIN
    sm_config_set_out_pins(&c, pin_sda, 1);
    sm_config_set_set_pins(&c, pin_sda, 1);
    sm_config_set_in_pins(&c, pin_sda);
    sm_config_set_sideset_pins(&c, pin_scl);
    sm_config_set_jmp_pin(&c, pin_sda);
    // 配置移位寄存器
    sm_config_set_out_shift(&c, false, true, 16); // 自动拉取 16bit
    sm_config_set_in_shift(&c, false, true, 8);   // 自动推送 8bit
    // 设置 I²C 时钟：系统时钟 / (32 * 100kHz)
    float div = (float)clock_get_hz(clk_sys) / (32 * 100000);
    sm_config_set_clkdiv(&c, div);
    //----------------------------------------
    // 启动前避免“毛刺”影响 I²C 总线
    //----------------------------------------
    gpio_pull_up(pin_scl);
    gpio_pull_up(pin_sda);
    uint32_t both_pins = (1u << pin_sda) | (1u << pin_scl);
    pio_sm_set_pins_with_mask(pio, sm, both_pins, both_pins);
    pio_sm_set_pindirs_with_mask(pio, sm, both_pins, both_pins);
    pio_gpio_init(pio, pin_sda);
    gpio_set_oeover(pin_sda, GPIO_OVERRIDE_INVERT); // 反向 OE 以符合 I²C 开漏性质
    pio_gpio_init(pio, pin_scl);
    gpio_set_oeover(pin_scl, GPIO_OVERRIDE_INVERT);
    pio_sm_set_pins_with_mask(pio, sm, 0, both_pins);
    //----------------------------------------
    // 清除 IRQ 防止错误触发系统中断
    //----------------------------------------
    pio_set_irq0_source_enabled(pio, (enum pio_interrupt_source)((uint) pis_interrupt0 + sm), false);
    pio_set_irq1_source_enabled(pio, (enum pio_interrupt_source)((uint) pis_interrupt0 + sm), false);
    pio_interrupt_clear(pio, sm);
    //----------------------------------------
    // 初始化并启动 PIO 状态机
    //----------------------------------------
    pio_sm_init(pio, sm, offset + i2c_offset_entry_point, &c);
    pio_sm_set_enabled(pio, sm, true);
}

#endif

// ----------- //
// set_scl_sda //
// ----------- //

#define set_scl_sda_wrap_target 0
#define set_scl_sda_wrap 3

static const uint16_t set_scl_sda_program_instructions[] = {
            //     .wrap_target
    0xf780, //  0: set    pindirs, 0      side 0 [7] 
    0xf781, //  1: set    pindirs, 1      side 0 [7] 
    0xff80, //  2: set    pindirs, 0      side 1 [7] 
    0xff81, //  3: set    pindirs, 1      side 1 [7] 
            //     .wrap
};

#if !PICO_NO_HARDWARE
static const struct pio_program set_scl_sda_program = {
    .instructions = set_scl_sda_program_instructions,
    .length = 4,
    .origin = -1,
};

static inline pio_sm_config set_scl_sda_program_get_default_config(uint offset) {
    pio_sm_config c = pio_get_default_sm_config();
    sm_config_set_wrap(&c, offset + set_scl_sda_wrap_target, offset + set_scl_sda_wrap);
    sm_config_set_sideset(&c, 2, true, false);
    return c;
}

// 指令表索引定义
enum {
    I2C_SC0_SD0 = 0,
    I2C_SC0_SD1,
    I2C_SC1_SD0,
    I2C_SC1_SD1
};

#endif


```