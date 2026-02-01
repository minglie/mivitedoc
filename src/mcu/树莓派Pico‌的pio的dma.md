# main.c
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/dma.h"

// 源数据缓冲区：将要被DMA复制的数据
const char src[] = "Hello, world! (from DMA)";
// 目标数据缓冲区：DMA复制数据的目的地（大小与源缓冲区一致）
char dst[count_of(src)];

int main() {
    // 初始化所有标准输入输出（用于串口打印）
    stdio_init_all();

    // 获取一个空闲的DMA通道，如果没有可用通道则触发panic（程序终止）
    int chan = dma_claim_unused_channel(true);

    // 配置DMA传输参数：
    // 1. 传输数据宽度为8位（1字节）
    // 2. 读取地址自增：每次传输后，读取指针自动指向源缓冲区下一个字节
    // 3. 写入地址自增：每次传输后，写入指针自动指向目标缓冲区下一个字节
    // 4. 不选择数据请求信号（DREQ），DMA将以最快速度进行传输

    // 获取通道默认配置
    dma_channel_config c = dma_channel_get_default_config(chan);
    // 设置传输数据大小为8位
    channel_config_set_transfer_data_size(&c, DMA_SIZE_8);
    // 启用读取地址自增
    channel_config_set_read_increment(&c, true);
    // 启用写入地址自增
    channel_config_set_write_increment(&c, true);

    // 配置并启动DMA通道
    dma_channel_configure(
            chan,          // 要配置的DMA通道
            &c,            // 上面创建的配置参数
            dst,           // 初始写入地址（目标缓冲区起始位置）
            src,           // 初始读取地址（源缓冲区起始位置）
            count_of(src), // 传输次数：等于源数据的字节数（每次传输1字节）
            true           // 是否立即启动传输：是
    );

    // 可选操作：在DMA传输期间，CPU可以去执行其他任务
    // 本示例中CPU无其他工作，因此阻塞等待DMA传输完成
    dma_channel_wait_for_finish_blocking(chan);

    // DMA已完成数据复制：将源缓冲区（src）的数据复制到了目标缓冲区（dst）
    // 从目标缓冲区读取数据并打印
    puts(dst);
}
```

# CMakeLists.txt
```bash
cmake_minimum_required(VERSION 3.13)

include(pico_sdk_import.cmake)

project(pio_squarewave C CXX ASM)
pico_sdk_init()

add_executable(pio_squarewave
        main.c
)

pico_generate_pio_header(pio_squarewave ${CMAKE_CURRENT_LIST_DIR}/uart_rx.pio)

target_link_libraries(pio_squarewave  pico_multicore hardware_dma   pico_stdlib hardware_pio)

pico_add_extra_outputs(pio_squarewave)


```