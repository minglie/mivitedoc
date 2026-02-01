# [Atshell](https://blog.csdn.net/qq_26074053/article/details/149534940)
# main.cpp  标准库阻塞轮询
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "AtShell.h"

int Bsp_shell_write(uint8_t* buf, uint32_t len,uint32_t timeout)
{
    return printf("%.*s", len, buf);
}

static int test01(int argc, char** argv) {
    AT_printf("argc %d:\r\n", argc);
    return 0;
}

int main() {
    stdio_init_all();
    at_init(Bsp_shell_write);
    AT_SHELL_EXPORT(test01, "", test01);
    at_show_version();
    while (true) {
        char retChar = getchar();
        at_import((uint8_t *)&retChar, 1, 0);
        sleep_ms(1);  
    }
    return 0;
}

```
# main.cpp  中断收,中断发
```c
#include "pico/stdio.h"
#include "pico/stdlib.h"
#include "hardware/uart.h"
#include "hardware/irq.h"
#include "AtShell.h"

#define UART_ID uart0
#define UART_BAUDRATE 115200
#define UART_TX_PIN 0
#define UART_RX_PIN 1

int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout)
{
    for (uint32_t i = 0; i < len; i++) {
        putchar_raw(buf[i]);
    }
    return len;
}

static int test01(int argc, char** argv)
{
    AT_printf("argc %d:\r\n", argc);
    return 0;
}

/* UART RX 中断处理 */
void on_uart_rx(void)
{
    while (uart_is_readable(UART_ID)) {
        uint8_t ch = uart_getc(UART_ID);
        at_import(&ch, 1, 0);
    }
}

int main(void)
{
    stdio_init_all();

    /* UART 初始化 */
    uart_init(UART_ID, UART_BAUDRATE);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);

    uart_set_hw_flow(UART_ID, false, false);
    uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
    uart_set_fifo_enabled(UART_ID, true);

    /* 注册 IRQ */
    irq_set_exclusive_handler(UART0_IRQ, on_uart_rx);
    irq_set_enabled(UART0_IRQ, true);
    uart_set_irq_enables(UART_ID, true, false);

    /* AT Shell */
    at_init(Bsp_shell_write);
    AT_SHELL_EXPORT(test01, "", test01);
    at_show_version();

    /* 主循环什么都不用干 */
    while (true) {
        tight_loop_contents();
    }
}

```

# main.cpp 中断收,用发送缓冲区主函数发
```c
#include "pico/stdlib.h"
#include "hardware/uart.h"
#include "hardware/irq.h"
#include "AtShell.h"
#include <cstdint>

/* ================= UART 配置 ================= */
#define UART_ID        uart0
#define UART_BAUDRATE  115200
#define UART_TX_PIN    0
#define UART_RX_PIN    1

/* ================= TX 缓冲区类 ================= */
class UartTxBuffer {
public:
    explicit UartTxBuffer(size_t size)
            : size_(size), head_(0), tail_(0)
    {
        buf_ = new uint8_t[size_];
    }

    ~UartTxBuffer() {
        delete[] buf_;
    }

    // 写入缓冲区（返回写入字节数）
    size_t write(const uint8_t* data, size_t len) {
        size_t written = 0;
        for (size_t i = 0; i < len; i++) {
            if (isFull()) break;
            buf_[head_] = data[i];
            head_ = (head_ + 1) % size_;
            written++;
        }
        return written;
    }

    // 从缓冲区读取一个字节
    bool read(uint8_t& data) {
        if (isEmpty()) return false;
        data = buf_[tail_];
        tail_ = (tail_ + 1) % size_;
        return true;
    }

    bool isEmpty() const { return head_ == tail_; }
    bool isFull()  const { return (head_ + 1) % size_ == tail_; }

private:
    uint8_t* buf_;
    size_t size_;
    volatile size_t head_;
    volatile size_t tail_;
};

/* ================= 全局对象 ================= */
UartTxBuffer shellTxBuffer(512);

/* ================= BSP 写接口(这个方法是正常是在中断里用的) ================= */
int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout) {
    (void)timeout;
    return shellTxBuffer.write(buf, len);
}

/* ================= 测试命令 ================= */
static int test01(int argc, char** argv) {
    AT_printf("argc = %d\r\n", argc);
    for (int i = 0; i < argc; i++)
        AT_printf("argv[%d] = %s\r\n", i, argv[i]);
    return 0;
}

/* ================= UART RX 中断 ================= */
void on_uart_rx() {
    while (uart_is_readable(UART_ID)) {
        uint8_t ch = uart_getc(UART_ID);
        at_import(&ch, 1, 0);
    }
}

/* ================= main ================= */
int main() {
    stdio_init_all();

    /* UART 初始化 */
    uart_init(UART_ID, UART_BAUDRATE);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);
    uart_set_hw_flow(UART_ID, false, false);
    uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
    uart_set_fifo_enabled(UART_ID, true);

    /* UART RX 中断 */
    irq_set_exclusive_handler(UART0_IRQ, on_uart_rx);
    irq_set_enabled(UART0_IRQ, true);
    uart_set_irq_enables(UART_ID, true, false);

    /* AtShell 初始化 */
    at_init(Bsp_shell_write);
    AT_SHELL_EXPORT(test01, "test01", test01);
    at_show_version();

    /* 主循环：统一发送 Shell 输出 */
    while (true) {
        uint8_t ch;
        while (!shellTxBuffer.isEmpty() && uart_is_writable(UART_ID)) {
            if (shellTxBuffer.read(ch))
                uart_putc_raw(UART_ID, ch);
        }
        tight_loop_contents();
    }
}


```
# main.cpp 非阻塞轮询查 (兼容usb_cdc)
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "AtShell.h"

int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout)
{
    return printf("%.*s", len, buf);
}

static int test01(int argc, char** argv)
{
    AT_printf("argc %d:\r\n", argc);
    return 0;
}

int main(void)
{
    stdio_init_all();
    at_init(Bsp_shell_write);
    AT_SHELL_EXPORT(test01, "", test01);
    at_show_version();
    while (true) {
        int ch = getchar_timeout_us(0);
        if (ch != PICO_ERROR_TIMEOUT) {
            uint8_t c = (uint8_t)ch;
            at_import(&c, 1, 0);
        }
        sleep_ms(1);
    }
}

```

# main.cpp   非阻塞轮询查+dma发送
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/uart.h"
#include "hardware/dma.h"
#include "AtShell.h"

/* ================= UART & DMA 配置 ================= */

#define UART_ID       uart0
#define UART_TX_PIN   0
#define UART_RX_PIN   1
#define UART_BAUDRATE 115200

static int uart_tx_dma_chan;
static dma_channel_config uart_tx_dma_cfg;

/* ================= UART + DMA 初始化 ================= */

static void uart_dma_init(void)
{
    /* UART 初始化 */
    uart_init(UART_ID, UART_BAUDRATE);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);

    uart_set_format(UART_ID, 8, 1, UART_PARITY_NONE);
    uart_set_fifo_enabled(UART_ID, true);

    /* 申请 DMA 通道 */
    uart_tx_dma_chan = dma_claim_unused_channel(true);
    uart_tx_dma_cfg = dma_channel_get_default_config(uart_tx_dma_chan);

    channel_config_set_transfer_data_size(&uart_tx_dma_cfg, DMA_SIZE_8);
    channel_config_set_read_increment(&uart_tx_dma_cfg, true);
    channel_config_set_write_increment(&uart_tx_dma_cfg, false);
    channel_config_set_dreq(&uart_tx_dma_cfg, uart_get_dreq(UART_ID, true));

    dma_channel_configure(
            uart_tx_dma_chan,
            &uart_tx_dma_cfg,
            &uart_get_hw(UART_ID)->dr,  // UART TX 数据寄存器
            NULL,
            0,
            false
    );
}

/* ================= DMA 阻塞发送 ================= */

static void uart_tx_dma_blocking(uint8_t *buf, uint32_t len)
{
    dma_channel_set_read_addr(uart_tx_dma_chan, buf, false);
    dma_channel_set_trans_count(uart_tx_dma_chan, len, true);

    while (dma_channel_is_busy(uart_tx_dma_chan)) {
        tight_loop_contents();
    }
}

/* ================= AtShell 输出接口 ================= */

int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout)
{
    uart_tx_dma_blocking(buf, len);
    return len;
}

/* ================= 示例命令 ================= */

static int test01(int argc, char** argv)
{
    AT_printf("argc %d\r\n", argc);
    return 0;
}

/* ================= main ================= */

int main(void)
{
    stdio_init_all();    // RX 使用 getchar_timeout_us
    uart_dma_init();     // TX 使用 UART + DMA

    at_init(Bsp_shell_write);
    AT_SHELL_EXPORT(test01, "", test01);
    at_show_version();

    while (true) {
        int ch;
        while ((ch = getchar_timeout_us(0)) != PICO_ERROR_TIMEOUT) {
            uint8_t c = (uint8_t)ch;
            at_import(&c, 1, 0);
        }
        sleep_ms(1);
    }
}
```


# main.cpp [加入Protothread](https://blog.csdn.net/qq_26074053/article/details/152075556)
```c
#include <stdio.h>
#include "pico/stdlib.h"
#include "AtShell.h"
#include "Protothread.h"

int Bsp_shell_write(uint8_t* buf, uint32_t len, uint32_t timeout)
{
    return printf("%.*s", len, buf);
}

class LedPt0 : public Protothread {
    void Init() {
        AT_println("LedPt0 init");
    }
    bool Run() {
        WHILE(1) {
                //2000ms 打印一次时间
                PT_DELAY_MS(2000);
                AT_printf("LedPt0 run %d\n",to_ms_since_boot(get_absolute_time()));
            }
        PT_END();
    }
};

class LedPt1 : public Protothread {
    void Init() {
        AT_println("LedPt init");
    }
    bool Run() {
        WHILE(1) {
                //等待别人发送消息后打印一条消息
                PT_WAIT_UNTIL(PopInData());
                AT_printf("LedPt1 run\n");
            }
        PT_END();
    }
};

LedPt1 ledPt1;
LedPt0 ledPt0;

static int test01(int argc, char** argv)
{
    AT_printf("argc %d:\r\n", argc);
    // 给ledPt1发消息
    Protothread::PushIndata((Protothread *) &ledPt1, 1);
    return 0;
}


int main(void)
{
    static uint32_t s_ms_tick=0;
    static uint32_t s_ms_s=0;
    stdio_init_all();
    at_init(Bsp_shell_write);
    AT_SHELL_EXPORT(test01, "", test01);
    at_show_version();
    //启动PT协程
    Protothread::AllStart();
    while (true) {
        uint32_t ms = to_ms_since_boot(get_absolute_time());
        if(ms-s_ms_tick>=PT_THREAD_TICK_MS){
            s_ms_tick=ms;
            s_ms_s=1;
        }
        if(s_ms_s){
            int ch = getchar_timeout_us(0);
            if (ch != PICO_ERROR_TIMEOUT) {
                uint8_t c = (uint8_t)ch;
                at_import(&c, 1, 0);
            }
            Protothread::OnTickAll();
            s_ms_s=0;
        }
    }
}


```


# cmakeList
```bash
# Set minimum CMake version required
cmake_minimum_required(VERSION 3.13)

# Set Pico SDK path
set(PICO_SDK_PATH "D:/Program Files/Raspberry Pi/Pico SDK v1.5.1/pico-sdk")

# Include the Pico SDK CMake configuration
include(pico_sdk_import.cmake)

# Set project name and language
project(pipo_project C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# Initialize the Pico SDK
pico_sdk_init()

# Add executable target
add_executable(pipo_project
        src/main.cpp
        src/AtShell.cpp
)

# Link the Pico SDK libraries
target_link_libraries(pipo_project
        pico_stdlib
        hardware_dma
)

# Enable USB output, disable UART output
pico_enable_stdio_usb(pipo_project 0)
pico_enable_stdio_uart(pipo_project 1)

# Create additional output files
pico_add_extra_outputs(pipo_project)

```

![在这里插入图片描述](https://i-blog.csdnimg.cn/direct/be10cb86d41c4cd5ad6a0f9207659956.png)
