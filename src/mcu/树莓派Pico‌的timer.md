[pico-sdk-api文档](https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pio)

[rp2040-datasheet.pdf](https://pip-assets.raspberrypi.com/categories/814-rp2040/documents/RP-008371-DS-1-rp2040-datasheet.pdf?disposition=inline)

[getting-started-with-pico.pdf](https://pip-assets.raspberrypi.com/categories/610-raspberry-pi-pico/documents/RP-008276-DS-1-getting-started-with-pico.pdf?disposition=inline)

[树莓派 Pico 之可编程 IO（PIO）](https://pico.nxez.com/2023/11/06/programmable-io-on-raspberry-pi-pico.html)
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
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": -143.65, "left": 326.4, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "pico:GP21", "logic1:D0", "green", [ "h116.4", "v-230.4", "h19.2", "v-38.4" ] ]
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
10us 进入一次定时器中断
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/timer.h"
#include "hardware/irq.h"

#define ALARM_NUM 0
#define ALARM_IRQ TIMER_IRQ_0

const uint LED_PIN = 21;

// 每 10 微秒触发一次中断
#define PERIOD_US 10+1

// 中断处理函数：每 1µs 翻转 GPIO
static void timer0_irq_handler(void) {
    // 清除 timer0 中断标志
    hw_clear_bits(&timer_hw->intr, 1u << ALARM_NUM);

    // 翻转 LED 电平
    gpio_xor_mask(1u << LED_PIN);

    // 设置下一次中断（当前时间 + 1µs）
    uint32_t next = timer_hw->timerawl + PERIOD_US;
    timer_hw->alarm[ALARM_NUM] = next;
}

static void init_timer0_interrupt(void) {
    // 清中断标志
    hw_clear_bits(&timer_hw->intr, 1u << ALARM_NUM);

    // 使能 timer0 中断
    hw_set_bits(&timer_hw->inte, 1u << ALARM_NUM);

    // 注册中断处理函数
    irq_set_exclusive_handler(ALARM_IRQ, timer0_irq_handler);
    irq_set_enabled(ALARM_IRQ, true);

    // 第一次触发：当前时间 + PERIOD_US
    timer_hw->alarm[ALARM_NUM] = timer_hw->timerawl + PERIOD_US;
}

int main() {
    stdio_init_all();

    gpio_init(LED_PIN);
    gpio_set_dir(LED_PIN, GPIO_OUT);
    gpio_put(LED_PIN, 0);   // 初始为低电平

    init_timer0_interrupt();

    // 主循环不做任何事
    while (true) {
        tight_loop_contents();
    }
}


```