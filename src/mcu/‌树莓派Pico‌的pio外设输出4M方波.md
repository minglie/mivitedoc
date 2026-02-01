![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/070a707c635040e996139eb8798a3ca0.png)

# CmakeList
```bash
cmake_minimum_required(VERSION 3.13)
include(pico_sdk_import.cmake)
project(pio_squarewave C CXX ASM)
pico_sdk_init()
add_executable(pio_squarewave
        main.c
        squarewave.pio
)
pico_generate_pio_header(pio_squarewave ${CMAKE_CURRENT_LIST_DIR}/squarewave.pio)
target_link_libraries(pio_squarewave pico_stdlib hardware_pio)
pico_add_extra_outputs(pio_squarewave)
```
# squarewave.pio
```bash
.program squarewave
.wrap_target
    set pins, 1   ; 输出高电平
    set pins, 0   ; 输出低电平
.wrap
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
    {
      "type": "wokwi-led",
      "id": "led1",
      "top": -13.2,
      "left": 176.6,
      "attrs": { "color": "red" }
    },
    { "type": "wokwi-gnd", "id": "gnd1", "top": 48, "left": 162.6, "attrs": {} },
    { "type": "wokwi-logic-analyzer", "id": "logic1", "top": -143.65, "left": 163.2, "attrs": {} }
  ],
  "connections": [
    [ "pico:GP0", "$serialMonitor:RX", "", [] ],
    [ "pico:GP1", "$serialMonitor:TX", "", [] ],
    [ "led1:A", "pico:GP16", "green", [ "v0" ] ],
    [ "led1:C", "gnd1:GND", "green", [ "v9.6", "h-28.4" ] ],
    [ "logic1:D0", "pico:GP16", "green", [ "h-57.6", "v297.6", "h9.6" ] ]
  ],
  "dependencies": {}
}
```

# main.c
```c
#include "pico/stdlib.h"
#include "hardware/pio.h"
#include "squarewave.pio.h"

int main() {
    stdio_init_all();

    PIO pio = pio0;
    uint sm = 0;

    // 加载 PIO 程序
    uint offset = pio_add_program(pio, &squarewave_program);

    // 配置引脚 GP16
    const uint PIN = 16;
    pio_gpio_init(pio, PIN);
    pio_sm_set_consecutive_pindirs(pio, sm, PIN, 1, true);

    // 配置状态机
    pio_sm_config c = squarewave_program_get_default_config(offset);

    // 绑定输出 pin
    sm_config_set_set_pins(&c, PIN, 1);

    // =============== 计算 1 Hz 的 divider ===============
    //
    // PIO 程序每个指令执行 1 个 PIO 时钟
    // 程序包含两条指令：set 1 + set 0
    // => 每两个 PIO 时钟输出一个周期（高+低）
    //
    // f_out = f_clk / (divider * 2)
    //
    // 要输出 f_out = 4MHz:
    //  divider = f_clk / (2 * f_out) = 125000000 /2*4000000 = 15.625
    //
    float divider = 15.625f;

    sm_config_set_clkdiv(&c, divider);

    // 初始化 SM
    pio_sm_init(pio, sm, offset, &c);

    // 启动 SM
    pio_sm_set_enabled(pio, sm, true);

    while (1)
        tight_loop_contents();
}

```

# [pulseview](https://sigrok.org/wiki/Downloads) 查看波形
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/9c07ca00f5a440dc8c5b42f195dc5c81.png)
![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/18e96819e4e747efb3a7d460405d0947.png)
## Import Value Change Dump data（VCD 导入选项说明）

### 1. Compress idle periods（压缩空闲周期）
- 作用：减少数据量
- 当信号长时间保持不变时，可将这些空闲周期压缩掉
- 0 = 不压缩（默认）

### 2. Downsampling factor（下采样因子）
- 导入时对采样数据进行下采样
- 数值 N 表示每 N 个样本只保留 1 个
- 1 = 不下采样

### 3. Max number of sigrok channels（最大 Sigrok 通道数）
- 限制导入的最大通道数量
- 0 = 不限制（导入全部通道）

### 4. Overwrite Samplerate（覆盖采样率）
- 强制设定采样率
- 0 = 不覆盖（按 VCD 自带时间信息）

### 5. Skip this many initial samples（跳过前 N 个样本）
- 导入 VCD 时跳过前 N 个样本
- 0 = 不跳过

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/0389efad53154c83823feaa048fb1f58.png)
